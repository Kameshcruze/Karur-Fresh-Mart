import { MOCK_DELIVERY_PARTNER_PROFILES, type DeliveryPartnerProfile } from '../mock/users';
import type { Order } from '../types';
import { apiClient, isMockMode } from './api';
import {
  isValidIndianMobile,
  normalizeIndianMobile,
  registerOrUpdateUser,
} from './authService';
import { loadOrdersStore, notifyOrdersChanged, saveOrdersStore } from './orderService';
import { readStorageJson, writeStorageJson } from './storage';

const PARTNERS_STORAGE_KEY = 'kfm_delivery_partners_v2';

function loadPartnersStore(): DeliveryPartnerProfile[] {
  const stored = readStorageJson<DeliveryPartnerProfile[] | null>(PARTNERS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(PARTNERS_STORAGE_KEY, MOCK_DELIVERY_PARTNER_PROFILES);
  return MOCK_DELIVERY_PARTNER_PROFILES;
}

export async function getDeliveryPartners(): Promise<DeliveryPartnerProfile[]> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ partners: DeliveryPartnerProfile[] }>(
      '/delivery/partners',
    );
    return res.partners;
  }
  return loadPartnersStore();
}

export async function addDeliveryPartner(input: {
  name: string;
  mobile: string;
  vehicleNumber: string;
  zone?: string;
}): Promise<DeliveryPartnerProfile> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ partner: DeliveryPartnerProfile }>(
      '/admin/delivery/partners',
      input,
    );
    notifyDeliveryPartnersChanged();
    return res.partner;
  }
  const name = input.name.trim();
  const normalizedMobile = normalizeIndianMobile(input.mobile);
  const vehicleNumber = input.vehicleNumber.trim().toUpperCase();
  const zone = input.zone?.trim() || 'Karur Central Zone';

  if (!name) {
    throw new Error('Delivery partner name is required.');
  }
  if (!isValidIndianMobile(normalizedMobile)) {
    throw new Error('Enter a valid 10-digit Indian mobile number.');
  }
  if (!vehicleNumber) {
    throw new Error('Vehicle registration number is required.');
  }

  const existing = loadPartnersStore();
  if (existing.some((p) => p.mobile === normalizedMobile)) {
    throw new Error(`A delivery partner with mobile +91 ${normalizedMobile} already exists.`);
  }

  const userId = `user-deliv-${normalizedMobile}`;
  const newPartner: DeliveryPartnerProfile = {
    id: `dp-${Date.now().toString(36)}`,
    userId,
    name,
    mobile: normalizedMobile,
    vehicleNumber,
    zone,
    isAvailable: true,
  };

  writeStorageJson(PARTNERS_STORAGE_KEY, [...existing, newPartner]);
  await registerOrUpdateUser({
    id: userId,
    name,
    mobile: normalizedMobile,
    role: 'delivery',
    preferredLanguage: 'en',
  });

  return newPartner;
}

export interface DeliveryPartnerStats {
  activeDrops: number;
  deliveredCount: number;
  totalDeliveredAmount: number;
  codCollectedAmount: number;
}

export function computeDeliveryPartnerStats(
  partnerId: string,
  orders: Order[],
): DeliveryPartnerStats {
  const assigned = orders.filter(
    (o) =>
      o.status !== 'cancelled' &&
      o.deliveryAssignment?.deliveryPartnerId === partnerId,
  );
  const activeDrops = assigned.filter((o) => o.status !== 'delivered').length;
  const delivered = assigned.filter((o) => o.status === 'delivered');
  const totalDeliveredAmount = delivered.reduce((sum, o) => sum + o.total, 0);
  const codCollectedAmount = delivered
    .filter((o) => o.payment.method === 'cod' && o.payment.status === 'paid')
    .reduce((sum, o) => sum + o.total, 0);

  return {
    activeDrops,
    deliveredCount: delivered.length,
    totalDeliveredAmount,
    codCollectedAmount,
  };
}

export async function togglePartnerAvailability(
  partnerId: string,
  isAvailable: boolean,
): Promise<DeliveryPartnerProfile[]> {
  if (!isMockMode()) {
    const res = await apiClient.patch<{ partners: DeliveryPartnerProfile[] }>(
      `/delivery/partners/${encodeURIComponent(partnerId)}/availability`,
      { isAvailable },
    );
    notifyDeliveryPartnersChanged();
    return res.partners;
  }
  const next = loadPartnersStore().map((p) =>
    p.id === partnerId ? { ...p, isAvailable } : p,
  );
  writeStorageJson(PARTNERS_STORAGE_KEY, next);
  return next;
}

export async function getAssignedDeliveries(partnerId?: string): Promise<Order[]> {
  if (!isMockMode()) {
    const res = await apiClient.get<{ orders: Order[] }>('/delivery/assignments', {
      partnerId,
    });
    return res.orders;
  }
  const orders = loadOrdersStore();
  return orders.filter((o) => {
    if (o.status === 'cancelled') return false;
    if (!partnerId) return Boolean(o.deliveryAssignment?.deliveryPartnerId);
    return o.deliveryAssignment?.deliveryPartnerId === partnerId;
  });
}

export async function assignDeliveryPartner(
  orderId: string,
  partnerId: string,
): Promise<Order | undefined> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ order?: Order }>(
      `/admin/orders/${encodeURIComponent(orderId)}/assign-delivery`,
      { partnerId },
    );
    notifyOrdersChanged();
    return res.order;
  }
  const partner = loadPartnersStore().find((p) => p.id === partnerId);
  if (!partner) {
    throw new Error(`Delivery partner "${partnerId}" not found.`);
  }

  const orders = loadOrdersStore();
  const now = new Date().toISOString();
  let updated: Order | undefined;

  const next = orders.map((order) => {
    if (order.id !== orderId) return order;
    const existingOtp =
      order.deliveryAssignment?.deliveryOtp ||
      String(Math.floor(1000 + Math.random() * 9000));

    updated = {
      ...order,
      deliveryAssignment: {
        id: order.deliveryAssignment?.id ?? `da-${order.id}`,
        orderId: order.id,
        deliveryPartnerId: partner.id,
        partnerName: partner.name,
        partnerMobile: partner.mobile,
        vehicleNumber: partner.vehicleNumber,
        assignedAt: now,
        pickedUpAt: order.deliveryAssignment?.pickedUpAt,
        deliveredAt: order.deliveryAssignment?.deliveredAt,
        deliveryOtp: existingOtp,
        otpVerified: order.deliveryAssignment?.otpVerified ?? false,
      },
      updatedAt: now,
    };
    return updated;
  });

  saveOrdersStore(next);
  return updated;
}

export async function markOrderPickedUp(orderId: string): Promise<Order | undefined> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ order?: Order }>(
      `/delivery/orders/${encodeURIComponent(orderId)}/picked-up`,
    );
    notifyOrdersChanged();
    return res.order;
  }
  const orders = loadOrdersStore();
  const now = new Date().toISOString();
  let updated: Order | undefined;

  const next = orders.map((order) => {
    if (order.id !== orderId) return order;
    updated = {
      ...order,
      status: 'picked_up',
      statusTimestamps: {
        placed: order.createdAt,
        ...(order.statusTimestamps ?? {}),
        picked_up: now,
      },
      deliveryAssignment: order.deliveryAssignment
        ? { ...order.deliveryAssignment, pickedUpAt: now }
        : undefined,
      updatedAt: now,
    };
    return updated;
  });

  saveOrdersStore(next);
  return updated;
}

export async function markOrderOutForDelivery(orderId: string): Promise<Order | undefined> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ order?: Order }>(
      `/delivery/orders/${encodeURIComponent(orderId)}/out-for-delivery`,
    );
    notifyOrdersChanged();
    return res.order;
  }
  const orders = loadOrdersStore();
  const now = new Date().toISOString();
  let updated: Order | undefined;

  const next = orders.map((order) => {
    if (order.id !== orderId) return order;
    updated = {
      ...order,
      status: 'out_for_delivery',
      statusTimestamps: {
        placed: order.createdAt,
        ...(order.statusTimestamps ?? {}),
        out_for_delivery: now,
      },
      updatedAt: now,
    };
    return updated;
  });

  saveOrdersStore(next);
  return updated;
}

export async function verifyDeliveryOtpAndComplete(
  orderId: string,
  enteredOtp: string,
): Promise<{ success: boolean; order?: Order; error?: string }> {
  if (!isMockMode()) {
    const res = await apiClient.post<{ success: boolean; order?: Order; error?: string }>(
      `/delivery/orders/${encodeURIComponent(orderId)}/complete`,
      { otp: enteredOtp.trim() },
    );
    if (res.success) notifyOrdersChanged();
    return res;
  }
  const orders = loadOrdersStore();
  const target = orders.find((o) => o.id === orderId);
  if (!target || !target.deliveryAssignment) {
    return { success: false, error: 'Delivery assignment not found.' };
  }

  if (enteredOtp.trim() !== target.deliveryAssignment.deliveryOtp) {
    return { success: false, error: 'Invalid delivery OTP. Please ask the customer for the 4-digit code.' };
  }

  const now = new Date().toISOString();
  let updated: Order | undefined;

  const next = orders.map((order) => {
    if (order.id !== orderId) return order;
    updated = {
      ...order,
      status: 'delivered',
      statusTimestamps: {
        placed: order.createdAt,
        ...(order.statusTimestamps ?? {}),
        delivered: now,
      },
      payment:
        order.payment.method === 'cod'
          ? { ...order.payment, status: 'paid', paidAt: now }
          : order.payment,
      deliveryAssignment: order.deliveryAssignment
        ? { ...order.deliveryAssignment, deliveredAt: now, otpVerified: true }
        : undefined,
      updatedAt: now,
    };
    return updated;
  });

  saveOrdersStore(next);
  return { success: true, order: updated };
}

const DELIVERY_CHECKLIST_STORAGE_KEY = 'kfm_delivery_checklist_v1';
const DELIVERY_PARTNERS_CHANGED_EVENT = 'kfm:delivery-partners-changed';
const partnerListeners = new Set<() => void>();

function notifyDeliveryPartnersChanged(): void {
  partnerListeners.forEach((fn) => fn());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DELIVERY_PARTNERS_CHANGED_EVENT));
  }
}

export function subscribeToDeliveryPartnerUpdates(listener: () => void): () => void {
  partnerListeners.add(listener);
  if (typeof window === 'undefined') {
    return () => {
      partnerListeners.delete(listener);
    };
  }
  const onEvent = () => listener();
  const onStorage = (e: StorageEvent) => {
    if (e.key === PARTNERS_STORAGE_KEY) listener();
  };
  window.addEventListener(DELIVERY_PARTNERS_CHANGED_EVENT, onEvent);
  window.addEventListener('storage', onStorage);
  return () => {
    partnerListeners.delete(listener);
    window.removeEventListener(DELIVERY_PARTNERS_CHANGED_EVENT, onEvent);
    window.removeEventListener('storage', onStorage);
  };
}

export async function togglePartnerDutyStatus(
  partnerId: string,
  isAvailable: boolean,
): Promise<DeliveryPartnerProfile[]> {
  if (!isMockMode()) {
    return togglePartnerAvailability(partnerId, isAvailable);
  }
  const next = loadPartnersStore().map((p) =>
    p.id === partnerId ? { ...p, isAvailable } : p,
  );
  writeStorageJson(PARTNERS_STORAGE_KEY, next);
  notifyDeliveryPartnersChanged();
  return next;
}

export function resolvePartnerForUser(
  userId?: string,
  mobile?: string,
  partners: DeliveryPartnerProfile[] = loadPartnersStore(),
): DeliveryPartnerProfile | undefined {
  if (userId) {
    const byUid = partners.find((p) => p.userId === userId);
    if (byUid) return byUid;
  }
  if (mobile) {
    const norm = normalizeIndianMobile(mobile);
    const byMobile = partners.find((p) => normalizeIndianMobile(p.mobile) === norm);
    if (byMobile) return byMobile;
  }
  return partners[0];
}

export function computeOrderPayoutInr(order: Order): number {
  const baseFee = 45;
  const weightBonus = order.total >= 1500 ? 20 : 10;
  return baseFee + weightBonus;
}

export interface DeliveryDashboardSummary {
  todayTotalCount: number;
  todayCompletedCount: number;
  pendingCount: number;
  readyToPickUpCount: number;
  pickedUpCount: number;
  outForDeliveryCount: number;
  completedCount: number;
  totalEarningsInr: number;
  todayEarningsInr: number;
  codCollectedToSettleInr: number;
}

export function computeDeliveryDashboardSummary(
  partnerId: string,
  orders: Order[],
  now: Date = new Date(),
): DeliveryDashboardSummary {
  const todayStr = now.toISOString().slice(0, 10);
  const partnerOrders = orders.filter(
    (o) =>
      o.status !== 'cancelled' &&
      o.deliveryAssignment?.deliveryPartnerId === partnerId,
  );

  const pendingOrders = partnerOrders.filter((o) => o.status !== 'delivered');
  const completedOrders = partnerOrders.filter((o) => o.status === 'delivered');

  const isSameDay = (iso?: string) => Boolean(iso && iso.slice(0, 10) === todayStr);
  const todayDelivered = completedOrders.filter((o) =>
    isSameDay(o.deliveryAssignment?.deliveredAt ?? o.updatedAt),
  );
  const todayAssignedOrActive = partnerOrders.filter(
    (o) =>
      o.status !== 'delivered' ||
      isSameDay(o.deliveryAssignment?.deliveredAt ?? o.createdAt),
  );

  const totalEarningsInr = completedOrders.reduce(
    (sum, o) => sum + computeOrderPayoutInr(o),
    0,
  );
  const todayEarningsInr = todayDelivered.reduce(
    (sum, o) => sum + computeOrderPayoutInr(o),
    0,
  );
  const codCollectedToSettleInr = completedOrders
    .filter((o) => o.payment.method === 'cod' && o.payment.status === 'paid')
    .reduce((sum, o) => sum + o.total, 0);

  return {
    todayTotalCount: todayAssignedOrActive.length,
    todayCompletedCount: todayDelivered.length,
    pendingCount: pendingOrders.length,
    readyToPickUpCount: pendingOrders.filter(
      (o) => o.status === 'placed' || o.status === 'packed',
    ).length,
    pickedUpCount: pendingOrders.filter((o) => o.status === 'picked_up').length,
    outForDeliveryCount: pendingOrders.filter((o) => o.status === 'out_for_delivery').length,
    completedCount: completedOrders.length,
    totalEarningsInr,
    todayEarningsInr,
    codCollectedToSettleInr,
  };
}

export function getDeliveryOrderChecklist(orderId: string): string[] {
  const all = readStorageJson<Record<string, string[]>>(DELIVERY_CHECKLIST_STORAGE_KEY, {});
  return Array.isArray(all[orderId]) ? all[orderId] : [];
}

export function toggleDeliveryChecklistItem(
  orderId: string,
  itemId: string,
): string[] {
  const all = readStorageJson<Record<string, string[]>>(DELIVERY_CHECKLIST_STORAGE_KEY, {});
  const current = new Set<string>(Array.isArray(all[orderId]) ? all[orderId] : []);
  if (current.has(itemId)) {
    current.delete(itemId);
  } else {
    current.add(itemId);
  }
  const nextList = Array.from(current);
  writeStorageJson(DELIVERY_CHECKLIST_STORAGE_KEY, {
    ...all,
    [orderId]: nextList,
  });
  return nextList;
}

