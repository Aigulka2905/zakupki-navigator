# Запуск фронтенда (Docker) — пошагово

Фронтенд и бэкенд разворачиваются на **разных серверах**. Браузер всегда ходит
только на фронт-сервер; nginx фронтенда проксирует `/api` и `/ws` на бэкенд по
адресу из `BACKEND_UPSTREAM`. CORS не нужен.

Все команды запускаются из корня репозитория.

---

## PROD

### 1. Подготовить env-файл

```bash
make env                       # создаст docker/env/prod.env из примера (если нет)
# либо вручную: cp docker/env/prod.env.example docker/env/prod.env
```

Отредактировать `docker/env/prod.env`:

```ini
BACKEND_UPSTREAM=http://backend-host:3000   # реальный адрес/домен бэкенда
HTTP_PORT=80                                # внешний порт фронт-nginx
```

- `BACKEND_UPSTREAM` — этот `host[:port]` уходит в `Host`-заголовок к бэкенду,
  реальный домен фронта — в `X-Forwarded-Host`.
- **Локальный тест на одном хосте:** `localhost` внутри контейнера = сам
  контейнер. Чтобы достучаться до бэка на хосте, укажи IP шлюза docker0:
  `BACKEND_UPSTREAM=http://172.17.0.1:8080` (имя `host.docker.internal` nginx на
  Linux не резолвит). На реальном сервере ставь нормальный домен/IP.

### 2. Получить образы

Вариант А — собрать локально:

```bash
make prod-build                # docker compose build --pull
```

Вариант Б — стянуть из registry (на боевом сервере):

```bash
make login                     # docker login в registry (один раз)
make pull
```

### 3. Поднять стек

`make` сам подхватывает `docker/env/prod.env` (через `--env-file` в обёртке
compose), поэтому ничего экспортировать вручную не нужно.

Локальная сборка + запуск без registry:

```bash
make prod-build && make prod-up
```

На боевом сервере (образы из registry):

```bash
make deploy                    # pull + up -d (через deploy.sh)
make deploy IMAGE_TAG=v1.2.3   # конкретный тег
```

### 4. Проверить

```bash
make ps                        # статус контейнеров
make health                    # состояние healthcheck
make logs SERVICE=nginx        # логи nginx (Ctrl+C для выхода)
```

Открыть в браузере: `http://<хост>:<HTTP_PORT>` (например `http://localhost:80`).
`/api` и `/ws` проксируются на бэкенд автоматически.

### 5. Остановить / обновить

```bash
make prod-down                 # остановить и удалить контейнеры
make redeploy                  # обновить на текущий тег (pull + up)
make rollback TAG=v1.2.2       # откат на предыдущий тег
```

---

## DEV (Vite + HMR)

```bash
make env                       # создаст docker/env/dev.env (опционально)
make dev                       # сборка + foreground, Vite HMR
```

- Браузер: `http://localhost:8081` (через nginx) или `http://localhost:5173`
  (напрямую к Vite).
- Бэкенд по умолчанию — `http://host.docker.internal:8080` (локальный бэк на
  хосте). Переопределяется через `BACKEND_ORIGIN` или `docker/env/dev.env`.

Полезное:

```bash
make dev-up                    # то же в фоне
make dev-logs                  # логи
make dev-down                  # остановить
```

---

## Шпаргалка по командам

```bash
make help          # полный список целей
make validate      # проверить корректность compose-файлов
make config        # итоговая конфигурация prod-compose
make shell-nginx   # shell в контейнере nginx
make nginx-reload  # перечитать конфиг nginx без рестарта
make clean         # остановить и удалить тома (down -v)
```