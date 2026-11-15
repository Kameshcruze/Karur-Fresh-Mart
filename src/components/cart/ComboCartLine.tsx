import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, Package, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Stepper } from '../ui';
import { useI18n } from '../../context/I18nContext';
import type { PricedCartLine } from '../../types';
import { formatINR } from '../../utils/format';
import { resolveProductImage } from '../../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../../utils/tints';

function formatDeltaLabel(delta: number, baseLabel: string): string {
  if (delta === 0) return baseLabel;
  const absFormatted = formatINR(Math.abs(delta));
  return delta > 0 ? `+${absFormatted}` : `-${absFormatted}`;
}

export interface ComboCartLineProps {
  line: PricedCartLine;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onBrandChange: (lineId: string, comboItemId: string, newProductId: string) => void;
  onRemoveCombo: (lineId: string) => void;
}

export function ComboCartLine({
  line,
  onQuantityChange,
  onBrandChange,
  onRemoveCombo,
}: ComboCartLineProps) {
  const { t, bi } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const imgUrl = resolveProductImage(line.image);
  const tintClass = PRODUCT_TINT_CLASSES[line.imageTint];
  const breakdown = line.comboBrandBreakdown ?? [];

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[10px] ${tintClass} overflow-hidden flex items-center justify-center shrink-0 border border-border-grey/60`}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={bi(line.title)}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-7 h-7 text-fresh-green" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="yellow">{t('cart.comboBadge')}</Badge>
              {line.comboTemporarilyUnavailable && (
                <Badge tone="red">{t('combo.temporarilyUnavailable')}</Badge>
              )}
            </div>
            <h2 className="font-heading font-bold text-base sm:text-lg text-dark-ink leading-snug">
              {bi(line.title)}
            </h2>
            <p className="text-xs sm:text-sm text-muted-text">{line.subtitle}</p>
            {typeof line.comboSavingsVsSeparate === 'number' &&
              line.comboSavingsVsSeparate > 0 && (
                <p className="text-xs font-semibold text-fresh-green tabular-nums">
                  {t('combo.savedVsSeparate', {
                    amount: formatINR(line.comboSavingsVsSeparate),
                  })}
                </p>
              )}
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
          <div className="text-left sm:text-right">
            <p className="font-heading font-bold text-lg text-dark-ink tabular-nums">
              {formatINR(line.lineTotal)}
            </p>
            {line.cartItem.quantity > 1 && (
              <p className="text-xs text-muted-text tabular-nums">
                {formatINR(line.unitPrice)} × {line.cartItem.quantity}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Stepper
              value={line.cartItem.quantity}
              min={1}
              max={10}
              itemName={bi(line.title)}
              onIncrement={() =>
                onQuantityChange(line.cartItem.lineId, line.cartItem.quantity + 1)
              }
              onDecrement={() =>
                onQuantityChange(line.cartItem.lineId, line.cartItem.quantity - 1)
              }
              compact
            />

            <Button
              variant="ghost"
              size="sm"
              aria-label={`${t('cart.removeCombo')} ${bi(line.title)}`}
              onClick={() => onRemoveCombo(line.cartItem.lineId)}
              leftIcon={<Trash2 className="w-4 h-4 text-alert-red" />}
              className="text-alert-red hover:bg-alert-red/10 px-2.5"
            >
              <span className="hidden sm:inline">{t('cart.removeCombo')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Expandable Included Items & Brand Customizer */}
      {breakdown.length > 0 && (
        <div className="border-t border-border-grey/70 bg-soft-grey/70">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs sm:text-sm font-semibold text-fresh-green hover:bg-light-green/50 transition-colors cursor-pointer min-h-[44px]"
          >
            <span>
              {expanded
                ? t('cart.collapseItems')
                : t('cart.expandItems', { count: breakdown.length })}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
          </button>

          {expanded && (
            <div className="px-4 sm:px-5 pb-4 pt-1 space-y-2.5">
              <div className="rounded-[8px] bg-light-green/80 border border-fresh-green/20 px-3 py-2 flex items-center gap-2 text-xs text-dark-ink">
                <Info className="w-3.5 h-3.5 text-fresh-green shrink-0" aria-hidden="true" />
                <span>
                  {line.comboCanChangeBrand === false
                    ? t('cart.comboCartBrandLockedNote')
                    : t('cart.comboCartRuleNote')}
                </span>
              </div>

              <div className="divide-y divide-border-grey/60 bg-white rounded-[10px] border border-border-grey/70">
                {breakdown.map((item) => (
                  <div
                    key={item.comboItemId}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dark-ink">
                        {bi(item.groupName)}
                      </p>
                      <p className="text-xs text-muted-text tabular-nums">
                        {t('combo.itemQty', { qty: item.quantity, unit: item.unit })}
                      </p>
                    </div>

                    <div className="sm:w-56 shrink-0 space-y-1">
                      {item.isUnavailable && (
                        <Badge tone="red">{t('combo.itemAllBrandsOut')}</Badge>
                      )}
                      {line.comboCanChangeBrand === false ? (
                        <div className="w-full min-h-[40px] px-2.5 rounded-[8px] border border-border-grey bg-soft-grey text-xs font-semibold text-dark-ink flex items-center justify-between">
                          <span>{item.brandName}</span>
                          <span className="text-[11px] font-normal text-muted-text">
                            {t('combo.brandLockedNote')}
                          </span>
                        </div>
                      ) : (
                        <select
                          aria-label={`${bi(item.groupName)} ${t('combo.preferredBrandLabel')}`}
                          value={item.product.id}
                          disabled={item.isUnavailable}
                          onChange={(e) =>
                            onBrandChange(
                              line.cartItem.lineId,
                              item.comboItemId,
                              e.target.value,
                            )
                          }
                          className="w-full min-h-[40px] px-2.5 rounded-[8px] border border-border-grey bg-soft-grey text-xs font-semibold text-dark-ink focus:bg-white focus:outline-none focus:border-fresh-green cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {item.options.map((opt) => (
                            <option
                              key={opt.product.id}
                              value={opt.product.id}
                              disabled={opt.isOutOfStock}
                            >
                              {opt.brandName} (
                              {formatDeltaLabel(
                                opt.deltaFromDefault,
                                t('combo.baseIncluded'),
                              )}
                              ){opt.isOutOfStock ? ` — ${t('combo.brandOutOfStockOption')}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
