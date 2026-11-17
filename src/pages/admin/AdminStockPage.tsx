import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  History,
  Info,
  PackagePlus,
  Search,
  Zap,
} from 'lucide-react';
import { Badge, Button, Card, ErrorStateCard, ListSkeleton, ProductImage } from '../../components/ui';
import {
  StockExcelImportPanel,
  StockHistoryModal,
  StockImportLogTab,
  StockProductModal,
} from '../../components/admin/stock';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import {
  appendStockHistoryEntry,
  downloadExportStockXlsx,
  downloadTemplateXlsx,
  getBrands,
  getCategories,
  getImportLogs,
  getProducts,
  getStockHistory,
  getTotalAvailableQty,
  resolveBrandName,
  saveProduct,
  subscribeToCatalogUpdates,
  updatePriceInline,
  updateStock,
} from '../../services';
import type {
  Brand,
  Category,
  Product,
  StockHistoryEntry,
  StockHistoryReason,
  StockImportLog,
  StockImportResult,
} from '../../types';
import { formatDateTime, formatINR } from '../../utils/format';

type StockTab = 'table' | 'excel' | 'logs';
type StockFilterStatus = 'all' | 'low_stock' | 'out_of_stock' | 'hidden_online';

const PAGE_SIZE = 15;

export function AdminStockPage() {
  const { t, bi, lang } = useI18n();
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const { user } = useAuth();
  const adminName = user?.name ?? 'Senthilnathan K (Store Admin)';

  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<StockHistoryEntry[]>([]);
  const [importLogs, setImportLogs] = useState<StockImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [activeTab, setActiveTab] = useState<StockTab>('table');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StockFilterStatus>('all');
  const [page, setPage] = useState(1);

  const [toast, setToast] = useState<string | null>(null);

  // Quick stock update bar
  const [quickModeOpen, setQuickModeOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [quickProductId, setQuickProductId] = useState('');
  const [quickQty, setQuickQty] = useState('');
  const [quickReason, setQuickReason] = useState<'manual' | 'correction'>('manual');

  // Inline table editing state
  const [inlineEdit, setInlineEdit] = useState<{
    productId: string;
    field: 'stock' | 'price';
    value: string;
  } | null>(null);

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyModalTarget, setHistoryModalTarget] = useState<{
    productName: string;
    entries: StockHistoryEntry[];
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [p, b, c, h, logs] = await Promise.all([
        getProducts({ includeHidden: true }),
        getBrands(),
        getCategories(),
        getStockHistory(),
        getImportLogs(),
      ]);
      setProducts(p);
      setBrands(b);
      setCategories(c);
      setHistory(h);
      setImportLogs(logs);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    return subscribeToCatalogUpdates(() => void loadData());
  }, [loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false;
      if (brandFilter !== 'all' && p.brandId !== brandFilter) return false;

      const avail = getTotalAvailableQty(p);
      const threshold = p.lowStockThreshold ?? 5;
      if (statusFilter === 'out_of_stock' && avail > 0) return false;
      if (statusFilter === 'low_stock' && !(avail > 0 && avail <= threshold)) return false;
      if (statusFilter === 'hidden_online' && p.visibleOnline) return false;

      if (!q) return true;
      const brandName = resolveBrandName(p.brandId, brands).toLowerCase();
      return (
        p.name.en.toLowerCase().includes(q) ||
        p.name.ta.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        brandName.includes(q)
      );
    });
  }, [products, search, categoryFilter, brandFilter, statusFilter, brands]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, safePage]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, brandFilter, statusFilter]);

  // Quick Stock Update matches
  const quickMatches = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.name.en.toLowerCase().includes(q) ||
          p.name.ta.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, quickQuery]);

  const selectedQuickProduct = useMemo(
    () => products.find((p) => p.id === quickProductId),
    [products, quickProductId],
  );

  const handleSelectQuickProduct = (prod: Product) => {
    setQuickProductId(prod.id);
    setQuickQuery(`${prod.sku ? `${prod.sku} · ` : ''}${prod.name.en}`);
    setQuickQty(String(getTotalAvailableQty(prod)));
  };

  const handleQuickStockSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuickProduct) return;
    const parsed = Number(quickQty);
    if (!Number.isFinite(parsed) || parsed < 0) return;

    const oldQty = getTotalAvailableQty(selectedQuickProduct);
    const nextQty = Math.floor(parsed);
    await updateStock(selectedQuickProduct.id, nextQty, quickReason as StockHistoryReason, {
      who: adminName,
      note: 'Quick stock update',
    });
    await loadData();
    showToast(
      t('admin.quickUpdateSuccessToast', {
        name: selectedQuickProduct.name.en,
        oldQty,
        newQty: nextQty,
      }),
    );
  };

  const commitInlineEdit = async () => {
    if (!inlineEdit) return;
    const prod = products.find((p) => p.id === inlineEdit.productId);
    if (!prod) {
      setInlineEdit(null);
      return;
    }

    const parsed = Number(inlineEdit.value);
    if (inlineEdit.field === 'stock') {
      if (!Number.isFinite(parsed) || parsed < 0) {
        setInlineEdit(null);
        return;
      }
      const nextQty = Math.floor(parsed);
      const oldAvail = getTotalAvailableQty(prod);
      if (nextQty !== oldAvail) {
        await updateStock(prod.id, nextQty, 'manual', {
          who: adminName,
          note: 'Inline table edit',
        });
        await loadData();
        showToast(
          t('admin.quickUpdateSuccessToast', {
            name: prod.name.en,
            oldQty: oldAvail,
            newQty: nextQty,
          }),
        );
      }
    } else {
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setInlineEdit(null);
        return;
      }
      const nextPrice = Math.round(parsed);
      if (nextPrice !== prod.price) {
        await updatePriceInline(prod.id, nextPrice, undefined, {
          who: adminName,
          reason: 'manual',
        });
        await loadData();
        showToast(
          t('admin.inlinePriceSavedToast', {
            name: prod.name.en,
            price: formatINR(nextPrice),
          }),
        );
      }
    }

    setInlineEdit(null);
  };

  const handleToggleVisibility = async (prod: Product) => {
    await saveProduct({
      ...prod,
      visibleOnline: !prod.visibleOnline,
      updatedAt: new Date().toISOString(),
    });
    await loadData();
  };

  const handleSaveModalProduct = async (nextProduct: Product, oldStockQty?: number) => {
    await saveProduct(nextProduct);
    if (oldStockQty === undefined) {
      appendStockHistoryEntry({
        productId: nextProduct.id,
        productName: nextProduct.name.en,
        sku: nextProduct.sku,
        who: adminName,
        oldValue: 0,
        newValue: nextProduct.stockQty,
        field: 'stock',
        reason: 'manual',
        note: 'Added new SKU manually',
      });
    } else if (oldStockQty !== nextProduct.stockQty) {
      appendStockHistoryEntry({
        productId: nextProduct.id,
        productName: nextProduct.name.en,
        sku: nextProduct.sku,
        who: adminName,
        oldValue: oldStockQty,
        newValue: nextProduct.stockQty,
        field: 'stock',
        reason: 'manual',
        note: 'Updated via manual product form',
      });
    }
    await loadData();
    showToast(t('admin.productSavedToast', { name: bi(nextProduct.name) }));
  };

  const handleOpenHistory = async (prod: Product) => {
    const entries = await getStockHistory(prod.id);
    setHistoryModalTarget({
      productName: `${bi(prod.name)} (${prod.sku || prod.id})`,
      entries,
    });
  };

  const handleImportComplete = async (result: StockImportResult) => {
    await loadData();
    showToast(
      t('admin.importSuccessToast', {
        updated: result.updated,
        created: result.created,
      }),
    );
  };

  const renderStockBadge = (prod: Product) => {
    const avail = getTotalAvailableQty(prod);
    const threshold = prod.lowStockThreshold ?? 5;
    if (avail <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-dark-ink text-white text-[11px] font-bold">
          {t('admin.outOfStockChip')}
        </span>
      );
    }
    if (avail <= threshold) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-alert-red text-white text-[11px] font-bold tabular-nums"
          data-testid={`low-stock-chip-${prod.id}`}
        >
          {t('admin.lowStockChip', { qty: avail, threshold })}
        </span>
      );
    }
    return null;
  };

  const startRow = filteredProducts.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(filteredProducts.length, safePage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header & Top Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-dark-ink">
            {t('admin.productsPageTitle')}
          </h1>
          <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-text">
            <Info className="w-3.5 h-3.5 text-fresh-green shrink-0" aria-hidden="true" />
            <span>{t('admin.noBillingSyncNote')}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={downloadExportStockXlsx}
            leftIcon={<Download className="w-4 h-4" />}
            data-testid="export-stock-btn"
          >
            {t('admin.exportStockCta')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={downloadTemplateXlsx}
            leftIcon={<FileSpreadsheet className="w-4 h-4" />}
          >
            {t('admin.downloadTemplateCta')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              setEditingProduct(null);
              setProductModalOpen(true);
            }}
            leftIcon={<PackagePlus className="w-4 h-4" />}
            data-testid="add-product-btn"
          >
            {t('admin.addProductCta')}
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="rounded-[10px] bg-light-green border border-fresh-green/40 px-4 py-3 text-sm font-semibold text-fresh-green flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}

      {/* Module Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={[
              'min-h-[44px] px-4 rounded-[10px] text-sm font-semibold transition-colors cursor-pointer',
              activeTab === 'table'
                ? 'bg-fresh-green text-white'
                : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
            ].join(' ')}
          >
            {t('admin.tabManualEntry')} ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            data-testid="tab-excel-upload"
            className={[
              'min-h-[44px] px-4 rounded-[10px] text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-2',
              activeTab === 'excel'
                ? 'bg-fresh-green text-white'
                : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
            ].join(' ')}
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>{t('admin.tabExcelUpload')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            data-testid="tab-import-logs"
            className={[
              'min-h-[44px] px-4 rounded-[10px] text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-2',
              activeTab === 'logs'
                ? 'bg-fresh-green text-white'
                : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
            ].join(' ')}
          >
            <History className="w-4 h-4" aria-hidden="true" />
            <span>
              {t('admin.tabImportLogs')} ({importLogs.length})
            </span>
          </button>
        </div>

        {activeTab === 'table' && (
          <Button
            type="button"
            variant={quickModeOpen ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setQuickModeOpen((prev) => !prev)}
            leftIcon={<Zap className="w-4 h-4" />}
            data-testid="toggle-quick-stock-btn"
          >
            {t('admin.tabQuickUpdate')}
          </Button>
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={4} rowHeightClass="h-20" />
      ) : hasError ? (
        <ErrorStateCard
          title={t('a11y.loadErrorTitle')}
          subtitle={t('a11y.loadErrorSubtitle')}
          retryLabel={t('a11y.retry')}
          onRetry={() => void loadData()}
        />
      ) : (
        <>
      {/* Excel / CSV Upload Tab */}
      {activeTab === 'excel' && (
        <StockExcelImportPanel
          products={products}
          brands={brands}
          categories={categories}
          onImportComplete={handleImportComplete}
        />
      )}

      {/* Import Log & Audit History Tab */}
      {activeTab === 'logs' && (
        <StockImportLogTab logs={importLogs} history={history} />
      )}

      {/* Products & Stock Table Tab */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          {/* Quick Stock Update Mode Panel */}
          {quickModeOpen && (
            <Card
              padding="md"
              className="border-2 border-fresh-green/35 bg-light-green/40 space-y-3"
              data-testid="quick-stock-panel"
            >
              <div>
                <h2 className="font-heading font-bold text-base text-dark-ink">
                  {t('admin.quickUpdateTitle')}
                </h2>
                <p className="text-xs text-muted-text">{t('admin.quickUpdateSubtitle')}</p>
              </div>

              <form
                onSubmit={(e) => void handleQuickStockSave(e)}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                <div className="md:col-span-5 relative">
                  <label
                    htmlFor="quick-stock-search"
                    className="block text-xs font-semibold text-dark-ink mb-1"
                  >
                    {t('admin.colProduct')}
                  </label>
                  <input
                    id="quick-stock-search"
                    type="text"
                    value={quickQuery}
                    onChange={(e) => {
                      setQuickQuery(e.target.value);
                      setQuickProductId('');
                    }}
                    placeholder={t('admin.quickUpdateSearchPlaceholder')}
                    className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                  />
                  {!selectedQuickProduct && quickMatches.length > 0 && (
                    <div className="mt-1.5 max-h-44 overflow-y-auto rounded-[10px] border border-border-grey bg-white divide-y divide-border-grey/60 shadow-sm">
                      {quickMatches.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectQuickProduct(prod)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-light-green flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="font-semibold text-dark-ink truncate">
                            {prod.sku ? `${prod.sku} · ` : ''}
                            {bi(prod.name)} ({prod.packSize})
                          </span>
                          <span className="text-muted-text tabular-nums shrink-0">
                            {getTotalAvailableQty(prod)} {t('common.unitsLabel')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="quick-stock-qty"
                    className="block text-xs font-semibold text-dark-ink mb-1"
                  >
                    {t('admin.quickUpdateNewQty')}
                  </label>
                  <input
                    id="quick-stock-qty"
                    type="number"
                    min={0}
                    disabled={!selectedQuickProduct}
                    value={quickQty}
                    onChange={(e) => setQuickQty(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm font-bold tabular-nums disabled:opacity-50"
                  />
                </div>

                <div className="md:col-span-3">
                  <label
                    htmlFor="quick-stock-reason"
                    className="block text-xs font-semibold text-dark-ink mb-1"
                  >
                    {t('admin.quickUpdateReasonLabel')}
                  </label>
                  <select
                    id="quick-stock-reason"
                    value={quickReason}
                    onChange={(e) =>
                      setQuickReason(e.target.value as 'manual' | 'correction')
                    }
                    className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                  >
                    <option value="manual">{t('admin.reasonManual')}</option>
                    <option value="correction">{t('admin.reasonCorrection')}</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    disabled={!selectedQuickProduct || quickQty === ''}
                    data-testid="quick-stock-save-btn"
                  >
                    {t('admin.quickUpdateSaveCta')}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Search + Multi-Filter Bar */}
          <Card padding="md" className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-5 relative">
                <Search
                  className="w-4 h-4 text-muted-text absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('admin.productsSearchPlaceholder')}
                  aria-label={t('admin.stockSearchAria')}
                  className="w-full min-h-[44px] pl-10 pr-3 rounded-[10px] bg-soft-grey border border-border-grey text-sm focus:bg-white focus:outline-none focus:border-fresh-green"
                />
              </div>

              <div className="lg:col-span-3">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label={t('admin.colCategory')}
                  className="w-full min-h-[44px] px-3 rounded-[10px] bg-soft-grey border border-border-grey text-sm"
                >
                  <option value="all">{t('admin.filterCategoryAll')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {bi(c.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  aria-label={t('admin.colBrand')}
                  className="w-full min-h-[44px] px-3 rounded-[10px] bg-soft-grey border border-border-grey text-sm"
                >
                  <option value="all">{t('admin.filterBrandAll')}</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StockFilterStatus)
                  }
                  aria-label={t('admin.colStatus')}
                  data-testid="stock-status-filter"
                  className="w-full min-h-[44px] px-3 rounded-[10px] bg-soft-grey border border-border-grey text-sm"
                >
                  <option value="all">{t('admin.filterStatusAll')}</option>
                  <option value="low_stock">{t('admin.filterLowStock')}</option>
                  <option value="out_of_stock">{t('admin.filterOutOfStock')}</option>
                  <option value="hidden_online">{t('admin.filterHiddenOnline')}</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] text-muted-text">{t('admin.inlineSaveHint')}</p>
          </Card>

          {/* Desktop 10-Column Stock Table */}
          <Card padding="none" className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-soft-grey border-b border-border-grey uppercase text-muted-text text-[10px] tracking-wide">
                    <th className="py-2.5 px-2 font-semibold whitespace-nowrap">{t('admin.colItemCode')}</th>
                    <th className="py-2.5 px-2 font-semibold">{t('admin.colProduct')}</th>
                    <th className="py-2.5 px-2 font-semibold">{t('admin.colBrand')}</th>
                    <th className="py-2.5 px-2 font-semibold">{t('admin.colCategory')}</th>
                    <th className="py-2.5 px-2 font-semibold whitespace-nowrap">{t('admin.colPackSize')}</th>
                    <th className="py-2.5 px-2 font-semibold whitespace-nowrap">{t('admin.colStockQty')}</th>
                    <th className="py-2.5 px-2 font-semibold">{t('admin.colMrp')}</th>
                    <th className="py-2.5 px-2 font-semibold">{t('admin.colSellingPrice')}</th>
                    <th className="py-2.5 px-2 font-semibold">{t('admin.colOnlineStatus')}</th>
                    <th className="py-2.5 px-2 font-semibold whitespace-nowrap">{t('admin.colLastUpdated')}</th>
                    <th className="py-2.5 px-2 font-semibold text-right">{t('admin.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-grey/60">
                  {paginatedProducts.map((prod) => {
                    const cat = categoryMap.get(prod.categoryId);
                    const brandName = resolveBrandName(prod.brandId, brands);
                    const avail = getTotalAvailableQty(prod);
                    const isEditingStock =
                      inlineEdit?.productId === prod.id && inlineEdit.field === 'stock';
                    const isEditingPrice =
                      inlineEdit?.productId === prod.id && inlineEdit.field === 'price';

                    return (
                      <tr
                        key={prod.id}
                        data-testid={`stock-row-${prod.sku || prod.id}`}
                        className="hover:bg-soft-grey/40"
                      >
                        <td className="py-2 px-2 font-mono text-[11px] text-muted-text whitespace-nowrap">
                          {prod.sku || '—'}
                        </td>
                        <td className="py-2 px-2 max-w-[185px]">
                          <div className="flex items-center gap-2">
                            <ProductImage
                              tint={prod.imageTint}
                              image={prod.image}
                              alt={bi(prod.name)}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-dark-ink text-xs leading-tight truncate">
                                {prod.name.en}
                              </p>
                              <p className="text-[11px] text-muted-text truncate">
                                {prod.name.ta}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-dark-ink max-w-[92px] truncate">
                          {brandName}
                        </td>
                        <td className="py-2 px-2 text-muted-text max-w-[96px] truncate">
                          {cat ? bi(cat.name) : prod.categoryId}
                        </td>
                        <td className="py-2 px-2 text-dark-ink whitespace-nowrap">
                          {prod.packSize}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {isEditingStock ? (
                            <input
                              type="number"
                              min={0}
                              autoFocus
                              value={inlineEdit.value}
                              aria-label={t('admin.inlineEditStockAria', { name: bi(prod.name) })}
                              data-testid={`inline-stock-input-${prod.id}`}
                              onChange={(e) =>
                                setInlineEdit({ ...inlineEdit, value: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commitInlineEdit();
                                } else if (e.key === 'Escape') {
                                  setInlineEdit(null);
                                }
                              }}
                              onBlur={() => void commitInlineEdit()}
                              className="w-16 min-h-[34px] px-2 rounded border-2 border-fresh-green bg-white text-sm font-bold tabular-nums"
                            />
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setInlineEdit({
                                    productId: prod.id,
                                    field: 'stock',
                                    value: String(avail),
                                  })
                                }
                                data-testid={`inline-stock-trigger-${prod.id}`}
                                title={t('admin.inlineSaveHint')}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-light-green border border-transparent hover:border-fresh-green/40 font-bold text-sm text-dark-ink tabular-nums cursor-pointer"
                              >
                                <span>{avail}</span>
                                <Edit3 className="w-3 h-3 text-muted-text" aria-hidden="true" />
                              </button>
                              {renderStockBadge(prod)}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 tabular-nums text-muted-text whitespace-nowrap">
                          {formatINR(prod.mrp)}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {isEditingPrice ? (
                            <input
                              type="number"
                              min={1}
                              autoFocus
                              value={inlineEdit.value}
                              aria-label={t('admin.inlineEditPriceAria', { name: bi(prod.name) })}
                              data-testid={`inline-price-input-${prod.id}`}
                              onChange={(e) =>
                                setInlineEdit({ ...inlineEdit, value: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void commitInlineEdit();
                                } else if (e.key === 'Escape') {
                                  setInlineEdit(null);
                                }
                              }}
                              onBlur={() => void commitInlineEdit()}
                              className="w-20 min-h-[34px] px-2 rounded border-2 border-fresh-green bg-white text-sm font-bold tabular-nums"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setInlineEdit({
                                  productId: prod.id,
                                  field: 'price',
                                  value: String(prod.price),
                                })
                              }
                              data-testid={`inline-price-trigger-${prod.id}`}
                              title={t('admin.inlineSaveHint')}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-light-green border border-transparent hover:border-fresh-green/40 font-bold text-sm text-fresh-green tabular-nums cursor-pointer"
                            >
                              <span>{formatINR(prod.price)}</span>
                              <Edit3 className="w-3 h-3 text-muted-text" aria-hidden="true" />
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <button
                            type="button"
                            aria-label={t('admin.visibilityToggleAria', { name: bi(prod.name) })}
                            onClick={() => void handleToggleVisibility(prod)}
                            className="inline-flex items-center gap-1 min-h-[34px] px-1 rounded-[8px] hover:bg-soft-grey cursor-pointer"
                          >
                            {prod.visibleOnline ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
                                <Badge tone="green">{t('common.inStock')}</Badge>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-muted-text" aria-hidden="true" />
                                <Badge tone="dark">{t('admin.hiddenBadge')}</Badge>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-2 text-[11px] text-muted-text tabular-nums whitespace-nowrap">
                          {prod.updatedAt ? formatDateTime(prod.updatedAt, locale) : '—'}
                        </td>
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingProduct(prod);
                                setProductModalOpen(true);
                              }}
                              aria-label={`${t('admin.editProductCta')} ${prod.name.en}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleOpenHistory(prod)}
                              aria-label={`${t('admin.stockHistoryTitle')} ${prod.name.en}`}
                              data-testid={`history-btn-${prod.id}`}
                            >
                              <History className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedProducts.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-sm text-muted-text">
                        {t('admin.noProductsMatchFilter')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden space-y-3">
            {paginatedProducts.map((prod) => {
              const cat = categoryMap.get(prod.categoryId);
              const brandName = resolveBrandName(prod.brandId, brands);
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
                        <p className="font-heading font-bold text-sm text-dark-ink truncate">
                          {bi(prod.name)}
                        </p>
                        <p className="text-xs text-muted-text truncate">
                          {prod.sku || '—'} · {brandName} · {prod.packSize}
                        </p>
                        <p className="text-[11px] text-muted-text">
                          {cat ? bi(cat.name) : ''}
                        </p>
                      </div>
                    </div>
                    {renderStockBadge(prod)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-grey/60 text-xs">
                    <div>
                      <p className="text-muted-text">{t('admin.colStockQty')}</p>
                      <p className="font-bold text-sm text-dark-ink tabular-nums">{avail}</p>
                    </div>
                    <div>
                      <p className="text-muted-text">{t('admin.colSellingPrice')}</p>
                      <p className="font-bold text-sm text-fresh-green tabular-nums">
                        {formatINR(prod.price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-text">{t('admin.colMrp')}</p>
                      <p className="font-semibold text-sm text-muted-text tabular-nums">
                        {formatINR(prod.mrp)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      aria-label={t('admin.visibilityToggleAria', { name: bi(prod.name) })}
                      onClick={() => void handleToggleVisibility(prod)}
                      className="text-xs font-semibold text-dark-ink inline-flex items-center gap-1 min-h-[38px]"
                    >
                      {prod.visibleOnline ? (
                        <Badge tone="green">{t('common.inStock')}</Badge>
                      ) : (
                        <Badge tone="dark">{t('admin.hiddenBadge')}</Badge>
                      )}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingProduct(prod);
                          setProductModalOpen(true);
                        }}
                      >
                        {t('admin.editProductCta')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleOpenHistory(prod)}
                      >
                        <History className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-text tabular-nums">
              {t('admin.paginationShowing', {
                start: startRow,
                end: endRow,
                total: filteredProducts.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('admin.prevPage')}
              </Button>
              <span className="text-xs font-semibold text-dark-ink tabular-nums px-2">
                {safePage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('admin.nextPage')}
              </Button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Add / Edit Product Modal */}
      <StockProductModal
        open={productModalOpen}
        editingProduct={editingProduct}
        brands={brands}
        categories={categories}
        onClose={() => setProductModalOpen(false)}
        onSave={handleSaveModalProduct}
      />

      {/* Per-Product Stock History Modal */}
      <StockHistoryModal
        open={Boolean(historyModalTarget)}
        productName={historyModalTarget?.productName}
        entries={historyModalTarget?.entries ?? []}
        onClose={() => setHistoryModalTarget(null)}
      />
    </div>
  );
}
