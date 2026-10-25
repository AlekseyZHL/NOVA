import { CHAINS, CHAIN_LIST, IS_MAINNET, chainOrThrow } from '../config.js';
import { httpErr, withTimeout } from '../util.js';
import { getPrices, priceOf } from './prices.js';
import { getEvmBalances, simulateEvm, sendEvm, evmTxStatus } from './evm.js';
import { getBtcBalance, simulateBtc, sendBtc, btcTxStatus } from './bitcoin.js';
import { getSolBalance, simulateSol, sendSol, solTxStatus, airdropSol } from './solana.js';

export function explorerTx(chainId, hash) {
  const c = chainOrThrow(chainId);
  if (c.kind === 'sol' && IS_MAINNET === false) return `https://explorer.solana.com/tx/${hash}?cluster=devnet`;
  return `${c.explorer}/tx/${hash}`;
}

/** Live on-chain balances across every supported chain, in parallel. */
export async function getPortfolio(addresses, fiat = 'EUR') {
  const jobs = CHAIN_LIST.map(async c => {
    if (c.kind === 'evm') return { chain: c.id, assets: await getEvmBalances(c.id, addresses.evm), ok: true };
    if (c.kind === 'btc') {
      const amt = await getBtcBalance(addresses.bitcoin);
      return { chain: c.id, ok: true, assets: [{
        id: 'bitcoin:BTC', chain: 'bitcoin', chainName: c.name, chainSub: c.sub,
        symbol: c.symbol, kind: 'native', contract: null, address: addresses.bitcoin,
        amount: String(amt), decimals: c.decimals, priceId: c.coingeckoId,
        color: c.color, glyph: c.glyph,
      }] };
    }
    const amt = await getSolBalance(addresses.solana);
    return { chain: c.id, ok: true, assets: [{
      id: 'solana:SOL', chain: 'solana', chainName: c.name, chainSub: c.sub,
      symbol: c.symbol, kind: 'native', contract: null, address: addresses.solana,
      amount: String(amt), decimals: c.decimals, priceId: c.coingeckoId,
      color: c.color, glyph: c.glyph,
    }] };
  });
  const settled = await Promise.allSettled(jobs);
  const prices = await getPrices();
  const assets = [];
  const chainState = {};
  for (let i = 0; i < settled.length; i++) {
    const c = CHAIN_LIST[i], r = settled[i];
    chainState[c.id] = r.status === 'fulfilled';
    const list = r.status === 'fulfilled' ? r.value.assets : [];
    for (const a of list) {
      const price = priceOf(prices, a.priceId, fiat);
      assets.push({
        ...a, testnet: !IS_MAINNET, price,
        fiat: Number(a.amount) * price,
        fiatEur: Number(a.amount) * priceOf(prices, a.priceId, 'EUR'),
        fiatUsd: Number(a.amount) * priceOf(prices, a.priceId, 'USD'),
      });
    }
  }
  const total = assets.reduce((s, a) => s + a.fiat, 0);
  return {
    assets, chainState, fiat, testnet: !IS_MAINNET, prices,
    total: { [fiat.toLowerCase()]: total, fiat },
    mode: IS_MAINNET ? 'mainnet' : 'testnet',
    note: IS_MAINNET ? 'Реальные средства' : 'Тестовая сеть: монеты не имеют реальной стоимости. Курс показан справочно.',
  };
}

/** Sandbox: realistic but explicitly simulated portfolio, for UX demos without faucets. */
const SANDBOX = {
  'ethereum:ETH': 0.4821, 'ethereum:USDC': 340.5, 'base:ETH': 0.1284, 'base:USDC': 75,
  'arbitrum:ETH': 0.0512, 'polygon:POL': 412.8,
  'bitcoin:BTC': 0.01432, 'solana:SOL': 8.742,
};
export async function getSandboxPortfolio(addresses, fiat = 'EUR') {
  const base = await getPortfolio(addresses, fiat);
  base.assets = base.assets.map(a => {
    const amount = SANDBOX[a.id] ?? 0;
    return {
      ...a, amount: String(amount),
      fiat: amount * a.price,
      fiatEur: amount * priceOf(base.prices, a.priceId, 'EUR'),
      fiatUsd: amount * priceOf(base.prices, a.priceId, 'USD'),
    };
  });
  base.total = { [fiat.toLowerCase()]: base.assets.reduce((s, a) => s + a.fiat, 0), fiat };
  base.simulated = true;
  base.note = 'ПЕСОЧНИЦА: балансы и операции симулируются, реальные монеты не двигаются.';
  return base;
}

export function validateAddress(chainId, to) {
  const c = chainOrThrow(chainId);
  if (typeof to !== 'string' || !to.trim()) throw httpErr(400, 'Укажите адрес получателя');
  if (c.kind === 'evm') {
    // ethers.isAddress imported lazily to keep this module small
    return /^0x[a-fA-F0-9]{40}$/.test(to.trim());
  }
  if (c.kind === 'btc') return /^(bc1|tb1|bcrt1)[a-z0-9]{20,70}$/i.test(to.trim());
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to.trim());
}

/** Offline simulation for sandbox mode: no RPC calls, clearly labelled. */
export function simulateSandbox({ chainId, from, to, asset, amount }) {
  const c = chainOrThrow(chainId);
  if (!validateAddress(chainId, to)) throw httpErr(400, `Неверный адрес для сети ${c.name}`);
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) throw httpErr(400, 'Сумма должна быть больше нуля');
  const isToken = c.kind === 'evm' && asset && asset !== c.symbol;
  return {
    chain: chainId, chainName: c.name, to, from, token: asset || c.symbol,
    amount: String(a),
    method: c.kind === 'evm' ? (isToken ? 'ERC-20 transfer(address,uint256)' : 'Native transfer')
      : c.kind === 'btc' ? 'P2WPKH → P2WPKH (BIP-84)' : 'SystemProgram.transfer',
    gas: c.kind === 'evm' ? (isToken ? '65000' : '21000') : undefined,
    gasPriceGwei: c.kind === 'evm' ? 1.2 : undefined,
    fee: c.kind === 'evm' ? '0.0000252' : c.kind === 'btc' ? '0.00001500' : '0.000005000',
    feeSymbol: c.symbol, feeRate: c.kind === 'btc' ? '2 sat/vB' : undefined,
    inputs: c.kind === 'btc' ? 1 : undefined,
    flags: [{ level: 'info', text: 'Песочница: локальная симуляция, блокчейн не опрашивается' }],
    ready: true, sandbox: true,
  };
}

export async function simulate({ chainId, from, to, asset, amount }) {
  const c = chainOrThrow(chainId);
  if (!validateAddress(chainId, to)) throw httpErr(400, `Неверный адрес для сети ${c.name}`);
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) throw httpErr(400, 'Сумма должна быть больше нуля');
  if (c.kind === 'evm') return simulateEvm({ chainId, from, to, asset, amount: a });
  if (c.kind === 'btc') return simulateBtc({ from, to, amount: a });
  return simulateSol({ from, to, amount: a });
}

export async function broadcast({ chainId, keys, to, asset, amount }) {
  const c = chainOrThrow(chainId);
  let out;
  if (c.kind === 'evm') out = await sendEvm({ chainId, privateKey: keys.evm.privateKey, to, asset, amount });
  else if (c.kind === 'btc') out = await sendBtc({ wif: keys.btc.wif, from: keys.btc.address, to, amount });
  else out = await sendSol({ secret: keys.sol.secret, to, amount });
  return { ...out, explorer: explorerTx(chainId, out.hash) };
}

export async function txStatus(chainId, hash) {
  const c = chainOrThrow(chainId);
  if (c.kind === 'evm') return evmTxStatus(chainId, hash);
  if (c.kind === 'btc') return btcTxStatus(hash);
  return solTxStatus(hash);
}

export async function airdrop(chainId, address) {
  if (IS_MAINNET) throw httpErr(403, 'Faucet недоступен в mainnet');
  if (chainId !== 'solana') throw httpErr(400, 'Авто-кран доступен только для Solana Devnet. Для остальных сетей используйте ссылку на faucet.');
  const out = await airdropSol(address, 1);
  return { ...out, explorer: explorerTx(chainId, out.hash) };
}

export function chainOptions() {
  return CHAIN_LIST.map(c => ({
    id: c.id, name: c.name, sub: c.sub, symbol: c.symbol, kind: c.kind,
    color: c.color, glyph: c.glyph, explorer: c.explorer, faucet: c.faucet,
    tokens: c.tokens.map(t => ({ symbol: t.symbol, address: t.address, decimals: t.decimals })),
    chainId: c.chainId ?? null,
  }));
}
