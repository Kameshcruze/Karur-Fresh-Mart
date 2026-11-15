import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addComboToCart as serviceAddComboToCart,
  addProductToCart as serviceAddProductToCart,
  applyCouponToCart as serviceApplyCoupon,
  clearCart as serviceClearCart,
  clearCouponFromCart as serviceClearCoupon,
  getCartSummary,
  removeCartItem as serviceRemoveCartItem,
  setCartDeliverySlot as serviceSetDeliverySlot,
  updateCartItemQuantity as serviceUpdateCartItemQuantity,
  updateComboBrandChoice as serviceUpdateComboBrandChoice,
  updateProductCartQuantity as serviceUpdateProductCartQuantity,
} from '../services/cartService';
import { validateCoupon } from '../services/offerService';
import type { CartSummary, DeliverySlotId } from '../types';
import { useAuth } from './AuthContext';

interface CouponApplyResult {
  valid: boolean;
  reason?: string;
}

interface CartContextValue {
  summary: CartSummary;
  isLoading: boolean;
  addItem: (
    productId: string,
    quantity?: number,
    variantId?: string,
    packSize?: string,
  ) => Promise<void>;
  addCombo: (
    comboId: string,
    selectedBrandProductIds?: Record<string, string>,
    quantity?: number,
  ) => Promise<void>;
  updateProductQuantity: (
    productId: string,
    quantity: number,
    variantId?: string,
  ) => Promise<void>;
  updateLineQuantity: (lineId: string, quantity: number) => Promise<void>;
  updateComboBrand: (lineId: string, comboItemId: string, productId: string) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  setDeliverySlot: (slot: DeliverySlotId) => Promise<void>;
  applyCoupon: (code: string) => Promise<CouponApplyResult>;
  clearCoupon: () => Promise<void>;
  clearAll: () => Promise<void>;
  getProductQuantity: (productId: string, variantId?: string) => number;
  refresh: () => Promise<void>;
}

const EMPTY_SUMMARY: CartSummary = {
  lines: [],
  itemCount: 0,
  totalUnits: 0,
  subtotal: 0,
  mrpTotal: 0,
  productSavings: 0,
  couponDiscount: 0,
  deliverySlot: '45min',
  deliveryFee: 0,
  freeDeliveryThreshold: 499,
  amountToFreeDelivery: 499,
  grandTotal: 0,
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const activeUserId = user?.id;

  const [summary, setSummary] = useState<CartSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await getCartSummary(activeUserId);
    setSummary(next);
    setIsLoading(false);
  }, [activeUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId: string, quantity = 1, variantId?: string, packSize?: string) => {
      const next = await serviceAddProductToCart(productId, quantity, variantId, packSize);
      setSummary(next);
    },
    [],
  );

  const addCombo = useCallback(
    async (
      comboId: string,
      selectedBrandProductIds: Record<string, string> = {},
      quantity = 1,
    ) => {
      const next = await serviceAddComboToCart(comboId, selectedBrandProductIds, quantity);
      setSummary(next);
    },
    [],
  );

  const updateProductQuantity = useCallback(
    async (productId: string, quantity: number, variantId?: string) => {
      const next = await serviceUpdateProductCartQuantity(productId, quantity, variantId);
      setSummary(next);
    },
    [],
  );

  const updateLineQuantity = useCallback(async (lineId: string, quantity: number) => {
    const next = await serviceUpdateCartItemQuantity(lineId, quantity);
    setSummary(next);
  }, []);

  const updateComboBrand = useCallback(
    async (lineId: string, comboItemId: string, productId: string) => {
      const next = await serviceUpdateComboBrandChoice(lineId, comboItemId, productId);
      setSummary(next);
    },
    [],
  );

  const removeLine = useCallback(async (lineId: string) => {
    const next = await serviceRemoveCartItem(lineId);
    setSummary(next);
  }, []);

  const setDeliverySlot = useCallback(async (slot: DeliverySlotId) => {
    const next = await serviceSetDeliverySlot(slot);
    setSummary(next);
  }, []);

  const applyCoupon = useCallback(
    async (code: string): Promise<CouponApplyResult> => {
      const check = await validateCoupon(code, summary.subtotal);
      if (!check.valid) {
        return { valid: false, reason: check.reason };
      }
      const next = await serviceApplyCoupon(code);
      setSummary(next);
      return { valid: true };
    },
    [summary.subtotal],
  );

  const clearCoupon = useCallback(async () => {
    const next = await serviceClearCoupon();
    setSummary(next);
  }, []);

  const clearAll = useCallback(async () => {
    const next = await serviceClearCart(activeUserId);
    setSummary(next);
  }, [activeUserId]);

  const getProductQuantity = useCallback(
    (productId: string, variantId?: string) => {
      const normalized = variantId && variantId !== 'default' ? variantId : undefined;
      const found = summary.lines.find(
        (line) =>
          line.cartItem.kind === 'product' &&
          line.cartItem.productId === productId &&
          (line.cartItem.variantId ?? undefined) === normalized,
      );
      return found ? found.cartItem.quantity : 0;
    },
    [summary.lines],
  );

  const value = useMemo(
    () => ({
      summary,
      isLoading,
      addItem,
      addCombo,
      updateProductQuantity,
      updateLineQuantity,
      updateComboBrand,
      removeLine,
      setDeliverySlot,
      applyCoupon,
      clearCoupon,
      clearAll,
      getProductQuantity,
      refresh,
    }),
    [
      summary,
      isLoading,
      addItem,
      addCombo,
      updateProductQuantity,
      updateLineQuantity,
      updateComboBrand,
      removeLine,
      setDeliverySlot,
      applyCoupon,
      clearCoupon,
      clearAll,
      getProductQuantity,
      refresh,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
