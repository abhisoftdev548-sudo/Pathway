import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vite config: dev server proxies /api to the QuizSphere API so the SPA can use
// relative URLs (required for credentialed refresh cookies in development).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow sandbox preview hosts (e.g. *.e2b.app) in addition to localhost.
    allowedHosts: ['.e2b.app', '.localhost', 'localhost'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
