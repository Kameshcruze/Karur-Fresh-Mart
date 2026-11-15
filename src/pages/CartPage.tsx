import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  ShoppingBag,
  Sun,
  Sunrise,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { ComboCartLine } from '../components/cart/ComboCartLine';
import { Button, Card, Stepper } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useI18n } from '../context/I18nContext';
import { getCoupons } from '../services';
import type { Coupon, DeliverySlotId } from '../types';
import { formatINR } from '../utils/format';
import { resolveProductImage } from '../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../utils/tints';

export function CartPage() {
  const { t, bi } = useI18n();
  const { deliverySettings } = useAuth();
  const {
    summary,
    updateLineQuantity,
    updateComboBrand,
    removeLine,
    setDeliverySlot,
    applyCoupon,
    clearCoupon,
    refresh,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    void getCoupons().then((list) => setAvailableCoupons(list.filter((c) => c.active)));
    void refresh();
  }, [refresh]);

  const enabledSlotIds: DeliverySlotId[] =
    deliverySettings.enabledSlots && deliverySettings.enabledSlots.length > 0
      ? deliverySettings.enabledSlots
      : ['45min', 'today_evening', 'tomorrow_morning'];

  useEffect(() => {
    if (
      summary.lines.length > 0 &&
      !enabledSlotIds.includes(summary.deliverySlot)
    ) {
      void setDeliverySlot(enabledSlotIds[0]);
    }
  }, [enabledSlotIds, setDeliverySlot, summary.deliverySlot, summary.lines.length]);

  if (summary.lines.length === 0) {
    return (
      <Card className="max-w-lg mx-auto text-center py-12 space-y-4">
        <div className="w-14 h-14 rounded-[12px] bg-light-green text-fresh-green mx-auto flex items-center justify-center">
          <ShoppingBag className="w-7 h-7" aria-hidden="true" />
        </div>
        <h1 className="font-heading font-bold text-xl text-dark-ink">
          {t('cart.emptyTitle')}
        </h1>
        <p className="text-sm text-muted-text">{t('cart.emptySubtitle')}</p>
        <Link to="/" className="inline-block">
          <Button variant="primary" size="md">
            {t('cart.browseHome')}
          </Button>
        </Link>
      </Card>
    );
  }

  const netBeforeDelivery = Math.max(0, summary.subtotal - summary.couponDiscount);
  const freeProgressPercent = Math.min(
    100,
    Math.round((netBeforeDelivery / summary.freeDeliveryThreshold) * 100),
  );
  const freeUnlocked = summary.amountToFreeDelivery <= 0;

  const handleApplyCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    const trimmed = couponInput.trim().toUpperCase();
    if (!trimmed) return;
    const res = await applyCoupon(trimmed);
    if (!res.valid) {
      setCouponError(res.reason ?? 'Invalid coupon code.');
    } else {
      setCouponInput('');
    }
  };

  const handleQuickApplyCoupon = async (code: string) => {
    setCouponError('');
    const res = await applyCoupon(code);
    if (!res.valid) {
      setCouponError(res.reason ?? 'Coupon cannot be applied.');
    }
  };

  const allSlotOptions: Array<{
    id: DeliverySlotId;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: '45min',
      title: t('cart.slot45Min'),
      desc: t('cart.slot45MinDesc'),
      icon: <Clock className="w-4 h-4 text-fresh-green" aria-hidden="true" />,
    },
    {
      id: 'today_evening',
      title: t('cart.slotTodayEvening'),
      desc: t('cart.slotTodayEveningDesc'),
      icon: <Sun className="w-4 h-4 text-warm-yellow" aria-hidden="true" />,
    },
    {
      id: 'tomorrow_morning',
      title: t('cart.slotTomorrowMorning'),
      desc: t('cart.slotTomorrowMorningDesc'),
      icon: <Sunrise className="w-4 h-4 text-fresh-green" aria-hidden="true" />,
    },
  ];
  const slotOptions = allSlotOptions.filter((slot) => enabledSlotIds.includes(slot.id));

  const totalOrderSavings = summary.productSavings + summary.couponDiscount;
  const hasUnavailableCombo = summary.lines.some((l) => l.comboTemporarilyUnavailable);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink">
          {t('cart.title')}
        </h1>
        <span className="text-sm font-semibold text-muted-text tabular-nums">
          {summary.totalUnits === 1
            ? t('common.itemCountSingle')
            : t('common.itemCountPlural', { count: summary.totalUnits })}
        </span>
      </div>

      {/* Free Delivery Progress Bar (Free above Rs 499) */}
      <Card
        padding="md"
        className={freeUnlocked ? 'bg-light-green border-fresh-green/30' : ''}
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <div className="flex items-center gap-2 text-dark-ink">
              {freeUnlocked ? (
                <CheckCircle2 className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
              ) : (
                <Truck className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
              )}
              <span data-testid="free-delivery-banner" className="tabular-nums">
                {freeUnlocked
                  ? t('cart.freeDeliveryUnlocked')
                  : t('cart.freeDeliveryRemaining', {
                      amount: formatINR(summary.amountToFreeDelivery),
                    })}
              </span>
            </div>
            <span className="text-xs font-bold text-fresh-green tabular-nums shrink-0">
              {freeProgressPercent}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={freeProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-2.5 rounded-full bg-border-grey/50 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-fresh-green transition-all duration-300"
              style={{ width: `${freeProgressPercent}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Cart Lines + Delivery Slot */}
        <div className="lg:col-span-8 space-y-4">
          {summary.lines.map((line) => {
            if (line.cartItem.kind === 'combo') {
              return (
                <ComboCartLine
                  key={line.cartItem.lineId}
                  line={line}
                  onQuantityChange={(lineId, qty) => void updateLineQuantity(lineId, qty)}
                  onBrandChange={(lineId, itemId, prodId) =>
                    void updateComboBrand(lineId, itemId, prodId)
                  }
                  onRemoveCombo={(lineId) => void removeLine(lineId)}
                />
              );
            }

            const imgUrl = resolveProductImage(line.image);
            const tintClass = PRODUCT_TINT_CLASSES[line.imageTint];

            return (
              <Card
                key={line.cartItem.lineId}
                padding="md"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <Link
                    to={`/product/${line.cartItem.productId ?? ''}`}
                    className={`w-16 h-16 rounded-[10px] ${tintClass} overflow-hidden flex items-center justify-center shrink-0 border border-border-grey/60`}
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={bi(line.title)}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-fresh-green" aria-hidden="true" />
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/product/${line.cartItem.productId ?? ''}`}
                      className="font-heading font-semibold text-sm sm:text-base text-dark-ink hover:text-fresh-green line-clamp-1"
                    >
                      {bi(line.title)}
                    </Link>
                    <p className="text-xs text-muted-text mt-0.5">{line.subtitle}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-sm font-bold text-dark-ink tabular-nums">
                        {formatINR(line.lineTotal)}
                      </span>
                      {line.lineMrpTotal > line.lineTotal && (
                        <span className="text-xs text-muted-text line-through tabular-nums">
                          {formatINR(line.lineMrpTotal)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                  <Stepper
                    value={line.cartItem.quantity}
                    min={0}
                    max={50}
                    itemName={bi(line.title)}
                    onIncrement={() =>
                      void updateLineQuantity(
                        line.cartItem.lineId,
                        line.cartItem.quantity + 1,
                      )
                    }
                    onDecrement={() =>
                      void updateLineQuantity(
                        line.cartItem.lineId,
                        line.cartItem.quantity - 1,
                      )
                    }
                    compact
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('common.remove')} ${bi(line.title)}`}
                    onClick={() => void removeLine(line.cartItem.lineId)}
                    className="text-alert-red hover:bg-alert-red/10 px-2"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            );
          })}

          {/* Delivery Slot Chooser */}
          <Card padding="md" className="space-y-3">
            <h2 className="font-heading font-bold text-base text-dark-ink">
              {t('cart.deliverySlotTitle')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {slotOptions.map((slot) => {
                const selected = summary.deliverySlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => void setDeliverySlot(slot.id)}
                    className={[
                      'p-3 rounded-[10px] border text-left transition-colors min-h-[68px] cursor-pointer flex flex-col justify-between gap-1',
                      selected
                        ? 'bg-light-green border-fresh-green ring-1 ring-fresh-green/25'
                        : 'bg-soft-grey border-border-grey hover:border-fresh-green/60',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      {slot.icon}
                      <span className="font-heading font-semibold text-sm text-dark-ink">
                        {slot.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-text">{slot.desc}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Coupon + Bill Summary */}
        <aside className="lg:col-span-4 lg:sticky lg:top-[88px] space-y-4">
          {/* Coupon Box */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
              <h2 className="font-heading font-bold text-base text-dark-ink">
                {t('cart.couponTitle')}
              </h2>
            </div>

            {summary.couponCode ? (
              <div className="rounded-[10px] bg-light-green border border-fresh-green/30 px-3.5 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-fresh-green leading-snug tabular-nums">
                    {t('cart.couponApplied', {
                      code: summary.couponCode,
                      amount: formatINR(summary.couponDiscount),
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void clearCoupon()}
                  aria-label={t('cart.couponRemove')}
                  className="min-h-[36px] px-2 text-xs font-semibold text-alert-red hover:bg-alert-red/10 rounded-[8px] inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('cart.couponRemove')}</span>
                </button>
              </div>
            ) : (
              <>
                <form
                  onSubmit={(e) => void handleApplyCouponSubmit(e)}
                  className="flex items-stretch gap-2"
                >
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      if (couponError) setCouponError('');
                    }}
                    placeholder={t('cart.couponPlaceholder')}
                    aria-label={t('cart.couponTitle')}
                    className="flex-1 min-w-0 min-h-[44px] px-3 rounded-[10px] bg-soft-grey border border-border-grey text-sm font-semibold uppercase text-dark-ink placeholder:normal-case placeholder:font-normal placeholder:text-muted-text focus:bg-white focus:outline-none focus:border-fresh-green"
                  />
                  <Button type="submit" variant="secondary" size="md">
                    {t('cart.couponApply')}
                  </Button>
                </form>

                {couponError && (
                  <p role="alert" className="text-xs font-medium text-alert-red">
                    {couponError}
                  </p>
                )}

                {availableCoupons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {availableCoupons.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => void handleQuickApplyCoupon(c.code)}
                        className="px-2.5 py-1 rounded-[8px] border border-dashed border-fresh-green/50 bg-light-green/60 hover:bg-light-green text-[11px] font-bold text-fresh-green cursor-pointer min-h-[32px]"
                      >
                        {c.code}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Bill Summary */}
          <Card padding="lg" className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-dark-ink pb-3 border-b border-border-grey/70">
              {t('cart.billSummary')}
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-dark-ink">
                <span>{t('cart.itemTotal')}</span>
                <span data-testid="cart-item-total" className="font-semibold tabular-nums">
                  {formatINR(summary.subtotal)}
                </span>
              </div>

              {summary.couponDiscount > 0 && summary.couponCode && (
                <div className="flex items-center justify-between text-fresh-green">
                  <span>
                    {t('cart.couponDiscount', { code: summary.couponCode })}
                  </span>
                  <span
                    data-testid="cart-coupon-discount"
                    className="font-semibold tabular-nums"
                  >
                    -{formatINR(summary.couponDiscount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-dark-ink">
                <span>{t('cart.deliveryFee')}</span>
                <span data-testid="cart-delivery-fee" className="font-semibold tabular-nums">
                  {summary.deliveryFee === 0 ? (
                    <span className="text-fresh-green">{t('cart.free')}</span>
                  ) : (
                    formatINR(summary.deliveryFee)
                  )}
                </span>
              </div>

              <div className="pt-3 border-t border-border-grey/70 flex items-baseline justify-between">
                <span className="font-heading font-bold text-base text-dark-ink">
                  {t('cart.grandTotal')}
                </span>
                <span
                  data-testid="cart-grand-total"
                  className="font-heading font-bold text-2xl text-dark-ink tabular-nums"
                >
                  {formatINR(summary.grandTotal)}
                </span>
              </div>

              {totalOrderSavings > 0 && (
                <div className="rounded-[8px] bg-light-green border border-fresh-green/20 px-3 py-2 flex items-center justify-between text-xs font-semibold text-fresh-green">
                  <span>{t('cart.bundleSavings')}</span>
                  <span className="tabular-nums">{formatINR(totalOrderSavings)}</span>
                </div>
              )}
            </div>

            {hasUnavailableCombo ? (
              <div className="space-y-2 pt-1">
                <p
                  role="alert"
                  className="text-xs font-semibold text-alert-red bg-alert-red-soft rounded-[8px] px-3 py-2"
                >
                  {t('combo.temporarilyUnavailableDesc')}
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('combo.temporarilyUnavailable')}
                </Button>
              </div>
            ) : (
              <Link to="/checkout" className="block pt-1">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('cart.proceedToCheckout')}
                </Button>
              </Link>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
