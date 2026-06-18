# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# PROD образ фронтенда — multi-stage.
#   builder:  node:22-alpine → npm ci → npm run build → /app/dist
#   runner:   минимальный образ, который публикует собранную статику
#             в общий volume (его читает nginx). Работает под non-root.
# ─────────────────────────────────────────────────────────────

# ── Stage 1: сборка production-бандла ───────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# ВАЖНО: не выставляем NODE_ENV=production до установки — иначе npm ci
# пропустит devDependencies (vite, typescript и т.д.). `vite build` сам
# собирает production-бандл независимо от NODE_ENV.

# Базовый URL API можно переопределить на этапе сборки (по умолчанию
# относительный /api → тот же origin через nginx).
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Детерминированная установка из lock-файла (включая devDependencies).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: публикатор статики (non-root) ──────────────────
FROM node:22-alpine AS runner

# Непривилегированный пользователь с фиксированным uid/gid 1001.
# Тот же uid выставляется на каталог статики в nginx-образе, поэтому общий
# named volume оказывается writable для non-root независимо от того, какой
# контейнер инициализировал (seed) том первым.
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app

# /app/dist — собранная статика; /srv/dist — точка монтирования общего volume.
# Создаём /srv/dist заранее и отдаём его app, чтобы свежий named volume
# унаследовал владельца и non-root мог в него писать.
RUN mkdir -p /srv/dist && chown -R app:app /srv/dist

WORKDIR /app
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --chown=app:app docker/prod/frontend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER app

ENV PUBLISH_DIR=/srv/dist

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
