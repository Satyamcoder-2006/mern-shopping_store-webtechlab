import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, initializeDatabase } from '../backend/database.ts';
dotenv.config({ quiet: true });
try {
  await connectDatabase();
  if (process.env.VERCEL) await initializeDatabase();
  console.log('Database migrations and deployment indexes are ready.');
} finally { await mongoose.disconnect(); }
