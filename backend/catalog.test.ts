import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CATALOG } from './catalog.ts';
import { CAMPUS_PRODUCTS } from './campus-catalog.ts';
import { productInput, imageUrl } from './domain.ts';

test('all 44 demo products have valid stock, prices and shipped local images', () => {
  const products = [...CATALOG, ...CAMPUS_PRODUCTS];
  assert.equal(products.length, 44);
  assert.equal(new Set(products.map(p => p.productId)).size, 44);
  for (const product of products) {
    const validated = productInput(product);
    assert.equal(validated.quantity, product.quantity);
    assert.deepEqual(product.variants.map(v => v.size), ['XS', 'S', 'M', 'L', 'XL']);
    assert.ok(product.variants.every(v => Number.isInteger(v.stock) && v.stock > 0));
    assert.ok(existsSync(new URL('../public' + product.image, import.meta.url)), product.productId);
    if (product.gender === 'Women') assert.doesNotMatch(product.productName, /dress|shorts|cropped|mini|sleeveless/i);
  }
});
test('catalogue image validation permits shipped assets and rejects traversal', () => {
  assert.equal(imageUrl('/catalog/campus-101.webp'), '/catalog/campus-101.webp');
  assert.throws(() => imageUrl('/catalog/../../.env'));
  assert.throws(() => imageUrl('data:image/svg+xml,test'));
  assert.throws(() => imageUrl('/uploads/private.webp'));
});
