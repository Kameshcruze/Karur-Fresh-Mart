import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import {
  computeDeliveryDashboardSummary,
  getAssignedDeliveries,
  getDeliveryPartners,
  resolvePartnerForUser,
  subscribeToOrderUpdates,
} from '../../services';
import type { Order, OrderStatus } from '../../types';
import { formatDateTime, formatINR } from '../../utils/format';

type QueueFilter = 'all' | 'ready' | 'out';

export function DeliveryHomePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [partnerId, setPartnerId] = useState<string>('dp-1');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const partners = await getDeliveryPartners();
    const resolved = resolvePartnerForUser(user?.id, user?.mobile, partners);
    const activePartnerId = resolved?.id ?? 'dp-1';
    setPartnerId(activePartnerId);
    const assigned = await getAssignedDeliveries(activePartnerId);
    setOrders(assigned);
    setLoading(false);
  }, [user?.id, user?.mobile]);

  useEffect(() => {
    void loadData();
    const unsub = subscribeToOrderUpdates(() => {
      void loadData();
    });
    const timer = window.setInterval(() => {
      void loadData();
    }, 5000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [loadData]);

  const summary = useMemo(
    () => computeDeliveryDashboardSummary(partnerId, orders),
    [partnerId, orders],
  );

  const activeOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    if (filter === 'ready') {
      return activeOrders.filter((o) => o.status === 'placed' || o.status === 'packed');
    }
    if (filter === 'out') {
      return activeOrders.filter(
        (o) => o.status === 'picked_up' || o.status === 'out_for_delivery',
      );
    }
    return activeOrders;
  }, [activeOrders, filter]);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'placed':
      case 'packed':
        return <Badge tone="yellow">{t('delivery.statusReadyPickup')}</Badge>;
      case 'picked_up':
        return <Badge tone="green">{t('delivery.statusPickedUp')}</Badge>;
      case 'out_for_delivery':
        return <Badge tone="green">{t('delivery.statusOutForDelivery')}</Badge>;
      case 'delivered':
        return <Badge tone="dark">{t('delivery.statusDelivered')}</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading font-bold text-xl text-dark-ink">
          {t('delivery.myDeliveriesTitle')}
        </h1>
        <span className="text-xs text-muted-text tabular-nums">
          {activeOrders.length} active
        </span>
      </div>

      {/* Stat Cards: Today & Pending */}
      <div className="grid grid-cols-2 gap-3" data-testid="delivery-stat-cards">
        <Card padding="md" className="space-y-1 bg-white">
          <div className="flex items-center justify-between text-xs text-muted-text">
            <span className="font-semibold uppercase tracking-wide">
              {t('delivery.statTodayLabel')}
            </span>
            <CheckCircle2 className="w-4 h-4 text-fresh-green" aria-hidden="true" />
          </div>
          <p
            data-testid="stat-today-value"
            className="font-heading font-bold text-2xl text-dark-ink tabular-nums"
          >
            {summary.todayTotalCount}
          </p>
          <p className="text-xs text-fresh-green font-medium">
            {t('delivery.statTodaySub', { done: summary.todayCompletedCount })}
          </p>
        </Card>

        <Card padding="md" className="space-y-1 bg-white">
          <div className="flex items-center justify-between text-xs text-muted-text">
            <span className="font-semibold uppercase tracking-wide">
              {t('delivery.statPendingLabel')}
            </span>
            <Truck className="w-4 h-4 text-warm-yellow-dark" aria-hidden="true" />
          </div>
          <p
            data-testid="stat-pending-value"
            className="font-heading font-bold text-2xl text-dark-ink tabular-nums"
          >
            {summary.pendingCount}
          </p>
          <p className="text-xs text-muted-text font-medium">
            {t('delivery.statPendingSub', { ready: summary.readyToPickUpCount })}
          </p>
        </Card>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={[
            'min-h-[38px] px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer',
            filter === 'all'
              ? 'bg-deep-forest text-white border-deep-forest'
              : 'bg-white text-dark-ink border-border-grey',
          ].join(' ')}
        >
          {t('delivery.filterAllActive', { count: activeOrders.length })}
        </button>
        <button
          type="button"
          onClick={() => setFilter('ready')}
          className={[
            'min-h-[38px] px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer',
            filter === 'ready'
              ? 'bg-deep-forest text-white border-deep-forest'
              : 'bg-white text-dark-ink border-border-grey',
          ].join(' ')}
        >
          {t('delivery.filterReadyPickup', { count: summary.readyToPickUpCount })}
        </button>
        <button
          type="button"
          onClick={() => setFilter('out')}
          className={[
            'min-h-[38px] px-3 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors cursor-pointer',
            filter === 'out'
              ? 'bg-deep-forest text-white border-deep-forest'
              : 'bg-white text-dark-ink border-border-grey',
          ].join(' ')}
        >
          {t('delivery.filterOutForDelivery', {
            count: summary.pickedUpCount + summary.outForDeliveryCount,
          })}
        </button>
      </div>

      {/* Assigned Orders List */}
      {loading ? (
        <div className="space-y-3">
          <Card className="h-32 animate-pulse bg-white/80" />
          <Card className="h-32 animate-pulse bg-white/80" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card padding="lg" className="text-center space-y-2.5 py-10">
          <div className="w-12 h-12 rounded-full bg-light-green text-fresh-green mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="font-heading font-bold text-base text-dark-ink">
            {t('delivery.noPendingTitle')}
          </h2>
          <p className="text-xs text-muted-text max-w-xs mx-auto leading-relaxed">
            {t('delivery.noPendingSubtitle')}
          </p>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="delivery-orders-list">
          {filteredOrders.map((order) => {
            const isCodPending =
              order.payment.method === 'cod' && order.payment.status !== 'paid';
            const totalItemsCount = order.items.reduce(
              (acc, item) => acc + item.quantity,
              0,
            );
            return (
              <Link
                key={order.id}
                to={`/delivery/orders/${order.id}`}
                data-testid={`delivery-order-card-${order.id}`}
                className="block group"
              >
                <Card
                  padding="md"
                  className="space-y-3 hover:border-fresh-green transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading font-bold text-base text-dark-ink">
                          #{order.id}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="font-medium text-sm text-dark-ink mt-1 truncate">
                        {order.customerName}
                      </p>
                    </div>
                    <ChevronRight
                      className="w-5 h-5 text-muted-text group-hover:text-fresh-green shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="flex items-start gap-2 text-xs text-muted-text">
                    <MapPin className="w-4 h-4 text-fresh-green shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="line-clamp-2">
                      {order.address.door}, {order.address.street}
                      {order.address.landmark ? ` (${order.address.landmark})` : ''} ·{' '}
                      {order.address.pincode}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-grey/80">
                    <div className="flex items-center gap-2 text-xs text-muted-text">
                      <Package className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {t('delivery.orderItemsSummary', {
                          count: totalItemsCount,
                          total: formatINR(order.total),
                        })}
                      </span>
                    </div>

                    {isCodPending ? (
                      <Badge
                        tone="yellow"
                        icon={<Banknote className="w-3.5 h-3.5" aria-hidden="true" />}
                      >
                        COD {formatINR(order.total)}
                      </Badge>
                    ) : (
                      <Badge tone="green">
                        {t('orders.paymentPaid', {
                          method: order.payment.method.toUpperCase(),
                        })}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-text">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {formatDateTime(order.createdAt)}
                    </span>
                    <span className="text-fresh-green font-semibold">
                      {lang === 'ta'
                        ? order.items[0]?.name.ta
                        : order.items[0]?.name.en}
                      {order.items.length > 1 ? ` +${order.items.length - 1}` : ''}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
