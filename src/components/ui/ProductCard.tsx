import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Package } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useI18n } from '../../context/I18nContext';
import { getTotalAvailableQty, resolveBrandName } from '../../services/productService';
import { readStorageJson, writeStorageJson } from '../../services/storage';
import type { Brand, Category, Product } from '../../types';
import { calculateDiscountPercent, formatINR } from '../../utils/format';
import { resolveProductImage } from '../../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../../utils/tints';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { CategoryIcon } from './CategoryIcon';
import { Stepper } from './Stepper';

const NOTIFY_STORAGE_KEY = 'kfm_notify_products_v1';

export interface ProductCardProps {
  product: Product;
  brands?: Brand[];
  category?: Category;
  showInStockLabel?: boolean;
}

export function ProductCard({
  product,
  brands,
  category,
  showInStockLabel = false,
}: ProductCardProps) {
  const { bi, t } = useI18n();
  const { getProductQuantity, addItem, updateProductQuantity } = useCart();
  const [imgFailed, setImgFailed] = useState(false);
  const [notified, setNotified] = useState<boolean>(() => {
    const list = readStorageJson<string[]>(NOTIFY_STORAGE_KEY, []);
    return list.includes(product.id);
  });

  const quantity = getProductQuantity(product.id);
  const discount = calculateDiscountPercent(product.mrp, product.price);
  const imageUrl = resolveProductImage(product.image);
  const productTitle = bi(product.name);
  const brandName = resolveBrandName(product.brandId, brands);
  const tintClass = PRODUCT_TINT_CLASSES[product.imageTint];
  const availableStock = getTotalAvailableQty(product);
  const threshold = product.lowStockThreshold ?? 5;
  const isOutOfStock = availableStock <= 0;
  const isLowStock = availableStock > 0 && availableStock <= threshold;

  const handleToggleNotify = () => {
    const current = readStorageJson<string[]>(NOTIFY_STORAGE_KEY, []);
    const next = notified
      ? current.filter((id) => id !== product.id)
      : Array.from(new Set([...current, product.id]));
    writeStorageJson(NOTIFY_STORAGE_KEY, next);
    setNotified(!notified);
  };

  return (
    <Card
      padding="none"
      hoverable={!isOutOfStock}
      className={[
        'flex flex-col overflow-hidden h-full',
        isOutOfStock ? 'bg-white/80' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Link
        to={`/product/${product.id}`}
        className={[
          `relative block aspect-[4/3] w-full overflow-hidden ${tintClass} group focus-visible:outline-offset-[-2px]`,
          isOutOfStock ? 'opacity-65 grayscale-[55%]' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt={productTitle}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/85 flex items-center justify-center text-fresh-green mb-2 shadow-xs">
              {category ? (
                <CategoryIcon name={category.icon} className="w-6 h-6 text-fresh-green" />
              ) : (
                <Package className="w-6 h-6 text-fresh-green" aria-hidden="true" />
              )}
            </div>
            <span className="text-xs font-medium text-dark-ink/80 line-clamp-1">
              {category ? bi(category.name) : product.packSize}
            </span>
          </div>
        )}

        {discount > 0 && !isOutOfStock && (
          <div className="absolute top-2.5 left-2.5">
            <Badge tone="yellow">
              {t('common.offPercent', { percent: discount })}
            </Badge>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute inset-0 bg-dark-ink/15 flex items-end p-2.5">
            <Badge tone="dark">{t('common.outOfStock')}</Badge>
          </div>
        )}
      </Link>

      <div className="flex flex-col flex-1 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-text mb-1">
          <span className="truncate">
            {brandName} <span aria-hidden="true">·</span> {product.packSize}
          </span>
          {isLowStock ? (
            <span className="text-alert-red font-semibold whitespace-nowrap shrink-0">
              {t('common.lowStock', { count: availableStock })}
            </span>
          ) : showInStockLabel && !isOutOfStock ? (
            <span className="text-fresh-green font-semibold whitespace-nowrap shrink-0">
              {t('common.inStock')}
            </span>
          ) : null}
        </div>

        <Link
          to={`/product/${product.id}`}
          className={[
            'font-heading font-semibold text-sm sm:text-[15px] leading-snug transition-colors line-clamp-2 mb-3 min-h-[2.5rem]',
            isOutOfStock
              ? 'text-muted-text'
              : 'text-dark-ink hover:text-fresh-green',
          ].join(' ')}
        >
          {productTitle}
        </Link>

        <div className="mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-border-grey/50">
          <div className="flex items-baseline sm:flex-col gap-2 sm:gap-0">
            <span
              className={[
                'text-base font-bold tabular-nums leading-tight',
                isOutOfStock ? 'text-muted-text' : 'text-dark-ink',
              ].join(' ')}
            >
              {formatINR(product.price)}
            </span>
            {product.mrp > product.price && (
              <span className="text-xs text-muted-text line-through tabular-nums">
                {formatINR(product.mrp)}
              </span>
            )}
          </div>

          {isOutOfStock ? (
            <Button
              variant={notified ? 'secondary' : 'outline'}
              size="sm"
              aria-label={`${notified ? t('common.notified') : t('common.notifyMe')} ${productTitle}`}
              leftIcon={
                notified ? (
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                )
              }
              onClick={handleToggleNotify}
              className="w-full sm:w-auto font-semibold"
            >
              {notified ? t('common.notified') : t('common.notifyMe')}
            </Button>
          ) : quantity > 0 ? (
            <Stepper
              value={quantity}
              max={availableStock}
              itemName={productTitle}
              onIncrement={() => void updateProductQuantity(product.id, quantity + 1)}
              onDecrement={() => void updateProductQuantity(product.id, quantity - 1)}
              compact
              className="w-full sm:w-auto"
            />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              aria-label={`${t('common.add')} ${productTitle}`}
              onClick={() => void addItem(product.id, 1)}
              className="w-full sm:w-auto border border-fresh-green/30 font-semibold"
            >
              + {t('common.add')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
