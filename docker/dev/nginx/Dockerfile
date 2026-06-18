# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# DEV nginx: reverse-proxy перед Vite dev-server и backend API.
# nginx.conf подаётся как template — официальный entrypoint nginx
# прогоняет его через envsubst (подставляет ${BACKEND_UPSTREAM} и
# ${FRONTEND_UPSTREAM}) на старте контейнера.
# ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY docker/dev/nginx/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
