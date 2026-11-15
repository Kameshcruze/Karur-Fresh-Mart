import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  Check,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  Chip,
  ProductCard,
} from '../components/ui';
import { useI18n } from '../context/I18nContext';
import {
  getBrands,
  getCategories,
  getProducts,
  getTotalAvailableQty,
  subscribeToCatalogUpdates,
} from '../services';
import type { Brand, Category, Product } from '../types';
import { calculateDiscountPercent, formatINR } from '../utils/format';
import { PRODUCT_TINT_CLASSES } from '../utils/tints';

type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'discount_desc';

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, bi } = useI18n();

  const searchQuery = (searchParams.get('q') ?? '').trim();
  const activeSlug = slug ?? 'all';

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [poolProducts, setPoolProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [maxPriceLimit, setMaxPriceLimit] = useState<number | null>(null);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadCategory = (resetFilters: boolean) => {
      if (resetFilters) setIsLoading(true);
      void Promise.all([
        getCategories(),
        getBrands(),
        getProducts({
          categorySlug: activeSlug === 'all' ? undefined : activeSlug,
          query: searchQuery || undefined,
        }),
      ]).then(([cats, brs, prods]) => {
        if (!active) return;
        setCategories(cats);
        setBrands(brs);
        setPoolProducts(prods);
        if (resetFilters) {
          setSelectedBrandIds([]);
          setMaxPriceLimit(null);
          setMinDiscount(0);
          setInStockOnly(false);
        }
        setIsLoading(false);
      });
    };
    loadCategory(true);
    const unsub = subscribeToCatalogUpdates(() => loadCategory(false));
    return () => {
      active = false;
      unsub();
    };
  }, [activeSlug, searchQuery]);

  // Lock body scroll when mobile filter bottom sheet is open
  useEffect(() => {
    if (!mobileSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileSheetOpen]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const activeCategory = categories.find((c) => c.slug === activeSlug);

  const priceBounds = useMemo(() => {
    if (poolProducts.length === 0) return { min: 0, max: 1000 };
    let min = Infinity;
    let max = 0;
    for (const p of poolProducts) {
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }
    const roundedMin = Math.max(0, Math.floor(min / 10) * 10);
    const roundedMax = Math.max(roundedMin + 50, Math.ceil(max / 10) * 10);
    return { min: roundedMin, max: roundedMax };
  }, [poolProducts]);

  const effectiveMaxPrice =
    maxPriceLimit !== null
      ? Math.min(Math.max(maxPriceLimit, priceBounds.min), priceBounds.max)
      : priceBounds.max;

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of poolProducts) {
      counts.set(p.brandId, (counts.get(p.brandId) ?? 0) + 1);
    }
    return brands
      .filter((b) => counts.has(b.id))
      .map((b) => ({ brand: b, count: counts.get(b.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.brand.name.localeCompare(b.brand.name));
  }, [poolProducts, brands]);

  const filteredProducts = useMemo(() => {
    let list = poolProducts.filter((p) => {
      if (selectedBrandIds.length > 0 && !selectedBrandIds.includes(p.brandId)) {
        return false;
      }
      if (p.price > effectiveMaxPrice) {
        return false;
      }
      if (minDiscount > 0 && calculateDiscountPercent(p.mrp, p.price) < minDiscount) {
        return false;
      }
      if (inStockOnly && getTotalAvailableQty(p) <= 0) {
        return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'discount_desc') {
      list = [...list].sort(
        (a, b) =>
          calculateDiscountPercent(b.mrp, b.price) -
          calculateDiscountPercent(a.mrp, a.price),
      );
    } else {
      // Relevance: featured & in-stock items prioritized
      list = [...list].sort((a, b) => {
        const aStock = getTotalAvailableQty(a) > 0 ? 1 : 0;
        const bStock = getTotalAvailableQty(b) > 0 ? 1 : 0;
        if (aStock !== bStock) return bStock - aStock;
        const aFeat = a.isFeatured ? 1 : 0;
        const bFeat = b.isFeatured ? 1 : 0;
        return bFeat - aFeat;
      });
    }

    return list;
  }, [
    poolProducts,
    selectedBrandIds,
    effectiveMaxPrice,
    minDiscount,
    inStockOnly,
    sortBy,
  ]);

  const activeFilterCount =
    selectedBrandIds.length +
    (effectiveMaxPrice < priceBounds.max ? 1 : 0) +
    (minDiscount > 0 ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  const toggleBrand = (brandId: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((id) => id !== brandId) : [...prev, brandId],
    );
  };

  const resetAllFilters = () => {
    setSelectedBrandIds([]);
    setMaxPriceLimit(null);
    setMinDiscount(0);
    setInStockOnly(false);
  };

  const clearSearchQuery = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const discountOptions = [
    { value: 0, label: t('category.discountAll') },
    { value: 10, label: t('category.discount10') },
    { value: 15, label: t('category.discount15') },
    { value: 20, label: t('category.discount20') },
  ];

  const renderFilterControls = (idPrefix: string) => (
    <div className="space-y-6">
      {/* Price Range Slider */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`${idPrefix}-price-slider`}
            className="font-heading font-semibold text-sm text-dark-ink"
          >
            {t('category.maxPrice')}
          </label>
          <span className="text-xs font-bold text-fresh-green tabular-nums bg-light-green px-2 py-0.5 rounded-[6px]">
            {t('category.priceUpTo', { price: formatINR(effectiveMaxPrice) })}
          </span>
        </div>
        <input
          id={`${idPrefix}-price-slider`}
          type="range"
          min={priceBounds.min}
          max={priceBounds.max}
          step={10}
          value={effectiveMaxPrice}
          onChange={(e) => setMaxPriceLimit(Number(e.target.value))}
          className="w-full accent-fresh-green cursor-pointer h-2 bg-border-grey rounded-lg"
        />
        <div className="flex items-center justify-between text-[11px] text-muted-text tabular-nums">
          <span>{formatINR(priceBounds.min)}</span>
          <span>{formatINR(priceBounds.max)}</span>
        </div>
      </div>

      {/* Discount Filter */}
      <div className="space-y-2 pt-4 border-t border-border-grey/70">
        <p className="font-heading font-semibold text-sm text-dark-ink">
          {t('category.discount')}
        </p>
        <div className="space-y-1.5">
          {discountOptions.map((opt) => {
            const checked = minDiscount === opt.value;
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 min-h-[38px] px-2 rounded-[8px] hover:bg-soft-grey cursor-pointer text-sm text-dark-ink"
              >
                <input
                  type="radio"
                  name={`${idPrefix}-discount`}
                  checked={checked}
                  onChange={() => setMinDiscount(opt.value)}
                  className="w-4 h-4 accent-fresh-green cursor-pointer"
                />
                <span className={checked ? 'font-semibold text-fresh-green' : ''}>
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Brand Checkboxes */}
      {availableBrands.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border-grey/70">
          <p className="font-heading font-semibold text-sm text-dark-ink">
            {t('category.brands')}
          </p>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {availableBrands.map(({ brand, count }) => {
              const checked = selectedBrandIds.includes(brand.id);
              return (
                <label
                  key={brand.id}
                  className="flex items-center justify-between gap-2 min-h-[38px] px-2 rounded-[8px] hover:bg-soft-grey cursor-pointer text-sm"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBrand(brand.id)}
                      className="w-4 h-4 rounded accent-fresh-green cursor-pointer shrink-0"
                    />
                    <span
                      className={[
                        'truncate',
                        checked ? 'font-semibold text-fresh-green' : 'text-dark-ink',
                      ].join(' ')}
                    >
                      {brand.name}
                    </span>
                  </span>
                  <span className="text-xs text-muted-text tabular-nums shrink-0">
                    {count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Availability Toggle */}
      <div className="pt-4 border-t border-border-grey/70">
        <label className="flex items-center justify-between gap-2 min-h-[40px] px-2 rounded-[8px] hover:bg-soft-grey cursor-pointer text-sm font-medium text-dark-ink">
          <span>{t('category.inStockOnly')}</span>
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="w-4 h-4 rounded accent-fresh-green cursor-pointer"
          />
        </label>
      </div>
    </div>
  );

  const pageTitle = searchQuery
    ? t('category.searchFor', { query: searchQuery })
    : activeCategory
      ? bi(activeCategory.name)
      : t('category.allCategories');

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-text">
        <Link to="/" className="hover:text-fresh-green font-medium">
          {t('nav.home')}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="text-dark-ink font-semibold truncate">{pageTitle}</span>
      </nav>

      {/* Horizontal Category Switcher Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <Link
          to={searchQuery ? `/category/all?q=${encodeURIComponent(searchQuery)}` : '/category/all'}
          className={[
            'inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-[10px] border text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors',
            activeSlug === 'all'
              ? 'bg-light-green border-fresh-green text-fresh-green'
              : 'bg-white border-border-grey text-dark-ink hover:border-fresh-green/60',
          ].join(' ')}
        >
          <span>{t('category.allCategories')}</span>
        </Link>

        {categories.map((cat) => {
          const isCurrent = cat.slug === activeSlug;
          const targetUrl = searchQuery
            ? `/category/${cat.slug}?q=${encodeURIComponent(searchQuery)}`
            : `/category/${cat.slug}`;
          return (
            <Link
              key={cat.id}
              to={targetUrl}
              className={[
                'inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-[10px] border text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors',
                isCurrent
                  ? 'bg-light-green border-fresh-green text-fresh-green'
                  : 'bg-white border-border-grey text-dark-ink hover:border-fresh-green/60',
              ].join(' ')}
            >
              <span
                className={`w-6 h-6 rounded-[6px] ${PRODUCT_TINT_CLASSES[cat.tint]} flex items-center justify-center shrink-0`}
              >
                <CategoryIcon name={cat.icon} className="w-3.5 h-3.5 text-dark-ink" />
              </span>
              <span>{bi(cat.name)}</span>
            </Link>
          );
        })}
      </div>

      {/* Title + Toolbar */}
      <div className="bg-white rounded-[12px] border border-border-grey/80 shadow-[var(--shadow-card)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {activeCategory ? (
            <div
              className={`w-12 h-12 rounded-[12px] ${PRODUCT_TINT_CLASSES[activeCategory.tint]} flex items-center justify-center shrink-0`}
            >
              <CategoryIcon name={activeCategory.icon} className="w-6 h-6 text-dark-ink" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-[12px] bg-light-green flex items-center justify-center shrink-0">
              <Search className="w-5 h-5 text-fresh-green" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-xl sm:text-2xl text-dark-ink truncate">
              {pageTitle}
            </h1>
            <p className="text-xs sm:text-sm text-muted-text mt-0.5 tabular-nums">
              {t('category.showingCount', {
                count: filteredProducts.length,
                total: poolProducts.length,
              })}
            </p>
          </div>
        </div>

        {/* Sort & Mobile Filter Trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileSheetOpen(true)}
            leftIcon={<SlidersHorizontal className="w-4 h-4 text-fresh-green" />}
            className="lg:hidden"
          >
            <span>{t('category.filters')}</span>
            {activeFilterCount > 0 && (
              <Badge tone="yellow" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <ArrowUpDown className="w-4 h-4 text-muted-text hidden sm:block shrink-0" aria-hidden="true" />
            <label htmlFor="category-sort" className="sr-only">
              {t('category.sortBy')}
            </label>
            <select
              id="category-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full sm:w-auto min-h-[44px] px-3 rounded-[10px] border border-border-grey bg-soft-grey text-xs sm:text-sm font-semibold text-dark-ink focus:bg-white focus:outline-none focus:border-fresh-green cursor-pointer"
            >
              <option value="relevance">{t('category.sortRelevance')}</option>
              <option value="price_asc">{t('category.sortPriceAsc')}</option>
              <option value="price_desc">{t('category.sortPriceDesc')}</option>
              <option value="discount_desc">{t('category.sortDiscountDesc')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      {(activeFilterCount > 0 || searchQuery) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchQuery && (
            <Chip selected onClick={clearSearchQuery}>
              <span className="inline-flex items-center gap-1.5">
                <span>“{searchQuery}”</span>
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Chip>
          )}
          {selectedBrandIds.map((id) => {
            const brandName = brands.find((b) => b.id === id)?.name;
            if (!brandName) return null;
            return (
              <Chip key={id} selected onClick={() => toggleBrand(id)}>
                <span className="inline-flex items-center gap-1.5">
                  <span>{brandName}</span>
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </Chip>
            );
          })}
          {effectiveMaxPrice < priceBounds.max && (
            <Chip selected onClick={() => setMaxPriceLimit(null)}>
              <span className="inline-flex items-center gap-1.5">
                <span>{t('category.priceUpTo', { price: formatINR(effectiveMaxPrice) })}</span>
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Chip>
          )}
          {minDiscount > 0 && (
            <Chip selected onClick={() => setMinDiscount(0)}>
              <span className="inline-flex items-center gap-1.5">
                <span>{minDiscount}%+ OFF</span>
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Chip>
          )}
          {inStockOnly && (
            <Chip selected onClick={() => setInStockOnly(false)}>
              <span className="inline-flex items-center gap-1.5">
                <span>{t('category.inStockOnly')}</span>
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Chip>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-semibold text-fresh-green hover:underline px-2 min-h-[36px] cursor-pointer"
            >
              {t('category.clearAll')}
            </button>
          )}
        </div>
      )}

      {/* Main Content: Desktop Sticky Sidebar + 5-Column / 2-Column Product Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Desktop Sidebar Filters */}
        <aside
          aria-label={t('category.filters')}
          className="hidden lg:block w-64 shrink-0 bg-white rounded-[12px] border border-border-grey/80 shadow-[var(--shadow-card)] p-4 sticky top-[88px]"
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-grey/70">
            <h2 className="font-heading font-bold text-base text-dark-ink flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-fresh-green" aria-hidden="true" />
              <span>{t('category.filters')}</span>
            </h2>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-semibold text-fresh-green hover:underline cursor-pointer"
              >
                {t('category.clearAll')}
              </button>
            )}
          </div>
          {renderFilterControls('desktop')}
        </aside>

        {/* Product Grid */}
        <div className="flex-1 min-w-0 w-full">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 rounded-[12px] bg-white border border-border-grey/60 animate-pulse"
                />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card className="text-center py-12 space-y-3">
              <p className="text-sm sm:text-base font-medium text-dark-ink">
                {t('category.noProductsFound')}
              </p>
              <div className="flex items-center justify-center gap-2.5">
                {activeFilterCount > 0 && (
                  <Button variant="primary" size="sm" onClick={resetAllFilters}>
                    {t('category.clearAll')}
                  </Button>
                )}
                {searchQuery && (
                  <Button variant="outline" size="sm" onClick={clearSearchQuery}>
                    {t('home.resetFilters')}
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  brands={brands}
                  category={categoryById.get(product.categoryId)}
                  showInStockLabel
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Bottom Sheet */}
      {mobileSheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={t('category.filters')}
        >
          <div
            className="absolute inset-0 bg-dark-ink/50 backdrop-blur-[1px]"
            onClick={() => setMobileSheetOpen(false)}
          />
          <div className="relative bg-white rounded-t-[16px] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Sheet Handle & Header */}
            <div className="pt-2.5 pb-3 px-4 border-b border-border-grey flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-fresh-green" aria-hidden="true" />
                <h2 className="font-heading font-bold text-base text-dark-ink">
                  {t('category.filters')}
                </h2>
                {activeFilterCount > 0 && (
                  <Badge tone="yellow">{activeFilterCount}</Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label={t('common.cancel')}
                className="w-11 h-11 rounded-[10px] flex items-center justify-center text-muted-text hover:text-dark-ink hover:bg-soft-grey cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable Filter Controls */}
            <div className="p-4 overflow-y-auto flex-1">
              {renderFilterControls('mobile')}
            </div>

            {/* Sticky Sheet Footer */}
            <div className="p-4 pb-safe border-t border-border-grey bg-white flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={resetAllFilters}
                className="flex-1"
              >
                {t('category.clearAll')}
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Check className="w-4 h-4" />}
                onClick={() => setMobileSheetOpen(false)}
                className="flex-[1.5]"
              >
                {t('category.applyFilters', { count: filteredProducts.length })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
