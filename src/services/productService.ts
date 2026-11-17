import { MOCK_BRANDS } from '../mock/brands';
import { MOCK_CATEGORIES } from '../mock/categories';
import { MOCK_PRODUCTS } from '../mock/products';
import type { Brand, Category, Product, ProductVariant } from '../types';
import { apiClient, isMockMode } from './api';
import { readStorageJson, writeStorageJson } from './storage';

const PRODUCTS_STORAGE_KEY = 'kfm_products_v2';
const CATEGORIES_STORAGE_KEY = 'kfm_categories_v2';
const BRANDS_STORAGE_KEY = 'kfm_brands_v2';
export const CATALOG_UPDATED_EVENT = 'kfm:catalog-updated';

export function notifyCatalogChanged(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT));
  }
}

export function subscribeToCatalogUpdates(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handleCustom = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === PRODUCTS_STORAGE_KEY ||
      event.key === 'kfm_offers_v2' ||
      event.key === 'kfm_combos_v2'
    ) {
      listener();
    }
  };
  window.addEventListener(CATALOG_UPDATED_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(CATALOG_UPDATED_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}

export function loadProductsStore(): Product[] {
  const stored = readStorageJson<Product[] | null>(PRODUCTS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(PRODUCTS_STORAGE_KEY, MOCK_PRODUCTS);
  return MOCK_PRODUCTS;
}

export function saveProductsStore(products: Product[]): void {
  writeStorageJson(PRODUCTS_STORAGE_KEY, products);
  notifyCatalogChanged();
}

export async function getCategories(): Promise<Category[]> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ categories: Category[] }>('/categories', undefined, {
      skipAuth: true,
    });
    return res.categories;
  }
  const stored = readStorageJson<Category[] | null>(CATEGORIES_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(CATEGORIES_STORAGE_KEY, MOCK_CATEGORIES);
  return MOCK_CATEGORIES;
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((c) => c.slug === slug);
}

export async function getBrands(): Promise<Brand[]> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ brands: Brand[] }>('/brands', undefined, {
      skipAuth: true,
    });
    return res.brands;
  }
  const stored = readStorageJson<Brand[] | null>(BRANDS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(BRANDS_STORAGE_KEY, MOCK_BRANDS);
  return MOCK_BRANDS;
}

export function loadBrandsStore(): Brand[] {
  const stored = readStorageJson<Brand[] | null>(BRANDS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(BRANDS_STORAGE_KEY, MOCK_BRANDS);
  return MOCK_BRANDS;
}

export function saveBrandsStore(brands: Brand[]): void {
  writeStorageJson(BRANDS_STORAGE_KEY, brands);
  notifyCatalogChanged();
}

export function resolveBrandName(brandId: string, brands?: Brand[]): string {
  const source = brands && brands.length > 0 ? brands : loadBrandsStore();
  return source.find((b) => b.id === brandId)?.name ?? 'Karur Fresh';
}

export function getTotalAvailableQty(product: Product): number {
  return Math.max(0, product.stockQty) + Math.max(0, product.reservedQty);
}

export async function getProducts(filters?: {
  categoryId?: string;
  categorySlug?: string;
  brandId?: string;
  query?: string;
  includeHidden?: boolean;
  onlyFeatured?: boolean;
}): Promise<Product[]> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ products: Product[] }>('/products', {
      categoryId: filters?.categoryId,
      categorySlug: filters?.categorySlug,
      brandId: filters?.brandId,
      query: filters?.query,
      includeHidden: filters?.includeHidden,
      onlyFeatured: filters?.onlyFeatured,
    });
    return res.products;
  }

  const [products, categories, brands] = await Promise.all([
    Promise.resolve(loadProductsStore()),
    getCategories(),
    getBrands(),
  ]);

  let list = filters?.includeHidden ? products : products.filter((p) => p.visibleOnline);

  if (filters?.categoryId && filters.categoryId !== 'all') {
    list = list.filter((p) => p.categoryId === filters.categoryId);
  }

  if (filters?.categorySlug && filters.categorySlug !== 'all') {
    const cat = categories.find((c) => c.slug === filters.categorySlug);
    list = cat ? list.filter((p) => p.categoryId === cat.id) : [];
  }

  if (filters?.brandId && filters.brandId !== 'all') {
    list = list.filter((p) => p.brandId === filters.brandId);
  }

  if (filters?.onlyFeatured) {
    list = list.filter((p) => p.isFeatured);
  }

  if (filters?.query && filters.query.trim().length > 0) {
    const q = filters.query.trim().toLowerCase();
    list = list.filter((p) => {
      const brandName = resolveBrandName(p.brandId, brands).toLowerCase();
      return (
        p.name.en.toLowerCase().includes(q) ||
        p.name.ta.toLowerCase().includes(q) ||
        brandName.includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.description.en.toLowerCase().includes(q)
      );
    });
  }

  return list;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ product?: Product }>(
      `/products/${encodeURIComponent(id)}`,
    );
    return res.product;
  }
  return loadProductsStore().find((p) => p.id === id);
}

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  return getProducts({ categorySlug: slug });
}

export async function saveProduct(product: Product): Promise<Product[]> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ products: Product[] }>('/admin/products', product);
    notifyCatalogChanged();
    return res.products;
  }
  const list = loadProductsStore();
  const exists = list.some((p) => p.id === product.id);
  const stamped: Product = {
    ...product,
    updatedAt: product.updatedAt ?? new Date().toISOString(),
  };
  const next = exists ? list.map((p) => (p.id === stamped.id ? stamped : p)) : [stamped, ...list];
  saveProductsStore(next);
  return next;
}

export async function adjustProductStock(
  productId: string,
  stockQty: number,
  reservedQty?: number,
): Promise<Product | undefined> {
  if (!isMockMode()) {
    const res = await apiClient.patch<{ product?: Product }>(
      `/products/${encodeURIComponent(productId)}/stock`,
      { stockQty, reservedQty, reason: 'manual' },
    );
    notifyCatalogChanged();
    return res.product;
  }
  const list = loadProductsStore();
  let updated: Product | undefined;
  const now = new Date().toISOString();
  const next = list.map((p) => {
    if (p.id !== productId) return p;
    updated = {
      ...p,
      stockQty: Math.max(0, stockQty),
      reservedQty: reservedQty !== undefined ? Math.max(0, reservedQty) : p.reservedQty,
      updatedAt: now,
    };
    return updated;
  });
  saveProductsStore(next);
  return updated;
}

/**
 * Pure stock deduction logic: consumes reservedQty first, then stockQty.
 */
export function applyStockDeduction(product: Product, qtyToDeduct: number): Product {
  const qty = Math.max(0, Math.floor(qtyToDeduct));
  const fromReserved = Math.min(Math.max(0, product.reservedQty), qty);
  const nextReservedQty = Math.max(0, product.reservedQty - fromReserved);
  const remaining = qty - fromReserved;
  const nextStockQty = Math.max(0, product.stockQty - remaining);

  return {
    ...product,
    reservedQty: nextReservedQty,
    stockQty: nextStockQty,
  };
}

export async function deductStockForOrder(
  deductions: Array<{ productId: string; quantity: number }>,
): Promise<Product[]> {
  const list = loadProductsStore();
  const totalsByProduct = new Map<string, number>();

  for (const d of deductions) {
    totalsByProduct.set(d.productId, (totalsByProduct.get(d.productId) ?? 0) + d.quantity);
  }

  // Validate sufficient stock before applying deductions
  for (const [productId, requiredQty] of totalsByProduct.entries()) {
    const prod = list.find((p) => p.id === productId);
    if (!prod) {
      throw new Error(`Product ${productId} not found.`);
    }
    const available = getTotalAvailableQty(prod);
    if (available < requiredQty) {
      throw new Error(`Insufficient stock for ${prod.name.en} (requested ${requiredQty}, available ${available}).`);
    }
  }

  const next = list.map((p) => {
    const qty = totalsByProduct.get(p.id);
    return qty ? applyStockDeduction(p, qty) : p;
  });

  saveProductsStore(next);
  return next;
}

export async function restoreStockForOrder(
  deductions: Array<{ productId: string; quantity: number }>,
): Promise<Product[]> {
  const list = loadProductsStore();
  const totalsByProduct = new Map<string, number>();

  for (const d of deductions) {
    totalsByProduct.set(d.productId, (totalsByProduct.get(d.productId) ?? 0) + d.quantity);
  }

  const next = list.map((p) => {
    const qty = totalsByProduct.get(p.id);
    return qty ? { ...p, stockQty: p.stockQty + qty } : p;
  });

  saveProductsStore(next);
  return next;
}

export interface StockImportPreviewRow {
  rowNumber: number;
  status: 'update' | 'create' | 'invalid';
  productId: string;
  sku: string;
  nameEn: string;
  packSize: string;
  currentStockQty?: number;
  nextStockQty: number;
  nextReservedQty: number;
  nextPrice: number;
  nextMrp: number;
  nextVisibleOnline: boolean;
  error?: string;
}

function pickCell(row: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    lowerMap.set(k.trim().toLowerCase().replace(/[\s-]+/g, '_'), v);
  }
  for (const key of keys) {
    if (lowerMap.has(key)) return lowerMap.get(key);
  }
  return undefined;
}

/**
 * Pure parser for uploaded Excel (.xlsx/.xls) or CSV stock sheets.
 * Matches existing products by SKU, ID, or English name; allows creating new SKUs if name & price are present.
 */
export function parseStockImportRows(
  rawRows: Array<Record<string, unknown>>,
  existingProducts: Product[],
): StockImportPreviewRow[] {
  return rawRows.map((row, idx) => {
    const rowNumber = idx + 2; // 1-based header + row
    const rawId = String(pickCell(row, ['id', 'product_id']) ?? '').trim();
    const rawSku = String(pickCell(row, ['sku', 'item_code', 'code']) ?? '').trim();
    const rawName = String(
      pickCell(row, ['name_en', 'name', 'product_name', 'product', 'item_name']) ?? '',
    ).trim();
    const rawPack = String(pickCell(row, ['pack_size', 'pack', 'unit', 'size']) ?? '').trim();

    const matched = existingProducts.find(
      (p) =>
        (rawId && p.id === rawId) ||
        (rawSku && p.sku && p.sku.toLowerCase() === rawSku.toLowerCase()) ||
        (rawName && p.name.en.toLowerCase() === rawName.toLowerCase()),
    );

    const rawStock = pickCell(row, ['stock_qty', 'stock', 'qty', 'quantity']);
    const rawReserved = pickCell(row, ['reserved_qty', 'reserved']);
    const rawPrice = pickCell(row, ['price', 'selling_price']);
    const rawMrp = pickCell(row, ['mrp']);
    const rawVisible = pickCell(row, ['visible_online', 'visible']);

    const parsedStock =
      rawStock === undefined || rawStock === ''
        ? matched?.stockQty ?? 0
        : Number(rawStock);
    const parsedReserved =
      rawReserved === undefined || rawReserved === ''
        ? matched?.reservedQty ?? 0
        : Number(rawReserved);
    const parsedPrice =
      rawPrice === undefined || rawPrice === ''
        ? matched?.price ?? NaN
        : Number(rawPrice);
    const parsedMrp =
      rawMrp === undefined || rawMrp === ''
        ? matched?.mrp ?? parsedPrice
        : Number(rawMrp);

    if (
      !Number.isFinite(parsedStock) ||
      parsedStock < 0 ||
      !Number.isFinite(parsedReserved) ||
      parsedReserved < 0
    ) {
      return {
        rowNumber,
        status: 'invalid',
        productId: matched?.id ?? rawId,
        sku: rawSku || matched?.sku || '',
        nameEn: rawName || matched?.name.en || 'Unknown row',
        packSize: rawPack || matched?.packSize || '1 unit',
        currentStockQty: matched?.stockQty,
        nextStockQty: 0,
        nextReservedQty: 0,
        nextPrice: matched?.price ?? 0,
        nextMrp: matched?.mrp ?? 0,
        nextVisibleOnline: matched?.visibleOnline ?? true,
        error: 'Stock quantities must be zero or positive numbers.',
      };
    }

    if (!matched && (!rawName || !Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      return {
        rowNumber,
        status: 'invalid',
        productId: rawId,
        sku: rawSku,
        nameEn: rawName || rawSku || 'Unmatched row',
        packSize: rawPack || '1 unit',
        nextStockQty: Math.floor(parsedStock),
        nextReservedQty: Math.floor(parsedReserved),
        nextPrice: 0,
        nextMrp: 0,
        nextVisibleOnline: true,
        error: 'SKU/Product not found; provide name_en and valid price to create new item.',
      };
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return {
        rowNumber,
        status: 'invalid',
        productId: matched?.id ?? rawId,
        sku: rawSku || matched?.sku || '',
        nameEn: rawName || matched?.name.en || '',
        packSize: rawPack || matched?.packSize || '1 unit',
        currentStockQty: matched?.stockQty,
        nextStockQty: Math.floor(parsedStock),
        nextReservedQty: Math.floor(parsedReserved),
        nextPrice: matched?.price ?? 0,
        nextMrp: matched?.mrp ?? 0,
        nextVisibleOnline: matched?.visibleOnline ?? true,
        error: 'Price must be greater than zero.',
      };
    }

    const visibleOnline =
      rawVisible === undefined || rawVisible === ''
        ? matched?.visibleOnline ?? true
        : !['false', '0', 'no', 'hidden'].includes(String(rawVisible).trim().toLowerCase());

    const safePrice = Math.round(parsedPrice);
    const safeMrp = Number.isFinite(parsedMrp) && parsedMrp >= safePrice
      ? Math.round(parsedMrp)
      : safePrice;

    if (matched) {
      return {
        rowNumber,
        status: 'update',
        productId: matched.id,
        sku: rawSku || matched.sku || '',
        nameEn: rawName || matched.name.en,
        packSize: rawPack || matched.packSize,
        currentStockQty: matched.stockQty,
        nextStockQty: Math.floor(parsedStock),
        nextReservedQty: Math.floor(parsedReserved),
        nextPrice: safePrice,
        nextMrp: safeMrp,
        nextVisibleOnline: visibleOnline,
      };
    }

    const generatedId =
      rawId ||
      `prod-${(rawSku || rawName).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}-${idx}`;

    return {
      rowNumber,
      status: 'create',
      productId: generatedId,
      sku: rawSku || `KFM-${900 + idx}`,
      nameEn: rawName,
      packSize: rawPack || '1 pack',
      nextStockQty: Math.floor(parsedStock),
      nextReservedQty: Math.floor(parsedReserved),
      nextPrice: safePrice,
      nextMrp: safeMrp,
      nextVisibleOnline: visibleOnline,
    };
  });
}

export async function applyBulkStockImport(
  rows: StockImportPreviewRow[],
): Promise<{ updatedCount: number; createdCount: number }> {
  const list = [...loadProductsStore()];
  let updatedCount = 0;
  let createdCount = 0;

  for (const row of rows) {
    if (row.status === 'invalid') continue;

    if (row.status === 'update') {
      const idx = list.findIndex((p) => p.id === row.productId);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          sku: row.sku || list[idx].sku,
          packSize: row.packSize || list[idx].packSize,
          price: row.nextPrice,
          mrp: row.nextMrp,
          stockQty: row.nextStockQty,
          reservedQty: row.nextReservedQty,
          visibleOnline: row.nextVisibleOnline,
        };
        updatedCount += 1;
      }
    } else if (row.status === 'create') {
      list.unshift({
        id: row.productId,
        sku: row.sku,
        name: { en: row.nameEn, ta: row.nameEn },
        brandId: 'brand-karur-fresh',
        categoryId: 'cat-rice',
        packSize: row.packSize,
        price: row.nextPrice,
        mrp: row.nextMrp,
        stockQty: row.nextStockQty,
        reservedQty: row.nextReservedQty,
        imageTint: 'rice',
        description: {
          en: `${row.nameEn} (${row.packSize}) stocked via Karur Fresh Mart inventory.`,
          ta: `${row.nameEn} (${row.packSize}) கரூர் பிரஷ் மார்ட் கையிருப்பு.`,
        },
        visibleOnline: row.nextVisibleOnline,
      });
      createdCount += 1;
    }
  }

  saveProductsStore(list);
  return { updatedCount, createdCount };
}

const PACK_LADDER: Record<
  string,
  Array<{ label: string; factor: number; isDefault?: boolean }>
> = {
  '50 g': [
    { label: '50 g', factor: 1, isDefault: true },
    { label: '100 g', factor: 1.9 },
    { label: '250 g', factor: 4.5 },
  ],
  '100 g': [
    { label: '50 g', factor: 0.54 },
    { label: '100 g', factor: 1, isDefault: true },
    { label: '250 g', factor: 2.35 },
  ],
  '150 g': [
    { label: '75 g', factor: 0.55 },
    { label: '150 g', factor: 1, isDefault: true },
    { label: '300 g', factor: 1.9 },
  ],
  '200 g': [
    { label: '100 g', factor: 0.54 },
    { label: '200 g', factor: 1, isDefault: true },
    { label: '500 g', factor: 2.35 },
  ],
  '250 g': [
    { label: '100 g', factor: 0.44 },
    { label: '250 g', factor: 1, isDefault: true },
    { label: '500 g', factor: 1.9 },
  ],
  '500 g': [
    { label: '250 g', factor: 0.53 },
    { label: '500 g', factor: 1, isDefault: true },
    { label: '1 kg', factor: 1.92 },
  ],
  '1 kg': [
    { label: '500 g', factor: 0.53 },
    { label: '1 kg', factor: 1, isDefault: true },
    { label: '2 kg', factor: 1.92 },
  ],
  '2 kg': [
    { label: '1 kg', factor: 0.53 },
    { label: '2 kg', factor: 1, isDefault: true },
    { label: '5 kg', factor: 2.4 },
  ],
  '5 kg': [
    { label: '1 kg', factor: 0.22 },
    { label: '5 kg', factor: 1, isDefault: true },
    { label: '10 kg', factor: 1.94 },
  ],
  '10 kg': [
    { label: '5 kg', factor: 0.52 },
    { label: '10 kg', factor: 1, isDefault: true },
    { label: '25 kg', factor: 2.42 },
  ],
  '250 ml': [
    { label: '100 ml', factor: 0.45 },
    { label: '250 ml', factor: 1, isDefault: true },
    { label: '500 ml', factor: 1.9 },
  ],
  '500 ml': [
    { label: '250 ml', factor: 0.55 },
    { label: '500 ml', factor: 1, isDefault: true },
    { label: '1 L', factor: 1.92 },
  ],
  '700 ml': [
    { label: '350 ml', factor: 0.54 },
    { label: '700 ml', factor: 1, isDefault: true },
    { label: '1.4 L', factor: 1.9 },
  ],
  '1 L': [
    { label: '500 ml', factor: 0.53 },
    { label: '1 L', factor: 1, isDefault: true },
    { label: '2 L', factor: 1.92 },
  ],
};

function sanitizeVariantSlug(packSize: string): string {
  return packSize.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Pure helper returning selectable pack-size options with scaled pricing and stock.
 */
export function getProductPackVariants(product: Product): ProductVariant[] {
  if (product.packVariants && product.packVariants.length > 0) {
    return product.packVariants;
  }

  const available = getTotalAvailableQty(product);
  const ladder = PACK_LADDER[product.packSize];

  if (!ladder) {
    return [
      {
        id: 'default',
        packSize: product.packSize,
        price: product.price,
        mrp: product.mrp,
        stockQty: available,
        isDefault: true,
      },
    ];
  }

  return ladder.map((step) => {
    if (step.isDefault) {
      return {
        id: 'default',
        packSize: product.packSize,
        price: product.price,
        mrp: product.mrp,
        stockQty: available,
        isDefault: true,
      };
    }

    const scaledPrice = Math.max(10, Math.round(product.price * step.factor));
    const scaledMrp = Math.max(scaledPrice, Math.round(product.mrp * step.factor));
    return {
      id: sanitizeVariantSlug(step.label),
      packSize: step.label,
      price: scaledPrice,
      mrp: scaledMrp,
      stockQty: available,
      isDefault: false,
    };
  });
}

const COMPLEMENTARY_CATEGORY_MAP: Record<string, string[]> = {
  'cat-rice': ['cat-dal', 'cat-oil', 'cat-spice', 'cat-household'],
  'cat-dal': ['cat-rice', 'cat-oil', 'cat-spice', 'cat-produce'],
  'cat-oil': ['cat-rice', 'cat-dal', 'cat-spice', 'cat-produce'],
  'cat-spice': ['cat-dal', 'cat-oil', 'cat-rice', 'cat-produce'],
  'cat-dairy': ['cat-beverages', 'cat-snacks', 'cat-rice', 'cat-produce'],
  'cat-snacks': ['cat-beverages', 'cat-dairy', 'cat-oil', 'cat-spice'],
  'cat-beverages': ['cat-dairy', 'cat-snacks', 'cat-household', 'cat-produce'],
  'cat-household': ['cat-personal', 'cat-rice', 'cat-dal', 'cat-oil'],
  'cat-personal': ['cat-household', 'cat-dairy', 'cat-beverages', 'cat-snacks'],
  'cat-produce': ['cat-dal', 'cat-oil', 'cat-spice', 'cat-rice'],
};

export function getFrequentlyBoughtTogether(
  product: Product,
  allProducts: Product[],
  limit = 4,
): Product[] {
  const preferredCats = COMPLEMENTARY_CATEGORY_MAP[product.categoryId] ?? [];
  const inStock = allProducts.filter(
    (p) => p.visibleOnline && p.id !== product.id && getTotalAvailableQty(p) > 0,
  );
  const picked: Product[] = [];
  const seen = new Set<string>();

  for (const catId of preferredCats) {
    if (picked.length >= limit) break;
    const match =
      inStock.find((p) => p.categoryId === catId && p.isFeatured && !seen.has(p.id)) ??
      inStock.find((p) => p.categoryId === catId && !seen.has(p.id));
    if (match) {
      picked.push(match);
      seen.add(match.id);
    }
  }

  for (const candidate of inStock) {
    if (picked.length >= limit) break;
    if (!seen.has(candidate.id)) {
      picked.push(candidate);
      seen.add(candidate.id);
    }
  }

  return picked;
}

export async function getSearchSuggestions(query: string, limit = 6): Promise<Product[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!isMockMode()) {
    const res = await apiClient.get<{ suggestions: Product[] }>('/products/suggestions', {
      q: trimmed,
      limit,
    });
    return res.suggestions;
  }
  const matches = await getProducts({ query: trimmed });
  return matches.slice(0, limit);
}

