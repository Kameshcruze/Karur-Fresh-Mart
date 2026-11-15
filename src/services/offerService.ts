import { MOCK_BANNERS, MOCK_COUPONS, MOCK_OFFERS } from '../mock/offers';
import type { Banner, Coupon, Offer } from '../types';
import { notifyCatalogChanged } from './productService';
import { readStorageJson, writeStorageJson } from './storage';

const OFFERS_STORAGE_KEY = 'kfm_offers_v2';
const COUPONS_STORAGE_KEY = 'kfm_coupons_v2';
const BANNERS_STORAGE_KEY = 'kfm_banners_v2';

function loadOffersStore(): Offer[] {
  const stored = readStorageJson<Offer[] | null>(OFFERS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(OFFERS_STORAGE_KEY, MOCK_OFFERS);
  return MOCK_OFFERS;
}

function loadCouponsStore(): Coupon[] {
  const stored = readStorageJson<Coupon[] | null>(COUPONS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(COUPONS_STORAGE_KEY, MOCK_COUPONS);
  return MOCK_COUPONS;
}

function loadBannersStore(): Banner[] {
  const stored = readStorageJson<Banner[] | null>(BANNERS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(BANNERS_STORAGE_KEY, MOCK_BANNERS);
  return MOCK_BANNERS;
}

export function isWithinOfferWindow(
  startDate?: string,
  endDate?: string,
  referenceDate: Date = new Date(),
): boolean {
  const todayKey = referenceDate.toISOString().slice(0, 10);
  if (startDate && startDate.trim().length >= 10 && todayKey < startDate.slice(0, 10)) {
    return false;
  }
  if (endDate && endDate.trim().length >= 10 && todayKey > endDate.slice(0, 10)) {
    return false;
  }
  return true;
}

export function computeCouponDiscount(coupon: Coupon, subtotal: number): number {
  if (!coupon.active || subtotal < coupon.minOrderAmount) {
    return 0;
  }
  if (coupon.discountType === 'flat') {
    return Math.min(subtotal, coupon.discountValue);
  }
  const rawPercent = Math.round((subtotal * coupon.discountValue) / 100);
  const capped = coupon.maxDiscount ? Math.min(rawPercent, coupon.maxDiscount) : rawPercent;
  return Math.min(subtotal, capped);
}

export async function getOffers(onlyActive = true): Promise<Offer[]> {
  const list = loadOffersStore();
  return onlyActive
    ? list.filter((o) => o.active && isWithinOfferWindow(o.startDate, o.endDate ?? o.validTill))
    : list;
}

export async function saveOffer(offer: Offer): Promise<Offer[]> {
  const list = loadOffersStore();
  const normalized: Offer = {
    ...offer,
    endDate: offer.endDate ?? offer.validTill,
    validTill: offer.endDate ?? offer.validTill,
  };
  const exists = list.some((o) => o.id === normalized.id);
  const next = exists
    ? list.map((o) => (o.id === normalized.id ? normalized : o))
    : [normalized, ...list];
  writeStorageJson(OFFERS_STORAGE_KEY, next);
  notifyCatalogChanged();
  return next;
}

export async function deleteOffer(id: string): Promise<Offer[]> {
  const next = loadOffersStore().filter((o) => o.id !== id);
  writeStorageJson(OFFERS_STORAGE_KEY, next);
  notifyCatalogChanged();
  return next;
}

export async function getCoupons(onlyActive = true): Promise<Coupon[]> {
  const list = loadCouponsStore();
  return onlyActive
    ? list.filter((c) => c.active && isWithinOfferWindow(c.startDate, c.endDate))
    : list;
}

export async function saveCoupon(coupon: Coupon): Promise<Coupon[]> {
  const code = coupon.code.trim().toUpperCase();
  if (!code) {
    throw new Error('Coupon code is required.');
  }
  const normalized: Coupon = { ...coupon, code };
  const list = loadCouponsStore();
  const exists = list.some((c) => c.code.toUpperCase() === code);
  const next = exists
    ? list.map((c) => (c.code.toUpperCase() === code ? normalized : c))
    : [normalized, ...list];
  writeStorageJson(COUPONS_STORAGE_KEY, next);
  notifyCatalogChanged();
  return next;
}

export async function deleteCoupon(code: string): Promise<Coupon[]> {
  const target = code.trim().toUpperCase();
  const next = loadCouponsStore().filter((c) => c.code.toUpperCase() !== target);
  writeStorageJson(COUPONS_STORAGE_KEY, next);
  notifyCatalogChanged();
  return next;
}

export async function validateCoupon(
  code: string,
  subtotal: number,
): Promise<{ valid: boolean; coupon?: Coupon; discount: number; reason?: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, discount: 0, reason: 'Enter a coupon code.' };
  }
  const coupon = loadCouponsStore().find(
    (c) =>
      c.code.toUpperCase() === normalized &&
      c.active &&
      isWithinOfferWindow(c.startDate, c.endDate),
  );
  if (!coupon) {
    return { valid: false, discount: 0, reason: 'Invalid or expired coupon code.' };
  }
  if (subtotal < coupon.minOrderAmount) {
    return {
      valid: false,
      coupon,
      discount: 0,
      reason: `Minimum order ₹${coupon.minOrderAmount} required for ${coupon.code}.`,
    };
  }
  return {
    valid: true,
    coupon,
    discount: computeCouponDiscount(coupon, subtotal),
  };
}

export async function getBanners(onlyActive = true): Promise<Banner[]> {
  const list = loadBannersStore();
  return onlyActive
    ? list.filter((b) => b.active && isWithinOfferWindow(b.startDate, b.endDate))
    : list;
}

export async function saveBanner(banner: Banner): Promise<Banner[]> {
  const list = loadBannersStore();
  const exists = list.some((b) => b.id === banner.id);
  const next = exists
    ? list.map((b) => (b.id === banner.id ? banner : b))
    : [banner, ...list];
  writeStorageJson(BANNERS_STORAGE_KEY, next);
  notifyCatalogChanged();
  return next;
}

export async function deleteBanner(id: string): Promise<Banner[]> {
  const next = loadBannersStore().filter((b) => b.id !== id);
  writeStorageJson(BANNERS_STORAGE_KEY, next);
  notifyCatalogChanged();
  return next;
}
