import { CHAIN_LIST } from '../config.js';

const IDS = [...new Set([...CHAIN_LIST.map(c => c.coingeckoId), 'usd-coin'])];
const FALLBACK = {
  ethereum: { eur: 2100.64, usd: 2353.35 },
  bitcoin: { eur: 71936, usd: 80590 },
  solana: { eur: 90.9, usd: 101.84 },
  'matic-network': { eur: 0.19, usd: 0.21 },
  'usd-coin': { eur: 0.92, usd: 1 },
};
let cache = { ts: 0, data: null };

export async function getPrices() {
  if (cache.data && Date.now() - cache.ts < 60_000) return cache.data;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(IDS.join(','))}&vs_currencies=eur,usd`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('coingecko ' + r.status);
    const j = await r.json();
    const data = {};
    for (const id of IDS) {
      data[id] = j[id] ? { eur: Number(j[id].eur || 0), usd: Number(j[id].usd || 0) } : FALLBACK[id] || { eur: 0, usd: 0 };
      if (!data[id].usd && FALLBACK[id]) data[id].usd = FALLBACK[id].usd;
      if (!data[id].eur && FALLBACK[id]) data[id].eur = FALLBACK[id].eur;
    }
    cache = { ts: Date.now(), data };
    return data;
  } catch {
    return FALLBACK;
  }
}

export const priceOf = (prices, id, fiat = 'EUR') => Number(prices?.[id]?.[fiat.toLowerCase()] || 0);
