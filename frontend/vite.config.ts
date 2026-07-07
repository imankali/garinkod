// frontend/vite.config.ts

import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

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

    // ✅ باز کردن خودکار مرورگر هنگام شروع سرور
    open: true,

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
    open: true,
  },

  // ========================================
  // CSS Configuration
  // ========================================
  css: {
    devSourcemap: true,
  },
});