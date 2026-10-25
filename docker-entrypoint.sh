#!/bin/sh
# NOVA Wallet container entrypoint.
# The app derives its keys from VAULT_KEY / SESSION_SECRET (env) or, if those
# are absent, generates data/*.key on the persistent volume. Both modes need
# /app/data to survive redeploys.
set -eu
cd /app
mkdir -p data

if [ -z "${VAULT_KEY:-}" ] || [ -z "${SESSION_SECRET:-}" ]; then
  cat >&2 <<'WARN'
┌──────────────────────────────────────────────────────────────────────┐
│ NOVA Wallet: VAULT_KEY / SESSION_SECRET are not injected.              │
│ Generating key files inside /app/data. Back up this volume OFFLINE.    │
│ Losing it means losing every derived key — funds cannot be recovered.  │
│ For production set both variables to 64 hex chars from your KMS.      │
└──────────────────────────────────────────────────────────────────────┘
WARN
fi

exec "$@"
