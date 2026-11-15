import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Info,
  PackagePlus,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Badge, Button, Card, ProductImage } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import {
  adjustProductStock,
  applyBulkStockImport,
  getBrands,
  getCategories,
  getProducts,
  getTotalAvailableQty,
  parseStockImportRows,
  resolveBrandName,
  saveProduct,
  type StockImportPreviewRow,
} from '../../services';
import type { Brand, Category, Product, ProductTint } from '../../types';
import { formatINR } from '../../utils/format';

const TINT_OPTIONS: ProductTint[] = ['rice', 'dal', 'oil', 'spice', 'dairy', 'salt'];

interface ManualProductDraft {
  id?: string;
  sku: string;
  nameEn: string;
  nameTa: string;
  brandId: string;
  categoryId: string;
  packSize: string;
  price: string;
  mrp: string;
  stockQty: string;
  reservedQty: string;
  imageTint: ProductTint;
  visibleOnline: boolean;
}

function emptyDraft(brands: Brand[], categories: Category[]): ManualProductDraft {
  return {
    sku: `KFM-${Math.floor(100 + Math.random() * 899)}`,
    nameEn: '',
    nameTa: '',
    brandId: brands[0]?.id ?? 'brand-karur-fresh',
    categoryId: categories[0]?.id ?? 'cat-rice',
    packSize: '1 kg',
    price: '',
    mrp: '',
    stockQty: '25',
    reservedQty: '0',
    imageTint: 'rice',
    visibleOnline: true,
  };
}

export function AdminProductsPage() {
  const { t, bi } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual');
  const [isLoading, setIsLoading] = useState(true);

  // Manual Entry / Edit state
  const [showManualForm, setShowManualForm] = useState(false);
  const [draft, setDraft] = useState<ManualProductDraft>(() => emptyDraft([], []));
  const [formError, setFormError] = useState<string | null>(null);

  // Excel Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<StockImportPreviewRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Feedback toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const loadData = useCallback(async () => {
    const [prods, brandList, catList] = await Promise.all([
      getProducts({ includeHidden: true }),
      getBrands(),
      getCategories(),
    ]);
    setProducts(prods);
    setBrands(brandList);
    setCategories(catList);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const brand = resolveBrandName(p.brandId, brands).toLowerCase();
      return (
        p.name.en.toLowerCase().includes(q) ||
        p.name.ta.toLowerCase().includes(q) ||
        brand.includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    });
  }, [products, brands, search]);

  const openAddForm = () => {
    setFormError(null);
    setDraft(emptyDraft(brands, categories));
    setShowManualForm(true);
    setActiveTab('manual');
  };

  const openEditForm = (prod: Product) => {
    setFormError(null);
    setDraft({
      id: prod.id,
      sku: prod.sku ?? '',
      nameEn: prod.name.en,
      nameTa: prod.name.ta,
      brandId: prod.brandId,
      categoryId: prod.categoryId,
      packSize: prod.packSize,
      price: String(prod.price),
      mrp: String(prod.mrp),
      stockQty: String(prod.stockQty),
      reservedQty: String(prod.reservedQty),
      imageTint: prod.imageTint,
      visibleOnline: prod.visibleOnline,
    });
    setShowManualForm(true);
    setActiveTab('manual');
  };

  const handleSaveManualProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nameEn = draft.nameEn.trim();
    const nameTa = draft.nameTa.trim() || nameEn;
    const price = Number(draft.price);
    const mrp = draft.mrp.trim() ? Number(draft.mrp) : price;
    const stockQty = Number(draft.stockQty);
    const reservedQty = Number(draft.reservedQty || 0);

    if (!nameEn) {
      setFormError('Product name in English is required.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setFormError('Selling price must be greater than ₹0.');
      return;
    }
    if (!Number.isFinite(mrp) || mrp < price) {
      setFormError('MRP must be equal to or greater than the selling price.');
      return;
    }
    if (!Number.isFinite(stockQty) || stockQty < 0 || !Number.isFinite(reservedQty) || reservedQty < 0) {
      setFormError('Stock quantities must be zero or positive.');
      return;
    }

    const existing = draft.id ? products.find((p) => p.id === draft.id) : undefined;
    const productToSave: Product = {
      id:
        draft.id ??
        `prod-${nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}-${Date.now().toString(36)}`,
      sku: draft.sku.trim() || undefined,
      name: { en: nameEn, ta: nameTa },
      brandId: draft.brandId || brands[0]?.id || 'brand-karur-fresh',
      categoryId: draft.categoryId || categories[0]?.id || 'cat-rice',
      packSize: draft.packSize.trim() || '1 pack',
      price: Math.round(price),
      mrp: Math.round(mrp),
      stockQty: Math.floor(stockQty),
      reservedQty: Math.floor(reservedQty),
      imageTint: draft.imageTint,
      image: existing?.image,
      description: existing?.description ?? {
        en: `${nameEn} (${draft.packSize.trim() || '1 pack'}) stocked at Karur Fresh Mart.`,
        ta: `${nameTa} (${draft.packSize.trim() || '1 pack'}) கரூர் பிரஷ் மார்ட் கையிருப்பு.`,
      },
      visibleOnline: draft.visibleOnline,
      isFeatured: existing?.isFeatured,
      rating: existing?.rating,
      packVariants: existing?.packVariants,
    };

    await saveProduct(productToSave);
    await loadData();
    setShowManualForm(false);
    showToast(t('admin.productSavedToast', { name: nameEn }));
  };

  const handleRestock = async (prod: Product) => {
    await adjustProductStock(prod.id, prod.stockQty + 5, prod.reservedQty);
    await loadData();
  };

  const handleToggleVisibility = async (prod: Product) => {
    await saveProduct({ ...prod, visibleOnline: !prod.visibleOnline });
    await loadData();
  };

  const handleDownloadTemplate = () => {
    const sampleRows = products.slice(0, 5).map((p) => ({
      sku: p.sku ?? p.id,
      name_en: p.name.en,
      pack_size: p.packSize,
      price: p.price,
      mrp: p.mrp,
      stock_qty: p.stockQty,
      reserved_qty: p.reservedQty,
      visible_online: p.visibleOnline ? 'TRUE' : 'FALSE',
    }));

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'StockUpdate');
    XLSX.writeFile(wb, 'karur-fresh-mart-stock-template.xlsx');
  };

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setImportError('No worksheet found in the uploaded file.');
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      });
      if (rawRows.length === 0) {
        setImportError('The uploaded sheet contains no data rows.');
        return;
      }

      const parsed = parseStockImportRows(rawRows, products);
      setImportPreview(parsed);
      setUploadedFileName(file.name);
    } catch {
      setImportError('Could not parse file. Please upload a valid .xlsx, .xls, or .csv sheet.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const validImportCount = useMemo(
    () => importPreview.filter((r) => r.status !== 'invalid').length,
    [importPreview],
  );

  const handleApplyImport = async () => {
    if (validImportCount === 0) return;
    const result = await applyBulkStockImport(importPreview);
    await loadData();
    setImportPreview([]);
    setUploadedFileName(null);
    showToast(
      t('admin.importSuccessToast', {
        updated: result.updatedCount,
        created: result.createdCount,
      }),
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-dark-ink">
            {t('admin.productsPageTitle')}
          </h1>
          <p className="text-sm text-muted-text mt-0.5">
            {products.length} SKUs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={openAddForm}
            leftIcon={<PackagePlus className="w-4 h-4" />}
          >
            {t('admin.addProductCta')}
          </Button>
        </div>
      </div>

      {/* Explicit Section 10B Notice */}
      <div className="rounded-[10px] bg-light-green/70 border border-fresh-green/25 px-3.5 py-2.5 flex items-center gap-2 text-xs text-dark-ink font-medium">
        <Info className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
        <span>{t('admin.noBillingSyncNote')}</span>
      </div>

      {toastMsg && (
        <div
          role="status"
          className="rounded-[10px] bg-light-green border border-fresh-green/35 px-4 py-3 flex items-center gap-2 text-sm font-semibold text-fresh-green"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Mode Switcher Tabs: Manual Entry vs Excel Upload */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Stock management modes" className="flex items-center gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
            className={[
              'min-h-[40px] px-4 rounded-[10px] text-xs sm:text-sm font-semibold transition-colors cursor-pointer',
              activeTab === 'manual'
                ? 'bg-fresh-green text-white'
                : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
            ].join(' ')}
          >
            {t('admin.tabManualEntry')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'excel'}
            onClick={() => setActiveTab('excel')}
            className={[
              'min-h-[40px] px-4 rounded-[10px] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer',
              activeTab === 'excel'
                ? 'bg-fresh-green text-white'
                : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
            ].join(' ')}
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>{t('admin.tabExcelUpload')}</span>
          </button>
        </div>

        {activeTab === 'manual' && (
          <div className="relative w-full sm:w-80">
            <Search
              className="w-4 h-4 text-muted-text absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.productsSearchPlaceholder')}
              aria-label={t('admin.productsSearchPlaceholder')}
              className="w-full min-h-[44px] pl-10 pr-3 rounded-[10px] border border-border-grey bg-white text-sm text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green"
            />
          </div>
        )}
      </div>

      {/* EXCEL / CSV BULK STOCK UPLOAD TAB */}
      {activeTab === 'excel' && (
        <div className="space-y-4">
          <Card padding="lg" className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-heading font-bold text-lg text-dark-ink">
                  {t('admin.excelUploadTitle')}
                </h2>
                <p className="text-sm text-muted-text">{t('admin.excelUploadSubtitle')}</p>
                <p className="text-xs text-muted-text font-mono bg-soft-grey px-2.5 py-1 rounded-[6px] inline-block">
                  {t('admin.excelColumnsHint')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleDownloadTemplate}
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  {t('admin.downloadTemplateCta')}
                </Button>

                <label className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[10px] bg-fresh-green hover:bg-fresh-green/90 text-white text-sm font-semibold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>{t('admin.chooseExcelFileCta')}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => void handleExcelFileSelected(e)}
                    className="sr-only"
                    aria-label={t('admin.chooseExcelFileCta')}
                  />
                </label>
              </div>
            </div>

            {importError && (
              <div
                role="alert"
                className="rounded-[10px] bg-alert-red-soft border border-alert-red/30 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-alert-red"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{importError}</span>
              </div>
            )}
          </Card>

          {importPreview.length > 0 && (
            <Card padding="none" className="overflow-hidden">
              <div className="p-4 border-b border-border-grey flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-soft-grey/60">
                <div>
                  <h3 className="font-heading font-bold text-base text-dark-ink">
                    {uploadedFileName}
                  </h3>
                  <p className="text-xs text-muted-text">
                    {t('admin.previewRowsCount', { count: importPreview.length })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setImportPreview([]);
                      setUploadedFileName(null);
                    }}
                  >
                    {t('admin.clearPreviewCta')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={validImportCount === 0}
                    onClick={() => void handleApplyImport()}
                  >
                    {t('admin.applyImportCta', { count: validImportCount })}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-soft-grey border-b border-border-grey text-xs uppercase text-muted-text">
                      <th className="py-2.5 px-3 font-semibold">#</th>
                      <th className="py-2.5 px-3 font-semibold">{t('admin.colStatus')}</th>
                      <th className="py-2.5 px-3 font-semibold">SKU / {t('admin.colProduct')}</th>
                      <th className="py-2.5 px-3 font-semibold">{t('admin.colPriceMrp')}</th>
                      <th className="py-2.5 px-3 font-semibold">{t('admin.colAvailableStock')}</th>
                      <th className="py-2.5 px-3 font-semibold">{t('admin.colOnlineStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-grey/60">
                    {importPreview.map((row) => (
                      <tr key={`${row.rowNumber}-${row.sku}`} className="hover:bg-soft-grey/40">
                        <td className="py-2.5 px-3 tabular-nums text-muted-text">{row.rowNumber}</td>
                        <td className="py-2.5 px-3">
                          <Badge
                            tone={
                              row.status === 'update'
                                ? 'green'
                                : row.status === 'create'
                                  ? 'yellow'
                                  : 'red'
                            }
                          >
                            {row.status === 'update'
                              ? t('admin.importStatusUpdate')
                              : row.status === 'create'
                                ? t('admin.importStatusCreate')
                                : t('admin.importStatusInvalid')}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-dark-ink">{row.nameEn}</p>
                          <p className="text-xs text-muted-text">
                            {row.sku || '—'} · {row.packSize}
                          </p>
                          {row.error && (
                            <p className="text-xs text-alert-red mt-0.5">{row.error}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums">
                          {row.nextPrice > 0 ? (
                            <>
                              <span className="font-semibold text-dark-ink">
                                {formatINR(row.nextPrice)}
                              </span>
                              <span className="text-xs text-muted-text ml-1.5 line-through">
                                {formatINR(row.nextMrp)}
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums font-semibold">
                          {row.currentStockQty !== undefined ? (
                            <span>
                              <span className="text-muted-text">{row.currentStockQty}</span> →{' '}
                              <span className="text-fresh-green">{row.nextStockQty}</span>
                            </span>
                          ) : (
                            <span className="text-fresh-green">{row.nextStockQty}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.nextVisibleOnline ? 'Visible' : 'Hidden'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* MANUAL ENTRY & CATALOG TAB */}
      {activeTab === 'manual' && (
        <>
          {showManualForm && (
            <Card padding="lg" className="border-2 border-fresh-green/35 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-grey">
                <h2 className="font-heading font-bold text-lg text-dark-ink">
                  {draft.id ? t('admin.manualFormEditTitle') : t('admin.manualFormAddTitle')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  aria-label={t('admin.closePanel')}
                  className="p-2 rounded-[8px] text-muted-text hover:bg-soft-grey cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={(e) => void handleSaveManualProduct(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label htmlFor="prod-sku" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldSku')}
                    </label>
                    <input
                      id="prod-sku"
                      type="text"
                      value={draft.sku}
                      onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-name-en" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldNameEn')} *
                    </label>
                    <input
                      id="prod-name-en"
                      type="text"
                      required
                      value={draft.nameEn}
                      onChange={(e) => setDraft((d) => ({ ...d, nameEn: e.target.value }))}
                      placeholder="e.g. Ponni Raw Rice"
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-name-ta" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldNameTa')}
                    </label>
                    <input
                      id="prod-name-ta"
                      type="text"
                      value={draft.nameTa}
                      onChange={(e) => setDraft((d) => ({ ...d, nameTa: e.target.value }))}
                      placeholder="e.g. பொன்னி பச்சரிசி"
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-pack-size" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldPackSize')}
                    </label>
                    <input
                      id="prod-pack-size"
                      type="text"
                      value={draft.packSize}
                      onChange={(e) => setDraft((d) => ({ ...d, packSize: e.target.value }))}
                      placeholder="1 kg / 500 ml"
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-brand" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldBrand')}
                    </label>
                    <select
                      id="prod-brand"
                      value={draft.brandId}
                      onChange={(e) => setDraft((d) => ({ ...d, brandId: e.target.value }))}
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="prod-category" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldCategory')}
                    </label>
                    <select
                      id="prod-category"
                      value={draft.categoryId}
                      onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {bi(c.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="prod-price" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldPrice')} *
                    </label>
                    <input
                      id="prod-price"
                      type="number"
                      min={1}
                      required
                      value={draft.price}
                      onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-mrp" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldMrp')}
                    </label>
                    <input
                      id="prod-mrp"
                      type="number"
                      min={1}
                      value={draft.mrp}
                      onChange={(e) => setDraft((d) => ({ ...d, mrp: e.target.value }))}
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-stock" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldStockQty')}
                    </label>
                    <input
                      id="prod-stock"
                      type="number"
                      min={0}
                      value={draft.stockQty}
                      onChange={(e) => setDraft((d) => ({ ...d, stockQty: e.target.value }))}
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-reserved" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldReservedQty')}
                    </label>
                    <input
                      id="prod-reserved"
                      type="number"
                      min={0}
                      value={draft.reservedQty}
                      onChange={(e) => setDraft((d) => ({ ...d, reservedQty: e.target.value }))}
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-tint" className="block text-xs font-semibold text-dark-ink mb-1">
                      {t('admin.fieldTint')}
                    </label>
                    <select
                      id="prod-tint"
                      value={draft.imageTint}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, imageTint: e.target.value as ProductTint }))
                      }
                      className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm capitalize"
                    >
                      {TINT_OPTIONS.map((tint) => (
                        <option key={tint} value={tint}>
                          {tint}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="inline-flex items-center gap-2 min-h-[42px] text-xs font-semibold text-dark-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.visibleOnline}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, visibleOnline: e.target.checked }))
                        }
                        className="w-4 h-4 accent-fresh-green rounded"
                      />
                      <span>{t('admin.fieldVisibleOnline')}</span>
                    </label>
                  </div>
                </div>

                {formError && (
                  <p role="alert" className="text-xs font-semibold text-alert-red">
                    {formError}
                  </p>
                )}

                <div className="flex items-center gap-2.5 pt-1">
                  <Button type="submit" variant="primary" size="md">
                    {t('admin.saveProductCta')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setShowManualForm(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {isLoading ? (
            <Card className="h-64 animate-pulse bg-white/80" />
          ) : (
            <>
              {/* Mobile Cards (<768px) — zero clipped table columns */}
              <div className="md:hidden space-y-3">
                {filtered.map((prod) => {
                  const avail = getTotalAvailableQty(prod);
                  return (
                    <Card key={prod.id} padding="md" className="space-y-3">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <ProductImage
                            tint={prod.imageTint}
                            image={prod.image}
                            alt={bi(prod.name)}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-dark-ink line-clamp-2">
                              {bi(prod.name)}
                            </p>
                            <p className="text-xs text-muted-text truncate">
                              {resolveBrandName(prod.brandId, brands)} · {prod.packSize}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 tabular-nums">
                          <p className="font-heading font-bold text-sm text-dark-ink">
                            {formatINR(prod.price)}
                          </p>
                          <p className="text-[11px] text-muted-text line-through">
                            {formatINR(prod.mrp)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-grey/60">
                        <div className="flex items-center gap-2">
                          <Badge tone={avail === 0 ? 'red' : avail <= 5 ? 'yellow' : 'green'}>
                            {avail} units
                          </Badge>
                          <button
                            type="button"
                            onClick={() => void handleToggleVisibility(prod)}
                            className="min-h-[34px] inline-flex items-center gap-1 text-xs font-semibold text-dark-ink cursor-pointer"
                          >
                            {prod.visibleOnline ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
                                <span>Visible</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-muted-text" aria-hidden="true" />
                                <span className="text-muted-text">Hidden</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-label={`${t('admin.editProductCta')} ${bi(prod.name)}`}
                            onClick={() => openEditForm(prod)}
                            leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                          >
                            {t('admin.editProductCta')}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleRestock(prod)}
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                          >
                            {t('admin.restockPlus5')}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop / Tablet Table */}
              <Card padding="none" className="hidden md:block overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-soft-grey border-b border-border-grey text-xs uppercase tracking-wide text-muted-text">
                        <th className="py-3 px-4 font-semibold">{t('admin.colProduct')}</th>
                        <th className="py-3 px-4 font-semibold">{t('admin.colPriceMrp')}</th>
                        <th className="py-3 px-4 font-semibold">{t('admin.colAvailableStock')}</th>
                        <th className="py-3 px-4 font-semibold">{t('admin.colOnlineStatus')}</th>
                        <th className="py-3 px-4 font-semibold text-right">{t('admin.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-grey/70">
                      {filtered.map((prod) => {
                        const avail = getTotalAvailableQty(prod);
                        return (
                          <tr key={prod.id} className="hover:bg-soft-grey/60">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <ProductImage
                                  tint={prod.imageTint}
                                  image={prod.image}
                                  alt={bi(prod.name)}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="font-semibold text-dark-ink truncate max-w-[240px]">
                                    {bi(prod.name)}
                                  </p>
                                  <p className="text-xs text-muted-text">
                                    {resolveBrandName(prod.brandId, brands)} · {prod.packSize}
                                    {prod.sku ? ` · ${prod.sku}` : ''}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 tabular-nums">
                              <p className="font-heading font-bold text-dark-ink">
                                {formatINR(prod.price)}
                              </p>
                              <p className="text-xs text-muted-text line-through">
                                {formatINR(prod.mrp)}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col items-start gap-0.5">
                                <Badge
                                  tone={avail === 0 ? 'red' : avail <= 5 ? 'yellow' : 'green'}
                                >
                                  {avail} units
                                </Badge>
                                {prod.reservedQty > 0 && (
                                  <span className="text-[11px] text-muted-text tabular-nums">
                                    {prod.reservedQty} reserved
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => void handleToggleVisibility(prod)}
                                className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-semibold text-dark-ink hover:text-fresh-green cursor-pointer"
                              >
                                {prod.visibleOnline ? (
                                  <>
                                    <Eye className="w-4 h-4 text-fresh-green" aria-hidden="true" />
                                    <span>Visible</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-4 h-4 text-muted-text" aria-hidden="true" />
                                    <span className="text-muted-text">Hidden</span>
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  aria-label={`${t('admin.editProductCta')} ${bi(prod.name)}`}
                                  onClick={() => openEditForm(prod)}
                                  leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                                >
                                  {t('admin.editProductCta')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => void handleRestock(prod)}
                                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                                >
                                  {t('admin.restockPlus5')}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
