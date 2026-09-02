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
    // Re-bundle on every dev start. Vite keys the cache on package.json and the
    // lockfile, neither of which changes when shared's dist is rebuilt — so a
    // server started before a new export was added serves a pre-bundle without
    // it, and the import reads as undefined at runtime rather than failing loudly.
    // `pnpm dev` builds shared first, so this only ever costs a second.
    force: true,
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
      // The websocket, same reasoning as /api: one origin in development, so the
      // handshake carries cookies and needs no CORS exception. `ws` is what makes
      // Vite forward the upgrade request rather than only the polling fallback.
      '/socket.io': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
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
    // Vitest's 5s default is not enough here. These are jsdom render tests that
    // mount a router and a query client, and they run in parallel worker
    // processes competing for CPU — so a suite that finishes in well under a
    // second on its own can sit waiting on the event loop long enough to trip
    // the timeout. The failures moved between files from run to run, which is
    // what made them flaky rather than broken.
    testTimeout: 15_000,
  },
});
