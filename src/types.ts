export type Language = 'en' | 'ta';

export type UserRole = 'customer' | 'admin' | 'delivery';

export type ProductTint = 'rice' | 'dal' | 'oil' | 'spice' | 'dairy' | 'salt';

export interface BilingualText {
  en: string;
  ta: string;
}

export interface Category {
  id: string;
  slug: string;
  name: BilingualText;
  icon: string; // Lucide icon identifier
  tint: ProductTint;
  image?: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface ProductVariant {
  id: string;
  packSize: string;
  price: number;
  mrp: number;
  stockQty: number;
  isDefault?: boolean;
}

export interface Product {
  id: string;
  sku?: string;
  name: BilingualText;
  brandId: string;
  categoryId: string;
  packSize: string; // e.g. "10 kg", "1 L", "500 g"
  unit?: string;
  price: number;
  mrp: number;
  stockQty: number;
  reservedQty: number;
  lowStockThreshold?: number;
  imageTint: ProductTint;
  image?: string;
  description: BilingualText;
  visibleOnline: boolean;
  isFeatured?: boolean;
  rating?: number;
  packVariants?: ProductVariant[];
  updatedAt?: string;
}

export type ComboType = 'individual' | 'family';

export interface ComboItem {
  id: string;
  productGroup: BilingualText;
  quantity: number;
  unit: string;
  defaultProductId: string;
  allowedProductIds: string[]; // Each is a different brand of the same item, with its own price
}

export interface Combo {
  id: string;
  type: ComboType;
  name: BilingualText;
  description: BilingualText;
  price: number; // Base combo price in INR
  servesPeople: string;
  items: ComboItem[];
  imageTint: ProductTint;
  image?: string;
  /** Customer can NEVER remove fixed combo items (always false). */
  customerCanRemoveItems?: false;
  /** Whether customer can choose among allowed brands per item (default true). */
  customerCanChangeBrand?: boolean;
}

export interface User {
  id: string;
  name: string;
  mobile: string;
  role: UserRole;
  preferredLanguage?: Language;
}

export interface DeliverySettings {
  hubName: string;
  hubLat: number;
  hubLng: number;
  deliveryRadiusKm: number;
  deliveryFeeInr?: number;
  freeDeliveryThresholdInr?: number;
  storeOpenTime?: string;
  storeCloseTime?: string;
  enabledSlots?: DeliverySlotId[];
}

export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface Address {
  id: string;
  userId: string;
  label: AddressLabel;
  recipientName?: string;
  mobile?: string;
  door: string;
  street: string;
  landmark: string;
  area?: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault?: boolean;
}

export type CartItemKind = 'product' | 'combo';

export interface CartItem {
  lineId: string;
  kind: CartItemKind;
  productId?: string; // When kind === 'product'
  variantId?: string; // Selected pack size variant id
  packSize?: string; // Selected pack size label
  comboId?: string; // When kind === 'combo'
  comboType?: ComboType;
  /** Maps ComboItem.id -> chosen Product.id for grouped combo lines */
  selectedBrandProductIds?: Record<string, string>;
  quantity: number;
  addedAt: string;
}

export type DeliverySlotId = '45min' | 'today_evening' | 'tomorrow_morning';

export interface Cart {
  userId?: string;
  items: CartItem[];
  couponCode?: string;
  deliverySlot?: DeliverySlotId;
  updatedAt: string;
}

export interface PricedCartLine {
  cartItem: CartItem;
  title: BilingualText;
  subtitle: string;
  imageTint: ProductTint;
  image?: string;
  unitPrice: number;
  unitMrp: number;
  lineTotal: number;
  lineMrpTotal: number;
  lineSavings: number;
  comboSavingsVsSeparate?: number;
  comboCanChangeBrand?: boolean;
  comboTemporarilyUnavailable?: boolean;
  comboBrandBreakdown?: Array<{
    comboItemId: string;
    groupName: BilingualText;
    product: Product;
    brandName: string;
    quantity: number;
    unit: string;
    deltaFromDefault: number;
    isUnavailable?: boolean;
    options: Array<{
      product: Product;
      brandName: string;
      isDefault: boolean;
      deltaFromDefault: number;
      availableStock: number;
      isOutOfStock: boolean;
    }>;
  }>;
}

export interface CartSummary {
  userId?: string;
  lines: PricedCartLine[];
  itemCount: number;
  totalUnits: number;
  subtotal: number;
  mrpTotal: number;
  productSavings: number;
  couponCode?: string;
  couponDiscount: number;
  deliverySlot: DeliverySlotId;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  amountToFreeDelivery: number;
  grandTotal: number;
}

export type OrderStatus =
  | 'placed'
  | 'packed'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id: string;
  kind: CartItemKind;
  productId?: string;
  comboId?: string;
  name: BilingualText;
  packOrSummary: string;
  unitPrice: number;
  unitMrp: number;
  quantity: number;
  lineTotal: number;
  imageTint: ProductTint;
  image?: string;
  /** Exact product units consumed for inventory deduction */
  stockDeductions: Array<{ productId: string; quantity: number }>;
  comboSelections?: Array<{
    comboItemId: string;
    groupName: BilingualText;
    productId: string;
    productName: BilingualText;
    brandName: string;
    quantity: number;
    unit: string;
  }>;
}

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  transactionRef?: string;
  paidAt?: string;
}

export interface PaymentOrder {
  id: string;
  gateway: 'razorpay_mock';
  amount: number;
  amountPaise: number;
  currency: 'INR';
  method: PaymentMethod;
  receipt: string;
  customerName: string;
  customerMobile: string;
  userId: string;
  createdAt: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  paymentId?: string;
  signature?: string;
  transactionRef?: string;
  failureReason?: string;
  verifiedAt: string;
}

export interface DeliveryAssignment {
  id: string;
  orderId: string;
  deliveryPartnerId: string;
  partnerName: string;
  partnerMobile: string;
  vehicleNumber: string;
  assignedAt: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  deliveryOtp: string;
  otpVerified: boolean;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerMobile: string;
  address: Address;
  items: OrderItem[];
  subtotal: number;
  couponCode?: string;
  couponDiscount: number;
  deliverySlot?: DeliverySlotId;
  deliveryFee: number;
  savings: number;
  total: number;
  status: OrderStatus;
  statusTimestamps?: Partial<Record<OrderStatus, string>>;
  payment: Payment;
  deliveryAssignment?: DeliveryAssignment;
  createdAt: string;
  updatedAt: string;
  estimatedMinutes: number;
}

export interface Offer {
  id: string;
  title: BilingualText;
  subtitle: BilingualText;
  badgeText: BilingualText;
  discountType: 'percent' | 'flat';
  discountValue: number;
  minOrderAmount: number;
  categoryId?: string;
  productIds?: string[];
  startDate?: string;
  endDate?: string;
  validTill: string;
  active: boolean;
}

export interface Coupon {
  code: string;
  description: BilingualText;
  discountType: 'percent' | 'flat';
  discountValue: number;
  maxDiscount?: number;
  minOrderAmount: number;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export interface Banner {
  id: string;
  title: BilingualText;
  subtitle: BilingualText;
  ctaLabel: BilingualText;
  ctaRoute: string;
  tone: 'green' | 'yellow' | 'forest';
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export type StockHistoryReason = 'manual' | 'excel import' | 'order placed' | 'correction';

export interface StockHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  who: string;
  when: string;
  oldValue: number;
  newValue: number;
  oldPrice?: number;
  newPrice?: number;
  field?: 'stock' | 'price' | 'stock_and_price';
  reason: StockHistoryReason;
  note?: string;
}

export type StockImportMode = 'add_and_update' | 'update_stock_only' | 'replace_all_stock';

export type StockPreviewStatus = 'New' | 'Update' | 'Error';

export interface StockSheetExportRow {
  item_code: string;
  product_name: string;
  product_name_tamil: string;
  brand: string;
  category: string;
  pack_size: string;
  unit: string;
  mrp: number;
  selling_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  visible_online: 'yes' | 'no';
  image_url: string;
}

export interface StockPreviewRow {
  rowNumber: number;
  status: StockPreviewStatus;
  skip: boolean;
  matchedProductId?: string;
  matchedBy?: 'item_code' | 'name_brand_pack';
  errors: string[];
  currentStockQty?: number;
  currentPrice?: number;
  currentMrp?: number;
  item_code: string;
  product_name: string;
  product_name_tamil: string;
  brand: string;
  category: string;
  resolvedBrandId?: string;
  resolvedCategoryId?: string;
  pack_size: string;
  unit: string;
  mrp: number;
  selling_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  visible_online: boolean;
  image_url: string;
  raw: Record<string, unknown>;
}

export interface StockImportErrorDetail {
  rowNumber: number;
  item_code: string;
  product_name: string;
  errors: string[];
}

export interface StockImportResult {
  logId: string;
  fileName: string;
  mode: StockImportMode;
  importedAt: string;
  adminName: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errorDetails: StockImportErrorDetail[];
}

export type StockImportLog = StockImportResult;

