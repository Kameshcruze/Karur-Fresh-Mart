import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Package, Printer, Store } from 'lucide-react';
import { Button, Card, ErrorStateCard } from '../components/ui';
import { useI18n } from '../context/I18nContext';
import { getOrderById } from '../services';
import type { Order } from '../types';
import { formatINR } from '../utils/format';

export function OrderInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { t, bi, lang } = useI18n();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [hasError, setHasError] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!id) {
      setOrder(null);
      return;
    }
    setHasError(false);
    try {
      const found = await getOrderById(id);
      setOrder(found ?? null);
    } catch {
      setHasError(true);
    }
  }, [id]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  if (hasError) {
    return (
      <div className="space-y-4">
        <h1 className="sr-only">{t('invoice.title')}</h1>
        <ErrorStateCard
          title={t('a11y.loadErrorTitle')}
          subtitle={t('a11y.loadErrorSubtitle')}
          retryLabel={t('a11y.retry')}
          onRetry={() => void loadInvoice()}
        />
      </div>
    );
  }

  if (order === undefined) {
    return (
      <Card padding="lg" className="max-w-3xl mx-auto animate-pulse h-96 bg-white/80" />
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
        <Link to="/orders" className="inline-block">
          <Button variant="primary" size="md">
            {t('orders.backToOrders')}
          </Button>
        </Link>
      </Card>
    );
  }

  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(order.createdAt));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Print & Back Toolbar (hidden during printing) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-fresh-green hover:underline min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t('invoice.backToOrder')}</span>
        </Link>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => window.print()}
          leftIcon={<Printer className="w-4 h-4" />}
        >
          {t('invoice.printButton')}
        </Button>
      </div>

      {/* Printable Invoice Sheet */}
      <Card
        padding="lg"
        data-testid="printable-invoice-sheet"
        className="space-y-6 print:shadow-none print:border print:border-border-grey print:rounded-none"
      >
        {/* Letterhead */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-border-grey">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-fresh-green">
              <Store className="w-5 h-5" aria-hidden="true" />
              <h1 className="font-heading font-bold text-xl sm:text-2xl text-dark-ink">
                {t('invoice.storeTitle')}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-text">
              {t('invoice.storeAddress')}
            </p>
            <p className="text-xs text-muted-text tabular-nums">
              {t('invoice.storeContact')}
            </p>
          </div>

          <div className="sm:text-right space-y-1">
            <span className="inline-block px-3 py-1 rounded-[8px] bg-light-green text-fresh-green font-heading font-bold text-xs uppercase tracking-wide">
              {t('invoice.title')}
            </span>
            <p className="text-xs sm:text-sm text-dark-ink font-semibold tabular-nums pt-1">
              {t('invoice.invoiceNoLabel')}: INV-{order.id}
            </p>
            <p className="text-xs text-muted-text tabular-nums">
              {t('invoice.orderNoLabel')}: {order.id}
            </p>
            <p className="text-xs text-muted-text tabular-nums">
              {t('invoice.invoiceDateLabel')}: {formattedDate}
            </p>
          </div>
        </div>

        {/* Customer & Payment Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-[10px] bg-soft-grey border border-border-grey/80 p-3.5 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-text">
              {t('invoice.billedToTitle')}
            </p>
            <p className="font-heading font-bold text-dark-ink">{order.customerName}</p>
            <p className="text-xs text-dark-ink tabular-nums">+91 {order.customerMobile}</p>
            <p className="text-xs text-muted-text">
              {order.address.door}, {order.address.street}, {order.address.landmark} –{' '}
              {order.address.pincode}
            </p>
          </div>

          <div className="rounded-[10px] bg-soft-grey border border-border-grey/80 p-3.5 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-text">
              {t('invoice.paymentModeLabel')}
            </p>
            <p className="font-heading font-bold text-dark-ink uppercase">
              {order.payment.method} ·{' '}
              {order.payment.status === 'paid'
                ? t('common.paymentStatusPaid')
                : order.payment.status === 'refunded'
                  ? t('common.paymentStatusRefunded')
                  : order.payment.status === 'failed'
                    ? t('common.paymentStatusFailed')
                    : t('common.paymentStatusPending')}
            </p>
            {order.payment.transactionRef && (
              <p className="text-xs text-muted-text tabular-nums">
                {t('invoice.refLabel')}: {order.payment.transactionRef}
              </p>
            )}
            <p className="text-xs text-fresh-green font-semibold tabular-nums">
              {t('invoice.totalSavingsLabel')}: {formatINR(order.savings)}
            </p>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b-2 border-border-grey text-muted-text">
                <th className="py-2.5 pr-3 font-semibold">{t('invoice.colItem')}</th>
                <th className="py-2.5 px-2 font-semibold text-right">{t('invoice.colQty')}</th>
                <th className="py-2.5 px-2 font-semibold text-right">{t('invoice.colMrp')}</th>
                <th className="py-2.5 px-2 font-semibold text-right">{t('invoice.colRate')}</th>
                <th className="py-2.5 pl-2 font-semibold text-right">{t('invoice.colAmount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-grey/60">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-3 align-top">
                    <p className="font-semibold text-dark-ink">{bi(item.name)}</p>
                    <p className="text-xs text-muted-text">{item.packOrSummary}</p>
                    {item.comboSelections && item.comboSelections.length > 0 && (
                      <p className="text-[11px] text-muted-text mt-1">
                        {item.comboSelections
                          .map((s) => `${bi(s.groupName)}: ${s.brandName}`)
                          .join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right tabular-nums align-top">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-2 text-right tabular-nums text-muted-text align-top">
                    {formatINR(item.unitMrp)}
                  </td>
                  <td className="py-3 px-2 text-right tabular-nums align-top">
                    {formatINR(item.unitPrice)}
                  </td>
                  <td className="py-3 pl-2 text-right font-bold tabular-nums align-top">
                    {formatINR(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Footer */}
        <div className="flex justify-end pt-2 border-t border-border-grey">
          <div className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between text-dark-ink">
              <span>{t('cart.itemTotal')}</span>
              <span className="font-semibold tabular-nums">{formatINR(order.subtotal)}</span>
            </div>
            {order.couponDiscount > 0 && (
              <div className="flex justify-between text-fresh-green">
                <span>
                  {t('cart.couponDiscount', { code: order.couponCode ?? '' })}
                </span>
                <span className="font-semibold tabular-nums">
                  -{formatINR(order.couponDiscount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-dark-ink">
              <span>{t('cart.deliveryFee')}</span>
              <span className="font-semibold tabular-nums">
                {order.deliveryFee === 0 ? t('cart.free') : formatINR(order.deliveryFee)}
              </span>
            </div>
            <div className="pt-2 border-t border-border-grey flex items-baseline justify-between">
              <span className="font-heading font-bold text-base text-dark-ink">
                {t('orders.totalLabel')}
              </span>
              <span className="font-heading font-bold text-xl text-dark-ink tabular-nums">
                {formatINR(order.total)}
              </span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-text pt-4 border-t border-border-grey/60">
          {t('invoice.authorisedNote')}
        </p>
      </Card>
    </div>
  );
}
