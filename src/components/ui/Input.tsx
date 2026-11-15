import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightSlot,
  id,
  className = '',
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-dark-ink mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span
            className="absolute left-3.5 text-muted-text pointer-events-none inline-flex"
            aria-hidden="true"
          >
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          className={[
            'w-full min-h-[44px] rounded-[10px] bg-white border text-sm text-dark-ink placeholder:text-muted-text transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-fresh-green/20 focus:border-fresh-green',
            leftIcon ? 'pl-10' : 'pl-3.5',
            rightSlot ? 'pr-12' : 'pr-3.5',
            error ? 'border-alert-red focus:border-alert-red focus:ring-alert-red/20' : 'border-border-grey',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {rightSlot && (
          <div className="absolute right-2 flex items-center">{rightSlot}</div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-alert-red">
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="mt-1.5 text-xs text-muted-text">{hint}</p>
      )}
    </div>
  );
}
