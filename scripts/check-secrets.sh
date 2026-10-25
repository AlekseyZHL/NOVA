#!/usr/bin/env bash
# Fails if a secret would be committed. Runs locally and in CI.
# Scans BOTH the Git index and the working tree (excluding real .env / data/).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "🔍 NOVA Wallet — secret scan"
bad=0

# --- 1. Forbidden files in the Git index ---
mapfile -t TRACKED < <(git ls-files 2>/dev/null || true)
for p in "${TRACKED[@]}"; do
  case "$p" in
    .env.example) ;; # шаблон без секретов — разрешён
    .env|.env.*|data/*|*.key|*vault.enc|*db.json)
      echo "  ❌ запрещённый файл в индексе Git: $p"; bad=1 ;;
  esac
done
[ "${#TRACKED[@]}" -eq 0 ] && echo "  ℹ️  Git-индекс пуст — проверяем только рабочее дерево"

# --- 2. Working tree: token- and key-like strings ---
mapfile -t FILES < <(find . -type f \
  -not -path './.git/*' -not -path './node_modules/*' -not -path './exports/*' \
  -not -path './data/*' -not -path './.env' -not -path './.env.*' \
  -not -name 'check-secrets.sh' -not -name '*.zip' -not -name 'package-lock.json' \
  -not -name '*.svg' -not -name '*.png' || true)

EXCLUDES=(--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=exports
          --exclude-dir=data --exclude=check-secrets.sh --exclude=.env
          --exclude='.env.*' --exclude='*.zip' --exclude=package-lock.json
          --exclude='*.svg' --exclude='*.png')

TOKEN_RE='[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}'
SECRET_RE='(VAULT_KEY|SESSION_SECRET|MASTER_MNEMONIC)=[0-9a-fA-F]{40,}'
MNEMONIC_RE='(abandon|zoo|legal|winner|military|ivory)[a-z]* ([a-z]+ ){10,}[a-z]+'

for pattern in "$TOKEN_RE" "$SECRET_RE" "$MNEMONIC_RE"; do
  hits="$(grep -rnE "${EXCLUDES[@]}" "$pattern" . 2>/dev/null || true)"
  if [ -n "$hits" ]; then
    echo "  ❌ подозрительная строка (шаблон: ${pattern:0:34}…):"
    echo "$hits" | head -5 | sed 's/^/     /'
    bad=1
  fi
done

# --- 3. .env.example must never contain real values ---
if grep -qE '^BOT_TOKEN=.+' .env.example 2>/dev/null; then
  echo "  ❌ .env.example содержит непустой BOT_TOKEN"; bad=1
fi

if [ "$bad" -ne 0 ]; then
  echo "🚫 Секреты обнаружены — коммит запрещён."; exit 1
fi
echo "  ✅ ${#FILES[@]} файлов проверено, секретов нет."
