import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function fixDistPermissionsPlugin() {
  const fixPermissionsRecursive = (targetPath: string) => {
    if (!fs.existsSync(targetPath)) return;
    try {
      fs.chmodSync(targetPath, 0o777);
      if (typeof process.getuid === 'function' && process.getuid() === 0) {
        fs.chownSync(targetPath, 1000, 1000);
      }
    } catch {}
    try {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(targetPath)) {
          fixPermissionsRecursive(path.join(targetPath, entry));
        }
      }
    } catch {}
  };

  return {
    name: 'fix-dist-permissions',
    closeBundle() {
      fixPermissionsRecursive(path.resolve(__dirname, 'dist'));
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      fixDistPermissionsPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'motion'],
            'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
            'charts-vendor': ['recharts'],
            'xlsx-vendor': ['xlsx'],
            'exceljs-vendor': ['exceljs'],
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
