import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { networkUrlsPlugin } from '../../scripts/vite-network-urls';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    networkUrlsPlugin('Memorial Portal', 5174),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'brand/memory-connect-favicon-16.png',
        'brand/memory-connect-favicon-32.png',
        'brand/memory-connect-apple-touch-icon.png',
      ],
      manifest: {
        name: 'Memory Connect',
        short_name: 'Memory Connect',
        description: 'Digital funeral programmes and memorials for South African funeral homes.',
        start_url: '/',
        theme_color: '#0b2346',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/brand/memory-connect-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/brand/memory-connect-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        cacheId: 'memory-connect-public-v2',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /\/api\/v1\/public\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
  },
});
