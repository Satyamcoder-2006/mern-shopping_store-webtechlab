import sharp from 'sharp';
// Live Atlas checks use only uniquely named disposable records, removed in finally.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const suffix = randomUUID().slice(0, 12), pass = randomUUID();
let child, db, port, logs = '', checks = 0;
const userIds = [], productIds = [], couponCode = `CHECK_${suffix.toUpperCase()}`;
class Client {
  cookie = ''; csrf = '';
  async request(method, endpoint, body, options = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${endpoint}`, { method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}), ...(this.csrf && !options.noCsrf ? { 'X-CSRF-Token': this.csrf } : {}), ...options.headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    const cookie = res.headers.getSetCookie?.()[0]; if (cookie) this.cookie = cookie.split(';')[0];
    const data = await res.json(); if (data.csrfToken) this.csrf = data.csrfToken;
    return { status: res.status, data, cookie: cookie || '' };
  }
}
const expect = (response, status, label) => { assert.equal(response.status, status, `${label}: ${JSON.stringify(response.data)}`); checks++; return response.data; };
const signup = async (client, kind) => {
  const emailId = `forme-check-${kind}-${suffix}@example.com`;
  const result = await client.request('POST', '/api/users', { username: `Check ${kind}`, emailId, age: 22, password: pass, role: 'admin' });
  const data = expect(result, 201, 'registration'); userIds.push(data.user.id);
  assert.equal(data.user.role, 'customer');
  assert.ok(result.cookie.includes('HttpOnly') && result.cookie.includes('SameSite=Strict'));
  assert.ok(!data.token && !data.password);
  return data.user;
};
try {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'shopDB', serverSelectionTimeoutMS: 15000 }); db = mongoose.connection.db;
  await db.command({ ping: 1 });
  port = 3000; // Verify the shared local server; never start a second website.
  let databaseAvailable = false;
  for (let i = 0; i < 100; i++) {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (health.ok) { databaseAvailable = true; break; }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.ok(databaseAvailable, 'Atlas did not become ready. Check Atlas Network Access.');
  const guest = new Client(), customer = new Client(), admin = new Client(), stranger = new Client();
  expect(await guest.request('GET', '/api/health'), 200, 'health');
  const catalogue = expect(await guest.request('GET', '/api/products'), 200, 'public clothing catalogue');
  assert.ok(catalogue.length >= 8 && catalogue.every(p => ['Tops', 'Bottoms', 'Layers', 'Sets'].includes(p.category)));
  expect(await guest.request('GET', '/api/admin/dashboard'), 401, 'guest admin denied');
  expect(await guest.request('GET', '/api/orders'), 401, 'guest orders denied');
  expect(await guest.request('POST', '/api/users', { username: 'Test', emailId: 'valid@example.com', age: 22, password: '1234' }), 400, 'weak password denied');
  const u = await signup(customer, 'customer'), a = await signup(admin, 'admin'), other = await signup(stranger, 'other');
  const stored = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(u.id) });
  assert.ok(stored.password.startsWith('scrypt:') && stored.password !== pass);
  expect(await customer.request('GET', '/api/admin/products'), 403, 'role escalation denied');
  expect(await customer.request('PATCH', '/api/users/me', { username: 'Changed' }, { noCsrf: true }), 403, 'CSRF required');
  expect(await customer.request('PATCH', '/api/users/me', { username: 'Changed' }, { headers: { 'X-CSRF-Token': 'é'.repeat(64) } }), 403, 'malformed CSRF denied');
  expect(await customer.request('PATCH', '/api/users/me', { username: 'Changed' }, { headers: { Origin: 'https://attacker.example' } }), 403, 'cross-origin denied');
  expect(await customer.request('PATCH', `/api/users?emailId=${other.emailId}`, { username: 'Intruder' }), 403, 'profile IDOR denied');
  const profile = expect(await customer.request('GET', '/api/users/me'), 200, 'own profile'); assert.ok(!profile.password);
  // Test-only elevation uses the database, exactly as the owner setup command does.
  await db.collection('users').updateOne({ _id: new mongoose.Types.ObjectId(a.id) }, { $set: { role: 'admin' } });
  expect(await admin.request('GET', '/api/admin/dashboard'), 200, 'admin allowed');
  const product = { productName: `Verification ${suffix}`, productPrice: 1050, originalPrice: 1500, category: 'Tops', gender: 'Unisex', color: 'Test', description: 'A disposable product used only for transactional verification.', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab', variants: ['XS', 'S', 'M', 'L', 'XL'].map(size => ({ size, stock: size === 'M' ? 1 : 0 })), active: true, featured: false };
  expect(await admin.request('POST', '/api/admin/products', { ...product, productPrice: -1 }), 400, 'invalid price denied');
  const p = expect(await admin.request('POST', '/api/admin/products', product), 201, 'product creation'); productIds.push(p.productId);
  // Community, media, size guidance, injection prevention and session contracts.
  expect(await guest.request('POST', '/api/login', { emailId: { $ne: null }, password: pass }), 400, 'Mongo operator injection blocked');
  expect(await customer.request('PATCH', '/api/users/me', JSON.parse('{"__proto__":{"role":"admin"}}')), 400, 'prototype injection blocked');
  expect(await customer.request('PUT', '/api/users/me', { username: 'Check customer', age: 22 }), 200, 'complete profile update');
  expect(await customer.request('PATCH', '/api/users/me', { age: 23 }), 200, 'partial profile update');
  const profileSessions = expect(await customer.request('GET', '/api/users/me/sessions'), 200, 'profile update session list'); assert.equal(profileSessions.length, 1); checks++;
  const sizing = expect(await guest.request('POST', '/api/size-recommendation', { productId: p.productId, height: 175, weight: 70, waist: 83, shoulder: 43, chest: 100, fit: 'regular' }), 200, 'size estimate');
  assert.equal(sizing.size, 'M'); assert.equal(sizing.available, true); checks++;
  expect(await guest.request('POST', '/api/size-recommendation', { productId: p.productId, height: 175, weight: 70, waist: -1, shoulder: 43, fit: 'regular' }), 400, 'invalid measurements blocked');
  const fixture = async color => 'data:image/png;base64,' + (await sharp({ create: { width: 160, height: 200, channels: 3, background: color } }).png().toBuffer()).toString('base64');
  const photoInputs = [await fixture('#aa6655'), await fixture('#557788')];
  expect(await guest.request('POST', '/api/media', { images: photoInputs }), 401, 'anonymous upload denied');
  expect(await customer.request('POST', '/api/media', { images: photoInputs }, { noCsrf: true }), 403, 'upload CSRF enforced');
  expect(await customer.request('POST', '/api/media', { images: ['data:image/svg+xml;base64,PHN2Zy8+'] }), 400, 'SVG upload denied');
  expect(await customer.request('POST', '/api/media', { images: ['data:image/png;base64,YmFk'] }), 400, 'corrupt photo rejected as validation error');
  const media = expect(await customer.request('POST', '/api/media', { images: photoInputs }), 201, 'compressed photos upload');
  const mediaDocs = await db.collection('media').find({ ownerId: new mongoose.Types.ObjectId(u.id) }).toArray();
  assert.ok(mediaDocs.length === 2 && mediaDocs.every(m => m.bytes <= 250 * 1024 && m.data?.length() === m.bytes && m.contentType === 'image/webp')); checks++;
  const draftImage = await fetch(`http://127.0.0.1:${port}${media.images[0]}`); assert.equal(draftImage.status, 404); checks++;
  const postBody = { title: 'Disposable outfit vote', caption: 'Verification only', publicConsent: true, looks: media.images.map((image, i) => ({ image, label: 'Look ' + (i + 1) })) };
  expect(await customer.request('POST', '/api/faceoffs', { ...postBody, publicConsent: false }), 400, 'public photo consent enforced');
  const post = expect(await customer.request('POST', '/api/faceoffs', postBody), 201, 'outfit face-off created');
  expect(await stranger.request('POST', '/api/faceoffs', postBody), 403, 'another user cannot claim photos');
  const publishedImage = await fetch(`http://127.0.0.1:${port}${media.images[0]}`); assert.equal(publishedImage.status, 200); assert.ok(publishedImage.headers.get('content-type').includes('webp')); checks++;
  expect(await customer.request('PUT', `/api/faceoffs/${post.id}/vote`, { option: 0 }), 400, 'own vote denied');
  expect(await guest.request('PUT', `/api/faceoffs/${post.id}/vote`, { option: 0 }), 401, 'anonymous vote denied');
  expect(await stranger.request('PUT', `/api/faceoffs/${post.id}/vote`, { option: 2 }), 400, 'nonexistent look denied');
  expect(await stranger.request('PUT', `/api/faceoffs/${post.id}/vote`, { option: 0 }), 200, 'vote created');
  expect(await stranger.request('PUT', `/api/faceoffs/${post.id}/vote`, { option: 0 }), 200, 'duplicate vote does not add count');
  expect(await stranger.request('PUT', `/api/faceoffs/${post.id}/vote`, { option: 1 }), 200, 'vote can change');
  assert.equal(await db.collection('votes').countDocuments({ faceoffId: new mongoose.Types.ObjectId(post.id) }), 1); checks++;
  const feed = expect(await stranger.request('GET', '/api/faceoffs'), 200, 'community feed');
  const entry = feed.posts.find(f => f._id === post.id); assert.deepEqual(entry.counts, [0,1]); assert.equal(entry.myVote, 1); assert.ok(!entry.emailId && !entry.userId); checks++;
  expect(await stranger.request('DELETE', `/api/faceoffs/${post.id}`), 404, 'post deletion ownership');
  expect(await customer.request('GET', '/api/admin/community'), 403, 'customer moderation denied');
  expect(await admin.request('GET', '/api/admin/community'), 200, 'admin moderation allowed');
  const reviewMedia = expect(await customer.request('POST', '/api/media', { images: [photoInputs[0]] }), 201, 'review photo upload');
  const reviewBody = { rating: 5, text: 'A disposable review for verification.', images: reviewMedia.images };
  expect(await customer.request('PUT', `/api/products/${p.productId}/reviews/me`, { ...reviewBody, rating: 9 }), 400, 'invalid rating blocked');
  const savedReview = expect(await customer.request('PUT', `/api/products/${p.productId}/reviews/me`, reviewBody), 200, 'review saved');
  expect(await customer.request('PUT', `/api/products/${p.productId}/reviews/me`, { ...reviewBody, rating: 4 }), 200, 'review updated');
  assert.equal(await db.collection('reviews').countDocuments({ userId: new mongoose.Types.ObjectId(u.id), productId: p.productId }), 1); checks++;
  const reviews = expect(await guest.request('GET', `/api/products/${p.productId}/reviews`), 200, 'public reviews');
  assert.equal(reviews.count, 1); assert.equal(reviews.average, 4); assert.equal(reviews.reviews[0].verifiedPurchase, false); checks++;
  expect(await stranger.request('DELETE', `/api/products/${p.productId}/reviews/me`), 404, 'review deletion ownership');
  expect(await customer.request('GET', '/api/users/me/dashboard'), 200, 'member dashboard');
  const loginSessions = [];
  for (let i = 0; i < 4; i++) { const client = new Client(); expect(await client.request('POST', '/api/login', { emailId: other.emailId, password: pass }), 200, 'new session login'); loginSessions.push(client); }
  expect(await loginSessions[0].request('GET', '/api/session'), 401, 'fourth login ends oldest session');
  stranger.cookie = loginSessions[3].cookie; stranger.csrf = loginSessions[3].csrf;
  const sessions = expect(await stranger.request('GET', '/api/users/me/sessions'), 200, 'session listing'); assert.equal(sessions.length, 3); assert.equal(sessions.filter(s => s.current).length, 1); checks++;
  const revoke = sessions.find(s => !s.current);
  expect(await stranger.request('DELETE', `/api/users/me/sessions/${revoke.id}`), 200, 'session revoked');
  expect(await loginSessions[1].request('GET', '/api/session'), 401, 'revoked session cannot authenticate');
  expect(await admin.request('PUT', `/api/admin/products/${p.productId}`, { ...product, revision: 999 }), 409, 'stale inventory rejected');
  expect(await customer.request('PUT', `/api/admin/products/${p.productId}`, { ...product, revision: 0 }), 403, 'customer inventory mutation denied');
  const coupon = expect(await admin.request('POST', '/api/admin/coupons', { code: couponCode, type: 'percent', value: 10, minSpend: 1000, maxDiscount: 200, usageLimit: 1, expiresAt: new Date(Date.now() + 86400000).toISOString() }), 201, 'coupon creation');
  const cart = { items: [{ productId: p.productId, size: 'M', quantity: 1, unitPrice: 1 }], couponCode, total: 1 };
  const quote = expect(await customer.request('POST', '/api/checkout/quote', cart), 200, 'server quote');
  assert.equal(quote.subtotal, 1050); assert.equal(quote.discount, 105); assert.equal(quote.total, 1044);
  const address = { fullName: 'Test Person', phone: '9876543210', line1: '12 Verification Street', city: 'Chennai', state: 'Tamil Nadu', pinCode: '600001' };
  const orderBody = { ...cart, address, paymentMethod: 'cod', requestId: randomUUID() };
  const first = expect(await customer.request('POST', '/api/orders', orderBody), 201, 'order creation'); assert.equal(first.total, 1044);
  const duplicate = expect(await customer.request('POST', '/api/orders', orderBody), 201, 'idempotent retry'); assert.equal(first.orderId, duplicate.orderId);
  assert.equal((await db.collection('products').findOne({ productId: p.productId })).quantity, 0);
  expect(await stranger.request('POST', '/api/orders', { ...orderBody, requestId: randomUUID() }), 409, 'oversell denied');
  expect(await stranger.request('PATCH', `/api/orders/${first.orderId}/cancel`, {}), 404, 'order IDOR denied');
  expect(await customer.request('PATCH', `/api/orders/${first.orderId}/cancel`, {}), 200, 'customer cancellation');
  expect(await customer.request('PATCH', `/api/orders/${first.orderId}/cancel`, {}), 200, 'idempotent cancellation');
  assert.equal((await db.collection('products').findOne({ productId: p.productId })).quantity, 1);
  assert.equal((await db.collection('coupons').findOne({ code: couponCode })).usedCount, 0);
  const second = expect(await customer.request('POST', '/api/orders', { ...orderBody, requestId: randomUUID() }), 201, 'released coupon and stock reused');
  expect(await customer.request('PATCH', `/api/admin/orders/${second.orderId}`, { status: 'Delivered' }), 403, 'customer cannot fulfil');
  expect(await admin.request('PATCH', `/api/admin/orders/${second.orderId}`, { status: 'Delivered' }), 409, 'status skipping denied');
  for (const status of ['Processing', 'Shipped', 'Delivered']) {
    expect(await admin.request('PATCH', `/api/admin/orders/${second.orderId}`, { status }), 200, `order ${status}`);
    if (status === 'Shipped') expect(await customer.request('DELETE', '/api/users/me', { currentPassword: pass }), 409, 'in-transit account closure blocked');
  }
  const verifiedReview = expect(await customer.request('PUT', `/api/products/${p.productId}/reviews/me`, reviewBody), 200, 'review after delivered purchase');
  assert.equal(verifiedReview.review.verifiedPurchase, true); checks++;
  expect(await customer.request('PATCH', `/api/orders/${second.orderId}/cancel`, {}), 409, 'delivered cancellation denied');
  const metrics = expect(await admin.request('GET', '/api/admin/dashboard'), 200, 'earnings'); assert.ok(metrics.earnings >= 1044);
  const another = catalogue.find(p => p.quantity > 0);
  expect(await customer.request('POST', '/api/checkout/quote', { items: [{ productId: another.productId, size: 'M', quantity: 1 }], couponCode }), 400, 'coupon reuse denied');
  const customers = expect(await admin.request('GET', '/api/admin/customers'), 200, 'customer reporting');
  assert.equal(customers.find(c => c.emailId === u.emailId).orderCount, 1);
  assert.ok(customers.every(c => !c.password));
  const beforeRace = await db.collection('products').findOne({ productId: p.productId });
  expect(await admin.request('PUT', `/api/admin/products/${p.productId}`, { ...product, revision: beforeRace.revision }), 200, 'restock for concurrency check');
  const competingBody = { items: cart.items, address, paymentMethod: 'cod' };
  const competing = await Promise.all([
    customer.request('POST', '/api/orders', { ...competingBody, requestId: randomUUID() }),
    stranger.request('POST', '/api/orders', { ...competingBody, requestId: randomUUID() }),
  ]);
  assert.deepEqual(competing.map(r => r.status).sort(), [201, 409]); checks++;
  const winner = competing.find(r => r.status === 201).data;
  assert.equal((await db.collection('products').findOne({ productId: p.productId })).quantity, 0);
  expect(await admin.request('PATCH', `/api/admin/orders/${winner.orderId}`, { status: 'Cancelled' }), 200, 'race winner cancellation restores stock');
  const repeatBody = { ...competingBody, requestId: randomUUID() };
  const retries = await Promise.all([customer.request('POST', '/api/orders', repeatBody), customer.request('POST', '/api/orders', repeatBody)]);
  for (const retry of retries) expect(retry, 201, 'concurrent idempotent request');
  assert.equal(retries[0].data.orderId, retries[1].data.orderId);
  const latest = await db.collection('products').findOne({ productId: p.productId });
  expect(await admin.request('DELETE', `/api/admin/products/${p.productId}`, { revision: latest.revision }), 200, 'archive');
  expect(await guest.request('GET', `/api/products/${p.productId}`), 404, 'archived product hidden');
  expect(await admin.request('PATCH', `/api/admin/coupons/${coupon._id}`, { active: false }), 200, 'pause coupon');
  const oldSession = new Client(); oldSession.cookie = customer.cookie; oldSession.csrf = customer.csrf;
  expect(await customer.request('PATCH', '/api/users/me', { password: 'new-secure-pass', currentPassword: 'incorrect' }), 403, 'old password required');
  expect(await customer.request('PATCH', '/api/users/me', { password: 'new-secure-pass', currentPassword: pass }), 200, 'password update');
  expect(await oldSession.request('GET', '/api/session'), 401, 'old session revoked');
  expect(await customer.request('DELETE', '/api/users/me', { currentPassword: 'incorrect' }), 403, 'deletion password required');
  expect(await customer.request('DELETE', '/api/users/me', { currentPassword: 'new-secure-pass' }), 200, 'account deletion');
  expect(await oldSession.request('GET', '/api/orders'), 401, 'deleted account session denied');
  assert.equal(await db.collection('faceoffs').countDocuments({ userId: new mongoose.Types.ObjectId(u.id) }), 0);
  assert.equal(await db.collection('reviews').countDocuments({ userId: new mongoose.Types.ObjectId(u.id) }), 0);
  assert.equal(await db.collection('media').countDocuments({ ownerId: new mongoose.Types.ObjectId(u.id) }), 0);
  assert.equal(await db.collection('votes').countDocuments({ faceoffId: new mongoose.Types.ObjectId(post.id) }), 0); checks += 4;
  const anonymized = await db.collection('orders').find({ 'items.productId': p.productId, customerName: 'Deleted customer' }).toArray();
  assert.ok(anonymized.length > 0 && anonymized.every(o => !o.emailId && !o.address && String(o.userId) !== u.id)); checks++;
  const erasedImage = await fetch(`http://127.0.0.1:${port}${media.images[0]}`); assert.equal(erasedImage.status, 404); checks++;

  expect(await guest.request('POST', '/api/seed', {}), 404, 'unsafe legacy seed endpoint removed');
  expect(await guest.request('POST', '/api/products/clear', {}), 404, 'unsafe legacy clear endpoint removed');
  let limited = false;
  for (let i = 0; i < 31; i++) { const result = await guest.request('POST', '/api/login', { emailId: 'invalid', password: 'x' }); if (result.status === 429) { limited = true; break; } }
  assert.equal(limited, true, 'brute-force authentication rate limit'); checks++;
  console.log(`PASS: ${checks} live API checks. Clothing migration, HttpOnly sessions, CSRF, role checks, ownership, server pricing, coupon limits, atomic stock, idempotency, fulfilment, earnings, inventory revisions, and account deletion verified.`);
} catch (error) {
  console.error('FAIL: ' + (error.name === 'AssertionError' ? error.message : error.message?.startsWith('Verification') ? error.message : error.name));
  process.exitCode = 1;
} finally {
  if (db) {
    const ids = userIds.map(id => new mongoose.Types.ObjectId(id));
    if (ids.length) { await db.collection('orders').deleteMany({ userId: { $in: ids } }); await db.collection('users').deleteMany({ _id: { $in: ids } }); }
    if (productIds.length) await db.collection('orders').deleteMany({ 'items.productId': { $in: productIds } });
    if (ids.length) {
      const posts = await db.collection('faceoffs').find({ userId: { $in: ids } }).toArray();
      await db.collection('votes').deleteMany({ $or: [{ userId: { $in: ids } }, { faceoffId: { $in: posts.map(p => p._id) } }] });
      await db.collection('faceoffs').deleteMany({ userId: { $in: ids } });
      await db.collection('reviews').deleteMany({ userId: { $in: ids } });
      await db.collection('media').deleteMany({ ownerId: { $in: ids } });
    }
    if (productIds.length) await db.collection('products').deleteMany({ productId: { $in: productIds } });
    await db.collection('coupons').deleteOne({ code: couponCode });
  }
  await mongoose.disconnect();
  if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
  console.log('Disposable verification users, orders, products, and coupons cleaned up.');
}
