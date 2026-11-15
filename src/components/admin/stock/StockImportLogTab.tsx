import { useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, History } from 'lucide-react';
import { Badge, Button, Card } from '../../ui';
import { useI18n } from '../../../context/I18nContext';
import { downloadErrorReportXlsx } from '../../../services';
import type { StockHistoryEntry, StockImportLog } from '../../../types';
import { formatDateTime, formatINR } from '../../../utils/format';

export interface StockImportLogTabProps {
  logs: StockImportLog[];
  history: StockHistoryEntry[];
}

export function StockImportLogTab({ logs, history }: StockImportLogTabProps) {
  const { t } = useI18n();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Import Log Panel */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-fresh-green" aria-hidden="true" />
          <h2 className="font-heading font-bold text-lg text-dark-ink">
            {t('admin.importLogsTitle')}
          </h2>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-muted-text py-4">{t('admin.importLogsEmpty')}</p>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log) => {
              const expanded = expandedLogId === log.logId;
              return (
                <div
                  key={log.logId}
                  className="rounded-[10px] border border-border-grey bg-soft-grey/50 overflow-hidden"
                >
                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-heading font-bold text-sm text-dark-ink truncate">
                          {log.fileName}
                        </p>
                        <Badge tone="dark">{log.mode}</Badge>
                      </div>
                      <p className="text-xs text-muted-text tabular-nums">
                        {formatDateTime(log.importedAt)} · {log.adminName}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Badge tone="yellow">+{log.created} new</Badge>
                      <Badge tone="green">{log.updated} upd</Badge>
                      {log.skipped > 0 && <Badge tone="dark">{log.skipped} skip</Badge>}
                      {log.failed > 0 && <Badge tone="red">{log.failed} err</Badge>}

                      {log.errorDetails.length > 0 && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => downloadErrorReportXlsx(log)}
                            leftIcon={<Download className="w-3.5 h-3.5" />}
                          >
                            {t('admin.downloadErrorReportCta')}
                          </Button>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLogId(expanded ? null : log.logId)
                            }
                            aria-expanded={expanded}
                            className="min-h-[36px] px-2.5 rounded-[8px] border border-border-grey bg-white text-xs font-semibold text-dark-ink inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Issues</span>
                            {expanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {expanded && log.errorDetails.length > 0 && (
                    <div className="border-t border-border-grey bg-white px-3.5 py-2.5 space-y-1.5 text-xs">
                      {log.errorDetails.map((err, i) => (
                        <p key={`${log.logId}-err-${i}`} className="text-alert-red">
                          Row {err.rowNumber} ({err.item_code || err.product_name}):{' '}
                          {err.errors.join(', ')}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Storewide Stock Audit History */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-fresh-green" aria-hidden="true" />
          <h2 className="font-heading font-bold text-lg text-dark-ink">
            {t('admin.stockHistoryTitle')}
          </h2>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-text py-4">{t('admin.stockHistoryEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-soft-grey border-b border-border-grey text-xs uppercase text-muted-text">
                  <th className="py-2.5 px-3 font-semibold">{t('admin.colProduct')}</th>
                  <th className="py-2.5 px-3 font-semibold">{t('admin.historyWho')}</th>
                  <th className="py-2.5 px-3 font-semibold">{t('admin.historyWhen')}</th>
                  <th className="py-2.5 px-3 font-semibold">{t('admin.historyChange')}</th>
                  <th className="py-2.5 px-3 font-semibold">{t('admin.historyReason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-grey/60">
                {history.slice(0, 50).map((entry) => (
                  <tr key={entry.id} className="hover:bg-soft-grey/40">
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-dark-ink">{entry.productName}</p>
                      {entry.note && (
                        <p className="text-[11px] text-muted-text">{entry.note}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-dark-ink">{entry.who}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-text tabular-nums">
                      {formatDateTime(entry.when)}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums font-semibold">
                      {entry.field === 'price' && entry.oldPrice !== undefined && entry.newPrice !== undefined ? (
                        <span>
                          {formatINR(entry.oldPrice)} →{' '}
                          <span className="text-fresh-green">{formatINR(entry.newPrice)}</span>
                        </span>
                      ) : (
                        <span>
                          {entry.oldValue} →{' '}
                          <span
                            className={
                              entry.newValue > entry.oldValue
                                ? 'text-fresh-green'
                                : 'text-alert-red'
                            }
                          >
                            {entry.newValue}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        tone={
                          entry.reason === 'excel import'
                            ? 'yellow'
                            : entry.reason === 'order placed'
                              ? 'green'
                              : entry.reason === 'correction'
                                ? 'red'
                                : 'dark'
                        }
                      >
                        {reasonLabel(entry.reason)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
