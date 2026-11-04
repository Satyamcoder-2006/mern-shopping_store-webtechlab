import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // Set DISABLE_HMR=true for environments that do not support live reload.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Avoid watcher work when live reload is explicitly disabled.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
