import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHmac, timingSafeEqual, randomUUID, createHash } from 'node:crypto';
import { UserModel, RateLimitModel } from './models.ts';
import { HttpError } from './domain.ts';

export const publicUser = (u: any) => ({ id: String(u._id), username: u.username, emailId: u.emailId, age: u.age, role: u.role || 'customer', hasPassword: u.authProvider !== 'neon', googleLinked: !!u.neonAuthId });
const secret = () => process.env.JWT_SECRET!;
const COOKIE = 'forme_session';
const secureCookie = () => process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
export const csrfFor = (token: string) => createHmac('sha256', secret()).update('csrf:' + token).digest('hex');
export async function issueSession(res: Response, user: any, replaceId?: string) {
  const id = randomUUID(), createdAt = new Date(), expiresAt = new Date(Date.now() + 8 * 3600000);
  const active = await UserModel.findOneAndUpdate({ _id: user._id, tokenVersion: user.tokenVersion || 0, ...(replaceId ? { 'sessions.id': replaceId } : {}) },
    replaceId ? { $set: { 'sessions.$': { id, createdAt, expiresAt } } } : { $push: { sessions: { $each: [{ id, createdAt, expiresAt }], $slice: -3 } } }, { returnDocument: 'after' });
  if (!active) throw new HttpError(401, 'Your account session changed. Log in again.');
  const token = jwt.sign({ version: user.tokenVersion || 0 }, secret(), { subject: String(user._id), jwtid: id, expiresIn: '8h', issuer: 'forme', audience: 'forme-store' });
  res.cookie(COOKIE, token, { httpOnly: true, secure: secureCookie(), sameSite: 'strict', maxAge: 8 * 3600000, path: '/' });
  return { user: publicUser(user), csrfToken: csrfFor(token) };
}
export const clearSession = (res: Response) => res.clearCookie(COOKIE, { httpOnly: true, secure: secureCookie(), sameSite: 'strict', path: '/' });
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!token) throw new HttpError(401, 'Log in to continue.');
    const claims = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: 'forme', audience: 'forme-store' }) as jwt.JwtPayload;
    const user = await UserModel.findById(claims.sub);
    if (!user || (user.tokenVersion || 0) !== claims.version || !user.sessions?.some((s: any) => s.id === claims.jti && s.expiresAt > new Date())) throw new HttpError(401, 'Your session has expired. Please log in again.');
    (req as any).user = user;
    (req as any).sessionToken = token;
    (req as any).sessionId = claims.jti;
    next();
  } catch { next(new HttpError(401, 'Your session has expired. Please log in again.')); }
}
// Public session discovery is allowed to return an anonymous user.
// Protected endpoints continue to use authenticate and return 401.
export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const hasSession = req.headers.cookie?.split(';').some(cookie => cookie.trim().startsWith(COOKIE + '='));
  if (!hasSession) { next(); return; }
  return authenticate(req, res, error => {
    if (error) clearSession(res);
    next();
  });
}
export function csrf(req: Request, _res: Response, next: NextFunction) {
  const provided = req.get('X-CSRF-Token') || '';
  const expected = csrfFor((req as any).sessionToken || '');
  if (!/^[a-f0-9]{64}$/.test(provided) || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return next(new HttpError(403, 'Please refresh the page and try again.'));
  next();
}
export function adminOnly(req: Request, _res: Response, next: NextFunction) {
  if ((req as any).user?.role !== 'admin') return next(new HttpError(403, 'Administrator access required.'));
  next();
}
export function sameOrigin(req: Request, _res: Response, next: NextFunction) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== req.get('host')) throw new Error();
      } catch { return next(new HttpError(403, 'Cross-origin requests are not allowed.')); }
    }
    if (req.get('sec-fetch-site') === 'cross-site') return next(new HttpError(403, 'Cross-site requests are not allowed.'));
  }
  next();
}
// MongoDB counters work across Vercel instances; TTL removes expired buckets.
export function rateLimit(limit: number, windowMs: number, scope: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const window = Math.floor(Date.now() / windowMs);
      const id = createHash('sha256').update(`${scope}:${window}:${req.ip}`).digest('hex');
      const expiresAt = new Date((window + 1) * windowMs);
      let bucket;
      try {
        bucket = await RateLimitModel.findOneAndUpdate({ _id: id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, returnDocument: 'after' });
      } catch (error: any) {
        if (error.code !== 11000) throw error;
        bucket = await RateLimitModel.findByIdAndUpdate(id, { $inc: { count: 1 } }, { returnDocument: 'after' });
      }
      if (!bucket) return next(new HttpError(503, 'Please try again shortly.'));
      if (bucket.count > limit) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)));
        return next(new HttpError(429, 'Too many attempts. Please try again in a few minutes.'));
      }
      next();
    } catch { next(new HttpError(503, 'The store is temporarily unavailable. Please try again shortly.')); }
  };
}
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  let authOrigin = '';
  try { if (process.env.NEON_AUTH_URL) authOrigin = ' ' + new URL(process.env.NEON_AUTH_URL).origin; } catch {}
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': `default-src 'self'; script-src 'self'${process.env.NODE_ENV !== 'production' ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data: blob:; connect-src 'self'${process.env.NODE_ENV !== 'production' ? ' ws: wss:' : ''}${authOrigin}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` });
  if (secureCookie()) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
}
