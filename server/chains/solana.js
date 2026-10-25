import { Connection, PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { CHAINS } from '../config.js';
import { httpErr, withTimeout } from '../util.js';

const conn = new Connection(CHAINS.solana.rpc, 'confirmed');

export function validSolAddress(a) {
  try { const p = new PublicKey(a); return PublicKey.isOnCurve(p.toBytes()); } catch { return false; }
}

export async function getSolBalance(addr) {
  try {
    const lam = await withTimeout(conn.getBalance(new PublicKey(addr)), 12000, 'Solana');
    return lam / LAMPORTS_PER_SOL;
  } catch { return 0; }
}

export async function simulateSol({ from, to, amount }) {
  if (!validSolAddress(to)) throw httpErr(400, 'Неверный Solana-адрес');
  const lamports = Math.round(Number(amount) * LAMPORTS_PER_SOL);
  if (!Number.isFinite(lamports) || lamports <= 0) throw httpErr(400, 'Сумма должна быть больше нуля');
  const [balance, code] = await Promise.all([
    withTimeout(conn.getBalance(new PublicKey(from)), 12000, 'Solana'),
    withTimeout(conn.getAccountInfo(new PublicKey(to)), 12000, 'Solana').catch(() => null),
  ]);
  const fee = 5000;
  const flags = [];
  if (balance < lamports + fee) flags.push({ level: 'error', text: 'Недостаточно SOL для перевода и комиссии' });
  if (!code) flags.push({ level: 'warn', text: 'Аккаунт получателя ещё не существует — будет создан (rent-исключение для System Transfer)' });
  if (from === to) flags.push({ level: 'info', text: 'Перевод на свой собственный адрес' });
  return {
    chain: 'solana', chainName: 'Solana', to, from,
    token: 'SOL', amount: String(amount), method: 'SystemProgram.transfer',
    fee: (fee / LAMPORTS_PER_SOL).toFixed(9), feeSymbol: 'SOL',
    flags, ready: !flags.some(f => f.level === 'error'),
  };
}

export async function sendSol({ secret, to, amount }) {
  const kp = Keypair.fromSecretKey(bs58.decode(secret));
  const lamports = Math.round(Number(amount) * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: kp.publicKey, toPubkey: new PublicKey(to), lamports,
  }));
  const sig = await withTimeout(
    sendAndConfirmTransaction(conn, tx, [kp], { commitment: 'confirmed' }), 30000, 'Solana',
  );
  return { hash: sig };
}

export async function airdropSol(address, sol = 1) {
  const sig = await withTimeout(
    conn.requestAirdrop(new PublicKey(address), Math.round(sol * LAMPORTS_PER_SOL)), 20000, 'Solana faucet',
  );
  const bh = await conn.getLatestBlockhash();
  await withTimeout(conn.confirmTransaction({ signature: sig, ...bh }, 'confirmed'), 30000, 'Solana faucet');
  return { hash: sig };
}

export async function solTxStatus(hash) {
  try {
    const r = await withTimeout(conn.getSignatureStatuses([hash]), 12000, 'Solana');
    const s = r?.value?.[0];
    if (!s) return 'pending';
    if (s.err) return 'failed';
    return s.confirmationStatus === 'finalized' || s.confirmationStatus === 'confirmed' ? 'confirmed' : 'pending';
  } catch { return 'pending'; }
}
