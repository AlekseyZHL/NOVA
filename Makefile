.DEFAULT_GOAL := help
SHELL := /bin/bash
.PHONY: help install setup dev start stop test test-ui test-entry ci secrets syntax docker docker-down release clean

help: ## Показать все команды
	@echo "NOVA Wallet — доступные команды"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## npm ci
	npm ci

setup: ## Создать .env с ключами (не перезаписывает существующий)
	npm run setup

dev start: ## Запустить сервер на :3000
	npm start

stop: ## Остановить локальный сервер
	-lsof -ti:3000 | xargs -r kill

test: ## 28 криптографических тестов
	npm test

test-ui: ## 16 UI-тестов (нужен сервер)
	npm run test:ui

test-entry: ## 4 теста запасного входа (нужен сервер)
	npm run test:entry

secrets: ## Проверить, что в коммит не попадают секреты
	bash scripts/check-secrets.sh

syntax: ## node --check для всех JS-файлов
	@for f in $$(find server public scripts tests -name '*.js'); do node --check $$f || exit 1; done
	@echo "  ✅ синтаксис OK"

ci: secrets syntax ## Полный прогон как в GitHub Actions
	@set -e; \
	npm run setup; \
	nohup npm start > /tmp/nova.log 2>&1 & \
	for i in $$(seq 1 40); do curl -fsS http://127.0.0.1:3000/healthz >/dev/null 2>&1 && break; sleep 1; done; \
	npm test; npm run test:ui; npm run test:entry; \
	bash scripts/check-secrets.sh

docker: ## Собрать и поднять Docker Compose
	docker compose up -d --build

docker-down: ## Остановить Docker Compose
	docker compose down

release: ## Собрать архивы без секретов: make release V=1.0.2
	python3 scripts/build_release.py $(or $(V),1.0.2)
	@ls -lh exports/NOVA-Wallet-$(or $(V),1.0.2)-*.zip

clean: ## Удалить сгенерированные архивы и логи (НЕ трогает .env и data/)
	rm -f exports/*.zip *.log /tmp/nova.log
	@echo "  ✅ .env и data/ не тронуты"
