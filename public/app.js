/* ==========================================================================
   NOVA Wallet — Telegram Mini App client
   Zero dependencies. Works inside Telegram AND in a plain browser preview.
   ========================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  user: null, me: null, wallet: null, chains: [], activity: [], security: null,
  tab: 'home', fiat: 'EUR', hidden: false,
  swap: { from: null, to: null, quote: null },
  send: {}, recvChain: 'ethereum', camera: null,
};
let TOKEN = localStorage.getItem('nova_token') || '';

/* ------------------------------------------------------------- icons */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  swap: '<path d="M4 8h13l-3.5-3.5"/><path d="M20 16H7l3.5 3.5"/>',
  activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3 8.3 7.5 9.5 4.5-1.2 7.5-5 7.5-9.5V6L12 3z"/><path d="m9 12 2 2 4-4"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.6-3.7 3.6-6 7.5-6s6.9 2.3 7.5 6"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3z"/>',
  receive: '<path d="M12 3v12"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  droplet: '<path d="M12 3s6 6.3 6 10.2A6 6 0 0 1 6 13.2C6 9.3 12 3 12 3z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  'eye-off': '<path d="M3 3l18 18"/><path d="M10.6 6.2A9.7 9.7 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.8"/><path d="M6.3 7.7C3.6 9.3 2 12 2 12s3.6 6 10 6a9.9 9.9 0 0 0 4-.8"/>',
  alert: '<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 9v5M12 17.5v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  lock: '<rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-2 2 1.5 1.5-2 2L18 9l-2.5 2.5"/>',
  external: '<path d="M13 4h7v7"/><path d="M20 4 10 14"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 5v6h-6"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9S14.5 18.5 12 21c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z"/>',
  sparkles: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
};
const ic = (n, s = 18, cls = '') => `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ICONS.info}</svg>`;

/* ------------------------------------------------------------ helpers */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (v, d = 2) => Number(v || 0).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
const sym = f => f === 'USD' ? '$' : '€';
const money = (v, f = state.fiat) => `${sym(f)}${nf(v, 2)}`;
const amt = v => { const n = Number(v || 0); if (!n) return '0'; if (n < 0.0001) return n.toExponential(2); return nf(n, n < 1 ? 6 : n < 100 ? 4 : 2); };
const shortAddr = (a, n = 6) => a ? `${String(a).slice(0, n)}…${String(a).slice(-4)}` : '—';
const timeAgo = iso => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'только что'; if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const assetById = id => state.wallet?.portfolio.assets.find(a => a.id === id);
const chainById = id => state.chains.find(c => c.id === id) || { name: id, color: '#7c5cff', glyph: '•', sub: '' };
const haptic = t => { try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(t || 'light'); } catch { /* noop */ } };

function toast(msg, type = 'info', ms = 4200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${ic(type === 'ok' ? 'ok' : type === 'err' ? 'alert' : 'info', 17)}<div>${esc(msg)}</div>`;
  $('#toast-root').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}
async function copy(text, label = 'Скопировано') {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch { /* noop */ } t.remove();
  }
  haptic('success'); toast(label, 'ok', 2200);
}
const openExt = url => { try { window.Telegram?.WebApp?.openLink(url); } catch { window.open(url, '_blank', 'noopener'); } };

async function api(path, opts = {}) {
  const headers = { 'content-type': 'application/json', ...(opts.headers || {}) };
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`;
  const r = await fetch('/api' + path, { ...opts, headers });
  let j = {}; try { j = await r.json(); } catch { /* noop */ }
  if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
const btnBusy = (el, on, text) => {
  if (!el) return;
  if (on) { el.dataset.orig = el.innerHTML; el.disabled = true; el.innerHTML = `<span class="spinner"></span> ${text || 'Загрузка…'}`; }
  else { el.disabled = false; if (el.dataset.orig) el.innerHTML = el.dataset.orig; }
};

/* --------------------------------------------------------------- boot */
function loadTgSdk() {
  return new Promise(resolve => {
    if (window.Telegram?.WebApp) return resolve();
    // Telegram adds these params to the Web App URL. In a plain browser (or CI)
    // there is no reason to block the boot sequence waiting for the SDK.
    const hash = location.hash || '';
    const inTelegram = /(?:^|[#&])tgWebAppData=/.test(hash) || /(?:^|[#&])tgWebAppVersion=/.test(hash);
    if (!inTelegram) return resolve();
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js'; s.async = true;
    let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
    s.onload = fin; s.onerror = fin; document.head.appendChild(s);
    setTimeout(fin, 2000);
  });
}
/* Telegram дублирует initData в URL-фрагменте (#tgWebAppData=...).
   Если SDK не успел загрузиться, авторизация всё равно работает. */
function initDataFromHash() {
  try {
    const p = new URLSearchParams(location.hash.replace(/^#/, ''));
    return p.get('tgWebAppData') || p.get('initData') || '';
  } catch { return ''; }
}
function applyTgTheme() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  if (tg.colorScheme === 'light') document.documentElement.classList.add('light');
  if (tg.themeParams?.bg_color) $('meta[name=theme-color]')?.setAttribute('content', tg.themeParams.bg_color);
  try { tg.setHeaderColor?.(tg.themeParams?.bg_color || '#070b14'); } catch { /* noop */ }
}
const bootStatus = t => { const e = $('#boot-status'); if (e) e.textContent = t; };

async function init() {
  await loadTgSdk();
  const tg = window.Telegram?.WebApp;
  if (tg) { try { tg.ready(); tg.expand(); tg.enableClosingConfirmation?.(); } catch { /* noop */ } applyTgTheme(); }

  let auth = null;
  const initData = tg?.initData || initDataFromHash();
  if (initData) {
    try { auth = await api('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) }); }
    catch (e) { bootStatus('Telegram: ' + e.message + ' — включаю гостевой режим'); }
  }
  if (!auth) {
    bootStatus('Подключаем блокчейны…');
    try { auth = await api('/auth/demo', { method: 'POST', body: '{}' }); }
    catch (e) {
      $('#boot').innerHTML = `<div class="boot-title">Ошибка</div><div class="boot-sub">${esc(e.message)}</div>`;
      return;
    }
  }
  TOKEN = auth.token; localStorage.setItem('nova_token', TOKEN);
  state.user = auth.user;
  state.fiat = auth.user.settings?.fiat || 'EUR';
  state.hidden = !!auth.user.settings?.hideBalances;

  bootStatus('Загружаем портфель…');
  state.me = await api('/me');
  state.chains = state.me.chains;
  await refreshWallet();
  try { state.activity = (await api('/activity')).txs; } catch { /* noop */ }
  ensureSwapDefaults();

  $('#boot').classList.add('gone');
  setTimeout(() => $('#boot')?.remove(), 420);
  for (const s of ['#header', '#main', '#nav']) $(s)?.classList.remove('hidden');
  renderHeader(); renderNav(); renderAll(); switchTab('home');

  setInterval(() => { if (state.tab === 'activity') loadActivity(true); }, 20000);
}

async function refreshWallet() {
  state.wallet = await api('/wallet');
  state.fiat = state.wallet.portfolio.fiat;
}
function ensureSwapDefaults() {
  const a = state.wallet.portfolio.assets;
  const sorted = [...a].sort((x, y) => y.fiat - x.fiat);
  state.swap.from = sorted[0]?.id || a[0]?.id;
  state.swap.to = a.find(x => x.id === 'solana:SOL')?.id || sorted[1]?.id || a[1]?.id;
}
async function loadActivity(silent = false) {
  try {
    state.activity = (await api('/activity')).txs;
    if (state.tab === 'activity') renderActivity();
  } catch (e) { if (!silent) toast(e.message, 'err'); }
}
async function loadSecurity() {
  try { state.security = await api('/security'); if (state.tab === 'security') renderSecurity(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------------------ chrome */
function renderHeader() {
  const u = state.user;
  const mode = state.me.auth.mode;
  const sandbox = u.settings?.sandbox;
  const chipCls = mode === 'mainnet' ? 'live' : sandbox ? 'sandbox' : 'test';
  const chipText = mode === 'mainnet' ? 'MAINNET' : sandbox ? 'ПЕСОЧНИЦА' : 'TESTNET';
  $('#header').innerHTML = `
    <div class="brand"><div class="logo">N</div><div><div class="brand-name">NOVA</div><div class="brand-sub">wallet</div></div></div>
    <div class="header-right">
      <button class="chip ${chipCls}" data-act="mode-info"><i class="dot"></i>${chipText}</button>
      <button class="avatar" data-act="tab" data-tab="profile">${u.photo ? `<img src="${esc(u.photo)}" alt="">` : esc((u.name || 'N')[0])}</button>
    </div>`;
}
const NAV = [
  { id: 'home', icon: 'home', label: 'Главная' },
  { id: 'swap', icon: 'swap', label: 'Своп' },
  { id: 'activity', icon: 'activity', label: 'Активность' },
  { id: 'security', icon: 'shield', label: 'Защита' },
  { id: 'profile', icon: 'user', label: 'Профиль' },
];
function renderNav() {
  $('#nav').innerHTML = NAV.map(n => `<button class="nav-item ${state.tab === n.id ? 'active' : ''}" data-act="tab" data-tab="${n.id}">${ic(n.icon, 21)}<span>${n.label}</span></button>`).join('');
}
function switchTab(tab) {
  state.tab = tab;
  $$('.view').forEach(v => v.classList.add('hidden'));
  $(`#view-${tab}`)?.classList.remove('hidden');
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'activity') loadActivity(true);
  if (tab === 'security') loadSecurity();
  haptic('light');
}
function renderAll() { renderHome(); renderSwap(); renderActivity(); renderSecurity(); renderProfile(); }

/* -------------------------------------------------------------- home */
const SPARK = `<svg class="spark" viewBox="0 0 320 46" preserveAspectRatio="none"><defs><linearGradient id="sp" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8f7bff" stop-opacity=".45"/><stop offset="1" stop-color="#8f7bff" stop-opacity="0"/></linearGradient><linearGradient id="sl" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#a78bfa"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><path d="M0 36 L18 32 L34 35 L52 25 L70 28 L88 18 L106 22 L124 14 L142 19 L160 10 L178 16 L196 8 L214 13 L232 6 L250 12 L268 5 L286 9 L304 3 L320 6 L320 46 L0 46Z" fill="url(#sp)"/><path d="M0 36 L18 32 L34 35 L52 25 L70 28 L88 18 L106 22 L124 14 L142 19 L160 10 L178 16 L196 8 L214 13 L232 6 L250 12 L268 5 L286 9 L304 3 L320 6" fill="none" stroke="url(#sl)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;

function renderHome() {
  const p = state.wallet.portfolio, w = state.wallet;
  const total = p.total[p.fiat.toLowerCase()] || 0;
  const assets = [...p.assets].sort((a, b) => b.fiat - a.fiat);
  const online = Object.values(p.chainState || {}).filter(Boolean).length;

  const chainCards = state.chains.map(c => {
    const list = assets.filter(a => a.chain === c.id);
    const sum = list.reduce((s, a) => s + a.fiat, 0);
    const ok = p.chainState[c.id];
    return `<button class="chain-card" style="--cc:${c.color}" data-act="chain" data-chain="${c.id}">
      <div class="chain-head"><div class="chain-glyph">${esc(c.glyph)}</div><div><div class="chain-name">${esc(c.name)}</div><div class="chain-sub">${esc(c.sub)}</div></div></div>
      <div class="chain-bal">${state.hidden ? '••••' : money(sum)}</div>
      <div class="chain-units"><span>${list.length} актив.</span><i class="status-dot ${ok ? '' : 'off'}"></i></div>
    </button>`;
  }).join('');

  const assetRows = assets.map(a => `<button class="row clickable" data-act="asset" data-id="${esc(a.id)}">
      <div class="asset-ico" style="--ac:${a.color}">${esc(a.glyph)}</div>
      <div class="row-main"><div class="row-title">${esc(a.symbol)} <span class="tag">${esc(a.chainSub)}</span></div>
        <div class="row-sub">${esc(a.chainName)} · ${a.price ? money(a.price) + ' / ' + esc(a.symbol) : 'курс недоступен'}</div></div>
      <div class="row-right"><div class="row-val">${state.hidden ? '••••' : amt(a.amount)}</div><div class="row-fiat">${state.hidden ? '••••' : money(a.fiat)}</div></div>
    </button>`).join('');

  $('#view-home').innerHTML = `
    <div class="greeting">Привет, <b>${esc(state.user.name.split(' ')[0])}</b> 👋 · ваш кошелёк готов</div>
    <div class="hero">
      <div class="hero-top">
        <div><div class="hero-label">Общий баланс</div></div>
        <div class="hero-tools">
          <button class="mini-btn" data-act="toggle-fiat" title="Валюта">${esc(sym(state.fiat))}</button>
          <button class="mini-btn" data-act="toggle-hide" title="Скрыть балансы">${ic(state.hidden ? 'eye-off' : 'eye', 15)}</button>
          <button class="mini-btn" data-act="refresh" title="Обновить">${ic('refresh', 15)}</button>
        </div>
      </div>
      <div class="hero-amount"><span class="val">${state.hidden ? '••••••' : nf(total, 2)}</span><span class="cur">${esc(state.fiat)}</span></div>
      <div class="hero-note"><i class="pulse"></i>${p.testnet ? 'Тестовая сеть · монеты без реальной стоимости' : 'Реальные средства · синхронизировано'}</div>
      ${SPARK}
      <div class="hero-foot"><span>${state.chains.length} сетей · ${online} онлайн · ${assets.length} активов</span><div class="net-dots">${state.chains.map(c => `<i style="background:${c.color}"></i>`).join('')}</div></div>
    </div>

    ${p.testnet ? `<div class="banner warn">${ic('alert', 16)}<div><b>TESTNET.</b> Здесь тестовые монеты — их нельзя вывести на биржу и они ничего не стоят. Курс показан только для наглядности. ${p.simulated ? '<b>Включена песочница: балансы симулируются.</b>' : ''}</div></div>` : ''}
    ${!p.testnet ? `<div class="banner info">${ic('shield', 16)}<div><b>MAINNET.</b> Реальные средства. Перед крупными суммами включите белый список адресов и проверьте лимиты.</div></div>` : ''}

    <div class="quick">
      <button class="quick-item" data-act="send"><span class="quick-ico">${ic('send', 23)}</span><span>Отправить</span></button>
      <button class="quick-item" data-act="receive"><span class="quick-ico">${ic('receive', 23)}</span><span>Получить</span></button>
      <button class="quick-item" data-act="swap-tab"><span class="quick-ico">${ic('swap', 23)}</span><span>Своп</span></button>
      <button class="quick-item" data-act="faucet"><span class="quick-ico">${ic('droplet', 23)}</span><span>Пополнить</span></button>
    </div>

    <div class="section"><h2>Ваши сети</h2><span class="link">${online}/${state.chains.length} онлайн ${ic('chevron', 13)}</span></div>
    <div class="hscroll">${chainCards}</div>

    <div class="section"><h2>Активы</h2><span class="link">${esc(sym(state.fiat))} · курс CoinGecko</span></div>
    <div class="list">${assetRows || `<div class="empty">${ic('wallet', 30)}<div>Активы загружаются…</div></div>`}</div>

    <div class="banner mt16">${ic('sparkles', 16)}<div><b>Без сид-фразы.</b> Ключи созданы и зашифрованы на сервере, доступ — через ваш Telegram. Реквизиты: ${shortAddr(w.addresses.evm, 8)}</div></div>
  `;
}

/* -------------------------------------------------------------- swap */
function renderSwap() {
  const assets = state.wallet.portfolio.assets;
  const opts = f => assets.map(a => `<option value="${esc(a.id)}" ${state.swap[f] === a.id ? 'selected' : ''}>${esc(a.symbol)} · ${esc(a.chainName)} ${esc(a.chainSub)}</option>`).join('');
  const p = state.wallet.portfolio;
  $('#view-swap').innerHTML = `
    <div class="greeting">Обмен активов по среднерыночному курсу</div>
    <div class="banner ${p.testnet ? 'warn' : 'info'} mb12">${ic('info', 16)}<div>${p.testnet ? '<b>Тестовый режим.</b> Своп симулируется: реальные монеты не перемещаются.' : '<b>Котировка справочная.</b> Ончейн-исполнение требует DEX-агрегатора.'}</div></div>
    <div class="swap-card">
      <div class="swap-label">Отдаёте</div>
      <div class="swap-line"><input class="input" id="swap-amount" type="number" step="any" min="0" placeholder="0.00" inputmode="decimal"><select class="select" id="swap-from">${opts('from')}</select></div>
      <div class="field-hint" id="swap-from-bal"></div>
    </div>
    <div class="swap-mid"><button class="swap-swap" data-act="swap-flip" title="Поменять местами">${ic('swap', 19)}</button></div>
    <div class="swap-card">
      <div class="swap-label">Получаете</div>
      <div class="swap-line"><span class="input" id="swap-out" style="font-size:26px;font-weight:800;border:0;background:none;padding:0;color:var(--muted)">0.00</span><select class="select" id="swap-to">${opts('to')}</select></div>
      <div class="field-hint" id="swap-to-bal"></div>
    </div>
    <div id="quote-slot"></div>
    <button class="btn primary mt16" data-act="swap-quote">${ic('sparkles', 17)} Получить котировку</button>
    <div class="box mt16"><div class="box-title">Как это работает</div>
      <div class="small muted">Курс берётся из CoinGecko, комиссия протокола — 0.3%. В тестовой сети операция помечается как симуляция и попадает в историю без ончейн-движения. В mainnet котировка — только оценка: для реального исполнения подключается LiFi / 1inch / Jupiter.</div>
    </div>`;
  updateSwapHints();
}
function updateSwapHints() {
  const A = assetById(state.swap.from), B = assetById(state.swap.to);
  const a = $('#swap-from-bal'), b = $('#swap-to-bal');
  if (a) a.textContent = A ? `Доступно: ${amt(A.amount)} ${A.symbol} · ≈ ${money(A.fiat)}` : '';
  if (b) b.textContent = B ? `Баланс: ${amt(B.amount)} ${B.symbol} · ≈ ${money(B.fiat)}` : '';
}
async function doQuote() {
  const amount = Number($('#swap-amount')?.value || 0);
  if (!amount || amount <= 0) return toast('Введите сумму', 'err');
  if (state.swap.from === state.swap.to) return toast('Выберите разные активы', 'err');
  const slot = $('#quote-slot'); slot.innerHTML = `<div class="box"><div class="small muted">Получаем котировку…</div></div>`;
  try {
    const r = await api('/swap/quote', { method: 'POST', body: JSON.stringify({ fromAsset: state.swap.from, toAsset: state.swap.to, amount }) });
    state.swap.quote = r.quote;
    const q = r.quote;
    $('#swap-out').textContent = amt(q.to.amount);
    slot.innerHTML = `<div class="quote-box">
      <div class="kv"><span class="k">Курс</span><span class="v">1 ${esc(q.from.symbol)} ≈ ${amt(q.rate)} ${esc(q.to.symbol)}</span></div>
      <div class="kv"><span class="k">Комиссия 0.3%</span><span class="v">${money(q.feeUsd, state.fiat)}</span></div>
      <div class="kv"><span class="k">Сумма</span><span class="v">${money(q.usdIn, state.fiat)}</span></div>
      <div class="kv"><span class="k">Провайдер</span><span class="v">${esc(q.provider)}</span></div>
      <div class="flag ${r.simulated ? 'info' : 'warn'} mt12">${ic(r.simulated ? 'info' : 'alert', 15)}<div>${esc(r.warning)}</div></div>
      <button class="btn ${r.simulated ? 'ghost' : 'primary'} mt12" data-act="swap-execute">${ic('swap', 17)} ${r.simulated ? 'Выполнить симуляцию свопа' : 'Обменять'}</button>
    </div>`;
  } catch (e) { slot.innerHTML = `<div class="flag error">${ic('alert', 15)}<div>${esc(e.message)}</div></div>`; }
}
async function doSwap() {
  const amount = Number($('#swap-amount')?.value || 0);
  if (!state.swap.quote) return toast('Сначала получите котировку', 'err');
  const el = $('[data-act="swap-execute"]'); btnBusy(el, true, 'Меняем…');
  try {
    const r = await api('/swap/execute', { method: 'POST', body: JSON.stringify({ fromAsset: state.swap.from, toAsset: state.swap.to, amount }) });
    toast(`Готово: ${amt(r.received)} ${state.swap.quote.to.symbol}`, 'ok');
    await refreshWallet(); await loadActivity(true); renderAll(); switchTab('swap');
    openSuccess('Своп выполнен', `${amt(amount)} ${state.swap.quote.from.symbol} → ${amt(r.received)} ${state.swap.quote.to.symbol}`, r.warning, null);
  } catch (e) { toast(e.message, 'err'); btnBusy(el, false); }
}

/* ---------------------------------------------------------- activity */
const TX_LABEL = { send: 'Отправка', receive: 'Получение', swap: 'Обмен', faucet: 'Тестовый кран' };
function renderActivity() {
  const txs = state.activity;
  const rows = txs.map(t => {
    const c = chainById(t.chain);
    const sign = t.kind === 'send' ? '−' : '+';
    return `<button class="row clickable" data-act="tx" data-id="${esc(t.id)}">
      <div class="tx-ico ${esc(t.kind)}">${ic(t.kind === 'send' ? 'send' : t.kind === 'swap' ? 'swap' : 'receive', 18)}</div>
      <div class="row-main"><div class="row-title">${esc(TX_LABEL[t.kind] || t.kind)} ${t.simulated ? '<span class="tag">SIM</span>' : ''}</div>
        <div class="row-sub">${esc(c.name)} ${esc(c.sub)} · ${esc(t.to ? shortAddr(t.to, 7) : '—')} · ${esc(timeAgo(t.timestamp))}</div></div>
      <div class="row-right"><div class="row-val">${sign}${amt(t.amount)} ${esc(t.symbol)}</div>
        <div class="row-fiat"><span class="badge ${t.status === 'confirmed' ? 'green' : t.status === 'failed' ? 'red' : 'amber'}">${t.status === 'confirmed' ? 'готово' : t.status === 'failed' ? 'ошибка' : 'в сети'}</span></div></div>
    </button>`;
  }).join('');
  $('#view-activity').innerHTML = `
    <div class="section" style="margin-top:8px"><h2>Активность</h2><button class="link" data-act="refresh">${ic('refresh', 14)} обновить</button></div>
    <div class="banner info mb12">${ic('info', 16)}<div>История объединяет все 6 сетей. Статусы pending обновляются автоматически при открытии вкладки.</div></div>
    <div class="list">${rows || `<div class="empty">${ic('activity', 30)}<div>Пока нет операций.<br>Пополните кошелёк через тестовый кран и попробуйте перевод.</div></div>`}</div>`;
}

/* ---------------------------------------------------------- security */
function renderSecurity() {
  const s = state.security || { checklist: [], settings: {}, limits: {}, addressBook: [], audit: [], vault: {} };
  const done = (s.checklist || []).filter(x => x.done).length;
  const pct = s.checklist?.length ? Math.round(done / s.checklist.length * 100) : 0;
  const R = 40, C = 2 * Math.PI * R;
  const st = s.settings || {};
  const toggle = (key, title, sub, on) => `<div class="toggle-row"><div><div class="t-title">${title}</div><div class="t-sub">${sub}</div></div><button class="switch ${on ? 'on' : ''}" data-act="toggle" data-key="${key}"></button></div>`;
  $('#view-security').innerHTML = `
    <div class="greeting">Всё, что защищает ваши средства</div>
    <div class="list" style="padding:14px">
      <div class="score-box">
        <div class="score-ring"><svg width="96" height="96"><circle cx="48" cy="48" r="${R}" stroke="var(--card2)" stroke-width="8" fill="none"/><circle cx="48" cy="48" r="${R}" stroke="url(#sc)" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/></svg><defs><linearGradient id="sc"><stop stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><div class="num">${pct}%</div></div>
        <div><div style="font-weight:800;font-size:16px">Уровень защиты</div><div class="small muted mt8">${done} из ${s.checklist?.length || 0} мер активны. Включите белый список и антифишинг-код.</div></div>
      </div>
    </div>
    <div class="section"><h2>Чек-лист</h2></div>
    <div class="list" style="padding:6px 14px">${(s.checklist || []).map(x => `<div class="toggle-row"><div><div class="t-title">${x.done ? `<span style="color:var(--green)">${ic('ok', 15)}</span>` : `<span class="dim">${ic('info', 15)}</span>`} ${esc(x.title)}</div><div class="t-sub">${esc(x.detail)}</div></div><span class="badge ${x.done ? 'green' : 'grey'}">${x.done ? 'вкл' : 'выкл'}</span></div>`).join('')}</div>

    <div class="section"><h2>Лимиты</h2><span class="link">USD / 24 ч</span></div>
    <div class="list" style="padding:14px">
      <div class="field-row">
        <div class="field"><label>На операцию ($)</label><input class="input" id="lim-tx" type="number" min="1" value="${s.limits?.perTx ?? 250}"></div>
        <div class="field"><label>Дневной ($)</label><input class="input" id="lim-day" type="number" min="1" value="${s.limits?.daily ?? 1000}"></div>
      </div>
      <div class="kv"><span class="k">Потрачено за 24 ч</span><span class="v">≈ $${nf(s.limits?.spentTodayUsd || 0, 2)}</span></div>
      <button class="btn ghost mt12" data-act="save-limits">${ic('check', 16)} Сохранить лимиты</button>
    </div>

    <div class="section"><h2>Правила</h2></div>
    <div class="list" style="padding:6px 14px">
      ${toggle('whitelistOnly', `${ic('shield', 15)} Только проверенные адреса`, 'Отправка разрешена лишь адресам из адресной книги', !!st.whitelistOnly)}
      ${toggle('sandbox', `${ic('cpu', 15)} Песочница`, 'Симулировать балансы и операции без движения реальных монет', !!st.sandbox)}
      ${toggle('hideBalances', `${ic('eye-off', 15)} Скрывать балансы`, 'Прятать суммы на главном экране', !!st.hideBalances)}
    </div>

    <div class="section"><h2>Антифишинг-код</h2></div>
    <div class="list" style="padding:14px">
      <div class="field"><label>Секретная фраза в уведомлениях</label><input class="input" id="anti-code" placeholder="например: синий-дуб-42" value="${esc(st.antiPhishing || '')}"><div class="field-hint">Бот всегда показывает этот код. Нет кода — сообщение поддельное.</div></div>
      <button class="btn ghost" data-act="save-antiphish">Сохранить код</button>
    </div>

    <div class="section"><h2>Адресная книга</h2><button class="link" data-act="add-addr">${ic('plus', 14)} добавить</button></div>
    <div class="list">${(s.addressBook || []).map(a => `<div class="row"><div class="asset-ico" style="--ac:#7c5cff;font-size:13px">${esc((a.label || 'A')[0])}</div><div class="row-main"><div class="row-title">${esc(a.label)}</div><div class="row-sub mono">${esc(shortAddr(a.address, 12))}</div></div><button class="mini-btn" data-act="addr-delete" data-id="${esc(a.id)}">${ic('trash', 14)}</button></div>`).join('') || `<div class="empty">Пока нет сохранённых адресов</div>`}</div>

    <div class="section"><h2>Хранилище ключей</h2></div>
    <div class="box">
      <div class="kv"><span class="k">Шифрование</span><span class="v">${esc(s.vault?.encryption || 'AES-256-GCM')}</span></div>
      <div class="kv"><span class="k">Отпечаток vault</span><span class="v mono">${esc(s.vault?.fingerprint || '—')}</span></div>
      <div class="kv"><span class="k">Режим</span><span class="v">${esc(s.vault?.mode || 'testnet')}</span></div>
      <div class="kv"><span class="k">EVM путь</span><span class="v mono">${esc(s.vault?.derivation?.evm || '—')}</span></div>
      <div class="kv"><span class="k">BTC путь</span><span class="v mono">${esc(s.vault?.derivation?.btc || '—')}</span></div>
      <div class="kv"><span class="k">SOL путь</span><span class="v mono">${esc(s.vault?.derivation?.sol || '—')}</span></div>
      <div class="flag warn mt12">${ic('alert', 15)}<div>Кастодиальная модель: сервер подписывает транзакции. Для продакшена с реальными деньгами обязательны KMS/HSM, аудит и резервное копирование vault.</div></div>
    </div>

    <div class="section"><h2>Журнал событий</h2></div>
    <div class="list" style="padding:8px 14px">${(s.audit || []).map(a => `<div class="audit-row"><span>${esc(a.action)} ${a.detail ? '· ' + esc(a.detail.slice(0, 50)) : ''}</span><span>${esc(timeAgo(a.at))}</span></div>`).join('') || '<div class="empty small">Пока пусто</div>'}</div>
  `;
}

/* ----------------------------------------------------------- profile */
function renderProfile() {
  const u = state.user, w = state.wallet, v = w.vault;
  $('#view-profile').innerHTML = `
    <div class="greeting">Профиль и настройки</div>
    <div class="hero" style="padding:18px">
      <div style="display:flex;align-items:center;gap:14px;position:relative;z-index:1">
        <div class="avatar" style="width:52px;height:52px;font-size:20px;border-radius:17px">${u.photo ? `<img src="${esc(u.photo)}" alt="">` : esc((u.name || 'N')[0])}</div>
        <div style="flex:1"><div style="font-weight:800;font-size:16px">${esc(u.name)}</div><div class="small muted">${u.username ? '@' + esc(u.username) : ''} · ${u.source === 'telegram' ? 'Telegram ID' : 'Гостевой режим'}</div></div>
        <span class="badge violet">${state.me.auth.mode === 'mainnet' ? 'LIVE' : 'TEST'}</span>
      </div>
    </div>

    <div class="section"><h2>Мои адреса</h2></div>
    <div class="list">${[
      { k: 'EVM', v: w.addresses.evm, c: '#7b8cff', g: 'Ξ' },
      { k: 'Bitcoin', v: w.addresses.bitcoin, c: '#f7931a', g: '₿' },
      { k: 'Solana', v: w.addresses.solana, c: '#14f195', g: 'S' },
    ].map(x => `<div class="row"><div class="asset-ico" style="--ac:${x.c}">${x.g}</div><div class="row-main"><div class="row-title">${x.k}</div><div class="row-sub mono">${esc(shortAddr(x.v, 14))}</div></div><button class="mini-btn" data-act="copy" data-value="${esc(x.v)}">${ic('copy', 15)}</button></div>`).join('')}</div>
    <button class="btn ghost mt12" data-act="receive">${ic('receive', 16)} Показать QR для пополнения</button>

    <div class="section"><h2>Предпочтения</h2></div>
    <div class="list" style="padding:6px 14px">
      <div class="toggle-row"><div><div class="t-title">Валюта отображения</div><div class="t-sub">Сейчас ${esc(state.fiat)}</div></div><button class="btn ghost small" data-act="toggle-fiat">${esc(sym(state.fiat))} — сменить</button></div>
      <div class="kv"><span class="k">Vault</span><span class="v mono">${esc(v.fingerprint)}</span></div>
      <div class="kv"><span class="k">Шифрование</span><span class="v">${esc(v.encryption)}</span></div>
    </div>

    <div class="section"><h2>Сети</h2></div>
    <div class="list" style="padding:6px 14px">${state.chains.map(c => `<div class="chain-mini"><div class="glyph" style="background:${c.color}">${esc(c.glyph)}</div><div style="flex:1"><b>${esc(c.name)}</b> <span class="dim small">${esc(c.sub)}</span></div>${c.explorer ? `<button class="mini-btn" data-act="open-explorer" data-url="${esc(c.explorer)}">${ic('external', 14)}</button>` : ''}</div>`).join('')}</div>

    <div class="section"><h2>Опасная зона</h2></div>
    <div class="box" style="border-color:rgba(251,113,133,.25)">
      <div class="small muted">Экспорт приватных ключей вашего дочернего кошелька. Никогда никому не показывайте их — это даёт полный контроль над средствами.</div>
      <button class="btn danger mt12" data-act="export">${ic('key', 16)} Экспортировать ключи</button>
    </div>

    <div class="divider"></div>
    <div class="center small dim">NOVA Wallet v1.0.2 · ${esc(state.me.auth.mode)}<br>Мультичейн без сид-фразы · Telegram Mini App</div>
    <div class="btn-row mt16"><button class="btn ghost" data-act="about">${ic('info', 16)} О проекте</button><button class="btn ghost" data-act="logout">${ic('x', 16)} Выйти</button></div>
    <div style="height:10px"></div>`;
}

/* ------------------------------------------------------------ modals */
let closeTimer = null;
function openModal(content, cls = '') {
  // A pending close animation must never wipe a modal opened right after it.
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="sheet ${cls}"><div class="sheet-handle"></div>${content}</div></div>`;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => $('.modal-backdrop', root)?.classList.add('show'));
  return $('.sheet', root);
}
function closeModal() {
  stopCamera();
  const b = $('.modal-backdrop');
  if (b) b.classList.remove('show');
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    $('#modal-root').innerHTML = '';
    document.body.classList.remove('modal-open');
    closeTimer = null;
  }, 230);
}
const sheetHead = (title, sub = '') => `<div class="sheet-head"><div><div class="sheet-title">${title}</div>${sub ? `<div class="sheet-sub">${sub}</div>` : ''}</div><button class="x-btn" data-act="close-modal">${ic('x', 16)}</button></div>`;

function openSuccess(title, text, note = '', url = null) {
  openModal(`${sheetHead('')}
    <div class="center"><div class="success-ico">${ic('check', 32)}</div>
      <div style="font-size:18px;font-weight:800">${esc(title)}</div>
      <div class="small muted mt8">${esc(text)}</div>
      ${note ? `<div class="banner info mt16" style="text-align:left">${ic('info', 15)}<div>${esc(note)}</div></div>` : ''}
    </div>
    <div class="btn-row mt16">${url ? `<button class="btn ghost" data-act="open-explorer" data-url="${esc(url)}">${ic('external', 16)} В эксплорере</button>` : ''}<button class="btn primary" data-act="close-modal">Готово</button></div>`);
}

/* -------------------------------------------------------------- send */
function openSend(assetId) {
  const assets = state.wallet.portfolio.assets;
  const sel = assetId || [...assets].sort((a, b) => b.fiat - a.fiat)[0]?.id || assets[0].id;
  const ab = state.user.addressBook || [];
  openModal(`${sheetHead('Отправить', 'Сначала — симуляция, потом подпись')}
    <div id="send-step1">
      <div class="field"><label>Актив</label><select class="select" id="send-asset">${assets.map(a => `<option value="${esc(a.id)}" ${a.id === sel ? 'selected' : ''}>${esc(a.symbol)} · ${esc(a.chainName)} ${esc(a.chainSub)} — ${amt(a.amount)}</option>`).join('')}</select></div>
      <div class="field"><label>Адрес получателя</label>
        <div class="input-group"><input class="input mono" id="send-to" placeholder="0x… / bc1… / base58" autocomplete="off" spellcheck="false"><button class="input-suffix" data-act="scan" style="background:none;color:var(--accent2);font-weight:800">СКАН</button></div>
        <div class="field-hint" id="send-addr-hint"></div>
      </div>
      ${ab.length ? `<div class="field"><label>Проверенные адреса</label>${ab.slice(0, 4).map(a => `<button class="btn ghost small" data-act="pick-addr" data-addr="${esc(a.address)}" style="width:100%;justify-content:space-between;margin-bottom:6px">${esc(a.label)} <span class="dim mono">${shortAddr(a.address, 9)}</span></button>`).join('')}</div>` : ''}
      <div class="field"><label>Сумма</label>
        <div class="input-group"><input class="input" id="send-amount" type="number" step="any" min="0" placeholder="0.00" inputmode="decimal"><span class="input-suffix" id="send-sym">—</span></div>
        <div class="field-hint" id="send-avail"></div>
      </div>
      <button class="btn primary" data-act="send-simulate">${ic('shield', 17)} Проверить транзакцию</button>
      <div class="field-hint center mt12">Ни одна транзакция не подписывается без вашего явного подтверждения.</div>
    </div>
    <div id="send-step2" class="hidden"></div>`);
  updateSendAsset();
}
function updateSendAsset() {
  const a = assetById($('#send-asset')?.value);
  if (!a) return;
  const c = chainById(a.chain);
  $('#send-sym').textContent = a.symbol;
  $('#send-avail').textContent = `Доступно: ${amt(a.amount)} ${a.symbol} · ≈ ${money(a.fiat)}`;
  $('#send-addr-hint').textContent = c.kind === 'evm' ? 'Формат: 0x… (EVM-адрес, 42 символа)' : c.kind === 'btc' ? 'Формат: bc1… / tb1… (bech32)' : 'Формат: base58 (32–44 символа)';
}
async function doSimulate(el) {
  const a = assetById($('#send-asset')?.value);
  const to = ($('#send-to')?.value || '').trim();
  const amount = ($('#send-amount')?.value || '').trim();
  if (!to) return toast('Укажите адрес получателя', 'err');
  if (!amount || Number(amount) <= 0) return toast('Укажите сумму больше нуля', 'err');
  btnBusy(el, true, 'Симулируем…');
  try {
    const r = await api('/simulate', { method: 'POST', body: JSON.stringify({ chain: a.chain, to, asset: a.symbol, amount }) });
    state.send = { payload: { chain: a.chain, to, asset: a.symbol, amount }, sim: r.simulation };
    renderSimStep();
  } catch (e) { toast(e.message, 'err', 6000); btnBusy(el, false); }
}
function renderSimStep() {
  const s = state.send.sim;
  const flags = (s.flags || []).map(f => `<div class="flag ${f.level === 'error' ? 'error' : f.level === 'warn' ? 'warn' : 'info'}">${ic(f.level === 'error' || f.level === 'warn' ? 'alert' : 'info', 15)}<div>${esc(f.text)}</div></div>`).join('');
  const kv = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  $('#send-step1').classList.add('hidden');
  const box = $('#send-step2');
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="box accent"><div class="box-title">Вы подписываете</div>
      <div style="font-size:28px;font-weight:800;letter-spacing:-.03em">${esc(s.amount)} ${esc(s.token)}</div>
      <div class="small muted mt8">${esc(s.chainName)} · ${esc(s.method)}</div>
    </div>
    <div class="list" style="padding:4px 14px">
      ${kv('Кому', `<span class="mono">${esc(shortAddr(s.to, 12))}</span>`)}
      ${kv('Откуда', `<span class="mono">${esc(shortAddr(s.from, 12))}</span>`)}
      ${kv('Комиссия сети', `${s.fee} ${esc(s.feeSymbol)}`)}
      ${s.gas ? kv('Газ / цена', `${s.gas} · ${Number(s.gasPriceGwei).toFixed(2)} gwei`) : ''}
      ${s.inputs ? kv('UTXO / fee rate', `${s.inputs} · ${esc(s.feeRate)}`) : ''}
      ${s.change ? kv('Сдача', `${s.change} BTC`) : ''}
      ${kv('Оценка в USD', `≈ $${nf(s.risk?.usd || 0, 2)}`)}
      ${kv('Лимит операции', `$${nf(s.risk?.perTx || 0, 0)} · дневной $${nf(s.risk?.daily || 0, 0)}`)}
    </div>
    ${flags}
    ${s.sandbox ? `<div class="flag info">${ic('info', 15)}<div>Песочница: транзакция будет симулирована, реальные монеты не двинутся.</div></div>` : ''}
    ${s.ready ? `<div class="flag ok">${ic('ok', 15)}<div>Симуляция пройдена. Параметры зафиксированы — подписать можно именно их.</div></div>` : `<div class="flag error">${ic('alert', 15)}<div>Отправка заблокирована: исправьте ошибки выше.</div></div>`}
    <div class="btn-row mt16"><button class="btn ghost" data-act="send-back">Изменить</button><button class="btn primary" data-act="send-confirm" ${s.ready ? '' : 'disabled'}>${ic('lock', 16)} Подписать и отправить</button></div>`;
}
async function doSend(el) {
  const { payload, sim } = state.send;
  if (!sim?.confirmToken) return toast('Повторите симуляцию', 'err');
  btnBusy(el, true, 'Подписываем…');
  try {
    const r = await api('/send', { method: 'POST', body: JSON.stringify({ ...payload, confirmToken: sim.confirmToken }) });
    haptic('success');
    await refreshWallet(); await loadActivity(true); renderHeader(); renderHome(); renderActivity(); renderProfile();
    openSuccess('Транзакция отправлена', `${amt(payload.amount)} ${payload.asset} → ${shortAddr(payload.to, 8)}`,
      r.simulated ? 'Симуляция: реальные монеты не перемещались.' : 'Статус обновится автоматически в разделе «Активность».', r.explorer);
  } catch (e) { toast(e.message, 'err', 6000); btnBusy(el, false); }
}

/* ----------------------------------------------------------- receive */
function openReceive(chain) {
  state.recvChain = chain || 'ethereum';
  renderReceive();
}
function renderReceive() {
  const a = state.wallet.addresses;
  const ch = state.recvChain === 'bitcoin' ? 'bitcoin' : state.recvChain === 'solana' ? 'solana' : 'evm';
  const addr = ch === 'evm' ? a.evm : a[ch];
  const label = ch === 'evm' ? 'EVM-сети' : ch === 'bitcoin' ? 'Bitcoin' : 'Solana';
  const c = chainById(ch === 'evm' ? 'ethereum' : ch);
  openModal(`${sheetHead('Получить', 'Покажите QR или скопируйте адрес')}
    <div class="segmented">
      <button class="${ch === 'evm' ? 'active' : ''}" data-act="recv-chain" data-chain="ethereum">EVM · 4 сети</button>
      <button class="${ch === 'bitcoin' ? 'active' : ''}" data-act="recv-chain" data-chain="bitcoin">Bitcoin</button>
      <button class="${ch === 'solana' ? 'active' : ''}" data-act="recv-chain" data-chain="solana">Solana</button>
    </div>
    <div class="center"><div class="qr-wrap" id="qr-slot"><span class="spinner" style="border-color:rgba(0,0,0,.2);border-top-color:#333"></span></div>
      <div class="small muted">${esc(label)} · ${esc(c.sub || '')}</div></div>
    <div class="addr-box mono mt12">${esc(addr)}</div>
    <div class="btn-row mt12"><button class="btn primary" data-act="copy" data-value="${esc(addr)}">${ic('copy', 16)} Копировать адрес</button></div>
    ${c.faucet ? `<button class="btn ghost mt12" data-act="open-explorer" data-url="${esc(c.faucet)}">${ic('droplet', 16)} Получить тестовые монеты</button>` : ''}
    <div class="banner warn mt16">${ic('alert', 15)}<div>Отправляйте на этот адрес только монеты сети <b>${esc(label)}</b>. Монеты из другой сети будут потеряны.</div></div>`);
  fetch(`/api/qr.svg?text=${encodeURIComponent(addr)}`).then(r => r.text()).then(svg => {
    const slot = $('#qr-slot'); if (slot) slot.innerHTML = svg;
  }).catch(() => { const s = $('#qr-slot'); if (s) s.innerHTML = '<div class="small">QR недоступен</div>'; });
}

/* ------------------------------------------------------------ faucet */
function openFaucet() {
  const a = state.wallet.addresses;
  openModal(`${sheetHead('Пополнить', 'Тестовые монеты — бесплатно')}
    <div class="banner warn mb12">${ic('alert', 16)}<div>В тестовой сети монеты <b>не имеют реальной стоимости</b>. Не отправляйте сюда настоящие BTC/ETH/SOL.</div></div>
    <div class="box accent"><div class="box-title">Solana Devnet — авто-кран</div>
      <div class="small muted">Нажмите — сервер запросит 1 SOL из публичного devnet-крана, и баланс появится на блокчейне.</div>
      <div class="addr-box mono mt12">${esc(a.solana)}</div>
      <button class="btn primary mt12" data-act="faucet-go" data-chain="solana">${ic('droplet', 17)} Получить 1 SOL</button>
    </div>
    <div class="section"><h2>Другие сети</h2></div>
    <div class="list">${state.chains.filter(c => c.id !== 'solana').map(c => `<div class="row"><div class="asset-ico" style="--ac:${c.color}">${esc(c.glyph)}</div><div class="row-main"><div class="row-title">${esc(c.name)} <span class="tag">${esc(c.sub)}</span></div><div class="row-sub">${c.faucet ? 'Открыть кран и вставить адрес' : 'Кран недоступен'}</div></div><button class="mini-btn" data-act="faucet-go" data-chain="${c.id}">${ic('external', 15)}</button></div>`).join('')}</div>
    <div class="field-hint center mt12">Адрес для EVM-сетей: <span class="mono">${esc(shortAddr(a.evm, 10))}</span> · Bitcoin: <span class="mono">${esc(shortAddr(a.bitcoin, 10))}</span></div>`);
}
async function doFaucet(chain, el) {
  const c = chainById(chain);
  if (chain !== 'solana') {
    const a = state.wallet.addresses;
    const addr = c.kind === 'evm' ? a.evm : a.bitcoin;
    await copy(addr, 'Адрес скопирован — вставьте его в кране');
    if (c.faucet) openExt(c.faucet);
    return;
  }
  btnBusy(el, true, 'Запрашиваем SOL…');
  try {
    const r = await api('/faucet', { method: 'POST', body: JSON.stringify({ chain }) });
    if (r.manual) { toast(r.instructions || 'Кран недоступен — попробуйте позже', 'info', 6000); btnBusy(el, false); return; }
    toast('1 SOL зачислен на devnet-адрес', 'ok');
    await refreshWallet(); await loadActivity(true); renderHome(); renderActivity();
    openSuccess('Кошелёк пополнен', '1 SOL (devnet) зачислен на ваш адрес', 'Это реальная ончейн-транзакция в тестовой сети.', r.explorer);
  } catch (e) { toast(e.message, 'err', 6000); btnBusy(el, false); }
}

/* -------------------------------------------------------- chain/asset */
function openChain(id) {
  const c = chainById(id), p = state.wallet.portfolio;
  const list = p.assets.filter(a => a.chain === id);
  openModal(`${sheetHead(esc(c.name), esc(c.sub) + ' · ' + (p.chainState[id] ? 'онлайн' : 'RPC недоступен'))}
    <div class="list">${list.map(a => `<div class="row"><div class="asset-ico" style="--ac:${a.color}">${esc(a.glyph)}</div><div class="row-main"><div class="row-title">${esc(a.symbol)}</div><div class="row-sub">${money(a.price)} / ${esc(a.symbol)}</div></div><div class="row-right"><div class="row-val">${amt(a.amount)}</div><div class="row-fiat">${money(a.fiat)}</div></div></div>`).join('')}</div>
    <div class="box"><div class="kv"><span class="k">Стоимость в сети</span><span class="v">${money(list.reduce((s, a) => s + a.fiat, 0))}</span></div>${c.chainId ? `<div class="kv"><span class="k">Chain ID</span><span class="v">${c.chainId}</span></div>` : ''}<div class="kv"><span class="k">Тип</span><span class="v">${esc(c.kind.toUpperCase())}</span></div></div>
    <div class="btn-row"><button class="btn ghost" data-act="send">${ic('send', 16)} Отправить</button><button class="btn ghost" data-act="receive">${ic('receive', 16)} Получить</button></div>
    ${c.explorer ? `<button class="btn ghost mt12" data-act="open-explorer" data-url="${esc(c.explorer)}">${ic('external', 16)} Открыть эксплорер</button>` : ''}`);
}
function openAsset(id) {
  const a = assetById(id); if (!a) return;
  openModal(`${sheetHead(`${esc(a.symbol)} · ${esc(a.chainName)}`, esc(a.chainSub))}
    <div class="center" style="padding:10px 0 18px"><div class="asset-ico" style="--ac:${a.color};width:64px;height:64px;font-size:28px;margin:0 auto 12px;border-radius:22px">${esc(a.glyph)}</div>
      <div style="font-size:30px;font-weight:800">${amt(a.amount)} <span class="small muted">${esc(a.symbol)}</span></div>
      <div class="muted small mt8">≈ ${money(a.fiat)} · ${money(a.price)} за ${esc(a.symbol)}</div></div>
    <div class="box">${a.contract ? `<div class="kv"><span class="k">Контракт</span><span class="v mono">${esc(shortAddr(a.contract, 10))}</span></div>` : ''}<div class="kv"><span class="k">Сеть</span><span class="v">${esc(a.chainName)} ${esc(a.chainSub)}</span></div><div class="kv"><span class="k">Тип</span><span class="v">${a.kind === 'token' ? 'ERC-20 токен' : 'Нативная монета'}</span></div><div class="kv"><span class="k">Онлайн</span><span class="v">${state.wallet.portfolio.chainState[a.chain] ? 'да' : 'нет'}</span></div></div>
    <div class="btn-row"><button class="btn primary" data-act="send" data-id="${esc(a.id)}">${ic('send', 16)} Отправить</button><button class="btn ghost" data-act="receive">${ic('receive', 16)} Получить</button></div>
    <button class="btn ghost mt12" data-act="swap-tab">${ic('swap', 16)} Обменять</button>`);
}
function openTx(id) {
  const t = state.activity.find(x => x.id === id); if (!t) return;
  const c = chainById(t.chain);
  openModal(`${sheetHead(TX_LABEL[t.kind] || t.kind, timeAgo(t.timestamp))}
    <div class="center" style="padding:8px 0 16px"><div style="font-size:28px;font-weight:800">${t.kind === 'send' ? '−' : '+'}${amt(t.amount)} ${esc(t.symbol)}</div>
      <div class="mt8"><span class="badge ${t.status === 'confirmed' ? 'green' : t.status === 'failed' ? 'red' : 'amber'}">${esc(t.status)}</span> ${t.simulated ? '<span class="badge violet">SIM</span>' : ''}</div></div>
    <div class="box"><div class="kv"><span class="k">Сеть</span><span class="v">${esc(c.name)} ${esc(c.sub)}</span></div>
      <div class="kv"><span class="k">Кому</span><span class="v mono">${esc(t.to ? shortAddr(t.to, 14) : '—')}</span></div>
      <div class="kv"><span class="k">Оценка</span><span class="v">$${nf(t.fiat || 0, 2)}</span></div>
      <div class="kv"><span class="k">Хеш</span><span class="v mono">${esc(t.hash ? shortAddr(t.hash, 12) : '—')}</span></div>
      ${t.note ? `<div class="kv"><span class="k">Примечание</span><span class="v">${esc(t.note)}</span></div>` : ''}</div>
    ${t.explorer ? `<button class="btn ghost" data-act="open-explorer" data-url="${esc(t.explorer)}">${ic('external', 16)} Открыть в эксплорере</button>` : ''}
    <button class="btn primary mt12" data-act="close-modal">Закрыть</button>`);
}

/* ------------------------------------------------------------ misc */
function openModeInfo() {
  const v = state.wallet.vault;
  openModal(`${sheetHead('Режим работы', 'Что важно знать')}
    <div class="box accent"><div class="box-title">${esc(v.mode === 'mainnet' ? 'MAINNET — реальные средства' : 'TESTNET — тестовые монеты')}</div>
      <div class="small">${v.mode === 'mainnet' ? 'Все операции необратимы и происходят в реальных блокчейнах.' : 'Адреса и подписи настоящие, но монеты из тестовых сетей ничего не стоят. Это безопасно для проверки продукта.'}</div></div>
    <div class="box"><div class="kv"><span class="k">Сетей</span><span class="v">${state.chains.length}</span></div>
      <div class="kv"><span class="k">Vault</span><span class="v mono">${esc(v.fingerprint)}</span></div>
      <div class="kv"><span class="k">Шифрование</span><span class="v">${esc(v.encryption)}</span></div>
      <div class="kv"><span class="k">Вход</span><span class="v">${state.me.auth.telegram ? 'Telegram initData' : 'Гостевой (демо)'}</span></div></div>
    <div class="flag warn">${ic('alert', 15)}<div>Это MVP. Для работы с реальными деньгами нужны независимый аудит, KMS/HSM, мониторинг и юркомплаенс.</div></div>
    <button class="btn primary mt16" data-act="close-modal">Понятно</button>`);
}
function openAbout() {
  openModal(`${sheetHead('О проекте', 'NOVA Wallet v1.0.2')}
    <div class="banner info mb12">${ic('sparkles', 16)}<div><b>Идея:</b> кошелёк, где не нужно хранить сид-фразу, а каждая операция сначала показывается человеку понятным языком.</div></div>
    <div class="box"><div class="kv"><span class="k">Блокчейны</span><span class="v">EVM ×4, Bitcoin, Solana</span></div>
      <div class="kv"><span class="k">Криптография</span><span class="v">BIP-39 / BIP-32 / BIP-84 / SLIP-0010</span></div>
      <div class="kv"><span class="k">Шифрование</span><span class="v">AES-256-GCM</span></div>
      <div class="kv"><span class="k">Авторизация</span><span class="v">Telegram WebApp HMAC</span></div>
      <div class="kv"><span class="k">Формат</span><span class="v">Telegram Mini App + PWA</span></div></div>
    <div class="small muted mt12">Документация: архитектура, безопасность, запуск бота и дорожная карта — в папке проекта Google Drive.</div>
    <button class="btn primary mt16" data-act="close-modal">Закрыть</button>`);
}
function openAddressBook() {
  const sheet = openModal(`${sheetHead('Новый адрес', 'Добавить в белый список')}
    <div class="field"><label>Название</label><input class="input" id="ab-label" placeholder="Мой второй кошелёк"></div>
    <div class="field"><label>Адрес</label><input class="input mono" id="ab-addr" placeholder="0x… / bc1… / base58" spellcheck="false"></div>
    <div class="field"><label>Сеть (необязательно)</label><select class="select" id="ab-chain"><option value="">Любая</option>${state.chains.map(c => `<option value="${c.id}">${esc(c.name)} ${esc(c.sub)}</option>`).join('')}</select></div>
    <button class="btn primary" data-act="addr-save">${ic('check', 16)} Сохранить адрес</button>`);
  sheet?.querySelector('#ab-label')?.focus();
}
function openExport() {
  openModal(`${sheetHead('Экспорт ключей', 'Опасная зона')}
    <div class="banner warn mb12">${ic('alert', 16)}<div><b>Стоп.</b> Приватные ключи дают полный контроль над монетами. Никто — включая поддержку NOVA — не должен их просить. Экспорт записывается в журнал событий.</div></div>
    <div class="field"><label>Введите фразу «Я ПОНИМАЮ РИСК»</label><input class="input" id="export-confirm" placeholder="Я ПОНИМАЮ РИСК" autocomplete="off"></div>
    <button class="btn danger" data-act="export-confirm">${ic('key', 16)} Показать приватные ключи</button>
    <div id="export-out"></div>`);
}
async function doExport(el) {
  const phrase = $('#export-confirm')?.value.trim();
  if (phrase !== 'Я ПОНИМАЮ РИСК') return toast('Введите фразу подтверждения точно', 'err');
  btnBusy(el, true, 'Расшифровываем…');
  try {
    const r = await api('/export', { method: 'POST', body: JSON.stringify({ confirm: phrase }) });
    const box = (k, v) => `<div class="field"><label>${k}</label><div class="addr-box mono">${esc(v)}</div><button class="btn ghost small mt8" data-act="copy" data-value="${esc(v)}">${ic('copy', 14)} Копировать</button></div>`;
    $('#export-out').innerHTML = `<div class="divider"></div><div class="flag error mb12">${ic('alert', 15)}<div>${esc(r.warning)}</div></div>
      ${box('EVM private key', r.evm_private_key)}${box('Bitcoin WIF', r.bitcoin_wif)}${box('Solana secret key', r.solana_secret_key)}`;
    toast('Ключи показаны. Не делайте скриншот.', 'err', 8000);
  } catch (e) { toast(e.message, 'err'); btnBusy(el, false); }
}
function logout() {
  localStorage.removeItem('nova_token'); TOKEN = ''; location.reload();
}

/* ------------------------------------------------------------ camera */
function stopCamera() {
  if (state.camera) { try { state.camera.getTracks().forEach(t => t.stop()); } catch { /* noop */ } state.camera = null; }
}
async function scanQR() {
  const tg = window.Telegram?.WebApp;
  if (tg?.showScanQrPopup) {
    tg.showScanQrPopup({ text: 'Наведите камеру на QR-код с адресом' }, data => {
      if (typeof data === 'string' && data) { const el = $('#send-to'); if (el) el.value = data.trim(); haptic('success'); toast('Адрес подставлен', 'ok'); }
      return true;
    });
    return;
  }
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) return toast('Сканер недоступен — вставьте адрес вручную', 'info');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    state.camera = stream;
    openModal(`${sheetHead('Сканирование', 'Наведите камеру на QR')}<video id="cam" autoplay playsinline style="width:100%;border-radius:16px;background:#000"></video><button class="btn ghost mt12" data-act="close-modal">Отмена</button>`);
    const v = $('#cam'); v.srcObject = stream; await v.play();
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const tick = async () => {
      if (!state.camera) return;
      try { const codes = await detector.detect(v); if (codes[0]?.rawValue) { stopCamera(); closeModal(); setTimeout(() => { const e = $('#send-to'); if (e) e.value = codes[0].rawValue.trim(); }, 260); toast('Адрес подставлен', 'ok'); return; } } catch { /* noop */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (e) { toast('Камера недоступна: ' + e.message, 'err'); }
}

/* ---------------------------------------------------------- settings */
async function patchSettings(patch, msg = 'Сохранено') {
  try {
    const r = await api('/settings', { method: 'POST', body: JSON.stringify(patch) });
    Object.assign(state.user.settings, r.settings);
    state.hidden = !!r.settings.hideBalances;
    state.fiat = r.settings.fiat;
    toast(msg, 'ok');
    return r.settings;
  } catch (e) { toast(e.message, 'err'); return null; }
}
async function toggleSetting(key) {
  const cur = !!state.user.settings[key];
  const s = await patchSettings({ [key]: !cur }, !cur ? 'Включено' : 'Выключено');
  if (!s) return;
  if (key === 'sandbox' || key === 'fiat') { await refreshWallet(); }
  renderHeader(); renderAll(); switchTab(state.tab);
}
async function saveLimits() {
  const perTxLimitUsd = Number($('#lim-tx')?.value || 0);
  const dailyLimitUsd = Number($('#lim-day')?.value || 0);
  if (!perTxLimitUsd || !dailyLimitUsd) return toast('Лимиты должны быть больше нуля', 'err');
  await patchSettings({ perTxLimitUsd, dailyLimitUsd }, 'Лимиты обновлены');
  await loadSecurity();
}
async function saveAntiphish() {
  await patchSettings({ antiPhishing: ($('#anti-code')?.value || '').trim().slice(0, 40) }, 'Код сохранён');
  await loadSecurity();
}
async function saveAddress() {
  const label = ($('#ab-label')?.value || '').trim(), address = ($('#ab-addr')?.value || '').trim();
  const chain = $('#ab-chain')?.value || null;
  if (!label || !address) return toast('Заполните название и адрес', 'err');
  try {
    const r = await api('/address-book', { method: 'POST', body: JSON.stringify({ label, address, chain }) });
    state.user.addressBook = r.items;
    closeModal(); await loadSecurity(); toast('Адрес добавлен', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}
async function deleteAddress(id) {
  try {
    const r = await api('/address-book', { method: 'DELETE', body: JSON.stringify({ id }) });
    state.user.addressBook = r.items; await loadSecurity(); toast('Адрес удалён', 'ok');
  } catch (e) { toast(e.message, 'err'); }
}
async function refreshAll() {
  toast('Обновляем данные…', 'info', 2000);
  try { await refreshWallet(); await loadActivity(true); await loadSecurity(); renderHeader(); renderAll(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ------------------------------------------------------ global events */
document.addEventListener('click', async e => {
  if (e.target.classList?.contains('modal-backdrop')) { closeModal(); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'tab': closeModal(); switchTab(el.dataset.tab); break;
    case 'close-modal': closeModal(); break;
    case 'send': openSend(el.dataset.id); break;
    case 'receive': openReceive(); break;
    case 'faucet': openFaucet(); break;
    case 'swap-tab': closeModal(); switchTab('swap'); break;
    case 'refresh': refreshAll(); break;
    case 'mode-info': openModeInfo(); break;
    case 'about': openAbout(); break;
    case 'logout': logout(); break;
    case 'chain': openChain(el.dataset.chain); break;
    case 'asset': openAsset(el.dataset.id); break;
    case 'tx': openTx(el.dataset.id); break;
    case 'copy': copy(el.dataset.value); break;
    case 'open-explorer': openExt(el.dataset.url); break;
    case 'toggle-fiat': { const f = state.fiat === 'EUR' ? 'USD' : 'EUR'; await patchSettings({ fiat: f }, `Валюта: ${f}`); await refreshWallet(); renderAll(); break; }
    case 'toggle-hide': { await patchSettings({ hideBalances: !state.hidden }); renderHome(); renderProfile(); break; }
    case 'scan': scanQR(); break;
    case 'pick-addr': { const t = $('#send-to'); if (t) t.value = el.dataset.addr; haptic('light'); break; }
    case 'send-simulate': doSimulate(el); break;
    case 'send-back': { $('#send-step2').classList.add('hidden'); $('#send-step1').classList.remove('hidden'); btnBusy($('[data-act="send-simulate"]'), false); break; }
    case 'send-confirm': doSend(el); break;
    case 'recv-chain': openReceive(el.dataset.chain); break;
    case 'faucet-go': doFaucet(el.dataset.chain, el); break;
    case 'swap-flip': { const f = state.swap.from; state.swap.from = state.swap.to; state.swap.to = f; state.swap.quote = null; renderSwap(); break; }
    case 'swap-quote': doQuote(); break;
    case 'swap-execute': doSwap(); break;
    case 'toggle': toggleSetting(el.dataset.key); break;
    case 'save-limits': saveLimits(); break;
    case 'save-antiphish': saveAntiphish(); break;
    case 'add-addr': openAddressBook(); break;
    case 'addr-save': saveAddress(); break;
    case 'addr-delete': deleteAddress(el.dataset.id); break;
    case 'export': openExport(); break;
    case 'export-confirm': doExport(el); break;
    default: break;
  }
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'send-asset') updateSendAsset();
  if (id === 'swap-from' || id === 'swap-to') {
    state.swap[id === 'swap-from' ? 'from' : 'to'] = e.target.value;
    state.swap.quote = null;
    const q = $('#quote-slot'); if (q) q.innerHTML = '';
    const out = $('#swap-out'); if (out) out.textContent = '0.00';
    updateSwapHints();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'swap-amount') { state.swap.quote = null; const q = $('#quote-slot'); if (q) q.innerHTML = ''; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

init().catch(e => {
  console.error(e);
  const b = $('#boot');
  if (b) b.innerHTML = `<div class="boot-title">Не удалось запустить</div><div class="boot-sub">${esc(e.message)}</div><button class="btn ghost small mt16" onclick="location.reload()">Повторить</button>`;
});
