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
                name: 'MemoryConnect Events',
                short_name: 'Events',
                description: 'Beautiful temporary shareable event pages for weddings, birthdays, graduations and more.',
                start_url: '/',
                theme_color: '#7c3aed',
                background_color: '#ffffff',
                display: 'standalone',
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
