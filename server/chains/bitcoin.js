import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { CHAINS, IS_MAINNET } from '../config.js';
import { httpErr } from '../util.js';

const ECPair = ECPairFactory(ecc);
export const btcNetwork = IS_MAINNET ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
const API = CHAINS.bitcoin.api;

async function apiGet(p) {
  const r = await fetch(API + p, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw httpErr(502, `Bitcoin API: ${r.status}`);
  return r.json();
}

export function validBtcAddress(addr) {
  try { bitcoin.address.toOutputScript(addr, btcNetwork); return true; } catch { return false; }
}

export async function getBtcBalance(addr) {
  const d = await apiGet(`/address/${addr}`);
  const confirmed = d.chain_stats.funded_txo_sum - d.chain_stats.spent_txo_sum;
  const mempool = d.mempool_stats.funded_txo_sum - d.mempool_stats.spent_txo_sum;
  return (confirmed + mempool) / 1e8;
}

/** Native SegWit vsize approximation: overhead + inputs*68 + outputs*31. */
const vsize = n => 11 + n * 68 + 2 * 31;

export async function planBtcTx({ from, to, amount }) {
  if (!validBtcAddress(to)) throw httpErr(400, 'Неверный Bitcoin-адрес (ожидается bech32)');
  const sat = Math.round(Number(amount) * 1e8);
  if (!Number.isFinite(sat) || sat <= 0) throw httpErr(400, 'Сумма должна быть больше нуля');
  const [utxos, fees] = await Promise.all([
    apiGet(`/address/${from}/utxo`),
    apiGet('/v1/fees/recommended').catch(() => ({ fastestFee: 2 })),
  ]);
  const feeRate = Math.max(1, Number(fees.fastestFee || 2));
  const script = bitcoin.address.toOutputScript(from, btcNetwork);
  const chosen = [];
  let total = 0;
  for (const u of [...utxos].sort((a, b) => a.value - b.value)) {
    chosen.push(u);
    total += u.value;
    if (total >= sat + vsize(chosen.length) * feeRate) break;
  }
  const fee = vsize(chosen.length) * feeRate;
  if (total < sat + fee) {
    throw httpErr(400, `Недостаточно BTC: нужно ${((sat + fee) / 1e8).toFixed(8)}, доступно ${(total / 1e8).toFixed(8)}`);
  }
  return { utxos: chosen, script, sat, fee, feeRate, total, change: total - sat - fee };
}

export async function simulateBtc(args) {
  const p = await planBtcTx(args);
  return {
    chain: 'bitcoin', chainName: 'Bitcoin', to: args.to, from: args.from,
    token: 'BTC', amount: String(args.amount),
    method: 'P2WPKH → P2WPKH (BIP-84)', inputs: p.utxos.length,
    fee: (p.fee / 1e8).toFixed(8), feeSymbol: 'BTC', feeRate: `${p.feeRate} sat/vB`,
    change: (Math.max(0, p.change) / 1e8).toFixed(8),
    flags: p.utxos.length === 0 ? [{ level: 'error', text: 'Нет доступных UTXO — пополните кошелёк' }] : [],
    ready: p.utxos.length > 0,
  };
}

export async function sendBtc({ wif, to, amount, from }) {
  const p = await planBtcTx({ from, to, amount });
  const key = ECPair.fromWIF(wif, btcNetwork);
  const psbt = new bitcoin.Psbt({ network: btcNetwork });
  for (const u of p.utxos) {
    psbt.addInput({ hash: u.txid, index: u.vout, witnessUtxo: { script: p.script, value: u.value } });
  }
  psbt.addOutput({ address: to, value: p.sat });
  if (p.change > 546) psbt.addOutput({ address: from, value: p.change });
  psbt.signAllInputs(key);
  psbt.finalizeAllInputs();
  const rawHex = psbt.extractTransaction().toHex();
  const r = await fetch(`${API}/tx`, {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: rawHex,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw httpErr(502, `Сеть отклонила транзакцию: ${txt.slice(0, 180)}`);
  }
  const hash = (await r.text()).trim();
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw httpErr(502, `Неожиданный ответ сети: ${hash.slice(0, 120)}`);
  return { hash };
}

export async function btcTxStatus(hash) {
  try {
    const d = await apiGet(`/tx/${hash}/status`);
    return d.confirmed ? 'confirmed' : 'pending';
  } catch { return 'pending'; }
}
