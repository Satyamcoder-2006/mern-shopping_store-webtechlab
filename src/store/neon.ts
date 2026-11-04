import type { VanillaBetterAuthClient } from '@neondatabase/auth';
const url = (import.meta.env.VITE_NEON_AUTH_URL || '').trim();
export const googleConfigured = Boolean(url);
let clientPromise: Promise<VanillaBetterAuthClient> | undefined;
export function neonClient() {
  if (!url) throw new Error('Google sign-in is not configured yet.');
  return clientPromise ??= Promise.all([import('@neondatabase/auth'), import('@neondatabase/auth/vanilla/adapters')]).then(([sdk, adapters]) => sdk.createAuthClient(url, { adapter: adapters.BetterAuthVanillaAdapter({ fetchOptions: { credentials: 'include' } }) }));
}
export async function beginGoogleSignIn(returnTo = window.location.pathname + window.location.search, state: unknown = null) {
  sessionStorage.setItem('forme_google_return', JSON.stringify({ path: returnTo, state }));
  const client = await neonClient();
  const result = await client.signIn.social({ provider: 'google', callbackURL: new URL('/auth/callback', window.location.origin).href });
  if (result.error) throw new Error(result.error.message || 'Google sign-in could not be started.');
}
export async function googleToken() {
  const client = await neonClient();
  const session = await client.getSession();
  if (session.error || !session.data?.user) throw new Error('Please sign in with Google again.');
  // Request a fresh token so a different Google account cannot reuse a cached JWT.
  const response = await fetch(url.replace(/\/$/, '') + '/token', { credentials: 'include', cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.token) throw new Error('Google sign-in could not be verified. Please try again.');
  return data.token;
}
export async function signOutGoogle() { if (googleConfigured) await (await neonClient()).signOut(); }
