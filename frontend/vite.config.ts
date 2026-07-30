import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Allows any trycloudflare.com subdomain
    allowedHosts: ['.trycloudflare.com'],
  },
  build: {
    outDir: '../backend/public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: './src/main.tsx',
      },
      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: 'css/[name].[ext]',
      },
    },
  },
});