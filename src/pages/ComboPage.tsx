import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronRight,
  Info,
  Package,
  ShoppingBag,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
} from '../components/ui';
import { useCart } from '../context/CartContext';
import { useI18n } from '../context/I18nContext';
import {
  calculateComboPricing,
  getBrands,
  getCategories,
  getComboByType,
  getCombos,
  getProducts,
  subscribeToCatalogUpdates,
} from '../services';
import type { Brand, Category, Combo, Product } from '../types';
import { formatINR } from '../utils/format';
import { resolveProductImage } from '../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../utils/tints';

function formatDeltaLabel(delta: number, baseLabel: string): string {
  if (delta === 0) return baseLabel;
  const absFormatted = formatINR(Math.abs(delta));
  return delta > 0 ? `+${absFormatted}` : `-${absFormatted}`;
}

export function ComboPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { t, bi } = useI18n();
  const { addCombo } = useCart();

  const comboType = type === 'family' ? 'family' : 'individual';

  const [combo, setCombo] = useState<Combo | undefined>(undefined);
  const [otherCombo, setOtherCombo] = useState<Combo | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    let active = true;
    const loadComboPage = (isInitial: boolean) => {
      if (isInitial) {
        setIsLoading(true);
        setJustAdded(false);
      }

      void Promise.all([
        getComboByType(comboType),
        getCombos(),
        getProducts({ includeHidden: true }),
        getBrands(),
        getCategories(),
      ]).then(([found, allCombos, prods, brs, cats]) => {
        if (!active) return;
        setCombo(found);
        setOtherCombo(allCombos.find((c) => c.type !== comboType));
        setProducts(prods);
        setBrands(brs);
        setCategories(cats);

        if (found && isInitial) {
          const initialPricing = calculateComboPricing(found, {}, prods, brs);
          setSelections(initialPricing.resolvedSelections);
        }
        setIsLoading(false);
      });
    };

    loadComboPage(true);
    const unsub = subscribeToCatalogUpdates(() => loadComboPage(false));

    return () => {
      active = false;
      unsub();
    };
  }, [comboType]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const pricing = useMemo(() => {
    if (!combo || products.length === 0) return null;
    try {
      return calculateComboPricing(combo, selections, products, brands);
    } catch {
      return calculateComboPricing(combo, {}, products, brands);
    }
  }, [combo, selections, products, brands]);

  const handleBrandChange = (comboItemId: string, nextProductId: string) => {
    setSelections((prev) => ({
      ...prev,
      [comboItemId]: nextProductId,
    }));
  };

  const handleAddComboToCart = async () => {
    if (!combo || !pricing || pricing.isUnavailable) return;
    await addCombo(combo.id, pricing.resolvedSelections, 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  const handleBuyNow = async () => {
    if (!combo || !pricing || pricing.isUnavailable) return;
    await addCombo(combo.id, pricing.resolvedSelections, 1);
    navigate('/checkout');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-[12px] bg-white border border-border-grey/60 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-[12px] bg-white border border-border-grey/60 animate-pulse"
              />
            ))}
          </div>
          <div className="lg:col-span-4 h-72 rounded-[12px] bg-white border border-border-grey/60 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!combo || !pricing) {
    return (
      <Card className="max-w-lg mx-auto text-center py-12 space-y-4">
        <h1 className="font-heading font-bold text-xl text-dark-ink">
          {t('combo.notFound')}
        </h1>
        <Link to="/" className="inline-block">
          <Button variant="primary" size="md">
            {t('product.backHome')}
          </Button>
        </Link>
      </Card>
    );
  }

  const isFamily = combo.type === 'family';

  return (
    <div className="space-y-6 pb-36 lg:pb-0">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-text">
        <Link to="/" className="hover:text-fresh-green font-medium">
          {t('nav.home')}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="text-dark-ink font-semibold truncate">{bi(combo.name)}</span>
      </nav>

      {/* Combo Hero Header */}
      <section
        className={[
          'rounded-[12px] p-5 sm:p-6 shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center justify-between gap-4',
          isFamily
            ? 'bg-dark-ink text-white'
            : 'bg-warm-yellow text-dark-ink',
        ].join(' ')}
      >
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={isFamily ? 'yellow' : 'dark'}
              icon={<Users className="w-3 h-3" />}
            >
              {t('combo.servesLabel', { people: combo.servesPeople })}
            </Badge>
            <Badge tone="green">
              {t('combo.itemsCount', { count: combo.items.length })}
            </Badge>
          </div>

          <h1 className="font-heading font-bold text-2xl sm:text-3xl leading-tight">
            {bi(combo.name)}
          </h1>

          <p
            className={[
              'text-sm sm:text-base leading-relaxed',
              isFamily ? 'text-white/85' : 'text-dark-ink/85',
            ].join(' ')}
          >
            {bi(combo.description)}
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-start md:items-end gap-1">
          <span
            className={[
              'text-xs font-semibold uppercase tracking-wide',
              isFamily ? 'text-white/70' : 'text-dark-ink/75',
            ].join(' ')}
          >
            {t('combo.liveTotal')}
          </span>
          <span
            className={[
              'font-heading font-bold text-3xl tabular-nums',
              isFamily ? 'text-warm-yellow' : 'text-dark-ink',
            ].join(' ')}
          >
            {formatINR(pricing.unitPrice)}
          </span>
          <span
            className={[
              'text-xs font-semibold tabular-nums px-2.5 py-0.5 rounded-[6px]',
              isFamily
                ? 'bg-fresh-green text-white'
                : 'bg-dark-ink text-warm-yellow',
            ].join(' ')}
          >
            {t('combo.savedVsSeparate', {
              amount: formatINR(pricing.savingsVsSeparate),
            })}
          </span>
        </div>
      </section>

      {/* Main Two-Column Builder: Left = 8 Mandatory Items + Switch Card, Right = Desktop Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {/* Mandatory Rule Note & Unavailability Warning */}
          {pricing.isUnavailable && (
            <div
              role="alert"
              data-testid="combo-unavailable-banner"
              className="rounded-[12px] bg-alert-red-soft border border-alert-red/35 px-4 py-3 flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-alert-red"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p>{t('combo.temporarilyUnavailable')}</p>
                <p className="text-xs font-normal text-dark-ink mt-0.5">
                  {t('combo.temporarilyUnavailableDesc')}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-[12px] bg-light-green border border-fresh-green/25 px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm font-medium text-dark-ink">
            <Info className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
            <span>{t('combo.includedRuleNote')}</span>
          </div>

          {/* List of All 8 Combo Items (NO remove button) */}
          <div className="space-y-3">
            {pricing.breakdown.map((entry, idx) => {
              const cat = categoryById.get(entry.product.categoryId);
              const imgUrl = resolveProductImage(entry.product.image);
              const tintClass = PRODUCT_TINT_CLASSES[entry.product.imageTint];

              return (
                <Card
                  key={entry.comboItemId}
                  padding="sm"
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Image Tile */}
                    <div
                      className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[10px] ${tintClass} overflow-hidden flex items-center justify-center shrink-0 border border-border-grey/60`}
                    >
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={bi(entry.groupName)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : cat ? (
                        <CategoryIcon
                          name={cat.icon}
                          className="w-7 h-7 text-fresh-green"
                        />
                      ) : (
                        <Package
                          className="w-7 h-7 text-fresh-green"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* Item Name & Quantity */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-fresh-green bg-light-green px-1.5 py-0.5 rounded tabular-nums">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-muted-text tabular-nums">
                          {t('combo.itemQty', {
                            qty: entry.quantity,
                            unit: entry.unit,
                          })}
                        </span>
                      </div>
                      <h2 className="font-heading font-semibold text-sm sm:text-base text-dark-ink leading-snug">
                        {bi(entry.groupName)}
                      </h2>
                      <p className="text-xs text-muted-text truncate">
                        {bi(entry.product.name)}
                      </p>
                    </div>
                  </div>

                  {/* Preferred Brand Dropdown (NO remove button) */}
                  <div className="sm:w-64 shrink-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`brand-select-${entry.comboItemId}`}
                        className="text-xs font-semibold text-muted-text"
                      >
                        {t('combo.preferredBrandLabel')}
                      </label>
                      {entry.deltaFromDefault !== 0 && (
                        <span
                          className={[
                            'text-[11px] font-bold tabular-nums',
                            entry.deltaFromDefault > 0
                              ? 'text-dark-ink'
                              : 'text-fresh-green',
                          ].join(' ')}
                        >
                          {formatDeltaLabel(
                            entry.deltaFromDefault,
                            t('combo.baseIncluded'),
                          )}
                        </span>
                      )}
                    </div>

                    {entry.isUnavailable && (
                      <Badge tone="red">{t('combo.itemAllBrandsOut')}</Badge>
                    )}

                    {combo.customerCanChangeBrand === false ? (
                      <div className="w-full min-h-[44px] px-3 rounded-[10px] border border-border-grey bg-soft-grey/80 text-xs sm:text-sm font-semibold text-dark-ink flex items-center justify-between gap-2">
                        <span>{entry.brandName}</span>
                        <span className="text-[11px] font-medium text-muted-text">
                          {t('combo.brandLockedNote')}
                        </span>
                      </div>
                    ) : (
                      <select
                        id={`brand-select-${entry.comboItemId}`}
                        aria-label={`${bi(entry.groupName)} ${t('combo.preferredBrandLabel')}`}
                        value={entry.product.id}
                        disabled={entry.isUnavailable}
                        onChange={(e) =>
                          handleBrandChange(entry.comboItemId, e.target.value)
                        }
                        className="w-full min-h-[44px] px-3 rounded-[10px] border border-border-grey bg-soft-grey text-xs sm:text-sm font-semibold text-dark-ink focus:bg-white focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {entry.options.map((opt) => (
                          <option
                            key={opt.product.id}
                            value={opt.product.id}
                            disabled={opt.isOutOfStock}
                          >
                            {opt.brandName} (
                            {formatDeltaLabel(
                              opt.deltaFromDefault,
                              t('combo.baseIncluded'),
                            )}
                            ){opt.isOutOfStock ? ` — ${t('combo.brandOutOfStockOption')}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Switch Card Linking to the Other Combo */}
          {otherCombo && (
            <Card
              padding="md"
              className={[
                'flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2',
                otherCombo.type === 'family'
                  ? 'bg-dark-ink text-white border-dark-ink'
                  : 'bg-warm-yellow/25 text-dark-ink border-warm-yellow',
              ].join(' ')}
            >
              <div className="space-y-1">
                <span
                  className={[
                    'text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5',
                    otherCombo.type === 'family'
                      ? 'text-warm-yellow'
                      : 'text-fresh-green',
                  ].join(' ')}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('combo.switchTitle')}</span>
                </span>
                <h2 className="font-heading font-bold text-base sm:text-lg">
                  {bi(otherCombo.name)} ·{' '}
                  <span className="tabular-nums">
                    {formatINR(otherCombo.price)}
                  </span>
                </h2>
                <p
                  className={[
                    'text-xs sm:text-sm',
                    otherCombo.type === 'family'
                      ? 'text-white/80'
                      : 'text-muted-text',
                  ].join(' ')}
                >
                  {t('combo.servesLabel', { people: otherCombo.servesPeople })} ·{' '}
                  {t('combo.itemsCount', { count: otherCombo.items.length })}
                </p>
              </div>

              <Link
                to={`/combo/${otherCombo.type}`}
                className="shrink-0 inline-block"
              >
                <Button
                  variant={otherCombo.type === 'family' ? 'yellow' : 'primary'}
                  size="md"
                  rightIcon={<ArrowLeftRight className="w-4 h-4" />}
                >
                  {otherCombo.type === 'family'
                    ? t('combo.switchToFamily')
                    : t('combo.switchToIndividual')}
                </Button>
              </Link>
            </Card>
          )}
        </div>

        {/* Desktop Right Sticky Summary Card */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-[88px]">
          <Card padding="lg" className="space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-grey/70">
              <h2 className="font-heading font-bold text-lg text-dark-ink">
                {t('combo.summaryTitle')}
              </h2>
              <Badge tone="green">
                {t('combo.itemsCount', { count: combo.items.length })}
              </Badge>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-muted-text">
                <span>{t('combo.separateTotal')}</span>
                <span className="line-through tabular-nums">
                  {formatINR(pricing.separateItemsTotal)}
                </span>
              </div>

              {pricing.priceDelta !== 0 && (
                <div className="flex items-center justify-between text-dark-ink">
                  <span>{t('combo.brandAdjustment')}</span>
                  <span
                    className={[
                      'font-semibold tabular-nums',
                      pricing.priceDelta < 0 ? 'text-fresh-green' : '',
                    ].join(' ')}
                  >
                    {formatDeltaLabel(pricing.priceDelta, t('combo.baseIncluded'))}
                  </span>
                </div>
              )}

              <div className="pt-2.5 border-t border-border-grey/70 flex items-baseline justify-between">
                <span className="font-heading font-bold text-base text-dark-ink">
                  {t('combo.liveTotal')}
                </span>
                <span
                  data-testid="combo-live-total"
                  className="font-heading font-bold text-2xl text-dark-ink tabular-nums"
                >
                  {formatINR(pricing.unitPrice)}
                </span>
              </div>
            </div>

            {/* Savings Pill */}
            <div className="rounded-[10px] bg-warm-yellow/35 border border-warm-yellow px-3.5 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-bold text-dark-ink">
              <Sparkles className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
              <span data-testid="combo-savings-label" className="tabular-nums">
                {t('combo.savedVsSeparate', {
                  amount: formatINR(pricing.savingsVsSeparate),
                })}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              {pricing.isUnavailable && (
                <div className="rounded-[10px] bg-alert-red-soft border border-alert-red/30 px-3 py-2 text-xs font-bold text-alert-red text-center">
                  {t('combo.temporarilyUnavailable')}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={pricing.isUnavailable}
                onClick={() => void handleAddComboToCart()}
                leftIcon={
                  justAdded ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <ShoppingBag className="w-4 h-4" />
                  )
                }
              >
                {pricing.isUnavailable
                  ? t('combo.temporarilyUnavailable')
                  : justAdded
                    ? t('combo.addedComboToCart')
                    : t('combo.addComboToCart')}
              </Button>

              <Button
                variant="yellow"
                size="lg"
                fullWidth
                disabled={pricing.isUnavailable}
                onClick={() => void handleBuyNow()}
                leftIcon={<Zap className="w-4 h-4" />}
              >
                {t('combo.buyNow')}
              </Button>
            </div>

            <p className="text-xs text-muted-text text-center">
              {t('product.deliveryNote')}
            </p>
          </Card>
        </aside>
      </div>

      {/* Mobile Fixed Bottom Summary Bar */}
      <div className="lg:hidden fixed bottom-[60px] left-0 right-0 z-35 bg-white/95 backdrop-blur-md border-t border-border-grey px-3.5 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span
                data-testid="combo-mobile-total"
                className="font-heading font-bold text-lg text-dark-ink tabular-nums leading-tight"
              >
                {formatINR(pricing.unitPrice)}
              </span>
              <span className="text-xs text-muted-text line-through tabular-nums">
                {formatINR(pricing.separateItemsTotal)}
              </span>
            </div>
            <p className="text-xs font-semibold text-fresh-green text-right truncate tabular-nums">
              {pricing.isUnavailable
                ? t('combo.temporarilyUnavailable')
                : t('combo.savedVsSeparate', {
                    amount: formatINR(pricing.savingsVsSeparate),
                  })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="sm"
              fullWidth
              disabled={pricing.isUnavailable}
              onClick={() => void handleAddComboToCart()}
              leftIcon={
                justAdded ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : (
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                )
              }
            >
              <span className="truncate">
                {pricing.isUnavailable
                  ? t('combo.temporarilyUnavailable')
                  : justAdded
                    ? t('combo.addedComboToCart')
                    : t('combo.addComboToCart')}
              </span>
            </Button>

            <Button
              variant="yellow"
              size="sm"
              fullWidth
              disabled={pricing.isUnavailable}
              onClick={() => void handleBuyNow()}
              leftIcon={<Zap className="w-4 h-4 shrink-0" />}
            >
              {t('combo.buyNow')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
