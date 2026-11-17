import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  Lock,
  Plus,
  Save,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, ErrorStateCard, ListSkeleton } from '../../components/ui';
import { useI18n } from '../../context/I18nContext';
import {
  getBrands,
  getCombos,
  getProducts,
  resolveBrandName,
  saveCombo,
  saveProduct,
} from '../../services';
import type { Brand, Combo, ComboItem, ComboType, Product } from '../../types';
import { formatINR } from '../../utils/format';

export function AdminCombosPage() {
  const { t, bi } = useI18n();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedType, setSelectedType] = useState<ComboType>('individual');
  const [draft, setDraft] = useState<Combo | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, number>>({});
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [comboList, productList, brandList] = await Promise.all([
        getCombos(),
        getProducts({ includeHidden: true }),
        getBrands(),
      ]);
      setCombos(comboList);
      setProducts(productList);
      setBrands(brandList);

      const activeCombo =
        comboList.find((c) => c.type === selectedType) ?? comboList[0] ?? null;
      if (activeCombo) {
        setDraft({
          ...activeCombo,
          customerCanRemoveItems: false,
          customerCanChangeBrand: activeCombo.customerCanChangeBrand !== false,
        });
      }
      const priceMap: Record<string, number> = {};
      for (const p of productList) {
        priceMap[p.id] = p.price;
      }
      setPriceEdits(priceMap);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSelectComboType = (type: ComboType) => {
    setSelectedType(type);
    const next = combos.find((c) => c.type === type);
    if (next) {
      setDraft({
        ...next,
        customerCanRemoveItems: false,
        customerCanChangeBrand: next.customerCanChangeBrand !== false,
      });
    }
    setErrorMsg(null);
  };

  const updateItemField = (
    itemId: string,
    updater: (item: ComboItem) => ComboItem,
  ) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) => (item.id === itemId ? updater(item) : item)),
          }
        : prev,
    );
  };

  const handleToggleAllowedBrand = (itemId: string, productId: string) => {
    updateItemField(itemId, (item) => {
      const exists = item.allowedProductIds.includes(productId);
      if (exists && item.allowedProductIds.length <= 1) {
        return item; // Keep at least 1 allowed brand on every fixed item
      }
      const nextAllowed = exists
        ? item.allowedProductIds.filter((id) => id !== productId)
        : [...item.allowedProductIds, productId];
      const nextDefault = nextAllowed.includes(item.defaultProductId)
        ? item.defaultProductId
        : nextAllowed[0];
      return {
        ...item,
        allowedProductIds: nextAllowed,
        defaultProductId: nextDefault,
      };
    });
  };

  const handleAddFixedItem = () => {
    if (!draft || products.length === 0) return;
    const defaultProd = products[0];
    const newItem: ComboItem = {
      id: `ci-${draft.type}-${Date.now().toString(36)}`,
      productGroup: {
        en: 'New Pantry Staple',
        ta: 'புதிய மளிகை பொருள்',
      },
      quantity: 1,
      unit: defaultProd.packSize,
      defaultProductId: defaultProd.id,
      allowedProductIds: [defaultProd.id],
    };
    setDraft({
      ...draft,
      items: [...draft.items, newItem],
    });
  };

  const handleSaveCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setErrorMsg(null);

    try {
      // Persist any edited brand prices first
      for (const prod of products) {
        const editedPrice = priceEdits[prod.id];
        if (
          typeof editedPrice === 'number' &&
          Number.isFinite(editedPrice) &&
          editedPrice > 0 &&
          editedPrice !== prod.price
        ) {
          await saveProduct({
            ...prod,
            price: Math.round(editedPrice),
            mrp: Math.max(prod.mrp, Math.round(editedPrice)),
          });
        }
      }

      await saveCombo({
        ...draft,
        customerCanRemoveItems: false,
      });

      await loadData();
      const msg = t('admin.comboSavedToast', { name: bi(draft.name) });
      setSavedToast(msg);
      window.setTimeout(() => {
        setSavedToast((prev) => (prev === msg ? null : prev));
      }, 3500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('admin.comboSaveErrorFallback'));
    }
  };

  if (isLoading) {
    return <ListSkeleton rows={3} rowHeightClass="h-28" />;
  }

  if (hasError) {
    return (
      <ErrorStateCard
        title={t('a11y.loadErrorTitle')}
        subtitle={t('a11y.loadErrorSubtitle')}
        retryLabel={t('a11y.retry')}
        onRetry={() => void loadData()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-dark-ink">
            {t('admin.combosPageTitle')}
          </h1>
          <p className="text-sm text-muted-text mt-0.5">{t('admin.combosPageSubtitle')}</p>
        </div>

        {draft && (
          <Link to={`/combo/${draft.type}`} className="shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="md"
              rightIcon={<ExternalLink className="w-4 h-4" />}
            >
              {t('admin.openComboBuilder')}
            </Button>
          </Link>
        )}
      </div>

      {/* Selector Tabs: Individual vs Family */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('admin.comboSelectLabel')}>
        {combos.map((c) => {
          const active = c.type === selectedType;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSelectComboType(c.type)}
              className={[
                'min-h-[44px] px-4 rounded-[10px] text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer',
                active
                  ? 'bg-fresh-green text-white'
                  : 'bg-white border border-border-grey text-dark-ink hover:bg-soft-grey',
              ].join(' ')}
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              <span>{bi(c.name)}</span>
              <span className={active ? 'text-warm-yellow font-bold' : 'text-fresh-green font-bold'}>
                {formatINR(c.price)}
              </span>
            </button>
          );
        })}
      </div>

      {savedToast && (
        <div
          role="status"
          className="rounded-[10px] bg-light-green border border-fresh-green/35 px-4 py-3 flex items-center gap-2 text-sm font-semibold text-fresh-green"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{savedToast}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-[10px] bg-alert-red-soft border border-alert-red/30 px-4 py-3 text-sm font-semibold text-alert-red"
        >
          {errorMsg}
        </div>
      )}

      {draft && (
        <form onSubmit={(e) => void handleSaveCombo(e)} className="space-y-5">
          {/* Combo Metadata + Rule Toggles */}
          <Card padding="lg" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="combo-name-en"
                  className="block text-xs font-semibold text-dark-ink mb-1"
                >
                  {t('admin.comboNameEnLabel')}
                </label>
                <input
                  id="combo-name-en"
                  type="text"
                  value={draft.name.en}
                  onChange={(e) =>
                    setDraft((p) => (p ? { ...p, name: { ...p.name, en: e.target.value } } : p))
                  }
                  className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="combo-name-ta"
                  className="block text-xs font-semibold text-dark-ink mb-1"
                >
                  {t('admin.comboNameTaLabel')}
                </label>
                <input
                  id="combo-name-ta"
                  type="text"
                  value={draft.name.ta}
                  onChange={(e) =>
                    setDraft((p) => (p ? { ...p, name: { ...p.name, ta: e.target.value } } : p))
                  }
                  className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="combo-base-price"
                  className="block text-xs font-semibold text-dark-ink mb-1"
                >
                  {t('admin.comboBasePriceLabel')}
                </label>
                <input
                  id="combo-base-price"
                  type="number"
                  min={1}
                  value={draft.price}
                  onChange={(e) =>
                    setDraft((p) =>
                      p ? { ...p, price: Math.max(1, Number(e.target.value) || 0) } : p,
                    )
                  }
                  className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm font-bold tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="combo-serves"
                  className="block text-xs font-semibold text-dark-ink mb-1"
                >
                  {t('admin.comboServesLabel')}
                </label>
                <input
                  id="combo-serves"
                  type="text"
                  value={draft.servesPeople}
                  onChange={(e) =>
                    setDraft((p) => (p ? { ...p, servesPeople: e.target.value } : p))
                  }
                  className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                />
              </div>
            </div>

            {/* Mandatory Rule Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border-grey/70">
              {/* Rule 1: Customer can remove items -> ALWAYS NO (Locked) */}
              <div className="rounded-[10px] bg-soft-grey border border-border-grey p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-dark-ink flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-muted-text" aria-hidden="true" />
                    <span>{t('admin.comboRuleRemoveLabel')}</span>
                  </p>
                  <p className="text-[11px] text-muted-text mt-0.5">
                    {t('combo.includedRuleNote')}
                  </p>
                </div>
                <Badge tone="red">{t('admin.comboRuleRemoveLocked')}</Badge>
              </div>

              {/* Rule 2: Customer can change brand -> Yes / No toggle */}
              <div className="rounded-[10px] bg-soft-grey border border-border-grey p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-dark-ink">
                    {t('admin.comboRuleBrandLabel')}
                  </p>
                  <p className="text-[11px] text-muted-text mt-0.5">
                    {draft.customerCanChangeBrand !== false
                      ? t('admin.comboBrandToggleEnabledHint')
                      : t('admin.comboBrandToggleLockedHint')}
                  </p>
                </div>

                <div className="inline-flex rounded-[8px] border border-border-grey bg-white p-0.5 shrink-0">
                  <button
                    type="button"
                    aria-pressed={draft.customerCanChangeBrand !== false}
                    onClick={() =>
                      setDraft((p) => (p ? { ...p, customerCanChangeBrand: true } : p))
                    }
                    className={[
                      'px-3 py-1.5 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors',
                      draft.customerCanChangeBrand !== false
                        ? 'bg-fresh-green text-white'
                        : 'text-muted-text hover:text-dark-ink',
                    ].join(' ')}
                  >
                    {t('admin.comboRuleYes')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={draft.customerCanChangeBrand === false}
                    onClick={() =>
                      setDraft((p) => (p ? { ...p, customerCanChangeBrand: false } : p))
                    }
                    className={[
                      'px-3 py-1.5 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors',
                      draft.customerCanChangeBrand === false
                        ? 'bg-dark-ink text-white'
                        : 'text-muted-text hover:text-dark-ink',
                    ].join(' ')}
                  >
                    {t('admin.comboRuleNo')}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Fixed Combo Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading font-bold text-lg text-dark-ink">
                {t('admin.comboItemsHeading', { count: draft.items.length })}
              </h2>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddFixedItem}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                {t('admin.comboAddFixedItemCta')}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {draft.items.map((item, idx) => {
                // Offer current allowed products + quick select from any catalog product
                const allowedProducts = item.allowedProductIds
                  .map((id) => products.find((p) => p.id === id))
                  .filter((p): p is Product => Boolean(p));

                const addableProducts = products.filter(
                  (p) => !item.allowedProductIds.includes(p.id),
                );

                return (
                  <Card key={item.id} padding="md" className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-muted-text mb-1">
                          #{idx + 1} · {t('admin.comboItemGroupEn')}
                        </label>
                        <input
                          type="text"
                          aria-label={`${t('admin.comboItemNameEnAria')} #${idx + 1}`}
                          value={item.productGroup.en}
                          onChange={(e) =>
                            updateItemField(item.id, (cur) => ({
                              ...cur,
                              productGroup: { ...cur.productGroup, en: e.target.value },
                            }))
                          }
                          className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm font-semibold"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-muted-text mb-1">
                          {t('admin.comboItemGroupTa')}
                        </label>
                        <input
                          type="text"
                          aria-label={`${t('admin.comboItemNameTaAria')} #${idx + 1}`}
                          value={item.productGroup.ta}
                          onChange={(e) =>
                            updateItemField(item.id, (cur) => ({
                              ...cur,
                              productGroup: { ...cur.productGroup, ta: e.target.value },
                            }))
                          }
                          className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-muted-text mb-1">
                          {t('admin.comboItemQtyLabel')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemField(item.id, (cur) => ({
                              ...cur,
                              quantity: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                          className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm tabular-nums font-semibold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-muted-text mb-1">
                          {t('admin.comboItemUnitLabel')}
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) =>
                            updateItemField(item.id, (cur) => ({
                              ...cur,
                              unit: e.target.value,
                            }))
                          }
                          className="w-full min-h-[40px] px-3 rounded-[8px] border border-border-grey bg-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Allowed brands with inline price editors */}
                    <div className="rounded-[10px] bg-soft-grey/80 border border-border-grey/80 p-3 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-dark-ink">
                          {t('admin.comboAllowedBrandsLabel')}
                        </span>

                        {addableProducts.length > 0 && (
                          <select
                            aria-label={`${t('admin.comboSelectAria')}: ${bi(item.productGroup)}`}
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleToggleAllowedBrand(item.id, e.target.value);
                              }
                            }}
                            className="w-full sm:w-auto max-w-full min-w-0 min-h-[36px] px-2.5 rounded-[8px] border border-border-grey bg-white text-xs font-medium text-dark-ink cursor-pointer"
                          >
                            <option value="">{t('admin.addBrandPlaceholder')}</option>
                            {addableProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {resolveBrandName(p.brandId, brands)} — {bi(p.name)} ({p.packSize})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {allowedProducts.map((prod) => {
                          const isDefault = item.defaultProductId === prod.id;
                          const brandName = resolveBrandName(prod.brandId, brands);
                          const currentPrice = priceEdits[prod.id] ?? prod.price;

                          return (
                            <div
                              key={prod.id}
                              className={[
                                'rounded-[8px] bg-white border p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0',
                                isDefault ? 'border-fresh-green' : 'border-border-grey',
                              ].join(' ')}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-dark-ink truncate">
                                  {brandName}
                                </p>
                                <p className="text-[11px] text-muted-text truncate">
                                  {bi(prod.name)} · {prod.packSize}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-text">₹</span>
                                  <input
                                    type="number"
                                    min={1}
                                    aria-label={t('admin.comboBrandPriceAria', { brand: brandName })}
                                    value={currentPrice}
                                    onChange={(e) =>
                                      setPriceEdits((prev) => ({
                                        ...prev,
                                        [prod.id]: Math.max(1, Number(e.target.value) || 0),
                                      }))
                                    }
                                    className="w-20 min-h-[34px] px-2 rounded-[6px] border border-border-grey text-xs font-bold tabular-nums text-dark-ink"
                                  />
                                </div>

                                {isDefault ? (
                                  <Badge tone="green">{t('admin.comboDefaultBrandTag')}</Badge>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItemField(item.id, (cur) => ({
                                        ...cur,
                                        defaultProductId: prod.id,
                                      }))
                                    }
                                    className="px-2 py-1 rounded-[6px] border border-border-grey text-[11px] font-semibold text-dark-ink hover:bg-light-green cursor-pointer"
                                  >
                                    {t('admin.comboSetDefaultBtn')}
                                  </button>
                                )}

                                {allowedProducts.length > 1 && (
                                  <button
                                    type="button"
                                    aria-label={t('admin.removeBrandAria', { brand: brandName })}
                                    onClick={() => handleToggleAllowedBrand(item.id, prod.id)}
                                    className="px-2 py-1 rounded-[6px] text-[11px] font-semibold text-alert-red hover:bg-alert-red/10 cursor-pointer"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              leftIcon={<Save className="w-4 h-4" />}
            >
              {t('admin.comboSaveCta')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
