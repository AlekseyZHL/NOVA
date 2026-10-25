# Подключение Telegram-бота и Mini App

✅ Бот @crptNOVA_bot работает на long polling: кнопка меню **«Кошелёк»** и 5 команд регистрируются при старте сервера. Ниже — полная инструкция для вашего собственного домена и токена.

⚠️ **Важно:** в @BotFather выполните `/setdomain` и укажите домен, на котором живёт Mini App (например, `wallet.example.com`) — иначе Telegram может не открыть Mini App по кнопке.

## 1. Создайте бота

1. Откройте [@BotFather](https://t.me/BotFather).
2. `/newbot` → имя (например, `NOVA Wallet`) → username (например, `nova_wallet_app_bot`).
3. Скопируйте токен вида `123456789:AAH...`. **Никому его не показывайте.**
4. `/setdomain` — укажите домен, на котором будет жить Mini App (например, `wallet.example.com`).
5. Опционально `/setdescription`, `/setuserpic`, `/setabouttext`.
6. Команды можно задать через `/setcommands`:
   ```
   start - Запустить кошелёк
   balance - Мой баланс
   address - Мои адреса
   security - Безопасность
   help - Помощь
   ```

> Кнопку меню (`setChatMenuButton`) бот выставляет сам при старте — отдельно настраивать не нужно.

## 2. Пропишите переменные в `.env`

```dotenv
BOT_TOKEN=123456789:AAH...ваш_токен
> ℹ️ `https://wallet.example.com` ниже — **пример**. Подставьте свой публичный HTTPS-домен
> (Render/Railway/Fly/свой VPS). Временные туннели и превью-песочницы в репозитории
> намеренно не фиксируются: они меняются при каждом перезапуске.
WEBAPP_URL=https://wallet.example.com
ALLOW_MAINNET=false
DEMO_AUTH=true
PORT=3000
```

`WEBAPP_URL` должен быть **публичным HTTPS-адресом**. В Arena превью уже доступно по адресу выше; для продакшена используйте свой домен (Vercel / Railway / VPS + nginx + Let's Encrypt).

Если `WEBAPP_URL` не задан в среде Arena, сервер сам подставит `https://<PORT>-<E2B_SANDBOX_ID>.e2b.app`.

## 3. Перезапустите

```bash
npm start
```

В логах появится:

```
[bot] long polling started · webapp https://… · mode testnet
[bot] menu button: ok
```

Откройте бота в Telegram → `/start` → кнопка **«🚀 Открыть NOVA Wallet»**.

## 4. Что происходит внутри

1. Telegram открывает `WEBAPP_URL` в WebView и передаёт `initData` (подписанные данные пользователя).
2. Клиент отправляет `initData` на `POST /api/auth/telegram`.
3. Сервер проверяет подпись по официальной схеме:
   ```
   secret_key = HMAC_SHA256("WebAppData", BOT_TOKEN)
   expected   = HMAC_SHA256(secret_key, data_check_string)
   ```
   Сравнение через `timingSafeEqual`, плюс проверка `auth_date` (не старше 24 ч).
4. При успехе сервер создаёт/находит пользователя `tg_<id>`, выдаёт HMAC-сессию на 7 дней.
5. Все дальнейшие запросы идут с `Authorization: Bearer <token>`.

Если подпись не прошла (например, открыли страницу вне Telegram), клиент откатывается на гостевой режим — но только в testnet.

## 5. Команды бота

| Команда | Действие |
|---|---|
| `/start` | Приветствие + WebApp-кнопка |
| `/balance` | Портфель по всем сетям (вызывает `getPortfolio` напрямую) |
| `/address` | Три адреса: EVM, Bitcoin, Solana |
| `/security` | Лимиты, белый список, антифишинг-код |
| `/help` | Справка |

Inline-кнопки дублируют команды. `getUpdates` работает long polling с таймаутом 25 с и оффсетом; при ошибке — пауза 5 с.

## 6. Частые проблемы

| Симптом | Причина | Решение |
|---|---|---|
| «BOT_TOKEN is not configured» | Пустой токен | Проверьте `.env` и перезапустите |
| Кнопка не открывается | `WEBAPP_URL` без HTTPS или не публичный | Нужен валидный HTTPS-домен |
| `initData устарел` | Старая вкладка | Закройте и откройте Mini App заново |
| Бот не отвечает | Другой процесс уже делает `getUpdates` | Остановите дублирующий инстанс |
| Пустые балансы | Публичный RPC/кран ограничен | Укажите свой RPC в `.env` и пополните через кран |
| `409 Conflict` на getUpdates | Запущен webhook | Удалите webhook через `deleteWebhook` |

## 7. Переход на webhook (продакшен)

Long polling удобен для разработки, но в проде лучше webhook. Добавьте в `server/index.js` обработчик `POST /api/bot/webhook`, передавайте `req.body` в `handleUpdate` из `bot.js` и вызовите `setWebhook({ url: WEBAPP_URL + '/api/bot/webhook', secret_token: … })`. Валидируйте заголовок `X-Telegram-Bot-Api-Secret-Token`.

> ⚠️ **Публичный URL для Telegram.** Arena-превью `*.e2b.app` защищено заголовком
> `e2b-traffic-access-token`, который Telegram WebView не отправляет (403).
> Поэтому для Mini App используется публичный HTTPS-туннель **cloudflared**
> (`https://wallet.example.com`).
> Это **временный** адрес: при перезапуске песочницы он меняется — задайте новый
> `WEBAPP_URL` в `.env` и перезапустите сервер (бот сам обновит кнопку меню).
