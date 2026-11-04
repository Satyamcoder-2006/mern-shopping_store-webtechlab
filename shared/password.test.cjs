const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('./password.cjs');

test('password hashes use a fresh salt and accept only the matching password', async () => {
  const first = await hashPassword('test-password');
  const second = await hashPassword('test-password');
  assert.notEqual(first, second);
  assert.notEqual(first, 'test-password');
  assert.equal(await verifyPassword('test-password', first), true);
  assert.equal(await verifyPassword('incorrect-password', first), false);
});

test('malformed hashes and non-string credentials are rejected', async () => {
  assert.equal(await verifyPassword('test', 'scrypt:invalid:bad'), false);
  assert.equal(await verifyPassword(null, 'invalid'), false);
});
