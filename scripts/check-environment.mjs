import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const failures = [];
if (!/^mongodb(?:\+srv)?:\/\//.test(process.env.MONGO_URI || '')) failures.push('Set MONGO_URI to your MongoDB connection string.');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) failures.push('Set JWT_SECRET to a random secret of at least 32 characters.');
const backend = (process.env.NEON_AUTH_URL || '').trim(), frontend = (process.env.VITE_NEON_AUTH_URL || '').trim();
if (backend || frontend) {
  if (backend.replace(/\/$/, '') !== frontend.replace(/\/$/, '')) failures.push('NEON_AUTH_URL and VITE_NEON_AUTH_URL must match.');
  try { const u = new URL(backend); if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) throw Error(); }
  catch { failures.push('Use the HTTPS Auth URL from the Neon dashboard, without credentials or query parameters.'); }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`PASS: required environment values present; Google login ${backend ? 'configured' : 'disabled until Neon URLs are supplied'}. No secrets printed.`);
