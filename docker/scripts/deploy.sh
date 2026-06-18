#!/usr/bin/env bash
# Деплой на сервере: тянем свежие образы из registry и поднимаем стек.
# Использование: ./docker/scripts/deploy.sh [tag]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$ROOT/docker/prod/docker-compose.prod.yml"

ENV_FILE="$ROOT/docker/env/prod.env"
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

export REGISTRY="${REGISTRY:-registry.soderiz.ru}"
export IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-zakupki-ai}"
export IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"

echo "▶ Деплой тега ${IMAGE_TAG}"

echo "  → docker compose pull"
docker compose -f "$COMPOSE_FILE" pull

echo "  → docker compose up -d"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "  → ожидание healthcheck..."
docker compose -f "$COMPOSE_FILE" ps

echo "✔ Деплой завершён (тег ${IMAGE_TAG})."
