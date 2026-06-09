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
    proxy: {
      '/api': {
        target: 'http://localhost:4002',
        changeOrigin: true,
        secure: false,
        ws: true, // Поддержка WebSocket для real-time уведомлений
      },
    },
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
}));