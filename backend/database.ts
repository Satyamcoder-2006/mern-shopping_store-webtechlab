import mongoose from 'mongoose';
import { ProductModel, UserModel, CouponModel, OrderModel, MediaModel, ReviewModel, FaceoffModel, VoteModel, RateLimitModel } from './models.ts';
import { cleanMedia } from './media.ts';
import { migrateLegacyMedia } from './migrate-media.ts';
import { CATALOG } from './catalog.ts';
import { installCampusCatalog } from './catalog-expansion.ts';

let ready = false;
let connecting: Promise<void> | undefined;
export const databaseReady = () => ready && mongoose.connection.readyState === 1;
mongoose.connection.on('disconnected', () => { ready = false; connecting = undefined; });
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

// One connection/promise per warm process, including concurrent Vercel requests.
export async function connectDatabase() {
  if (databaseReady()) return;
  if (connecting) return connecting;
  connecting = (async () => {
    if (!process.env.MONGO_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Configure MONGO_URI and a JWT_SECRET of at least 32 characters in .env.');
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'shopDB', serverSelectionTimeoutMS: 10000, maxPoolSize: 5, autoIndex: false });
    // Serverless requests never seed, migrate files, or perform full-collection updates.
    if (!process.env.VERCEL) await initializeDatabase();
    ready = true;
  })();
  try { await connecting; } finally { connecting = undefined; }
}

export async function initializeDatabase() {
  const db = mongoose.connection.db!;
  const migrationId = 'forme-clothing-v1';
  if (!await db.collection('migrations').findOne({ _id: migrationId as any })) {
    // Seed missing demo IDs only; existing products and stock are preserved.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (await db.collection('migrations').findOne({ _id: migrationId as any }, { session })) return;
        await ProductModel.bulkWrite(CATALOG.map(product => ({ updateOne: {
          filter: { productId: product.productId }, update: { $setOnInsert: { ...product, revision: 0, createdAt: new Date(), updatedAt: new Date() } }, upsert: true, timestamps: false,
        } })), { session });
        await db.collection('migrations').insertOne({ _id: migrationId as any, createdAt: new Date() }, { session });
      });
    } finally { await session.endSession(); }
  }
  await installCampusCatalog();
  await UserModel.updateMany({ role: { $exists: false } }, { $set: { role: 'customer', tokenVersion: 0 } });
  await UserModel.updateMany({ tokenVersion: { $exists: false } }, { $set: { tokenVersion: 0 } });
  await db.collection('products').updateMany({}, { $unset: { tryOnImage: '' } });
  await Promise.all([UserModel.createIndexes(), ProductModel.createIndexes(), CouponModel.createIndexes(), OrderModel.createIndexes(), MediaModel.createIndexes(), ReviewModel.createIndexes(), FaceoffModel.createIndexes(), VoteModel.createIndexes(), RateLimitModel.createIndexes()]);
  await migrateLegacyMedia();
  await cleanMedia();
  console.log('MongoDB initialization complete · FORME clothing store');
}

