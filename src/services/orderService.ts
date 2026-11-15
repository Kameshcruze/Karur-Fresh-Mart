import { MOCK_ORDERS } from '../mock/orders';
import { MOCK_DELIVERY_PARTNER_PROFILES } from '../mock/users';
import type {
  Address,
  BilingualText,
  CartSummary,
  DeliverySlotId,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductTint,
} from '../types';
import { addComboToCart, addProductToCart, clearCart, getCartSummary } from './cartService';
import {
  deductStockForOrder,
  getProductById,
  getTotalAvailableQty,
  loadProductsStore,
  restoreStockForOrder,
} from './productService';
import { appendStockHistoryEntry } from './stockService';
import { readStorageJson, writeStorageJson } from './storage';

const ORDERS_STORAGE_KEY = 'kfm_orders_v2';
export const ORDERS_UPDATED_EVENT = 'kfm:orders-updated';

type OrderUpdateListener = () => void;
const inMemoryListeners = new Set<OrderUpdateListener>();

export function notifyOrdersChanged(): void {
  for (const listener of inMemoryListeners) {
    try {
      listener();
    } catch {
      // Ignore individual subscriber errors
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
  }
}

/**
 * Subscribe to live order status or assignment updates (works in-app, across tabs, and in tests).
 */
export function subscribeToOrderUpdates(listener: OrderUpdateListener): () => void {
  inMemoryListeners.add(listener);

  if (typeof window === 'undefined') {
    return () => {
      inMemoryListeners.delete(listener);
    };
  }

  const handleCustom = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === ORDERS_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(ORDERS_UPDATED_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);

  return () => {
    inMemoryListeners.delete(listener);
    window.removeEventListener(ORDERS_UPDATED_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}

export function loadOrdersStore(): Order[] {
  const stored = readStorageJson<Order[] | null>(ORDERS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(ORDERS_STORAGE_KEY, MOCK_ORDERS);
  return MOCK_ORDERS;
}

export function saveOrdersStore(orders: Order[]): void {
  writeStorageJson(ORDERS_STORAGE_KEY, orders);
  notifyOrdersChanged();
}

export async function getOrders(): Promise<Order[]> {
  return loadOrdersStore();
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  return loadOrdersStore().filter((o) => o.userId === userId);
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  return loadOrdersStore().find((o) => o.id === id);
}

export async function placeOrder(input: {
  userId: string;
  customerName: string;
  customerMobile: string;
  address: Address;
  paymentMethod: PaymentMethod;
  deliverySlot?: DeliverySlotId;
  transactionRef?: string;
  assignDefaultPartner?: boolean;
}): Promise<Order> {
  const summary = await getCartSummary(input.userId);
  if (summary.lines.length === 0) {
    throw new Error('Cannot place an order with an empty cart.');
  }

  const orderItems: OrderItem[] = [];
  const allStockDeductions: Array<{ productId: string; quantity: number }> = [];

  for (let idx = 0; idx < summary.lines.length; idx++) {
    const line = summary.lines[idx];
    const qty = line.cartItem.quantity;

    if (line.cartItem.kind === 'product' && line.cartItem.productId) {
      const deduction = { productId: line.cartItem.productId, quantity: qty };
      allStockDeductions.push(deduction);

      orderItems.push({
        id: `oi-${Date.now()}-${idx}`,
        kind: 'product',
        productId: line.cartItem.productId,
        name: line.title,
        packOrSummary: line.subtitle,
        unitPrice: line.unitPrice,
        unitMrp: line.unitMrp,
        quantity: qty,
        lineTotal: line.lineTotal,
        imageTint: line.imageTint,
        image: line.image,
        stockDeductions: [deduction],
      });
    } else if (line.cartItem.kind === 'combo' && line.comboBrandBreakdown) {
      const itemDeductions = line.comboBrandBreakdown.map((b) => ({
        productId: b.product.id,
        quantity: b.quantity * qty,
      }));
      allStockDeductions.push(...itemDeductions);

      orderItems.push({
        id: `oi-${Date.now()}-${idx}`,
        kind: 'combo',
        comboId: line.cartItem.comboId,
        name: line.title,
        packOrSummary: line.subtitle,
        unitPrice: line.unitPrice,
        unitMrp: line.unitMrp,
        quantity: qty,
        lineTotal: line.lineTotal,
        imageTint: line.imageTint,
        image: line.image,
        stockDeductions: itemDeductions,
        comboSelections: line.comboBrandBreakdown.map((b) => ({
          comboItemId: b.comboItemId,
          groupName: b.groupName,
          productId: b.product.id,
          productName: b.product.name,
          brandName: b.brandName,
          quantity: b.quantity,
          unit: b.unit,
        })),
      });
    }
  }

  // Deduct stock (reservedQty first, then stockQty)
  const beforeProducts = loadProductsStore();
  await deductStockForOrder(allStockDeductions);
  const afterProducts = loadProductsStore();

  const existingOrders = loadOrdersStore();
  const orderId = `KFM-${1043 + existingOrders.length}`;
  const now = new Date().toISOString();

  // Record stock audit history for every deducted SKU
  const deductedIds = new Set(allStockDeductions.map((d) => d.productId));
  for (const pid of deductedIds) {
    const prevProd = beforeProducts.find((p) => p.id === pid);
    const nextProd = afterProducts.find((p) => p.id === pid);
    if (prevProd && nextProd) {
      const oldTotal = prevProd.stockQty + prevProd.reservedQty;
      const newTotal = nextProd.stockQty + nextProd.reservedQty;
      if (oldTotal !== newTotal) {
        appendStockHistoryEntry({
          productId: pid,
          productName: prevProd.name.en,
          sku: prevProd.sku,
          who: input.customerName,
          when: now,
          oldValue: oldTotal,
          newValue: newTotal,
          field: 'stock',
          reason: 'order placed',
          note: `Order ${orderId}`,
        });
      }
    }
  }
  const otp = String(Math.floor(1000 + Math.random() * 9000));
  const partner = MOCK_DELIVERY_PARTNER_PROFILES[0];

  const resolvedSlot = input.deliverySlot ?? summary.deliverySlot;
  const estimatedMinutes =
    resolvedSlot === '45min' ? 35 : resolvedSlot === 'today_evening' ? 240 : 720;

  const newOrder: Order = {
    id: orderId,
    userId: input.userId,
    customerName: input.customerName,
    customerMobile: input.customerMobile,
    address: input.address,
    items: orderItems,
    subtotal: summary.subtotal,
    couponCode: summary.couponCode,
    couponDiscount: summary.couponDiscount,
    deliverySlot: resolvedSlot,
    deliveryFee: summary.deliveryFee,
    savings: summary.productSavings + summary.couponDiscount,
    total: summary.grandTotal,
    status: 'placed',
    statusTimestamps: {
      placed: now,
    },
    payment: {
      id: `pay-${orderId}`,
      orderId,
      method: input.paymentMethod,
      status: input.paymentMethod === 'cod' ? 'pending' : 'paid',
      amount: summary.grandTotal,
      transactionRef:
        input.paymentMethod === 'cod'
          ? undefined
          : input.transactionRef ?? `TXN-${Date.now().toString().slice(-6)}`,
      paidAt: input.paymentMethod === 'cod' ? undefined : now,
    },
    deliveryAssignment: input.assignDefaultPartner
      ? {
          id: `da-${orderId}`,
          orderId,
          deliveryPartnerId: partner.id,
          partnerName: partner.name,
          partnerMobile: partner.mobile,
          vehicleNumber: partner.vehicleNumber,
          assignedAt: now,
          deliveryOtp: otp,
          otpVerified: false,
        }
      : {
          id: `da-${orderId}`,
          orderId,
          deliveryPartnerId: '',
          partnerName: '',
          partnerMobile: '',
          vehicleNumber: '',
          assignedAt: now,
          deliveryOtp: otp,
          otpVerified: false,
        },
    createdAt: now,
    updatedAt: now,
    estimatedMinutes,
  };

  saveOrdersStore([newOrder, ...existingOrders]);
  await clearCart(input.userId);
  return newOrder;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Order | undefined> {
  const orders = loadOrdersStore();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return undefined;

  // Restore inventory if transitioning to cancelled from a non-cancelled status
  if (status === 'cancelled' && target.status !== 'cancelled') {
    const deductions = target.items.flatMap((i) => i.stockDeductions);
    const beforeRestore = loadProductsStore();
    await restoreStockForOrder(deductions);
    const afterRestore = loadProductsStore();
    const cancelNow = new Date().toISOString();
    for (const pid of new Set(deductions.map((d) => d.productId))) {
      const prevProd = beforeRestore.find((p) => p.id === pid);
      const nextProd = afterRestore.find((p) => p.id === pid);
      if (prevProd && nextProd && prevProd.stockQty !== nextProd.stockQty) {
        appendStockHistoryEntry({
          productId: pid,
          productName: prevProd.name.en,
          sku: prevProd.sku,
          who: 'Store Admin / System',
          when: cancelNow,
          oldValue: prevProd.stockQty,
          newValue: nextProd.stockQty,
          field: 'stock',
          reason: 'correction',
          note: `Order ${orderId} cancelled — stock restored`,
        });
      }
    }
  }

  const now = new Date().toISOString();
  let updated: Order | undefined;
  const next = orders.map((order) => {
    if (order.id !== orderId) return order;
    updated = {
      ...order,
      status,
      statusTimestamps: {
        placed: order.createdAt,
        ...(order.statusTimestamps ?? {}),
        [status]: now,
      },
      updatedAt: now,
    };
    return updated;
  });

  saveOrdersStore(next);
  return updated;
}

export async function cancelOrder(orderId: string): Promise<Order | undefined> {
  return updateOrderStatus(orderId, 'cancelled');
}

/**
 * Cancels an order, restores stock once, and marks any paid transaction as refunded.
 */
export async function cancelAndRefundOrder(
  orderId: string,
  shouldRefund = true,
): Promise<Order | undefined> {
  const orders = loadOrdersStore();
  const target = orders.find((o) => o.id === orderId);
  if (!target) return undefined;

  if (target.status !== 'cancelled') {
    const deductions = target.items.flatMap((i) => i.stockDeductions);
    const beforeRestore = loadProductsStore();
    await restoreStockForOrder(deductions);
    const afterRestore = loadProductsStore();
    const restoreNow = new Date().toISOString();
    for (const pid of new Set(deductions.map((d) => d.productId))) {
      const prevProd = beforeRestore.find((p) => p.id === pid);
      const nextProd = afterRestore.find((p) => p.id === pid);
      if (prevProd && nextProd && prevProd.stockQty !== nextProd.stockQty) {
        appendStockHistoryEntry({
          productId: pid,
          productName: prevProd.name.en,
          sku: prevProd.sku,
          who: 'Store Admin',
          when: restoreNow,
          oldValue: prevProd.stockQty,
          newValue: nextProd.stockQty,
          field: 'stock',
          reason: 'correction',
          note: `Order ${orderId} cancelled & refunded — stock restored`,
        });
      }
    }
  }

  const now = new Date().toISOString();
  let updated: Order | undefined;
  const next = orders.map((order) => {
    if (order.id !== orderId) return order;
    const nextPaymentStatus =
      shouldRefund && order.payment.status === 'paid' ? 'refunded' : order.payment.status;
    updated = {
      ...order,
      status: 'cancelled',
      statusTimestamps: {
        placed: order.createdAt,
        ...(order.statusTimestamps ?? {}),
        cancelled: order.statusTimestamps?.cancelled ?? now,
      },
      payment: {
        ...order.payment,
        status: nextPaymentStatus,
      },
      updatedAt: now,
    };
    return updated;
  });

  saveOrdersStore(next);
  return updated;
}

/**
 * Marks a paid order's payment transaction as refunded (preserving order status history).
 */
export async function refundOrderPayment(orderId: string): Promise<Order | undefined> {
  const orders = loadOrdersStore();
  const target = orders.find((o) => o.id === orderId);
  if (!target || target.payment.status !== 'paid') return target;

  const now = new Date().toISOString();
  let updated: Order | undefined;
  const next = orders.map((order) => {
    if (order.id !== orderId) return order;
    updated = {
      ...order,
      payment: {
        ...order.payment,
        status: 'refunded',
      },
      updatedAt: now,
    };
    return updated;
  });

  saveOrdersStore(next);
  return updated;
}

/**
 * Adds all available products and customized monthly combos from a past order back into the cart.
 */
export async function reorderOrder(
  orderId: string,
): Promise<{ addedLines: number; skippedLines: number }> {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new Error(`Order "${orderId}" not found.`);
  }

  let addedLines = 0;
  let skippedLines = 0;

  for (const item of order.items) {
    if (item.kind === 'combo' && item.comboId) {
      const brandMap: Record<string, string> = {};
      for (const sel of item.comboSelections ?? []) {
        brandMap[sel.comboItemId] = sel.productId;
      }
      await addComboToCart(item.comboId, brandMap, item.quantity);
      addedLines += 1;
    } else if (item.kind === 'product' && item.productId) {
      const prod = await getProductById(item.productId);
      if (!prod || getTotalAvailableQty(prod) <= 0) {
        skippedLines += 1;
        continue;
      }
      await addProductToCart(item.productId, item.quantity);
      addedLines += 1;
    }
  }

  return { addedLines, skippedLines };
}

export interface AdminDashboardStats {
  todaysOrders: number;
  todaysRevenue: number;
  totalRevenue: number;
  pendingDeliveries: number;
  activeCartsCount: number;
  activeCartsValue: number;
}

export interface WeeklyOrdersPoint {
  dateKey: string;
  dayLabel: string;
  ordersCount: number;
  revenue: number;
  isToday: boolean;
}

export interface TopProductMetric {
  productId: string;
  name: BilingualText;
  unitsSold: number;
  revenue: number;
  imageTint: ProductTint;
}

function toUtcDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Pure aggregation for the Admin Dashboard KPI cards.
 */
export function computeAdminDashboardStats(
  orders: Order[],
  userCarts: Array<{ summary: CartSummary }>,
  referenceDate: Date = new Date(),
): AdminDashboardStats {
  const todayKey = toUtcDateKey(referenceDate);
  const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
  const todaysList = nonCancelled.filter((o) => toUtcDateKey(o.createdAt) === todayKey);

  const todaysRevenue = todaysList.reduce((sum, o) => sum + o.total, 0);
  const totalRevenue = nonCancelled.reduce((sum, o) => sum + o.total, 0);
  const pendingDeliveries = nonCancelled.filter((o) => o.status !== 'delivered').length;
  const activeCartsCount = userCarts.length;
  const activeCartsValue = userCarts.reduce((sum, c) => sum + c.summary.grandTotal, 0);

  return {
    todaysOrders: todaysList.length,
    todaysRevenue,
    totalRevenue,
    pendingDeliveries,
    activeCartsCount,
    activeCartsValue,
  };
}

const BASELINE_KARUR_WEEKLY_ORDERS = [14, 18, 16, 22, 25, 29, 0];
const BASELINE_KARUR_WEEKLY_REVENUE = [6840, 9120, 7950, 11400, 13250, 15890, 0];
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Builds a 7-day trailing order bar series blending live order store entries with Karur store baseline history for earlier days.
 */
export function computeWeeklyOrdersSeries(
  orders: Order[],
  referenceDate: Date = new Date(),
): WeeklyOrdersPoint[] {
  const todayUtc = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );
  const todayKey = todayUtc.toISOString().slice(0, 10);
  const nonCancelled = orders.filter((o) => o.status !== 'cancelled');

  const points: WeeklyOrdersPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date(todayUtc.getTime() - i * 86_400_000);
    const key = dayDate.toISOString().slice(0, 10);
    const matching = nonCancelled.filter((o) => toUtcDateKey(o.createdAt) === key);
    const idx = 6 - i;
    const baseOrders = BASELINE_KARUR_WEEKLY_ORDERS[idx] ?? 0;
    const baseRevenue = BASELINE_KARUR_WEEKLY_REVENUE[idx] ?? 0;

    const liveCount = matching.length;
    const liveRevenue = matching.reduce((sum, o) => sum + o.total, 0);

    points.push({
      dateKey: key,
      dayLabel: SHORT_WEEKDAYS[dayDate.getUTCDay()],
      ordersCount: liveCount > 0 && i === 0 ? liveCount : baseOrders + liveCount,
      revenue: liveCount > 0 && i === 0 ? liveRevenue : baseRevenue + liveRevenue,
      isToday: key === todayKey,
    });
  }

  return points;
}

export function computeLowStockProducts(
  products: Product[],
  threshold = 5,
): Product[] {
  return products
    .filter((p) => getTotalAvailableQty(p) <= threshold)
    .sort((a, b) => getTotalAvailableQty(a) - getTotalAvailableQty(b));
}

export function computeTopProducts(
  orders: Order[],
  products: Product[],
  limit = 5,
): TopProductMetric[] {
  const agg = new Map<string, TopProductMetric>();

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    for (const item of order.items) {
      const id = item.productId ?? item.comboId ?? item.id;
      const existing = agg.get(id);
      const matchedProduct = products.find((p) => p.id === id);
      const tint = matchedProduct?.imageTint ?? item.imageTint;
      if (existing) {
        existing.unitsSold += item.quantity;
        existing.revenue += item.lineTotal;
      } else {
        agg.set(id, {
          productId: id,
          name: item.name,
          unitsSold: item.quantity,
          revenue: item.lineTotal,
          imageTint: tint,
        });
      }
    }
  }

  return Array.from(agg.values())
    .sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold)
    .slice(0, limit);
}

