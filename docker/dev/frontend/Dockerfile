# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# DEV образ фронтенда: Vite dev-server с HMR.
# Исходники монтируются через bind-mount (см. docker-compose.yml),
# поэтому в образ кладём только зависимости и точку входа.
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Polling нужен, чтобы файловый watcher видел изменения в смонтированных
# томах на Docker Desktop (macOS/Windows) и некоторых FS на Linux.
ENV CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true \
    NODE_ENV=development

# Сначала зависимости — отдельный слой для кэширования.
COPY package.json package-lock.json ./
RUN npm install

# Точка входа: доустановка зависимостей при необходимости + запуск Vite.
COPY docker/dev/frontend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
