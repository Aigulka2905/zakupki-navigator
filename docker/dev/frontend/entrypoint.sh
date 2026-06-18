#!/bin/sh
set -e

# Если node_modules пуст (например, перекрыт bind-mount'ом или это первый
# запуск с anonymous volume) — ставим зависимости.
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "[frontend] node_modules пуст — выполняю npm install..."
  npm install
fi

echo "[frontend] запуск Vite dev-server на 0.0.0.0:5173"
exec npm run dev -- --host 0.0.0.0 --port 5173
