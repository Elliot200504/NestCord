import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // @nestcord/shared compiles to CommonJS because the NestJS API consumes it
    // that way. Vite skips linked workspace packages when pre-bundling, so
    // without this the browser gets raw CJS and value imports have no named
    // exports. Type-only imports are erased and were never affected.
    include: ['@nestcord/shared'],
  },
  server: {
    port: 5173,
    proxy: {
      // Keeps the browser on one origin in development, so cookies and CORS
      // behave the same as they will in production.
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      // Uploaded avatars are served by the API off local disk. Proxying them
      // keeps their URLs origin-relative, so nothing has to know the API's host.
      '/uploads': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
