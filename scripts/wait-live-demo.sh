#!/usr/bin/env bash
# Держит job живым, пока работает демо, запущенное run-live-demo.sh.
# Usage: scripts/wait-live-demo.sh [hours]
set -euo pipefail
HOURS="${1:-3}"
SECS=$(( HOURS * 3600 ))
END=$(( SECONDS + SECS ))
echo "⏳ Держим демо ${HOURS} ч..."
while [ "$SECONDS" -lt "$END" ]; do
  sleep 60
  if ! curl -fsS http://127.0.0.1:3000/healthz >/dev/null 2>&1; then
    echo "❌ Сервер не отвечает"; tail -40 /tmp/nova-server.log 2>/dev/null || true; exit 1
  fi
  REMAIN=$(( (END - SECONDS) / 60 ))
  echo "  ✅ $(date -u +%H:%M:%S) UTC —alive, осталось ~${REMAIN} мин"
done
echo "✅ Время вышло."
