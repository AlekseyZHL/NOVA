/**
 * Telegram entry test (jsdom) — проверяет запасной путь авторизации:
 * если SDK Telegram не загрузился, initData берётся из #tgWebAppData в URL,
 * а при невалидной подписи приложение честно уходит в гостевой режим.
 *
 * Run: npm run test:entry   (сервер должен быть запущен)
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');

// Подпись намеренно невалидная: сервер должен ответить 401.
const initData = 'query_id=AAHdF6IQAAAAAN0Xqj&user=%7B%22id%22%3A424242%7D&auth_date=1&hash=deadbeef';
const url = `${BASE}/#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0&tgWebAppPlatform=tdesktop`;

const dom = new JSDOM(html, { url, pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
for (const k of ['HTMLElement', 'Element', 'Node', 'MouseEvent', 'Event']) global[k] = window[k];
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.localStorage = window.localStorage;
global.location = window.location;
global.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = clearTimeout;
window.scrollTo = () => {};

// window.Telegram намеренно НЕ определяем — SDK как будто не загрузился.
const nodeFetch = global.fetch;
const calls = [];
global.fetch = (u, o) => {
  const full = new URL(String(u), BASE).toString();
  calls.push({ url: full, body: o?.body });
  return nodeFetch(full, o);
};
window.fetch = global.fetch;

const errors = [];
process.on('unhandledRejection', e => errors.push('unhandledRejection: ' + (e?.message || e)));
process.on('uncaughtException', e => errors.push('uncaughtException: ' + e.message));

await import('../public/app.js');
await new Promise(r => setTimeout(r, 4300));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

console.log('\nNOVA Wallet — Telegram entry / hash fallback test\n');
console.log('  (OK) 401 от /auth/telegram в логах сервера здесь ожидаем — подпись тестовая\n');

const tgCalls = calls.filter(c => c.url.includes('/auth/telegram'));
ok('SDK отсутствует, но /auth/telegram вызван', tgCalls.length >= 1);

let sent = '';
try { sent = JSON.parse(tgCalls[0]?.body || '{}').initData || ''; } catch { /* noop */ }
ok('initData совпадает с #tgWebAppData', sent === initData, sent.slice(0, 46));
ok('при невалидной подписи включается гостевой вход', calls.some(c => c.url.includes('/auth/demo')));
ok('приложение загрузилось без необработанных ошибок', errors.length === 0, errors.slice(0, 2).join(' | '));

console.log(`\n  RESULT: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
