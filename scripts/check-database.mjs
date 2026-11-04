// Reports connection diagnostics without printing credentials or disabling TLS.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
let timeout;
try {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing from .env.');
  const uri = new URL(process.env.MONGO_URI);
  console.log('Atlas host: ' + uri.hostname);
  if (uri.protocol === 'mongodb+srv:') console.log('DNS server records: ' + (await dns.resolveSrv('_mongodb._tcp.' + uri.hostname)).length);
  timeout = setTimeout(() => { console.error('Connection timed out. Check Atlas Network Access and your current public IP.'); process.exit(1); }, 25000);
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME || 'shopDB', serverSelectionTimeoutMS: 12000, connectTimeoutMS: 8000 });
  await mongoose.connection.db.command({ ping: 1 });
  console.log('PASS: MongoDB Atlas connected and ping succeeded.');
} catch (error) {
  const servers = [...(error.reason?.servers?.values() || [])];
  console.error('FAIL: ' + error.name);
  for (const server of servers) console.error(server.address + ': ' + (server.error?.cause?.code || server.error?.code || server.type));
  console.error('In Atlas: Security > Network Access > Add IP Address > Add Current IP Address. Wait for Active. Confirm the cluster is running.');
  process.exitCode = 1;
} finally { clearTimeout(timeout); await mongoose.disconnect(); }
