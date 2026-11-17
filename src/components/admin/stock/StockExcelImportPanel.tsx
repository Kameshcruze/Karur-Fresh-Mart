import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { Badge, Button, Card } from '../../ui';
import { useAuth } from '../../../context/AuthContext';
import { useI18n } from '../../../context/I18nContext';
import {
  downloadErrorReportXlsx,
  downloadTemplateXlsx,
  importProducts,
  previewImport,
  revalidatePreviewRows,
} from '../../../services';
import type {
  Brand,
  Category,
  Product,
  StockImportMode,
  StockImportResult,
  StockPreviewRow,
} from '../../../types';
import { formatINR } from '../../../utils/format';

export interface StockExcelImportPanelProps {
  products: Product[];
  brands: Brand[];
  categories: Category[];
  onImportComplete: (result: StockImportResult) => Promise<void>;
}

export function StockExcelImportPanel({
  products,
  brands,
  categories,
  onImportComplete,
}: StockExcelImportPanelProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<StockPreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<StockImportMode>('add_and_update');
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [importResult, setImportResult] = useState<StockImportResult | null>(null);

  const processFile = async (file: File) => {
    setParseError(null);
    setImportResult(null);
    setReplaceConfirmed(false);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        setParseError(t('admin.importParseEmptyError'));
        return;
      }
      const ws = workbook.Sheets[firstSheet];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: '',
      });
      if (rawRows.length === 0) {
        setParseError(t('admin.importParseEmptyError'));
        return;
      }

      const parsed = previewImport(rawRows, products, categories, brands);
      setPreviewRows(parsed);
      setFileName(file.name);
    } catch {
      setParseError(t('admin.importParseGenericError'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const summaryCounts = useMemo(() => {
    let newCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    for (const r of previewRows) {
      if (r.skip) {
        skippedCount += 1;
      } else if (r.status === 'Error') {
        errorCount += 1;
      } else if (r.status === 'Update') {
        updateCount += 1;
      } else {
        newCount += 1;
      }
    }
    return {
      total: previewRows.length,
      newCount,
      updateCount,
      errorCount,
      skippedCount,
      actionableCount: newCount + updateCount,
    };
  }, [previewRows]);

  const handleInlinePreviewFieldChange = (
    rowNumber: number,
    patch: Partial<StockPreviewRow>,
  ) => {
    setPreviewRows((prev) => {
      const next = prev.map((r) =>
        r.rowNumber === rowNumber ? { ...r, ...patch } : r,
      );
      return revalidatePreviewRows(next, products, categories, brands);
    });
  };

  const handleToggleSkip = (rowNumber: number, skip: boolean) => {
    setPreviewRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, skip } : r)),
    );
  };

  const canConfirmImport =
    previewRows.length > 0 &&
    !isImporting &&
    (importMode !== 'replace_all_stock' || replaceConfirmed);

  const handleConfirmImport = async () => {
    if (!canConfirmImport) return;
    setIsImporting(true);
    setProgressPercent(15);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const result = await importProducts(previewRows, importMode, {
        fileName: fileName ?? 'stock-upload.xlsx',
        adminName: user?.name ?? 'Senthilnathan K (Store Admin)',
        onProgress: (pct) => setProgressPercent(pct),
      });
      setImportResult(result);
      setPreviewRows([]);
      setFileName(null);
      setReplaceConfirmed(false);
      await onImportComplete(result);
    } finally {
      setIsImporting(false);
    }
  };

  const modeLabel = (mode: StockImportMode) => {
    switch (mode) {
      case 'update_stock_only':
        return t('admin.modeUpdateStockOnly');
      case 'replace_all_stock':
        return t('admin.modeReplaceAll');
      default:
        return t('admin.modeAddUpdate');
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone & Template Header */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-heading font-bold text-lg text-dark-ink">
              {t('admin.excelUploadTitle')}
            </h2>
            <p className="text-sm text-muted-text">{t('admin.excelUploadSubtitle')}</p>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={downloadTemplateXlsx}
            leftIcon={<Download className="w-4 h-4" />}
            data-testid="download-template-btn"
          >
            {t('admin.downloadTemplateCta')}
          </Button>
        </div>

        {/* Drag-and-Drop File Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          data-testid="excel-dropzone"
          className={[
            'rounded-[12px] border-2 border-dashed p-6 sm:p-8 text-center transition-colors',
            isDragging
              ? 'border-fresh-green bg-light-green/70'
              : 'border-border-grey bg-soft-grey/60 hover:border-fresh-green/70',
          ].join(' ')}
        >
          <div className="w-12 h-12 rounded-[12px] bg-white border border-border-grey mx-auto flex items-center justify-center text-fresh-green mb-3">
            <FileSpreadsheet className="w-6 h-6" aria-hidden="true" />
          </div>
          <p className="font-heading font-semibold text-sm sm:text-base text-dark-ink">
            {t('admin.dropzonePrompt')}
          </p>
          <p className="text-[11px] sm:text-xs text-muted-text mt-1 max-w-2xl mx-auto font-mono">
            {t('admin.dropzoneSubtext')}
          </p>

          <div className="mt-4">
            <label className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-[10px] bg-fresh-green hover:bg-fresh-green/90 text-white text-sm font-semibold cursor-pointer transition-colors">
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>{t('admin.chooseExcelFileCta')}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="sr-only"
                aria-label={t('admin.chooseExcelFileCta')}
                data-testid="excel-file-input"
              />
            </label>
          </div>
        </div>

        {parseError && (
          <div
            role="alert"
            className="rounded-[10px] bg-alert-red-soft border border-alert-red/30 px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-alert-red"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{parseError}</span>
          </div>
        )}
      </Card>

      {/* Progress Bar during import */}
      {isImporting && (
        <Card padding="md" className="space-y-2 border-fresh-green/35">
          <div className="flex items-center justify-between text-xs font-semibold text-dark-ink">
            <span>{t('admin.importingProgressLabel', { percent: progressPercent })}</span>
            <span className="tabular-nums">{progressPercent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-2.5 rounded-full bg-soft-grey overflow-hidden"
          >
            <div
              className="h-full bg-fresh-green transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </Card>
      )}

      {/* Result Summary after Import */}
      {importResult && (
        <Card
          padding="lg"
          className="border-2 border-fresh-green/40 bg-light-green/40 space-y-4"
          data-testid="import-result-summary"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-fresh-green shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-heading font-bold text-base text-dark-ink">
                  {t('admin.importResultTitle')} — {importResult.fileName}
                </h3>
                <p className="text-xs text-muted-text">
                  {importResult.adminName} · {modeLabel(importResult.mode)}
                </p>
              </div>
            </div>

            {importResult.errorDetails.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => downloadErrorReportXlsx(importResult)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                data-testid="download-error-report-btn"
              >
                {t('admin.downloadErrorReportCta')}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-[10px] bg-white border border-border-grey">
              <p className="text-xs text-muted-text">{t('admin.resultCreated')}</p>
              <p className="font-heading font-bold text-xl text-fresh-green tabular-nums">
                {importResult.created}
              </p>
            </div>
            <div className="p-3 rounded-[10px] bg-white border border-border-grey">
              <p className="text-xs text-muted-text">{t('admin.resultUpdated')}</p>
              <p className="font-heading font-bold text-xl text-dark-ink tabular-nums">
                {importResult.updated}
              </p>
            </div>
            <div className="p-3 rounded-[10px] bg-white border border-border-grey">
              <p className="text-xs text-muted-text">{t('admin.resultSkipped')}</p>
              <p className="font-heading font-bold text-xl text-muted-text tabular-nums">
                {importResult.skipped}
              </p>
            </div>
            <div className="p-3 rounded-[10px] bg-white border border-border-grey">
              <p className="text-xs text-muted-text">{t('admin.resultFailed')}</p>
              <p className="font-heading font-bold text-xl text-alert-red tabular-nums">
                {importResult.failed}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Preview Table & Import Mode Choice */}
      {previewRows.length > 0 && (
        <div className="space-y-4">
          {/* Import Mode Choice + Summary Counts */}
          <Card padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-grey">
              <div>
                <h3 className="font-heading font-bold text-base text-dark-ink">
                  {fileName}
                </h3>
                <p className="text-xs text-muted-text mt-0.5">{t('admin.fixRowHint')}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
                <Badge tone="dark">
                  {t('admin.summaryTotal')}: {summaryCounts.total}
                </Badge>
                <Badge tone="yellow">
                  {t('admin.summaryNew')}: {summaryCounts.newCount}
                </Badge>
                <Badge tone="green">
                  {t('admin.summaryUpdate')}: {summaryCounts.updateCount}
                </Badge>
                {summaryCounts.errorCount > 0 && (
                  <Badge tone="red">
                    {t('admin.summaryError')}: {summaryCounts.errorCount}
                  </Badge>
                )}
                {summaryCounts.skippedCount > 0 && (
                  <Badge tone="dark">
                    {t('admin.summarySkipped')}: {summaryCounts.skippedCount}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-heading font-semibold text-sm text-dark-ink">
                {t('admin.importModeLabel')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: 'add_and_update' as StockImportMode,
                    title: t('admin.modeAddUpdate'),
                    desc: t('admin.modeAddUpdateDesc'),
                  },
                  {
                    id: 'update_stock_only' as StockImportMode,
                    title: t('admin.modeUpdateStockOnly'),
                    desc: t('admin.modeUpdateStockOnlyDesc'),
                  },
                  {
                    id: 'replace_all_stock' as StockImportMode,
                    title: t('admin.modeReplaceAll'),
                    desc: t('admin.modeReplaceAllDesc'),
                  },
                ].map((opt) => {
                  const selected = importMode === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={[
                        'p-3.5 rounded-[10px] border cursor-pointer transition-colors flex items-start gap-2.5',
                        selected
                          ? opt.id === 'replace_all_stock'
                            ? 'bg-alert-red-soft/60 border-alert-red'
                            : 'bg-light-green border-fresh-green'
                          : 'bg-soft-grey/60 border-border-grey hover:border-fresh-green/60',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="stock-import-mode"
                        checked={selected}
                        onChange={() => setImportMode(opt.id)}
                        className="mt-1 accent-fresh-green"
                      />
                      <div>
                        <p className="font-heading font-semibold text-sm text-dark-ink">
                          {opt.title}
                        </p>
                        <p className="text-xs text-muted-text mt-0.5 leading-snug">
                          {opt.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {importMode === 'replace_all_stock' && (
              <div
                role="alert"
                className="rounded-[10px] bg-alert-red-soft border border-alert-red/40 p-3.5 space-y-2.5"
              >
                <div className="flex items-start gap-2 text-xs sm:text-sm font-semibold text-alert-red">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{t('admin.replaceWarningBanner')}</span>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-dark-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceConfirmed}
                    onChange={(e) => setReplaceConfirmed(e.target.checked)}
                    className="w-4 h-4 accent-alert-red"
                  />
                  <span>{t('admin.replaceConfirmCheckbox')}</span>
                </label>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setPreviewRows([]);
                  setFileName(null);
                }}
              >
                {t('admin.clearPreviewCta')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!canConfirmImport}
                onClick={() => void handleConfirmImport()}
                data-testid="confirm-import-btn"
              >
                {t('admin.confirmImportCta', {
                  count: summaryCounts.total - summaryCounts.skippedCount,
                })}
              </Button>
            </div>
          </Card>

          {/* Preview Rows Table */}
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-soft-grey border-b border-border-grey uppercase text-muted-text">
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.colStatus')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.colItemCode')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.colProduct')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.colBrand')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.colCategory')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.colMrp')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.colSellingPrice')}</th>
                    <th className="py-2.5 px-3 font-semibold">{t('admin.colStockQty')}</th>
                    <th className="py-2.5 px-3 font-semibold text-center">{t('admin.skipRowLabel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-grey/60">
                  {previewRows.map((row) => {
                    const isError = row.status === 'Error';
                    return (
                      <tr
                        key={row.rowNumber}
                        className={[
                          row.skip ? 'opacity-50 bg-soft-grey/50' : '',
                          isError && !row.skip ? 'bg-alert-red-soft/35' : '',
                        ].join(' ')}
                      >
                        <td className="py-2.5 px-3 tabular-nums text-muted-text">
                          {row.rowNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            tone={
                              row.status === 'Update'
                                ? 'green'
                                : row.status === 'New'
                                  ? 'yellow'
                                  : 'red'
                            }
                          >
                            {row.status === 'Update'
                              ? t('admin.importStatusUpdate')
                              : row.status === 'New'
                                ? t('admin.importStatusCreate')
                                : t('admin.importStatusInvalid')}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 min-w-[110px]">
                          {isError ? (
                            <input
                              type="text"
                              value={row.item_code}
                              aria-label={t('admin.importRowItemCodeAria', { row: row.rowNumber })}
                              onChange={(e) =>
                                handleInlinePreviewFieldChange(row.rowNumber, {
                                  item_code: e.target.value,
                                })
                              }
                              className="w-full min-h-[34px] px-2 rounded border border-border-grey bg-white text-xs font-mono"
                            />
                          ) : (
                            <span className="font-mono text-dark-ink">
                              {row.item_code || '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 min-w-[200px]">
                          {isError ? (
                            <input
                              type="text"
                              value={row.product_name}
                              aria-label={t('admin.importRowProductNameAria', { row: row.rowNumber })}
                              onChange={(e) =>
                                handleInlinePreviewFieldChange(row.rowNumber, {
                                  product_name: e.target.value,
                                })
                              }
                              placeholder={t('admin.importNamePlaceholder')}
                              className="w-full min-h-[34px] px-2 rounded border border-border-grey bg-white text-xs font-semibold"
                            />
                          ) : (
                            <p className="font-semibold text-dark-ink">{row.product_name}</p>
                          )}
                          <p className="text-[11px] text-muted-text mt-0.5">
                            {row.pack_size} {row.unit}
                          </p>
                          {row.errors.length > 0 && (
                            <p
                              data-testid={`preview-row-error-${row.rowNumber}`}
                              className="text-[11px] font-semibold text-alert-red mt-0.5"
                            >
                              {row.errors.join(' · ')}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3">{row.brand}</td>
                        <td className="py-2.5 px-3 min-w-[135px]">
                          {isError ? (
                            <select
                              value={row.category}
                              aria-label={t('admin.importRowCategoryAria', { row: row.rowNumber })}
                              onChange={(e) =>
                                handleInlinePreviewFieldChange(row.rowNumber, {
                                  category: e.target.value,
                                })
                              }
                              className="w-full min-h-[34px] px-2 rounded border border-border-grey bg-white text-xs"
                            >
                              <option value={row.category}>
                                {row.category || t('admin.importSelectCategory')}
                              </option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.name.en}>
                                  {c.name.en}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{row.category}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums">
                          {isError ? (
                            <input
                              type="number"
                              value={Number.isFinite(row.mrp) ? row.mrp : ''}
                              aria-label={t('admin.importRowMrpAria', { row: row.rowNumber })}
                              onChange={(e) =>
                                handleInlinePreviewFieldChange(row.rowNumber, {
                                  mrp: Number(e.target.value),
                                })
                              }
                              className="w-20 min-h-[34px] px-2 rounded border border-border-grey bg-white text-xs tabular-nums"
                            />
                          ) : (
                            formatINR(row.mrp)
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums font-semibold">
                          {isError ? (
                            <input
                              type="number"
                              value={Number.isFinite(row.selling_price) ? row.selling_price : ''}
                              aria-label={t('admin.importRowPriceAria', { row: row.rowNumber })}
                              onChange={(e) =>
                                handleInlinePreviewFieldChange(row.rowNumber, {
                                  selling_price: Number(e.target.value),
                                })
                              }
                              className="w-20 min-h-[34px] px-2 rounded border border-border-grey bg-white text-xs tabular-nums"
                            />
                          ) : (
                            formatINR(row.selling_price)
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums font-semibold">
                          {isError ? (
                            <input
                              type="number"
                              value={Number.isFinite(row.stock_qty) ? row.stock_qty : ''}
                              aria-label={t('admin.importRowStockAria', { row: row.rowNumber })}
                              onChange={(e) =>
                                handleInlinePreviewFieldChange(row.rowNumber, {
                                  stock_qty: Number(e.target.value),
                                })
                              }
                              className="w-20 min-h-[34px] px-2 rounded border border-border-grey bg-white text-xs tabular-nums"
                            />
                          ) : row.currentStockQty !== undefined ? (
                            <span>
                              <span className="text-muted-text">{row.currentStockQty}</span> →{' '}
                              <span className="text-fresh-green">{row.stock_qty}</span>
                            </span>
                          ) : (
                            <span className="text-fresh-green">{row.stock_qty}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.skip}
                            aria-label={t('admin.importRowSkipAria', { row: row.rowNumber })}
                            onChange={(e) =>
                              handleToggleSkip(row.rowNumber, e.target.checked)
                            }
                            className="w-4 h-4 accent-fresh-green cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
