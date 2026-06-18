#!/usr/bin/env bash
# Откат на предыдущий (или указанный) тег образа.
# Использование: ./docker/scripts/rollback.sh <tag>
#   <tag> — тег, на который откатываемся (обязателен).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$ROOT/docker/prod/docker-compose.prod.yml"

if [ "$#" -lt 1 ]; then
  echo "Ошибка: укажите тег для отката." >&2
  echo "Использование: $0 <tag>" >&2
  exit 1
fi

ENV_FILE="$ROOT/docker/env/prod.env"
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

export REGISTRY="${REGISTRY:-registry.soderiz.ru}"
export IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-zakupki-ai}"
export IMAGE_TAG="$1"

echo "▶ Откат на тег ${IMAGE_TAG}"

docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "✔ Откат выполнен. Активный тег: ${IMAGE_TAG}"
docker compose -f "$COMPOSE_FILE" ps
