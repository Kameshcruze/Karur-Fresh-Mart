import React from 'react';

export type BadgeTone = 'yellow' | 'green' | 'red' | 'neutral' | 'dark';

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  yellow: 'bg-warm-yellow text-dark-ink font-semibold',
  green: 'bg-light-green text-fresh-green font-semibold',
  red: 'bg-alert-red-soft text-alert-red font-semibold',
  neutral: 'bg-soft-grey text-muted-text font-medium border border-border-grey',
  dark: 'bg-dark-ink text-white font-semibold',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs leading-none whitespace-nowrap shrink-0',
        TONE_CLASSES[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
