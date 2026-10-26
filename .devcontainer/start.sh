#!/usr/bin/env bash
# Запускается автоматически при старте GitHub Codespace.
# Подставляет публичный URL Codespace в WEBAPP_URL, чтобы Telegram-бот
# и initData-авторизация работали без ручной настройки.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  npm run setup
fi

if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
  URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  if grep -q '^WEBAPP_URL=' .env; then
    sed -i "s|^WEBAPP_URL=.*|WEBAPP_URL=${URL}|" .env
  else
    printf '\nWEBAPP_URL=%s\n' "$URL" >> .env
  fi
  echo "🌐 WEBAPP_URL = $URL"
  echo "⚠️  Сделайте порт 3000 публичным: вкладка PORTS → правый клик → Port Visibility → Public."
else
  echo "ℹ️  Локальный запуск: Codespaces-переменные не найдены."
fi

echo "🚀 NOVA Wallet → http://localhost:3000"
exec npm start
