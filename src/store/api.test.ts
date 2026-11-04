import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError } from './api.ts';

test('API route failures show a helpful message without hiding their status', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'API endpoint not found.' }), { status: 404 });
    await assert.rejects(api('/api/size-recommendation', 'POST', {}), error => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 404);
      assert.equal(error.message, 'This feature is temporarily unavailable. Please refresh the page and try again.');
      return true;
    });
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Product not found.' }), { status: 404 });
    await assert.rejects(api('/api/products/missing'), { message: 'Product not found.', status: 404 });
    globalThis.fetch = async () => new Response(JSON.stringify({ reviews: [{ text: 'Comfortable fit.' }], count: 1 }));
    const result = await api('/api/products/FRM-002/reviews');
    assert.equal(result.reviews[0].text, 'Comfortable fit.');
    assert.equal(result.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
