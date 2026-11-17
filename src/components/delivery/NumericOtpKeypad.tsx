import { useEffect } from 'react';
import { Delete, RotateCcw } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

export interface NumericOtpKeypadProps {
  value: string;
  onChange: (nextOtp: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  hasError?: boolean;
}

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function NumericOtpKeypad({
  value,
  onChange,
  onSubmit,
  disabled = false,
  hasError = false,
}: NumericOtpKeypadProps) {
  const { t } = useI18n();

  const handleAppendDigit = (digit: string) => {
    if (disabled || value.length >= 4) return;
    onChange(`${value}${digit}`);
  };

  const handleBackspace = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange('');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        if (value.length < 4) {
          onChange(`${value}${event.key}`);
        }
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        if (value.length > 0) {
          onChange(value.slice(0, -1));
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onChange('');
      } else if (event.key === 'Enter' && value.length === 4 && onSubmit) {
        event.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, onChange, onSubmit, value]);

  return (
    <div className="space-y-4">
      {/* 4 OTP Boxes */}
      <div
        role="group"
        aria-label={t('delivery.confirmTitle')}
        className="grid grid-cols-4 gap-3 max-w-xs mx-auto"
      >
        {[0, 1, 2, 3].map((slot) => {
          const digit = value[slot] ?? '';
          const isCurrent = !disabled && slot === value.length;
          return (
            <div
              key={slot}
              data-testid={`delivery-otp-box-${slot}`}
              className={[
                'h-16 rounded-[12px] border-2 flex items-center justify-center font-heading font-bold text-3xl tabular-nums transition-all',
                hasError
                  ? 'border-alert-red bg-alert-red-soft/50 text-alert-red'
                  : digit
                    ? 'border-fresh-green bg-light-green/50 text-dark-ink'
                    : isCurrent
                      ? 'border-fresh-green bg-white text-dark-ink ring-2 ring-fresh-green/20'
                      : 'border-border-grey bg-white text-muted-text',
              ].join(' ')}
            >
              {digit || (isCurrent ? '•' : '')}
            </div>
          );
        })}
      </div>

      {/* Phone-first 3x4 Numeric Keypad */}
      <div
        data-testid="delivery-numeric-keypad"
        className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto select-none"
      >
        {KEYPAD_DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled || value.length >= 4}
            onClick={() => handleAppendDigit(digit)}
            data-testid={`keypad-digit-${digit}`}
            className="min-h-[56px] rounded-[12px] bg-white border border-border-grey text-dark-ink font-heading font-bold text-2xl shadow-2xs hover:border-fresh-green active:scale-[0.96] active:bg-light-green/40 transition-all disabled:opacity-45 cursor-pointer"
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={handleClear}
          data-testid="keypad-clear"
          aria-label={t('delivery.keypadClear')}
          className="min-h-[56px] rounded-[12px] bg-soft-grey border border-border-grey text-muted-text hover:text-dark-ink text-xs font-semibold inline-flex flex-col items-center justify-center gap-0.5 active:scale-[0.96] transition-all disabled:opacity-45 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>{t('delivery.keypadClear')}</span>
        </button>

        <button
          type="button"
          disabled={disabled || value.length >= 4}
          onClick={() => handleAppendDigit('0')}
          data-testid="keypad-digit-0"
          className="min-h-[56px] rounded-[12px] bg-white border border-border-grey text-dark-ink font-heading font-bold text-2xl shadow-2xs hover:border-fresh-green active:scale-[0.96] active:bg-light-green/40 transition-all disabled:opacity-45 cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={handleBackspace}
          data-testid="keypad-backspace"
          aria-label={t('delivery.keypadBackspace')}
          className="min-h-[56px] rounded-[12px] bg-soft-grey border border-border-grey text-dark-ink text-xs font-semibold inline-flex flex-col items-center justify-center gap-0.5 hover:border-alert-red/50 active:scale-[0.96] transition-all disabled:opacity-45 cursor-pointer"
        >
          <Delete className="w-4 h-4" aria-hidden="true" />
          <span>{t('delivery.keypadBackspace')}</span>
        </button>
      </div>
    </div>
  );
}
