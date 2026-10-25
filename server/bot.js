import { BOT_TOKEN, WEBAPP_URL, MODE, IS_MAINNET } from './config.js';
import { getOrCreateUser } from './db.js';
import { addressesFor } from './vault.js';
import { getPortfolio } from './chains/index.js';

const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function call(method, payload = {}, timeout = 15000) {
  const r = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeout),
  });
  return r.json();
}

const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Открыть NOVA Wallet', web_app: { url: WEBAPP_URL } }],
      [{ text: '💰 Баланс', callback_data: 'balance' }, { text: '📥 Реквизиты', callback_data: 'address' }],
      [{ text: '🛡 Безопасность', callback_data: 'security' }, { text: '❓ Помощь', callback_data: 'help' }],
    ],
  };
}

function profileOf(from) {
  return {
    id: `tg_${from.id}`,
    name: [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Друг',
    username: from.username || '', photo: '', source: 'telegram',
  };
}

const HELP = [
  '<b>NOVA Wallet</b> — мультичейн-кошелёк прямо в Telegram.',
  '',
  '🚀 <b>Вход без сид-фразы</b> — кошелёк создаётся при первом запуске.',
  '🌐 <b>6 сетей</b> — Ethereum, Base, Arbitrum, Polygon, Bitcoin, Solana.',
  '🔍 <b>Симуляция</b> — вы видите комиссию и риски до подписи.',
  '🛡 <b>Лимиты</b> — per-tx, дневной лимит и белый список адресов.',
  '',
  'Команды: /balance · /address · /security · /help',
  IS_MAINNET ? '⚠️ <b>MAINNET</b> — реальные средства.' : '🧪 <b>TESTNET</b> — тестовые монеты, реальной стоимости нет.',
].join('\n');

async function send(chatId, text, extra = {}) {
  return call('sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML',
    disable_web_page_preview: true, ...extra,
  });
}

async function handleCommand(chatId, cmd, from) {
  const user = getOrCreateUser(profileOf(from));
  if (cmd === '/start') {
    return send(chatId, [
      `Привет, ${esc(user.name)}! 👋`,
      '',
      'Это <b>NOVA Wallet</b> — кошелёк, в котором не нужно запоминать сид-фразу.',
      'Нажмите кнопку ниже: ваш мультичейн-кошелёк уже создан.',
      '',
      IS_MAINNET ? '⚠️ Режим MAINNET: реальные средства.' : '🧪 Сейчас тестовая сеть — можно пробовать всё без риска.',
    ].join('\n'), { reply_markup: mainKeyboard() });
  }
  if (cmd === '/help' || cmd === 'help') return send(chatId, HELP, { reply_markup: mainKeyboard() });
  if (cmd === '/balance' || cmd === 'balance') {
    const a = addressesFor(user.index);
    const p = await getPortfolio(a, user.settings?.fiat || 'EUR');
    const lines = p.assets.filter(x => Number(x.amount) > 0).slice(0, 8)
      .map(x => `• ${x.symbol} <b>${Number(x.amount).toFixed(4)}</b> · ${x.chainName} ${x.chainSub}`);
    return send(chatId, [
      '<b>💰 Ваш портфель</b>',
      lines.length ? lines.join('\n') : 'Пока пусто — пополните через кран в приложении.',
      '',
      `Справочно: ≈ <b>${p.total[p.fiat.toLowerCase()].toFixed(2)} ${p.fiat}</b>`,
      IS_MAINNET ? '' : '⚠️ Тестовые монеты, курс показан справочно.',
      '', `EVM: <code>${a.evm}</code>`,
    ].join('\n'), { reply_markup: { inline_keyboard: [[{ text: '📥 Пополнить', web_app: { url: WEBAPP_URL } }]] } });
  }
  if (cmd === '/address' || cmd === 'address') {
    const a = addressesFor(user.index);
    return send(chatId, [
      '<b>📥 Ваши адреса</b>', '',
      `<b>EVM</b> (ETH/Base/Arb/Polygon):\n<code>${a.evm}</code>`, '',
      `<b>Bitcoin</b> (${MODE}):\n<code>${a.bitcoin}</code>`, '',
      `<b>Solana</b>:\n<code>${a.solana}</code>`, '',
      'Нажмите на адрес, чтобы скопировать.',
    ].join('\n'), { reply_markup: mainKeyboard() });
  }
  if (cmd === '/security' || cmd === 'security') {
    const s = user.settings || {};
    return send(chatId, [
      '<b>🛡 Безопасность</b>', '',
      `• Лимит на операцию: <b>$${s.perTxLimitUsd ?? 250}</b>`,
      `• Дневной лимит: <b>$${s.dailyLimitUsd ?? 1000}</b>`,
      `• Белый список: <b>${s.whitelistOnly ? 'вкл' : 'выкл'}</b>`,
      `• Антифишинг-код: <b>${s.antiPhishing ? esc(s.antiPhishing) : 'не задан'}</b>`,
      '• Ключи: AES-256-GCM, симуляция перед подписью',
      '', 'Изменить можно в приложении → «Безопасность».',
    ].join('\n'), { reply_markup: mainKeyboard() });
  }
  return send(chatId, HELP, { reply_markup: mainKeyboard() });
}

async function handleUpdate(u) {
  try {
    if (u.callback_query) {
      const q = u.callback_query;
      await call('answerCallbackQuery', { callback_query_id: q.id });
      const map = { balance: '/balance', address: '/address', security: '/security', help: '/help' };
      await handleCommand(q.message?.chat?.id, map[q.data] || '/help', q.from);
      return;
    }
    const m = u.message;
    if (!m?.text || !m.from) return;
    const cmd = m.text.split(' ')[0].replace(/@\w+$/, '');
    await handleCommand(m.chat.id, cmd.startsWith('/') ? cmd : '/help', m.from);
  } catch (e) {
    console.error('[bot] update error:', e.message);
  }
}

export function startBot() {
  if (!BOT_TOKEN) { console.log('[bot] BOT_TOKEN не задан — бот отключён (Mini App работает в браузерном режиме)'); return; }
  let offset = 0;
  const commands = [
    { command: 'start', description: '🚀 Открыть кошелёк' },
    { command: 'balance', description: '💰 Мой баланс' },
    { command: 'address', description: '📥 Мои адреса' },
    { command: 'security', description: '🛡 Безопасность' },
    { command: 'help', description: '❓ Помощь' },
  ];
  Promise.all([
    call('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Кошелёк', web_app: { url: WEBAPP_URL } } }),
    call('setMyCommands', { commands }),
  ]).then(([menu, cmds]) => {
    console.log('[bot] menu button:', menu.ok ? 'ok' : JSON.stringify(menu).slice(0, 120));
    console.log('[bot] commands registered:', cmds.ok ? `${commands.length} ok` : JSON.stringify(cmds).slice(0, 120));
  }).catch(() => {});
  const loop = async () => {
    try {
      const r = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] }, 40000);
      if (r?.ok && Array.isArray(r.result)) {
        for (const u of r.result) { offset = u.update_id + 1; await handleUpdate(u); }
      } else if (!r?.ok) {
        console.error('[bot] getUpdates:', JSON.stringify(r).slice(0, 200));
        await new Promise(z => setTimeout(z, 5000));
      }
    } catch (e) {
      console.error('[bot] poll error:', e.message);
      await new Promise(z => setTimeout(z, 5000));
    }
    setTimeout(loop, 700);
  };
  console.log(`[bot] long polling started · webapp ${WEBAPP_URL} · mode ${MODE}`);
  loop();
}
