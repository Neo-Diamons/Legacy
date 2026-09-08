import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
// Dev server proxies the API to the Express backend so the client keeps calling
// same-origin paths (`/items`). Production build lands in `dist/` and is deployed
// as a standalone static bundle (the backend does not serve it).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/items': 'http://localhost:3000',
    },
  },
});
