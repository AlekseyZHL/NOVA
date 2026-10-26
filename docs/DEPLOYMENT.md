# ☁️ Деплой NOVA Wallet

> [!WARNING]
> **Это TESTNET MVP без аудита.** Не деплойте его с реальными средствами и не включайте
> `ALLOW_MAINNET=true`. Публичный сервер = публичная цель: минимум — TLS, rate limiting,
> мониторинг и офлайн-бэкап ключей.

---

## 1. Что нужно понять до начала

NOVA Wallet — это **обычный Node.js-процесс с постоянным хранилищем**:
он держит Express API, раздаёт Mini App и (опционально) long polling Telegram-бота.
Поэтому:

| Подходит | Не подходит |
|---|---|
| VPS, Render, Railway, Fly.io, Docker, любой PaaS с диском | GitHub Pages, Vercel/Netlify Functions, Cloudflare Workers, AWS Lambda |
| Постоянный том для `data/` | Stateless-окружения без диска |

**Почему том обязателен:** в `data/` лежат запечатанный master seed (`vault.enc`),
ключи (`vault.key`, `session.key` — если не заданы через env) и `db.json`.
Если том сотрётся при редеплое, все адреса и средства будут потеряны навсегда.

---

## 2. Переменные окружения

| Переменная | Обязательна | По умолчанию | Комментарий |
|---|---|---|---|
| `PORT` | нет | `3000` | PaaS обычно подставляет сам |
| `ALLOW_MAINNET` | **да** | `false` | **Держите `false`**. `true` = реальные средства |
| `VAULT_KEY` | рекомендуется | генерируется в `data/vault.key` | 64 hex-символа (32 байта) из KMS |
| `SESSION_SECRET` | рекомендуется | генерируется в `data/session.key` | 64 hex-символа |
| `MASTER_MNEMONIC` | нет | генерируется | Импорт существующего BIP-39 seed (24 слова) |
| `BOT_TOKEN` | для Telegram | — | Токен от @BotFather. Без него работает только браузерный режим |
| `WEBAPP_URL` | для Telegram | `http://localhost:3000` | Публичный HTTPS-адрес Mini App |
| `DEMO_AUTH` | нет | `true` | Гостевой вход. В mainnet игнорируется |
| `PER_TX_LIMIT_USD` | нет | `250` | Лимит на операцию |
| `DAILY_LIMIT_USD` | нет | `1000` | Дневной лимит |
| `INITDATA_MAX_AGE` | нет | `86400` | Максимальный возраст `initData`, сек |
| `*_RPC` | нет | публичные ноды | Свои RPC — см. `.env.example` |

Сгенерировать ключи:

```bash
openssl rand -hex 32   # VAULT_KEY
openssl rand -hex 32   # SESSION_SECRET
```

> 🔴 **Один раз задали — больше не меняйте.** Смена `VAULT_KEY` сделает `vault.enc` нечитаемым.
> Храните `VAULT_KEY`, `SESSION_SECRET`, `vault.enc` и `db.json` в офлайн-бэкапе.

---

## 3. Локальный прод-подобный запуск

```bash
cp .env.example .env
# заполните VAULT_KEY, SESSION_SECRET, BOT_TOKEN, WEBAPP_URL
npm ci --omit=dev
npm start
curl http://localhost:3000/healthz
```

---

## 4. Docker

### Compose (рекомендуется)

```bash
export VAULT_KEY=$(openssl rand -hex 32)
export SESSION_SECRET=$(openssl rand -hex 32)
export BOT_TOKEN="..."
export WEBAPP_URL="https://wallet.example.com"

docker compose up -d --build
docker compose logs -f
docker compose exec nova wget -qO- http://127.0.0.1:3000/healthz
```

`docker-compose.yml` монтирует `nova-data:/app/data`. Бэкап тома:

```bash
docker run --rm -v nova-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/nova-data-backup.tgz -C /data .
```

> Храните этот архив в шифрованном виде: внутри ключи и master seed.

### Чистый образ

```bash
docker build -t nova-wallet .
docker run -d --name nova -p 3000:3000 \
  -e VAULT_KEY="$(openssl rand -hex 32)" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e ALLOW_MAINNET=false \
  -v nova-data:/app/data \
  nova-wallet
```

`Dockerfile`: Node 20 Alpine, `npm ci --omit=dev`, непривилегированный пользователь `nova`,
`HEALTHCHECK` на `/healthz`, `tini` для корректной обработки сигналов.

---

## 5. Платформы «один клик»

### Render — [`render.yaml`](../render.yaml)

1. Fork → **New → Blueprint** → укажите репозиторий.
2. Render подхватит `render.yaml`, создаст web-сервис и диск `nova-data` на `/app/data`.
3. Заполните `BOT_TOKEN` и `WEBAPP_URL` (помечены `sync: false`).
4. Опционально задайте `VAULT_KEY` / `SESSION_SECRET` вручную (64 hex). Если не задать —
   сгенерируются файлы ключей на диске (**сделайте бэкап диска**).
5. Health check: `/healthz`.

### Railway — [`railway.json`](../railway.json)

```bash
railway login
railway init
railway up
railway variables set BOT_TOKEN=... WEBAPP_URL=https://... ALLOW_MAINNET=false
railway volume add nova-data --mount /app/data
railway domain
```

### Fly.io — [`fly.toml`](../fly.toml)

```bash
fly launch --no-deploy --copy-config
fly volumes create nova_data --region fra --size 1
fly secrets set BOT_TOKEN=... WEBAPP_URL=https://...
fly deploy
fly status
```

Уже настроены `force_https`, HTTP-check `/healthz`, постоянный volume и минимум одна машина.

### Другие PaaS

Используйте [`Procfile`](../Procfile): `web: node server/index.js`.
Главное — постоянный диск для `/app/data` и переменные из раздела 2.

---

## 6. TLS и reverse proxy (VPS)

NOVA Wallet **не терминирует TLS**. За ним нужен Nginx/Caddy/Traefik.
Пример для Caddy (автоматические сертификаты):

```caddyfile
wallet.example.com {
    reverse_proxy 127.0.0.1:3000
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
    }
}
```

> ⚠️ **Не ставьте `X-Frame-Options: DENY` и `frame-ancestors 'none'`.**
> Telegram открывает Mini App в iframe — приложение не загрузится.
> Сервер намеренно не выставляет эти заголовки (см. `server/index.js`).

Рекомендуется сверху: rate limiting (например, `limit_req` в Nginx), fail2ban,
мониторинг `/healthz`, ротация логов.

---

## 7. Telegram после деплоя

1. [@BotFather](https://t.me/BotFather) → `/setdomain` → `wallet.example.com`
   (**без** `https://`, без пути и порта).
2. В `.env` / переменных PaaS: `WEBAPP_URL=https://wallet.example.com`.
3. Перезапустите сервис — бот сам вызовет `setChatMenuButton` и `setMyCommands`.
4. Проверьте: `GET https://wallet.example.com/api/health` → `"auth": {"telegram": true}`.
5. Напишите боту `/start`.

Подробнее: [SETUP_TELEGRAM.md](SETUP_TELEGRAM.md).

---

## 8. Чек-лист перед открытием наружу

- [ ] `ALLOW_MAINNET=false` (проверить в `/api/health` → `"mode": "testnet"`).
- [ ] `VAULT_KEY` и `SESSION_SECRET` заданы явно и лежат в секрет-менеджере.
- [ ] Том `data/` постоянный, бэкап зашифрован и проверен восстановлением.
- [ ] TLS работает, HTTP редиректит на HTTPS.
- [ ] Нет `X-Frame-Options` / блокирующего CSP `frame-ancestors`.
- [ ] Rate limiting перед приложением.
- [ ] `DEMO_AUTH=false`, если сервис доступен всем (иначе любой получит гостевой кошелёк).
- [ ] Логи не содержат токенов и ключей.
- [ ] `bash scripts/check-secrets.sh` проходит.
- [ ] `/healthz` и `/api/health` отвечают 200.
- [ ] Бэкап `.env` + `vault.enc` + `db.json` лежит офлайн.

---

## 9. Типичные проблемы

| Симптом | Причина | Решение |
|---|---|---|
| `401 initData: подпись недействительна` | Не тот `BOT_TOKEN`, старый `auth_date`, прокси искажает query | Проверьте токен, `INITDATA_MAX_AGE`, проксируйте без перекодировки |
| Mini App не открывается в Telegram | `localhost`, HTTP, нет `/setdomain`, блокирующий `X-Frame-Options` | Публичный HTTPS + `/setdomain` + уберите заголовок |
| `vault.enc` не читается | Сменился `VAULT_KEY` или стёрся том | Восстановите ключ и `vault.enc` из одного бэкапа |
| Балансы нулевые / `429` | Публичные RPC и краны ограничены | Задайте свои `*_RPC` (`.env.example`) |
| Бот молчит | Нет `BOT_TOKEN` или висит webhook | Проверьте логи, `deleteWebhook` в Bot API |
| `502` на превью `*.e2b.app` | Песочница пересоздалась / нужен `e2b-traffic-access-token` | Используйте свой домен или публичный туннель |

---

## 10. CI/CD, который уже в репозитории

| Workflow | Что делает |
|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | Node 20 и 22: `npm ci`, secret scan, `node --check`, 48 тестов с живым сервером |
| [`codeql.yml`](../.github/workflows/codeql.yml) | Статический анализ JS/TS, еженедельно |
| [`pages.yml`](../.github/workflows/pages.yml) | Публикует автономный [`index.html`](../index.html) на GitHub Pages (режим branch и Actions) |
| [`release.yml`](../.github/workflows/release.yml) | На теге `v*` собирает архивы без секретов и создаёт Release |

Pages работает в обоих режимах: `Source: Deploy from a branch` (main / root, Jekyll отключён `.nojekyll`) и `Source: GitHub Actions`. Откройте `Settings → Pages` и выберите любой.
