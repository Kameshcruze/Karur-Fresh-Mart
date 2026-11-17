import { MOCK_BRANDS } from '../mock/brands';
import { MOCK_COMBOS } from '../mock/combos';
import { MOCK_COUPONS } from '../mock/offers';
import { MOCK_PRODUCTS } from '../mock/products';
import { DEMO_USERS } from '../mock/users';
import type {
  Cart,
  CartItem,
  CartSummary,
  Combo,
  Coupon,
  DeliverySlotId,
  PricedCartLine,
  Product,
  User,
} from '../types';
import { apiClient, isMockMode } from './api';
import { calculateComboPricing } from './comboService';
import { computeCouponDiscount } from './offerService';
import {
  getProductPackVariants,
  loadProductsStore,
  resolveBrandName,
} from './productService';
import { readStorageJson, writeStorageJson } from './storage';

const USER_CARTS_STORAGE_KEY = 'kfm_user_carts_v2';
const CART_REMINDERS_STORAGE_KEY = 'kfm_cart_reminders_v2';
const AUTH_USER_STORAGE_KEY = 'kfm_auth_user_v2';
export const CART_UPDATED_EVENT = 'kfm:carts-updated';
export const FREE_DELIVERY_THRESHOLD_INR = 499;
export const STANDARD_DELIVERY_FEE_INR = 25;
export const DEFAULT_DELIVERY_SLOT: DeliverySlotId = '45min';

type CartUpdateListener = () => void;
const inMemoryCartListeners = new Set<CartUpdateListener>();

export function notifyCartsChanged(): void {
  for (const listener of inMemoryCartListeners) {
    try {
      listener();
    } catch {
      // Ignore individual subscriber errors
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
  }
}

export function subscribeToCartUpdates(listener: CartUpdateListener): () => void {
  inMemoryCartListeners.add(listener);

  if (typeof window === 'undefined') {
    return () => {
      inMemoryCartListeners.delete(listener);
    };
  }

  const handleCustom = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === USER_CARTS_STORAGE_KEY ||
      event.key === CART_REMINDERS_STORAGE_KEY
    ) {
      listener();
    }
  };

  window.addEventListener(CART_UPDATED_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);

  return () => {
    inMemoryCartListeners.delete(listener);
    window.removeEventListener(CART_UPDATED_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function getCartReminders(): Promise<Record<string, string>> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ reminders: Record<string, string> }>(
      '/admin/live-carts/reminders',
    );
    return res.reminders;
  }
  return readStorageJson<Record<string, string>>(CART_REMINDERS_STORAGE_KEY, {});
}

/**
 * Records a mock WhatsApp/SMS cart reminder timestamp per customer.
 * INTEGRATION SEAM (WhatsApp Business Template Campaign):
 * Calls `POST /api/admin/live-carts/:userId/remind` when `USE_MOCK` is false.
 */
export async function saveUserCartReminder(
  userId: string,
): Promise<Record<string, string>> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ reminders: Record<string, string> }>(
      `/admin/live-carts/${encodeURIComponent(userId)}/remind`,
    );
    notifyCartsChanged();
    return res.reminders;
  }
  const existing = readStorageJson<Record<string, string>>(
    CART_REMINDERS_STORAGE_KEY,
    {},
  );
  const next = {
    ...existing,
    [userId]: new Date().toISOString(),
  };
  writeStorageJson(CART_REMINDERS_STORAGE_KEY, next);
  notifyCartsChanged();
  return next;
}

function getActiveUserId(explicitUserId?: string): string {
  if (explicitUserId) return explicitUserId;
  const user = readStorageJson<User | null>(AUTH_USER_STORAGE_KEY, null);
  return user?.id ?? DEMO_USERS.customer.id;
}

function createEmptyCart(userId: string): Cart {
  return {
    userId,
    items: [],
    deliverySlot: DEFAULT_DELIVERY_SLOT,
    updatedAt: new Date(0).toISOString(),
  };
}

function loadAllUserCartsMap(): Record<string, Cart> {
  return readStorageJson<Record<string, Cart>>(USER_CARTS_STORAGE_KEY, {});
}

function loadCartStore(userId?: string): Cart {
  const uid = getActiveUserId(userId);
  const all = loadAllUserCartsMap();
  const existing = all[uid];
  if (existing && Array.isArray(existing.items)) {
    return {
      ...existing,
      userId: uid,
      deliverySlot: existing.deliverySlot ?? DEFAULT_DELIVERY_SLOT,
    };
  }
  return {
    ...createEmptyCart(uid),
    updatedAt: new Date().toISOString(),
  };
}

function saveCartStore(cart: Cart, userId?: string): void {
  const uid = getActiveUserId(userId ?? cart.userId);
  const all = loadAllUserCartsMap();
  all[uid] = {
    ...cart,
    userId: uid,
    deliverySlot: cart.deliverySlot ?? DEFAULT_DELIVERY_SLOT,
    updatedAt: new Date().toISOString(),
  };
  writeStorageJson(USER_CARTS_STORAGE_KEY, all);
  notifyCartsChanged();
}

/**
 * Pure computation of cart lines, combo brand pricing, coupon discount, delivery slot, and delivery fee.
 */
export function computeCartSummary(
  cart: Cart,
  catalog: Product[] = MOCK_PRODUCTS,
  combos: Combo[] = MOCK_COMBOS,
  coupons: Coupon[] = MOCK_COUPONS,
  deliveryConfig?: { deliveryFeeInr?: number; freeDeliveryThresholdInr?: number },
): CartSummary {
  const lines: PricedCartLine[] = [];

  for (const cartItem of cart.items) {
    const qty = Math.max(0, Math.floor(cartItem.quantity));
    if (qty <= 0) continue;

    if (cartItem.kind === 'product' && cartItem.productId) {
      const product = catalog.find((p) => p.id === cartItem.productId);
      if (!product) continue;

      const brandName = resolveBrandName(product.brandId, MOCK_BRANDS);
      const variants = getProductPackVariants(product);
      const selectedVariant =
        cartItem.variantId && cartItem.variantId !== 'default'
          ? variants.find((v) => v.id === cartItem.variantId)
          : variants.find((v) => v.isDefault) ?? variants[0];

      const effectivePackSize = selectedVariant?.packSize ?? cartItem.packSize ?? product.packSize;
      const unitPrice = selectedVariant?.price ?? product.price;
      const unitMrp = selectedVariant?.mrp ?? product.mrp;
      const lineTotal = unitPrice * qty;
      const lineMrpTotal = unitMrp * qty;

      lines.push({
        cartItem: { ...cartItem, packSize: effectivePackSize, quantity: qty },
        title: product.name,
        subtitle: `${brandName} · ${effectivePackSize}`,
        imageTint: product.imageTint,
        image: product.image,
        unitPrice,
        unitMrp,
        lineTotal,
        lineMrpTotal,
        lineSavings: Math.max(0, lineMrpTotal - lineTotal),
      });
    } else if (cartItem.kind === 'combo' && cartItem.comboId) {
      const combo = combos.find((c) => c.id === cartItem.comboId);
      if (!combo) continue;

      const pricing = calculateComboPricing(
        combo,
        cartItem.selectedBrandProductIds ?? {},
        catalog,
        MOCK_BRANDS,
      );

      const lineTotal = pricing.unitPrice * qty;
      const lineMrpTotal = pricing.unitMrp * qty;

      lines.push({
        cartItem: {
          ...cartItem,
          selectedBrandProductIds: pricing.resolvedSelections,
          quantity: qty,
        },
        title: combo.name,
        subtitle: `${combo.items.length} items · ${combo.servesPeople}`,
        imageTint: combo.imageTint,
        image: combo.image,
        unitPrice: pricing.unitPrice,
        unitMrp: pricing.unitMrp,
        lineTotal,
        lineMrpTotal,
        lineSavings: Math.max(0, lineMrpTotal - lineTotal),
        comboSavingsVsSeparate: pricing.savingsVsSeparate * qty,
        comboCanChangeBrand: combo.customerCanChangeBrand !== false,
        comboTemporarilyUnavailable: pricing.isUnavailable,
        comboBrandBreakdown: pricing.breakdown.map((b) => ({
          comboItemId: b.comboItemId,
          groupName: b.groupName,
          product: b.product,
          brandName: b.brandName,
          quantity: b.quantity,
          unit: b.unit,
          deltaFromDefault: b.deltaFromDefault,
          isUnavailable: b.isUnavailable,
          options: b.options,
        })),
      });
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const mrpTotal = lines.reduce((sum, l) => sum + l.lineMrpTotal, 0);
  const productSavings = Math.max(0, mrpTotal - subtotal);
  const totalUnits = lines.reduce((sum, l) => sum + l.cartItem.quantity, 0);

  let couponDiscount = 0;
  let validCouponCode: string | undefined;
  if (cart.couponCode) {
    const matched = coupons.find(
      (c) => c.code.toUpperCase() === cart.couponCode?.toUpperCase() && c.active,
    );
    if (matched) {
      couponDiscount = computeCouponDiscount(matched, subtotal);
      if (couponDiscount > 0) {
        validCouponCode = matched.code;
      }
    }
  }

  const freeThreshold = Math.max(
    0,
    deliveryConfig?.freeDeliveryThresholdInr ?? FREE_DELIVERY_THRESHOLD_INR,
  );
  const feeAmount = Math.max(
    0,
    deliveryConfig?.deliveryFeeInr ?? STANDARD_DELIVERY_FEE_INR,
  );

  const netAfterCoupon = Math.max(0, subtotal - couponDiscount);
  const deliveryFee =
    subtotal === 0 || netAfterCoupon >= freeThreshold ? 0 : feeAmount;
  const amountToFreeDelivery = Math.max(0, freeThreshold - netAfterCoupon);

  return {
    userId: cart.userId,
    lines,
    itemCount: lines.length,
    totalUnits,
    subtotal,
    mrpTotal,
    productSavings,
    couponCode: validCouponCode,
    couponDiscount,
    deliverySlot: cart.deliverySlot ?? DEFAULT_DELIVERY_SLOT,
    deliveryFee,
    freeDeliveryThreshold: freeThreshold,
    amountToFreeDelivery,
    grandTotal: netAfterCoupon + deliveryFee,
  };
}

function loadCartDeliveryConfig(): { deliveryFeeInr?: number; freeDeliveryThresholdInr?: number } {
  return readStorageJson<{ deliveryFeeInr?: number; freeDeliveryThresholdInr?: number }>(
    'kfm_delivery_settings_v2',
    {},
  );
}

export async function getCart(userId?: string): Promise<Cart> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ cart: Cart }>('/cart', { userId });
    return res.cart;
  }
  return loadCartStore(userId);
}

export async function getCartSummary(userId?: string): Promise<CartSummary> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ summary: CartSummary }>('/cart', {
      userId,
      includeSummary: true,
    });
    return res.summary;
  }
  const cart = loadCartStore(userId);
  const catalog = loadProductsStore();
  const combos = readStorageJson<Combo[]>('kfm_combos_v2', MOCK_COMBOS);
  const coupons = readStorageJson<Coupon[]>('kfm_coupons_v2', MOCK_COUPONS);
  return computeCartSummary(cart, catalog, combos, coupons, loadCartDeliveryConfig());
}

/**
 * Returns all persisted per-user carts so Store Admin can inspect active customer baskets.
 */
export async function getAllUserCarts(): Promise<
  Array<{ userId: string; cart: Cart; summary: CartSummary }>
> {
  if (!isMockMode()) {
    const res = await apiClient.get<{
      carts: Array<{ userId: string; cart: Cart; summary: CartSummary }>;
    }>('/admin/live-carts');
    return res.carts;
  }
  const all = loadAllUserCartsMap();
  const catalog = loadProductsStore();
  const combos = readStorageJson<Combo[]>('kfm_combos_v2', MOCK_COMBOS);
  const coupons = readStorageJson<Coupon[]>('kfm_coupons_v2', MOCK_COUPONS);
  const deliveryConfig = loadCartDeliveryConfig();

  return Object.entries(all)
    .filter(([, cart]) => Array.isArray(cart.items) && cart.items.length > 0)
    .map(([userId, cart]) => ({
      userId,
      cart,
      summary: computeCartSummary({ ...cart, userId }, catalog, combos, coupons, deliveryConfig),
    }));
}

function buildProductLineId(productId: string, variantId?: string): string {
  return variantId && variantId !== 'default'
    ? `product:${productId}:${variantId}`
    : `product:${productId}`;
}

export async function addProductToCart(
  productId: string,
  quantity = 1,
  variantId?: string,
  packSize?: string,
  userId?: string,
): Promise<CartSummary> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ summary: CartSummary }>('/cart/items', {
      kind: 'product',
      productId,
      quantity,
      variantId,
      packSize,
      userId,
    });
    notifyCartsChanged();
    return res.summary;
  }
  const cart = loadCartStore(userId);
  const normalizedVariantId = variantId && variantId !== 'default' ? variantId : undefined;
  const lineId = buildProductLineId(productId, normalizedVariantId);
  const existingIdx = cart.items.findIndex((i) => i.lineId === lineId);
  const qty = Math.max(1, Math.floor(quantity));

  if (existingIdx >= 0) {
    cart.items[existingIdx] = {
      ...cart.items[existingIdx],
      quantity: cart.items[existingIdx].quantity + qty,
    };
  } else {
    cart.items.push({
      lineId,
      kind: 'product',
      productId,
      variantId: normalizedVariantId,
      packSize,
      quantity: qty,
      addedAt: new Date().toISOString(),
    });
  }

  saveCartStore(cart, userId);
  return getCartSummary(userId);
}

function serializeComboSelections(selections: Record<string, string>): string {
  return Object.entries(selections)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}

function buildComboLineId(comboId: string): string {
  return `combo:${comboId}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function addComboToCart(
  comboId: string,
  selectedBrandProductIds: Record<string, string> = {},
  quantity = 1,
): Promise<CartSummary> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ summary: CartSummary }>('/cart/items', {
      kind: 'combo',
      comboId,
      selectedBrandProductIds,
      quantity,
    });
    notifyCartsChanged();
    return res.summary;
  }
  const combos = readStorageJson<Combo[]>('kfm_combos_v2', MOCK_COMBOS);
  const combo = combos.find((c) => c.id === comboId || c.type === comboId);
  if (!combo) {
    throw new Error(`Combo "${comboId}" not found.`);
  }

  const catalog = loadProductsStore();
  const pricing = calculateComboPricing(combo, selectedBrandProductIds, catalog, MOCK_BRANDS);
  if (pricing.isUnavailable) {
    throw new Error('This combo is temporarily unavailable because an included item has no in-stock brands.');
  }
  const selectionSignature = serializeComboSelections(pricing.resolvedSelections);
  const cart = loadCartStore();
  const qty = Math.max(1, Math.floor(quantity));
  const existingIdx = cart.items.findIndex(
    (i) =>
      i.kind === 'combo' &&
      i.comboId === combo.id &&
      serializeComboSelections(i.selectedBrandProductIds ?? {}) === selectionSignature,
  );

  if (existingIdx >= 0) {
    cart.items[existingIdx] = {
      ...cart.items[existingIdx],
      quantity: cart.items[existingIdx].quantity + qty,
    };
  } else {
    const newItem: CartItem = {
      lineId: buildComboLineId(combo.id),
      kind: 'combo',
      comboId: combo.id,
      comboType: combo.type,
      selectedBrandProductIds: pricing.resolvedSelections,
      quantity: qty,
      addedAt: new Date().toISOString(),
    };
    cart.items.push(newItem);
  }

  saveCartStore(cart);
  return getCartSummary();
}

export async function updateComboBrandChoice(
  lineId: string,
  comboItemId: string,
  newProductId: string,
): Promise<CartSummary> {
  if (!isMockMode()) {
    const res = await apiClient.patch<{ summary: CartSummary }>(
      `/cart/items/${encodeURIComponent(lineId)}/brands`,
      { comboItemId, newProductId },
    );
    notifyCartsChanged();
    return res.summary;
  }
  const cart = loadCartStore();
  const idx = cart.items.findIndex((i) => i.lineId === lineId && i.kind === 'combo');
  if (idx < 0) return getCartSummary();

  const target = cart.items[idx];
  const combos = readStorageJson<Combo[]>('kfm_combos_v2', MOCK_COMBOS);
  const combo = combos.find((c) => c.id === target.comboId);
  if (!combo || combo.customerCanChangeBrand === false) return getCartSummary();

  const nextSelections = {
    ...(target.selectedBrandProductIds ?? {}),
    [comboItemId]: newProductId,
  };

  // Validate against combo rules before saving while keeping lineId stable for UI expansion state
  const catalog = loadProductsStore();
  const pricing = calculateComboPricing(combo, nextSelections, catalog, MOCK_BRANDS);

  cart.items[idx] = {
    ...target,
    selectedBrandProductIds: pricing.resolvedSelections,
  };

  saveCartStore(cart);
  return getCartSummary();
}

export async function updateCartItemQuantity(lineId: string, quantity: number): Promise<CartSummary> {
  if (!isMockMode()) {
    const qty = Math.floor(quantity);
    const res =
      qty <= 0
        ? await apiClient.delete<{ summary: CartSummary }>(
            `/cart/items/${encodeURIComponent(lineId)}`,
          )
        : await apiClient.patch<{ summary: CartSummary }>(
            `/cart/items/${encodeURIComponent(lineId)}`,
            { quantity: qty },
          );
    notifyCartsChanged();
    return res.summary;
  }
  const cart = loadCartStore();
  const qty = Math.floor(quantity);
  cart.items =
    qty <= 0
      ? cart.items.filter((i) => i.lineId !== lineId)
      : cart.items.map((i) => (i.lineId === lineId ? { ...i, quantity: qty } : i));

  saveCartStore(cart);
  return getCartSummary();
}

export async function updateProductCartQuantity(
  productId: string,
  quantity: number,
  variantId?: string,
): Promise<CartSummary> {
  return updateCartItemQuantity(buildProductLineId(productId, variantId), quantity);
}

export async function removeCartItem(lineId: string): Promise<CartSummary> {
  return updateCartItemQuantity(lineId, 0);
}

export async function setCartDeliverySlot(slot: DeliverySlotId): Promise<CartSummary> {
  if (!isMockMode()) {
    const res = await apiClient.patch<{ summary: CartSummary }>('/cart/slot', {
      deliverySlot: slot,
    });
    notifyCartsChanged();
    return res.summary;
  }
  const cart = loadCartStore();
  cart.deliverySlot = slot;
  saveCartStore(cart);
  return getCartSummary();
}

export async function applyCouponToCart(code: string): Promise<CartSummary> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ summary: CartSummary }>('/cart/coupon', {
      code: code.trim().toUpperCase(),
    });
    notifyCartsChanged();
    return res.summary;
  }
  const cart = loadCartStore();
  cart.couponCode = code.trim().toUpperCase();
  saveCartStore(cart);
  return getCartSummary();
}

export async function clearCouponFromCart(): Promise<CartSummary> {
  if (!isMockMode()) {
    const res = await apiClient.delete<{ summary: CartSummary }>('/cart/coupon');
    notifyCartsChanged();
    return res.summary;
  }
  const cart = loadCartStore();
  delete cart.couponCode;
  saveCartStore(cart);
  return getCartSummary();
}

export async function clearCart(userId?: string): Promise<CartSummary> {
  if (!isMockMode()) {
    const res = await apiClient.delete<{ summary: CartSummary }>('/cart');
    notifyCartsChanged();
    return res.summary;
  }
  const uid = getActiveUserId(userId);
  saveCartStore({ userId: uid, items: [], deliverySlot: DEFAULT_DELIVERY_SLOT, updatedAt: new Date().toISOString() }, uid);
  return getCartSummary(uid);
}
