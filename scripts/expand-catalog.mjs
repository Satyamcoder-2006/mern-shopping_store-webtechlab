// Safe, repeatable demo expansion. Never prints database credentials.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from '../backend/database.ts';
import { CAMPUS_PRODUCTS } from '../backend/campus-catalog.ts';
import { ProductModel } from '../backend/models.ts';
dotenv.config({ quiet: true });
try {
  await connectDatabase();
  const added = await ProductModel.countDocuments({ productId: { $in: CAMPUS_PRODUCTS.map(p => p.productId) }, active: true });
  const total = await ProductModel.countDocuments({ active: true });
  console.log(`Campus catalogue ready: ${added} additional pieces; ${total} active products total.`);
} catch (error) {
  console.error('Catalogue expansion failed (' + error.name + '). Check Atlas connectivity and configuration.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
