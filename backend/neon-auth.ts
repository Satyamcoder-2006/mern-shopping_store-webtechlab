import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';
import { UserModel } from './models.ts';
import { ensure } from './domain.ts';

export type NeonIdentity = { id: string; issuer: string; email: string; name: string };
export function identityFromClaims(payload: JWTPayload, issuer: string): NeonIdentity {
  ensure(typeof payload.sub === 'string' && payload.sub.length > 0 && payload.sub.length <= 200, 'Google sign-in could not be verified.', 401);
  ensure(typeof payload.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) && payload.email.length <= 254, 'A valid email address is required.', 401);
  ensure(payload.emailVerified === true, 'Verify your Google email address before signing in.', 401);
  ensure(payload.banned !== true, 'This sign-in is not available.', 403);
  return { id: payload.sub, issuer, email: payload.email.toLowerCase().trim(), name: (typeof payload.name === 'string' ? payload.name.trim() : '').slice(0, 80) || payload.email.split('@')[0] };
}
export async function verifyIdentityToken(token: string, keys: JWTVerifyGetKey, issuer: string) {
  const { payload } = await jwtVerify(token, keys, { algorithms: ['EdDSA'], issuer, audience: issuer, requiredClaims: ['sub', 'iat', 'exp'], maxTokenAge: '15m', clockTolerance: 5 });
  return identityFromClaims(payload, issuer);
}
let cached: { url: string; keys: ReturnType<typeof createRemoteJWKSet> } | undefined;
export async function verifyNeonToken(token: unknown) {
  ensure(process.env.NEON_AUTH_URL, 'Google sign-in is not configured yet.', 503);
  ensure(typeof token === 'string' && token.length > 0 && token.length < 16000, 'Please sign in with Google again.', 401);
  const base = new URL(process.env.NEON_AUTH_URL);
  ensure(base.protocol === 'https:' && !base.username && !base.password, 'Google sign-in configuration is invalid.', 503);
  const url = base.href.replace(/\/$/, '') + '/.well-known/jwks.json';
  if (cached?.url !== url) cached = { url, keys: createRemoteJWKSet(new URL(url), { timeoutDuration: 5000 }) };
  try { return await verifyIdentityToken(token, cached.keys, base.origin); }
  catch (error: any) { if (error.status) throw error; ensure(false, 'Google sign-in expired or could not be verified. Please try again.', 401); }
}
export async function syncNeonUser(identity: NeonIdentity, signedInUserId?: string) {
  const existing = await UserModel.findOne({ neonAuthId: identity.id, neonIssuer: identity.issuer });
  if (existing) return existing;
  const local = await UserModel.findOne({ emailId: identity.email });
  if (local) {
    ensure(String(local._id) === signedInUserId, 'An account already uses this email. Log in with its password, then connect Google from Account security.', 409);
    ensure(!local.neonAuthId, 'A different Google identity is already connected.', 409);
    const linked = await UserModel.findOneAndUpdate({ _id: local._id, neonAuthId: { $exists: false } }, { $set: { neonAuthId: identity.id, neonIssuer: identity.issuer } }, { returnDocument: 'after' });
    ensure(linked, 'Your account changed. Please try again.', 409);
    return linked;
  }
  ensure(!signedInUserId, 'Use the same email as your FORME account to connect Google.', 409);
  try {
    return await UserModel.create({ username: identity.name, emailId: identity.email, authProvider: 'neon', neonAuthId: identity.id, neonIssuer: identity.issuer, role: 'customer' });
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    const concurrent = await UserModel.findOne({ neonAuthId: identity.id, neonIssuer: identity.issuer });
    ensure(concurrent, 'An account already uses this email. Log in with its password to connect Google.', 409);
    return concurrent;
  }
}
