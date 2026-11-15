import { Package } from 'lucide-react';
import type { ProductTint } from '../../types';
import { resolveProductImage } from '../../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../../utils/tints';

export interface ProductImageProps {
  tint: ProductTint;
  image?: string;
  alt: string;
  size?: 'sm' | 'md';
}

export function ProductImage({ tint, image, alt, size = 'sm' }: ProductImageProps) {
  const src = resolveProductImage(image);
  const tintCls = PRODUCT_TINT_CLASSES[tint] ?? 'bg-soft-grey';
  const dim = size === 'sm' ? 'w-11 h-11 rounded-[10px]' : 'w-14 h-14 rounded-[12px]';

  return (
    <div
      className={`${dim} ${tintCls} shrink-0 flex items-center justify-center overflow-hidden border border-border-grey/40`}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain p-1 mix-blend-multiply"
        />
      ) : (
        <Package className="w-5 h-5 text-dark-ink/60" aria-hidden="true" />
      )}
    </div>
  );
}
