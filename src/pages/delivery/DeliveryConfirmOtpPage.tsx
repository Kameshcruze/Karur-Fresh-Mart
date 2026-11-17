import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NumericOtpKeypad } from '../../components/delivery';
import { Badge, Button, Card } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import {
  computeOrderPayoutInr,
  getOrderById,
  subscribeToOrderUpdates,
  verifyDeliveryOtpAndComplete,
} from '../../services';
import type { Order } from '../../types';
import { formatDateTime, formatINR } from '../../utils/format';

export function DeliveryConfirmOtpPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | undefined>(undefined);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    const found = await getOrderById(id);
    setOrder(found);
    if (found?.status === 'delivered') {
      setCompletedOrder(found);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadOrder();
    return subscribeToOrderUpdates(() => {
      void loadOrder();
    });
  }, [loadOrder]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Card className="h-32 animate-pulse bg-white/80" />
        <Card className="h-64 animate-pulse bg-white/80" />
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

  const handleOtpChange = (next: string) => {
    setOtp(next);
    if (errorMsg) setErrorMsg('');
  };

  const handleVerify = async () => {
    if (otp.length !== 4) {
      setErrorMsg(t('delivery.incompleteOtpError'));
      return;
    }

    setVerifying(true);
    setErrorMsg('');
    try {
      const result = await verifyDeliveryOtpAndComplete(order.id, otp);
      if (!result.success || !result.order) {
        setErrorMsg(t('delivery.wrongOtpError'));
        return;
      }
      setCompletedOrder(result.order);
      setOrder(result.order);
    } finally {
      setVerifying(false);
    }
  };

  if (completedOrder && completedOrder.status === 'delivered') {
    const payout = computeOrderPayoutInr(completedOrder);
    return (
      <div className="space-y-4 py-4" data-testid="delivery-completed-screen">
        <Card padding="lg" className="text-center space-y-4 border-fresh-green/40 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-light-green text-fresh-green mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <Badge tone="green">{t('delivery.deliveredSuccessBadge')}</Badge>
            <h1 className="font-heading font-bold text-xl text-dark-ink">
              {t('delivery.deliveredSuccessTitle', { id: completedOrder.id })}
            </h1>
            <p className="text-xs text-muted-text">
              {t('delivery.deliveredAtLabel', {
                time: formatDateTime(
                  completedOrder.deliveryAssignment?.deliveredAt ??
                    completedOrder.updatedAt,
                ),
              })}
            </p>
          </div>

          <div className="rounded-[12px] bg-light-green/70 p-3.5 text-sm font-bold text-fresh-green">
            {t('delivery.deliveredSuccessEarn', { amount: formatINR(payout) })}
          </div>

          {completedOrder.payment.method === 'cod' && (
            <div className="rounded-[12px] bg-warm-yellow/25 border border-warm-yellow p-3 text-xs font-semibold text-dark-ink">
              {t('delivery.deliveredCodCollectedNote', {
                amount: formatINR(completedOrder.total),
              })}
            </div>
          )}

          <div className="space-y-2.5 pt-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/delivery')}
            >
              {t('delivery.backToMyDeliveriesCta')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              fullWidth
              onClick={() => navigate('/delivery/history')}
            >
              {t('delivery.viewEarningsCta')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isCodPending = order.payment.method === 'cod' && order.payment.status !== 'paid';

  return (
    <div className="space-y-4 pb-6" data-testid="delivery-confirm-otp-page">
      <Link
        to={`/delivery/orders/${order.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-dark-ink hover:text-fresh-green min-h-[40px]"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>#{order.id}</span>
      </Link>

      <Card padding="lg" className="space-y-5">
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-[12px] bg-warm-yellow/35 text-dark-ink mx-auto flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="font-heading font-bold text-xl text-dark-ink">
            {t('delivery.confirmTitle')}
          </h1>
          <p className="text-xs text-muted-text max-w-xs mx-auto leading-relaxed">
            {t('delivery.confirmSubtitle', { name: order.customerName })}
          </p>
        </div>

        {/* Payment Reminder */}
        <div
          className={[
            'rounded-[10px] px-3.5 py-2.5 text-xs font-semibold flex items-center justify-center gap-2',
            isCodPending
              ? 'bg-warm-yellow/30 text-dark-ink border border-warm-yellow'
              : 'bg-light-green text-fresh-green',
          ].join(' ')}
        >
          <Banknote className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {isCodPending
              ? t('delivery.confirmCodReminder', { amount: formatINR(order.total) })
              : t('delivery.confirmPaidReminder', { amount: formatINR(order.total) })}
          </span>
        </div>

        {errorMsg && (
          <div
            role="alert"
            data-testid="delivery-otp-error"
            className="rounded-[10px] bg-alert-red-soft border border-alert-red/40 px-3.5 py-2.5 text-xs sm:text-sm text-alert-red font-semibold flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <NumericOtpKeypad
          value={otp}
          onChange={handleOtpChange}
          onSubmit={handleVerify}
          disabled={verifying}
          hasError={Boolean(errorMsg)}
        />

        <p className="text-[11px] text-muted-text text-center leading-relaxed">
          {t('delivery.confirmHint')}
        </p>

        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          disabled={verifying || otp.length !== 4}
          onClick={handleVerify}
          data-testid="verify-complete-delivery-btn"
          leftIcon={<CheckCircle2 className="w-5 h-5" />}
        >
          {verifying ? t('delivery.verifyingOtp') : t('delivery.verifyCompleteCta')}
        </Button>
      </Card>
    </div>
  );
}
