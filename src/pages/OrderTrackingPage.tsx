import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  KeyRound,
  MapPin,
  Navigation,
  Package,
  Phone,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
  UserCheck,
} from 'lucide-react';
import { OrderStatusBadge } from '../components/orders/OrderStatusBadge';
import { Badge, Button, Card } from '../components/ui';
import { useCart } from '../context/CartContext';
import { useI18n } from '../context/I18nContext';
import {
  getOrderById,
  reorderOrder,
  subscribeToOrderUpdates,
} from '../services';
import type { Order, OrderStatus } from '../types';
import { formatINR } from '../utils/format';
import { buildGoogleMapsNavUrl } from '../utils/geo';
import { resolveProductImage } from '../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../utils/tints';

const TIMELINE_STEPS: Array<{
  status: Exclude<OrderStatus, 'cancelled'>;
  labelKey:
    | 'orders.statusPlaced'
    | 'orders.statusPacked'
    | 'orders.statusPickedUp'
    | 'orders.statusOutForDelivery'
    | 'orders.statusDelivered';
}> = [
  { status: 'placed', labelKey: 'orders.statusPlaced' },
  { status: 'packed', labelKey: 'orders.statusPacked' },
  { status: 'picked_up', labelKey: 'orders.statusPickedUp' },
  { status: 'out_for_delivery', labelKey: 'orders.statusOutForDelivery' },
  { status: 'delivered', labelKey: 'orders.statusDelivered' },
];

const STATUS_INDEX: Record<Exclude<OrderStatus, 'cancelled'>, number> = {
  placed: 0,
  packed: 1,
  picked_up: 2,
  out_for_delivery: 3,
  delivered: 4,
};

function formatDateTime(iso?: string, locale = 'en-IN'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function resolveStepTimestamp(
  order: Order,
  step: Exclude<OrderStatus, 'cancelled'>,
): string | undefined {
  const fromMap = order.statusTimestamps?.[step];
  if (fromMap) return fromMap;
  if (step === 'placed') return order.createdAt;
  if (step === 'picked_up') return order.deliveryAssignment?.pickedUpAt;
  if (step === 'delivered') return order.deliveryAssignment?.deliveredAt;
  if (order.status === step) return order.updatedAt;
  return undefined;
}

export function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, bi, lang } = useI18n();
  const { refresh: refreshCart } = useCart();

  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [reordering, setReordering] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!id) {
      setOrder(null);
      return;
    }
    const found = await getOrderById(id);
    setOrder(found ?? null);
  }, [id]);

  // Initial load + automatic refresh on service events and lightweight polling fallback
  useEffect(() => {
    void loadOrder();
    const unsubscribe = subscribeToOrderUpdates(() => {
      void loadOrder();
    });
    const pollTimer = window.setInterval(() => {
      void loadOrder();
    }, 2500);

    return () => {
      unsubscribe();
      window.clearInterval(pollTimer);
    };
  }, [loadOrder]);

  const handleReorder = async () => {
    if (!order) return;
    setReordering(true);
    try {
      await reorderOrder(order.id);
      await refreshCart();
      navigate('/cart');
    } finally {
      setReordering(false);
    }
  };

  if (order === undefined) {
    return (
      <Card padding="lg" className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-7 w-44 rounded bg-border-grey/60" />
        <div className="h-24 rounded-[12px] bg-warm-yellow/40" />
        <div className="h-64 rounded-[12px] bg-soft-grey" />
      </Card>
    );
  }

  if (!order) {
    return (
      <Card className="max-w-lg mx-auto text-center py-12 space-y-4">
        <div className="w-14 h-14 rounded-[12px] bg-alert-red-soft text-alert-red mx-auto flex items-center justify-center">
          <Package className="w-7 h-7" aria-hidden="true" />
        </div>
        <h1 className="font-heading font-bold text-xl text-dark-ink">
          {t('orders.orderNotFoundTitle')}
        </h1>
        <p className="text-sm text-muted-text">{t('orders.orderNotFoundSubtitle')}</p>
        <Link to="/orders" className="inline-block">
          <Button variant="primary" size="md">
            {t('orders.backToOrders')}
          </Button>
        </Link>
      </Card>
    );
  }

  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const currentStepIndex =
    order.status === 'cancelled' ? -1 : STATUS_INDEX[order.status];
  const partner = order.deliveryAssignment;
  const hasAssignedPartner = Boolean(partner?.partnerName && partner?.partnerMobile);
  const otpDigits = (partner?.deliveryOtp ?? '----').split('');
  const gmapsUrl = buildGoogleMapsNavUrl(order.address.lat, order.address.lng);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-fresh-green hover:underline mb-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('orders.backToOrders')}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink tabular-nums">
              {t('orders.orderNumberLabel')} #{order.id}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-text mt-1">
            <span>
              {t('orders.placedOn', {
                date: formatDateTime(order.createdAt, locale),
              })}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-fresh-green font-medium">
              <span className="w-2 h-2 rounded-full bg-fresh-green animate-pulse" />
              {t('orders.liveUpdatingNote')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/orders/${order.id}/invoice`}>
            <Button
              variant="outline"
              size="md"
              leftIcon={<FileText className="w-4 h-4" />}
            >
              {t('orders.downloadInvoice')}
            </Button>
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={reordering}
            onClick={() => void handleReorder()}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            {reordering ? t('orders.reordering') : t('orders.reorder')}
          </Button>
        </div>
      </div>

      {isCancelled && (
        <div
          role="alert"
          className="rounded-[12px] bg-alert-red-soft border border-alert-red/30 px-4 py-3.5 flex items-start gap-3 text-sm font-medium text-alert-red"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t('orders.cancelledBanner')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Yellow Delivery OTP Card + Status Timeline */}
        <div className="lg:col-span-7 space-y-5">
          {/* Prominent Warm Yellow (#FFC83D) Delivery OTP Card */}
          {!isCancelled && partner?.deliveryOtp && (
            <section
              aria-labelledby="delivery-otp-heading"
              data-testid="delivery-otp-card"
              className="rounded-[12px] bg-warm-yellow text-dark-ink p-5 sm:p-6 shadow-[var(--shadow-card)] border border-[#E5B02B]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-dark-ink/10 text-dark-ink text-xs font-bold">
                    <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('orders.otpCardBadge')}</span>
                  </div>
                  <h2
                    id="delivery-otp-heading"
                    className="font-heading font-bold text-lg sm:text-xl text-dark-ink"
                  >
                    {t('orders.otpCardTitle')}
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-dark-ink/90 leading-snug">
                    {isDelivered || partner.otpVerified
                      ? t('orders.otpVerifiedText')
                      : t('orders.otpWarningText')}
                  </p>
                </div>

                <div
                  data-testid="delivery-otp-digits"
                  aria-label={`${t('orders.otpCardTitle')}: ${partner.deliveryOtp}`}
                  className="flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                >
                  {otpDigits.map((digit, idx) => (
                    <span
                      key={idx}
                      className="w-11 h-14 sm:w-12 sm:h-15 rounded-[10px] bg-white border-2 border-dark-ink/15 shadow-xs flex items-center justify-center font-heading font-bold text-2xl sm:text-3xl text-dark-ink tabular-nums"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Status Timeline */}
          <Card padding="lg" className="space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-grey/70">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-fresh-green shrink-0" aria-hidden="true" />
                <h2 className="font-heading font-bold text-lg text-dark-ink">
                  {t('orders.timelineTitle')}
                </h2>
              </div>
              {!isCancelled && !isDelivered && (
                <Badge tone="green">
                  ~{order.estimatedMinutes} min
                </Badge>
              )}
            </div>

            <ol data-testid="order-status-timeline" className="space-y-0">
              {TIMELINE_STEPS.map((step, idx) => {
                const reached = !isCancelled && idx <= currentStepIndex;
                const isCurrent = !isCancelled && idx === currentStepIndex && !isDelivered;
                const isLast = idx === TIMELINE_STEPS.length - 1;
                const timestamp = resolveStepTimestamp(order, step.status);
                const formattedTime = reached ? formatDateTime(timestamp, locale) : '';

                return (
                  <li
                    key={step.status}
                    data-testid={`timeline-step-${step.status}`}
                    data-state={isCurrent ? 'current' : reached ? 'completed' : 'pending'}
                    className="relative flex gap-3.5 pb-6 last:pb-0"
                  >
                    {/* Vertical connector line */}
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={[
                          'absolute left-[15px] top-8 bottom-0 w-0.5',
                          !isCancelled && idx < currentStepIndex
                            ? 'bg-fresh-green'
                            : 'bg-border-grey',
                        ].join(' ')}
                      />
                    )}

                    {/* Node dot */}
                    <div
                      className={[
                        'relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors',
                        reached
                          ? 'bg-fresh-green border-fresh-green text-white'
                          : 'bg-white border-border-grey text-muted-text',
                        isCurrent ? 'ring-4 ring-light-green' : '',
                      ].join(' ')}
                    >
                      {reached ? (
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-border-grey" />
                      )}
                    </div>

                    {/* Step text & time */}
                    <div className="flex-1 min-w-0 pt-0.5 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p
                          className={[
                            'font-heading font-semibold text-sm sm:text-base leading-tight',
                            reached ? 'text-dark-ink' : 'text-muted-text',
                          ].join(' ')}
                        >
                          {t(step.labelKey)}
                        </p>
                        <p className="text-xs text-muted-text mt-0.5">
                          {isCurrent
                            ? t('orders.stepCurrent')
                            : reached
                              ? t('orders.stepCompleted')
                              : t('orders.stepPending')}
                        </p>
                      </div>

                      {formattedTime && (
                        <span className="text-xs font-medium text-dark-ink/80 bg-soft-grey border border-border-grey/70 px-2.5 py-1 rounded-[8px] tabular-nums shrink-0">
                          {formattedTime}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* Items & Bill Summary */}
          <Card padding="lg" className="space-y-4">
            <h2 className="font-heading font-bold text-lg text-dark-ink pb-3 border-b border-border-grey/70">
              {t('orders.itemsTitle')} ({order.items.length})
            </h2>

            <div className="divide-y divide-border-grey/60">
              {order.items.map((item) => {
                const imgUrl = resolveProductImage(item.image);
                const tintClass = PRODUCT_TINT_CLASSES[item.imageTint];

                return (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-12 h-12 rounded-[10px] ${tintClass} overflow-hidden flex items-center justify-center shrink-0 border border-border-grey/60`}
                        >
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={bi(item.name)}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-fresh-green" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-heading font-semibold text-sm text-dark-ink truncate">
                            {bi(item.name)}
                          </p>
                          <p className="text-xs text-muted-text tabular-nums">
                            {item.packOrSummary} · Qty {item.quantity} × {formatINR(item.unitPrice)}
                          </p>
                        </div>
                      </div>
                      <span className="font-heading font-bold text-sm text-dark-ink tabular-nums shrink-0">
                        {formatINR(item.lineTotal)}
                      </span>
                    </div>

                    {item.comboSelections && item.comboSelections.length > 0 && (
                      <div className="ml-15 rounded-[8px] bg-soft-grey border border-border-grey/70 p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-dark-ink/85">
                        {item.comboSelections.map((sel) => (
                          <div key={sel.comboItemId} className="truncate">
                            <span className="font-semibold">{bi(sel.groupName)}:</span>{' '}
                            {sel.brandName} ({sel.quantity} {sel.unit})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-border-grey/70 space-y-1.5 text-sm">
              <div className="flex justify-between text-dark-ink">
                <span>{t('cart.itemTotal')}</span>
                <span className="font-semibold tabular-nums">{formatINR(order.subtotal)}</span>
              </div>
              {order.couponDiscount > 0 && order.couponCode && (
                <div className="flex justify-between text-fresh-green">
                  <span>{t('cart.couponDiscount', { code: order.couponCode })}</span>
                  <span className="font-semibold tabular-nums">
                    -{formatINR(order.couponDiscount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-dark-ink">
                <span>{t('cart.deliveryFee')}</span>
                <span className="font-semibold tabular-nums">
                  {order.deliveryFee === 0 ? (
                    <span className="text-fresh-green">{t('cart.free')}</span>
                  ) : (
                    formatINR(order.deliveryFee)
                  )}
                </span>
              </div>
              <div className="pt-2 border-t border-border-grey/70 flex items-baseline justify-between">
                <span className="font-heading font-bold text-base text-dark-ink">
                  {t('orders.totalLabel')}
                </span>
                <span className="font-heading font-bold text-xl text-dark-ink tabular-nums">
                  {formatINR(order.total)}
                </span>
              </div>
              <p className="text-xs text-muted-text pt-0.5">
                {order.payment.status === 'paid'
                  ? t('orders.paymentPaid', { method: order.payment.method.toUpperCase() })
                  : t('orders.paymentPending', { method: order.payment.method.toUpperCase() })}
                {order.payment.transactionRef ? ` · ${order.payment.transactionRef}` : ''}
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column: Delivery Partner Card + Live Map Placeholder + Address */}
        <div className="lg:col-span-5 space-y-5">
          {/* Delivery Partner Card */}
          <Card padding="lg" className="space-y-3.5" data-testid="delivery-partner-card">
            <h2 className="font-heading font-bold text-lg text-dark-ink">
              {t('orders.partnerTitle')}
            </h2>

            {hasAssignedPartner && partner ? (
              <div className="rounded-[10px] bg-soft-grey border border-border-grey/80 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-[10px] bg-light-green text-fresh-green flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p
                      data-testid="partner-name"
                      className="font-heading font-bold text-sm sm:text-base text-dark-ink truncate"
                    >
                      {partner.partnerName}
                    </p>
                    <p className="text-xs text-muted-text">
                      {t('orders.vehicleLabel')}: {partner.vehicleNumber}
                    </p>
                  </div>
                </div>

                <a
                  href={`tel:${partner.partnerMobile}`}
                  data-testid="call-partner-button"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-[10px] bg-fresh-green hover:bg-fresh-green-hover text-white text-sm font-semibold transition-colors shrink-0"
                >
                  <Phone className="w-4 h-4" aria-hidden="true" />
                  <span>{t('orders.callPartner')}</span>
                </a>
              </div>
            ) : (
              <div className="rounded-[10px] bg-soft-grey border border-border-grey/80 p-3.5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-warm-yellow-soft text-dark-ink flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-sm text-dark-ink">
                    {t('orders.partnerUnassignedTitle')}
                  </p>
                  <p className="text-xs text-muted-text mt-0.5">
                    {t('orders.partnerUnassignedDesc')}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Placeholder Map Area Labelled "Live map (phase 2)" */}
          <Card padding="md" className="space-y-3" data-testid="live-map-placeholder">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
                <h2 className="font-heading font-bold text-base text-dark-ink">
                  {t('orders.liveMapTitle')}
                </h2>
              </div>
              <Badge tone="neutral">Karur GPS</Badge>
            </div>

            <div className="relative h-[200px] rounded-[12px] overflow-hidden border border-border-grey bg-[#EBF2EE] flex flex-col items-center justify-center p-4 text-center">
              {/* Stylized subtle Karur street grid background */}
              <svg
                aria-hidden="true"
                viewBox="0 0 360 200"
                className="absolute inset-0 w-full h-full opacity-55"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 50 Q 120 70 220 40 T 360 65 M0 135 Q 150 110 360 145 M80 0 L 95 200 M240 0 L 210 200"
                  stroke="#FFFFFF"
                  strokeWidth="8"
                  fill="none"
                />
                <path
                  d="M72 56 Q 160 32 274 128"
                  stroke="#1B8A4B"
                  strokeWidth="3.5"
                  strokeDasharray="6 6"
                  fill="none"
                />
              </svg>

              {/* Store Hub & Destination Visual Markers */}
              <div className="relative z-10 flex items-center justify-between w-full max-w-[260px] mb-3 px-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] bg-white/95 border border-fresh-green/40 text-[11px] font-semibold text-fresh-green shadow-xs">
                  <Store className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('orders.hubLabel')}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] bg-white/95 border border-alert-red/40 text-[11px] font-semibold text-alert-red shadow-xs">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('orders.destinationLabel')}</span>
                </span>
              </div>

              <div className="relative z-10 rounded-[10px] bg-white/92 backdrop-blur-xs border border-border-grey px-3.5 py-2 shadow-xs">
                <p className="font-heading font-bold text-sm text-dark-ink">
                  {t('orders.liveMapTitle')}
                </p>
                <p className="text-[11px] text-muted-text mt-0.5">
                  {t('orders.liveMapSubtitle')}
                </p>
              </div>
            </div>

            {/* Delivery Address Summary & External Maps link */}
            <div className="rounded-[10px] bg-soft-grey border border-border-grey/80 p-3 space-y-1.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading font-semibold text-dark-ink flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
                  {t('orders.deliveryAddressTitle')}
                </span>
                <Badge tone="green">{order.address.label}</Badge>
              </div>
              <p className="text-dark-ink">
                {order.address.door}, {order.address.street}
              </p>
              <p className="text-xs text-muted-text">
                {order.address.landmark} · {order.address.pincode}
              </p>
              <a
                href={gmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-fresh-green hover:underline pt-1"
              >
                <span>{t('orders.viewOnMaps')}</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
