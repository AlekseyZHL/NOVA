#!/usr/bin/env bash
# NOVA Wallet — поднимает ПОЛНОЕ приложение (Node + опционально бот) с публичным
# HTTPS-адресом через cloudflared quick tunnel. Используется workflow
# .github/workflows/live-demo.yml, но работает и локально.
#
# Процессы остаются в фоне ПОСЛЕ выхода скрипта — поэтому шаг workflow
# завершается сразу, а сервер живёт до отдельного steps "Keep alive".
#
# Usage: scripts/run-live-demo.sh [hours]
#   BOT_TOKEN — необязательно, включает Telegram-бота.
#   CF_BIN    — путь к cloudflared (по умолчанию /tmp/cloudflared).
set -euo pipefail
cd "$(dirname "$0")/.."

HOURS="${1:-3}"
CF="${CF_BIN:-/tmp/cloudflared}"
PORT="${PORT:-3000}"

# ---------------------------------------------------------------- cloudflared
if [ ! -x "$CF" ]; then
  echo "⬇️  downloading cloudflared…"
  curl -fsSL --max-time 180 -o "$CF" \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$CF"
fi

nohup "$CF" tunnel --url "http://127.0.0.1:${PORT}" --protocol http2 \
  --no-autoupdate --loglevel info > /tmp/nova-tunnel.log 2>&1 &
disown || true

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/nova-tunnel.log | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 2
done
if [ -z "$URL" ]; then
  echo "❌ Не удалось получить URL туннеля"; cat /tmp/nova-tunnel.log; exit 1
fi
echo "🌐 Public URL: $URL"
echo "$URL" > /tmp/nova-public-url.txt

# ---------------------------------------------------------------- .env
[ -f .env ] || npm run setup
if grep -q '^WEBAPP_URL=' .env; then
  sed -i "s|^WEBAPP_URL=.*|WEBAPP_URL=${URL}|" .env
else
  printf '\nWEBAPP_URL=%s\n' "$URL" >> .env
fi
if [ -n "${BOT_TOKEN:-}" ]; then
  if grep -q '^BOT_TOKEN=' .env; then
    sed -i "s|^BOT_TOKEN=.*|BOT_TOKEN=${BOT_TOKEN}|" .env
  else
    printf 'BOT_TOKEN=%s\n' "$BOT_TOKEN" >> .env
  fi
  echo "🤖 Telegram-бот включён (значение токена не логируется)"
fi
chmod 600 .env

# ---------------------------------------------------------------- server
nohup npm start > /tmp/nova-server.log 2>&1 &
disown || true
for _ in $(seq 1 60); do
  curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:${PORT}/api/health" | head -c 260; echo

# ---------------------------------------------------------------- report
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  BOT_LINE='Бот выключен — добавьте секрет `BOT_TOKEN` и перезапустите workflow, чтобы включить Telegram-вход.'
  [ -n "${BOT_TOKEN:-}" ] && BOT_LINE='Бот активен: кнопка меню указывает на этот адрес.'
  cat >> "$GITHUB_STEP_SUMMARY" <<EOF

## 🚀 NOVA Wallet — живое демо

**Откройте: $URL**

- Режим: \`testnet\`, guest-вход включён, живые балансы шести тестовых сетей.
- $BOT_LINE
- Адрес временный: перестанет работать через ${HOURS} ч или при отмене workflow.

> ⚠️ Это демо на runner GitHub Actions. Для постоянного адреса используйте
> Codespaces или Render/Railway/Fly — см. docs/DEPLOYMENT.md.
EOF
fi
echo "::notice title=NOVA Wallet is live::${URL}"
echo "✅ Сервер и туннель запущены в фоне."
