# ─────────────────────────────────────────────────────────────
# ZakupkiAI frontend — Docker управление
#
#   make            → список команд (help)
#   make dev        → dev-окружение (Vite HMR + nginx)
#   make deploy     → деплой на сервере (pull + up -d)
#
# Тег образа можно переопределить:  make prod-build IMAGE_TAG=v1.2.3
# ─────────────────────────────────────────────────────────────

# ── env-файлы ────────────────────────────────────────────────
# Передаём env-файл самому compose через --env-file, чтобы переменные
# (${BACKEND_UPSTREAM}, ${HTTP_PORT}, ...) подставлялись при интерполяции
# compose-файла. Флаг добавляется только если файл существует — иначе
# работают значения по умолчанию из compose. Так все make-цели подхватывают
# env автоматически, без ручного `set -a; . prod.env`.
DEV_ENV_FILE  := docker/env/dev.env
PROD_ENV_FILE := docker/env/prod.env
DEV_ENV_FLAG  := $(if $(wildcard $(DEV_ENV_FILE)),--env-file $(DEV_ENV_FILE),)
PROD_ENV_FLAG := $(if $(wildcard $(PROD_ENV_FILE)),--env-file $(PROD_ENV_FILE),)

# ── Compose-обёртки ──────────────────────────────────────────
DC_DEV   := docker compose $(DEV_ENV_FLAG) -f docker/dev/docker-compose.yml
DC_PROD  := docker compose $(PROD_ENV_FLAG) -f docker/prod/docker-compose.prod.yml

# ── Параметры образа (можно переопределить из окружения/CLI) ──
REGISTRY        ?= registry.soderiz.ru
IMAGE_NAMESPACE ?= zakupki-ai
IMAGE_TAG       ?= latest
SERVICE         ?= frontend

# Экспортируем, чтобы значения подставлялись в image: внутри compose.
export REGISTRY
export IMAGE_NAMESPACE
export IMAGE_TAG

.DEFAULT_GOAL := help
.PHONY: help \
        dev dev-build dev-up dev-down dev-restart dev-logs dev-ps \
        prod-build prod-up prod-down prod-restart prod-stop prod-start \
        build push pull login tag release deploy redeploy rollback \
        logs ps stats top health restart shell-frontend shell-nginx nginx-reload \
        config config-dev validate env clean clean-all prune \
        lint test install

# ═════════════════════════════════════════════════════════════
# Help
# ═════════════════════════════════════════════════════════════
help: ## Показать список команд
	@echo "ZakupkiAI frontend — Makefile"
	@echo "Образ: $(REGISTRY)/$(IMAGE_NAMESPACE)/{frontend,nginx}:$(IMAGE_TAG)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ═════════════════════════════════════════════════════════════
# DEV
# ═════════════════════════════════════════════════════════════
dev: ## Поднять dev-окружение (сборка + foreground, Vite HMR)
	$(DC_DEV) up --build

dev-build: ## Собрать dev-образы
	$(DC_DEV) build

dev-up: ## Поднять dev-окружение в фоне
	$(DC_DEV) up -d --build

dev-down: ## Остановить и удалить dev-окружение
	$(DC_DEV) down

dev-restart: ## Перезапустить dev-окружение
	$(DC_DEV) restart

dev-logs: ## Логи dev-стека (follow)
	$(DC_DEV) logs -f --tail=100

dev-ps: ## Статус dev-контейнеров
	$(DC_DEV) ps

# ═════════════════════════════════════════════════════════════
# PROD — жизненный цикл
# ═════════════════════════════════════════════════════════════
prod-build: ## Собрать production-образы (--pull базовых)
	$(DC_PROD) build --pull

prod-up: ## Поднять production-стек в фоне
	$(DC_PROD) up -d

prod-down: ## Остановить и удалить production-стек
	$(DC_PROD) down

prod-stop: ## Остановить контейнеры (без удаления)
	$(DC_PROD) stop

prod-start: ## Запустить ранее остановленные контейнеры
	$(DC_PROD) start

prod-restart: ## Перезапустить production-стек
	$(DC_PROD) restart

# ═════════════════════════════════════════════════════════════
# Registry / CI
# ═════════════════════════════════════════════════════════════
login: ## docker login в registry
	docker login $(REGISTRY)

build: ## Собрать prod-образы скриптом (build.sh)
	./docker/scripts/build.sh $(IMAGE_TAG)

push: ## Запушить образы в registry
	$(DC_PROD) push

pull: ## Стянуть образы из registry
	$(DC_PROD) pull

tag: ## Перетегировать образы текущего тега в registry (TAG=...)
	docker tag $(REGISTRY)/$(IMAGE_NAMESPACE)/frontend:$(IMAGE_TAG) $(REGISTRY)/$(IMAGE_NAMESPACE)/frontend:$(TAG)
	docker tag $(REGISTRY)/$(IMAGE_NAMESPACE)/nginx:$(IMAGE_TAG)    $(REGISTRY)/$(IMAGE_NAMESPACE)/nginx:$(TAG)

release: prod-build push ## Собрать и запушить образы (build + push)

# ═════════════════════════════════════════════════════════════
# Deploy / Rollback
# ═════════════════════════════════════════════════════════════
deploy: ## Деплой на сервере (pull + up -d) [IMAGE_TAG=...]
	./docker/scripts/deploy.sh $(IMAGE_TAG)

redeploy: pull prod-up ## Пере-деплой текущего тега (pull + up -d)

rollback: ## Откат на указанный тег: make rollback TAG=v1.2.2
	@test -n "$(TAG)" || { echo "Укажите тег: make rollback TAG=<tag>"; exit 1; }
	./docker/scripts/rollback.sh $(TAG)

# ═════════════════════════════════════════════════════════════
# Эксплуатация / диагностика
# ═════════════════════════════════════════════════════════════
logs: ## Логи production-стека (follow). Можно SERVICE=nginx
	$(DC_PROD) logs -f --tail=100 $(SERVICE)

ps: ## Статус production-контейнеров
	$(DC_PROD) ps

stats: ## Потребление ресурсов контейнерами стека
	docker stats $$($(DC_PROD) ps -q)

top: ## Процессы внутри контейнеров стека
	$(DC_PROD) top

health: ## Состояние healthcheck сервисов
	@docker inspect --format '{{.Name}}: {{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' $$($(DC_PROD) ps -q)

restart: ## Перезапустить один сервис: make restart SERVICE=nginx
	$(DC_PROD) restart $(SERVICE)

nginx-reload: ## Перечитать конфигурацию nginx без рестарта
	$(DC_PROD) exec nginx nginx -s reload

shell-frontend: ## Shell в контейнере frontend
	$(DC_PROD) exec frontend sh

shell-nginx: ## Shell в контейнере nginx
	$(DC_PROD) exec nginx sh

# ═════════════════════════════════════════════════════════════
# Конфигурация / окружение
# ═════════════════════════════════════════════════════════════
config: ## Показать итоговую конфигурацию prod-compose
	$(DC_PROD) config

config-dev: ## Показать итоговую конфигурацию dev-compose
	$(DC_DEV) config

validate: ## Проверить корректность обоих compose-файлов
	@$(DC_DEV) config -q  && echo "dev  compose: OK"
	@$(DC_PROD) config -q && echo "prod compose: OK"

env: ## Создать docker/env/*.env из примеров (если отсутствуют)
	@test -f docker/env/dev.env  || cp docker/env/dev.env.example  docker/env/dev.env  && echo "created docker/env/dev.env"
	@test -f docker/env/prod.env || cp docker/env/prod.env.example docker/env/prod.env && echo "created docker/env/prod.env"

# ═════════════════════════════════════════════════════════════
# Очистка
# ═════════════════════════════════════════════════════════════
clean: ## Остановить стек и удалить тома (down -v)
	$(DC_PROD) down -v --remove-orphans
	$(DC_DEV)  down -v --remove-orphans

clean-all: clean ## Очистка + удаление собранных образов проекта
	-docker rmi $(REGISTRY)/$(IMAGE_NAMESPACE)/frontend:$(IMAGE_TAG) $(REGISTRY)/$(IMAGE_NAMESPACE)/nginx:$(IMAGE_TAG) 2>/dev/null || true
	-docker rmi $(REGISTRY)/$(IMAGE_NAMESPACE)/frontend:dev $(REGISTRY)/$(IMAGE_NAMESPACE)/nginx:dev 2>/dev/null || true

prune: ## Удалить «висящие» образы/слои Docker (docker image prune)
	docker image prune -f

# ═════════════════════════════════════════════════════════════
# Качество кода (внутри dev-контейнера, node не нужен на хосте)
# ═════════════════════════════════════════════════════════════
install: ## Установить зависимости в dev-контейнере
	$(DC_DEV) run --rm frontend npm install

lint: ## Линт в dev-контейнере
	$(DC_DEV) run --rm frontend npm run lint

test: ## Тесты в dev-контейнере
	$(DC_DEV) run --rm frontend npm test
