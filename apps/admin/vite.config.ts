import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { networkUrlsPlugin } from '../../scripts/vite-network-urls';

export default defineConfig({
  plugins: [react(), tailwindcss(), networkUrlsPlugin('Admin Portal', 5173)],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
