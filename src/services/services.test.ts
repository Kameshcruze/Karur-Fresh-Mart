import test from 'node:test';
import assert from 'node:assert/strict';
import { MOCK_ADDRESSES } from '../mock/addresses';
import {
  addComboToCart,
  addDeliveryPartner,
  addProductToCart,
  applyBulkStockImport,
  applyCouponToCart,
  applyStockDeduction,
  assignDeliveryPartner,
  calculateComboPricing,
  cancelAndRefundOrder,
  cancelOrder,
  clearCart,
  computeAdminDashboardStats,
  computeCartSummary,
  computeDeliveryPartnerStats,
  computeLowStockProducts,
  computeTopProducts,
  computeWeeklyOrdersSeries,
  createPaymentOrder,
  deleteBanner,
  deleteCoupon,
  getAllUserCarts,
  getCart,
  getCartReminders,
  getCartSummary,
  getDeliveryPartners,
  getDeliverySettings,
  getDemoUsers,
  FREE_DELIVERY_THRESHOLD_INR,
  getBanners,
  getBrands,
  getCategories,
  getComboByType,
  getCoupons,
  getFrequentlyBoughtTogether,
  getOffers,
  getOrders,
  getProductById,
  getProductPackVariants,
  getProducts,
  getRegisteredUsers,
  getRoleHomeRoute,
  getSearchSuggestions,
  isWithinOfferWindow,
  loginAsDemoRole,
  markOrderOutForDelivery,
  markOrderPickedUp,
  parseStockImportRows,
  placeOrder,
  refundOrderPayment,
  removeCartItem,
  reorderOrder,
  requestMobileOtp,
  saveBanner,
  saveCombo,
  saveCoupon,
  saveUserCartReminder,
  setCartDeliverySlot,
  STANDARD_DELIVERY_FEE_INR,
  subscribeToCartUpdates,
  subscribeToOrderUpdates,
  updateComboBrandChoice,
  updateDeliverySettings,
  updateOrderStatus,
  updateUserRole,
  validateCoupon,
  verifyDeliveryOtpAndComplete,
  verifyMobileOtp,
  verifyPayment,
} from './index';
import {
  buildGoogleMapsNavUrl,
  calculateDistanceKm,
  checkServiceArea,
} from '../utils/geo';
import {
  buildPublicShopUrl,
  generateShopQrDataUrl,
  generateShopQrSvg,
} from '../utils/qr';

test('catalog includes all 10 categories, 40+ products, and key Karur staples', async () => {
  const categories = await getCategories();
  assert.equal(categories.length, 10);

  const brands = await getBrands();
  assert.ok(brands.length >= 15);

  const products = await getProducts();
  assert.ok(products.length >= 40, `Expected >= 40 products, got ${products.length}`);

  const requiredIds = [
    'prod-ponni-rice-10kg',
    'prod-toor-dal-1kg',
    'prod-sunflower-oil-1l',
    'prod-shakthi-pepper-100g',
    'prod-ramkumar-turmeric-200g',
    'prod-aavin-milk-500ml',
    'prod-tata-salt-1kg',
    'prod-parrys-sugar-1kg',
    'prod-chakra-tea-250g',
    'prod-idly-rice-5kg',
  ];
  for (const id of requiredIds) {
    const prod = await getProductById(id);
    assert.ok(prod, `Expected product ${id} to exist`);
  }
});

test('combos include Individual (2450) and Family (6890) with 8 items and 2 brands each', async () => {
  const individual = await getComboByType('individual');
  const family = await getComboByType('family');
  assert.ok(individual);
  assert.ok(family);

  assert.equal(individual.price, 2450);
  assert.equal(family.price, 6890);
  assert.equal(individual.items.length, 8);
  assert.equal(family.items.length, 8);

  for (const item of [...individual.items, ...family.items]) {
    assert.equal(item.allowedProductIds.length, 2);
  }
});

test('combo pricing adjusts by chosen brand difference and rejects disallowed brands', async () => {
  const individual = await getComboByType('individual');
  assert.ok(individual);
  const products = await getProducts();
  const brands = await getBrands();

  // Base selection matches ₹2,450
  const baseResult = calculateComboPricing(individual, {}, products, brands);
  assert.equal(baseResult.unitPrice, 2450);
  assert.equal(baseResult.priceDelta, 0);

  // Swap Ponni Rice (680 -> 730, +50) and Tea Powder (168 -> 145, -23) => net +27 => ₹2,477
  const swappedResult = calculateComboPricing(
    individual,
    {
      'ci-ind-ponni': 'prod-ponni-rice-10kg-crown',
      'ci-ind-tea': 'prod-avt-tea-250g',
    },
    products,
    brands,
  );
  assert.equal(swappedResult.priceDelta, 27);
  assert.equal(swappedResult.unitPrice, 2477);

  // Disallowed brand for Ponni Rice group must throw
  assert.throws(() => {
    calculateComboPricing(
      individual,
      { 'ci-ind-ponni': 'prod-aavin-milk-500ml' },
      products,
      brands,
    );
  });
});

test('applyStockDeduction consumes reservedQty first before stockQty', () => {
  const sample = {
    id: 'test-prod',
    name: { en: 'Test', ta: 'Test' },
    brandId: 'b1',
    categoryId: 'c1',
    packSize: '1 kg',
    price: 100,
    mrp: 120,
    stockQty: 20,
    reservedQty: 4,
    imageTint: 'rice' as const,
    description: { en: '', ta: '' },
    visibleOnline: true,
  };

  // Order 3 units -> consumes 3 from reservedQty (4 -> 1), stockQty stays 20
  const after3 = applyStockDeduction(sample, 3);
  assert.equal(after3.reservedQty, 1);
  assert.equal(after3.stockQty, 20);

  // Order 6 units -> consumes all 4 reservedQty (4 -> 0), and 2 from stockQty (20 -> 18)
  const after6 = applyStockDeduction(sample, 6);
  assert.equal(after6.reservedQty, 0);
  assert.equal(after6.stockQty, 18);
});

test('cartService handles grouped combo lines, coupons, and delivery thresholds', async () => {
  await clearCart();

  // Add 1x Aavin Milk (22) -> below threshold
  const s1 = await addProductToCart('prod-aavin-milk-500ml', 1);
  assert.equal(s1.subtotal, 22);
  assert.equal(s1.deliveryFee, STANDARD_DELIVERY_FEE_INR);
  assert.equal(s1.amountToFreeDelivery, FREE_DELIVERY_THRESHOLD_INR - 22);

  // Add Individual combo with default brands -> ₹2,450
  const s2 = await addComboToCart('combo-individual');
  assert.equal(s2.lines.length, 2);
  assert.equal(s2.subtotal, 2472);
  assert.equal(s2.deliveryFee, 0);

  // Swap brand inside the grouped combo line in cart
  const comboLine = s2.lines.find((l) => l.cartItem.kind === 'combo');
  assert.ok(comboLine);
  const s3 = await updateComboBrandChoice(
    comboLine.cartItem.lineId,
    'ci-ind-ponni',
    'prod-ponni-rice-10kg-crown',
  );
  assert.equal(s3.subtotal, 2522);

  // Apply FRESH10 coupon (10% up to ₹150)
  const s4 = await applyCouponToCart('FRESH10');
  assert.equal(s4.couponCode, 'FRESH10');
  assert.equal(s4.couponDiscount, 150);
  assert.equal(s4.grandTotal, 2372);
});

test('placeOrder reduces stock (reservedQty first) and deliveryService completes OTP flow', async () => {
  await clearCart();
  const ponniBefore = await getProductById('prod-ponni-rice-10kg');
  assert.ok(ponniBefore);
  const reservedBefore = ponniBefore.reservedQty;
  const stockBefore = ponniBefore.stockQty;

  // Order 5 units of Ponni Rice 10kg (consumes reservedBefore=4 first, then 1 from stockQty)
  await addProductToCart('prod-ponni-rice-10kg', 5);
  const user = await loginAsDemoRole('customer');
  const order = await placeOrder({
    userId: user.id,
    customerName: user.name,
    customerMobile: user.mobile,
    address: MOCK_ADDRESSES[0],
    paymentMethod: 'cod',
  });

  assert.equal(order.status, 'placed');
  assert.equal(order.payment.status, 'pending');

  const ponniAfter = await getProductById('prod-ponni-rice-10kg');
  assert.ok(ponniAfter);
  assert.equal(ponniAfter.reservedQty, Math.max(0, reservedBefore - 5));
  assert.equal(ponniAfter.stockQty, stockBefore - Math.max(0, 5 - reservedBefore));

  // Status flow: placed -> packed -> picked_up -> out_for_delivery -> delivered
  await updateOrderStatus(order.id, 'packed');
  await assignDeliveryPartner(order.id, 'dp-1');
  const pickedUp = await markOrderPickedUp(order.id);
  assert.equal(pickedUp?.status, 'picked_up');
  assert.ok(pickedUp?.deliveryAssignment?.pickedUpAt);

  const inTransit = await markOrderOutForDelivery(order.id);
  assert.equal(inTransit?.status, 'out_for_delivery');

  const wrongOtp = await verifyDeliveryOtpAndComplete(order.id, '0000');
  assert.equal(wrongOtp.success, false);

  const correctOtp = order.deliveryAssignment?.deliveryOtp ?? '';
  const delivered = await verifyDeliveryOtpAndComplete(order.id, correctOtp);
  assert.equal(delivered.success, true);
  assert.equal(delivered.order?.status, 'delivered');
  assert.equal(delivered.order?.payment.status, 'paid');
  assert.ok(delivered.order?.deliveryAssignment?.deliveredAt);

  // Cancel test restores stock
  await addProductToCart('prod-aavin-milk-500ml', 2);
  const milkBefore = (await getProductById('prod-aavin-milk-500ml'))!;
  const order2 = await placeOrder({
    userId: user.id,
    customerName: user.name,
    customerMobile: user.mobile,
    address: MOCK_ADDRESSES[0],
    paymentMethod: 'upi',
  });
  await cancelOrder(order2.id);
  const milkAfterCancel = (await getProductById('prod-aavin-milk-500ml'))!;
  assert.equal(
    milkAfterCancel.stockQty + milkAfterCancel.reservedQty,
    milkBefore.stockQty + milkBefore.reservedQty,
  );
});

test('offerService provides 4 offers, banners, and coupon validation', async () => {
  const offers = await getOffers();
  assert.equal(offers.length, 4);

  const coupons = await getCoupons();
  assert.ok(coupons.length >= 3);

  const banners = await getBanners();
  assert.ok(banners.length >= 3);

  const invalid = await validateCoupon('NOPE', 1000);
  assert.equal(invalid.valid, false);

  const valid = await validateCoupon('KARUR50', 600);
  assert.equal(valid.valid, true);
  assert.equal(valid.discount, 50);

  // Verify demo users exist
  const demoUsers = await getDemoUsers();
  assert.equal(demoUsers.customer.role, 'customer');
  assert.equal(demoUsers.admin.role, 'admin');
  assert.equal(demoUsers.delivery.role, 'delivery');

  // Empty cart check
  const emptySummary = computeCartSummary({ items: [], updatedAt: '' });
  assert.equal(emptySummary.grandTotal, 0);
});

test('pack variants, search suggestions, frequently bought together, and variant cart lines work accurately', async () => {
  const pepper = await getProductById('prod-shakthi-pepper-100g');
  assert.ok(pepper);

  const variants = getProductPackVariants(pepper);
  assert.equal(variants.length, 3);
  assert.deepEqual(
    variants.map((v) => v.packSize),
    ['50 g', '100 g', '250 g'],
  );

  const largeVariant = variants[2];
  assert.ok(largeVariant.price > pepper.price);

  await clearCart();
  const s1 = await addProductToCart(pepper.id, 2, largeVariant.id, largeVariant.packSize);
  assert.equal(s1.totalUnits, 2);
  assert.equal(s1.subtotal, largeVariant.price * 2);
  assert.ok(s1.lines[0].subtitle.includes('250 g'));

  const allProducts = await getProducts();
  const fbt = getFrequentlyBoughtTogether(pepper, allProducts, 4);
  assert.equal(fbt.length, 4);
  assert.ok(fbt.every((p) => p.id !== pepper.id && p.stockQty + p.reservedQty > 0));

  const suggestions = await getSearchSuggestions('Ponni', 6);
  assert.ok(suggestions.length >= 2);
  assert.ok(suggestions.some((p) => p.id === 'prod-ponni-rice-10kg'));
});

test('combo pricing computes separate-items savings, multi-qty brand deltas, and stores chosen brands in one grouped cart line', async () => {
  const individual = await getComboByType('individual');
  const family = await getComboByType('family');
  assert.ok(individual && family);

  const products = await getProducts();
  const brands = await getBrands();

  // Individual base combo saves money vs buying all 8 items separately
  const indBase = calculateComboPricing(individual, {}, products, brands);
  assert.equal(indBase.unitPrice, 2450);
  assert.ok(
    indBase.separateItemsTotal > indBase.unitPrice,
    `Expected separate total (${indBase.separateItemsTotal}) > combo price (${indBase.unitPrice})`,
  );
  assert.equal(indBase.savingsVsSeparate, indBase.separateItemsTotal - indBase.unitPrice);

  // Multi-quantity swap in Individual:
  // Toor Dal (qty 3: 185 -> 198 = +39) + Salt (qty 2: 28 -> 25 = -6) => +33 => ₹2,483
  const indSwapped = calculateComboPricing(
    individual,
    {
      'ci-ind-toor': 'prod-toor-dal-1kg-amaravathi',
      'ci-ind-salt': 'prod-aashirvaad-salt-1kg',
    },
    products,
    brands,
  );
  assert.equal(indSwapped.priceDelta, 33);
  assert.equal(indSwapped.unitPrice, 2483);
  assert.equal(indSwapped.breakdown.length, 8);

  // Family base combo + multi-qty swap:
  // Ponni (qty 4: 680 -> 730 = +200) + Tea (qty 4: 168 -> 145 = -92) => +108 => ₹6,998
  const famBase = calculateComboPricing(family, {}, products, brands);
  assert.equal(famBase.unitPrice, 6890);
  assert.ok(famBase.separateItemsTotal > famBase.unitPrice);

  const famSwapped = calculateComboPricing(
    family,
    {
      'ci-fam-ponni': 'prod-ponni-rice-10kg-crown',
      'ci-fam-tea': 'prod-avt-tea-250g',
    },
    products,
    brands,
  );
  assert.equal(famSwapped.priceDelta, 108);
  assert.equal(famSwapped.unitPrice, 6998);

  // Cart stores chosen brands inside ONE grouped line and allows changing brands or removing whole combo
  await clearCart();
  const c1 = await addComboToCart(individual.id, {
    'ci-ind-pepper': 'prod-aachi-pepper-100g',
  });
  assert.equal(c1.lines.length, 1);
  const comboLine = c1.lines[0];
  assert.equal(comboLine.cartItem.kind, 'combo');
  assert.equal(
    comboLine.cartItem.selectedBrandProductIds?.['ci-ind-pepper'],
    'prod-aachi-pepper-100g',
  );
  assert.equal(comboLine.unitPrice, 2460); // +10 for Aachi pepper
  assert.equal(comboLine.comboBrandBreakdown?.length, 8);

  // Switch brand inside cart and verify all 8 items remain and price updates
  const c2 = await updateComboBrandChoice(
    comboLine.cartItem.lineId,
    'ci-ind-pepper',
    'prod-shakthi-pepper-100g',
  );
  assert.equal(c2.lines.length, 1);
  assert.equal(c2.lines[0].unitPrice, 2450);
  assert.equal(c2.lines[0].comboBrandBreakdown?.length, 8);

  // Remove the whole combo line
  const c3 = await removeCartItem(c2.lines[0].cartItem.lineId);
  assert.equal(c3.lines.length, 0);
});

test('OTP auth flow supports existing role-based routing, new customer signup, and rejects wrong OTPs', async () => {
  // Existing admin phone -> generates 4-digit OTP, requires no name, routes to /admin
  const adminChallenge = await requestMobileOtp('9842211001');
  assert.equal(adminChallenge.isNewUser, false);
  assert.match(adminChallenge.otpPreview, /^\d{4}$/);

  await assert.rejects(() =>
    verifyMobileOtp({ mobile: '9842211001', otp: '0000' }),
  );

  const freshChallenge = await requestMobileOtp('9842211001');
  const adminUser = await verifyMobileOtp({
    mobile: '9842211001',
    otp: freshChallenge.otpPreview,
  });
  assert.equal(adminUser.role, 'admin');
  assert.equal(getRoleHomeRoute(adminUser.role), '/admin');

  // Existing delivery partner phone -> routes to /delivery
  const delivChallenge = await requestMobileOtp('+919789422109');
  assert.equal(delivChallenge.isNewUser, false);
  const delivUser = await verifyMobileOtp({
    mobile: '9789422109',
    otp: delivChallenge.otpPreview,
  });
  assert.equal(delivUser.role, 'delivery');
  assert.equal(getRoleHomeRoute(delivUser.role), '/delivery');

  // New customer phone -> requires name, registers as customer, routes to /
  const newChallenge = await requestMobileOtp('9876543210');
  assert.equal(newChallenge.isNewUser, true);
  await assert.rejects(() =>
    verifyMobileOtp({ mobile: '9876543210', otp: newChallenge.otpPreview }),
  );
  const newUser = await verifyMobileOtp({
    mobile: '9876543210',
    otp: newChallenge.otpPreview,
    name: 'Kavitha R',
  });
  assert.equal(newUser.role, 'customer');
  assert.equal(newUser.name, 'Kavitha R');
  assert.equal(getRoleHomeRoute(newUser.role), '/');
});

test('geo utilities check configurable Karur delivery radius and build Google Maps nav links', async () => {
  const settings = await getDeliverySettings();
  assert.equal(settings.deliveryRadiusKm, 8);

  // Thanthonimalai (inside Karur 8km radius)
  const inside = checkServiceArea(10.9532, 78.0819, settings);
  assert.equal(inside.inServiceArea, true);
  assert.ok(inside.distanceKm < 2);

  // Trichy (outside Karur 8km radius)
  const outside = checkServiceArea(10.7905, 78.7047, settings);
  assert.equal(outside.inServiceArea, false);
  assert.ok(outside.distanceKm > 50);

  // Configurable admin radius shrinks zone dynamically
  const updated = await updateDeliverySettings({ deliveryRadiusKm: 1 });
  const nowOutside = checkServiceArea(10.9698, 78.0672, updated);
  assert.equal(nowOutside.inServiceArea, false);
  await updateDeliverySettings({ deliveryRadiusKm: 8 });

  assert.equal(
    buildGoogleMapsNavUrl(10.9532, 78.0819),
    'https://www.google.com/maps/dir/?api=1&destination=10.9532,78.0819',
  );
  assert.ok(calculateDistanceKm(10.9601, 78.0766, 10.9601, 78.0766) === 0);
});

test('per-user cart storage isolates carts by user, persists delivery slots, and exposes carts for admin view', async () => {
  const customer = await loginAsDemoRole('customer');
  await clearCart(customer.id);
  await addProductToCart('prod-aavin-milk-500ml', 2);
  const slotSummary = await setCartDeliverySlot('today_evening');
  assert.equal(slotSummary.deliverySlot, 'today_evening');

  // Switch to another user (e.g. newly registered customer) and add a different item
  const challenge = await requestMobileOtp('9876500011');
  const secondCustomer = await verifyMobileOtp({
    mobile: '9876500011',
    otp: challenge.otpPreview,
    name: 'Meena S',
  });
  await clearCart(secondCustomer.id);
  await addProductToCart('prod-tata-salt-1kg', 1);

  const allCarts = await getAllUserCarts();
  const firstEntry = allCarts.find((entry) => entry.userId === customer.id);
  const secondEntry = allCarts.find((entry) => entry.userId === secondCustomer.id);
  assert.ok(firstEntry, 'Expected first customer cart stored');
  assert.ok(secondEntry, 'Expected second customer cart stored');
  assert.equal(firstEntry.cart.deliverySlot, 'today_evening');
  assert.equal(firstEntry.cart.items[0].productId, 'prod-aavin-milk-500ml');
  assert.equal(secondEntry.cart.items[0].productId, 'prod-tata-salt-1kg');

  // Switch back to demo customer and confirm their cart is intact
  await loginAsDemoRole('customer');
  const restored = await getCart(customer.id);
  assert.equal(restored.items.length, 1);
  assert.equal(restored.items[0].quantity, 2);
  assert.equal(restored.deliverySlot, 'today_evening');
});

test('paymentService verifies success and failure, and paid checkout places order, reduces stock, and clears user cart', async () => {
  const customer = await loginAsDemoRole('customer');
  await clearCart(customer.id);

  const dalBefore = await getProductById('prod-toor-dal-1kg');
  assert.ok(dalBefore);
  const totalStockBefore = dalBefore.stockQty + dalBefore.reservedQty;

  await addProductToCart('prod-toor-dal-1kg', 3);
  const cartSummary = await setCartDeliverySlot('tomorrow_morning');
  assert.equal(cartSummary.deliverySlot, 'tomorrow_morning');

  const paymentOrder = await createPaymentOrder({
    amount: cartSummary.grandTotal,
    method: 'upi',
    userId: customer.id,
    customerName: customer.name,
    customerMobile: customer.mobile,
  });
  assert.match(paymentOrder.id, /^order_mock_/);
  assert.equal(paymentOrder.amountPaise, cartSummary.grandTotal * 100);

  // Simulated failure returns verified=false and does not create an order or clear cart
  const failed = await verifyPayment({
    paymentOrderId: paymentOrder.id,
    simulateSuccess: false,
  });
  assert.equal(failed.verified, false);
  assert.ok(failed.failureReason);

  const cartAfterFail = await getCart(customer.id);
  assert.equal(cartAfterFail.items.length, 1);

  // Simulated success returns verified=true with transactionRef
  const succeeded = await verifyPayment({
    paymentOrderId: paymentOrder.id,
    simulateSuccess: true,
  });
  assert.equal(succeeded.verified, true);
  assert.ok(succeeded.transactionRef);

  const order = await placeOrder({
    userId: customer.id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    address: MOCK_ADDRESSES[0],
    paymentMethod: 'upi',
    deliverySlot: cartSummary.deliverySlot,
    transactionRef: succeeded.transactionRef,
  });

  assert.equal(order.payment.status, 'paid');
  assert.equal(order.payment.transactionRef, succeeded.transactionRef);
  assert.equal(order.deliverySlot, 'tomorrow_morning');

  const dalAfter = await getProductById('prod-toor-dal-1kg');
  assert.ok(dalAfter);
  assert.equal(dalAfter.stockQty + dalAfter.reservedQty, totalStockBefore - 3);

  const cartAfterSuccess = await getCart(customer.id);
  assert.equal(cartAfterSuccess.items.length, 0);
});

test('order updates emit live events, record statusTimestamps, and reorder restores products and combos', async () => {
  const customer = await loginAsDemoRole('customer');
  await clearCart(customer.id);

  await addProductToCart('prod-toor-dal-1kg', 2);
  await addComboToCart('combo-individual', {
    'ci-ind-pepper': 'prod-aachi-pepper-100g',
  });

  let eventFiredCount = 0;
  const unsubscribe = subscribeToOrderUpdates(() => {
    eventFiredCount += 1;
  });

  const order = await placeOrder({
    userId: customer.id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    address: MOCK_ADDRESSES[0],
    paymentMethod: 'upi',
  });

  assert.ok(order.statusTimestamps?.placed);
  assert.ok(eventFiredCount >= 1);

  const countBeforePacked = eventFiredCount;
  const packed = await updateOrderStatus(order.id, 'packed');
  assert.ok(packed?.statusTimestamps?.packed);
  assert.ok(eventFiredCount > countBeforePacked);

  await assignDeliveryPartner(order.id, 'dp-1');
  const picked = await markOrderPickedUp(order.id);
  assert.ok(picked?.statusTimestamps?.picked_up);

  const transit = await markOrderOutForDelivery(order.id);
  assert.ok(transit?.statusTimestamps?.out_for_delivery);

  const delivered = await verifyDeliveryOtpAndComplete(
    order.id,
    order.deliveryAssignment?.deliveryOtp ?? '',
  );
  assert.equal(delivered.success, true);
  assert.ok(delivered.order?.statusTimestamps?.delivered);

  unsubscribe();

  // Reorder should restore both the Toor Dal (qty 2) and Individual Combo (with Aachi pepper selection!)
  await clearCart(customer.id);
  const reorderResult = await reorderOrder(order.id);
  assert.equal(reorderResult.addedLines, 2);
  assert.equal(reorderResult.skippedLines, 0);

  const cartSummary = await computeCartSummary(await getCart(customer.id));
  assert.equal(cartSummary.lines.length, 2);
  const comboLine = cartSummary.lines.find((l) => l.cartItem.kind === 'combo');
  assert.ok(comboLine);
  assert.equal(
    comboLine.cartItem.selectedBrandProductIds?.['ci-ind-pepper'],
    'prod-aachi-pepper-100g',
  );
});

test('QR generator utility builds permanent /shop URL, downloadable PNG data URL, and vector SVG', async () => {
  assert.equal(buildPublicShopUrl('https://karurfreshmart.in/'), 'https://karurfreshmart.in/shop');
  assert.equal(buildPublicShopUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000/shop');

  const targetUrl = buildPublicShopUrl('https://karurfreshmart.in');
  const pngDataUrl = await generateShopQrDataUrl(targetUrl, { width: 320 });
  assert.ok(pngDataUrl.startsWith('data:image/png;base64,'));
  assert.ok(pngDataUrl.length > 500);

  const svg = await generateShopQrSvg(targetUrl, { width: 240 });
  assert.ok(svg.includes('<svg') && svg.includes('</svg>'));
});

test('admin analytics compute KPIs, weekly series, low stock, top products, and cancelAndRefundOrder', async () => {
  const customer = await loginAsDemoRole('customer');
  await clearCart(customer.id);
  await addProductToCart('prod-aavin-milk-500ml', 3, undefined, undefined, customer.id);

  const milkBefore = (await getProductById('prod-aavin-milk-500ml'))!;
  const paidOrder = await placeOrder({
    userId: customer.id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    address: MOCK_ADDRESSES[0],
    paymentMethod: 'upi',
    transactionRef: 'UPI-ADMIN-TEST',
  });
  assert.equal(paidOrder.payment.status, 'paid');

  // Cancel & refund should restore stock and set payment status to refunded
  const refunded = await cancelAndRefundOrder(paidOrder.id, true);
  assert.equal(refunded?.status, 'cancelled');
  assert.equal(refunded?.payment.status, 'refunded');
  const milkAfter = (await getProductById('prod-aavin-milk-500ml'))!;
  assert.equal(
    milkAfter.stockQty + milkAfter.reservedQty,
    milkBefore.stockQty + milkBefore.reservedQty,
  );

  const [orders, products, userCarts] = await Promise.all([
    getOrders(),
    getProducts({ includeHidden: true }),
    getAllUserCarts(),
  ]);

  const stats = computeAdminDashboardStats(orders, userCarts, new Date('2026-11-15T12:00:00.000Z'));
  assert.ok(stats.todaysOrders >= 1);
  assert.ok(stats.totalRevenue >= 1597);

  const weekly = computeWeeklyOrdersSeries(orders, new Date('2026-11-15T12:00:00.000Z'));
  assert.equal(weekly.length, 7);
  assert.equal(weekly[6].isToday, true);
  assert.ok(weekly[6].ordersCount >= 1);

  const lowStock = computeLowStockProducts(products, 5);
  assert.ok(Array.isArray(lowStock));
  for (const item of lowStock) {
    assert.ok(item.stockQty + item.reservedQty <= 5);
  }

  const top = computeTopProducts(orders, products, 5);
  assert.ok(top.length >= 1);
  assert.ok(top[0].revenue >= top[top.length - 1].revenue);
});

test('live cart subscriptions notify listeners and saveUserCartReminder records per-user reminders', async () => {
  const challenge = await requestMobileOtp('9842200999');
  const customerB = await verifyMobileOtp({
    mobile: '9842200999',
    otp: challenge.otpPreview,
    name: 'Lakshmi Narayanan',
  });

  await clearCart(customerB.id);

  let cartUpdates = 0;
  const unsub = subscribeToCartUpdates(() => {
    cartUpdates += 1;
  });

  await addProductToCart('prod-ponni-rice-10kg', 1, undefined, undefined, customerB.id);
  assert.ok(cartUpdates >= 1);

  const users = await getRegisteredUsers();
  assert.ok(users.some((u) => u.id === customerB.id && u.name === 'Lakshmi Narayanan'));

  const beforeReminder = cartUpdates;
  await saveUserCartReminder(customerB.id);
  assert.ok(cartUpdates > beforeReminder);

  const reminders = await getCartReminders();
  assert.ok(reminders[customerB.id]);

  unsub();
});

test('stock import parser & bulk applier update existing SKUs, create new SKUs, and reject negative quantities', async () => {
  const existing = await getProducts({ includeHidden: true });
  const target = existing.find((p) => p.id === 'prod-ponni-rice-10kg');
  assert.ok(target);

  const preview = parseStockImportRows(
    [
      {
        sku: target.sku ?? 'KFM-101',
        name_en: target.name.en,
        pack_size: target.packSize,
        price: 695,
        mrp: 750,
        stock_qty: 88,
        reserved_qty: 2,
        visible_online: 'TRUE',
      },
      {
        sku: 'KFM-991',
        name_en: 'Karur Palm Jaggery',
        pack_size: '500 g',
        price: 110,
        mrp: 130,
        stock_qty: 30,
        reserved_qty: 0,
        visible_online: 'TRUE',
      },
      {
        sku: 'KFM-BAD',
        name_en: 'Invalid Negative Item',
        price: 50,
        stock_qty: -5,
      },
    ],
    existing,
  );

  assert.equal(preview.length, 3);
  assert.equal(preview[0].status, 'update');
  assert.equal(preview[1].status, 'create');
  assert.equal(preview[2].status, 'invalid');

  const applied = await applyBulkStockImport(preview);
  assert.equal(applied.updatedCount, 1);
  assert.equal(applied.createdCount, 1);

  const updatedPonni = await getProductById('prod-ponni-rice-10kg');
  assert.equal(updatedPonni?.stockQty, 88);
  assert.equal(updatedPonni?.price, 695);

  // Restore original Ponni price so earlier tests remain deterministic
  await applyBulkStockImport([
    {
      ...preview[0],
      nextPrice: target.price,
      nextMrp: target.mrp,
      nextStockQty: target.stockQty,
      nextReservedQty: target.reservedQty,
    },
  ]);
});

test('combo builder strictly locks customerCanRemoveItems=false and enforces customerCanChangeBrand', async () => {
  const individual = await getComboByType('individual');
  assert.ok(individual);

  // Force an attempted override to true -> saveCombo must lock it back to false
  const unsafeAttempt = {
    ...individual,
    price: 2499,
    customerCanChangeBrand: false,
    customerCanRemoveItems: true as unknown as false,
  };
  await saveCombo(unsafeAttempt);

  const reloaded = await getComboByType('individual');
  assert.ok(reloaded);
  assert.equal(reloaded.price, 2499);
  assert.equal(reloaded.customerCanRemoveItems, false);
  assert.equal(reloaded.customerCanChangeBrand, false);

  // Restore original Individual combo configuration
  await saveCombo({
    ...individual,
    customerCanRemoveItems: false,
    customerCanChangeBrand: true,
  });
});

test('offerService date-window validation handles active, expired, and future coupons & banners', async () => {
  assert.equal(isWithinOfferWindow('2026-01-01', '2099-12-31', new Date('2026-11-15')), true);
  assert.equal(isWithinOfferWindow('2025-01-01', '2025-12-31', new Date('2026-11-15')), false);
  assert.equal(isWithinOfferWindow('2099-01-01', '2099-12-31', new Date('2026-11-15')), false);

  await saveCoupon({
    code: 'EXPIRED99',
    description: { en: 'Expired test', ta: 'Expired test' },
    discountType: 'flat',
    discountValue: 99,
    minOrderAmount: 100,
    startDate: '2020-01-01',
    endDate: '2020-12-31',
    active: true,
  });
  const expiredCheck = await validateCoupon('EXPIRED99', 500);
  assert.equal(expiredCheck.valid, false);
  await deleteCoupon('EXPIRED99');

  await saveCoupon({
    code: 'KARUR75',
    description: { en: 'Active test coupon', ta: 'Active test coupon' },
    discountType: 'flat',
    discountValue: 75,
    minOrderAmount: 500,
    startDate: '2024-01-01',
    endDate: '2099-12-31',
    active: true,
  });
  const validCheck = await validateCoupon('KARUR75', 600);
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.discount, 75);
  await deleteCoupon('KARUR75');

  await saveBanner({
    id: 'banner-test-window',
    title: { en: 'Test Banner', ta: 'Test Banner' },
    subtitle: { en: 'Sub', ta: 'Sub' },
    ctaLabel: { en: 'Go', ta: 'Go' },
    ctaRoute: '/offers',
    tone: 'green',
    startDate: '2024-01-01',
    endDate: '2099-12-31',
    active: true,
  });
  const activeBanners = await getBanners(true);
  assert.ok(activeBanners.some((b) => b.id === 'banner-test-window'));
  await deleteBanner('banner-test-window');
});

test('delivery staff creation, stats computation, settings fee/threshold impact, role updates, and payment refunds work cleanly', async () => {
  const newPartner = await addDeliveryPartner({
    name: 'Prakash V',
    mobile: '9842299887',
    vehicleNumber: 'tn 47 xy 4321',
    zone: 'Vengamedu',
  });
  assert.equal(newPartner.vehicleNumber, 'TN 47 XY 4321');
  const partners = await getDeliveryPartners();
  assert.ok(partners.some((p) => p.id === newPartner.id));

  // Verify user registered as delivery and role can be updated
  const usersBefore = await getRegisteredUsers();
  const createdUser = usersBefore.find((u) => u.mobile === '9842299887');
  assert.ok(createdUser);
  assert.equal(createdUser.role, 'delivery');

  await updateUserRole(createdUser.id, 'admin');
  const usersAfter = await getRegisteredUsers();
  assert.equal(usersAfter.find((u) => u.id === createdUser.id)?.role, 'admin');

  // Dynamic settings affect cart fee & threshold
  const customer = await loginAsDemoRole('customer');
  await clearCart(customer.id);
  await addProductToCart('prod-aavin-milk-500ml', 1, undefined, undefined, customer.id);

  await updateDeliverySettings({
    deliveryFeeInr: 40,
    freeDeliveryThresholdInr: 799,
    storeOpenTime: '06:00',
    storeCloseTime: '22:30',
    enabledSlots: ['45min', 'today_evening'],
  });

  const cartSummary = await getCartSummary(customer.id);
  assert.equal(cartSummary.deliveryFee, 40);
  assert.equal(cartSummary.freeDeliveryThreshold, 799);

  // Place paid order, verify partner stats & refundOrderPayment
  const paidOrder = await placeOrder({
    userId: customer.id,
    customerName: customer.name,
    customerMobile: customer.mobile,
    address: MOCK_ADDRESSES[0],
    paymentMethod: 'upi',
    transactionRef: 'UPI-REFUND-TEST',
  });
  await assignDeliveryPartner(paidOrder.id, newPartner.id);
  const allOrders = await getOrders();
  const partnerStats = computeDeliveryPartnerStats(newPartner.id, allOrders);
  assert.equal(partnerStats.activeDrops, 1);

  const refundedOrder = await refundOrderPayment(paidOrder.id);
  assert.equal(refundedOrder?.payment.status, 'refunded');

  // Restore defaults
  await updateDeliverySettings({
    deliveryFeeInr: STANDARD_DELIVERY_FEE_INR,
    freeDeliveryThresholdInr: FREE_DELIVERY_THRESHOLD_INR,
    enabledSlots: ['45min', 'today_evening', 'tomorrow_morning'],
  });
});







