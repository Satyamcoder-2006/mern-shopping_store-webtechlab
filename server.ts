import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { listenOnAvailablePort } from './src/utils/listen.ts';
import { app } from './backend/app.ts';
import { connectDatabase, databaseReady, databaseFailureMessage } from './backend/database.ts';
const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(root, '.env'), quiet: true });
async function startServer() {
  const httpServer = createServer(app);
  let vite: import('vite').ViteDevServer | undefined;
  try {
    if (process.env.NODE_ENV === 'production') {
      if (!fs.existsSync(path.join(root, 'dist/index.html'))) throw new Error('Run the production build first.');
      const { default: express } = await import('express');
      app.use(express.static(path.join(root, 'dist')));
      app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
    } else {
      const { createServer: createViteServer } = await import('vite');
      vite = await createViteServer({ configLoader: 'runner', server: { middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer } }, appType: 'spa' });
      app.use(vite.middlewares);
    }
    const port = await listenOnAvailablePort(httpServer, Number(process.env.PORT) || 3000, 1);
    console.log(`Server listening on port ${port}`);
    console.log(`FORME is ready at http://localhost:${port}`);
    console.log('Connecting to MongoDB Atlas…');
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopping = false;
    const ensureDatabase = async () => {
      if (stopping) return;
      if (!databaseReady()) {
        try { await connectDatabase(); }
        catch (error) {
          console.error(databaseFailureMessage(error));
          console.error('Storefront stays available; database actions return 503. Retrying in 15 seconds.');
          await mongoose.disconnect();
        }
      }
      if (!stopping) retryTimer = setTimeout(ensureDatabase, 15000);
    };
    void ensureDatabase();
    const shutdown = async () => {
      if (stopping) return; stopping = true;
      clearTimeout(retryTimer);
      httpServer.close(); await vite?.close(); await mongoose.disconnect();
      process.exit(0);
    };
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  } catch (error) { await vite?.close(); throw error; }
}
startServer().catch(async (error) => {
  console.error(`Store startup failed (${error.name}).`);
  if (String(error.message).startsWith('Ports ')) console.error(error.message);
  await mongoose.disconnect(); process.exitCode = 1;
});
