# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# PROD nginx: отдаёт статику фронтенда из общего volume и проксирует
# /api на backend. nginx.conf — template, ${BACKEND_UPSTREAM}
# подставляется через envsubst официальным entrypoint'ом nginx.
# ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Убираем дефолтный конфиг и приветственную статику nginx. Каталог отдаём
# uid/gid 1001 — тому же, под которым работает publisher фронтенда, чтобы
# общий volume оставался writable для non-root publisher'а (см. frontend).
RUN rm -f /etc/nginx/conf.d/default.conf \
 && rm -rf /usr/share/nginx/html/* \
 && chown -R 1001:1001 /usr/share/nginx/html

COPY docker/prod/nginx/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
