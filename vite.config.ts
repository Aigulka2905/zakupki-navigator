import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      overlay: false,
    },
    // 🔗 ПРОКСИ ДЛЯ ПОДКЛЮЧЕНИЯ К БЭКЕНДУ
    // В Docker dev-окружении трафик идёт через nginx, но при прямом доступе
    // к Vite (порт 5173) цель проксирования берётся из env, иначе localhost.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4002',
        changeOrigin: true,
        secure: false,
        ws: true, // Поддержка WebSocket для real-time уведомлений
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core"
    ],
  },
  // 🔧 Оптимизация зависимостей для стабильной работы
  optimizeDeps: {
    include: ['@tanstack/react-query', '@tanstack/query-core'],
  },
  // 🚀 Production-сборка: разбиваем вендоры на отдельные чанки, чтобы тяжёлые
  // библиотеки (recharts) не попадали в общий бандл и кэшировались отдельно.
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Выносим только тяжёлый и независимый набор графиков. React и все
          // его потребители остаются в одном `vendor`-чанке — дробление
          // React-экосистемы по чанкам приводит к циклическим зависимостям
          // между чанками и ошибке инициализации (React === undefined →
          // "Cannot read properties of undefined (reading 'createContext')").
          if (id.includes('recharts') || id.includes('/d3-')) return 'charts';
          return 'vendor';
        },
      },
    },
  },
}));