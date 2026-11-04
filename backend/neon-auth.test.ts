import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { verifyIdentityToken } from './neon-auth.ts';
import { UserModel, MediaModel, RateLimitModel } from './models.ts';
const issuer = 'https://auth.example.neon.tech';
test('Neon JWT validation rejects wrong signatures, issuer, audience, expiry and unverified email', async () => {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA');
  const jwk = await exportJWK(publicKey); jwk.kid = 'test-key';
  const keys = createLocalJWKSet({ keys: [jwk] });
  const token = (claims = {}, iss = issuer, aud = issuer, exp: string | number = '10m') => new SignJWT({ email: 'Verified@Example.com', emailVerified: true, name: 'Verified User', role: 'admin', ...claims }).setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).setSubject('neon-test-user').setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(privateKey);
  const identity = await verifyIdentityToken(await token(), keys, issuer);
  assert.deepEqual(identity, { id: 'neon-test-user', issuer, email: 'verified@example.com', name: 'Verified User' });
  for (const t of [await token({ emailVerified: false }), await token({ banned: true }), await token({}, 'https://attacker.example'), await token({}, issuer, 'attacker'), await token({}, issuer, issuer, 1)]) await assert.rejects(verifyIdentityToken(t, keys, issuer));
  const other = await generateKeyPair('EdDSA');
  const forged = await new SignJWT({ email: 'verified@example.com', emailVerified: true }).setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' }).setSubject('neon-test-user').setIssuer(issuer).setAudience(issuer).setIssuedAt().setExpirationTime('10m').sign(other.privateKey);
  await assert.rejects(verifyIdentityToken(forged, keys, issuer));
});
test('Google users need no invented age or password; MongoDB expiration is scoped to drafts', async () => {
  await new UserModel({ username: 'Google User', emailId: 'google@example.com', authProvider: 'neon', neonAuthId: 'neon-id', neonIssuer: issuer }).validate();
  await assert.rejects(new UserModel({ username: 'Local User', emailId: 'local@example.com' }).validate());
  const mediaTTL = MediaModel.schema.indexes().find(([, options]) => options.name === 'expire_unpublished_media');
  assert.deepEqual(mediaTTL?.[1].partialFilterExpression, { attachedTo: '' });
  assert.equal(mediaTTL?.[1].expireAfterSeconds, 3600);
  assert(RateLimitModel.schema.indexes().some(([, options]) => options.expireAfterSeconds === 0));
});
