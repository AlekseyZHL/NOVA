import { JsonRpcProvider, Wallet, Contract, parseUnits, formatUnits, formatEther, isAddress, getAddress } from 'ethers';
import { CHAINS, chainOrThrow } from '../config.js';
import { httpErr, withTimeout } from '../util.js';

const ERC20 = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];
const providers = new Map();

export function provider(chainId) {
  if (!providers.has(chainId)) providers.set(chainId, new JsonRpcProvider(CHAINS[chainId].rpc));
  return providers.get(chainId);
}

export async function getEvmBalances(chainId, address) {
  const c = chainOrThrow(chainId);
  const p = provider(chainId);
  const out = [];
  let raw = 0n;
  try { raw = await withTimeout(p.getBalance(address), 12000, c.name); } catch { /* offline -> 0 */ }
  out.push({
    id: `${chainId}:${c.symbol}`, chain: chainId, chainName: c.name, chainSub: c.sub,
    symbol: c.symbol, kind: 'native', contract: null, address,
    amount: formatUnits(raw, c.decimals), decimals: c.decimals,
    priceId: c.coingeckoId, color: c.color, glyph: c.glyph,
  });
  for (const t of c.tokens) {
    let bal = 0n;
    try {
      bal = await withTimeout(new Contract(t.address, ERC20, p).balanceOf(address), 12000, `${c.name} ${t.symbol}`);
    } catch { /* offline -> 0 */ }
    out.push({
      id: `${chainId}:${t.symbol}`, chain: chainId, chainName: c.name, chainSub: c.sub,
      symbol: t.symbol, kind: 'token', contract: t.address, address,
      amount: formatUnits(bal, t.decimals), decimals: t.decimals,
      priceId: t.coingeckoId, color: '#2775ca', glyph: '$',
    });
  }
  return out;
}

function buildTxRequest(chainId, from, to, asset, amount) {
  const c = chainOrThrow(chainId);
  if (!isAddress(to)) throw httpErr(400, 'Неверный EVM-адрес получателя');
  const token = asset && asset !== c.symbol && asset !== 'native' ? c.tokens.find(t => t.symbol === asset) : null;
  if (asset && asset !== c.symbol && asset !== 'native' && !token) throw httpErr(400, `Токен ${asset} не поддерживается в ${c.name}`);
  const decimals = token ? token.decimals : c.decimals;
  const value = parseUnits(String(amount), decimals);
  if (value <= 0n) throw httpErr(400, 'Сумма должна быть больше нуля');
  if (token) {
    const erc = new Contract(token.address, ERC20, provider(chainId));
    return { to: token.address, from, data: erc.interface.encodeFunctionData('transfer', [getAddress(to), value]), token, value };
  }
  return { to: getAddress(to), from, value, token: null, value };
}

/** Pre-flight simulation: estimate gas, decode intent, detect contracts. NEVER signs. */
export async function simulateEvm({ chainId, from, to, asset, amount }) {
  const c = chainOrThrow(chainId);
  const p = provider(chainId);
  const req = buildTxRequest(chainId, from, to, asset, amount);
  let gas;
  try { gas = await withTimeout(p.estimateGas(req), 15000, 'Оценка газа'); }
  catch (e) {
    throw httpErr(400, 'Транзакция не пройдёт: недостаточно средств, неверный адрес или ошибка контракта');
  }
  const [feeData, code, balance] = await Promise.all([
    p.getFeeData().catch(() => null),
    p.getCode(req.to).catch(() => '0x'),
    (req.token
      ? new Contract(req.token.address, ERC20, p).balanceOf(from).catch(() => 0n)
      : p.getBalance(from).catch(() => 0n)),
  ]);
  const unitPrice = feeData?.maxFeePerGas ?? feeData?.gasPrice ?? 1_000_000_000n;
  const feeWei = gas * unitPrice;
  const flags = [];
  if (code && code !== '0x' && !req.token) flags.push({ level: 'warn', text: 'Адрес получателя — смарт-контракт. Убедитесь, что это не дрaйнер.' });
  if (balance < req.value) flags.push({ level: 'error', text: 'Недостаточно средств на балансе' });
  if (from.toLowerCase() === req.to.toLowerCase()) flags.push({ level: 'info', text: 'Перевод на свой собственный адрес' });
  return {
    chain: chainId, chainName: c.name, to: req.to, from,
    token: req.token?.symbol || c.symbol, amount: String(amount),
    gas: gas.toString(), gasPriceGwei: Number(unitPrice) / 1e9,
    fee: formatEther(feeWei), feeSymbol: c.symbol,
    method: req.token ? 'ERC-20 transfer(address,uint256)' : 'Native transfer',
    flags, ready: !flags.some(f => f.level === 'error'),
  };
}

/** Sign + broadcast. Caller has already passed risk checks. */
export async function sendEvm({ chainId, privateKey, to, asset, amount }) {
  const c = chainOrThrow(chainId);
  const p = provider(chainId);
  const wallet = new Wallet(privateKey, p);
  const req = buildTxRequest(chainId, wallet.address, to, asset, amount);
  const tx = await withTimeout(wallet.sendTransaction(req), 25000, 'Отправка транзакции');
  return { hash: tx.hash };
}

export async function evmTxStatus(chainId, hash) {
  try {
    const r = await withTimeout(provider(chainId).getTransactionReceipt(hash), 12000, 'Статус tx');
    if (!r) return 'pending';
    return r.status === 1 ? 'confirmed' : 'failed';
  } catch { return 'pending'; }
}
