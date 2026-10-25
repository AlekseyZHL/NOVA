# REST API NOVA Wallet

Базовый путь: `/api`. Все приватные методы требуют заголовок `Authorization: Bearer <session>`. Тело — JSON, лимит 64 КБ. Ошибки возвращаются как `{ "error": "сообщение" }` с HTTP-кодом 400/401/403/501/502/504.

## Системные

| Метод | Путь | Описание |
|---|---|---|
| GET | `/health` | Статус, режим, сети, доступность auth, лимиты, `webapp` URL |
| GET | `/healthz` | Простой liveness probe |
| GET | `/qr.svg?text=…` | SVG QR-код (до 300 символов, кэш 5 мин) |

## Авторизация

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/auth/telegram` | `{ "initData": "…" }` | `{ token, user, firstRun }` |
| POST | `/auth/demo` | `{}` | `{ token, user, firstRun, demo:true }` — только testnet |
| GET | `/me` | — | `{ user, vault, chains, auth, limits, webapp }` |

`initData` проверяется по HMAC-SHA256 от токена бота, `auth_date` не старше 24 ч. Гостевой вход автоматически отключается в mainnet.

## Кошелёк

| Метод | Путь | Описание |
|---|---|---|
| GET | `/wallet` | `{ addresses:{evm,bitcoin,solana}, portfolio, vault }` |
| GET | `/balances?fiat=EUR` | Только портфель |
| POST | `/faucet` | `{ chain }` → airdrop Solana Devnet или `{ manual:true, faucet, address }` |
| GET | `/activity` | История + ленивое обновление статусов pending |

**Портфель:**
```json
{
  "assets": [{
    "id": "ethereum:ETH", "chain": "ethereum", "chainName": "Ethereum",
    "chainSub": "Sepolia", "symbol": "ETH", "kind": "native",
    "address": "0x…", "amount": "0.4821", "decimals": 18,
    "price": 2094.32, "fiat": 1009.6, "fiatEur": 1009.6, "fiatUsd": 1130.2,
    "priceId": "ethereum", "color": "#7b8cff", "glyph": "Ξ", "testnet": true
  }],
  "chainState": { "ethereum": true, "base": true, "bitcoin": true, "solana": true },
  "fiat": "EUR", "testnet": true, "prices": { },
  "total": { "eur": 3623.24, "fiat": "EUR" },
  "mode": "testnet",
  "note": "Тестовая сеть: монеты не имеют реальной стоимости…"
}
```

## Отправка (двухшаговый протокол)

### Шаг 1 — `POST /simulate`

```json
{ "chain": "ethereum", "to": "0x1111…1111", "asset": "ETH", "amount": "0.01" }
```

Ответ:
```json
{
  "ok": true,
  "simulation": {
    "chain": "ethereum", "chainName": "Ethereum", "to": "0x…", "from": "0x…",
    "token": "ETH", "amount": "0.01", "method": "Native transfer",
    "gas": "21000", "gasPriceGwei": 1.2, "fee": "0.0000252", "feeSymbol": "ETH",
    "flags": [{ "level": "info", "text": "…" }],
    "ready": true, "sandbox": false,
    "risk": { "usd": 23.5, "spentToday": 0, "perTx": 250, "daily": 1000 },
    "confirmToken": "<base64url>.<HMAC>"
  }
}
```

`chain` ∈ `ethereum|base|arbitrum|polygon|bitcoin|solana`. `asset` — символ нативной монеты или ERC-20 (`USDC`).

### Шаг 2 — `POST /send`

```json
{
  "chain": "ethereum", "to": "0x1111…1111", "asset": "ETH", "amount": "0.01",
  "confirmToken": "<из шага 1>"
}
```

Сервер сверяет HMAC-токен (TTL 120 с), **побайтово сверяет параметры**, повторяет `riskCheck` и симуляцию, затем подписывает и транслирует.

Ответ: `{ ok, tx, explorer }` (или `{ ok, tx, simulated:true }` в песочнице).

| Код | Причина |
|---|---|
| 400 | Параметры изменились после превью / неверный адрес / симуляция не прошла |
| 403 | Лимит, белый список, address poisoning |
| 502/504 | Ошибка или таймаут RPC |

## Настройки и безопасность

| Метод | Путь | Тело / результат |
|---|---|---|
| POST | `/settings` | `{ fiat, whitelistOnly, antiPhishing, perTxLimitUsd, dailyLimitUsd, sandbox, hideBalances }` |
| GET | `/security` | `{ vault, settings, limits, addressBook, audit, checklist }` |
| GET | `/address-book` | `{ items }` |
| POST | `/address-book` | `{ label, address, chain? }` |
| DELETE | `/address-book` | `{ id }` |
| POST | `/export` | `{ "confirm": "Я ПОНИМАЮ РИСК" }` → приватные ключи (пишется в аудит) |

## Своп

| Метод | Путь | Тело | Результат |
|---|---|---|---|
| POST | `/swap/quote` | `{ fromAsset, toAsset, amount }` | `{ quote, simulated, warning }` |
| POST | `/swap/execute` | `{ fromAsset, toAsset, amount }` | В mainnet → `501`; в testnet → симулированная запись |

`fromAsset`/`toAsset` — идентификаторы вида `ethereum:ETH`, `solana:SOL`, `base:USDC`.

## Бот

Long polling `getUpdates` обрабатывает `/start`, `/balance`, `/address`, `/security`, `/help` и callback-кнопки. При старте бот вызывает `setChatMenuButton` с WebApp-кнопкой.

## Пример полного цикла (curl)

```bash
B=http://localhost:3000
T=$(curl -s -X POST $B/api/auth/demo -H 'content-type: application/json' -d '{}' | jq -r .token)
curl -s $B/api/wallet -H "authorization: Bearer $T" | jq .addresses

SIM=$(curl -s -X POST $B/api/simulate -H "authorization: Bearer $T" \
  -H 'content-type: application/json' \
  -d '{"chain":"solana","to":"<base58>","asset":"SOL","amount":"0.01"}')
CT=$(echo "$SIM" | jq -r .simulation.confirmToken)

curl -s -X POST $B/api/send -H "authorization: Bearer $T" \
  -H 'content-type: application/json' \
  -d "{\"chain\":\"solana\",\"to\":\"<base58>\",\"asset\":\"SOL\",\"amount\":\"0.01\",\"confirmToken\":\"$CT\"}"
```
