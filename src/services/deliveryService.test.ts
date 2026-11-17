import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeliveryDashboardSummary,
  computeOrderPayoutInr,
  getAssignedDeliveries,
  getDeliveryOrderChecklist,
  getDeliveryPartners,
  getOrderById,
  markOrderOutForDelivery,
  markOrderPickedUp,
  resolvePartnerForUser,
  subscribeToDeliveryPartnerUpdates,
  subscribeToOrderUpdates,
  toggleDeliveryChecklistItem,
  togglePartnerDutyStatus,
  verifyDeliveryOtpAndComplete,
} from './index';
import { buildGoogleMapsNavUrl } from '../utils/geo';

test('resolvePartnerForUser resolves Karthikeyan R by userId or mobile', async () => {
  const partners = await getDeliveryPartners();
  const byId = resolvePartnerForUser('user-deliv-1', undefined, partners);
  assert.equal(byId?.id, 'dp-1');
  assert.equal(byId?.name, 'Karthikeyan R');

  const byMobile = resolvePartnerForUser(undefined, '+91 9789422109', partners);
  assert.equal(byMobile?.id, 'dp-1');
});

test('togglePartnerDutyStatus toggles availability and notifies subscribers', async () => {
  let notified = 0;
  const unsub = subscribeToDeliveryPartnerUpdates(() => {
    notified += 1;
  });

  const offList = await togglePartnerDutyStatus('dp-1', false);
  const offPartner = offList.find((p) => p.id === 'dp-1');
  assert.equal(offPartner?.isAvailable, false);
  assert.equal(notified, 1);

  const onList = await togglePartnerDutyStatus('dp-1', true);
  const onPartner = onList.find((p) => p.id === 'dp-1');
  assert.equal(onPartner?.isAvailable, true);
  assert.equal(notified, 2);

  unsub();
});

test('computeDeliveryDashboardSummary accurately computes today, pending, earnings & COD', async () => {
  const assigned = await getAssignedDeliveries('dp-1');
  const summary = computeDeliveryDashboardSummary(
    'dp-1',
    assigned,
    new Date('2026-11-15T10:00:00.000Z'),
  );

  assert.equal(summary.pendingCount, 2); // KFM-1043 (packed) & KFM-1042 (out_for_delivery)
  assert.equal(summary.readyToPickUpCount, 1);
  assert.equal(summary.outForDeliveryCount, 1);
  assert.equal(summary.completedCount, 1); // KFM-1041
  assert.equal(summary.totalEarningsInr, computeOrderPayoutInr(assigned.find((o) => o.id === 'KFM-1041')!));
  assert.equal(summary.codCollectedToSettleInr, 507);
});

test('delivery checklist toggles items persistently per order', () => {
  const before = getDeliveryOrderChecklist('KFM-1043');
  assert.deepEqual(before, []);

  const afterAdd = toggleDeliveryChecklistItem('KFM-1043', 'oi-5');
  assert.deepEqual(afterAdd, ['oi-5']);

  const afterSecond = toggleDeliveryChecklistItem('KFM-1043', 'oi-6');
  assert.deepEqual(afterSecond, ['oi-5', 'oi-6']);

  const afterRemove = toggleDeliveryChecklistItem('KFM-1043', 'oi-5');
  assert.deepEqual(afterRemove, ['oi-6']);
});

test('Google Maps navigation link uses saved latitude and longitude', async () => {
  const order = await getOrderById('KFM-1043');
  assert.ok(order);
  const url = buildGoogleMapsNavUrl(order.address.lat, order.address.lng);
  assert.match(
    url,
    /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=10\.\d+,78\.\d+$/,
  );
});

test('markOrderPickedUp writes pickedUpAt & transitions to picked_up; OTP completion requires exact match and updates tracking', async () => {
  let orderEvents = 0;
  const unsub = subscribeToOrderUpdates(() => {
    orderEvents += 1;
  });

  const pickedUp = await markOrderPickedUp('KFM-1043');
  assert.ok(pickedUp);
  assert.equal(pickedUp.status, 'picked_up');
  assert.ok(pickedUp.deliveryAssignment?.pickedUpAt);
  assert.ok(pickedUp.statusTimestamps?.picked_up);

  const outForDeliv = await markOrderOutForDelivery('KFM-1043');
  assert.equal(outForDeliv?.status, 'out_for_delivery');

  // Wrong OTP must fail and keep order open
  const wrongResult = await verifyDeliveryOtpAndComplete('KFM-1043', '0000');
  assert.equal(wrongResult.success, false);
  assert.ok(wrongResult.error);

  const stillOpen = await getOrderById('KFM-1043');
  assert.equal(stillOpen?.status, 'out_for_delivery');
  assert.equal(stillOpen?.deliveryAssignment?.deliveredAt, undefined);
  assert.equal(stillOpen?.payment.status, 'pending');

  // Matching OTP completes delivery, records deliveredAt, marks COD paid, and emits live update
  const okResult = await verifyDeliveryOtpAndComplete('KFM-1043', '6192');
  assert.equal(okResult.success, true);
  assert.equal(okResult.order?.status, 'delivered');
  assert.ok(okResult.order?.deliveryAssignment?.deliveredAt);
  assert.equal(okResult.order?.deliveryAssignment?.otpVerified, true);
  assert.equal(okResult.order?.payment.status, 'paid');
  assert.ok(orderEvents >= 3);

  unsub();
});
