import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { UserModel } from './models.ts';
import { HttpError } from './domain.ts';

export const publicUser = (u: any) => ({ id: String(u._id), username: u.username, emailId: u.emailId, age: u.age, role: u.role || 'customer' });
const secret = () => process.env.JWT_SECRET!;
const COOKIE = 'forme_session';
export const csrfFor = (token: string) => createHmac('sha256', secret()).update('csrf:' + token).digest('hex');
export async function issueSession(res: Response, user: any, replaceId?: string) {
  const id = randomUUID(), createdAt = new Date(), expiresAt = new Date(Date.now() + 8 * 3600000);
  const active = await UserModel.findOneAndUpdate({ _id: user._id, tokenVersion: user.tokenVersion || 0, ...(replaceId ? { 'sessions.id': replaceId } : {}) },
    replaceId ? { $set: { 'sessions.$': { id, createdAt, expiresAt } } } : { $push: { sessions: { $each: [{ id, createdAt, expiresAt }], $slice: -3 } } }, { new: true });
  if (!active) throw new HttpError(401, 'Your account session changed. Log in again.');
  const token = jwt.sign({ version: user.tokenVersion || 0 }, secret(), { subject: String(user._id), jwtid: id, expiresIn: '8h', issuer: 'forme', audience: 'forme-store' });
  res.cookie(COOKIE, token, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'strict', maxAge: 8 * 3600000, path: '/' });
  return { user: publicUser(user), csrfToken: csrfFor(token) };
}
export const clearSession = (res: Response) => res.clearCookie(COOKIE, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'strict', path: '/' });
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
const buckets = new Map<string, { count: number; expires: number }>();
setInterval(() => { for (const [key, b] of buckets) if (b.expires < Date.now()) buckets.delete(key); }, 60000).unref();
export function rateLimit(limit: number, windowMs: number, scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${scope}:${req.ip}`;
    let b = buckets.get(key);
    if (!b || b.expires < Date.now()) { b = { count: 0, expires: Date.now() + windowMs }; buckets.set(key, b); }
    if (++b.count > limit) { res.setHeader('Retry-After', Math.ceil((b.expires - Date.now()) / 1000)); return next(new HttpError(429, 'Too many attempts. Please try again in a few minutes.')); }
    next();
  };
}
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': `default-src 'self'; script-src 'self'${process.env.NODE_ENV !== 'production' ? " 'unsafe-inline'" : ''}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` });
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
}
