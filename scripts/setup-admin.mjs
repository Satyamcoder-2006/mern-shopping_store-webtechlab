import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import passwordUtils from '../shared/password.cjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Set ADMIN_EMAIL to the intended administrator email before running admin:setup.');
  process.exit(1);
}
try {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'shopDB', serverSelectionTimeoutMS: 15000 });
  const users = mongoose.connection.db.collection('users');
  const existing = await users.findOne({ emailId: email });
  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: { role: 'admin', updatedAt: new Date() }, $inc: { tokenVersion: 1 } });
    console.log(`Admin access enabled for ${email}. Use the account's existing password.`);
  } else {
    const generated = randomBytes(18).toString('base64url');
    await users.insertOne({ username: 'FORME Studio', emailId: email, age: 21, password: await passwordUtils.hashPassword(generated), role: 'admin', tokenVersion: 0, createdAt: new Date(), updatedAt: new Date() });
    const output = path.join(root, '.admin-credentials.txt');
    await writeFile(output, `FORME local administrator\nEmail: ${email}\nPassword: ${generated}\n\nLog in through the storefront. Change this password in Account after signing in.\nKeep this file private; it is excluded from Git.\n`, { mode: 0o600 });
    console.log(`Administrator created. Private login details saved to ${output}`);
  }
} catch (error) {
  console.error('Admin setup failed (' + error.name + '). Check Atlas connectivity.'); process.exitCode = 1;
} finally { await mongoose.disconnect(); }
