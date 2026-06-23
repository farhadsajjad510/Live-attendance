import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // FIX (production crash): esbuild options must be at TOP LEVEL in Vite 5,
  // NOT inside build.esbuildOptions (which is silently ignored / causes issues).
  esbuild: {
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
  },

  // html5-qrcode accesses document/navigator at module init in its CJS bundle.
  // Excluding it prevents Vite's Node.js pre-bundler from crashing.
  optimizeDeps: {
    exclude: ['html5-qrcode'],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'react-hot-toast',
      'lucide-react',
    ],
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        // Strategic chunk splitting — each role's pages in separate chunks
        // so a student never downloads chairman/owner code
        manualChunks(id) {
          // Core React runtime — always needed first
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/scheduler/')
          ) return 'vendor-react';

          // Firebase — loaded after auth
          if (
            id.includes('node_modules/firebase/') ||
            id.includes('node_modules/@firebase/')
          ) return 'vendor-firebase';

          // Charts — only analytics/reports pages
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-')
          ) return 'vendor-charts';

          // QR code generation — only attendance pages
          if (id.includes('node_modules/qrcode')) return 'vendor-qr';

          // Export — only reports pages (loaded on demand)
          if (
            id.includes('node_modules/xlsx') ||
            id.includes('node_modules/jspdf')
          ) return 'vendor-export';

          // UI — icons + toasts, used everywhere
          if (
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/react-hot-toast')
          ) return 'vendor-ui';

          // html5-qrcode is dynamically imported — never appears here
        },

        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },
  },

  resolve: { alias: { '@': '/src' } },
});
