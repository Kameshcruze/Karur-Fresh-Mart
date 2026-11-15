import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Button } from '../ui';
import { useI18n } from '../../context/I18nContext';
import { verifyPayment } from '../../services';
import type { PaymentOrder, PaymentVerificationResult } from '../../types';
import { formatINR } from '../../utils/format';

export interface RazorpayMockModalProps {
  paymentOrder: PaymentOrder;
  methodLabel: string;
  onSuccess: (verification: PaymentVerificationResult) => Promise<void>;
  onSwitchToCod: () => Promise<void>;
  onClose: () => void;
}

export function RazorpayMockModal({
  paymentOrder,
  methodLabel,
  onSuccess,
  onSwitchToCod,
  onClose,
}: RazorpayMockModalProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failureMessage, setFailureMessage] = useState('');

  const handleSimulateSuccess = async () => {
    setBusy(true);
    setFailureMessage('');
    try {
      const verification = await verifyPayment({
        paymentOrderId: paymentOrder.id,
        simulateSuccess: true,
      });
      if (verification.verified) {
        await onSuccess(verification);
      } else {
        setFailureMessage(verification.failureReason ?? t('checkout.paymentFailedTitle'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSimulateFailure = async () => {
    setBusy(true);
    setFailureMessage('');
    try {
      const verification = await verifyPayment({
        paymentOrderId: paymentOrder.id,
        simulateSuccess: false,
      });
      setFailureMessage(verification.failureReason ?? t('checkout.paymentFailedTitle'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="razorpay-modal-title"
      data-testid="razorpay-mock-modal"
      className="fixed inset-0 z-50 bg-dark-ink/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-[12px] bg-white shadow-[0_24px_48px_rgba(17,24,39,0.28)] overflow-hidden border border-border-grey">
        {/* Gateway Brand Header */}
        <div className="bg-deep-forest text-white p-4 sm:p-5 flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-warm-yellow font-semibold">
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span id="razorpay-modal-title">{t('checkout.razorpayTitle')}</span>
            </div>
            <p className="font-heading font-bold text-base sm:text-lg leading-snug">
              {t('checkout.razorpayMerchant')}
            </p>
            <p className="text-xs text-white/75 tabular-nums">
              {t('checkout.razorpayOrderRef')}: {paymentOrder.id}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-heading font-bold text-xl text-warm-yellow tabular-nums">
              {formatINR(paymentOrder.amount)}
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={t('checkout.cancelPayment')}
              className="w-9 h-9 rounded-[8px] bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="rounded-[10px] bg-soft-grey border border-border-grey/80 px-3.5 py-3 flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-text">
              <CreditCard className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
              <span>{t('checkout.razorpayMethodLabel')}</span>
            </div>
            <span className="font-semibold text-dark-ink">{methodLabel}</span>
          </div>

          {failureMessage ? (
            <div
              role="alert"
              data-testid="payment-failure-alert"
              className="rounded-[10px] bg-alert-red-soft border border-alert-red/30 p-3.5 space-y-3"
            >
              <div className="flex items-start gap-2.5 text-alert-red">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs sm:text-sm space-y-1">
                  <p className="font-bold">{t('checkout.paymentFailedTitle')}</p>
                  <p className="text-dark-ink/85">{failureMessage}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleSimulateSuccess()}
                >
                  {t('checkout.retryPayment')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onSwitchToCod()}
                >
                  {t('checkout.switchToCod')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-[10px] bg-light-green/80 border border-fresh-green/20 px-3.5 py-2.5 flex items-start gap-2 text-xs text-dark-ink">
              <ShieldCheck className="w-4 h-4 text-fresh-green shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t('checkout.razorpayHookNote')}</span>
            </div>
          )}

          {/* Simulation Buttons */}
          <div className="space-y-2.5 pt-1">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              disabled={busy}
              onClick={() => void handleSimulateSuccess()}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              {busy ? t('checkout.verifyingPayment') : t('checkout.simulateSuccess')}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              fullWidth
              disabled={busy}
              onClick={() => void handleSimulateFailure()}
              className="border-alert-red/50 text-alert-red hover:bg-alert-red-soft hover:border-alert-red"
            >
              {t('checkout.simulateFailure')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
