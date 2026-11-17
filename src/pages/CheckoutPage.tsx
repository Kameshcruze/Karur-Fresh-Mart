import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  ShoppingBag,
  Smartphone,
  Sun,
  Sunrise,
  Wallet,
} from 'lucide-react';
import { CheckoutAddressMap } from '../components/checkout/CheckoutAddressMap';
import { RazorpayMockModal } from '../components/checkout/RazorpayMockModal';
import { Badge, Button, Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useI18n } from '../context/I18nContext';
import { createPaymentOrder, placeOrder } from '../services';
import type {
  DeliverySlotId,
  Order,
  PaymentMethod,
  PaymentOrder,
  PaymentVerificationResult,
} from '../types';
import { formatINR } from '../utils/format';
import { checkServiceArea } from '../utils/geo';

export function CheckoutPage() {
  const { t, bi } = useI18n();
  const { user, addresses, defaultAddress, deliverySettings } = useAuth();
  const { summary, setDeliverySlot, refresh: refreshCart } = useCart();

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState<PaymentOrder | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    if (!selectedAddressId && (defaultAddress || addresses[0])) {
      setSelectedAddressId((defaultAddress ?? addresses[0]).id);
    }
  }, [addresses, defaultAddress, selectedAddressId]);

  const selectedAddress =
    addresses.find((a) => a.id === selectedAddressId) ?? defaultAddress ?? addresses[0];

  const slotLabel = (slot: DeliverySlotId) => {
    switch (slot) {
      case 'today_evening':
        return `${t('cart.slotTodayEvening')} (${t('cart.slotTodayEveningDesc')})`;
      case 'tomorrow_morning':
        return `${t('cart.slotTomorrowMorning')} (${t('cart.slotTomorrowMorningDesc')})`;
      default:
        return `${t('cart.slot45Min')} (${t('cart.slot45MinDesc')})`;
    }
  };

  const paymentOptions: Array<{
    id: PaymentMethod;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'upi',
      title: t('checkout.payUpi'),
      desc: t('checkout.payUpiDesc'),
      icon: <Smartphone className="w-5 h-5 text-fresh-green" aria-hidden="true" />,
    },
    {
      id: 'card',
      title: t('checkout.payCard'),
      desc: t('checkout.payCardDesc'),
      icon: <CreditCard className="w-5 h-5 text-fresh-green" aria-hidden="true" />,
    },
    {
      id: 'netbanking',
      title: t('checkout.payNetBanking'),
      desc: t('checkout.payNetBankingDesc'),
      icon: <Building2 className="w-5 h-5 text-fresh-green" aria-hidden="true" />,
    },
    {
      id: 'wallet',
      title: t('checkout.payWallet'),
      desc: t('checkout.payWalletDesc'),
      icon: <Wallet className="w-5 h-5 text-fresh-green" aria-hidden="true" />,
    },
    {
      id: 'cod',
      title: t('checkout.payCod'),
      desc: t('checkout.payCodDesc'),
      icon: <Banknote className="w-5 h-5 text-dark-ink" aria-hidden="true" />,
    },
  ];

  const selectedMethodMeta =
    paymentOptions.find((p) => p.id === paymentMethod) ?? paymentOptions[0];

  const finalizeOrder = async (
    method: PaymentMethod,
    verification?: PaymentVerificationResult,
  ) => {
    if (!selectedAddress || !user) return;
    setIsPlacing(true);
    setCheckoutError('');
    try {
      const created = await placeOrder({
        userId: user.id,
        customerName: selectedAddress.recipientName || user.name,
        customerMobile: selectedAddress.mobile || user.mobile,
        address: selectedAddress,
        paymentMethod: method,
        deliverySlot: summary.deliverySlot,
        transactionRef: verification?.transactionRef,
      });
      await refreshCart();
      setPendingPaymentOrder(null);
      setPlacedOrder(created);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t('checkout.placeOrderErrorFallback'));
    } finally {
      setIsPlacing(false);
    }
  };

  const handlePayAndPlaceOrder = async () => {
    setCheckoutError('');
    if (!selectedAddress || !user) {
      setCheckoutError(t('checkout.noAddressSubtitle'));
      return;
    }

    if (paymentMethod === 'cod') {
      await finalizeOrder('cod');
      return;
    }

    setIsPlacing(true);
    try {
      const paymentOrder = await createPaymentOrder({
        amount: summary.grandTotal,
        method: paymentMethod,
        userId: user.id,
        customerName: selectedAddress.recipientName || user.name,
        customerMobile: selectedAddress.mobile || user.mobile,
      });
      setPendingPaymentOrder(paymentOrder);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t('checkout.initiatePaymentErrorFallback'));
    } finally {
      setIsPlacing(false);
    }
  };

  // Order Confirmation Success Screen
  if (placedOrder) {
    return (
      <div className="max-w-xl mx-auto">
        <Card padding="lg" data-testid="order-success-card" className="text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-light-green text-fresh-green mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <Badge tone="green">{t('checkout.successBadge')}</Badge>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink pt-1">
              {t('checkout.successTitle')}
            </h1>
          </div>

          <div className="rounded-[12px] bg-soft-grey border border-border-grey/80 p-4 text-left space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-text">{t('checkout.successOrderNumber')}</span>
              <span
                data-testid="success-order-id"
                className="font-heading font-bold text-base text-dark-ink tabular-nums"
              >
                {placedOrder.id}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-text">{t('checkout.successEta')}</span>
              <span className="font-semibold text-dark-ink text-right">
                {slotLabel(placedOrder.deliverySlot ?? '45min')}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-text">{t('checkout.successPaymentInfo')}</span>
              <span className="font-semibold text-fresh-green text-right">
                {placedOrder.payment.status === 'paid' && placedOrder.payment.transactionRef
                  ? t('checkout.paidViaRef', { ref: placedOrder.payment.transactionRef })
                  : t('checkout.codPending')}
              </span>
            </div>

            <div className="pt-2 border-t border-border-grey/70 flex items-center justify-between gap-2">
              <span className="font-semibold text-dark-ink">
                {placedOrder.payment.status === 'paid'
                  ? t('checkout.successTotalPaid')
                  : t('checkout.successOrderTotal')}
              </span>
              <span className="font-heading font-bold text-lg text-dark-ink tabular-nums">
                {formatINR(placedOrder.total)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <Link to={`/orders/${placedOrder.id}`} className="w-full sm:flex-1">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('checkout.trackOrder')}
              </Button>
            </Link>
            <Link to="/" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" fullWidth>
                {t('checkout.continueShopping')}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Empty Basket Fallback
  if (summary.lines.length === 0) {
    return (
      <Card className="max-w-lg mx-auto text-center py-12 space-y-4">
        <div className="w-14 h-14 rounded-[12px] bg-light-green text-fresh-green mx-auto flex items-center justify-center">
          <ShoppingBag className="w-7 h-7" aria-hidden="true" />
        </div>
        <h1 className="font-heading font-bold text-xl text-dark-ink">
          {t('checkout.emptyCheckoutTitle')}
        </h1>
        <p className="text-sm text-muted-text">{t('checkout.emptyCheckoutSubtitle')}</p>
        <Link to="/" className="inline-block">
          <Button variant="primary" size="md">
            {t('checkout.browseStore')}
          </Button>
        </Link>
      </Card>
    );
  }

  const areaStatus = selectedAddress
    ? checkServiceArea(selectedAddress.lat, selectedAddress.lng, deliverySettings)
    : null;

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-fresh-green hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('checkout.backToCart')}</span>
          </Link>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink">
            {t('checkout.title')}
          </h1>
          <p className="text-sm text-muted-text mt-0.5">{t('checkout.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Address + Mini Map, Slot, Payment Choices */}
        <div className="lg:col-span-8 space-y-5">
          {/* 1. Selected Delivery Address + Small Map */}
          <Card padding="md" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-fresh-green shrink-0" aria-hidden="true" />
                <h2 className="font-heading font-bold text-lg text-dark-ink">
                  {t('checkout.addressTitle')}
                </h2>
              </div>
              <Link
                to="/addresses"
                className="text-xs sm:text-sm font-semibold text-fresh-green hover:underline min-h-[36px] inline-flex items-center"
              >
                {t('checkout.changeAddress')}
              </Link>
            </div>

            {!selectedAddress ? (
              <div className="rounded-[10px] bg-soft-grey border border-border-grey p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-dark-ink">
                    {t('checkout.noAddressTitle')}
                  </p>
                  <p className="text-xs text-muted-text mt-0.5">
                    {t('checkout.noAddressSubtitle')}
                  </p>
                </div>
                <Link to="/addresses">
                  <Button variant="primary" size="sm">
                    {t('checkout.addAddressCta')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-6 space-y-2.5">
                  {addresses.map((addr) => {
                    const active = addr.id === selectedAddress.id;
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={[
                          'w-full p-3 rounded-[10px] border text-left transition-colors cursor-pointer space-y-1',
                          active
                            ? 'bg-light-green border-fresh-green ring-1 ring-fresh-green/25'
                            : 'bg-soft-grey border-border-grey hover:border-fresh-green/60',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge tone={addr.label === 'Work' ? 'yellow' : 'green'}>
                            {addr.label}
                          </Badge>
                          <span className="text-[11px] font-medium text-muted-text tabular-nums">
                            {addr.pincode}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-dark-ink">
                          {addr.door}, {addr.street}
                        </p>
                        <p className="text-xs text-muted-text">{addr.landmark}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="md:col-span-6 space-y-2">
                  <CheckoutAddressMap
                    lat={selectedAddress.lat}
                    lng={selectedAddress.lng}
                    deliverySettings={deliverySettings}
                  />

                  {areaStatus && !areaStatus.inServiceArea && (
                    <div
                      role="alert"
                      className="rounded-[8px] bg-alert-red-soft border border-alert-red/30 px-3 py-2 flex items-start gap-2 text-xs font-medium text-alert-red"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        {t('checkout.outsideZoneNotice', {
                          radius: areaStatus.radiusKm,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* 2. Delivery Slot */}
          <Card padding="md" className="space-y-3">
            <h2 className="font-heading font-bold text-lg text-dark-ink">
              {t('checkout.slotTitle')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
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
                ] as const
              ).map((slot) => {
                const selected = summary.deliverySlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => void setDeliverySlot(slot.id)}
                    className={[
                      'p-3 rounded-[10px] border text-left transition-colors min-h-[64px] cursor-pointer space-y-1',
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

          {/* 3. Payment Method Selection */}
          <Card padding="md" className="space-y-3">
            <h2 className="font-heading font-bold text-lg text-dark-ink">
              {t('checkout.paymentTitle')}
            </h2>

            <div className="space-y-2.5">
              {paymentOptions.map((opt) => {
                const selected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={selected}
                    data-testid={`payment-method-${opt.id}`}
                    onClick={() => setPaymentMethod(opt.id)}
                    className={[
                      'w-full p-3.5 rounded-[10px] border text-left transition-colors flex items-center justify-between gap-3 min-h-[56px] cursor-pointer',
                      selected
                        ? 'bg-light-green border-fresh-green ring-1 ring-fresh-green/25'
                        : 'bg-soft-grey border-border-grey hover:border-fresh-green/60',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-[8px] bg-white border border-border-grey/70 flex items-center justify-center shrink-0">
                        {opt.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="font-heading font-semibold text-sm text-dark-ink">
                          {opt.title}
                        </p>
                        <p className="text-xs text-muted-text">{opt.desc}</p>
                      </div>
                    </div>

                    <span
                      aria-hidden="true"
                      className={[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                        selected ? 'border-fresh-green bg-fresh-green' : 'border-border-grey bg-white',
                      ].join(' ')}
                    >
                      {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Order Summary & Pay CTA */}
        <aside className="lg:col-span-4 lg:sticky lg:top-[88px]">
          <Card padding="lg" className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-dark-ink pb-3 border-b border-border-grey/70">
              {t('checkout.orderSummaryTitle')}
            </h2>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {summary.lines.map((line) => (
                <div
                  key={line.cartItem.lineId}
                  className="flex items-start justify-between gap-2 text-xs sm:text-sm"
                >
                  <span className="text-dark-ink min-w-0 flex-1">
                    {bi(line.title)}{' '}
                    <span className="text-muted-text tabular-nums">
                      × {line.cartItem.quantity}
                    </span>
                  </span>
                  <span className="font-semibold text-dark-ink tabular-nums shrink-0">
                    {formatINR(line.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border-grey/70 space-y-2 text-sm">
              <div className="flex items-center justify-between text-dark-ink">
                <span>{t('cart.itemTotal')}</span>
                <span className="font-semibold tabular-nums">
                  {formatINR(summary.subtotal)}
                </span>
              </div>

              {summary.couponDiscount > 0 && summary.couponCode && (
                <div className="flex items-center justify-between text-fresh-green">
                  <span>{t('cart.couponDiscount', { code: summary.couponCode })}</span>
                  <span className="font-semibold tabular-nums">
                    -{formatINR(summary.couponDiscount)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-dark-ink">
                <span>{t('cart.deliveryFee')}</span>
                <span className="font-semibold tabular-nums">
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
                  data-testid="checkout-grand-total"
                  className="font-heading font-bold text-2xl text-dark-ink tabular-nums"
                >
                  {formatINR(summary.grandTotal)}
                </span>
              </div>
            </div>

            {checkoutError && (
              <p role="alert" className="text-xs font-medium text-alert-red">
                {checkoutError}
              </p>
            )}

            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isPlacing || !selectedAddress}
              onClick={() => void handlePayAndPlaceOrder()}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isPlacing ? t('checkout.processingPayment') : t('checkout.payAndPlaceOrder')}
            </Button>
          </Card>
        </aside>
      </div>

      {/* Mobile Fixed Pay CTA */}
      <div className="lg:hidden fixed bottom-[60px] left-0 right-0 z-35 bg-white/95 backdrop-blur-md border-t border-border-grey px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-muted-text">{t('cart.grandTotal')}</p>
          <p className="font-heading font-bold text-lg text-dark-ink tabular-nums leading-tight">
            {formatINR(summary.grandTotal)}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={isPlacing || !selectedAddress}
          onClick={() => void handlePayAndPlaceOrder()}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {t('checkout.payAndPlaceOrder')}
        </Button>
      </div>

      {/* Razorpay-Style Mock Payment Gateway Modal */}
      {pendingPaymentOrder && (
        <RazorpayMockModal
          paymentOrder={pendingPaymentOrder}
          methodLabel={selectedMethodMeta.title}
          onSuccess={(verification) => finalizeOrder(paymentMethod, verification)}
          onSwitchToCod={() => {
            setPaymentMethod('cod');
            return finalizeOrder('cod');
          }}
          onClose={() => setPendingPaymentOrder(null)}
        />
      )}
    </div>
  );
}
