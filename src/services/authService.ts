import { KARUR_STORE_COORDS, MOCK_ADDRESSES } from '../mock/addresses';
import { DEMO_USERS } from '../mock/users';
import type { Address, DeliverySettings, User, UserRole } from '../types';
import { readStorageJson, writeStorageJson } from './storage';

const USER_STORAGE_KEY = 'kfm_auth_user_v2';
const AUTH_LOGGED_IN_KEY = 'kfm_auth_logged_in_v2';
const USERS_REGISTRY_KEY = 'kfm_users_registry_v2';
const ADDRESSES_STORAGE_KEY = 'kfm_addresses_v2';
const DELIVERY_SETTINGS_KEY = 'kfm_delivery_settings_v2';

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  hubName: KARUR_STORE_COORDS.name,
  hubLat: KARUR_STORE_COORDS.lat,
  hubLng: KARUR_STORE_COORDS.lng,
  deliveryRadiusKm: 8,
  deliveryFeeInr: 25,
  freeDeliveryThresholdInr: 499,
  storeOpenTime: '06:30',
  storeCloseTime: '22:00',
  enabledSlots: ['45min', 'today_evening', 'tomorrow_morning'],
};

export const OTP_RESEND_COOLDOWN_SECONDS = 30;
const OTP_TTL_MS = 5 * 60 * 1000;

interface PendingOtpChallenge {
  mobile: string;
  otp: string;
  expiresAt: number;
  resendAvailableAt: number;
}

// In-memory store for active demo OTP challenges (per 10-digit Indian mobile)
const pendingOtpMap = new Map<string, PendingOtpChallenge>();

export interface OtpChallengeResponse {
  mobile: string;
  /** Returned strictly for demo toast display; real SMS/WhatsApp providers do NOT return OTPs to the client. */
  otpPreview: string;
  isNewUser: boolean;
  existingUserName?: string;
  existingRole?: UserRole;
  resendSeconds: number;
}

export function normalizeIndianMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function isValidIndianMobile(input: string): boolean {
  const normalized = normalizeIndianMobile(input);
  return /^[6-9]\d{9}$/.test(normalized);
}

function loadUsersRegistry(): User[] {
  const defaults = Object.values(DEMO_USERS);
  const stored = readStorageJson<User[] | null>(USERS_REGISTRY_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(USERS_REGISTRY_KEY, defaults);
  return defaults;
}

function saveUserToRegistry(user: User): void {
  const registry = loadUsersRegistry();
  const idx = registry.findIndex(
    (u) => u.id === user.id || u.mobile === user.mobile,
  );
  const next =
    idx >= 0
      ? registry.map((u, i) => (i === idx ? user : u))
      : [...registry, user];
  writeStorageJson(USERS_REGISTRY_KEY, next);
}

function loadAddressesStore(): Address[] {
  const stored = readStorageJson<Address[] | null>(ADDRESSES_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(ADDRESSES_STORAGE_KEY, MOCK_ADDRESSES);
  return MOCK_ADDRESSES;
}

export function getRoleHomeRoute(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'delivery':
      return '/delivery';
    case 'customer':
    default:
      return '/';
  }
}

export async function getCurrentUser(): Promise<User> {
  return readStorageJson<User>(USER_STORAGE_KEY, DEMO_USERS.customer);
}

export async function isUserLoggedIn(): Promise<boolean> {
  return readStorageJson<boolean>(AUTH_LOGGED_IN_KEY, false);
}

export async function getDemoUsers(): Promise<Record<'customer' | 'admin' | 'delivery', User>> {
  return DEMO_USERS;
}

export async function getRegisteredUsers(): Promise<User[]> {
  return loadUsersRegistry();
}

export async function registerOrUpdateUser(user: User): Promise<User[]> {
  saveUserToRegistry(user);
  return loadUsersRegistry();
}

export async function updateUserRole(userId: string, role: UserRole): Promise<User[]> {
  const registry = loadUsersRegistry();
  const next = registry.map((u) => (u.id === userId ? { ...u, role } : u));
  writeStorageJson(USERS_REGISTRY_KEY, next);
  const current = readStorageJson<User | null>(USER_STORAGE_KEY, null);
  if (current && current.id === userId) {
    writeStorageJson(USER_STORAGE_KEY, { ...current, role });
  }
  return next;
}

export async function lookupUserByMobile(mobile: string): Promise<User | undefined> {
  const normalized = normalizeIndianMobile(mobile);
  const registry = loadUsersRegistry();
  return (
    registry.find((u) => u.mobile === normalized) ??
    Object.values(DEMO_USERS).find((u) => u.mobile === normalized)
  );
}

/**
 * Generates and dispatches a 4-digit OTP challenge for mobile login/signup.
 *
 * INTEGRATION SEAM (WhatsApp / SMS OTP Provider):
 * Plug a real OTP gateway (e.g., MSG91, Gupshup WhatsApp Business API, or Twilio Verify)
 * right where `generatedOtp` is dispatched below, and remove `otpPreview` from the API payload
 * once backed by a real server endpoint.
 */
export async function requestMobileOtp(mobile: string): Promise<OtpChallengeResponse> {
  const normalized = normalizeIndianMobile(mobile);
  if (!isValidIndianMobile(normalized)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }

  const existing = await lookupUserByMobile(normalized);
  const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
  const now = Date.now();

  pendingOtpMap.set(normalized, {
    mobile: normalized,
    otp: generatedOtp,
    expiresAt: now + OTP_TTL_MS,
    resendAvailableAt: now + OTP_RESEND_COOLDOWN_SECONDS * 1000,
  });

  // ---------------------------------------------------------------------------
  // TODO [OTP Provider Hook]:
  // await sendWhatsAppOrSmsOtp({ to: `+91${normalized}`, otp: generatedOtp });
  // ---------------------------------------------------------------------------

  return {
    mobile: normalized,
    otpPreview: generatedOtp,
    isNewUser: !existing,
    existingUserName: existing?.name,
    existingRole: existing?.role,
    resendSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  };
}

/**
 * Verifies the 4-digit OTP and persists the authenticated session.
 */
export async function verifyMobileOtp(params: {
  mobile: string;
  otp: string;
  name?: string;
}): Promise<User> {
  const normalized = normalizeIndianMobile(params.mobile);
  const trimmedOtp = params.otp.trim();

  if (!isValidIndianMobile(normalized)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }
  if (!/^\d{4}$/.test(trimmedOtp)) {
    throw new Error('Please enter the 4-digit OTP.');
  }

  const challenge = pendingOtpMap.get(normalized);
  if (!challenge) {
    throw new Error('OTP has not been requested or has expired. Please request a new OTP.');
  }
  if (Date.now() > challenge.expiresAt) {
    pendingOtpMap.delete(normalized);
    throw new Error('OTP expired. Please resend a new OTP.');
  }
  if (challenge.otp !== trimmedOtp) {
    throw new Error('Incorrect OTP. Please check the 4-digit code and try again.');
  }

  const existing = await lookupUserByMobile(normalized);
  if (!existing && !params.name?.trim()) {
    throw new Error('Please enter your name to create your Karur Fresh Mart account.');
  }

  pendingOtpMap.delete(normalized);

  const user: User = existing
    ? {
        ...existing,
        name: params.name?.trim() ? params.name.trim() : existing.name,
      }
    : {
        id: `user-${normalized}`,
        name: params.name!.trim(),
        mobile: normalized,
        role: 'customer',
        preferredLanguage: 'en',
      };

  saveUserToRegistry(user);
  writeStorageJson(USER_STORAGE_KEY, user);
  writeStorageJson(AUTH_LOGGED_IN_KEY, true);
  return user;
}

export async function loginWithMobile(mobile: string, name?: string): Promise<User> {
  const cleaned = normalizeIndianMobile(mobile);
  if (cleaned.length < 10) {
    throw new Error('Please enter a valid 10-digit mobile number.');
  }
  const existing = await lookupUserByMobile(cleaned);
  const user: User = existing
    ? { ...existing, name: name?.trim() ? name.trim() : existing.name }
    : {
        id: `user-${cleaned}`,
        name: name?.trim() || 'Karur Customer',
        mobile: cleaned,
        role: 'customer',
        preferredLanguage: 'en',
      };
  saveUserToRegistry(user);
  writeStorageJson(USER_STORAGE_KEY, user);
  writeStorageJson(AUTH_LOGGED_IN_KEY, true);
  return user;
}

export async function loginAsDemoRole(role: UserRole): Promise<User> {
  const user = DEMO_USERS[role];
  writeStorageJson(USER_STORAGE_KEY, user);
  writeStorageJson(AUTH_LOGGED_IN_KEY, true);
  return user;
}

export async function logout(): Promise<User> {
  const guest = DEMO_USERS.customer;
  writeStorageJson(USER_STORAGE_KEY, guest);
  writeStorageJson(AUTH_LOGGED_IN_KEY, false);
  return guest;
}

export async function getDeliverySettings(): Promise<DeliverySettings> {
  const stored = readStorageJson<Partial<DeliverySettings> | null>(
    DELIVERY_SETTINGS_KEY,
    null,
  );
  if (
    stored &&
    typeof stored.hubLat === 'number' &&
    typeof stored.hubLng === 'number' &&
    typeof stored.deliveryRadiusKm === 'number' &&
    stored.deliveryRadiusKm > 0
  ) {
    return {
      ...DEFAULT_DELIVERY_SETTINGS,
      ...stored,
      enabledSlots:
        Array.isArray(stored.enabledSlots) && stored.enabledSlots.length > 0
          ? stored.enabledSlots
          : DEFAULT_DELIVERY_SETTINGS.enabledSlots,
    };
  }
  writeStorageJson(DELIVERY_SETTINGS_KEY, DEFAULT_DELIVERY_SETTINGS);
  return DEFAULT_DELIVERY_SETTINGS;
}

export async function updateDeliverySettings(
  updates: Partial<DeliverySettings>,
): Promise<DeliverySettings> {
  const current = await getDeliverySettings();
  const next: DeliverySettings = {
    ...current,
    ...updates,
    deliveryRadiusKm: Math.max(
      1,
      Number(updates.deliveryRadiusKm ?? current.deliveryRadiusKm),
    ),
    deliveryFeeInr: Math.max(
      0,
      Number(updates.deliveryFeeInr ?? current.deliveryFeeInr ?? 25),
    ),
    freeDeliveryThresholdInr: Math.max(
      0,
      Number(updates.freeDeliveryThresholdInr ?? current.freeDeliveryThresholdInr ?? 499),
    ),
    enabledSlots:
      updates.enabledSlots && updates.enabledSlots.length > 0
        ? updates.enabledSlots
        : current.enabledSlots ?? DEFAULT_DELIVERY_SETTINGS.enabledSlots,
  };
  writeStorageJson(DELIVERY_SETTINGS_KEY, next);
  return next;
}

export async function getAddresses(userId?: string): Promise<Address[]> {
  const all = loadAddressesStore();
  return userId ? all.filter((a) => a.userId === userId) : all;
}

export async function getDefaultAddress(userId?: string): Promise<Address | undefined> {
  const list = await getAddresses(userId);
  return list.find((a) => a.isDefault) ?? list[0];
}

export async function saveAddress(address: Address): Promise<Address[]> {
  const list = loadAddressesStore();
  const exists = list.some((a) => a.id === address.id);
  let next = exists
    ? list.map((a) => (a.id === address.id ? address : a))
    : [...list, address];

  if (address.isDefault || next.length === 1) {
    next = next.map((a) => ({
      ...a,
      isDefault: a.id === address.id,
    }));
  }

  writeStorageJson(ADDRESSES_STORAGE_KEY, next);
  return next;
}

export async function deleteAddress(id: string): Promise<Address[]> {
  const list = loadAddressesStore().filter((a) => a.id !== id);
  if (list.length > 0 && !list.some((a) => a.isDefault)) {
    list[0] = { ...list[0], isDefault: true };
  }
  writeStorageJson(ADDRESSES_STORAGE_KEY, list);
  return list;
}

export async function setDefaultAddress(id: string): Promise<Address[]> {
  const next = loadAddressesStore().map((a) => ({
    ...a,
    isDefault: a.id === id,
  }));
  writeStorageJson(ADDRESSES_STORAGE_KEY, next);
  return next;
}
