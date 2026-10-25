import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'db.json');

function empty() {
  return { version: 1, seq: 0, users: {}, txs: [], createdAt: new Date().toISOString() };
}
function load() {
  try { return { ...empty(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch { return empty(); }
}
const state = load();

/** Atomic write: a crash can never leave a half-written database. */
export function save() {
  const tmp = `${FILE}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
export function db() { return state; }

export function nextIndex() { state.seq += 1; save(); return state.seq; }

export function getOrCreateUser(profile) {
  let u = state.users[profile.id];
  if (!u) {
    u = {
      id: profile.id,
      index: nextIndex(),
      name: profile.name || 'Пользователь',
      username: profile.username || '',
      photo: profile.photo || '',
      source: profile.source || 'telegram',
      createdAt: new Date().toISOString(),
      settings: {
        fiat: 'EUR',
        whitelistOnly: false,
        antiPhishing: '',
        perTxLimitUsd: null,
        dailyLimitUsd: null,
        sandbox: false,
        hideBalances: false,
      },
      addressBook: [],
    };
    state.users[profile.id] = u;
    save();
  } else {
    let changed = false;
    for (const k of ['name', 'username', 'photo']) {
      if (profile[k] && profile[k] !== u[k]) { u[k] = profile[k]; changed = true; }
    }
    if (changed) save();
  }
  return u;
}

export function addTx(tx) {
  const rec = {
    id: tx.id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: tx.userId, chain: tx.chain, kind: tx.kind || 'send',
    hash: tx.hash || null, explorer: tx.explorer || null, from: tx.from || null, to: tx.to || null,
    amount: String(tx.amount), symbol: tx.symbol, fiat: tx.fiat || 0,
    status: tx.status || 'pending', simulated: !!tx.simulated,
    note: tx.note || '', timestamp: tx.timestamp || new Date().toISOString(),
  };
  state.txs.unshift(rec);
  if (state.txs.length > 2000) state.txs.length = 2000;
  save();
  return rec;
}

export function updateTx(id, patch) {
  const t = state.txs.find(x => x.id === id);
  if (!t) return null;
  Object.assign(t, patch);
  save();
  return t;
}

export function userTxs(userId, limit = 60) {
  return state.txs.filter(t => t.userId === userId).slice(0, limit);
}

export function spentTodayUsd(userId) {
  const since = Date.now() - 24 * 3600 * 1000;
  return state.txs
    .filter(t => t.userId === userId && t.kind === 'send' && new Date(t.timestamp).getTime() > since && t.status !== 'failed')
    .reduce((s, t) => s + (Number(t.fiat) || 0), 0);
}
