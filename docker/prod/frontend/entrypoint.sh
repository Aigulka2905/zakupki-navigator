#!/bin/sh
set -e

# Публикуем собранную статику в общий volume, который отдаёт nginx.
TARGET="${PUBLISH_DIR:-/srv/dist}"

echo "[frontend] публикация сборки в ${TARGET}"
mkdir -p "$TARGET"
# Чистим прежнее содержимое и копируем новое (включая dot-файлы).
# cp -r (без -a): не пытаемся сохранять чужого владельца — все файлы
# создаются от текущего non-root пользователя.
rm -rf "${TARGET:?}/"* 2>/dev/null || true
cp -r /app/dist/. "$TARGET"/
echo "[frontend] публикация завершена ($(ls -1 "$TARGET" | wc -l) элементов)"

# Контейнер остаётся живым: healthcheck проверяет наличие index.html,
# nginx стартует только после того, как статика опубликована.
exec tail -f /dev/null
