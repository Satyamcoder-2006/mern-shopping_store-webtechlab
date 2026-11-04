import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel } from '../backend/models.ts';
import { syncNeonUser } from '../backend/neon-auth.ts';
import passwordUtils from '../shared/password.cjs';
dotenv.config({ quiet: true });
const suffix = randomUUID(), issuer = 'https://verification.example.neon.tech';
const identities = [0, 1].map(i => ({ id: `check-${suffix}-${i}`, issuer, email: `forme-neon-check-${suffix}-${i}@example.com`, name: 'Google verification' }));
try {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'shopDB', serverSelectionTimeoutMS: 10000 });
  const first = await syncNeonUser(identities[0]);
  const again = await syncNeonUser(identities[0]);
  assert.equal(String(first._id), String(again._id)); assert.equal(first.role, 'customer'); assert.equal(first.age, undefined); assert.equal(first.authProvider, 'neon');
  const local = await UserModel.create({ username: 'Local verification', emailId: identities[1].email, age: 22, password: await passwordUtils.hashPassword(randomUUID()), role: 'admin' });
  await assert.rejects(syncNeonUser(identities[1]), error => error.status === 409);
  await assert.rejects(syncNeonUser(identities[1], String(first._id)), error => error.status === 409);
  const linked = await syncNeonUser(identities[1], String(local._id));
  assert.equal(String(linked._id), String(local._id)); assert.equal(linked.role, 'admin'); assert.equal(linked.authProvider, 'local');
  assert.equal(String((await syncNeonUser(identities[1]))._id), String(local._id));
  console.log('PASS: repeated Neon identities reuse one MongoDB user; new users are customers; existing emails require explicit signed-in linking; local IDs, passwords and roles are preserved.');
} finally {
  await UserModel.deleteMany({ emailId: { $in: identities.map(identity => identity.email) } });
  await mongoose.disconnect();
}
