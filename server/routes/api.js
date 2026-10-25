import crypto from 'node:crypto';
import express from 'express';
import QRCode from 'qrcode';
import { CHAINS, CHAIN_LIST, LIMITS, IS_MAINNET, MODE, WEBAPP_URL, BOT_TOKEN, DEMO_ENABLED, chainOrThrow } from '../config.js';
import { SESSION_KEY } from '../keystore.js';
import { db, save, getOrCreateUser, addTx, updateTx, userTxs, spentTodayUsd } from '../db.js';
import { validateInitData, issueSession, requireAuth, demoProfile, authMode } from '../auth.js';
import { deriveFor, addressesFor, exportFor, vaultInfo } from '../vault.js';
import { getPrices, priceOf } from '../chains/prices.js';
import {
  getPortfolio, getSandboxPortfolio, simulate, simulateSandbox, broadcast, txStatus,
  airdrop, chainOptions, explorerTx,
} from '../chains/index.js';
import { riskCheck } from '../middleware/risk.js';
import { httpErr } from '../util.js';
import { APP_VERSION } from '../version.js';

export const api = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function audit(userId, action, detail = '') {
  const state = db();
  state.audit = state.audit || [];
  state.audit.unshift({ userId, action, detail, at: new Date().toISOString() });
  state.audit = state.audit.slice(0, 300);
  save();
}
function publicUser(u) {
  return {
    id: u.id, name: u.name, username: u.username, photo: u.photo,
    source: u.source, createdAt: u.createdAt, index: u.index,
    settings: u.settings, addressBook: u.addressBook || [],
  };
}
function ownAddresses(user) {
  const a = addressesFor(user.index);
  return [a.evm, a.bitcoin, a.solana];
}

/* Two-step signing: what you previewed is exactly what gets signed. */
function makeConfirm(user, p) {
  const body = JSON.stringify({
    u: user.id, c: p.chain, t: String(p.to).trim(), a: p.asset,
    m: String(p.amount), e: Date.now() + 120_000,
  });
  const sig = crypto.createHmac('sha256', SESSION_KEY).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${sig}`;
}
function readConfirm(token, user) {
  if (!token || typeof token !== 'string') throw httpErr(400, 'Сначала откройте превью транзакции');
  const [b, s] = token.split('.');
  if (!b || !s) throw httpErr(400, 'Некорректный токен подтверждения');
  const body = Buffer.from(b, 'base64url').toString('utf8');
  const expected = crypto.createHmac('sha256', SESSION_KEY).update(body).digest('base64url');
  if (s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) {
    throw httpErr(400, 'Подпись подтверждения недействительна');
  }
  const d = JSON.parse(body);
  if (d.u !== user.id || d.e < Date.now()) throw httpErr(400, 'Подтверждение устарело — повторите симуляцию');
  return d;
}

/* ------------------------------------------------------------------ health */
api.get('/health', (req, res) => res.json({
  ok: true, app: 'NOVA Wallet', version: APP_VERSION, mode: MODE,
  auth: authMode(), chains: CHAIN_LIST.map(c => c.id), webapp: WEBAPP_URL,
  limits: { perTxUsd: LIMITS.perTxUsd, dailyUsd: LIMITS.dailyUsd },
  time: new Date().toISOString(),
}));

/* -------------------------------------------------------------------- auth */
api.post('/auth/telegram', wrap(async (req, res) => {
  const profile = validateInitData(req.body?.initData);
  const user = getOrCreateUser(profile);
  const firstRun = userTxs(user.id, 1).length === 0;
  audit(user.id, 'login', 'telegram');
  res.json({ ok: true, token: issueSession(user.id), user: publicUser(user), firstRun });
}));

api.post('/auth/demo', (req, res) => {
  if (!DEMO_ENABLED) throw httpErr(403, 'Гостевой вход отключён в mainnet-режиме');
  const user = getOrCreateUser(demoProfile());
  audit(user.id, 'login', 'demo');
  res.json({ ok: true, token: issueSession(user.id), user: publicUser(user), firstRun: true, demo: true });
});

api.get('/me', requireAuth, (req, res) => res.json({
  ok: true, user: publicUser(req.user), vault: vaultInfo(),
  chains: chainOptions(), auth: authMode(),
  limits: { perTxUsd: LIMITS.perTxUsd, dailyUsd: LIMITS.dailyUsd },
  webapp: WEBAPP_URL,
}));

/* ------------------------------------------------------------------ wallet */
api.get('/wallet', requireAuth, wrap(async (req, res) => {
  const u = req.user;
  const addresses = addressesFor(u.index);
  const portfolio = u.settings.sandbox
    ? await getSandboxPortfolio(addresses, u.settings.fiat)
    : await getPortfolio(addresses, u.settings.fiat);
  res.json({ ok: true, addresses, portfolio, vault: vaultInfo() });
}));

api.get('/balances', requireAuth, wrap(async (req, res) => {
  const u = req.user;
  const addresses = addressesFor(u.index);
  const fiat = ['EUR', 'USD'].includes(String(req.query.fiat).toUpperCase()) ? String(req.query.fiat).toUpperCase() : u.settings.fiat;
  const portfolio = u.settings.sandbox
    ? await getSandboxPortfolio(addresses, fiat)
    : await getPortfolio(addresses, fiat);
  res.json({ ok: true, portfolio });
}));

api.get('/qr.svg', (req, res) => {
  const text = String(req.query.text || '').slice(0, 300);
  if (!text) return res.status(400).send('text required');
  QRCode.toString(text, { type: 'svg', margin: 1, width: 320, color: { dark: '#0a0e1aff', light: '#ffffffff' } })
    .then(svg => { res.type('image/svg+xml').set('Cache-Control', 'public, max-age=300').send(svg); })
    .catch(() => res.status(500).send('qr error'));
});

/* -------------------------------------------------------------- simulation */
api.post('/simulate', requireAuth, wrap(async (req, res) => {
  const { chain, to, asset, amount } = req.body || {};
  const c = chainOrThrow(chain);
  const u = req.user;
  const keys = deriveFor(u.index);
  const from = c.kind === 'evm' ? keys.evm.address : c.kind === 'btc' ? keys.btc.address : keys.sol.address;
  const sandbox = !!u.settings.sandbox;
  const risk = await riskCheck({ user: { ...u, _addresses: ownAddresses(u) }, chainId: chain, to, asset, amount, sandbox });
  if (risk.blocked) throw httpErr(403, risk.flags.find(f => f.level === 'error').text);
  const sim = sandbox
    ? simulateSandbox({ chainId: chain, from, to, asset, amount })
    : await simulate({ chainId: chain, from, to, asset, amount });
  sim.flags = [...(sim.flags || []), ...risk.flags];
  sim.ready = !sim.flags.some(f => f.level === 'error');
  sim.risk = { usd: risk.usd, spentToday: risk.spent, perTx: risk.perTx, daily: risk.daily };
  sim.confirmToken = sim.ready ? makeConfirm(u, { chain, to, asset, amount }) : null;
  sim.sandbox = sandbox;
  res.json({ ok: true, simulation: sim });
}));

/* --------------------------------------------------------------------- send */
api.post('/send', requireAuth, wrap(async (req, res) => {
  const { chain, to, asset, amount, confirmToken } = req.body || {};
  const c = chainOrThrow(chain);
  const d = readConfirm(confirmToken, req.user);
  if (d.c !== chain || d.t !== String(to).trim() || d.a !== asset || d.m !== String(amount)) {
    throw httpErr(400, 'Параметры транзакции изменились после превью. Повторите проверку.');
  }
  const u = req.user;
  const keys = deriveFor(u.index);
  const from = c.kind === 'evm' ? keys.evm.address : c.kind === 'btc' ? keys.btc.address : keys.sol.address;
  const sandbox = !!u.settings.sandbox;
  const risk = await riskCheck({ user: { ...u, _addresses: ownAddresses(u) }, chainId: chain, to, asset, amount, sandbox });
  if (risk.blocked) throw httpErr(403, 'Отправка заблокирована системой безопасности');
  const sim = sandbox
    ? simulateSandbox({ chainId: chain, from, to, asset, amount })
    : await simulate({ chainId: chain, from, to, asset, amount });
  if (!sim.ready) throw httpErr(400, 'Симуляция не пройдена: ' + (sim.flags.find(f => f.level === 'error')?.text || 'неизвестная ошибка'));

  if (sandbox) {
    const tx = addTx({
      userId: u.id, chain, kind: 'send', from, to, amount, symbol: asset || c.symbol,
      fiat: risk.usd, status: 'confirmed', simulated: true,
      hash: `SIM-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      note: 'Песочница — реальные монеты не перемещались',
    });
    audit(u.id, 'send.simulated', `${amount} ${asset} → ${to}`);
    return res.json({ ok: true, tx, simulated: true, explorer: null });
  }

  const out = await broadcast({ chainId: chain, keys, to, asset, amount });
  const tx = addTx({
    userId: u.id, chain, kind: 'send', from, to, amount, symbol: asset || c.symbol,
    fiat: risk.usd, status: 'pending', hash: out.hash, explorer: out.explorer,
  });
  audit(u.id, 'send.broadcast', `${amount} ${asset} → ${to} · ${out.hash}`);
  res.json({ ok: true, tx, explorer: out.explorer });
}));

/* ----------------------------------------------------------------- activity */
api.get('/activity', requireAuth, wrap(async (req, res) => {
  const txs = userTxs(req.user.id, 80);
  const pending = txs.filter(t => t.status === 'pending' && t.hash && !t.simulated);
  await Promise.all(pending.slice(0, 10).map(async t => {
    const status = await txStatus(t.chain, t.hash);
    if (status !== 'pending') updateTx(t.id, { status });
  }));
  res.json({ ok: true, txs: userTxs(req.user.id, 80) });
}));

api.post('/faucet', requireAuth, wrap(async (req, res) => {
  const chain = String(req.body?.chain || 'solana');
  const c = chainOrThrow(chain);
  const a = addressesFor(req.user.index);
  if (chain !== 'solana' || IS_MAINNET) {
    return res.json({ ok: true, manual: true, faucet: c.faucet, address: a[c.kind === 'evm' ? 'evm' : chain],
      instructions: 'Откройте кран, вставьте адрес и получите тестовые монеты.' });
  }
  try {
    const out = await airdrop('solana', a.solana);
    const tx = addTx({ userId: req.user.id, chain: 'solana', kind: 'faucet', to: a.solana,
      amount: '1', symbol: 'SOL', status: 'confirmed', hash: out.hash, explorer: out.explorer, note: 'Solana Devnet airdrop' });
    audit(req.user.id, 'faucet', out.hash);
    res.json({ ok: true, tx, explorer: out.explorer });
  } catch (e) {
    res.json({ ok: true, manual: true, faucet: c.faucet, address: a.solana,
      instructions: 'Авто-кран временно недоступен (лимит): ' + e.message, error: e.message });
  }
}));

/* ----------------------------------------------------------------- settings */
api.post('/settings', requireAuth, (req, res) => {
  const u = req.user;
  const p = req.body || {};
  const allowed = ['fiat', 'whitelistOnly', 'antiPhishing', 'perTxLimitUsd', 'dailyLimitUsd', 'sandbox', 'hideBalances'];
  for (const k of allowed) {
    if (!(k in p)) continue;
    let v = p[k];
    if (k === 'fiat') v = ['EUR', 'USD'].includes(v) ? v : 'EUR';
    if (k.endsWith('LimitUsd')) { v = Number(v); if (!Number.isFinite(v) || v < 1 || v > 100000) continue; }
    if (typeof u.settings[k] === 'boolean') v = !!v;
    u.settings[k] = v;
  }
  save();
  audit(u.id, 'settings.update', allowed.filter(k => k in p).join(','));
  res.json({ ok: true, settings: u.settings });
});

api.route('/address-book')
  .get(requireAuth, (req, res) => res.json({ ok: true, items: req.user.addressBook || [] }))
  .post(requireAuth, (req, res) => {
    const { label, address, chain } = req.body || {};
    if (!label || !address) throw httpErr(400, 'Нужны название и адрес');
    if (address.length > 120) throw httpErr(400, 'Адрес слишком длинный');
    req.user.addressBook = req.user.addressBook || [];
    req.user.addressBook.unshift({ id: crypto.randomBytes(5).toString('hex'), label: String(label).slice(0, 40), address: String(address).trim(), chain: chain || null });
    save();
    audit(req.user.id, 'addressbook.add', label);
    res.json({ ok: true, items: req.user.addressBook });
  })
  .delete(requireAuth, (req, res) => {
    const id = req.body?.id;
    req.user.addressBook = (req.user.addressBook || []).filter(a => a.id !== id);
    save();
    audit(req.user.id, 'addressbook.remove', id);
    res.json({ ok: true, items: req.user.addressBook });
  });

api.get('/security', requireAuth, (req, res) => {
  const u = req.user;
  res.json({
    ok: true,
    vault: vaultInfo(),
    settings: u.settings,
    limits: {
      perTx: Number(u.settings.perTxLimitUsd ?? LIMITS.perTxUsd),
      daily: Number(u.settings.dailyLimitUsd ?? LIMITS.dailyUsd),
      spentTodayUsd: spentTodayUsd(u.id),
    },
    addressBook: u.addressBook || [],
    audit: (db().audit || []).filter(a => a.userId === u.id).slice(0, 20),
    checklist: [
      { id: 'encrypted', title: 'Ключи зашифрованы на сервере', done: true, detail: 'AES-256-GCM, master seed не покидает процесс' },
      { id: 'simulation', title: 'Симуляция перед подписью', done: true, detail: 'Ни одна транзакция не подписывается без превью' },
      { id: 'limits', title: 'Лимиты операций', done: true, detail: 'Per-tx и дневной лимит в USD' },
      { id: 'whitelist', title: 'Белый список адресов', done: !!u.settings.whitelistOnly, detail: 'Разрешить переводы только проверенным получателям' },
      { id: 'antiphish', title: 'Антифишинг-код', done: !!u.settings.antiPhishing, detail: 'Секретная фраза в официальных уведомлениях' },
      { id: 'testnet', title: 'Тестовая сеть по умолчанию', done: !IS_MAINNET, detail: 'Mainnet включается только вручную' },
    ],
  });
});

api.post('/export', requireAuth, wrap(async (req, res) => {
  if (String(req.body?.confirm) !== 'Я ПОНИМАЮ РИСК') throw httpErr(400, 'Требуется явное подтверждение');
  const data = exportFor(req.user.index);
  audit(req.user.id, 'keys.exported', 'private keys revealed to client');
  console.warn(`[SECURITY] user ${req.user.id} exported private keys at ${new Date().toISOString()}`);
  res.json({ ok: true, ...data });
}));

/* --------------------------------------------------------------------- swap */
api.post('/swap/quote', requireAuth, wrap(async (req, res) => {
  const { fromAsset, toAsset, amount } = req.body || {};
  const u = req.user;
  const a = addressesFor(u.index);
  const p = u.settings.sandbox ? await getSandboxPortfolio(a, u.settings.fiat) : await getPortfolio(a, u.settings.fiat);
  const A = p.assets.find(x => x.id === fromAsset), B = p.assets.find(x => x.id === toAsset);
  if (!A || !B) throw httpErr(400, 'Выберите существующие активы');
  if (A.id === B.id) throw httpErr(400, 'Выберите разные активы');
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw httpErr(400, 'Укажите сумму');
  const feeRate = 0.003;
  const usdIn = amt * A.price;
  const out = (usdIn * (1 - feeRate)) / (B.price || 1);
  const rate = out / amt;
  res.json({
    ok: true,
    quote: {
      from: { id: A.id, symbol: A.symbol, chain: A.chain, amount: amt, price: A.price },
      to: { id: B.id, symbol: B.symbol, chain: B.chain, amount: Number(out.toFixed(Math.min(8, B.decimals))), price: B.price },
      rate, feeRate, feeUsd: usdIn * feeRate, usdIn,
      priceImpact: 0, provider: 'NOVA mid-market (CoinGecko)',
    },
    simulated: !IS_MAINNET || !!p.simulated,
    warning: IS_MAINNET
      ? 'Для реального свопа в mainnet нужен DEX-агрегатор (LiFi/1inch/Jupiter) — см. ROADMAP.md. Сейчас доступна только оценка.'
      : 'Тестовая сеть: своп симулируется, реальные монеты не перемещаются.',
  });
}));

api.post('/swap/execute', requireAuth, wrap(async (req, res) => {
  const { fromAsset, toAsset, amount } = req.body || {};
  const u = req.user;
  const a = addressesFor(u.index);
  const p = u.settings.sandbox ? await getSandboxPortfolio(a, u.settings.fiat) : await getPortfolio(a, u.settings.fiat);
  const A = p.assets.find(x => x.id === fromAsset), B = p.assets.find(x => x.id === toAsset);
  if (!A || !B) throw httpErr(400, 'Активы не найдены');
  if (IS_MAINNET) throw httpErr(501, 'Ончейн-своп в mainnet отключён до подключения аудированного DEX-агрегатора. См. ROADMAP.md.');
  const out = (Number(amount) * A.price * 0.997) / (B.price || 1);
  const tx = addTx({ userId: u.id, chain: A.chain, kind: 'swap', amount, symbol: A.symbol,
    fiat: Number(amount) * A.price, status: 'confirmed', simulated: true,
    hash: `SWAP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    note: `→ ${out.toFixed(6)} ${B.symbol} (симуляция)` });
  audit(u.id, 'swap.simulated', `${amount} ${A.symbol} → ${B.symbol}`);
  res.json({ ok: true, tx, simulated: true, received: out, warning: 'Симуляция: реальные монеты не перемещались.' });
}));
