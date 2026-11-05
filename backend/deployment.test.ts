import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import handler from '../api/index.ts';
test('Vercel serves an API handler without starting a listener and keeps API URLs out of the SPA rewrite', async () => {
  assert.equal(typeof handler, 'function');
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.rewrites[0], { source: '/api/:path*', destination: '/api/index' });
  assert.deepEqual(config.functions, { 'api/index.ts': { maxDuration: 30 } });
  const rewrite = new RegExp('^' + config.rewrites[1].source + '$');
  for (const path of ['/api/products', '/api/auth/neon', '/api/media/photo', '/api/health', '/api']) assert.equal(rewrite.test(path), false, path);
  for (const path of ['/', '/shop', '/product/FRM-002', '/auth/callback', '/account', '/admin']) assert.equal(rewrite.test(path), true, path);
});
import express from 'express';
import { createServer } from 'node:http';
import { vercelExpress } from './vercel.ts';
import { rejectOperators } from './validation.ts';
import { optionalAuthenticate, authenticate } from './security.ts';

test('Vercel routing metadata cannot break query validation, and malicious client queries remain rejected', async () => {
  const app = express();
  app.use(express.json(), rejectOperators);
  app.get('/api/products', (req, res) => res.json({ query: req.query }));
  app.get('/api/products/:id/reviews', (req, res) => res.json({ id: req.params.id, query: req.query }));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.status || 500).json({ message: error.message }); });
  const handler = vercelExpress(app);
  const server = createServer((req, res) => {
    Object.assign(req, { query: { '...path': ['products'], internal: 'platform-only' } });
    handler(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    let response = await fetch(base + '/api/products?category=Tops');
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { query: { category: 'Tops' } });
    response = await fetch(base + '/api/products/FRM-002/reviews?page=2');
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { id: 'FRM-002', query: { page: '2' } });
    for (const query of ['filter[$ne]=x', 'price.$gt=1', '...path=attacker']) {
      assert.equal((await fetch(base + '/api/products?' + query)).status, 400, query);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('anonymous and expired session discovery succeeds while protected endpoints still return 401', async () => {
  const app = express();
  app.get('/api/session', optionalAuthenticate, (req, res) => res.json({ user: (req as any).user || null, csrfToken: '' }));
  app.get('/api/orders', authenticate, (_req, res) => res.json([]));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.status || 500).json({ message: error.message }); });
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const cookie of ['', 'forme_session=expired-token']) {
      const response = await fetch(base + '/api/session', { headers: cookie ? { Cookie: cookie } : {} });
      assert.equal(response.status, 200); assert.equal((await response.json()).user, null);
      assert.equal((await fetch(base + '/api/orders', { headers: cookie ? { Cookie: cookie } : {} })).status, 401);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
