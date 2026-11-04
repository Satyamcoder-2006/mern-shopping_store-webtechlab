import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { recommendSize, MEASUREMENT_FIELDS, measurementMessage } from '../shared/sizing.ts';
import { suggestOutfits } from '../shared/outfits.ts';
import { compressImage } from './media.ts';
import { rejectOperators } from './validation.ts';
import { MediaModel } from './models.ts';
const measurements = { height: 175, weight: 70, waist: 83, shoulder: 43, chest: 100, fit: 'regular' as const };
test('size suggestions prioritize measurements, show stock honestly and explain uncertainty', () => {
  const result = recommendSize(measurements, 'Tops', [{ size: 'M', stock: 0 }, { size: 'L', stock: 9 }]);
  assert.equal(result.size, 'M'); assert.equal(result.available, false);
  assert.equal(recommendSize({ ...measurements, weight: 90 }, 'Tops').size, 'M');
  assert.equal(recommendSize({ ...measurements, fit: 'relaxed' }, 'Tops').size, 'L');
  assert.equal(recommendSize({ ...measurements, waist: 160 }, 'Bottoms').size, null);
  assert.ok(recommendSize({ ...measurements, chest: undefined }, 'Tops').notes.some(s => s.includes('chest')));
  assert.throws(() => recommendSize({ ...measurements, waist: -1 }, 'Tops'));
});
test('cart suggestions complement categories without repeating bag items or sold-out styles', () => {
  const item = (productId: string, category: string, overrides = {}) => ({ productId, category, gender: 'Unisex', color: 'Stone', quantity: 2, active: true, productPrice: 1000, ...overrides });
  const results = suggestOutfits([item('top', 'Tops'), item('trouser', 'Bottoms'), item('soldout', 'Layers', { quantity: 0 }), item('other-top', 'Tops')], ['top']);
  assert.deepEqual(results.map(r => r.product.productId), ['trouser']);
  assert.equal(suggestOutfits([item('top', 'Tops')], []).length, 0);
});
test('server image compression emits bounded metadata-free WebP and rejects scripts', async () => {
  const input = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: '#bbaa88' } }).jpeg().toBuffer();
  const output = await compressImage('data:image/jpeg;base64,' + input.toString('base64'));
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, 'webp'); assert.ok(meta.width! <= 1200); assert.ok(output.length <= 250 * 1024); assert.equal(meta.exif, undefined);
  await assert.rejects(compressImage('data:image/svg+xml;base64,PHN2Zy8+'));
  await assert.rejects(compressImage('data:image/png;base64,YmFk'));
});
test('operator guard rejects nested query injection and prototype keys', () => {
  for (const body of [{ emailId: { $ne: null } }, { items: [{ 'price.$gt': 0 }] }, JSON.parse('{"__proto__":{"admin":true}}')]) {
    let error: any; rejectOperators({ body, query: {} } as any, {} as any, ((e: any) => { error = e; }) as any); assert.equal(error.status, 400);
  }
  let error: any; rejectOperators({ body: { text: 'I paid $100. Nice fit.' }, query: {} } as any, {} as any, ((e: any) => { error = e; }) as any); assert.equal(error, undefined);
});


test('measurement ranges match the form and identify the invalid field and units', () => {
  for (const field of MEASUREMENT_FIELDS) {
    for (const value of [field.min - 0.1, field.max + 0.1, NaN, Infinity]) {
      assert.throws(() => recommendSize({ ...measurements, [field.key]: value }, 'Tops'), { message: measurementMessage(field) });
    }
    for (const value of [field.min, field.max]) {
      assert.doesNotThrow(() => recommendSize({ ...measurements, [field.key]: value }, 'Tops'));
    }
  }
  assert.throws(() => recommendSize({ ...measurements, waist: 32 }, 'Tops'), /Waist circumference.*45.*180 cm/);
  assert.doesNotThrow(() => recommendSize({ ...measurements, chest: undefined, hip: undefined }, 'Tops'));
});


test('MongoDB media rejects missing and oversized image data and excludes bytes by default', async () => {
  const values = { mediaId: '00000000-0000-4000-8000-000000000000', ownerId: '000000000000000000000001', bytes: 3 };
  await assert.rejects(new MediaModel(values).validate(), (error: any) => !!error.errors.data);
  await assert.rejects(new MediaModel({ ...values, data: Buffer.alloc(250 * 1024 + 1) }).validate(), (error: any) => !!error.errors.data);
  await new MediaModel({ ...values, data: Buffer.from('abc') }).validate();
  assert.equal(MediaModel.schema.path('data').options.select, false);
});
