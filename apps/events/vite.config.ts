import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Events Connect by MemoryConnect',
        short_name: 'Events Connect',
        description: 'Beautiful temporary shareable event pages for weddings, birthdays, graduations and more.',
        start_url: '/',
        theme_color: '#15365d',
        background_color: '#f7f5ef',
        display: 'standalone',
        icons: [{ src: '/events-connect-mark.png', sizes: 'any', type: 'image/png' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
  server: { host: '0.0.0.0', port: 5177 },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/]event-shared/],
    },
  },
});
