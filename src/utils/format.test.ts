import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscountPercent, formatINR } from './format';

test('formatINR formats Indian Rupees with Indian number grouping', () => {
  assert.equal(formatINR(0), '₹0');
  assert.equal(formatINR(450), '₹450');
  assert.equal(formatINR(6890), '₹6,890');
  assert.equal(formatINR(125000), '₹1,25,000');
  assert.equal(formatINR(-50), '-₹50');
});

test('calculateDiscountPercent computes whole-percentage discounts accurately', () => {
  assert.equal(calculateDiscountPercent(420, 365), 13);
  assert.equal(calculateDiscountPercent(200, 150), 25);
  assert.equal(calculateDiscountPercent(100, 100), 0);
  assert.equal(calculateDiscountPercent(0, 50), 0);
});
