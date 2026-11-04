import mongoose from 'mongoose';
import { ProductModel } from './models.ts';
import { CAMPUS_PRODUCTS, BASE_CATALOG_UPDATES } from './campus-catalog.ts';

export async function installCampusCatalog() {
  const db = mongoose.connection.db!;
  const migrationId = 'forme-campus-catalog-v1';
  if (await db.collection('migrations').findOne({ _id: migrationId as any })) return;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (await db.collection('migrations').findOne({ _id: migrationId as any }, { session })) return;
      const now = new Date();
      // New IDs only. Re-running never resets stock, orders, or admin edits.
      await ProductModel.bulkWrite(CAMPUS_PRODUCTS.map(product => ({ updateOne: {
        filter: { productId: product.productId },
        update: { $setOnInsert: { ...product, createdAt: now, updatedAt: now } }, upsert: true, timestamps: false,
      } })), { session });
      for (const [productId, changes] of Object.entries(BASE_CATALOG_UPDATES)) {
        // Only correct original Unsplash demo records; do not replace admin imagery.
        await ProductModel.updateOne({ productId, image: { $regex: '^https://images[.]unsplash[.]com/' } },
          { $set: changes, $inc: { revision: 1 } }, { session });
      }
      await db.collection('migrations').insertOne({ _id: migrationId as any, createdAt: now, addedProductIds: CAMPUS_PRODUCTS.map(p => p.productId) }, { session });
    });
  } finally { await session.endSession(); }
}
