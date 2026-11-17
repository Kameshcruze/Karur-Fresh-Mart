import type { ReactNode } from 'react';
import { AlertTriangle, PackageOpen, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

export interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = 'h-4 w-full' }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-[8px] bg-border-grey/50 ${className}`}
    />
  );
}

export interface ProductGridSkeletonProps {
  count?: number;
  className?: string;
}

export function ProductGridSkeleton({
  count = 6,
  className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5',
}: ProductGridSkeletonProps) {
  return (
    <div aria-busy="true" className={className}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className="bg-white rounded-[12px] border border-border-grey/70 p-3 space-y-2.5 animate-pulse"
        >
          <div className="aspect-square rounded-[10px] bg-soft-grey" />
          <div className="h-3.5 w-3/4 rounded bg-border-grey/50" />
          <div className="h-3 w-1/2 rounded bg-border-grey/40" />
          <div className="flex items-center justify-between pt-1">
            <div className="h-4 w-12 rounded bg-border-grey/60" />
            <div className="h-9 w-16 rounded-[10px] bg-border-grey/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ListSkeletonProps {
  rows?: number;
  rowHeightClass?: string;
  className?: string;
}

export function ListSkeleton({
  rows = 3,
  rowHeightClass = 'h-24',
  className = 'space-y-3',
}: ListSkeletonProps) {
  return (
    <div aria-busy="true" className={className}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className={`w-full rounded-[12px] bg-white border border-border-grey/70 p-4 animate-pulse flex items-center gap-3 ${rowHeightClass}`}
        >
          <div className="w-12 h-12 rounded-[10px] bg-soft-grey shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/5 rounded bg-border-grey/60" />
            <div className="h-3 w-3/5 rounded bg-border-grey/40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ErrorStateCardProps {
  title: string;
  subtitle?: string;
  retryLabel?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorStateCard({
  title,
  subtitle,
  retryLabel,
  onRetry,
  action,
  className = '',
}: ErrorStateCardProps) {
  return (
    <Card
      role="alert"
      padding="lg"
      className={`text-center space-y-3 border-alert-red/30 bg-white ${className}`}
    >
      <div className="w-12 h-12 rounded-[12px] bg-alert-red-soft text-alert-red mx-auto flex items-center justify-center">
        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h2 className="font-heading font-bold text-lg text-dark-ink">{title}</h2>
        {subtitle && <p className="text-sm text-muted-text">{subtitle}</p>}
      </div>
      {(onRetry || action) && (
        <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
          {onRetry && retryLabel && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={onRetry}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </Card>
  );
}

export interface EmptyStateCardProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyStateCard({
  icon,
  title,
  subtitle,
  action,
  className = '',
}: EmptyStateCardProps) {
  return (
    <Card padding="lg" className={`text-center space-y-3 ${className}`}>
      <div className="w-12 h-12 rounded-[12px] bg-light-green text-fresh-green mx-auto flex items-center justify-center">
        {icon ?? <PackageOpen className="w-6 h-6" aria-hidden="true" />}
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h2 className="font-heading font-bold text-lg text-dark-ink">{title}</h2>
        {subtitle && <p className="text-sm text-muted-text">{subtitle}</p>}
      </div>
      {action && <div className="pt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </Card>
  );
}
