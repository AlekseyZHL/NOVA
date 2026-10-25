import { LIMITS, chainOrThrow } from '../config.js';
import { spentTodayUsd } from '../db.js';
import { httpErr } from '../util.js';
import { getPrices, priceOf } from '../chains/prices.js';

/**
 * Every send passes here. Fail-closed on limits and whitelist.
 * Returns the USD notional so the UI can show exactly what was checked.
 */
export async function riskCheck({ user, chainId, to, asset, amount, sandbox = false }) {
  const c = chainOrThrow(chainId);
  const prices = await getPrices();
  const token = c.tokens?.find(t => t.symbol === asset);
  const priceId = token ? token.coingeckoId : c.coingeckoId;
  const usd = Number(amount) * priceOf(prices, priceId, 'USD');

  const s = user.settings || {};
  const perTx = Number(s.perTxLimitUsd ?? LIMITS.perTxUsd);
  const daily = Number(s.dailyLimitUsd ?? LIMITS.dailyUsd);
  const spent = spentTodayUsd(user.id);
  const flags = [];

  if (sandbox) {
    flags.push({ level: 'info', text: 'Песочница: USD-лимиты не применяются — реальные средства не используются' });
  } else {
    if (usd > perTx) {
      throw httpErr(403, `Лимит на одну операцию — $${perTx}. Запрошено ≈ $${usd.toFixed(2)}. Измените лимит в разделе «Безопасность».`);
    }
    if (spent + usd > daily) {
      throw httpErr(403, `Превышен дневной лимит $${daily}. За последние 24 ч уже отправлено ≈ $${spent.toFixed(2)}.`);
    }
    if (usd > perTx * 0.75) flags.push({ level: 'warn', text: 'Крупная операция — сверьте адрес получателя по первым и последним символам.' });
  }
  if (s.whitelistOnly) {
    const known = (user.addressBook || []).some(a =>
      a.address?.toLowerCase() === String(to).toLowerCase() && (!a.chain || a.chain === chainId));
    if (!known) throw httpErr(403, 'Включён режим «Только проверенные адреса». Добавьте получателя в адресную книгу.');
  }

  // Address-poisoning heuristic: lookalike of any of our own addresses.
  const own = (user._addresses || []);
  for (const a of own) {
    if (!a || a.toLowerCase() === String(to).toLowerCase()) continue;
    if (a.length > 12 && to.length > 12 &&
        a.slice(0, 6).toLowerCase() === String(to).slice(0, 6).toLowerCase() &&
        a.slice(-4).toLowerCase() === String(to).slice(-4).toLowerCase()) {
      flags.push({ level: 'error', text: 'Похоже на подмену адреса (address poisoning): совпадают начало и конец вашего адреса. Отправка заблокирована.' });
    }
  }
  return { usd, spent, perTx, daily, flags, blocked: flags.some(f => f.level === 'error') };
}
