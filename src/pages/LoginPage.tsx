import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LogOut,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import {
  getRoleHomeRoute,
  isValidIndianMobile,
  normalizeIndianMobile,
  requestMobileOtp,
  verifyMobileOtp,
  type OtpChallengeResponse,
} from '../services';
import type { UserRole } from '../types';

export function LoginPage() {
  const { t } = useI18n();
  const { user, isLoggedIn, loginWithRole, logoutUser, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobileInput, setMobileInput] = useState('');
  const [nameInput, setNameInput] = useState('');
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

  const navigateByRole = (role: UserRole) => {
    if (role === 'customer' && redirectTarget && redirectTarget.startsWith('/')) {
      navigate(redirectTarget, { replace: true });
      return;
    }
    navigate(getRoleHomeRoute(role), { replace: true });
  };

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

    // Handle multi-digit paste inside one box
    if (clean.length > 1) {
      const chars = clean.slice(0, 4).split('');
      setOtpDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < 4; i += 1) {
          next[i] = chars[i] ?? '';
        }
        return next;
      });
      const focusIdx = Math.min(clean.length, 3);
      otpRefs.current[focusIdx]?.focus();
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = clean[0];
      return next;
    });
    if (index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length - 1, 3)]?.focus();
  };

  const handleAutoFillDemoOtp = () => {
    if (!demoToastOtp || demoToastOtp.length !== 4) return;
    setOtpDigits(demoToastOtp.split(''));
    setErrorMsg('');
    otpRefs.current[3]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!challenge) return;
    const code = otpDigits.join('');
    if (code.length < 4) {
      setErrorMsg(t('auth.invalidOtpError'));
      return;
    }
    if (challenge.isNewUser && !nameInput.trim()) {
      setErrorMsg(t('auth.nameRequiredError'));
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await verifyMobileOtp({
        mobile: challenge.mobile,
        otp: code,
        name: challenge.isNewUser ? nameInput.trim() : undefined,
      });
      await refreshAuth();
      setDemoToastOtp(null);
      navigateByRole(loggedUser.role);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('auth.invalidOtpError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoRoleSignIn = async (role: UserRole) => {
    setErrorMsg('');
    const loggedUser = await loginWithRole(role);
    navigateByRole(loggedUser.role);
  };

  const roleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return t('auth.roleAdminLabel');
      case 'delivery':
        return t('auth.roleDeliveryLabel');
      default:
        return t('auth.roleCustomerLabel');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Demo OTP Floating / Inline Toast */}
      {demoToastOtp && (
        <div
          role="status"
          aria-live="polite"
          data-testid="demo-otp-toast"
          className="rounded-[12px] bg-warm-yellow-soft border border-warm-yellow p-4 shadow-[var(--shadow-card)] flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-warm-yellow text-dark-ink flex items-center justify-center shrink-0">
              <MessageSquareText className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm text-dark-ink">
                {t('auth.demoToastTitle')}
              </p>
              <p className="text-sm text-dark-ink mt-0.5 tabular-nums">
                {t('auth.demoToastBody', { otp: demoToastOtp })}
              </p>
              <p className="text-xs text-muted-text mt-1">
                {t('auth.providerSeamNote')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleAutoFillDemoOtp}
            >
              {t('auth.demoToastAutoFill')}
            </Button>
            <button
              type="button"
              onClick={() => setDemoToastOtp(null)}
              aria-label={t('common.cancel')}
              className="w-9 h-9 rounded-[8px] flex items-center justify-center text-dark-ink/70 hover:bg-warm-yellow/40 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Active Signed-In Session Banner */}
      {isLoggedIn && user && (
        <Card padding="md" className="bg-light-green border-fresh-green/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[10px] bg-fresh-green text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-semibold text-sm text-dark-ink truncate">
                  {t('auth.signedInBanner', {
                    name: user.name,
                    role: roleLabel(user.role),
                  })}
                </p>
                <p className="text-xs text-muted-text tabular-nums">+91 {user.mobile}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => navigateByRole(user.role)}
              >
                {t('auth.goToDashboard', { role: roleLabel(user.role) })}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void logoutUser()}
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
              >
                {t('auth.signOut')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main OTP Login Card */}
      <Card padding="lg" className="space-y-6">
        <div className="space-y-2">
          <div className="w-11 h-11 rounded-[12px] bg-light-green text-fresh-green flex items-center justify-center">
            <KeyRound className="w-5 h-5" aria-hidden="true" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-dark-ink">
            {step === 'mobile' ? t('auth.title') : t('auth.otpTitle')}
          </h1>
          <p className="text-sm text-muted-text leading-relaxed">
            {step === 'mobile'
              ? t('auth.subtitle')
              : t('auth.otpSentTo', { mobile: challenge?.mobile ?? '' })}
          </p>
        </div>

        {step === 'mobile' ? (
          <form onSubmit={(e) => void handleSendOtp(e)} className="space-y-4">
            <div>
              <label
                htmlFor="login-mobile-input"
                className="block text-sm font-medium text-dark-ink mb-1.5"
              >
                {t('auth.mobileLabel')}
              </label>
              <div className="flex items-stretch gap-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 rounded-[10px] bg-soft-grey border border-border-grey text-sm font-semibold text-dark-ink tabular-nums shrink-0">
                  <Phone className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
                  <span>+91</span>
                </span>
                <input
                  id="login-mobile-input"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={mobileInput}
                  onChange={(e) => {
                    setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10));
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder={t('auth.mobilePlaceholder')}
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-[10px] bg-white border border-border-grey text-base font-medium text-dark-ink placeholder:text-muted-text tabular-nums focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/20"
                />
              </div>
              {errorMsg && (
                <p role="alert" className="mt-1.5 text-xs font-medium text-alert-red">
                  {errorMsg}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isSubmitting ? t('auth.sendingOtp') : t('auth.sendOtp')}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleVerifyOtp(e)} className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-grey/70">
              <div className="flex items-center gap-2">
                {challenge?.isNewUser ? (
                  <Badge tone="yellow" icon={<Sparkles className="w-3 h-3" />}>
                    {t('auth.newUserBadge')}
                  </Badge>
                ) : (
                  <Badge tone="green" icon={<ShieldCheck className="w-3 h-3" />}>
                    {t('auth.welcomeBack', {
                      name: challenge?.existingUserName ?? '',
                    })}
                  </Badge>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('mobile');
                  setErrorMsg('');
                  setDemoToastOtp(null);
                }}
                className="text-xs font-semibold text-fresh-green hover:underline min-h-[36px] px-2 cursor-pointer"
              >
                {t('auth.changeNumber')}
              </button>
            </div>

            {challenge?.isNewUser && (
              <Input
                label={t('auth.nameLabel')}
                placeholder={t('auth.namePlaceholder')}
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                leftIcon={<UserIcon className="w-4 h-4" />}
                autoComplete="name"
              />
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-dark-ink">
                {t('auth.otpDigitsLabel')}
              </label>

              <div className="grid grid-cols-4 gap-3 max-w-xs">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    maxLength={4}
                    aria-label={t('auth.otpDigitAria', { index: idx + 1 })}
                    value={digit}
                    onChange={(e) => {
                      handleOtpDigitChange(idx, e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    className="h-14 w-full text-center font-heading font-bold text-2xl text-dark-ink tabular-nums rounded-[12px] bg-soft-grey border border-border-grey focus:bg-white focus:outline-none focus:border-fresh-green focus:ring-2 focus:ring-fresh-green/25 transition-colors"
                  />
                ))}
              </div>

              {errorMsg && (
                <p role="alert" className="text-xs font-medium text-alert-red pt-1">
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              {resendSeconds > 0 ? (
                <span className="text-muted-text tabular-nums">
                  {t('auth.resendIn', { seconds: resendSeconds })}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSendOtp()}
                  className="font-semibold text-fresh-green hover:underline min-h-[40px] cursor-pointer"
                >
                  {t('auth.resendNow')}
                </button>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isSubmitting ? t('auth.verifying') : t('auth.verifyContinue')}
            </Button>
          </form>
        )}
      </Card>

      {/* Quick Demo Role Accounts */}
      <Card padding="md" className="space-y-3">
        <div>
          <h2 className="font-heading font-semibold text-sm text-dark-ink">
            {t('auth.demoRolesHeading')}
          </h2>
          <p className="text-xs text-muted-text mt-0.5">
            {t('auth.demoRolesSubheading')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => void handleDemoRoleSignIn('customer')}
            className="flex items-center gap-2.5 p-3 rounded-[10px] border border-border-grey bg-soft-grey hover:bg-light-green hover:border-fresh-green/40 text-left transition-colors min-h-[56px] cursor-pointer"
          >
            <span className="w-8 h-8 rounded-[8px] bg-white text-fresh-green flex items-center justify-center shrink-0 border border-border-grey/60">
              <UserIcon className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-dark-ink truncate">
                {t('auth.roleCustomerLabel')}
              </span>
              <span className="block text-[11px] text-muted-text tabular-nums">
                9842241088
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleDemoRoleSignIn('admin')}
            className="flex items-center gap-2.5 p-3 rounded-[10px] border border-border-grey bg-soft-grey hover:bg-light-green hover:border-fresh-green/40 text-left transition-colors min-h-[56px] cursor-pointer"
          >
            <span className="w-8 h-8 rounded-[8px] bg-deep-forest text-white flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-dark-ink truncate">
                {t('auth.roleAdminLabel')}
              </span>
              <span className="block text-[11px] text-muted-text tabular-nums">
                9842211001
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleDemoRoleSignIn('delivery')}
            className="flex items-center gap-2.5 p-3 rounded-[10px] border border-border-grey bg-soft-grey hover:bg-light-green hover:border-fresh-green/40 text-left transition-colors min-h-[56px] cursor-pointer"
          >
            <span className="w-8 h-8 rounded-[8px] bg-warm-yellow text-dark-ink flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-dark-ink truncate">
                {t('auth.roleDeliveryLabel')}
              </span>
              <span className="block text-[11px] text-muted-text tabular-nums">
                9789422109
              </span>
            </span>
          </button>
        </div>
      </Card>
    </div>
  );
}
