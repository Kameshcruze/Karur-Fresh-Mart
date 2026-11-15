import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  DEFAULT_DELIVERY_SETTINGS,
  deleteAddress as serviceDeleteAddress,
  getAddresses,
  getCurrentUser,
  getDefaultAddress,
  getDeliverySettings,
  isUserLoggedIn,
  loginAsDemoRole,
  logout as serviceLogout,
  saveAddress as serviceSaveAddress,
  setDefaultAddress as serviceSetDefaultAddress,
} from '../services';
import type { Address, DeliverySettings, User, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  isLoggedIn: boolean;
  addresses: Address[];
  defaultAddress: Address | undefined;
  deliverySettings: DeliverySettings;
  isLoading: boolean;
  refreshAuth: () => Promise<void>;
  refreshAddresses: () => Promise<void>;
  loginWithRole: (role: UserRole) => Promise<User>;
  logoutUser: () => Promise<void>;
  saveUserAddress: (address: Address) => Promise<Address[]>;
  deleteUserAddress: (id: string) => Promise<Address[]>;
  selectDefaultAddress: (id: string) => Promise<Address[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [defaultAddress, setDefaultAddress] = useState<Address | undefined>(undefined);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(
    DEFAULT_DELIVERY_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [currentUser, loggedIn, addrList, defAddr, settings] = await Promise.all([
      getCurrentUser(),
      isUserLoggedIn(),
      getAddresses(),
      getDefaultAddress(),
      getDeliverySettings(),
    ]);
    setUser(currentUser);
    setIsLoggedIn(loggedIn);
    setAddresses(addrList);
    setDefaultAddress(defAddr);
    setDeliverySettings(settings);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshAuth = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  const refreshAddresses = useCallback(async () => {
    const [addrList, defAddr, settings] = await Promise.all([
      getAddresses(),
      getDefaultAddress(),
      getDeliverySettings(),
    ]);
    setAddresses(addrList);
    setDefaultAddress(defAddr);
    setDeliverySettings(settings);
  }, []);

  const loginWithRole = useCallback(
    async (role: UserRole) => {
      const nextUser = await loginAsDemoRole(role);
      setUser(nextUser);
      setIsLoggedIn(true);
      await refreshAddresses();
      return nextUser;
    },
    [refreshAddresses],
  );

  const logoutUser = useCallback(async () => {
    const guest = await serviceLogout();
    setUser(guest);
    setIsLoggedIn(false);
  }, []);

  const saveUserAddress = useCallback(
    async (address: Address) => {
      const next = await serviceSaveAddress(address);
      setAddresses(next);
      setDefaultAddress(next.find((a) => a.isDefault) ?? next[0]);
      return next;
    },
    [],
  );

  const deleteUserAddress = useCallback(async (id: string) => {
    const next = await serviceDeleteAddress(id);
    setAddresses(next);
    setDefaultAddress(next.find((a) => a.isDefault) ?? next[0]);
    return next;
  }, []);

  const selectDefaultAddress = useCallback(async (id: string) => {
    const next = await serviceSetDefaultAddress(id);
    setAddresses(next);
    setDefaultAddress(next.find((a) => a.isDefault) ?? next[0]);
    return next;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        addresses,
        defaultAddress,
        deliverySettings,
        isLoading,
        refreshAuth,
        refreshAddresses,
        loginWithRole,
        logoutUser,
        saveUserAddress,
        deleteUserAddress,
        selectDefaultAddress,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}
