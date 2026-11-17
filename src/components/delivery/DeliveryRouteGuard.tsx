import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  MessageSquareText,
  Phone,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, Input } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import {
  isValidIndianMobile,
  normalizeIndianMobile,
  requestMobileOtp,
  verifyMobileOtp,
  type OtpChallengeResponse,
} from '../../services';

export function DeliveryRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, isLoading, loginWithRole, refreshAuth } = useAuth();
  const { t } = useI18n();

  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobileInput, setMobileInput] = useState('9789422109');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const [challenge, setChallenge] = useState<OtpChallengeResponse | null>(null);
  const [demoToastOtp, setDemoToastOtp] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-soft-grey flex items-center justify-center p-4">
        <Card className="w-full max-w-md h-56 animate-pulse bg-white/80" />
      </div>
    );
  }

  if (isLoggedIn && user?.role === 'delivery') {
    return <>{children}</>;
  }

  const currentRoleLabel =
    user?.role === 'admin' ? t('common.roleAdmin') : t('common.roleCustomer');

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    const normalized = normalizeIndianMobile(mobileInput);
    if (!isValidIndianMobile(normalized)) {
      setErrorMsg(t('auth.invalidMobileError'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestMobileOtp(normalized);
      setChallenge(result);
      setDemoToastOtp(result.otpPreview);
      setResendSeconds(result.resendSeconds);
      setOtpDigits(['', '', '', '']);
      setStep('otp');
      window.setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 60);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('auth.invalidMobileError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpDigitChange = (index: number, rawValue: string) => {
    const clean = rawValue.replace(/\D/g, '');
    if (!clean) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    if (clean.length > 1) {
      const chars = clean.slice(0, 4).split('');
      setOtpDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < 4; i += 1) {
          next[i] = chars[i] ?? '';
        }
        return next;
      });
      otpRefs.current[Math.min(clean.length, 3)]?.focus();
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });

    if (index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFillDemoOtp = () => {
    if (!demoToastOtp) return;
    setOtpDigits(demoToastOtp.split('').slice(0, 4));
    otpRefs.current[3]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const otp = otpDigits.join('');
    if (otp.length !== 4) {
      setErrorMsg(t('auth.invalidOtpError'));
      return;
    }

    setIsSubmitting(true);
    try {
      const verified = await verifyMobileOtp({
        mobile: challenge?.mobile ?? mobileInput,
        otp,
      });
      if (verified.role !== 'delivery') {
        const verifiedRoleLabel =
          verified.role === 'admin' ? t('common.roleAdmin') : t('common.roleCustomer');
        setErrorMsg(
          t('delivery.nonDeliveryNotice', {
            name: verified.name,
            role: verifiedRoleLabel,
          }),
        );
        return;
      }
      await refreshAuth();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('auth.invalidOtpError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoRider = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await loginWithRole('delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="delivery-login-screen"
      className="min-h-screen bg-soft-grey flex flex-col"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-[8px] focus:bg-fresh-green focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        {t('a11y.skipToContent')}
      </a>
      {/* Phone-first Deep Forest header */}
      <header className="bg-deep-forest text-white border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label={t('nav.backToStore')}
              className="min-w-[44px] min-h-[44px] rounded-[10px] bg-white/10 hover:bg-white/15 inline-flex items-center justify-center shrink-0"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </Link>
            <div>
              <p className="font-heading font-bold text-base leading-tight">
                {t('brand.shortName')} · {t('delivery.portalTitle')}
              </p>
              <p className="text-xs text-white/85">{t('brand.tagline')}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bright-green/20 text-bright-green text-xs font-semibold">
            <Truck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('delivery.riderBadge')}</span>
          </span>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 w-full max-w-lg mx-auto px-4 py-6 flex flex-col justify-center space-y-4 focus:outline-none"
      >
        {/* Demo OTP Toast Banner */}
        {demoToastOtp && step === 'otp' && (
          <div
            role="status"
            data-testid="delivery-otp-toast"
            className="rounded-[12px] bg-deep-forest text-white p-3.5 shadow-md flex items-center justify-between gap-3 border border-bright-green/40"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-[10px] bg-bright-green/20 text-bright-green flex items-center justify-center shrink-0">
                <MessageSquareText className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-bright-green font-semibold">
                  {t('auth.demoToastTitle')}
                </p>
                <p className="text-sm font-medium text-white">
                  {t('auth.demoToastBody', { otp: demoToastOtp })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleAutoFillDemoOtp}
                className="min-h-[36px] px-2.5 rounded-[8px] bg-bright-green text-dark-ink text-xs font-bold cursor-pointer"
              >
                {t('auth.demoToastAutoFill')}
              </button>
              <button
                type="button"
                aria-label={t('admin.closePanel')}
                onClick={() => setDemoToastOtp(null)}
                className="min-w-[32px] min-h-[32px] rounded-[8px] text-white/85 hover:text-white inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <Card padding="lg" className="space-y-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[12px] bg-light-green text-fresh-green flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl text-dark-ink">
                {t('delivery.loginTitle')}
              </h1>
              <p className="text-xs text-muted-text leading-relaxed">
                {t('delivery.loginSubtitle')}
              </p>
            </div>
          </div>

          {isLoggedIn && user && user.role !== 'delivery' && (
            <div className="rounded-[10px] bg-warm-yellow/25 border border-warm-yellow/60 p-3 text-xs text-dark-ink">
              {t('delivery.nonDeliveryNotice', {
                name: user.name,
                role: currentRoleLabel,
              })}
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-[10px] bg-alert-red-soft border border-alert-red/30 px-3.5 py-2.5 text-sm text-alert-red font-medium"
            >
              {errorMsg}
            </div>
          )}

          {step === 'mobile' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label
                  htmlFor="delivery-mobile-input"
                  className="block text-sm font-medium text-dark-ink mb-1.5"
                >
                  {t('auth.mobileLabel')}
                </label>
                <div className="flex items-stretch gap-2">
                  <div className="px-3.5 rounded-[10px] bg-soft-grey border border-border-grey flex items-center text-sm font-semibold text-dark-ink shrink-0">
                    +91
                  </div>
                  <Input
                    id="delivery-mobile-input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder={t('auth.mobilePlaceholder')}
                    leftIcon={<Phone className="w-4 h-4" />}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isSubmitting}
              >
                {t('auth.sendOtp')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-text bg-soft-grey px-3 py-2 rounded-[10px]">
                <span>
                  {t('auth.otpSentTo', {
                    mobile: challenge?.mobile ?? mobileInput,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStep('mobile');
                    setErrorMsg('');
                  }}
                  className="text-fresh-green font-semibold hover:underline cursor-pointer"
                >
                  {t('auth.changeNumber')}
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-dark-ink">
                  {t('auth.otpDigitsLabel')}
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      aria-label={t('auth.otpDigitAria', { index: index + 1 })}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="h-14 w-full rounded-[12px] border border-border-grey bg-white text-center text-2xl font-heading font-bold text-dark-ink focus:outline-none focus:ring-2 focus:ring-fresh-green/30 focus:border-fresh-green"
                    />
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isSubmitting}
                leftIcon={<KeyRound className="w-4 h-4" />}
              >
                {t('auth.verifyContinue')}
              </Button>

              <div className="text-center text-xs text-muted-text">
                {resendSeconds > 0 ? (
                  <span>{t('auth.resendIn', { seconds: resendSeconds })}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSendOtp()}
                    className="text-fresh-green font-semibold hover:underline cursor-pointer"
                  >
                    {t('auth.resendNow')}
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="pt-3 border-t border-border-grey space-y-2">
            <Button
              type="button"
              variant="yellow"
              size="md"
              fullWidth
              onClick={handleQuickDemoRider}
              disabled={isSubmitting}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              {t('delivery.demoRiderCta', {
                name: 'Karthikeyan R',
                mobile: '9789422109',
              })}
            </Button>
            <p className="text-[11px] text-muted-text text-center flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-fresh-green shrink-0" />
              <span>{t('auth.providerSeamNote')}</span>
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
