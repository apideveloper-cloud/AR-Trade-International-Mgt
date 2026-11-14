import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Long-lived vendor chunks: they change far less often than app code, so returning visitors keep them cached across deploys. */
const vendorChunk = id => {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules[\/](react|react-dom|react-router|react-router-dom|@remix-run|scheduler)[\/]/.test(id)) return 'react-vendor';
  if (/node_modules[\/]leaflet[\/]/.test(id)) return 'leaflet-vendor'; // only the admin field map imports it
  return undefined;
};

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks: vendorChunk } }
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } }
});
