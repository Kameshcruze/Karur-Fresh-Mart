import { MOCK_BRANDS } from '../mock/brands';
import { MOCK_COMBOS } from '../mock/combos';
import { MOCK_PRODUCTS } from '../mock/products';
import type { Brand, Combo, ComboType, Product } from '../types';
import {
  getTotalAvailableQty,
  loadProductsStore,
  notifyCatalogChanged,
  resolveBrandName,
} from './productService';
import { readStorageJson, writeStorageJson } from './storage';

const COMBOS_STORAGE_KEY = 'kfm_combos_v2';

export interface ComboBrandOption {
  product: Product;
  brandName: string;
  isDefault: boolean;
  deltaFromDefault: number;
  availableStock: number;
  isOutOfStock: boolean;
}

export interface ComboPriceResult {
  unitPrice: number;
  unitMrp: number;
  separateItemsTotal: number;
  savingsVsSeparate: number;
  priceDelta: number;
  isUnavailable: boolean;
  resolvedSelections: Record<string, string>;
  breakdown: Array<{
    comboItemId: string;
    groupName: Combo['items'][number]['productGroup'];
    product: Product;
    brandName: string;
    quantity: number;
    unit: string;
    deltaFromDefault: number;
    isUnavailable: boolean;
    options: ComboBrandOption[];
  }>;
}

function loadCombosStore(): Combo[] {
  const stored = readStorageJson<Combo[] | null>(COMBOS_STORAGE_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  writeStorageJson(COMBOS_STORAGE_KEY, MOCK_COMBOS);
  return MOCK_COMBOS;
}

/**
 * Pure combo pricing engine:
 * - Every ComboItem is mandatory (customer can NEVER remove an item).
 * - Customer can only choose among `item.allowedProductIds`.
 * - Combo price = combo.price + sum((chosenProduct.price - defaultProduct.price) * item.quantity).
 * - separateItemsTotal = sum(chosenProduct.price * item.quantity) when purchased individually.
 * - Out-of-stock brand options are marked `isOutOfStock: true`; if all brands for an item
 *   are out of stock, `isUnavailable: true` disables adding the combo.
 */
export function calculateComboPricing(
  combo: Combo,
  selectedBrandProductIds: Record<string, string> = {},
  catalog: Product[] = MOCK_PRODUCTS,
  brands: Brand[] = MOCK_BRANDS,
): ComboPriceResult {
  let priceDelta = 0;
  let unitMrp = 0;
  let separateItemsTotal = 0;
  let comboUnavailable = false;
  const resolvedSelections: Record<string, string> = {};
  const breakdown: ComboPriceResult['breakdown'] = [];

  for (const item of combo.items) {
    const requestedProductId = selectedBrandProductIds[item.id];
    let chosenId = requestedProductId ?? item.defaultProductId;

    if (!item.allowedProductIds.includes(chosenId)) {
      throw new Error(
        `Product "${chosenId}" is not an allowed brand option for combo group "${item.productGroup.en}".`,
      );
    }

    const defaultProd = catalog.find((p) => p.id === item.defaultProductId);
    if (!defaultProd) {
      throw new Error(`Missing product definition for combo item "${item.id}".`);
    }

    const options: ComboBrandOption[] = item.allowedProductIds
      .map((pid) => {
        const optProd = catalog.find((p) => p.id === pid);
        if (!optProd) return null;
        const availableStock = getTotalAvailableQty(optProd);
        return {
          product: optProd,
          brandName: resolveBrandName(optProd.brandId, brands),
          isDefault: pid === item.defaultProductId,
          deltaFromDefault: (optProd.price - defaultProd.price) * item.quantity,
          availableStock,
          isOutOfStock: availableStock < item.quantity || availableStock <= 0,
        };
      })
      .filter((opt): opt is ComboBrandOption => opt !== null);

    const itemUnavailable = options.length === 0 || options.every((o) => o.isOutOfStock);
    if (itemUnavailable) {
      comboUnavailable = true;
    } else if (!requestedProductId) {
      // Auto-select the first in-stock allowed brand if the default brand ran out of stock
      const defaultOpt = options.find((o) => o.product.id === chosenId);
      if (!defaultOpt || defaultOpt.isOutOfStock) {
        const firstInStock = options.find((o) => !o.isOutOfStock);
        if (firstInStock) {
          chosenId = firstInStock.product.id;
        }
      }
    }

    const chosenProd = catalog.find((p) => p.id === chosenId) ?? defaultProd;

    const itemDelta = (chosenProd.price - defaultProd.price) * item.quantity;
    priceDelta += itemDelta;
    separateItemsTotal += chosenProd.price * item.quantity;
    unitMrp += chosenProd.mrp * item.quantity;
    resolvedSelections[item.id] = chosenProd.id;

    breakdown.push({
      comboItemId: item.id,
      groupName: item.productGroup,
      product: chosenProd,
      brandName: resolveBrandName(chosenProd.brandId, brands),
      quantity: item.quantity,
      unit: item.unit,
      deltaFromDefault: itemDelta,
      isUnavailable: itemUnavailable,
      options,
    });
  }

  const unitPrice = Math.max(0, combo.price + priceDelta);
  const savingsVsSeparate = Math.max(0, separateItemsTotal - unitPrice);

  return {
    unitPrice,
    unitMrp: Math.max(unitPrice, unitMrp),
    separateItemsTotal,
    savingsVsSeparate,
    priceDelta,
    isUnavailable: comboUnavailable,
    resolvedSelections,
    breakdown,
  };
}

export async function getCombos(): Promise<Combo[]> {
  return loadCombosStore();
}

export async function getComboById(id: string): Promise<Combo | undefined> {
  return loadCombosStore().find((c) => c.id === id);
}

export async function getComboByType(type: ComboType | string): Promise<Combo | undefined> {
  return loadCombosStore().find((c) => c.type === type);
}

export async function saveCombo(combo: Combo): Promise<Combo[]> {
  if (combo.items.length === 0) {
    throw new Error('A combo must contain at least one fixed item.');
  }

  const normalizedItems = combo.items.map((item) => {
    if (item.allowedProductIds.length === 0) {
      throw new Error(`Combo item "${item.productGroup.en}" must allow at least one brand.`);
    }
    const defaultProductId = item.allowedProductIds.includes(item.defaultProductId)
      ? item.defaultProductId
      : item.allowedProductIds[0];
    return {
      ...item,
      quantity: Math.max(1, Math.floor(item.quantity)),
      defaultProductId,
    };
  });

  const sanitized: Combo = {
    ...combo,
    price: Math.max(1, Math.round(combo.price)),
    items: normalizedItems,
    // Strictly enforced: customers can never remove fixed combo items
    customerCanRemoveItems: false,
    customerCanChangeBrand: combo.customerCanChangeBrand !== false,
  };

  const list = loadCombosStore();
  const exists = list.some((c) => c.id === sanitized.id);
  const next = exists
    ? list.map((c) => (c.id === sanitized.id ? sanitized : c))
    : [...list, sanitized];
  writeStorageJson(COMBOS_STORAGE_KEY, next);
  notifyCatalogChanged();
  return next;
}

export async function priceComboWithBrands(
  comboIdOrType: string,
  selectedBrandProductIds: Record<string, string> = {},
): Promise<ComboPriceResult> {
  const combos = loadCombosStore();
  const combo = combos.find((c) => c.id === comboIdOrType || c.type === comboIdOrType);
  if (!combo) {
    throw new Error(`Combo "${comboIdOrType}" not found.`);
  }
  const products = loadProductsStore();
  return calculateComboPricing(combo, selectedBrandProductIds, products, MOCK_BRANDS);
}
