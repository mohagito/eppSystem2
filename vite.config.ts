import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,ico,png,webp}'],
          maximumFileSizeToCacheInBytes: 4000000
        },
        manifest: {
          name: 'EPP Airbag MES',
          short_name: 'EPP MES',
          description: 'Production Tracking and Manufacturing Execution System for Airbag Assembly Operations',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/logo-192.webp',
              sizes: '192x192',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: '/logo-512.webp',
              sizes: '512x512',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: '/logo-maskable.webp',
              sizes: '512x512',
              type: 'image/webp',
              purpose: 'maskable'
            }
          ]
        },
        devOptions: {
          enabled: true
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
