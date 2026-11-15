import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  MapPin,
  Printer,
  RotateCcw,
  Truck,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import type { DeliveryPartnerProfile } from '../../mock/users';
import {
  assignDeliveryPartner,
  cancelAndRefundOrder,
  getDeliveryPartners,
  getOrders,
  subscribeToOrderUpdates,
  updateOrderStatus,
} from '../../services';
import type { DeliverySlotId, Order, OrderStatus } from '../../types';
import { formatINR } from '../../utils/format';
import { buildGoogleMapsNavUrl } from '../../utils/geo';

type OrderFilterTab = 'all' | OrderStatus;

const ORDER_STATUS_BADGE_TONE: Record<OrderStatus, 'green' | 'yellow' | 'red' | 'neutral'> = {
  placed: 'neutral',
  packed: 'yellow',
  picked_up: 'yellow',
  out_for_delivery: 'green',
  delivered: 'green',
  cancelled: 'red',
};

const FULFILLMENT_STATUSES: Array<Exclude<OrderStatus, 'cancelled'>> = [
  'placed',
  'packed',
  'picked_up',
  'out_for_delivery',
  'delivered',
];

export function AdminOrdersPage() {
  const { t, bi, lang } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [partners, setPartners] = useState<DeliveryPartnerProfile[]>([]);
  const [activeTab, setActiveTab] = useState<OrderFilterTab>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [packingSlipOrder, setPackingSlipOrder] = useState<Order | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [ordersList, partnersList] = await Promise.all([
      getOrders(),
      getDeliveryPartners(),
    ]);
    setOrders(ordersList);
    setPartners(partnersList);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
    const unsub = subscribeToOrderUpdates(() => void loadData());
    return unsub;
  }, [loadData]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const statusLabel = (status: OrderStatus): string => {
    switch (status) {
      case 'placed':
        return t('orders.statusPlaced');
      case 'packed':
        return t('orders.statusPacked');
      case 'picked_up':
        return t('orders.statusPickedUp');
      case 'out_for_delivery':
        return t('orders.statusOutForDelivery');
      case 'delivered':
        return t('orders.statusDelivered');
      case 'cancelled':
        return t('orders.statusCancelled');
    }
  };

  const slotLabel = (slot?: DeliverySlotId): string => {
    switch (slot) {
      case 'today_evening':
        return t('cart.slotTodayEvening');
      case 'tomorrow_morning':
        return t('cart.slotTomorrowMorning');
      case '45min':
      default:
        return t('cart.slot45Min');
    }
  };

  const filterTabs: Array<{ key: OrderFilterTab; label: string }> = [
    { key: 'all', label: t('admin.tabAll') },
    { key: 'placed', label: t('orders.statusPlaced') },
    { key: 'packed', label: t('orders.statusPacked') },
    { key: 'picked_up', label: t('orders.statusPickedUp') },
    { key: 'out_for_delivery', label: t('orders.statusOutForDelivery') },
    { key: 'delivered', label: t('orders.statusDelivered') },
    { key: 'cancelled', label: t('orders.statusCancelled') },
  ];

  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return orders;
    return orders.filter((o) => o.status === activeTab);
  }, [orders, activeTab]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));

  const handleAssignPartner = async (orderId: string, partnerId: string) => {
    if (!partnerId) return;
    const updated = await assignDeliveryPartner(orderId, partnerId);
    const partnerName =
      updated?.deliveryAssignment?.partnerName ??
      partners.find((p) => p.id === partnerId)?.name ??
      '';
    await loadData();
    showToast(t('admin.partnerAssignedToast', { partner: partnerName, id: orderId }));
  };

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    await updateOrderStatus(orderId, nextStatus);
    await loadData();
  };

  const handleCancelAndRefund = async (orderId: string) => {
    await cancelAndRefundOrder(orderId, true);
    setConfirmCancelId(null);
    await loadData();
    showToast(t('admin.cancelRefundConfirm', { id: orderId }));
  };

  return (
    <div className="space-y-5">
      {/* Header (hidden when printing packing slip) */}
      <div className="print:hidden space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-dark-ink">
              {t('admin.ordersTitle')}
            </h1>
            <p className="text-sm text-muted-text mt-0.5">{t('admin.ordersSubtitle')}</p>
          </div>
          {toastMsg && (
            <div
              role="status"
              data-testid="admin-orders-toast"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-light-green border border-fresh-green/30 text-fresh-green text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{toastMsg}</span>
            </div>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div
          role="tablist"
          aria-label="Order status filters"
          className="flex flex-wrap gap-2"
        >
          {filterTabs.map((tab) => {
            const count =
              tab.key === 'all'
                ? orders.length
                : orders.filter((o) => o.status === tab.key).length;
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'min-h-[44px] px-3.5 py-2 rounded-[10px] text-xs font-semibold inline-flex items-center gap-2 border transition-colors cursor-pointer',
                  isSelected
                    ? 'bg-fresh-green text-white border-fresh-green'
                    : 'bg-white text-dark-ink border-border-grey hover:bg-light-green/40',
                ].join(' ')}
              >
                <span>{tab.label}</span>
                <span
                  className={[
                    'px-1.5 py-0.5 rounded-[6px] text-[11px] tabular-nums',
                    isSelected ? 'bg-white/20 text-white' : 'bg-soft-grey text-muted-text',
                  ].join(' ')}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Orders List / Table */}
        {isLoading ? (
          <Card className="h-64 animate-pulse bg-white/80" />
        ) : filteredOrders.length === 0 ? (
          <Card className="py-12 text-center space-y-2">
            <ClipboardList className="w-8 h-8 text-muted-text mx-auto" aria-hidden="true" />
            <p className="text-sm font-medium text-dark-ink">{t('admin.noOrdersInFilter')}</p>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <Card padding="none" className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-soft-grey border-b border-border-grey text-xs uppercase tracking-wide text-muted-text">
                      <th className="py-3 px-4 font-semibold">{t('admin.colOrderId')}</th>
                      <th className="py-3 px-4 font-semibold">{t('admin.colCustomer')}</th>
                      <th className="py-3 px-4 font-semibold">{t('admin.colItems')}</th>
                      <th className="py-3 px-4 font-semibold">{t('admin.colPayment')}</th>
                      <th className="py-3 px-4 font-semibold">{t('admin.colPartner')}</th>
                      <th className="py-3 px-4 font-semibold">{t('admin.colStatus')}</th>
                      <th className="py-3 px-4 font-semibold text-right">{t('admin.colTotal')}</th>
                      <th className="py-3 px-4 font-semibold text-right">{t('admin.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-grey/70">
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        data-testid={`admin-order-row-${order.id}`}
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setConfirmCancelId(null);
                        }}
                        className={[
                          'hover:bg-light-green/25 transition-colors cursor-pointer',
                          selectedOrderId === order.id ? 'bg-light-green/40' : '',
                        ].join(' ')}
                      >
                        <td className="py-3.5 px-4 font-heading font-bold text-dark-ink tabular-nums">
                          {order.id}
                          <p className="text-[11px] font-normal text-muted-text">
                            {formatTime(order.createdAt)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-dark-ink">{order.customerName}</p>
                          <p className="text-xs text-muted-text tabular-nums">
                            +91 {order.customerMobile}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-dark-ink tabular-nums">
                          {order.items.length === 1
                            ? t('orders.itemsCountSingle')
                            : t('orders.itemsCountPlural', { count: order.items.length })}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <span className="uppercase font-semibold text-dark-ink">
                            {order.payment.method}
                          </span>
                          <p
                            className={[
                              'text-[11px] font-semibold capitalize',
                              order.payment.status === 'paid'
                                ? 'text-fresh-green'
                                : order.payment.status === 'refunded'
                                  ? 'text-alert-red'
                                  : 'text-muted-text',
                            ].join(' ')}
                          >
                            {order.payment.status}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {order.deliveryAssignment?.partnerName ? (
                            <span className="font-medium text-dark-ink">
                              {order.deliveryAssignment.partnerName}
                            </span>
                          ) : (
                            <span className="text-muted-text">{t('admin.unassignedPartner')}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge tone={ORDER_STATUS_BADGE_TONE[order.status]}>
                            {statusLabel(order.status)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right font-heading font-bold text-dark-ink tabular-nums">
                          {formatINR(order.total)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            data-testid={`manage-order-${order.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderId(order.id);
                              setConfirmCancelId(null);
                            }}
                          >
                            {t('admin.viewDetails')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading font-bold text-base text-dark-ink tabular-nums">
                        {order.id}
                      </p>
                      <p className="text-xs text-muted-text">{formatTime(order.createdAt)}</p>
                    </div>
                    <Badge tone={ORDER_STATUS_BADGE_TONE[order.status]}>
                      {statusLabel(order.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-dark-ink">{order.customerName}</p>
                      <p className="text-muted-text tabular-nums">+91 {order.customerMobile}</p>
                    </div>
                    <p className="font-heading font-bold text-base text-dark-ink tabular-nums">
                      {formatINR(order.total)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setConfirmCancelId(null);
                    }}
                  >
                    {t('admin.viewDetails')}
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex justify-end print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.drawerTitle', { id: selectedOrder.id })}
        >
          <button
            type="button"
            aria-label={t('admin.closePanel')}
            onClick={() => setSelectedOrderId(null)}
            className="fixed inset-0 bg-dark-ink/50"
          />

          <aside
            data-testid="order-detail-drawer"
            className="relative z-10 w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="sticky top-0 bg-white z-10 px-5 py-4 border-b border-border-grey flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-heading font-bold text-lg text-dark-ink tabular-nums">
                  {t('admin.drawerTitle', { id: selectedOrder.id })}
                </h2>
                <Badge tone={ORDER_STATUS_BADGE_TONE[selectedOrder.status]}>
                  {statusLabel(selectedOrder.status)}
                </Badge>
              </div>
              <button
                type="button"
                aria-label={t('admin.closePanel')}
                onClick={() => setSelectedOrderId(null)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[10px] hover:bg-soft-grey text-dark-ink cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Customer & Address */}
              <section className="rounded-[12px] bg-soft-grey border border-border-grey/80 p-4 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-text">
                  {t('admin.drawerCustomerSection')}
                </p>
                <p className="font-heading font-bold text-sm text-dark-ink">
                  {selectedOrder.customerName} · +91 {selectedOrder.customerMobile}
                </p>
                <p className="text-xs text-dark-ink">
                  {selectedOrder.address.door}, {selectedOrder.address.street},{' '}
                  {selectedOrder.address.landmark} – {selectedOrder.address.pincode}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Badge tone="green">{slotLabel(selectedOrder.deliverySlot)}</Badge>
                  <a
                    href={buildGoogleMapsNavUrl(
                      selectedOrder.address.lat,
                      selectedOrder.address.lng,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-fresh-green hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('orders.viewOnMaps')}</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </section>

              {/* Assign Delivery Partner & Update Status */}
              <section className="rounded-[12px] border border-border-grey p-4 space-y-4">
                <div className="flex items-center gap-2 text-dark-ink">
                  <Truck className="w-4 h-4 text-fresh-green" aria-hidden="true" />
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-text">
                    {t('admin.drawerFulfillmentSection')}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="assign-partner-select"
                    className="block text-xs font-semibold text-dark-ink mb-1.5"
                  >
                    {t('admin.assignPartnerLabel')}
                  </label>
                  <select
                    id="assign-partner-select"
                    data-testid="assign-partner-select"
                    value={selectedOrder.deliveryAssignment?.deliveryPartnerId ?? ''}
                    disabled={selectedOrder.status === 'cancelled'}
                    onChange={(e) => handleAssignPartner(selectedOrder.id, e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-[10px] border border-border-grey bg-white text-sm text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green"
                  >
                    <option value="">{t('admin.selectPartnerPlaceholder')}</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name} · {partner.zone} ({partner.vehicleNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedOrder.status !== 'cancelled' && (
                  <div>
                    <label
                      htmlFor="admin-order-status-select"
                      className="block text-xs font-semibold text-dark-ink mb-1.5"
                    >
                      {t('admin.orderStatusLabel')}
                    </label>
                    <select
                      id="admin-order-status-select"
                      data-testid="admin-order-status-select"
                      value={selectedOrder.status}
                      onChange={(e) =>
                        handleStatusChange(selectedOrder.id, e.target.value as OrderStatus)
                      }
                      className="w-full min-h-[44px] px-3 rounded-[10px] border border-border-grey bg-white text-sm text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green"
                    >
                      {FULFILLMENT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {statusLabel(st)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </section>

              {/* Items List */}
              <section className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-text">
                  {t('admin.drawerItemsSection')} ({selectedOrder.items.length})
                </p>
                <div className="divide-y divide-border-grey/70 border border-border-grey rounded-[12px] px-4">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-dark-ink">
                          {item.quantity} × {bi(item.name)}
                        </p>
                        <p className="text-xs text-muted-text">{item.packOrSummary}</p>
                        {item.comboSelections && item.comboSelections.length > 0 && (
                          <p className="text-[11px] text-muted-text mt-1 leading-relaxed">
                            {item.comboSelections
                              .map((s) => `${bi(s.groupName)}: ${s.brandName}`)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className="font-heading font-bold text-sm text-dark-ink tabular-nums shrink-0">
                        {formatINR(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Payment Summary */}
              <section className="rounded-[12px] bg-soft-grey border border-border-grey/80 p-4 space-y-2 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-text">
                  {t('admin.drawerPaymentSection')}
                </p>
                <div className="flex justify-between">
                  <span className="text-muted-text">{t('invoice.paymentModeLabel')}</span>
                  <span className="font-semibold uppercase text-dark-ink">
                    {selectedOrder.payment.method} ·{' '}
                    <span
                      data-testid="drawer-payment-status"
                      className={
                        selectedOrder.payment.status === 'refunded'
                          ? 'text-alert-red'
                          : selectedOrder.payment.status === 'paid'
                            ? 'text-fresh-green'
                            : 'text-dark-ink'
                      }
                    >
                      {selectedOrder.payment.status}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-text">{t('cart.itemTotal')}</span>
                  <span className="tabular-nums font-medium">
                    {formatINR(selectedOrder.subtotal)}
                  </span>
                </div>
                {selectedOrder.couponDiscount > 0 && (
                  <div className="flex justify-between text-fresh-green">
                    <span>
                      {t('cart.couponDiscount', { code: selectedOrder.couponCode ?? '' })}
                    </span>
                    <span className="tabular-nums font-medium">
                      -{formatINR(selectedOrder.couponDiscount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-text">{t('cart.deliveryFee')}</span>
                  <span className="tabular-nums font-medium">
                    {selectedOrder.deliveryFee === 0
                      ? t('cart.free')
                      : formatINR(selectedOrder.deliveryFee)}
                  </span>
                </div>
                <div className="pt-2 border-t border-border-grey flex justify-between items-baseline">
                  <span className="font-heading font-bold text-dark-ink">
                    {t('orders.totalLabel')}
                  </span>
                  <span className="font-heading font-bold text-lg text-dark-ink tabular-nums">
                    {formatINR(selectedOrder.total)}
                  </span>
                </div>
              </section>
            </div>

            {/* Sticky Drawer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-border-grey p-4 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <Link to={`/orders/${selectedOrder.id}/invoice`} className="block">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    fullWidth
                    leftIcon={<FileText className="w-4 h-4" />}
                  >
                    {t('admin.printInvoiceCta')}
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fullWidth
                  data-testid="open-packing-slip-btn"
                  onClick={() => setPackingSlipOrder(selectedOrder)}
                  leftIcon={<Printer className="w-4 h-4" />}
                >
                  {t('admin.printPackingSlipCta')}
                </Button>
              </div>

              {selectedOrder.status === 'cancelled' ? (
                <p className="text-center text-xs font-semibold text-alert-red py-1">
                  {t('admin.alreadyCancelledNote')} · {selectedOrder.payment.status.toUpperCase()}
                </p>
              ) : confirmCancelId === selectedOrder.id ? (
                <div className="flex items-center gap-2 bg-alert-red-soft p-2 rounded-[10px]">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    fullWidth
                    data-testid="confirm-cancel-refund-btn"
                    onClick={() => handleCancelAndRefund(selectedOrder.id)}
                  >
                    {t('admin.cancelRefundCta')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmCancelId(null)}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  fullWidth
                  data-testid="cancel-refund-trigger-btn"
                  onClick={() => setConfirmCancelId(selectedOrder.id)}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                >
                  {t('admin.cancelRefundCta')}
                </Button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Printable Packing Slip Modal */}
      {packingSlipOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-ink/60 p-4 print:static print:bg-white print:p-0"
          role="dialog"
          aria-modal="true"
        >
          <Card
            padding="lg"
            data-testid="packing-slip-modal"
            className="w-full max-w-xl bg-white space-y-5 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border print:border-border-grey"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border-grey pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-fresh-green">
                  {t('invoice.storeTitle')}
                </p>
                <h2 className="font-heading font-bold text-xl text-dark-ink">
                  {t('admin.packingSlipTitle')} · {packingSlipOrder.id}
                </h2>
                <p className="text-xs text-muted-text mt-0.5">
                  {t('admin.packingSlipSubtitle')}
                </p>
              </div>
              <button
                type="button"
                aria-label={t('admin.closePanel')}
                onClick={() => setPackingSlipOrder(null)}
                className="print:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-[10px] hover:bg-soft-grey text-dark-ink cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-soft-grey p-3.5 rounded-[10px]">
              <div>
                <p className="font-bold text-dark-ink">{packingSlipOrder.customerName}</p>
                <p className="text-muted-text tabular-nums">
                  +91 {packingSlipOrder.customerMobile}
                </p>
                <p className="text-dark-ink mt-1">
                  {packingSlipOrder.address.door}, {packingSlipOrder.address.street},{' '}
                  {packingSlipOrder.address.pincode}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-bold text-dark-ink">
                  {slotLabel(packingSlipOrder.deliverySlot)}
                </p>
                <p className="text-muted-text mt-1">
                  {packingSlipOrder.deliveryAssignment?.partnerName
                    ? `${t('admin.colPartner')}: ${packingSlipOrder.deliveryAssignment.partnerName}`
                    : t('admin.unassignedPartner')}
                </p>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-border-grey text-muted-text">
                  <th className="py-2 pr-2 w-10">Pack</th>
                  <th className="py-2 pr-3">{t('invoice.colItem')}</th>
                  <th className="py-2 text-right">{t('invoice.colQty')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-grey/60">
                {packingSlipOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-2 align-top">
                      <span className="inline-block w-4 h-4 border-2 border-dark-ink rounded-[3px]" />
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <p className="font-semibold text-dark-ink">{bi(item.name)}</p>
                      <p className="text-xs text-muted-text">{item.packOrSummary}</p>
                      {item.comboSelections && item.comboSelections.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-dark-ink list-disc list-inside">
                          {item.comboSelections.map((sel) => (
                            <li key={sel.comboItemId}>
                              {sel.quantity}× {bi(sel.groupName)} —{' '}
                              <span className="font-semibold">{sel.brandName}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-3 text-right font-heading font-bold tabular-nums align-top">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="print:hidden flex flex-wrap justify-end gap-2.5 pt-2 border-t border-border-grey">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setPackingSlipOrder(null)}
              >
                {t('admin.closePanel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                {t('admin.packingSlipPrintNow')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
