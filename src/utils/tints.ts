import type { ProductTint } from '../types';

export const PRODUCT_TINT_CLASSES: Record<ProductTint, string> = {
  rice: 'bg-tint-rice',
  dal: 'bg-tint-dal',
  oil: 'bg-tint-oil',
  spice: 'bg-tint-spice',
  dairy: 'bg-tint-dairy',
  salt: 'bg-tint-salt',
};

export const PRODUCT_TINT_HEX: Record<ProductTint, string> = {
  rice: '#F3E9C6',
  dal: '#F7D98B',
  oil: '#FBE38A',
  spice: '#E3DCCB',
  dairy: '#DCEBFA',
  salt: '#ECEFF1',
};
