/**
 * Headless UI smoke test (jsdom) — boots the real Mini App against a running
 * server, walks every tab and dialog, and fails on any uncaught runtime error.
 * Run: npm run test:ui   (server must be running)
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: BASE + '/', pretendToBeVisual: true });
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

const nodeFetch = global.fetch;
global.fetch = (u, o) => nodeFetch(new URL(String(u), BASE).toString(), o);
window.fetch = global.fetch;

const errors = [];
process.on('unhandledRejection', e => errors.push('unhandledRejection: ' + (e?.message || e)));
process.on('uncaughtException', e => errors.push('uncaughtException: ' + e.message));

await import('../public/app.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(4200);

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const click = el => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
};

console.log('\nNOVA Wallet — UI smoke test (jsdom)\n');
ok('boot screen dismissed', !$('#boot') || $('#boot').classList.contains('gone'));
ok('header rendered', ($('#header')?.innerHTML || '').includes('NOVA'));
ok('5 navigation tabs', $$('.nav-item').length === 5);
ok('home hero shows balance', ($('#view-home')?.innerHTML || '').includes('Общий баланс'));
ok('6 network cards', $$('.chain-card').length === 6);
ok('8+ asset rows', $$('#view-home .row.clickable').length >= 8);
ok('testnet warning present', ($('#view-home')?.innerHTML || '').includes('TESTNET'));

click($('[data-act="send"]')); await sleep(180);
ok('send dialog opens with asset + recipient', !!$('#send-asset') && !!$('#send-to'));
click($('[data-act="close-modal"]')); await sleep(280);

click($('[data-act="receive"]')); await sleep(250);
ok('receive dialog with 3 chain tabs', $$('.segmented button').length === 3 && !!$('#qr-slot'));
ok('address rendered', ($('.addr-box')?.textContent || '').length > 20);
click($('[data-act="close-modal"]')); await sleep(280);

for (const [tab, needle] of [['swap', 'Обмен активов'], ['activity', 'Активность'], ['security', 'Уровень защиты'], ['profile', 'Мои адреса']]) {
  click($(`[data-act="tab"][data-tab="${tab}"]`)); await sleep(650);
  ok(`tab "${tab}" renders`, ($(`#view-${tab}`)?.innerHTML || '').includes(needle));
}

click($('[data-act="tab"][data-tab="home"]')); await sleep(150);
click($('[data-act="mode-info"]')); await sleep(150);
ok('mode info dialog', ($('.sheet')?.textContent || '').includes('Vault'));
click($('[data-act="close-modal"]')); await sleep(260);

ok('no uncaught runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n  RESULT: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
