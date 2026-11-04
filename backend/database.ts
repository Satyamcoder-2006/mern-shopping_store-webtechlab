import mongoose from 'mongoose';
import { ProductModel, UserModel, CouponModel, OrderModel, MediaModel, ReviewModel, FaceoffModel, VoteModel } from './models.ts';
import { cleanMedia } from './media.ts';
import { CATALOG } from './catalog.ts';
import { installCampusCatalog } from './catalog-expansion.ts';

let ready = false;
export const databaseReady = () => ready && mongoose.connection.readyState === 1;
mongoose.connection.on('disconnected', () => { ready = false; });
export function databaseFailureMessage(error: any): string {
  const servers = [...(error.reason?.servers?.values() || [])];
  const codes = [error.code, error.cause?.code, ...servers.flatMap((s: any) => [s.error?.code, s.error?.cause?.code])].filter(Boolean);
  if (codes.includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR')) return 'Atlas rejected the TLS handshake. In Atlas, check Security > Network Access: your current public IP must be Active. Also confirm the cluster is running. TLS certificate verification remains enabled.';
  if (codes.includes(18) || error.codeName === 'AuthenticationFailed') return 'Atlas authentication failed. Check the database user and password in MONGO_URI.';
  if (codes.some(code => ['ENOTFOUND', 'ETIMEOUT', 'EAI_AGAIN', 'ECONNREFUSED'].includes(String(code)))) return 'Atlas network or DNS lookup failed. Check your internet connection, DNS, firewall and Atlas Network Access.';
  if (error.name === 'MongooseServerSelectionError') return 'Atlas could not be reached. Check the cluster is running and your current public IP is Active under Atlas Security > Network Access.';
  if (error.message?.startsWith('Configure MONGO_URI')) return error.message;
  return `Database initialization failed (${error.name || 'Error'}). Check Atlas permissions and server configuration.`;
}

export async function connectDatabase() {
  ready = false;
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Configure MONGO_URI and a JWT_SECRET of at least 32 characters in .env.');
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'shopDB', serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db!;
  const migrationId = 'forme-clothing-v1';
  if (!await db.collection('migrations').findOne({ _id: migrationId as any })) {
    // Retain an archive before replacing the previous mixed catalogue.
    await db.createCollection('catalog_archive').catch((error) => { if (error.code !== 48) throw error; });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (await db.collection('migrations').findOne({ _id: migrationId as any }, { session })) return;
        const old = await db.collection('products').find({}, { session }).toArray();
        if (old.length) await db.collection('catalog_archive').insertMany(old.map(p => ({ ...p, archivedAt: new Date(), migration: migrationId })), { session });
        await db.collection('products').deleteMany({}, { session });
        await db.collection('products').insertMany(CATALOG.map(p => ({ ...p, revision: 0, createdAt: new Date(), updatedAt: new Date() })), { session });
        await db.collection('migrations').insertOne({ _id: migrationId as any, createdAt: new Date(), archivedCount: old.length }, { session });
      });
    } finally { await session.endSession(); }
  }
  await installCampusCatalog();
  await UserModel.updateMany({ role: { $exists: false } }, { $set: { role: 'customer', tokenVersion: 0 } });
  await UserModel.updateMany({ tokenVersion: { $exists: false } }, { $set: { tokenVersion: 0 } });
  await db.collection('products').updateMany({}, { $unset: { tryOnImage: '' } });
  await Promise.all([UserModel.init(), ProductModel.init(), CouponModel.init(), OrderModel.init(), MediaModel.init(), ReviewModel.init(), FaceoffModel.init(), VoteModel.init()]);
  ready = true;
  void cleanMedia().catch(() => {});
  console.log('MongoDB Atlas connected · FORME clothing store · shopDB');
}
setInterval(() => { if (databaseReady()) void cleanMedia().catch(() => {}); }, 600000).unref();
