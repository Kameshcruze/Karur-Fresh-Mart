import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Truck,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DeliveryMapPreview } from '../../components/delivery';
import { Badge, Button, Card, ProductImage } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import {
  getDeliveryOrderChecklist,
  getOrderById,
  markOrderOutForDelivery,
  markOrderPickedUp,
  subscribeToOrderUpdates,
  toggleDeliveryChecklistItem,
} from '../../services';
import type { Order } from '../../types';
import { formatDateTime, formatINR } from '../../utils/format';
import { buildGoogleMapsNavUrl } from '../../utils/geo';

export function DeliveryOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { deliverySettings } = useAuth();

  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    const found = await getOrderById(id);
    setOrder(found);
    setCheckedItemIds(getDeliveryOrderChecklist(id));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadOrder();
    return subscribeToOrderUpdates(() => {
      void loadOrder();
    });
  }, [loadOrder]);

  const mapsUrl = useMemo(() => {
    if (!order) return '#';
    return buildGoogleMapsNavUrl(order.address.lat, order.address.lng);
  }, [order]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Card className="h-28 animate-pulse bg-white/80" />
        <Card className="h-56 animate-pulse bg-white/80" />
      </div>
    );
  }

  if (!order) {
    return (
      <Card padding="lg" className="text-center space-y-4">
        <p className="font-heading font-bold text-lg text-dark-ink">
          Order #{id} not found
        </p>
        <Link to="/delivery">
          <Button variant="primary">{t('delivery.backToDeliveries')}</Button>
        </Link>
      </Card>
    );
  }

  const isCodPending = order.payment.method === 'cod' && order.payment.status !== 'paid';
  const isReadyToPickUp = order.status === 'placed' || order.status === 'packed';
  const isPickedUp = order.status === 'picked_up';
  const isOutForDelivery = order.status === 'out_for_delivery';
  const isDelivered = order.status === 'delivered';

  const handleToggleItem = (itemId: string) => {
    const next = toggleDeliveryChecklistItem(order.id, itemId);
    setCheckedItemIds(next);
  };

  const handleCheckAll = () => {
    let next = [...checkedItemIds];
    for (const item of order.items) {
      if (!next.includes(item.id)) {
        next = toggleDeliveryChecklistItem(order.id, item.id);
      }
    }
    setCheckedItemIds(next);
  };

  const handlePickedUp = async () => {
    setActionBusy(true);
    try {
      const updated = await markOrderPickedUp(order.id);
      if (updated) setOrder(updated);
    } finally {
      setActionBusy(false);
    }
  };

  const handleStartTrip = async () => {
    setActionBusy(true);
    try {
      const updated = await markOrderOutForDelivery(order.id);
      if (updated) setOrder(updated);
    } finally {
      setActionBusy(false);
    }
  };

  const handleReachedCustomer = async () => {
    if (order.status === 'picked_up') {
      await markOrderOutForDelivery(order.id);
    }
    navigate(`/delivery/orders/${order.id}/confirm`);
  };

  const getStatusBadge = () => {
    if (isReadyToPickUp) return <Badge tone="yellow">{t('delivery.statusReadyPickup')}</Badge>;
    if (isPickedUp) return <Badge tone="green">{t('delivery.statusPickedUp')}</Badge>;
    if (isOutForDelivery) return <Badge tone="green">{t('delivery.statusOutForDelivery')}</Badge>;
    if (isDelivered) return <Badge tone="dark">{t('delivery.statusDelivered')}</Badge>;
    return <Badge tone="neutral">{order.status}</Badge>;
  };

  const pickedUpTimestamp =
    order.deliveryAssignment?.pickedUpAt ?? order.statusTimestamps?.picked_up;
  const deliveredTimestamp =
    order.deliveryAssignment?.deliveredAt ?? order.statusTimestamps?.delivered;

  return (
    <div className="space-y-4 pb-6" data-testid="delivery-order-detail">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/delivery"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-dark-ink hover:text-fresh-green min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t('delivery.backToDeliveries')}</span>
        </Link>
        {getStatusBadge()}
      </div>

      {/* Order Summary + Customer + Call */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-text font-semibold">
              {t('delivery.customerDetails')}
            </p>
            <h1 className="font-heading font-bold text-xl text-dark-ink mt-0.5">
              #{order.id} · {order.customerName}
            </h1>
            <p className="text-xs text-muted-text tabular-nums mt-0.5">
              +91 {order.customerMobile}
            </p>
          </div>

          <a
            href={`tel:+91${order.customerMobile}`}
            data-testid="call-customer-btn"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-[10px] bg-light-green text-fresh-green font-semibold text-sm hover:bg-fresh-green hover:text-white transition-colors shrink-0"
          >
            <Phone className="w-4 h-4" aria-hidden="true" />
            <span>{t('delivery.callCustomer')}</span>
          </a>
        </div>

        <div className="rounded-[10px] bg-soft-grey p-3 flex items-start gap-2.5 text-sm text-dark-ink">
          <MapPin className="w-4 h-4 text-fresh-green shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5 text-xs sm:text-sm">
            <p className="font-semibold">
              {order.address.label} · {order.address.door}, {order.address.street}
            </p>
            {order.address.landmark && (
              <p className="text-muted-text">{order.address.landmark}</p>
            )}
            <p className="text-muted-text">
              {order.address.area ? `${order.address.area}, Karur` : 'Karur'} - {order.address.pincode}
            </p>
          </div>
        </div>

        {/* Timestamps if picked up / delivered */}
        {pickedUpTimestamp && (
          <p
            data-testid="order-picked-up-timestamp"
            className="text-xs text-fresh-green font-medium inline-flex items-center gap-1.5"
          >
            <PackageCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('delivery.pickedUpAtLabel', { time: formatDateTime(pickedUpTimestamp) })}</span>
          </p>
        )}
        {deliveredTimestamp && (
          <p
            data-testid="order-delivered-timestamp"
            className="text-xs text-dark-ink font-semibold inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
            <span>{t('delivery.deliveredAtLabel', { time: formatDateTime(deliveredTimestamp) })}</span>
          </p>
        )}
      </Card>

      {/* Payment Status Banner */}
      <div
        data-testid="delivery-payment-banner"
        className={[
          'rounded-[12px] p-3.5 border flex items-center gap-3',
          isCodPending
            ? 'bg-warm-yellow/25 border-warm-yellow text-dark-ink'
            : 'bg-light-green border-fresh-green/30 text-dark-ink',
        ].join(' ')}
      >
        <div
          className={[
            'w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0',
            isCodPending ? 'bg-warm-yellow text-dark-ink' : 'bg-fresh-green text-white',
          ].join(' ')}
        >
          {isCodPending ? (
            <Banknote className="w-5 h-5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          )}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-text">
            {t('delivery.paymentStatusLabel')}
          </p>
          <p className="text-sm font-bold text-dark-ink">
            {isCodPending
              ? t('delivery.paymentCodBanner', { amount: order.total })
              : t('delivery.paymentPaidBanner', {
                  method: order.payment.method.toUpperCase(),
                  amount: order.total,
                })}
          </p>
        </div>
      </div>

      {/* Map Preview & Navigate in Google Maps */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading font-bold text-sm text-dark-ink">
            {t('delivery.mapPreviewTitle')}
          </h2>
        </div>

        <DeliveryMapPreview
          customerLat={order.address.lat}
          customerLng={order.address.lng}
          hubLat={deliverySettings.hubLat}
          hubLng={deliverySettings.hubLng}
          customerLabel={order.customerName}
        />

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="navigate-google-maps-btn"
          className="w-full min-h-[46px] px-4 rounded-[10px] bg-deep-forest text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-deep-forest/90 active:scale-[0.99] transition-all"
        >
          <Navigation className="w-4 h-4 text-bright-green" aria-hidden="true" />
          <span>{t('delivery.navigateGoogleMaps')}</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
        </a>
      </Card>

      {/* Item Checklist */}
      <Card padding="md" className="space-y-3" data-testid="delivery-item-checklist">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-heading font-bold text-sm text-dark-ink flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-fresh-green" aria-hidden="true" />
              <span>
                {t('delivery.itemChecklistTitle', {
                  checked: checkedItemIds.length,
                  total: order.items.length,
                })}
              </span>
            </h2>
            <p className="text-[11px] text-muted-text mt-0.5">
              {t('delivery.itemChecklistHint')}
            </p>
          </div>
          {checkedItemIds.length < order.items.length && (
            <button
              type="button"
              onClick={handleCheckAll}
              className="text-xs font-semibold text-fresh-green hover:underline shrink-0 cursor-pointer"
            >
              {t('delivery.markAllChecked')}
            </button>
          )}
        </div>

        <div className="divide-y divide-border-grey/80">
          {order.items.map((item) => {
            const isChecked = checkedItemIds.includes(item.id);
            return (
              <label
                key={item.id}
                data-testid={`checklist-item-${item.id}`}
                className="flex items-center gap-3 py-2.5 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleItem(item.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={[
                    'w-6 h-6 rounded-[7px] border-2 flex items-center justify-center shrink-0 transition-colors',
                    isChecked
                      ? 'bg-fresh-green border-fresh-green text-white'
                      : 'bg-white border-border-grey',
                  ].join(' ')}
                >
                  {isChecked && <Check className="w-4 h-4" />}
                </span>

                <ProductImage
                  tint={item.imageTint ?? 'rice'}
                  image={item.image}
                  alt={lang === 'ta' ? item.name.ta : item.name.en}
                  size="sm"
                />

                <div className="flex-1 min-w-0">
                  <p
                    className={[
                      'text-sm font-medium truncate',
                      isChecked ? 'line-through text-muted-text' : 'text-dark-ink',
                    ].join(' ')}
                  >
                    {lang === 'ta' ? item.name.ta : item.name.en}
                  </p>
                  <p className="text-xs text-muted-text">
                    {item.packOrSummary} × {item.quantity}
                  </p>
                </div>

                <span className="text-sm font-semibold text-dark-ink tabular-nums shrink-0">
                  {formatINR(item.lineTotal)}
                </span>
              </label>
            );
          })}
        </div>
      </Card>

      {/* Primary Action Buttons */}
      {!isDelivered && (
        <div className="space-y-2.5 pt-1">
          {isReadyToPickUp && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              disabled={actionBusy}
              onClick={handlePickedUp}
              data-testid="picked-up-btn"
              leftIcon={<PackageCheck className="w-5 h-5" />}
            >
              {t('delivery.pickedUpCta')}
            </Button>
          )}

          {isPickedUp && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              disabled={actionBusy}
              onClick={handleStartTrip}
              data-testid="start-trip-btn"
              leftIcon={<Truck className="w-4 h-4" />}
            >
              {t('delivery.startTripCta')}
            </Button>
          )}

          {(isPickedUp || isOutForDelivery) && (
            <Button
              type="button"
              variant="yellow"
              size="lg"
              fullWidth
              disabled={actionBusy}
              onClick={handleReachedCustomer}
              data-testid="reached-customer-btn"
              leftIcon={<CheckCircle2 className="w-5 h-5" />}
            >
              {t('delivery.reachedCustomerCta')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
