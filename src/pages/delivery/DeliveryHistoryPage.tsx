import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Clock, IndianRupee, MapPin, PackageCheck } from 'lucide-react';
import { Badge, Card, ErrorStateCard, ListSkeleton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import {
  computeDeliveryDashboardSummary,
  computeOrderPayoutInr,
  getAssignedDeliveries,
  getDeliveryPartners,
  resolvePartnerForUser,
  subscribeToOrderUpdates,
} from '../../services';
import type { Order } from '../../types';
import { formatDateTime, formatINR } from '../../utils/format';

export function DeliveryHistoryPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';

  const [orders, setOrders] = useState<Order[]>([]);
  const [partnerId, setPartnerId] = useState('dp-1');
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const partners = await getDeliveryPartners();
      const resolved = resolvePartnerForUser(user?.id, user?.mobile, partners);
      const activePartnerId = resolved?.id ?? 'dp-1';
      setPartnerId(activePartnerId);
      const assigned = await getAssignedDeliveries(activePartnerId);
      setOrders(assigned);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.mobile]);

  useEffect(() => {
    void loadData();
    return subscribeToOrderUpdates(() => {
      void loadData();
    });
  }, [loadData]);

  const summary = useMemo(
    () => computeDeliveryDashboardSummary(partnerId, orders),
    [partnerId, orders],
  );

  const completedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'delivered')
        .sort((a, b) =>
          (b.deliveryAssignment?.deliveredAt ?? b.updatedAt).localeCompare(
            a.deliveryAssignment?.deliveredAt ?? a.updatedAt,
          ),
        ),
    [orders],
  );

  return (
    <div className="space-y-4" data-testid="delivery-history-page">
      <h1 className="font-heading font-bold text-xl text-dark-ink">
        {t('delivery.historyTitle')}
      </h1>

      {/* Earnings & Settlement Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[12px] p-4 sm:p-5 space-y-1 bg-deep-forest text-white border border-deep-forest shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2 text-xs text-white/85">
            <span className="font-semibold uppercase tracking-wide leading-tight">
              {t('delivery.totalEarnedLabel')}
            </span>
            <IndianRupee className="w-4 h-4 text-bright-green shrink-0" aria-hidden="true" />
          </div>
          <p
            data-testid="total-earned-value"
            className="font-heading font-bold text-2xl text-white tabular-nums"
          >
            {formatINR(summary.totalEarningsInr)}
          </p>
        </div>

        <Card padding="md" className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-text">
            <span className="font-semibold uppercase tracking-wide leading-tight">
              {t('delivery.todayEarnedLabel')}
            </span>
            <CheckCircle2 className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
          </div>
          <p
            data-testid="today-earned-value"
            className="font-heading font-bold text-2xl text-fresh-green tabular-nums"
          >
            {formatINR(summary.todayEarningsInr)}
          </p>
        </Card>

        <Card padding="md" className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-text">
            <span className="font-semibold uppercase tracking-wide leading-tight">
              {t('delivery.completedCountLabel')}
            </span>
            <PackageCheck className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
          </div>
          <p
            data-testid="completed-drops-count"
            className="font-heading font-bold text-xl text-dark-ink tabular-nums"
          >
            {summary.completedCount}
          </p>
        </Card>

        <Card padding="md" className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-text">
            <span className="font-semibold uppercase tracking-wide leading-tight">
              {t('delivery.codHoldLabel')}
            </span>
            <Banknote className="w-4 h-4 text-warm-yellow-dark shrink-0" aria-hidden="true" />
          </div>
          <p
            data-testid="cod-settle-value"
            className="font-heading font-bold text-xl text-dark-ink tabular-nums"
          >
            {formatINR(summary.codCollectedToSettleInr)}
          </p>
        </Card>
      </div>

      {/* Completed Deliveries History List */}
      {loading ? (
        <ListSkeleton rows={2} rowHeightClass="h-24" />
      ) : hasError ? (
        <ErrorStateCard
          title={t('a11y.loadErrorTitle')}
          subtitle={t('a11y.loadErrorSubtitle')}
          retryLabel={t('a11y.retry')}
          onRetry={() => void loadData()}
        />
      ) : completedOrders.length === 0 ? (
        <Card padding="lg" className="text-center text-sm text-muted-text py-10">
          {t('delivery.noCompletedHistory')}
        </Card>
      ) : (
        <div className="space-y-3" data-testid="completed-deliveries-list">
          {completedOrders.map((order) => {
            const payout = computeOrderPayoutInr(order);
            const deliveredAt =
              order.deliveryAssignment?.deliveredAt ?? order.updatedAt;
            return (
              <Card
                key={order.id}
                padding="md"
                data-testid={`completed-order-${order.id}`}
                className="space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-bold text-base text-dark-ink">
                        #{order.id}
                      </span>
                      <Badge tone="green">{t('delivery.statusDelivered')}</Badge>
                    </div>
                    <p className="text-sm font-medium text-dark-ink mt-1">
                      {order.customerName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-fresh-green tabular-nums">
                      {t('delivery.payoutPerDrop', { amount: formatINR(payout) })}
                    </p>
                    <p className="text-[11px] text-muted-text tabular-nums">
                      {t('orders.orderNumberLabel')} {formatINR(order.total)} · {order.payment.method.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-text">
                  <MapPin className="w-3.5 h-3.5 text-fresh-green shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="truncate">
                    {order.address.door}, {order.address.street}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-text pt-1.5 border-t border-border-grey/80">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {formatDateTime(deliveredAt, locale)}
                  </span>
                  <span className="text-dark-ink font-medium">
                    {t('delivery.otpVerifiedChip')}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
