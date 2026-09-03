// frontend/vite.config.ts

import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// ========================================
// Path Configuration
// ========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// Vite Configuration
// ========================================
export default defineConfig({
  // ========================================
  // Plugins
  // ========================================
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      // public/ is copied by Vite. Do not also list push-sw.js here: Workbox
      // discovers the imported helper and duplicate precache entries otherwise.
      includeAssets: ['favicon.svg', 'images/hero-farm.jpg'],
      manifest: {
        id: '/',
        name: 'گرین کود | فروشگاه تخصصی نهاده‌های کشاورزی',
        short_name: 'گرین کود',
        description: 'خرید نهاده کشاورزی، خدمات مزرعه و پیگیری سفارش',
        lang: 'fa-IR',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f3e8',
        theme_color: '#0f8a5f',
        categories: ['shopping', 'business', 'utilities'],
        icons: [
          { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'محصولات', short_name: 'محصولات', url: '/products', icons: [{ src: '/images/icon-192.png', sizes: '192x192' }] },
          { name: 'پیگیری سفارش', short_name: 'سفارش‌ها', url: '/orders', icons: [{ src: '/images/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ['push-sw.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/media\//, /^\/ops\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => [
              '/api/locations/', '/api/agri/inputs/', '/api/agri/crops/', '/api/categories/',
            ].some((path) => url.pathname.startsWith(path)),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'agricultural-reference-v2',
              expiration: { maxEntries: 150, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/products/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'catalogue-v2',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-v2',
              expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  // ========================================
  // Path Aliases
  // ✅ امکان استفاده از @ به جای مسیرهای طولانی
  // ========================================
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  // ========================================
  // Development Server Configuration
  // ✅ همه تنظیمات server در یک بلوک ادغام شدند
  // ========================================
  server: {
    port: 5173,

    // ✅ گوش دادن به همه شبکه‌ها (برای دسترسی از گوشی و شبکه محلی)
    host: '0.0.0.0',

    // ✅ اگر پورت اشغال بود، پورت بعدی را امتحان کن
    strictPort: false,

    // The development container is opened through an Arena preview hostname.
    // Keep the local default protected while allowing only that subdomain.
    allowedHosts: ['.e2b.app'],

    // ✅ فعال کردن CORS برای development
    cors: true,

    // ========================================
    // Proxy Configuration
    // ✅ همه درخواست‌های /api و /media را به Django می‌فرستد
    // ========================================
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,

        // ✅ لاگ کردن درخواست‌ها در console (برای debug)
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`📤 [Proxy] ${req.method} ${req.url} → ${options.target}`);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`📥 [Proxy] ${proxyRes.statusCode} ${req.url}`);
          });
        },
      },

      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },

      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },

    // ========================================
    // Watch Options (برای Hot Module Replacement بهتر)
    // ========================================
    watch: {
      usePolling: true,
      interval: 100,
    },

    // ========================================
    // HMR (Hot Module Replacement) Configuration
    // ========================================
    hmr: {
      overlay: true,
      protocol: 'ws',
    },

    // ========================================
    // File System Access
    // ✅ اجازه دسترسی به فایل‌های بیرون از root (برای import از مسیرهای مختلف)
    // ========================================
    fs: {
      allow: ['..'],
      strict: false,
    },
  },

  // ========================================
  // Build Configuration (Production)
  // ========================================
  build: {
    // ✅ خروجی در پوشه dist
    outDir: 'dist',

    // ✅ پاک کردن پوشه dist قبل از build
    emptyOutDir: true,

    // ✅ تولید source map برای debug در production
    sourcemap: false,

    // ✅ بهینه‌سازی chunk‌ها
    rollupOptions: {
      output: {
        manualChunks: {
          // ✅ جدا کردن vendor libraries برای cache بهتر
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-motion': ['framer-motion'],
          'vendor-utils': ['axios', 'zustand', 'clsx', 'tailwind-merge'],
        },
      },
    },

    // ✅ حداقل اندازه chunk برای جدا کردن (10KB)
    chunkSizeWarningLimit: 1000,

    // ✅ فشرده‌سازی CSS
    cssCodeSplit: true,

    // ✅ هدف: مرورگرهای مدرن
    target: 'esnext',

    // ✅ minify با esbuild (سریع‌تر از terser)
    minify: 'esbuild',
  },

  // ========================================
  // Preview Configuration (برای تست build)
  // ========================================
  preview: {
    port: 4173,
    host: '0.0.0.0',
    strictPort: true,
    open: false,
    // Playwright/Lighthouse exercise the production bundle. Keep browser API
    // calls same-origin just like development and the production reverse proxy.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },

  // ========================================
  // CSS Configuration
  // ========================================
  css: {
    devSourcemap: true,
  },
});