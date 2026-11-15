import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Languages,
  Package,
  Phone,
  QrCode,
  Sparkles,
  Store,
  Tag,
} from 'lucide-react';
import { Badge, Button, Card } from '../components/ui';
import { useI18n } from '../context/I18nContext';
import {
  getBrands,
  getCategories,
  getCombos,
  getOffers,
  getProducts,
  getTotalAvailableQty,
  resolveBrandName,
  subscribeToCatalogUpdates,
} from '../services';
import type { Brand, Category, Combo, Offer, Product } from '../types';
import { calculateDiscountPercent, formatINR } from '../utils/format';
import { resolveProductImage } from '../utils/productImages';
import { STORE_PHONE_DISPLAY, STORE_PHONE_TEL } from '../utils/qr';
import { PRODUCT_TINT_CLASSES } from '../utils/tints';

export function PublicShopPage() {
  const { lang, toggleLang, t, bi } = useI18n();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const loadShopData = useCallback(async () => {
    const [offerList, comboList, categoryList, brandList, productList] = await Promise.all([
      getOffers(true),
      getCombos(),
      getCategories(),
      getBrands(),
      getProducts(),
    ]);
    setOffers(offerList);
    setCombos(comboList);
    setCategories(categoryList);
    setBrands(brandList);
    setProducts(productList);
    setLoading(false);
  }, []);

  // Load initial public catalog + subscribe to live price/stock/offer updates
  useEffect(() => {
    void loadShopData();
    const unsubscribe = subscribeToCatalogUpdates(() => {
      void loadShopData();
    });
    return () => unsubscribe();
  }, [loadShopData]);

  const filteredProducts = useMemo(() => {
    if (selectedCategoryId === 'all') return products;
    return products.filter((p) => p.categoryId === selectedCategoryId);
  }, [products, selectedCategoryId]);

  const individualCombo = combos.find((c) => c.type === 'individual');
  const familyCombo = combos.find((c) => c.type === 'family');

  return (
    <div className="min-h-screen flex flex-col bg-soft-grey text-dark-ink">
      {/* Lightweight Public Green Header (QR Wall Poster Landing) */}
      <header className="bg-gradient-to-br from-fresh-green to-bright-green text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
          {/* Top Bar: Logo + Tamil/EN Toggle */}
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 text-white font-heading font-bold text-lg sm:text-xl tracking-tight min-h-[44px]"
            >
              <span className="w-9 h-9 rounded-[10px] bg-white/15 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-warm-yellow" aria-hidden="true" />
              </span>
              <span>{t('brand.name')}</span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLang}
                aria-label={t('header.languageLabel')}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-[10px] bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Languages className="w-4 h-4" aria-hidden="true" />
                <span>{lang === 'en' ? 'தமிழ்' : 'English'}</span>
              </button>
            </div>
          </div>

          {/* Headline & Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
            <div className="space-y-1.5 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-white/15 text-warm-yellow text-xs font-semibold">
                <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('shop.qrBadge')}</span>
              </span>
              <h1 className="font-heading font-bold text-xl sm:text-2xl lg:text-3xl leading-snug">
                {t('shop.headerTagline')}
              </h1>
              <p className="text-xs sm:text-sm text-white/90">{t('shop.liveNotice')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                to="/"
                data-testid="shop-header-order-now"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-[10px] bg-warm-yellow hover:bg-[#F5BC2C] text-dark-ink font-heading font-bold text-sm transition-colors shadow-xs"
              >
                <span>{t('shop.orderNow')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>

              <a
                href={`tel:${STORE_PHONE_TEL}`}
                data-testid="shop-header-call-store"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[10px] bg-white text-fresh-green hover:bg-light-green font-heading font-bold text-sm transition-colors shadow-xs"
              >
                <Phone className="w-4 h-4" aria-hidden="true" />
                <span>{t('shop.callStore')}</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-7">
        {/* Today's Offers Section */}
        <section aria-labelledby="shop-offers-heading" className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2
                id="shop-offers-heading"
                className="font-heading font-bold text-lg sm:text-xl text-dark-ink flex items-center gap-2"
              >
                <Tag className="w-5 h-5 text-fresh-green shrink-0" aria-hidden="true" />
                <span>{t('shop.todaysOffersTitle')}</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-text">
                {t('shop.todaysOffersSubtitle')}
              </p>
            </div>
          </div>

          <div
            data-testid="shop-offers-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {offers.map((offer) => (
              <Card
                key={offer.id}
                padding="md"
                className="bg-white border-border-grey flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-1.5">
                  <Badge tone="yellow">{bi(offer.badgeText)}</Badge>
                  <h3 className="font-heading font-bold text-sm sm:text-base text-dark-ink">
                    {bi(offer.title)}
                  </h3>
                  <p className="text-xs text-muted-text leading-snug">{bi(offer.subtitle)}</p>
                </div>

                <Link
                  to="/"
                  className="inline-flex items-center gap-1 text-xs font-bold text-fresh-green hover:underline min-h-[32px]"
                >
                  <span>{t('shop.orderNow')}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </Card>
            ))}
          </div>
        </section>

        {/* Monthly Combos Banners */}
        <section aria-labelledby="shop-combos-heading" className="space-y-3">
          <div>
            <h2
              id="shop-combos-heading"
              className="font-heading font-bold text-lg sm:text-xl text-dark-ink flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-fresh-green shrink-0" aria-hidden="true" />
              <span>{t('shop.monthlyCombosTitle')}</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-text">
              {t('shop.monthlyCombosSubtitle')}
            </p>
          </div>

          <div
            data-testid="shop-combos-grid"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {individualCombo && (
              <div className="rounded-[12px] bg-warm-yellow text-dark-ink p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[var(--shadow-card)]">
                <div className="space-y-1.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-[8px] bg-dark-ink text-white text-xs font-semibold">
                    {individualCombo.servesPeople}
                  </span>
                  <h3 className="font-heading font-bold text-lg sm:text-xl">
                    {bi(individualCombo.name)}
                  </h3>
                  <p className="text-xs sm:text-sm text-dark-ink/85">
                    {bi(individualCombo.description)}
                  </p>
                  <p className="font-heading font-bold text-2xl tabular-nums pt-0.5">
                    {formatINR(individualCombo.price)}
                  </p>
                </div>
                <Link
                  to="/combo/individual"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-[10px] bg-dark-ink hover:bg-deep-forest text-white text-sm font-semibold shrink-0 transition-colors"
                >
                  <span>{t('shop.orderNow')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            )}

            {familyCombo && (
              <div className="rounded-[12px] bg-dark-ink text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[var(--shadow-card)]">
                <div className="space-y-1.5">
                  <Badge tone="yellow">{familyCombo.servesPeople}</Badge>
                  <h3 className="font-heading font-bold text-lg sm:text-xl">
                    {bi(familyCombo.name)}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/80">
                    {bi(familyCombo.description)}
                  </p>
                  <p className="font-heading font-bold text-2xl text-warm-yellow tabular-nums pt-0.5">
                    {formatINR(familyCombo.price)}
                  </p>
                </div>
                <Link
                  to="/combo/family"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-[10px] bg-fresh-green hover:bg-bright-green text-white text-sm font-semibold shrink-0 transition-colors"
                >
                  <span>{t('shop.orderNow')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Category Chips & Live View-Only Product Grid */}
        <section aria-labelledby="shop-catalogue-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2
                id="shop-catalogue-heading"
                className="font-heading font-bold text-lg sm:text-xl text-dark-ink"
              >
                {t('shop.catalogueTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-muted-text">
                {t('shop.catalogueSubtitle')}
              </p>
            </div>
            <span className="text-xs font-semibold text-muted-text tabular-nums">
              {filteredProducts.length} items
            </span>
          </div>

          {/* Horizontal Scroll / Wrap Category Filter Chips */}
          <div
            role="tablist"
            aria-label={t('nav.categories')}
            data-testid="shop-category-chips"
            className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === 'all'}
              onClick={() => setSelectedCategoryId('all')}
              className={[
                'min-h-[44px] px-4 rounded-[10px] text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors border cursor-pointer',
                selectedCategoryId === 'all'
                  ? 'bg-fresh-green text-white border-fresh-green'
                  : 'bg-white text-dark-ink border-border-grey hover:border-fresh-green',
              ].join(' ')}
            >
              {t('shop.allCategories')}
            </button>

            {categories.map((cat) => {
              const active = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={[
                    'min-h-[44px] px-3.5 rounded-[10px] text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors border cursor-pointer inline-flex items-center gap-2',
                    active
                      ? 'bg-fresh-green text-white border-fresh-green'
                      : 'bg-white text-dark-ink border-border-grey hover:border-fresh-green',
                  ].join(' ')}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${PRODUCT_TINT_CLASSES[cat.tint]} border border-black/10 shrink-0`}
                  />
                  <span>{bi(cat.name)}</span>
                </button>
              );
            })}
          </div>

          {/* View-Only Live Product Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {Array.from({ length: 10 }).map((_, idx) => (
                <Card key={idx} padding="sm" className="h-64 animate-pulse bg-white/80" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card className="text-center py-10 text-sm text-muted-text">
              {t('shop.noProductsInCategory')}
            </Card>
          ) : (
            <div
              data-testid="shop-product-grid"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4"
            >
              {filteredProducts.map((product) => {
                const avail = getTotalAvailableQty(product);
                const isOut = avail <= 0;
                const isLow = avail > 0 && avail <= 5;
                const discount = calculateDiscountPercent(product.mrp, product.price);
                const imgUrl = resolveProductImage(product.image);
                const tintClass = PRODUCT_TINT_CLASSES[product.imageTint];

                return (
                  <Card
                    key={product.id}
                    padding="none"
                    data-testid={`shop-product-${product.id}`}
                    className={[
                      'flex flex-col overflow-hidden transition-shadow',
                      isOut ? 'opacity-75' : 'hover:shadow-[var(--shadow-card-hover)]',
                    ].join(' ')}
                  >
                    <div
                      className={`relative aspect-square w-full ${tintClass} overflow-hidden flex items-center justify-center`}
                    >
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={bi(product.name)}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className={[
                            'w-full h-full object-cover',
                            isOut ? 'grayscale' : '',
                          ].join(' ')}
                        />
                      ) : (
                        <Package className="w-10 h-10 text-fresh-green" aria-hidden="true" />
                      )}

                      {discount > 0 && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-[8px] bg-warm-yellow text-dark-ink text-[11px] font-bold tabular-nums shadow-xs">
                          {t('common.offPercent', { percent: discount })}
                        </span>
                      )}
                    </div>

                    <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-muted-text truncate">
                          {resolveBrandName(product.brandId, brands)} · {product.packSize}
                        </p>
                        <h3 className="font-heading font-semibold text-xs sm:text-sm text-dark-ink line-clamp-2 leading-snug">
                          {bi(product.name)}
                        </h3>

                        {/* Live Stock Chip */}
                        <div className="pt-0.5">
                          {isOut ? (
                            <Badge tone="neutral">{t('common.outOfStock')}</Badge>
                          ) : isLow ? (
                            <Badge tone="red">{t('common.lowStock', { count: avail })}</Badge>
                          ) : (
                            <Badge tone="green">{t('common.inStock')}</Badge>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border-grey/60 flex items-center justify-between gap-2">
                        <div className="flex flex-col leading-tight">
                          <span className="font-heading font-bold text-sm sm:text-base text-dark-ink tabular-nums">
                            {formatINR(product.price)}
                          </span>
                          {product.mrp > product.price && (
                            <span className="text-[11px] text-muted-text line-through tabular-nums">
                              {formatINR(product.mrp)}
                            </span>
                          )}
                        </div>

                        <Link
                          to={`/product/${product.id}`}
                          className="inline-flex items-center justify-center min-h-[38px] px-3 rounded-[8px] bg-light-green hover:bg-fresh-green text-fresh-green hover:text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0"
                        >
                          {t('shop.orderNow')}
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Lightweight Public Footer */}
      <footer className="bg-white border-t border-border-grey mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-muted-text">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-heading font-semibold text-dark-ink">{t('brand.name')}</span>
            <span aria-hidden="true">·</span>
            <span>{t('invoice.storeAddress')}</span>
            <span aria-hidden="true">·</span>
            <a
              href={`tel:${STORE_PHONE_TEL}`}
              className="font-semibold text-fresh-green hover:underline tabular-nums"
            >
              {STORE_PHONE_DISPLAY}
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/shop/poster" className="font-semibold text-fresh-green hover:underline">
              {t('shop.viewPosterLink')}
            </Link>
            <Link to="/" className="font-semibold text-dark-ink hover:text-fresh-green">
              {t('shop.fullStoreLink')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
