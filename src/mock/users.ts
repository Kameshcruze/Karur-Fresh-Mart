import type { User } from '../types';

export interface DeliveryPartnerProfile {
  id: string;
  userId: string;
  name: string;
  mobile: string;
  vehicleNumber: string;
  zone: string;
  isAvailable: boolean;
}

export const DEMO_USERS: Record<'customer' | 'admin' | 'delivery', User> = {
  customer: {
    id: 'user-cust-1',
    name: 'Senthil Kumar',
    mobile: '9842241088',
    role: 'customer',
    preferredLanguage: 'en',
  },
  admin: {
    id: 'user-admin-1',
    name: 'Aravindhan M (Owner)',
    mobile: '9842211001',
    role: 'admin',
    preferredLanguage: 'en',
  },
  delivery: {
    id: 'user-deliv-1',
    name: 'Karthikeyan R',
    mobile: '9789422109',
    role: 'delivery',
    preferredLanguage: 'en',
  },
};

export const MOCK_DELIVERY_PARTNER_PROFILES: DeliveryPartnerProfile[] = [
  {
    id: 'dp-1',
    userId: 'user-deliv-1',
    name: 'Karthikeyan R',
    mobile: '9789422109',
    vehicleNumber: 'TN 47 BL 4821',
    zone: 'Thanthonimalai & Jawahar Bazaar',
    isAvailable: true,
  },
  {
    id: 'dp-2',
    userId: 'user-deliv-2',
    name: 'Muruganandam S',
    mobile: '9443288710',
    vehicleNumber: 'TN 47 AC 9104',
    zone: 'Vengamedu & Gandhigramam',
    isAvailable: true,
  },
];
