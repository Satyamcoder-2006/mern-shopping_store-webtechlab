import type { Express } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Vercel prepopulates req.query with catch-all route metadata (e.g. "...path").
// Express 4 skips its own parser if that property already exists. Remove only
// the platform object, then let Express parse the real request URL as usual.
// Client-supplied query keys still pass through the normal security validator.
export function vercelExpress(app: Express) {
  return (req: IncomingMessage & { query?: unknown }, res: ServerResponse) => {
    delete req.query;
    return app(req, res);
  };
}
