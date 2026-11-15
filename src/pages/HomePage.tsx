import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Truck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  ProductCard,
} from '../components/ui';
import { useI18n } from '../context/I18nContext';
import {
  getBanners,
  getBrands,
  getCategories,
  getCombos,
  getOffers,
  getOrders,
  getProducts,
  subscribeToCatalogUpdates,
} from '../services';
import type {
  Banner,
  Brand,
  Category,
  Combo,
  Offer,
  Order,
  Product,
} from '../types';
import { calculateDiscountPercent, formatINR } from '../utils/format';
import { resolveProductImage } from '../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../utils/tints';

export function HomePage() {
  const { t, bi } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = (searchParams.get('q') ?? '').trim();

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadHome = () => {
      void Promise.all([
        getCategories(),
        getBrands(),
        getProducts(),
        getCombos(),
        getBanners(),
        getOffers(),
        getOrders(),
      ]).then(([cats, brs, prods, cmbs, bnrs, ofrs, ords]) => {
        if (!active) return;
        setCategories(cats);
        setBrands(brs);
        setProducts(prods);
        setCombos(cmbs);
        setBanners(bnrs);
        setOffers(ofrs);
        setOrders(ords);
        setIsLoading(false);
      });
    };
    loadHome();
    const unsub = subscribeToCatalogUpdates(loadHome);
    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Gentle auto-advance for hero carousel unless user prefers reduced motion
  useEffect(() => {
    if (banners.length <= 1) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const brandMap = new Map(brands.map((b) => [b.id, b.name.toLowerCase()]));
    return products.filter((p) => {
      const bName = brandMap.get(p.brandId) ?? '';
      return (
        p.name.en.toLowerCase().includes(q) ||
        p.name.ta.toLowerCase().includes(q) ||
        bName.includes(q) ||
        p.packSize.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, products, brands]);

  const bestSellers = useMemo(() => {
    const priorityIds = [
      'prod-ponni-rice-10kg',
      'prod-toor-dal-1kg',
      'prod-sunflower-oil-1l',
      'prod-chana-dal-500g',
      'prod-shakthi-pepper-100g',
      'prod-aavin-milk-500ml',
      'prod-ramkumar-turmeric-200g',
      'prod-nannari-syrup-700ml',
    ];
    const byId = new Map(products.map((p) => [p.id, p]));
    const picked: Product[] = [];
    const seen = new Set<string>();

    for (const id of priorityIds) {
      const item = byId.get(id);
      if (item) {
        picked.push(item);
        seen.add(item.id);
      }
    }

    for (const p of products) {
      if (picked.length >= 8) break;
      if (p.isFeatured && !seen.has(p.id)) {
        picked.push(p);
        seen.add(p.id);
      }
    }

    return picked.slice(0, 8);
  }, [products]);

  const todaysOffersProducts = useMemo(() => {
    return [...products]
      .filter((p) => p.mrp > p.price && p.stockQty + p.reservedQty > 0)
      .sort(
        (a, b) =>
          calculateDiscountPercent(b.mrp, b.price) -
          calculateDiscountPercent(a.mrp, a.price),
      )
      .slice(0, 8);
  }, [products]);

  const recentlyOrderedProducts = useMemo(() => {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const list: Product[] = [];

    for (const order of orders) {
      for (const item of order.items) {
        if (item.productId && !seen.has(item.productId)) {
          const found = productMap.get(item.productId);
          if (found) {
            seen.add(found.id);
            list.push(found);
          }
        }
      }
    }

    // Pad up to 4 items from popular staples if order history has fewer
    for (const fallback of products) {
      if (list.length >= 4) break;
      if (!seen.has(fallback.id)) {
        seen.add(fallback.id);
        list.push(fallback);
      }
    }
    return list.slice(0, 4);
  }, [orders, products]);

  const individualCombo = combos.find((c) => c.type === 'individual');
  const familyCombo = combos.find((c) => c.type === 'family');
  const currentBanner = banners[activeSlide] ?? banners[0];
  const heroImageUrl = resolveProductImage('ponni-rice');

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 h-72 rounded-[12px] bg-white border border-border-grey/60 animate-pulse" />
          <div className="lg:col-span-4 h-72 rounded-[12px] bg-white border border-border-grey/60 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 rounded-[12px] bg-white border border-border-grey/60 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Live Search Results Overlay Section (when header search is active) */}
      {searchQuery && (
        <section aria-labelledby="search-results-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1
                id="search-results-heading"
                className="font-heading font-bold text-xl sm:text-2xl text-dark-ink"
              >
                {t('home.searchResultsTitle', { query: searchQuery })}
              </h1>
              <p className="text-sm text-muted-text mt-0.5">
                {t('home.searchResultsCount', { count: searchResults.length })}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearSearch}>
              {t('home.resetFilters')}
            </Button>
          </div>

          {searchResults.length === 0 ? (
            <Card className="text-center py-10 space-y-3">
              <p className="text-sm text-muted-text">
                {t('home.emptySearch', { query: searchQuery })}
              </p>
              <Button variant="primary" size="sm" onClick={clearSearch}>
                {t('home.resetFilters')}
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {searchResults.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  brands={brands}
                  category={categoryById.get(product.categoryId)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Hero Banner Carousel + Two Combo Cards Beside Hero */}
      {!searchQuery && (
        <section aria-label="Featured promotions and monthly combos">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
            {/* Hero Banner Carousel (Green gradient #1B8A4B -> #26A65B + Yellow circle accent) */}
            <div className="lg:col-span-8 relative overflow-hidden rounded-[12px] bg-gradient-to-br from-fresh-green to-bright-green text-white p-6 sm:p-8 flex flex-col justify-between min-h-[290px] sm:min-h-[340px] shadow-[var(--shadow-card)]">
              {/* Warm Yellow #FFC83D Circle Accent (Desktop & Tablet) */}
              <div
                aria-hidden="true"
                className="pointer-events-none hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 w-60 h-60 md:w-64 md:h-64 rounded-full bg-warm-yellow items-center justify-center shadow-lg"
              >
                {heroImageUrl && (
                  <img
                    src={heroImageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-44 h-44 md:w-48 md:h-48 rounded-full object-cover border-4 border-white shadow-md"
                  />
                )}
              </div>

              <div className="relative z-10 sm:max-w-md space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[8px] bg-white/15 backdrop-blur-xs text-xs font-semibold text-white">
                    <Truck className="w-3.5 h-3.5 text-warm-yellow shrink-0" aria-hidden="true" />
                    <span>{t('home.heroBadge')}</span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="sm:hidden w-12 h-12 rounded-full bg-warm-yellow flex items-center justify-center shrink-0 shadow-sm"
                  >
                    {heroImageUrl && (
                      <img
                        src={heroImageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border-2 border-white"
                      />
                    )}
                  </div>
                </div>

                <h1 className="font-heading font-bold text-2xl sm:text-[34px] leading-tight tracking-tight">
                  {activeSlide === 0 || !currentBanner
                    ? t('home.heroTitle')
                    : bi(currentBanner.title)}
                </h1>

                <p className="text-sm sm:text-base text-white/95 leading-relaxed max-w-sm">
                  {activeSlide === 0 || !currentBanner
                    ? t('home.heroSubtitle')
                    : bi(currentBanner.subtitle)}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    to={currentBanner?.ctaRoute ?? '/shop'}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-[10px] bg-warm-yellow text-dark-ink font-semibold text-sm hover:brightness-95 transition-all whitespace-nowrap shrink-0"
                  >
                    <span>
                      {activeSlide === 0 || !currentBanner
                        ? t('home.heroCta')
                        : bi(currentBanner.ctaLabel)}
                    </span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/category/rice-grains"
                    className="inline-flex items-center min-h-[44px] px-4 py-2.5 rounded-[10px] bg-white/15 hover:bg-white/25 text-white font-semibold text-sm border border-white/25 transition-colors whitespace-nowrap shrink-0"
                  >
                    {t('home.heroSecondaryCta')}
                  </Link>
                </div>
              </div>

              {/* Carousel Controls */}
              {banners.length > 1 && (
                <div className="relative z-10 flex items-center justify-between pt-5 mt-2">
                  <div className="flex items-center gap-2" role="tablist" aria-label="Hero banners">
                    {banners.map((banner, idx) => (
                      <button
                        key={banner.id}
                        type="button"
                        role="tab"
                        aria-selected={idx === activeSlide}
                        aria-label={`Banner ${idx + 1}: ${bi(banner.title)}`}
                        onClick={() => setActiveSlide(idx)}
                        className={[
                          'h-2.5 rounded-full transition-all cursor-pointer',
                          idx === activeSlide
                            ? 'w-7 bg-warm-yellow'
                            : 'w-2.5 bg-white/45 hover:bg-white/75',
                        ].join(' ')}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t('home.previousSlide')}
                      onClick={() =>
                        setActiveSlide((prev) => (prev - 1 + banners.length) % banners.length)
                      }
                      className="w-11 h-11 rounded-[10px] bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('home.nextSlide')}
                      onClick={() => setActiveSlide((prev) => (prev + 1) % banners.length)}
                      className="w-11 h-11 rounded-[10px] bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Two Prominent Combo Cards Beside Hero */}
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {/* Individual Combo — Warm Yellow Card */}
              <div className="rounded-[12px] bg-warm-yellow text-dark-ink p-5 flex flex-col justify-between shadow-[var(--shadow-card)]">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-dark-ink/80">
                      {t('home.individualComboTag')}
                    </span>
                    <span className="font-heading font-bold text-lg tabular-nums text-dark-ink">
                      {formatINR(individualCombo?.price ?? 2450)}
                    </span>
                  </div>
                  <h2 className="font-heading font-bold text-lg leading-snug">
                    {individualCombo
                      ? bi(individualCombo.name)
                      : 'Individual Starter Provision Pack'}
                  </h2>
                </div>

                <div className="pt-4">
                  <Link
                    to="/combo/individual"
                    className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2.5 rounded-[10px] bg-dark-ink text-white text-sm font-semibold hover:bg-dark-ink/90 transition-colors whitespace-nowrap"
                  >
                    <span>{t('home.buyInOneClick')}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Family Combo — Dark Ink Card */}
              <div className="rounded-[12px] bg-dark-ink text-white p-5 flex flex-col justify-between shadow-[var(--shadow-card)]">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white/80">
                      {t('home.familyComboTag')}
                    </span>
                    <span className="font-heading font-bold text-lg tabular-nums text-warm-yellow">
                      {formatINR(familyCombo?.price ?? 6890)}
                    </span>
                  </div>
                  <h2 className="font-heading font-bold text-lg leading-snug">
                    {familyCombo
                      ? bi(familyCombo.name)
                      : 'Karur Monthly Family Provision Box'}
                  </h2>
                </div>

                <div className="pt-4">
                  <Link
                    to="/combo/family"
                    className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2.5 rounded-[10px] bg-warm-yellow text-dark-ink text-sm font-semibold hover:brightness-95 transition-all whitespace-nowrap"
                  >
                    <span>{t('home.buyInOneClick')}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 10-Category Grid with Tinted Icon Tiles */}
      {!searchQuery && (
        <section aria-labelledby="categories-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                id="categories-heading"
                className="font-heading font-bold text-xl sm:text-2xl text-dark-ink"
              >
                {t('home.categoriesTitle')}
              </h2>
              <p className="text-sm text-muted-text mt-0.5">
                {t('home.categoriesSubtitle')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                className="group bg-white rounded-[12px] border border-border-grey/80 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-fresh-green/50 p-3.5 sm:p-4 flex flex-col items-center text-center gap-2.5 transition-all duration-150 min-h-[112px]"
              >
                <div
                  className={`w-12 h-12 rounded-[10px] ${PRODUCT_TINT_CLASSES[cat.tint]} flex items-center justify-center text-fresh-green group-hover:scale-105 transition-transform`}
                >
                  <CategoryIcon name={cat.icon} className="w-6 h-6 text-dark-ink" />
                </div>
                <span className="font-heading font-semibold text-xs sm:text-sm text-dark-ink group-hover:text-fresh-green leading-snug line-clamp-2">
                  {bi(cat.name)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Best Sellers Section */}
      {!searchQuery && (
        <section aria-labelledby="bestsellers-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                id="bestsellers-heading"
                className="font-heading font-bold text-xl sm:text-2xl text-dark-ink"
              >
                {t('home.bestSellersTitle')}
              </h2>
              <p className="text-sm text-muted-text mt-0.5">
                {t('home.bestSellersSubtitle')}
              </p>
            </div>
            <Link
              to="/category/rice-grains"
              className="inline-flex items-center gap-1 text-sm font-semibold text-fresh-green hover:underline whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <span>{t('common.viewAll')}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 sm:overflow-visible">
            {bestSellers.map((product) => (
              <div
                key={product.id}
                className="w-[62vw] max-w-[235px] shrink-0 snap-start sm:w-auto sm:max-w-none"
              >
                <ProductCard
                  product={product}
                  brands={brands}
                  category={categoryById.get(product.categoryId)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Today's Offers Section */}
      {!searchQuery && (
        <section aria-labelledby="offers-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                id="offers-heading"
                className="font-heading font-bold text-xl sm:text-2xl text-dark-ink"
              >
                {t('home.todaysOffersTitle')}
              </h2>
              <p className="text-sm text-muted-text mt-0.5">
                {t('home.todaysOffersSubtitle')}
              </p>
            </div>
            <Link
              to="/shop"
              className="inline-flex items-center gap-1 text-sm font-semibold text-fresh-green hover:underline whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <span>{t('common.viewAll')}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          {/* Slim Promo Strip from offerService */}
          {offers.length > 0 && (
            <div className="flex overflow-x-auto gap-3 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {offers.slice(0, 4).map((offer) => (
                <Link
                  key={offer.id}
                  to="/shop"
                  className="w-[74vw] max-w-[280px] shrink-0 sm:w-auto sm:max-w-none bg-light-green/70 hover:bg-light-green border border-fresh-green/20 rounded-[12px] p-3.5 flex flex-col justify-between gap-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="yellow" icon={<Sparkles className="w-3 h-3" />}>
                      {bi(offer.badgeText)}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-sm text-dark-ink line-clamp-1">
                      {bi(offer.title)}
                    </p>
                    <p className="text-xs text-muted-text line-clamp-2 mt-0.5">
                      {bi(offer.subtitle)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 sm:overflow-visible">
            {todaysOffersProducts.slice(0, 4).map((product) => (
              <div
                key={product.id}
                className="w-[62vw] max-w-[235px] shrink-0 snap-start sm:w-auto sm:max-w-none"
              >
                <ProductCard
                  product={product}
                  brands={brands}
                  category={categoryById.get(product.categoryId)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently Ordered Section */}
      {!searchQuery && (
        <section aria-labelledby="recent-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2
                id="recent-heading"
                className="font-heading font-bold text-xl sm:text-2xl text-dark-ink"
              >
                {t('home.recentlyOrderedTitle')}
              </h2>
              <p className="text-sm text-muted-text mt-0.5">
                {t('home.recentlyOrderedSubtitle')}
              </p>
            </div>
            <Link
              to="/orders"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-fresh-green hover:underline whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span>{t('nav.orders')}</span>
            </Link>
          </div>

          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 sm:overflow-visible">
            {recentlyOrderedProducts.map((product) => (
              <div
                key={product.id}
                className="w-[62vw] max-w-[235px] shrink-0 snap-start sm:w-auto sm:max-w-none"
              >
                <ProductCard
                  product={product}
                  brands={brands}
                  category={categoryById.get(product.categoryId)}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
