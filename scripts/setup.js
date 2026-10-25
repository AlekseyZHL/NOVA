import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(ROOT, '.env.example');
const env = path.join(ROOT, '.env');

if (fs.existsSync(env)) {
  console.log('✓ .env уже существует — не перезаписываю (ваши ключи в безопасности).');
  console.log('  Если ключ утерян, vault.enc станет нечитаемым. Сделайте бэкап .env и data/vault.enc.');
  process.exit(0);
}

const tpl = fs.readFileSync(example, 'utf8');
const keys = [
  '# --- Сгенерировано setup.js. НЕ публикуйте и НЕ загружайте в облако без шифрования ---',
  `VAULT_KEY=${crypto.randomBytes(32).toString('hex')}`,
  `SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`,
  '',
].join('\n');

fs.writeFileSync(env, tpl.trimEnd() + '\n\n' + keys, { mode: 0o600 });
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
console.log('✓ Создан .env (права 0600):');
console.log('  · VAULT_KEY      — 32-байтный ключ шифрования master seed');
console.log('  · SESSION_SECRET — ключ подписи сессий');
console.log('');
console.log('Следующие шаги:');
console.log('  1) Укажите BOT_TOKEN от @BotFather (иначе приложение работает в браузерном демо-режиме).');
console.log('  2) Укажите WEBAPP_URL — публичный HTTPS-адрес Mini App.');
console.log('  3) npm start');
console.log('');
console.log('🔴 Сделайте офлайн-бэкап .env + data/vault.enc. Без них средства восстановить нельзя.');
