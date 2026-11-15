import React, { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button, Card, ProductImage } from '../../ui';
import { useI18n } from '../../../context/I18nContext';
import { splitPackAndUnit, formatPackAndUnit } from '../../../mock/stockSeed';
import type { Brand, Category, Product, ProductTint } from '../../../types';

const TINT_OPTIONS: ProductTint[] = ['rice', 'dal', 'oil', 'spice', 'dairy', 'salt'];
const UNIT_OPTIONS = ['kg', 'g', 'L', 'ml', 'pcs', 'pack'];

export interface StockProductModalProps {
  open: boolean;
  editingProduct: Product | null;
  brands: Brand[];
  categories: Category[];
  onClose: () => void;
  onSave: (product: Product, oldStockQty?: number) => Promise<void>;
}

export function StockProductModal({
  open,
  editingProduct,
  brands,
  categories,
  onClose,
  onSave,
}: StockProductModalProps) {
  const { t, bi } = useI18n();

  const [sku, setSku] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [packSizeVal, setPackSizeVal] = useState('1');
  const [unit, setUnit] = useState('kg');
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [stockQty, setStockQty] = useState('25');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [image, setImage] = useState('');
  const [imageTint, setImageTint] = useState<ProductTint>('rice');
  const [descEn, setDescEn] = useState('');
  const [descTa, setDescTa] = useState('');
  const [visibleOnline, setVisibleOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingProduct) {
      const split = splitPackAndUnit(editingProduct.packSize, editingProduct.unit);
      setSku(editingProduct.sku ?? '');
      setNameEn(editingProduct.name.en);
      setNameTa(editingProduct.name.ta);
      setBrandId(editingProduct.brandId);
      setCategoryId(editingProduct.categoryId);
      setPackSizeVal(split.packSize);
      setUnit(split.unit);
      setMrp(String(editingProduct.mrp));
      setPrice(String(editingProduct.price));
      setStockQty(String(editingProduct.stockQty));
      setLowStockThreshold(String(editingProduct.lowStockThreshold ?? 5));
      setImage(editingProduct.image ?? '');
      setImageTint(editingProduct.imageTint);
      setDescEn(editingProduct.description.en);
      setDescTa(editingProduct.description.ta);
      setVisibleOnline(editingProduct.visibleOnline);
    } else {
      setSku('');
      setNameEn('');
      setNameTa('');
      setBrandId(brands[0]?.id ?? 'brand-karur-gold');
      setCategoryId(categories[0]?.id ?? 'cat-rice');
      setPackSizeVal('1');
      setUnit('kg');
      setMrp('');
      setPrice('');
      setStockQty('25');
      setLowStockThreshold('5');
      setImage('');
      setImageTint('rice');
      setDescEn('');
      setDescTa('');
      setVisibleOnline(true);
    }
  }, [open, editingProduct, brands, categories]);

  if (!open) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNameEn = nameEn.trim();
    const cleanNameTa = nameTa.trim() || cleanNameEn;
    const parsedPrice = Number(price);
    const parsedMrp = mrp.trim() ? Number(mrp) : parsedPrice;
    const parsedStock = Number(stockQty);
    const parsedThreshold = Number(lowStockThreshold || 5);

    if (!cleanNameEn) {
      setError('Product name in English is required.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Selling price must be greater than ₹0.');
      return;
    }
    if (!Number.isFinite(parsedMrp) || parsedMrp < parsedPrice) {
      setError('MRP must be equal to or greater than selling price.');
      return;
    }
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setError('Stock quantity must be zero or positive.');
      return;
    }
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      setError('Low-stock threshold must be zero or positive.');
      return;
    }

    const combinedPack = formatPackAndUnit(packSizeVal, unit);
    const nextProduct: Product = {
      id:
        editingProduct?.id ??
        `prod-${cleanNameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}-${Date.now().toString(36)}`,
      sku: sku.trim() || undefined,
      name: { en: cleanNameEn, ta: cleanNameTa },
      brandId: brandId || brands[0]?.id || 'brand-karur-gold',
      categoryId: categoryId || categories[0]?.id || 'cat-rice',
      packSize: combinedPack,
      unit: unit.trim() || 'pack',
      price: Math.round(parsedPrice),
      mrp: Math.round(parsedMrp),
      stockQty: Math.floor(parsedStock),
      reservedQty: editingProduct?.reservedQty ?? 0,
      lowStockThreshold: Math.floor(parsedThreshold),
      imageTint,
      image: image.trim() || undefined,
      description: {
        en: descEn.trim() || `${cleanNameEn} (${combinedPack}) stocked at Karur Fresh Mart.`,
        ta: descTa.trim() || `${cleanNameTa} (${combinedPack}) கரூர் பிரஷ் மார்ட் கையிருப்பு.`,
      },
      visibleOnline,
      isFeatured: editingProduct?.isFeatured,
      rating: editingProduct?.rating,
      packVariants: editingProduct?.packVariants,
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await onSave(nextProduct, editingProduct?.stockQty);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-ink/55 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-product-modal-title"
    >
      <Card padding="lg" className="w-full max-w-3xl max-h-[92vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-grey">
          <h2
            id="stock-product-modal-title"
            className="font-heading font-bold text-lg text-dark-ink"
          >
            {editingProduct ? t('admin.manualFormEditTitle') : t('admin.manualFormAddTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('admin.closePanel')}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-[8px] text-muted-text hover:bg-soft-grey cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="stock-prod-name-en" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldNameEn')} *
              </label>
              <input
                id="stock-prod-name-en"
                type="text"
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Ponni Raw Rice"
                className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
              />
            </div>

            <div>
              <label htmlFor="stock-prod-name-ta" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldNameTa')}
              </label>
              <input
                id="stock-prod-name-ta"
                type="text"
                value={nameTa}
                onChange={(e) => setNameTa(e.target.value)}
                placeholder="e.g. பொன்னி பச்சரிசி"
                className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
              />
            </div>

            <div>
              <label htmlFor="stock-prod-sku" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldSku')}
              </label>
              <input
                id="stock-prod-sku"
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Optional e.g. KFM-RIC-110"
                className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
              />
            </div>

            <div>
              <label htmlFor="stock-prod-brand" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldBrand')}
              </label>
              <select
                id="stock-prod-brand"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="stock-prod-category" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldCategory')}
              </label>
              <select
                id="stock-prod-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {bi(c.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="stock-prod-pack" className="block text-xs font-semibold text-dark-ink mb-1">
                  {t('admin.fieldPackSize')}
                </label>
                <input
                  id="stock-prod-pack"
                  type="text"
                  value={packSizeVal}
                  onChange={(e) => setPackSizeVal(e.target.value)}
                  placeholder="500"
                  className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm"
                />
              </div>
              <div>
                <label htmlFor="stock-prod-unit" className="block text-xs font-semibold text-dark-ink mb-1">
                  {t('admin.fieldUnit')}
                </label>
                <select
                  id="stock-prod-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full min-h-[42px] px-2.5 rounded-[10px] border border-border-grey bg-white text-sm"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="stock-prod-mrp" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldMrp')} *
              </label>
              <input
                id="stock-prod-mrp"
                type="number"
                min={1}
                required
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="stock-prod-price" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldPrice')} *
              </label>
              <input
                id="stock-prod-price"
                type="number"
                min={1}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="stock-prod-qty" className="block text-xs font-semibold text-dark-ink mb-1">
                  {t('admin.fieldStockQty')} *
                </label>
                <input
                  id="stock-prod-qty"
                  type="number"
                  min={0}
                  required
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="stock-prod-threshold" className="block text-xs font-semibold text-dark-ink mb-1">
                  {t('admin.fieldThreshold')}
                </label>
                <input
                  id="stock-prod-threshold"
                  type="number"
                  min={0}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-[10px] border border-border-grey bg-white text-sm tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Image Upload & Tint */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center p-3.5 rounded-[10px] bg-soft-grey border border-border-grey/70">
            <div className="sm:col-span-2 flex justify-center">
              <ProductImage
                tint={imageTint}
                image={image || undefined}
                alt={nameEn || 'Preview'}
                size="md"
              />
            </div>
            <div className="sm:col-span-5 space-y-1.5">
              <label className="block text-xs font-semibold text-dark-ink">
                {t('admin.fieldImageUpload')}
              </label>
              <label className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-[10px] bg-white border border-border-grey text-xs font-semibold text-dark-ink hover:bg-light-green cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-fresh-green" aria-hidden="true" />
                <span>Upload JPG / PNG</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder={t('admin.fieldImageUrlOptional')}
                className="w-full min-h-[38px] px-2.5 rounded-[8px] border border-border-grey bg-white text-xs"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="stock-prod-tint" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldTint')}
              </label>
              <select
                id="stock-prod-tint"
                value={imageTint}
                onChange={(e) => setImageTint(e.target.value as ProductTint)}
                className="w-full min-h-[40px] px-3 rounded-[10px] border border-border-grey bg-white text-xs capitalize"
              >
                {TINT_OPTIONS.map((tint) => (
                  <option key={tint} value={tint}>
                    {tint}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex items-center">
              <label className="inline-flex items-center gap-2 min-h-[42px] text-xs font-semibold text-dark-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleOnline}
                  onChange={(e) => setVisibleOnline(e.target.checked)}
                  className="w-4 h-4 accent-fresh-green rounded"
                />
                <span>{t('admin.fieldVisibleOnline')}</span>
              </label>
            </div>
          </div>

          {/* Descriptions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="stock-prod-desc-en" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldDescriptionEn')}
              </label>
              <textarea
                id="stock-prod-desc-en"
                rows={2}
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                className="w-full p-2.5 rounded-[10px] border border-border-grey bg-white text-xs sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="stock-prod-desc-ta" className="block text-xs font-semibold text-dark-ink mb-1">
                {t('admin.fieldDescriptionTa')}
              </label>
              <textarea
                id="stock-prod-desc-ta"
                rows={2}
                value={descTa}
                onChange={(e) => setDescTa(e.target.value)}
                className="w-full p-2.5 rounded-[10px] border border-border-grey bg-white text-xs sm:text-sm"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-semibold text-alert-red">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-grey">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {t('admin.saveProductCta')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
