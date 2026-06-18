#!/usr/bin/env bash
# Сборка production-образов фронтенда и nginx.
# Использование: ./docker/scripts/build.sh [tag]
#   tag — необязательный тег образа (по умолчанию из env или "latest").
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$ROOT/docker/prod/docker-compose.prod.yml"

# Подхватываем переменные из prod.env, если он есть.
ENV_FILE="$ROOT/docker/env/prod.env"
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

export REGISTRY="${REGISTRY:-registry.soderiz.ru}"
export IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-zakupki-ai}"
export IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"

echo "▶ Сборка образов ${REGISTRY}/${IMAGE_NAMESPACE}/{frontend,nginx}:${IMAGE_TAG}"
docker compose -f "$COMPOSE_FILE" build --pull

echo "✔ Готово. Собранные образы:"
docker images --filter "reference=${REGISTRY}/${IMAGE_NAMESPACE}/*:${IMAGE_TAG}" \
  --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'
