# 🤝 Contributing to NOVA Wallet

Спасибо, что хотите улучшить проект! Это учебный/исследовательский TESTNET MVP,
поэтому главный приоритет — **безопасность и честность**, а не скорость фич.

## Основные правила

- 🙅 **Никогда** не коммитьте `.env`, `data/vault.enc`, `*.key`, `db.json`, `BOT_TOKEN`,
  приватные ключи или сид-фразы. CI проверяет это через `scripts/check-secrets.sh`.
- 🧪 Любой PR должен проходить все 48 тестов.
- 🔴 Не предлагайте включать `ALLOW_MAINNET=true` без аудита и KMS/HSM — такой PR будет отклонён.
- ✍️ Пишите коммиты в стиле Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `security:`.

## Локальная настройка

```bash
git clone https://github.com/AlekseyZHL/NOVA.git
cd NOVA
npm ci
npm run setup          # .env с VAULT_KEY / SESSION_SECRET + data/
npm start              # терминал 1
```

## Тесты

```bash
npm test               # 28 — криптография, офлайн, сеть не нужна
npm run test:ui        # 16 — UI в jsdom, нужен запущенный сервер
npm run test:entry     #  4 — запасной вход через #tgWebAppData
bash scripts/check-secrets.sh
```

Полный прогон (как в CI):

```bash
make ci
```

Если меняете цепочку `vault → derive → sign`, добавьте **новый** тест в `tests/smoke.js`.
Если меняете UI — добавьте проверку в `tests/ui.js`.

## Процесс PR

1. Создайте ветку: `git checkout -b feat/my-change`.
2. Внесите изменения, добавьте тесты, обновите `CHANGELOG.md` (секция `Unreleased`).
3. `make ci` — всё должно быть зелёным.
4. Откройте PR по шаблону: опишите **что**, **почему** и **как проверяли**.
5. Свяжите PR с issue, если он есть.

### Чек-лист ревью

- [ ] Нет секретов в diff.
- [ ] Тесты добавлены/обновлены и проходят.
- [ ] Поведение в `MODE=testnet` не сломано.
- [ ] mainnet-путь не стал доступнее случайно.
- [ ] Документация обновлена, если менялся API/UX.
- [ ] Нет новых зависимостей без обоснования.

## Куда копать

| Хотите… | Файлы |
|---|---|
| Добавить сеть | `server/config.js`, `server/chains/` |
| Улучшить риск-движок | `server/middleware/risk.js` |
| Поменять UI | `public/index.html`, `public/styles.css`, `public/app.js` |
| Добавить endpoint | `server/routes/api.js`, `docs/API.md` |
| Улучшить деплой | `Dockerfile`, `docs/DEPLOYMENT.md`, `.github/workflows/` |
| Обновить лендинг | `landing/` |

## Идеи, которые особенно приветствуются

- Переход с `data/db.json` на PostgreSQL/SQLite с транзакциями.
- Rate limiting и защита от повторов `confirmToken`.
- Работа с собственными RPC (retry/fallback при `429`).
- Аудит криптографии и формальные тесты деривации.
- MPC / smart-account вместо кастодиального seed.

## Поведение

Мы следуем [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Будьте вежливы, конструктивны и
помните: за каждым PR стоит человек.

Вопросы безопасности — только в [SECURITY.md](SECURITY.md), не в публичный issue.
