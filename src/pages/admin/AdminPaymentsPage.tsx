import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, ErrorStateCard, ListSkeleton } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import { getOrders, refundOrderPayment } from '../../services';
import type { Order, PaymentMethod, PaymentStatus } from '../../types';
import { formatINR } from '../../utils/format';

export function AdminPaymentsPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const list = await getOrders();
      setOrders(list);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const paymentStatusLabel = (st: PaymentStatus): string => {
    switch (st) {
      case 'paid':
        return t('common.paymentStatusPaid');
      case 'refunded':
        return t('common.paymentStatusRefunded');
      case 'failed':
        return t('common.paymentStatusFailed');
      default:
        return t('common.paymentStatusPending');
    }
  };

  const methodLabel = (method: PaymentMethod): string => {
    switch (method) {
      case 'upi':
        return t('checkout.payUpi');
      case 'card':
        return t('checkout.payCard');
      case 'netbanking':
        return t('checkout.payNetBanking');
      case 'wallet':
        return t('checkout.payWallet');
      case 'cod':
        return t('checkout.payCod');
    }
  };

  const kpis = useMemo(() => {
    let totalCollected = 0;
    let onlinePaid = 0;
    let codPending = 0;
    let refunded = 0;

    for (const o of orders) {
      if (o.payment.status === 'paid') {
        totalCollected += o.payment.amount;
        if (o.payment.method !== 'cod') {
          onlinePaid += o.payment.amount;
        }
      } else if (o.payment.status === 'pending') {
        codPending += o.payment.amount;
      } else if (o.payment.status === 'refunded') {
        refunded += o.payment.amount;
      }
    }
    return { totalCollected, onlinePaid, codPending, refunded };
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.payment.status !== statusFilter) return false;
      if (methodFilter !== 'all' && o.payment.method !== methodFilter) return false;
      return true;
    });
  }, [orders, statusFilter, methodFilter]);

  const handleRefund = async (orderId: string) => {
    await refundOrderPayment(orderId);
    await loadData();
    const msg = t('admin.paymentRefundedToast', { id: orderId });
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading font-bold text-2xl text-dark-ink">
          {t('admin.paymentsTitle')}
        </h1>
        <p className="text-sm text-muted-text mt-0.5">{t('admin.paymentsSubtitle')}</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card padding="md">
          <p className="text-xs font-semibold text-muted-text">{t('admin.kpiCollected')}</p>
          <p className="font-heading font-bold text-xl text-fresh-green tabular-nums mt-1">
            {formatINR(kpis.totalCollected)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-semibold text-muted-text">{t('admin.kpiOnlinePaid')}</p>
          <p className="font-heading font-bold text-xl text-dark-ink tabular-nums mt-1">
            {formatINR(kpis.onlinePaid)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-semibold text-muted-text">{t('admin.kpiCodPending')}</p>
          <p className="font-heading font-bold text-xl text-dark-ink tabular-nums mt-1">
            {formatINR(kpis.codPending)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-semibold text-muted-text">{t('admin.kpiRefunded')}</p>
          <p className="font-heading font-bold text-xl text-alert-red tabular-nums mt-1">
            {formatINR(kpis.refunded)}
          </p>
        </Card>
      </div>

      {toastMsg && (
        <div
          role="status"
          className="rounded-[10px] bg-light-green border border-fresh-green/35 px-4 py-3 flex items-center gap-2 text-sm font-semibold text-fresh-green"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'paid', 'pending', 'refunded'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={[
                'min-h-[38px] px-3.5 rounded-[10px] text-xs font-semibold cursor-pointer',
                statusFilter === st
                  ? 'bg-fresh-green text-white'
                  : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
              ].join(' ')}
            >
              {st === 'all' ? t('admin.filterStatusAllPayments') : paymentStatusLabel(st)}
            </button>
          ))}
        </div>

        <select
          aria-label={t('admin.filterMethodAll')}
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value as 'all' | PaymentMethod)}
          className="min-h-[38px] px-3 rounded-[10px] border border-border-grey bg-white text-xs font-semibold text-dark-ink cursor-pointer"
        >
          <option value="all">{t('admin.filterMethodAll')}</option>
          <option value="upi">{t('checkout.payUpi')}</option>
          <option value="card">{t('checkout.payCard')}</option>
          <option value="netbanking">{t('checkout.payNetBanking')}</option>
          <option value="wallet">{t('checkout.payWallet')}</option>
          <option value="cod">{t('checkout.payCod')}</option>
        </select>
      </div>

      {loading ? (
        <ListSkeleton rows={4} rowHeightClass="h-16" />
      ) : hasError ? (
        <ErrorStateCard
          title={t('a11y.loadErrorTitle')}
          subtitle={t('a11y.loadErrorSubtitle')}
          retryLabel={t('a11y.retry')}
          onRetry={() => void loadData()}
        />
      ) : (
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-soft-grey border-b border-border-grey text-xs uppercase tracking-wide text-muted-text">
                <th className="py-3 px-4 font-semibold">{t('admin.colOrderId')}</th>
                <th className="py-3 px-4 font-semibold">{t('admin.colCustomer')}</th>
                <th className="py-3 px-4 font-semibold">{t('invoice.paymentModeLabel')}</th>
                <th className="py-3 px-4 font-semibold">{t('admin.colStatus')}</th>
                <th className="py-3 px-4 font-semibold text-right">{t('admin.colTotal')}</th>
                <th className="py-3 px-4 font-semibold text-right">{t('admin.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-grey/70">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-soft-grey/60">
                  <td className="py-3.5 px-4 font-heading font-bold text-dark-ink tabular-nums">
                    {order.id}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-dark-ink">{order.customerName}</p>
                    <p className="text-xs text-muted-text tabular-nums">
                      {order.payment.transactionRef ?? t('admin.codSettlementRef')}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-dark-ink">
                      <CreditCard className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
                      {methodLabel(order.payment.method)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge
                      tone={
                        order.payment.status === 'paid'
                          ? 'green'
                          : order.payment.status === 'refunded'
                            ? 'red'
                            : 'yellow'
                      }
                    >
                      {paymentStatusLabel(order.payment.status)}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right font-heading font-bold tabular-nums">
                    {formatINR(order.payment.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {order.payment.status === 'paid' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label={`${t('admin.refundPaymentCta')} ${order.id}`}
                        onClick={() => void handleRefund(order.id)}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5 text-alert-red" />}
                      >
                        {t('admin.refundPaymentCta')}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-text">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}
