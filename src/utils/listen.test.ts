import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { listenOnAvailablePort } from './listen.ts';

const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

test('uses an available port and skips a port occupied by another server', async () => {
  const existing = createServer();
  const next = createServer();
  const initialListeningListeners = next.listenerCount('listening');
  try {
    const occupied = await listenOnAvailablePort(existing, 0);
    const chosen = await listenOnAvailablePort(next, occupied);
    assert.ok(chosen > occupied);
    assert.ok(existing.listening, 'The existing process must remain available.');
    assert.ok(next.listening);
    assert.equal(next.listenerCount('error'), 0);
    assert.equal(next.listenerCount('listening'), initialListeningListeners);
  } finally {
    await Promise.all([close(existing), close(next)]);
  }
});

test('reports exhaustion cleanly without an unhandled server error', async () => {
  const existing = createServer();
  const next = createServer();
  const initialListeningListeners = next.listenerCount('listening');
  try {
    const occupied = await listenOnAvailablePort(existing, 0);
    await assert.rejects(listenOnAvailablePort(next, occupied, 1), /Set PORT in .env/);
    assert.equal(next.listenerCount('error'), 0);
    assert.equal(next.listenerCount('listening'), initialListeningListeners);
  } finally {
    await Promise.all([close(existing), close(next)]);
  }
});
