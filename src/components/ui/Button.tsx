import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'yellow';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-fresh-green text-white hover:bg-fresh-green-hover active:scale-[0.98] shadow-xs',
  secondary:
    'bg-light-green text-fresh-green hover:bg-fresh-green/15 active:scale-[0.98]',
  outline:
    'bg-white text-dark-ink border border-border-grey hover:border-fresh-green hover:text-fresh-green active:scale-[0.98]',
  danger:
    'bg-alert-red text-white hover:bg-alert-red/90 active:scale-[0.98]',
  ghost:
    'bg-transparent text-dark-ink hover:bg-soft-grey active:scale-[0.98]',
  yellow:
    'bg-warm-yellow text-dark-ink font-semibold hover:brightness-95 active:scale-[0.98] shadow-xs',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] sm:min-h-[38px] px-3.5 py-2 text-sm',
  md: 'min-h-[44px] px-5 py-2.5 text-sm',
  lg: 'min-h-[48px] px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
}
