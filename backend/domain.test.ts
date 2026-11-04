import test from 'node:test';
import assert from 'node:assert/strict';
import { totals, productInput, shippingInput, couponInput, password } from './domain.ts';
import { CATALOG } from './catalog.ts';
test('server calculates capped coupon discounts and shipping with whole rupees', () => {
  const coupon = { type: 'percent', value: 10, minSpend: 0, maxDiscount: 150, usageLimit: 100, usedCount: 0, active: true, expiresAt: new Date(Date.now() + 86400000) };
  assert.deepEqual(totals(2500, coupon), { subtotal: 2500, discount: 150, delivery: 0, total: 2350 });
  assert.equal(totals(890).total, 989);
  assert.equal(totals(500, { ...coupon, type: 'fixed', value: 999 }).discount, 150);
  assert.equal(totals(500, { ...coupon, type: 'fixed', value: 999, maxDiscount: 0 }).total, 99);
});
test('expired, exhausted and ineligible coupons are rejected', () => {
  const valid = { type: 'percent', value: 10, minSpend: 0, maxDiscount: 0, usageLimit: 1, usedCount: 0, active: true, expiresAt: new Date(Date.now() + 86400000) };
  assert.throws(() => totals(1000, { ...valid, expiresAt: new Date(0) }));
  assert.throws(() => totals(1000, { ...valid, usedCount: 1 }));
  assert.throws(() => totals(1000, { ...valid, minSpend: 1500 }));
  assert.throws(() => totals(1000, { ...valid, active: false }));
});
test('product validation derives total stock and rejects negative, duplicate or missing sizes', () => {
  const p = productInput(CATALOG[0]); assert.equal(p.quantity, 40);
  assert.throws(() => productInput({ ...CATALOG[0], variants: [{ size: 'XS', stock: 2 }] }));
  assert.throws(() => productInput({ ...CATALOG[0], variants: CATALOG[0].variants.map(v => ({ ...v, stock: -1 })) }));
  assert.throws(() => productInput({ ...CATALOG[0], variants: CATALOG[0].variants.map(v => ({ ...v, size: 'XS' })) }));
  assert.throws(() => productInput({ ...CATALOG[0], image: 'javascript:alert(1)' }));
  assert.throws(() => productInput({ ...CATALOG[0], category: 'Electronics' }));
  assert.throws(() => productInput({ ...CATALOG[0], productPrice: 9.99 }));
});
test('checkout validates Indian shipping details and strong password bounds', () => {
  const a = { fullName: 'Test Customer', phone: '9876543210', line1: '12 Test Street', city: 'Chennai', state: 'Tamil Nadu', pinCode: '600001' };
  assert.equal(shippingInput(a).pinCode, '600001');
  assert.throws(() => shippingInput({ ...a, phone: '123' }));
  assert.throws(() => shippingInput({ ...a, pinCode: '000000' }));
  assert.throws(() => password('1234')); assert.throws(() => password('x'.repeat(129)));
  assert.equal(password('secure-password'), 'secure-password');
});
test('admin coupon input is constrained and code normalized', () => {
  const c = { code: 'new10', type: 'percent', value: 10, usageLimit: 50, expiresAt: new Date(Date.now() + 86400000).toISOString() };
  assert.equal(couponInput(c).code, 'NEW10');
  assert.throws(() => couponInput({ ...c, value: 110 }));
  assert.throws(() => couponInput({ ...c, expiresAt: 'invalid' }));
});
