import { Minus, Plus } from 'lucide-react';

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  itemName?: string;
  onIncrement: () => void;
  onDecrement: () => void;
  compact?: boolean;
  className?: string;
}

export function Stepper({
  value,
  min = 0,
  max = 99,
  itemName = 'item',
  onIncrement,
  onDecrement,
  compact = false,
  className = '',
}: StepperProps) {
  return (
    <div
      className={[
        'inline-flex items-center justify-between rounded-[10px] bg-fresh-green text-white overflow-hidden select-none',
        compact ? 'min-h-[44px]' : 'min-h-[44px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={`Quantity controls for ${itemName}`}
    >
      <button
        type="button"
        onClick={onDecrement}
        disabled={value <= min}
        aria-label={`Decrease quantity of ${itemName}`}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-fresh-green-hover active:bg-fresh-green-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Minus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
      <span
        className="px-2 min-w-[28px] text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={value >= max}
        aria-label={`Increase quantity of ${itemName}`}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-fresh-green-hover active:bg-fresh-green-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
