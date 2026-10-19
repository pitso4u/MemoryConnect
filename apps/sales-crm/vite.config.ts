import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { networkUrlsPlugin } from '../../scripts/vite-network-urls';

export default defineConfig({
  plugins: [react(), networkUrlsPlugin('SmartSales CRM', 5176)],
  server: {
    host: '0.0.0.0',
    port: 5176,
  },
});
