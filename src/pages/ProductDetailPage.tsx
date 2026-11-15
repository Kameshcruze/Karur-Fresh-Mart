import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Package,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  ProductCard,
  Stepper,
} from '../components/ui';
import { useCart } from '../context/CartContext';
import { useI18n } from '../context/I18nContext';
import {
  getBrands,
  getCategories,
  getFrequentlyBoughtTogether,
  getProductById,
  getProductPackVariants,
  getProducts,
  getTotalAvailableQty,
  resolveBrandName,
  subscribeToCatalogUpdates,
} from '../services';
import { readStorageJson, writeStorageJson } from '../services/storage';
import type { Brand, Category, Product, ProductVariant } from '../types';
import { calculateDiscountPercent, formatINR } from '../utils/format';
import { resolveProductImage } from '../utils/productImages';
import { PRODUCT_TINT_CLASSES } from '../utils/tints';

const NOTIFY_STORAGE_KEY = 'kfm_notify_products_v1';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, bi } = useI18n();
  const { addItem, getProductQuantity } = useCart();

  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedVariantId, setSelectedVariantId] = useState<string>('default');
  const [selectedGalleryIdx, setSelectedGalleryIdx] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [justAdded, setJustAdded] = useState<boolean>(false);
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const [notified, setNotified] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setIsLoading(true);
    setSelectedGalleryIdx(0);
    setQuantity(1);
    setJustAdded(false);
    setImgFailed(false);

    const loadPdp = (showSpinner: boolean) => {
      if (showSpinner) setIsLoading(true);
      void Promise.all([
        getProductById(id),
        getProducts(),
        getCategories(),
        getBrands(),
      ]).then(([found, prods, cats, brs]) => {
        if (!active) return;
        setProduct(found);
        setAllProducts(prods);
        setCategories(cats);
        setBrands(brs);

        if (found) {
          const variants = getProductPackVariants(found);
          const def = variants.find((v) => v.isDefault) ?? variants[0];
          setSelectedVariantId((prev) =>
            variants.some((v) => v.id === prev) ? prev : def?.id ?? 'default',
          );
          const notifyList = readStorageJson<string[]>(NOTIFY_STORAGE_KEY, []);
          setNotified(notifyList.includes(found.id));
        }
        setIsLoading(false);
      });
    };

    loadPdp(true);
    const unsub = subscribeToCatalogUpdates(() => loadPdp(false));

    return () => {
      active = false;
      unsub();
    };
  }, [id]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const variants: ProductVariant[] = useMemo(
    () => (product ? getProductPackVariants(product) : []),
    [product],
  );

  const selectedVariant = useMemo(
    () =>
      variants.find((v) => v.id === selectedVariantId) ??
      variants.find((v) => v.isDefault) ??
      variants[0],
    [variants, selectedVariantId],
  );

  const frequentlyBought = useMemo(
    () => (product ? getFrequentlyBoughtTogether(product, allProducts, 4) : []),
    [product, allProducts],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 h-80 sm:h-96 rounded-[12px] bg-white border border-border-grey/60 animate-pulse" />
          <div className="lg:col-span-6 h-80 sm:h-96 rounded-[12px] bg-white border border-border-grey/60 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product || !selectedVariant) {
    return (
      <Card className="max-w-lg mx-auto text-center py-12 space-y-4">
        <h1 className="font-heading font-bold text-xl text-dark-ink">
          {t('product.notFoundTitle')}
        </h1>
        <p className="text-sm text-muted-text">{t('product.notFoundSubtitle')}</p>
        <Link to="/" className="inline-block">
          <Button variant="primary" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            {t('product.backHome')}
          </Button>
        </Link>
      </Card>
    );
  }

  const productTitle = bi(product.name);
  const brandName = resolveBrandName(product.brandId, brands);
  const category = categoryById.get(product.categoryId);
  const tintClass = PRODUCT_TINT_CLASSES[product.imageTint];
  const imageUrl = resolveProductImage(product.image);

  const availableStock = getTotalAvailableQty(product);
  const threshold = product.lowStockThreshold ?? 5;
  const isOutOfStock = availableStock <= 0;
  const isLowStock = availableStock > 0 && availableStock <= threshold;
  const discount = calculateDiscountPercent(selectedVariant.mrp, selectedVariant.price);
  const savings = Math.max(0, selectedVariant.mrp - selectedVariant.price);
  const inCartQty = getProductQuantity(product.id, selectedVariant.id);

  // Gallery frames: Photo/Pack view, Zoomed detail/Texture view, Brand & Pack guarantee card
  const gallerySlides = [
    { id: 'main', mode: 'photo' as const, imgClass: 'object-cover' },
    {
      id: 'detail',
      mode: 'zoom' as const,
      imgClass: 'object-cover scale-115 object-center',
    },
    { id: 'pack', mode: 'badge' as const, imgClass: 'object-cover' },
  ];
  const activeSlide = gallerySlides[selectedGalleryIdx] ?? gallerySlides[0];

  const handleToggleNotify = () => {
    const current = readStorageJson<string[]>(NOTIFY_STORAGE_KEY, []);
    const next = notified
      ? current.filter((pid) => pid !== product.id)
      : Array.from(new Set([...current, product.id]));
    writeStorageJson(NOTIFY_STORAGE_KEY, next);
    setNotified(!notified);
  };

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    await addItem(
      product.id,
      quantity,
      selectedVariant.id,
      selectedVariant.packSize,
    );
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  const handleBuyNow = async () => {
    if (isOutOfStock) return;
    await addItem(
      product.id,
      quantity,
      selectedVariant.id,
      selectedVariant.packSize,
    );
    navigate('/checkout');
  };

  return (
    <div className="space-y-8 sm:space-y-10 pb-20 md:pb-0">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-text"
      >
        <Link to="/" className="hover:text-fresh-green font-medium">
          {t('nav.home')}
        </Link>
        {category && (
          <>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <Link
              to={`/category/${category.slug}`}
              className="hover:text-fresh-green font-medium"
            >
              {bi(category.name)}
            </Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="text-dark-ink font-semibold truncate max-w-[240px] sm:max-w-none">
          {productTitle}
        </span>
      </nav>

      {/* Main Two-Column Product Showcase */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left: Image Gallery */}
        <div className="lg:col-span-6 space-y-3">
          <div
            className={`relative aspect-[4/3] w-full rounded-[12px] ${tintClass} border border-border-grey/80 shadow-[var(--shadow-card)] overflow-hidden flex items-center justify-center`}
          >
            {activeSlide.mode === 'badge' || !imageUrl || imgFailed ? (
              <div
                className={[
                  'w-full h-full flex flex-col items-center justify-center p-6 text-center gap-3',
                  isOutOfStock ? 'opacity-65 grayscale-[55%]' : '',
                ].join(' ')}
              >
                <div className="w-20 h-20 rounded-[16px] bg-white/90 flex items-center justify-center shadow-sm">
                  {category ? (
                    <CategoryIcon
                      name={category.icon}
                      className="w-10 h-10 text-fresh-green"
                    />
                  ) : (
                    <Package className="w-10 h-10 text-fresh-green" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-heading font-bold text-base sm:text-lg text-dark-ink">
                    {brandName} · {selectedVariant.packSize}
                  </p>
                  <p className="text-xs sm:text-sm text-dark-ink/75">
                    {category ? bi(category.name) : productTitle}
                  </p>
                </div>
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={productTitle}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className={[
                  'w-full h-full transition-transform duration-300',
                  activeSlide.imgClass,
                  isOutOfStock ? 'opacity-65 grayscale-[55%]' : '',
                ].join(' ')}
              />
            )}

            {discount > 0 && !isOutOfStock && (
              <div className="absolute top-3 left-3">
                <Badge tone="yellow" className="text-xs px-2.5 py-1 shadow-xs">
                  {t('common.offPercent', { percent: discount })}
                </Badge>
              </div>
            )}

            {isOutOfStock && (
              <div className="absolute top-3 left-3">
                <Badge tone="dark" className="text-xs px-2.5 py-1">
                  {t('common.outOfStock')}
                </Badge>
              </div>
            )}
          </div>

          {/* Thumbnail Selector */}
          <div className="grid grid-cols-3 gap-2.5">
            {gallerySlides.map((slide, idx) => {
              const active = idx === selectedGalleryIdx;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setSelectedGalleryIdx(idx)}
                  aria-label={t('product.galleryThumb', { index: idx + 1 })}
                  aria-pressed={active}
                  className={[
                    `relative aspect-[4/3] rounded-[10px] ${tintClass} overflow-hidden border-2 transition-all cursor-pointer flex items-center justify-center`,
                    active
                      ? 'border-fresh-green ring-2 ring-fresh-green/20'
                      : 'border-border-grey hover:border-fresh-green/50 opacity-80 hover:opacity-100',
                  ].join(' ')}
                >
                  {slide.mode === 'badge' || !imageUrl || imgFailed ? (
                    <div className="flex flex-col items-center justify-center p-2 text-center">
                      {category ? (
                        <CategoryIcon
                          name={category.icon}
                          className="w-5 h-5 text-fresh-green"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-fresh-green" aria-hidden="true" />
                      )}
                      <span className="text-[11px] font-semibold text-dark-ink mt-1">
                        {selectedVariant.packSize}
                      </span>
                    </div>
                  ) : (
                    <img
                      src={imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className={`w-full h-full ${slide.imgClass}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Product Info, Pack Size Selector, Pricing & Purchase Actions */}
        <div className="lg:col-span-6">
          <Card padding="lg" className="space-y-5">
            {/* Brand, SKU & Rating */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-fresh-green">
                <span>{brandName}</span>
                {product.sku && (
                  <span className="text-muted-text font-normal">
                    · {t('product.skuLabel')}: {product.sku}
                  </span>
                )}
              </div>

              {product.rating && (
                <Badge tone="green" icon={<Star className="w-3 h-3 fill-current" />}>
                  <span className="tabular-nums">{product.rating.toFixed(1)}</span>
                </Badge>
              )}
            </div>

            {/* Product Name */}
            <div className="space-y-2">
              <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink leading-tight">
                {productTitle}
              </h1>

              {/* Stock Status Chip */}
              <div className="flex flex-wrap items-center gap-2">
                {isOutOfStock ? (
                  <Badge tone="dark">{t('common.outOfStock')}</Badge>
                ) : isLowStock ? (
                  <Badge tone="red">
                    {t('common.lowStock', { count: availableStock })}
                  </Badge>
                ) : (
                  <Badge tone="green">{t('common.inStock')}</Badge>
                )}

                {inCartQty > 0 && (
                  <Badge tone="yellow">
                    {t('product.inCartCount', { count: inCartQty })}
                  </Badge>
                )}
              </div>
            </div>

            {/* Price, Struck MRP, Yellow Discount Chip */}
            <div className="p-4 rounded-[12px] bg-soft-grey border border-border-grey/70 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span
                  data-testid="pdp-price"
                  className="font-heading font-bold text-2xl sm:text-3xl text-dark-ink tabular-nums"
                >
                  {formatINR(selectedVariant.price)}
                </span>
                {selectedVariant.mrp > selectedVariant.price && (
                  <span className="text-base text-muted-text line-through tabular-nums">
                    {formatINR(selectedVariant.mrp)}
                  </span>
                )}
              </div>

              {discount > 0 && (
                <div className="flex items-center gap-2">
                  <Badge tone="yellow" className="text-xs px-2.5 py-1">
                    {t('common.offPercent', { percent: discount })}
                  </Badge>
                  {savings > 0 && (
                    <span className="text-xs font-semibold text-fresh-green tabular-nums">
                      {t('product.savingsLine', { amount: formatINR(savings) })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Pack Size Selector (e.g., 50 g / 100 g / 250 g with prices) */}
            <div className="space-y-2.5">
              <p className="font-heading font-semibold text-sm text-dark-ink">
                {t('product.packSize')}
              </p>
              <div
                role="radiogroup"
                aria-label={t('product.packSize')}
                className="grid grid-cols-3 gap-2.5"
              >
                {variants.map((variant) => {
                  const isSelected = variant.id === selectedVariant.id;
                  const variantDiscount = calculateDiscountPercent(
                    variant.mrp,
                    variant.price,
                  );
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={[
                        'min-h-[64px] p-2.5 sm:p-3 rounded-[10px] border text-left transition-all cursor-pointer flex flex-col justify-between gap-1',
                        isSelected
                          ? 'bg-light-green border-fresh-green ring-1 ring-fresh-green'
                          : 'bg-white border-border-grey hover:border-fresh-green/60',
                      ].join(' ')}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span
                          className={[
                            'font-heading font-bold text-xs sm:text-sm whitespace-nowrap',
                            isSelected ? 'text-fresh-green' : 'text-dark-ink',
                          ].join(' ')}
                        >
                          {variant.packSize}
                        </span>
                        {variantDiscount > 0 && (
                          <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-warm-yellow text-dark-ink tabular-nums whitespace-nowrap">
                            -{variantDiscount}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-dark-ink tabular-nums">
                          {formatINR(variant.price)}
                        </span>
                        {variant.mrp > variant.price && (
                          <span className="text-[11px] text-muted-text line-through tabular-nums">
                            {formatINR(variant.mrp)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity Stepper + Add to Cart & Buy Now (Desktop/Tablet) */}
            {isOutOfStock ? (
              <div className="pt-2">
                <Button
                  variant={notified ? 'secondary' : 'outline'}
                  size="lg"
                  fullWidth
                  leftIcon={
                    notified ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )
                  }
                  onClick={handleToggleNotify}
                >
                  {notified ? t('common.notified') : t('common.notifyMe')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-heading font-semibold text-sm text-dark-ink">
                    {t('product.quantity')}
                  </span>
                  <Stepper
                    value={quantity}
                    min={1}
                    max={availableStock}
                    itemName={productTitle}
                    onIncrement={() =>
                      setQuantity((q) => Math.min(availableStock, q + 1))
                    }
                    onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
                  />
                </div>

                <div className="hidden md:grid grid-cols-2 gap-3 pt-1">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => void handleAddToCart()}
                    leftIcon={
                      justAdded ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <ShoppingBag className="w-4 h-4" />
                      )
                    }
                  >
                    {justAdded ? t('product.addedToCart') : t('product.addToCart')}
                  </Button>

                  <Button
                    variant="yellow"
                    size="lg"
                    onClick={() => void handleBuyNow()}
                    leftIcon={<Zap className="w-4 h-4" />}
                  >
                    {t('product.buyNow')}
                  </Button>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="pt-4 border-t border-border-grey/70 space-y-2">
              <h2 className="font-heading font-semibold text-sm text-dark-ink">
                {t('product.description')}
              </h2>
              <p className="text-sm text-muted-text leading-relaxed">
                {bi(product.description)}
              </p>
            </div>

            {/* Delivery & Quality Note */}
            <div className="rounded-[10px] bg-light-green/60 border border-fresh-green/20 p-3.5 space-y-2 text-xs text-dark-ink">
              <div className="flex items-center gap-2 font-medium">
                <Truck className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
                <span>{t('product.deliveryNote')}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-text">
                <ShieldCheck className="w-4 h-4 text-fresh-green shrink-0" aria-hidden="true" />
                <span>{t('brand.tagline')}</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Frequently Bought Together Row */}
      {frequentlyBought.length > 0 && (
        <section aria-labelledby="fbt-heading" className="space-y-4">
          <div>
            <h2
              id="fbt-heading"
              className="font-heading font-bold text-xl sm:text-2xl text-dark-ink"
            >
              {t('product.frequentlyBought')}
            </h2>
            <p className="text-sm text-muted-text mt-0.5">
              {t('product.frequentlyBoughtSubtitle')}
            </p>
          </div>

          <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 sm:overflow-visible">
            {frequentlyBought.map((item) => (
              <div
                key={item.id}
                className="w-[62vw] max-w-[235px] shrink-0 snap-start sm:w-auto sm:max-w-none"
              >
                <ProductCard
                  product={item}
                  brands={brands}
                  category={categoryById.get(item.categoryId)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fixed Bottom Add to Cart Bar on Mobile */}
      <div className="md:hidden fixed bottom-[60px] left-0 right-0 z-35 bg-white/95 backdrop-blur-md border-t border-border-grey px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        {isOutOfStock ? (
          <Button
            variant={notified ? 'secondary' : 'outline'}
            size="md"
            fullWidth
            leftIcon={
              notified ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />
            }
            onClick={handleToggleNotify}
          >
            {notified ? t('common.notified') : t('common.notifyMe')}
          </Button>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 pr-1">
              <p className="text-[11px] font-medium text-muted-text truncate">
                {selectedVariant.packSize} × {quantity}
              </p>
              <p className="font-heading font-bold text-base text-dark-ink tabular-nums leading-tight">
                {formatINR(selectedVariant.price * quantity)}
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => void handleAddToCart()}
              leftIcon={
                justAdded ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <ShoppingBag className="w-4 h-4" />
                )
              }
              className="flex-1"
            >
              {justAdded ? t('product.addedToCart') : t('product.addToCart')}
            </Button>

            <Button
              variant="yellow"
              size="md"
              onClick={() => void handleBuyNow()}
              className="shrink-0"
            >
              {t('product.buyNow')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
