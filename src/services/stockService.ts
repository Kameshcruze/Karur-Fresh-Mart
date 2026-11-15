import * as XLSX from 'xlsx';
import { MOCK_CATEGORIES } from '../mock/categories';
import {
  formatPackAndUnit,
  splitPackAndUnit,
  STOCK_SEED_25,
  toStockSheetRow,
} from '../mock/stockSeed';
import type {
  Brand,
  Category,
  Product,
  ProductTint,
  StockHistoryEntry,
  StockHistoryReason,
  StockImportErrorDetail,
  StockImportLog,
  StockImportMode,
  StockImportResult,
  StockPreviewRow,
  StockSheetExportRow,
} from '../types';
import {
  getCategories,
  loadBrandsStore,
  loadProductsStore,
  resolveBrandName,
  saveBrandsStore,
  saveProductsStore,
} from './productService';
import { readStorageJson, writeStorageJson } from './storage';

const STOCK_HISTORY_STORAGE_KEY = 'kfm_stock_history_v1';
const STOCK_IMPORT_LOGS_STORAGE_KEY = 'kfm_stock_import_logs_v1';

export const STOCK_TEMPLATE_COLUMNS: Array<keyof StockSheetExportRow> = [
  'item_code',
  'product_name',
  'product_name_tamil',
  'brand',
  'category',
  'pack_size',
  'unit',
  'mrp',
  'selling_price',
  'stock_qty',
  'low_stock_threshold',
  'visible_online',
  'image_url',
];

const CATEGORY_TINT_MAP: Record<string, ProductTint> = {
  'cat-rice': 'rice',
  'cat-dal': 'dal',
  'cat-oil': 'oil',
  'cat-spice': 'spice',
  'cat-dairy': 'dairy',
  'cat-snacks': 'dal',
  'cat-beverages': 'spice',
  'cat-household': 'salt',
  'cat-personal-care': 'dairy',
  'cat-fruits-veg': 'rice',
};

const INITIAL_STOCK_HISTORY: StockHistoryEntry[] = [
  {
    id: 'sh-seed-1',
    productId: 'prod-ponni-rice-10kg',
    productName: 'Ponni Boiled Rice (Aged 12M)',
    sku: 'KFM-RIC-101',
    who: 'Senthilnathan K (Store Admin)',
    when: '2026-11-15T06:30:00.000Z',
    oldValue: 18,
    newValue: 24,
    field: 'stock',
    reason: 'manual',
    note: 'Morning Jawahar Bazaar stock count update',
  },
  {
    id: 'sh-seed-2',
    productId: 'prod-chana-dal-500g',
    productName: 'Bengal Gram (Kadalai Paruppu)',
    sku: 'KFM-DAL-205',
    who: 'Aravindhan M',
    when: '2026-11-15T07:15:00.000Z',
    oldValue: 5,
    newValue: 3,
    field: 'stock',
    reason: 'order placed',
    note: 'Order KFM-1042',
  },
];

function loadStockHistoryStore(): StockHistoryEntry[] {
  const stored = readStorageJson<StockHistoryEntry[] | null>(
    STOCK_HISTORY_STORAGE_KEY,
    null,
  );
  if (stored && Array.isArray(stored)) {
    return stored;
  }
  writeStorageJson(STOCK_HISTORY_STORAGE_KEY, INITIAL_STOCK_HISTORY);
  return INITIAL_STOCK_HISTORY;
}

function saveStockHistoryStore(entries: StockHistoryEntry[]): void {
  writeStorageJson(STOCK_HISTORY_STORAGE_KEY, entries.slice(0, 500));
}

function loadImportLogsStore(): StockImportLog[] {
  const stored = readStorageJson<StockImportLog[] | null>(
    STOCK_IMPORT_LOGS_STORAGE_KEY,
    null,
  );
  return Array.isArray(stored) ? stored : [];
}

function saveImportLogsStore(logs: StockImportLog[]): void {
  writeStorageJson(STOCK_IMPORT_LOGS_STORAGE_KEY, logs.slice(0, 100));
}

export function appendStockHistoryEntry(
  entry: Omit<StockHistoryEntry, 'id' | 'when'> & { when?: string },
): StockHistoryEntry {
  const history = loadStockHistoryStore();
  const created: StockHistoryEntry = {
    ...entry,
    id: `sh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    when: entry.when ?? new Date().toISOString(),
  };
  saveStockHistoryStore([created, ...history]);
  return created;
}

export async function getStockHistory(productId?: string): Promise<StockHistoryEntry[]> {
  const history = loadStockHistoryStore();
  if (!productId) return history;
  return history.filter((h) => h.productId === productId);
}

export async function getImportLogs(): Promise<StockImportLog[]> {
  return loadImportLogsStore();
}

/**
 * Returns the 25 canonical Karur grocery sample rows for the downloadable Excel template.
 */
export function getTemplateSampleRows(): StockSheetExportRow[] {
  return STOCK_SEED_25.map(toStockSheetRow);
}

export function buildTemplateWorkbook(): XLSX.WorkBook {
  const rows = getTemplateSampleRows();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: STOCK_TEMPLATE_COLUMNS as string[],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'StockTemplate');
  return wb;
}

export function downloadTemplateXlsx(): void {
  const wb = buildTemplateWorkbook();
  XLSX.writeFile(wb, 'karur-fresh-mart-stock-template.xlsx');
}

function normalizeCellKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function pickSheetCell(row: Record<string, unknown>, keys: string[]): unknown {
  const normalized = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    normalized.set(normalizeCellKey(k), v);
  }
  for (const key of keys) {
    if (normalized.has(key)) return normalized.get(key);
  }
  return undefined;
}

function parseStrictNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return NaN;
    const cleaned = trimmed.replace(/[₹,\s]/g, '');
    return Number(cleaned);
  }
  return NaN;
}

function parseVisibleFlag(raw: unknown, fallback = true): boolean {
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return fallback;
  if (['no', 'false', '0', 'hidden', 'hide', 'n'].includes(s)) return false;
  if (['yes', 'true', '1', 'visible', 'show', 'y'].includes(s)) return true;
  return fallback;
}

function normalizePackKey(pack: string, unit?: string): string {
  return formatPackAndUnit(pack, unit)
    .toLowerCase()
    .replace(/\s+/g, '');
}

const CATEGORY_ALIASES: Record<string, string> = {
  'cooking oils': 'cat-oil',
  'cooking oil': 'cat-oil',
  'oils and ghee': 'cat-oil',
  'dairy and bakery': 'cat-dairy',
  'spices': 'cat-spice',
  'fruits and veg': 'cat-fruits-veg',
  'dals': 'cat-dal',
  'rice': 'cat-rice',
};

export function resolveCategoryFromSheet(
  rawCategory: string,
  categories: Category[],
): Category | undefined {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s*&\s*/g, ' and ')
      .replace(/\s+/g, ' ');
  const q = norm(rawCategory);
  if (!q) return undefined;
  const aliasId = CATEGORY_ALIASES[q];
  if (aliasId) {
    const aliased = categories.find((c) => c.id === aliasId);
    if (aliased) return aliased;
  }
  return categories.find(
    (c) =>
      norm(c.id) === q ||
      norm(c.slug) === q ||
      norm(c.name.en) === q ||
      norm(c.name.ta) === q,
  );
}

function findMatchingProduct(
  itemCode: string,
  productName: string,
  brandName: string,
  combinedPack: string,
  existingProducts: Product[],
  brands: Brand[],
): { product?: Product; matchedBy?: 'item_code' | 'name_brand_pack' } {
  const codeTrim = itemCode.trim().toLowerCase();
  if (codeTrim) {
    const byCode = existingProducts.find(
      (p) =>
        (p.sku && p.sku.trim().toLowerCase() === codeTrim) ||
        p.id.trim().toLowerCase() === codeTrim,
    );
    if (byCode) {
      return { product: byCode, matchedBy: 'item_code' };
    }
  }

  const nameLower = productName.trim().toLowerCase();
  const brandLower = brandName.trim().toLowerCase();
  const packNorm = normalizePackKey(combinedPack);

  if (nameLower && brandLower && packNorm) {
    const byComposite = existingProducts.find((p) => {
      const pBrand = resolveBrandName(p.brandId, brands).trim().toLowerCase();
      return (
        p.name.en.trim().toLowerCase() === nameLower &&
        pBrand === brandLower &&
        normalizePackKey(p.packSize, p.unit) === packNorm
      );
    });
    if (byComposite) {
      return { product: byComposite, matchedBy: 'name_brand_pack' };
    }
  }

  return {};
}

function validateAndClassifyPreviewRow(
  draft: {
    rowNumber: number;
    item_code: string;
    product_name: string;
    product_name_tamil: string;
    brand: string;
    category: string;
    pack_size: string;
    unit: string;
    rawMrp: unknown;
    rawSellingPrice: unknown;
    rawStockQty: unknown;
    rawThreshold: unknown;
    visible_online: boolean;
    image_url: string;
    skip?: boolean;
    raw: Record<string, unknown>;
  },
  duplicateCodeSet: Set<string>,
  existingProducts: Product[],
  categories: Category[],
  brands: Brand[],
): StockPreviewRow {
  const errors: string[] = [];
  const itemCode = draft.item_code.trim();
  const productName = draft.product_name.trim();
  const productNameTa = draft.product_name_tamil.trim() || productName;
  const brandName = draft.brand.trim();
  const categoryInput = draft.category.trim();
  const packSizeRaw = draft.pack_size.trim();
  const unitRaw = draft.unit.trim();
  const combinedPack = formatPackAndUnit(packSizeRaw || '1', unitRaw || 'pack');

  if (!productName) {
    errors.push('Missing product name');
  }

  if (itemCode && duplicateCodeSet.has(itemCode.toLowerCase())) {
    errors.push(`Duplicate item_code "${itemCode}" in file`);
  }

  const parsedMrp = parseStrictNumber(draft.rawMrp);
  const parsedSelling = parseStrictNumber(draft.rawSellingPrice);

  if (!Number.isFinite(parsedSelling) || parsedSelling <= 0 || !Number.isFinite(parsedMrp) || parsedMrp <= 0) {
    errors.push('Price or MRP is not a valid number');
  } else if (parsedSelling > parsedMrp) {
    errors.push('Selling price is above MRP');
  }

  const parsedStock = parseStrictNumber(draft.rawStockQty);
  if (!Number.isFinite(parsedStock) || parsedStock < 0) {
    errors.push('Negative or invalid stock quantity');
  }

  const parsedThreshold = parseStrictNumber(draft.rawThreshold);
  const safeThreshold =
    Number.isFinite(parsedThreshold) && parsedThreshold >= 0
      ? Math.floor(parsedThreshold)
      : 5;

  const { product: matched, matchedBy } = findMatchingProduct(
    itemCode,
    productName,
    brandName,
    combinedPack,
    existingProducts,
    brands,
  );

  const matchedCategory = categoryInput
    ? resolveCategoryFromSheet(categoryInput, categories)
    : matched
      ? categories.find((c) => c.id === matched.categoryId)
      : undefined;

  if (categoryInput && !matchedCategory) {
    errors.push(`Unknown category "${categoryInput}"`);
  } else if (!categoryInput && !matchedCategory) {
    errors.push('Unknown category (category is required)');
  }

  const matchedBrand = brandName
    ? brands.find((b) => b.name.trim().toLowerCase() === brandName.toLowerCase())
    : undefined;

  const status: StockPreviewRow['status'] =
    errors.length > 0 ? 'Error' : matched ? 'Update' : 'New';

  return {
    rowNumber: draft.rowNumber,
    status,
    skip: draft.skip ?? false,
    matchedProductId: matched?.id,
    matchedBy,
    errors,
    currentStockQty: matched?.stockQty,
    currentPrice: matched?.price,
    currentMrp: matched?.mrp,
    item_code: itemCode,
    product_name: productName,
    product_name_tamil: productNameTa,
    brand: brandName || (matched ? resolveBrandName(matched.brandId, brands) : 'Karur Fresh'),
    category: matchedCategory ? matchedCategory.name.en : categoryInput,
    resolvedBrandId: matchedBrand?.id ?? matched?.brandId,
    resolvedCategoryId: matchedCategory?.id ?? matched?.categoryId,
    pack_size: packSizeRaw || (matched ? splitPackAndUnit(matched.packSize, matched.unit).packSize : '1'),
    unit: unitRaw || (matched ? splitPackAndUnit(matched.packSize, matched.unit).unit : 'pack'),
    mrp: Number.isFinite(parsedMrp) ? Math.round(parsedMrp) : 0,
    selling_price: Number.isFinite(parsedSelling) ? Math.round(parsedSelling) : 0,
    stock_qty: Number.isFinite(parsedStock) ? Math.floor(parsedStock) : 0,
    low_stock_threshold: safeThreshold,
    visible_online: draft.visible_online,
    image_url: draft.image_url.trim(),
    raw: draft.raw,
  };
}

/**
 * Validates and classifies raw Excel/CSV rows against the catalog without writing any changes.
 */
export function previewImport(
  rawRows: Array<Record<string, unknown>>,
  existingProducts: Product[] = loadProductsStore(),
  categories: Category[] = MOCK_CATEGORIES,
  brands: Brand[] = loadBrandsStore(),
): StockPreviewRow[] {
  const codeCounts = new Map<string, number>();
  const extracted = rawRows.map((row, idx) => {
    const itemCode = String(
      pickSheetCell(row, ['item_code', 'sku', 'code']) ?? '',
    ).trim();
    if (itemCode) {
      const k = itemCode.toLowerCase();
      codeCounts.set(k, (codeCounts.get(k) ?? 0) + 1);
    }
    return {
      rowNumber: idx + 2,
      item_code: itemCode,
      product_name: String(
        pickSheetCell(row, ['product_name', 'name_en', 'name', 'item_name']) ?? '',
      ),
      product_name_tamil: String(
        pickSheetCell(row, ['product_name_tamil', 'name_ta', 'tamil_name']) ?? '',
      ),
      brand: String(pickSheetCell(row, ['brand', 'brand_name']) ?? ''),
      category: String(pickSheetCell(row, ['category', 'category_name']) ?? ''),
      pack_size: String(pickSheetCell(row, ['pack_size', 'size', 'pack']) ?? ''),
      unit: String(pickSheetCell(row, ['unit', 'uom']) ?? ''),
      rawMrp: pickSheetCell(row, ['mrp']),
      rawSellingPrice: pickSheetCell(row, ['selling_price', 'price']),
      rawStockQty: pickSheetCell(row, ['stock_qty', 'stock', 'qty', 'quantity']),
      rawThreshold: pickSheetCell(row, ['low_stock_threshold', 'threshold']),
      visible_online: parseVisibleFlag(
        pickSheetCell(row, ['visible_online', 'visible', 'online']),
        true,
      ),
      image_url: String(pickSheetCell(row, ['image_url', 'image']) ?? ''),
      raw: row,
    };
  });

  const duplicateCodes = new Set<string>(
    Array.from(codeCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([code]) => code),
  );

  return extracted.map((draft) =>
    validateAndClassifyPreviewRow(
      draft,
      duplicateCodes,
      existingProducts,
      categories,
      brands,
    ),
  );
}

/**
 * Re-validates edited preview rows after an admin fixes an invalid row inline.
 */
export function revalidatePreviewRows(
  rows: StockPreviewRow[],
  existingProducts: Product[] = loadProductsStore(),
  categories: Category[] = MOCK_CATEGORIES,
  brands: Brand[] = loadBrandsStore(),
): StockPreviewRow[] {
  const codeCounts = new Map<string, number>();
  for (const r of rows) {
    const k = r.item_code.trim().toLowerCase();
    if (k) codeCounts.set(k, (codeCounts.get(k) ?? 0) + 1);
  }
  const duplicateCodes = new Set<string>(
    Array.from(codeCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([code]) => code),
  );

  return rows.map((r) =>
    validateAndClassifyPreviewRow(
      {
        rowNumber: r.rowNumber,
        item_code: r.item_code,
        product_name: r.product_name,
        product_name_tamil: r.product_name_tamil,
        brand: r.brand,
        category: r.category,
        pack_size: r.pack_size,
        unit: r.unit,
        rawMrp: r.mrp,
        rawSellingPrice: r.selling_price,
        rawStockQty: r.stock_qty,
        rawThreshold: r.low_stock_threshold,
        visible_online: r.visible_online,
        image_url: r.image_url,
        skip: r.skip,
        raw: r.raw,
      },
      duplicateCodes,
      existingProducts,
      categories,
      brands,
    ),
  );
}

/**
 * Applies validated StockPreviewRow items using the chosen import mode.
 * Never deletes existing products automatically in any mode.
 */
export async function importProducts(
  rows: StockPreviewRow[],
  mode: StockImportMode,
  options?: {
    fileName?: string;
    adminName?: string;
    onProgress?: (percent: number) => void;
  },
): Promise<StockImportResult> {
  const categories = await getCategories();
  const brands = [...loadBrandsStore()];
  let brandsDirty = false;
  const now = new Date().toISOString();
  const adminName = options?.adminName?.trim() || 'Senthilnathan K (Store Admin)';
  const fileName = options?.fileName?.trim() || 'stock-import.xlsx';

  const ensureBrandId = (brandName: string, fallbackId?: string): string => {
    const clean = brandName.trim();
    if (!clean) return fallbackId ?? brands[0]?.id ?? 'brand-karur-gold';
    const found = brands.find((b) => b.name.trim().toLowerCase() === clean.toLowerCase());
    if (found) return found.id;
    const newId = `brand-${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${Date.now().toString(36).slice(-4)}`;
    brands.push({ id: newId, name: clean });
    brandsDirty = true;
    return newId;
  };

  let list = [...loadProductsStore()];
  const oldQtyById = new Map<string, number>(
    list.map((p) => [p.id, Math.max(0, p.stockQty) + Math.max(0, p.reservedQty)]),
  );

  if (mode === 'replace_all_stock') {
    list = list.map((p) => ({
      ...p,
      stockQty: 0,
      reservedQty: 0,
      updatedAt: now,
    }));
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errorDetails: StockImportErrorDetail[] = [];

  const total = Math.max(1, rows.length);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    options?.onProgress?.(Math.round(((i + 1) / total) * 100));

    if (row.skip) {
      skipped += 1;
      continue;
    }

    if (row.status === 'Error') {
      failed += 1;
      errorDetails.push({
        rowNumber: row.rowNumber,
        item_code: row.item_code,
        product_name: row.product_name || 'Unnamed row',
        errors: row.errors,
      });
      continue;
    }

    const { product: matched } = findMatchingProduct(
      row.item_code,
      row.product_name,
      row.brand,
      formatPackAndUnit(row.pack_size, row.unit),
      list,
      brands,
    );

    if (mode === 'update_stock_only') {
      if (!matched) {
        skipped += 1;
        continue;
      }
      const prevQty = oldQtyById.get(matched.id) ?? matched.stockQty;
      const nextQty = Math.max(0, Math.floor(row.stock_qty));
      list = list.map((p) =>
        p.id === matched.id
          ? {
              ...p,
              stockQty: nextQty,
              reservedQty: 0,
              updatedAt: now,
            }
          : p,
      );
      if (prevQty !== nextQty) {
        appendStockHistoryEntry({
          productId: matched.id,
          productName: matched.name.en,
          sku: matched.sku,
          who: adminName,
          when: now,
          oldValue: prevQty,
          newValue: nextQty,
          field: 'stock',
          reason: 'excel import',
          note: `${fileName} (update stock only)`,
        });
      }
      updated += 1;
      continue;
    }

    if (matched) {
      const prevQty = oldQtyById.get(matched.id) ?? matched.stockQty;
      const prevPrice = matched.price;
      const nextQty = Math.max(0, Math.floor(row.stock_qty));
      const nextPrice = Math.max(1, Math.round(row.selling_price));
      const nextMrp = Math.max(nextPrice, Math.round(row.mrp));
      const resolvedCatId =
        row.resolvedCategoryId ??
        resolveCategoryFromSheet(row.category, categories)?.id ??
        matched.categoryId;
      const resolvedBrandId = ensureBrandId(row.brand, matched.brandId);
      const nextPack = formatPackAndUnit(row.pack_size, row.unit);

      list = list.map((p) =>
        p.id === matched.id
          ? {
              ...p,
              sku: row.item_code || p.sku,
              name: {
                en: row.product_name || p.name.en,
                ta: row.product_name_tamil || p.name.ta,
              },
              brandId: resolvedBrandId,
              categoryId: resolvedCatId,
              packSize: nextPack || p.packSize,
              unit: row.unit || p.unit,
              price: nextPrice,
              mrp: nextMrp,
              stockQty: nextQty,
              reservedQty: 0,
              lowStockThreshold: row.low_stock_threshold,
              visibleOnline: row.visible_online,
              image: row.image_url || p.image,
              updatedAt: now,
            }
          : p,
      );

      if (prevQty !== nextQty || prevPrice !== nextPrice) {
        appendStockHistoryEntry({
          productId: matched.id,
          productName: row.product_name || matched.name.en,
          sku: row.item_code || matched.sku,
          who: adminName,
          when: now,
          oldValue: prevQty,
          newValue: nextQty,
          oldPrice: prevPrice !== nextPrice ? prevPrice : undefined,
          newPrice: prevPrice !== nextPrice ? nextPrice : undefined,
          field:
            prevQty !== nextQty && prevPrice !== nextPrice
              ? 'stock_and_price'
              : prevPrice !== nextPrice
                ? 'price'
                : 'stock',
          reason: 'excel import',
          note: `${fileName} (${mode})`,
        });
      }
      updated += 1;
    } else {
      // Create new SKU
      const resolvedCatId =
        row.resolvedCategoryId ??
        resolveCategoryFromSheet(row.category, categories)?.id ??
        'cat-rice';
      const resolvedBrandId = ensureBrandId(row.brand);
      const nextPack = formatPackAndUnit(row.pack_size, row.unit);
      const newId = `prod-${(row.item_code || row.product_name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 28)}-${Date.now().toString(36).slice(-4)}-${i}`;

      const newProduct: Product = {
        id: newId,
        sku: row.item_code || `KFM-${900 + i}`,
        name: {
          en: row.product_name,
          ta: row.product_name_tamil || row.product_name,
        },
        brandId: resolvedBrandId,
        categoryId: resolvedCatId,
        packSize: nextPack,
        unit: row.unit || 'pack',
        price: Math.max(1, Math.round(row.selling_price)),
        mrp: Math.max(Math.round(row.selling_price), Math.round(row.mrp)),
        stockQty: Math.max(0, Math.floor(row.stock_qty)),
        reservedQty: 0,
        lowStockThreshold: row.low_stock_threshold,
        imageTint: CATEGORY_TINT_MAP[resolvedCatId] ?? 'rice',
        image: row.image_url || undefined,
        description: {
          en: `${row.product_name} (${nextPack}) stocked at Karur Fresh Mart.`,
          ta: `${row.product_name_tamil || row.product_name} (${nextPack}) கரூர் பிரஷ் மார்ட் கையிருப்பு.`,
        },
        visibleOnline: row.visible_online,
        updatedAt: now,
      };

      list = [newProduct, ...list];
      appendStockHistoryEntry({
        productId: newProduct.id,
        productName: newProduct.name.en,
        sku: newProduct.sku,
        who: adminName,
        when: now,
        oldValue: 0,
        newValue: newProduct.stockQty,
        field: 'stock',
        reason: 'excel import',
        note: `Created via ${fileName}`,
      });
      created += 1;
    }
  }

  // Record history for products zeroed out in replace_all_stock that weren't in sheet
  if (mode === 'replace_all_stock') {
    const touchedIds = new Set(
      rows
        .filter((r) => !r.skip && r.status === 'Update' && r.matchedProductId)
        .map((r) => r.matchedProductId as string),
    );
    for (const p of list) {
      if (!touchedIds.has(p.id)) {
        const oldQty = oldQtyById.get(p.id) ?? 0;
        if (oldQty !== 0) {
          appendStockHistoryEntry({
            productId: p.id,
            productName: p.name.en,
            sku: p.sku,
            who: adminName,
            when: now,
            oldValue: oldQty,
            newValue: 0,
            field: 'stock',
            reason: 'excel import',
            note: `${fileName} (replace all stock reset)`,
          });
        }
      }
    }
  }

  if (brandsDirty) {
    saveBrandsStore(brands);
  }
  saveProductsStore(list);

  const result: StockImportResult = {
    logId: `imp-${Date.now().toString(36)}`,
    fileName,
    mode,
    importedAt: now,
    adminName,
    created,
    updated,
    skipped,
    failed,
    errorDetails,
  };

  const logs = loadImportLogsStore();
  saveImportLogsStore([result, ...logs]);

  options?.onProgress?.(100);
  return result;
}

export function buildErrorReportWorkbook(result: StockImportResult): XLSX.WorkBook {
  const rows = result.errorDetails.map((d) => ({
    row_number: d.rowNumber,
    item_code: d.item_code,
    product_name: d.product_name,
    errors: d.errors.join('; '),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ImportErrors');
  return wb;
}

export function downloadErrorReportXlsx(result: StockImportResult): void {
  const wb = buildErrorReportWorkbook(result);
  XLSX.writeFile(wb, `stock-import-errors-${result.logId}.xlsx`);
}

/**
 * Updates product stock quantity and logs an audit entry in stock history.
 */
export async function updateStock(
  productId: string,
  qty: number,
  reason: StockHistoryReason = 'manual',
  options?: { who?: string; note?: string },
): Promise<Product | undefined> {
  const list = loadProductsStore();
  const existing = list.find((p) => p.id === productId);
  if (!existing) return undefined;

  const nextQty = Math.max(0, Math.floor(qty));
  const oldTotal = Math.max(0, existing.stockQty) + Math.max(0, existing.reservedQty);
  const now = new Date().toISOString();
  const updatedProduct: Product = {
    ...existing,
    stockQty: nextQty,
    reservedQty: 0,
    updatedAt: now,
  };

  saveProductsStore(list.map((p) => (p.id === productId ? updatedProduct : p)));

  if (oldTotal !== nextQty || existing.reservedQty !== 0) {
    appendStockHistoryEntry({
      productId: existing.id,
      productName: existing.name.en,
      sku: existing.sku,
      who: options?.who?.trim() || 'Senthilnathan K (Store Admin)',
      when: now,
      oldValue: oldTotal,
      newValue: nextQty,
      field: 'stock',
      reason,
      note: options?.note,
    });
  }

  return updatedProduct;
}

/**
 * Updates product selling price (and optionally MRP) inline and logs audit history.
 */
export async function updatePriceInline(
  productId: string,
  sellingPrice: number,
  mrp?: number,
  options?: { who?: string; reason?: StockHistoryReason; note?: string },
): Promise<Product | undefined> {
  const list = loadProductsStore();
  const existing = list.find((p) => p.id === productId);
  if (!existing) return undefined;

  const nextPrice = Math.max(1, Math.round(sellingPrice));
  const nextMrp =
    mrp !== undefined && Number.isFinite(mrp)
      ? Math.max(nextPrice, Math.round(mrp))
      : Math.max(nextPrice, existing.mrp);
  const now = new Date().toISOString();

  const updatedProduct: Product = {
    ...existing,
    price: nextPrice,
    mrp: nextMrp,
    updatedAt: now,
  };

  saveProductsStore(list.map((p) => (p.id === productId ? updatedProduct : p)));

  if (existing.price !== nextPrice || existing.mrp !== nextMrp) {
    appendStockHistoryEntry({
      productId: existing.id,
      productName: existing.name.en,
      sku: existing.sku,
      who: options?.who?.trim() || 'Senthilnathan K (Store Admin)',
      when: now,
      oldValue: existing.stockQty,
      newValue: existing.stockQty,
      oldPrice: existing.price,
      newPrice: nextPrice,
      field: 'price',
      reason: options?.reason ?? 'manual',
      note: options?.note ?? `Price ₹${existing.price} → ₹${nextPrice} (MRP ₹${nextMrp})`,
    });
  }

  return updatedProduct;
}

/**
 * Generates export rows and an Excel workbook in the exact template schema.
 */
export function exportStock(
  products: Product[] = loadProductsStore(),
  brands: Brand[] = loadBrandsStore(),
  categories: Category[] = MOCK_CATEGORIES,
): { rows: StockSheetExportRow[]; workbook: XLSX.WorkBook; filename: string } {
  const rows: StockSheetExportRow[] = products.map((p) => {
    const { packSize, unit } = splitPackAndUnit(p.packSize, p.unit);
    const cat = categories.find((c) => c.id === p.categoryId);
    return {
      item_code: p.sku ?? p.id,
      product_name: p.name.en,
      product_name_tamil: p.name.ta,
      brand: resolveBrandName(p.brandId, brands),
      category: cat?.name.en ?? p.categoryId,
      pack_size: packSize,
      unit,
      mrp: p.mrp,
      selling_price: p.price,
      stock_qty: Math.max(0, p.stockQty) + Math.max(0, p.reservedQty),
      low_stock_threshold: p.lowStockThreshold ?? 5,
      visible_online: p.visibleOnline ? 'yes' : 'no',
      image_url: p.image ?? '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: STOCK_TEMPLATE_COLUMNS as string[],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'StockExport');
  const datePart = new Date().toISOString().slice(0, 10);
  return {
    rows,
    workbook: wb,
    filename: `karur-fresh-mart-stock-${datePart}.xlsx`,
  };
}

export function downloadExportStockXlsx(): void {
  const { workbook, filename } = exportStock();
  XLSX.writeFile(workbook, filename);
}
