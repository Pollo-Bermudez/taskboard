import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Desarrollo fuera de Docker: reenvía /api al backend publicado en el host.
    proxy: {
      '/api': process.env.VITE_API_PROXY || 'http://localhost:3001',
    },
  },
});
