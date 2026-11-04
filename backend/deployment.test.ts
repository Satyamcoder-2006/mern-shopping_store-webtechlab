import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import handler from '../api/[...path].ts';
test('Vercel serves an API handler without starting a listener and keeps API URLs out of the SPA rewrite', async () => {
  assert.equal(typeof handler, 'function');
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrite = new RegExp('^' + config.rewrites[0].source + '$');
  for (const path of ['/api/products', '/api/auth/neon', '/api/media/photo', '/api/health', '/api']) assert.equal(rewrite.test(path), false, path);
  for (const path of ['/', '/shop', '/product/FRM-002', '/auth/callback', '/account', '/admin']) assert.equal(rewrite.test(path), true, path);
});
