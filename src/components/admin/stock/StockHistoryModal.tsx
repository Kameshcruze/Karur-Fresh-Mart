import { History, X } from 'lucide-react';
import { Badge, Button, Card } from '../../ui';
import { useI18n } from '../../../context/I18nContext';
import type { StockHistoryEntry } from '../../../types';
import { formatDateTime, formatINR } from '../../../utils/format';

export interface StockHistoryModalProps {
  open: boolean;
  productName?: string;
  entries: StockHistoryEntry[];
  onClose: () => void;
}

export function StockHistoryModal({
  open,
  productName,
  entries,
  onClose,
}: StockHistoryModalProps) {
  const { t } = useI18n();
  if (!open) return null;

  const reasonLabel = (reason: StockHistoryEntry['reason']) => {
    switch (reason) {
      case 'excel import':
        return t('admin.reasonExcelImport');
      case 'order placed':
        return t('admin.reasonOrderPlaced');
      case 'correction':
        return t('admin.reasonCorrection');
      default:
        return t('admin.reasonManual');
    }
  };

  const reasonTone = (reason: StockHistoryEntry['reason']) => {
    switch (reason) {
      case 'excel import':
        return 'yellow';
      case 'order placed':
        return 'green';
      case 'correction':
        return 'red';
      default:
        return 'dark';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-ink/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-history-modal-title"
    >
      <Card padding="lg" className="w-full max-w-2xl max-h-[85vh] flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-grey">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-5 h-5 text-fresh-green shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2
                id="stock-history-modal-title"
                className="font-heading font-bold text-lg text-dark-ink truncate"
              >
                {t('admin.stockHistoryTitle')}
              </h2>
              {productName && (
                <p className="text-xs text-muted-text truncate">{productName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.closePanel')}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-[8px] text-muted-text hover:bg-soft-grey cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-text py-8 text-center">
              {t('admin.stockHistoryEmpty')}
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[10px] border border-border-grey/80 bg-soft-grey/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={reasonTone(entry.reason)}>
                      {reasonLabel(entry.reason)}
                    </Badge>
                    <span className="text-xs font-semibold text-dark-ink truncate">
                      {entry.who}
                    </span>
                    <span className="text-[11px] text-muted-text tabular-nums">
                      {formatDateTime(entry.when)}
                    </span>
                  </div>
                  {!productName && (
                    <p className="text-xs font-semibold text-dark-ink">
                      {entry.productName} {entry.sku ? `(${entry.sku})` : ''}
                    </p>
                  )}
                  {entry.note && (
                    <p className="text-xs text-muted-text">{entry.note}</p>
                  )}
                </div>

                <div className="shrink-0 text-left sm:text-right tabular-nums">
                  {entry.field === 'price' && entry.oldPrice !== undefined && entry.newPrice !== undefined ? (
                    <p className="text-sm font-bold text-dark-ink">
                      {formatINR(entry.oldPrice)} →{' '}
                      <span className="text-fresh-green">{formatINR(entry.newPrice)}</span>
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-dark-ink">
                      {entry.oldValue} →{' '}
                      <span
                        className={
                          entry.newValue > entry.oldValue
                            ? 'text-fresh-green'
                            : entry.newValue < entry.oldValue
                              ? 'text-alert-red'
                              : 'text-dark-ink'
                        }
                      >
                        {entry.newValue}
                      </span>{' '}
                      <span className="text-xs font-normal text-muted-text">units</span>
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-border-grey flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('admin.closePanel')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
