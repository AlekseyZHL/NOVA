# CHANGELOG

## [1.0.3] — 26.10.2026 — запуск приложения на GitHub

### Добавлено

- **`.devcontainer/`** — один клик на «Open in Codespaces»: `npm ci`, генерация `.env`, автоматическая подстановка `WEBAPP_URL` из переменных Codespace и запуск сервера с публичным портом 3000.
- **`.github/workflows/live-demo.yml`** — запуск полного Node-приложения на runner GitHub с публичным HTTPS-туннелем cloudflared (1–5 часов) через `workflow_dispatch` или тег `demo-Nh`. URL публикуется в Job Summary, артефакте `nova-live-url` и ветке `live-url` (`LIVE_URL.md`); при наличии секрета `BOT_TOKEN` включается Telegram-бот.
- **`scripts/run-live-demo.sh`** + **`scripts/wait-live-demo.sh`** — тот же сценарий для локального запуска.
- Кнопки Codespaces / Render / Live demo в README и на лендинге; раздел в `docs/DEPLOYMENT.md`.

## [1.0.2] — 26.10.2026 — Open-source release

### Добавлено

- **GitHub-репозиторий**: README с бейджами и Mermaid-схемой, `LICENSE` (MIT + дисклеймер), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, шаблоны issue/PR, Dependabot.
- **CI/CD**: `.github/workflows/ci.yml` (Node 20/22, 48 тестов, secret scan), `codeql.yml`, `pages.yml`, `release.yml` (архивы без секретов → GitHub Releases).
- **Деплой**: `Dockerfile` (Alpine, non-root, healthcheck), `docker-compose.yml`, `docker-entrypoint.sh`, `render.yaml`, `railway.json`, `fly.toml`, `Procfile`, `docs/DEPLOYMENT.md`.
- **Лендинг** на GitHub Pages: автономный `index.html` в корне с интерактивным демо интерфейса кошелька.
- **Утилиты**: `Makefile`, `scripts/check-secrets.sh`, `scripts/check-syntax.js`, `.editorconfig`, `.nvmrc`, `.dockerignore`.
- Версия теперь берётся из `package.json` (`server/version.js`) и отдаётся в `/api/health`.

### Исправлено

- `loadTgSdk()` больше не блокирует загрузку в обычном браузере/CI: SDK ждём только внутри Telegram (по `tgWebAppData` / `tgWebAppVersion` в URL). Таймаут снижен с 3.5 с до 2 с.
- UI-тесты и тест входа теперь **поллят** готовность приложения вместо фиксированного `sleep(4200)` — устранена гонка на холодном CI-раннере (8/16 падений).
- `Pages` workflow корректно пропускает деплой, если GitHub Pages ещё не включён, вместо падения.
- Сервер больше не печатает stack trace для ожидаемого `503 BOT_TOKEN is not configured`.

### Изменено

- **Pages:** лендинг перенесён в корневой `index.html` + `.nojekyll`, чтобы Jekyll-сборка из ветки не перезаписывала его README.

- Архивы релизов больше не коммитятся (`exports/` в `.gitignore`) — они собираются CI и прикрепляются к GitHub Releases.

## [1.0.1] — 25.10.2026

### Добавлено

- Подключён Telegram-бот **@crptNOVA_bot** (`BOT_TOKEN` в `.env`, права `0600`, в архивы/Drive не попадает).
- Проверена `initData`-авторизация на реальном токене: валидная подпись → сессия, поддельная/пустая → 401.
- Бот при старте регистрирует `setChatMenuButton` (кнопка «Кошелёк») и 5 команд через `setMyCommands`.
- Обновлён статус в README, гайде по настройке, отчёте о тестировании и карте Drive.
- Добавлен `scripts/build_release.py` — воспроизводимая сборка архивов без секретов.
- Запасной путь входа: если Telegram SDK не загрузился, `initData` берётся из `#tgWebAppData` в URL. Добавлен `npm run test:entry` (4 проверки).
- Arena-превью `*.e2b.app` недоступно для Telegram (403 `e2b-traffic-access-token`), поэтому добавлен публичный HTTPS-туннель cloudflared; `WEBAPP_URL` указывает на него.

### Важно

- В @BotFather нужно выполнить `/setdomain` → ваш публичный HTTPS-домен.
- Токен был передан в чате — рекомендуется ротация через `/revoke` в BotFather после тестов.

## [1.0.0] — 25.10.2026

Первый рабочий релиз NOVA Wallet (Telegram Mini App, кастодиальный мультичейн-кошелёк без сид-фразы).

### Добавлено

- **Авторизация:** Telegram `initData` (HMAC-SHA256, timingSafeEqual, проверка `auth_date`), HMAC-сессии на 7 дней, гостевой режим для браузерного превью (отключается в mainnet).
- **Vault:** BIP-39 mnemonic (24 слова) в `AES-256-GCM`, ключ отдельно от шифртекста, детерминированная деривация по индексу пользователя.
- **6 сетей:** Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, Polygon Amoy, Bitcoin Testnet4, Solana Devnet — живые балансы, нативные монеты и ERC-20 USDC.
- **Отправка:** адаптеры EVM (ethers v6), Bitcoin (PSBT/P2WPKH + mempool.space), Solana (SystemProgram), ERC-20 transfer, симуляция газа/UTXO перед подписью.
- **Безопасность:** двухшаговое подтверждение с HMAC-токеном (TTL 120 с), per-tx и дневные лимиты в USD, белый список адресов, блокировка address poisoning, декодирование метода, аудит-лог, экспорт ключей с явным согласием.
- **UX:** 5 экранов, тема Telegram, QR-приём, QR-сканер, своп с котировкой, история по всем сетям, песочница, адресная книга, антифишинг-код, сокрытие балансов, €/$.
- **Бот:** long polling, `/start`, `/balance`, `/address`, `/security`, `/help`, inline-кнопки, `setChatMenuButton`.
- **Тесты:** 28 криптографических проверок, 16 UI-проверок в jsdom, интеграционные сценарии API.
- **Документация:** архитектура, безопасность, настройка Telegram, гайд пользователя, API, дорожная карта, отчёт о тестировании.

### Исправлено в процессе

- Опечатка в маршрутах API (лишняя скобка `})));` → `}));`).
- Путь Polygon Amoy заменён на `polygon-amoy-bor-rpc.publicnode.com` (старый RPC не отвечал).
- В песочнице белый список и проверка адресов теперь работают, а USD-лимиты не применяются.
- Таймер закрытия модального окна больше не стирает только что открытое следующее окно.
- В запись транзакции добавлен `explorer` — корректные ссылки для Solana Devnet.

### Известные ограничения

- Публичные краны Solana Devnet сегодня отдают `429`; авто-пополнение переключается на ручной режим.
- Ончейн-своп в mainnet отключён (501) до подключения аудированного DEX-агрегатора.
- Нет независимого аудита, KMS/HSM и rate limiting — mainnet включать нельзя.
