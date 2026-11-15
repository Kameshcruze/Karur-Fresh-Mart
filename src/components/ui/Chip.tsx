import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
}

export function Chip({
  selected = false,
  icon,
  children,
  className = '',
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={[
        'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-[10px] text-sm font-medium whitespace-nowrap shrink-0 border transition-colors duration-150 cursor-pointer',
        selected
          ? 'bg-light-green text-fresh-green border-fresh-green font-semibold'
          : 'bg-white text-dark-ink border-border-grey hover:border-fresh-green/60 hover:bg-soft-grey',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
