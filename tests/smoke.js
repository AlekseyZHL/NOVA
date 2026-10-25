/**
 * NOVA Wallet — cryptographic self-test.
 * Proves real key derivation and real signatures on all three chains,
 * WITHOUT needing any funds or network access.
 * Run: npm test
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Wallet, Transaction, parseEther, parseUnits } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { Keypair, PublicKey, SystemProgram, Transaction as SolTx, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { ROOT, DATA_DIR, CHAINS } from '../server/config.js';
import { VAULT_KEY } from '../server/keystore.js';
import { deriveFor, addressesFor, vaultInfo, loadVault } from '../server/vault.js';
import { validateInitData, issueSession, verifySession } from '../server/auth.js';
import { getOrCreateUser } from '../server/db.js';
import { validateAddress, simulateSandbox } from '../server/chains/index.js';

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};
const section = t => console.log(`\n\x1b[1m${t}\x1b[0m`);

loadVault();
const keys = deriveFor(1);
const addr = addressesFor(1);

section('1. Encrypted vault (AES-256-GCM at rest)');
{
  const f = path.join(DATA_DIR, 'vault.enc');
  const blob = JSON.parse(fs.readFileSync(f, 'utf8'));
  const d = crypto.createDecipheriv('aes-256-gcm', VAULT_KEY, Buffer.from(blob.iv, 'hex'));
  d.setAuthTag(Buffer.from(blob.tag, 'hex'));
  const mnemonic = Buffer.concat([d.update(Buffer.from(blob.ct, 'hex')), d.final()]).toString('utf8');
  ok('vault decrypts with the separate 32-byte key', blob.alg === 'aes-256-gcm' && blob.iv.length === 24);
  ok('plaintext is a valid 24-word BIP-39 mnemonic', bip39.validateMnemonic(mnemonic) && mnemonic.split(' ').length === 24, `fingerprint ${vaultInfo().fingerprint}`);
  ok('ciphertext does not leak the mnemonic', !JSON.stringify(blob).toLowerCase().includes(mnemonic.split(' ')[0].toLowerCase()));
  ok('key and ciphertext stored in separate files', fs.existsSync(path.join(DATA_DIR, 'vault.key')) || !!process.env.VAULT_KEY);
}

section('2. Deterministic multichain derivation (BIP-39/32/84 + SLIP-0010)');
{
  const again = deriveFor(1);
  ok('EVM address (secp256k1, m/44\'/60\')', /^0x[0-9a-fA-F]{40}$/.test(keys.evm.address), keys.evm.address);
  ok('Bitcoin P2WPKH bech32 (BIP-84)', keys.btc.address.startsWith(CHAINS.bitcoin.network === 'testnet' ? 'tb1' : 'bc1'), keys.btc.address);
  ok('Solana ed25519 base58', (() => { try { return PublicKey.isOnCurve(new PublicKey(keys.sol.address).toBytes()); } catch { return false; } })(), keys.sol.address);
  ok('derivation is deterministic', again.evm.address === keys.evm.address && again.btc.address === keys.btc.address && again.sol.address === keys.sol.address);
  ok('different user index -> different keys', deriveFor(2).evm.address !== keys.evm.address);
  ok('public API returns addresses only', !JSON.stringify(addr).includes('privateKey') && !JSON.stringify(addr).includes('secret'));
}

section('3. EVM: real ECDSA transaction signature');
{
  const w = new Wallet(keys.evm.privateKey);
  const raw = await w.signTransaction({
    to: '0x1111111111111111111111111111111111111111',
    value: parseEther('0.001'), gasLimit: 21000,
    gasPrice: parseUnits('2', 'gwei'), nonce: 0, chainId: 11155111, type: 0,
  });
  const parsed = Transaction.from(raw);
  ok('signed raw tx parses', raw.startsWith('0x') && raw.length > 200);
  ok('recovered signer matches derived address', parsed.from.toLowerCase() === w.address.toLowerCase(), parsed.from);
  ok('signature (r,s) is present', !!parsed.signature?.r && !!parsed.signature?.s);
}

section('4. Bitcoin: real PSBT signing (native SegWit)');
{
  bitcoin.initEccLib(ecc);
  const ECPair = ECPairFactory(ecc);
  const net = CHAINS.bitcoin.network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  const kp = ECPair.fromWIF(keys.btc.wif, net);
  const p2 = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(kp.publicKey), network: net });
  const psbt = new bitcoin.Psbt({ network: net });
  psbt.addInput({ hash: '11'.repeat(32), index: 0, witnessUtxo: { script: p2.output, value: 100000 } });
  psbt.addOutput({ address: p2.address, value: 90000 });
  psbt.signAllInputs(kp);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  ok('WIF restores the derived public key', p2.address === keys.btc.address);
  ok('witness contains signature + pubkey', tx.ins[0].witness.length === 2 && tx.ins[0].witness[0].length >= 70);
  ok('raw tx hex produced', /^[0-9a-f]{100,}$/.test(tx.toHex()));
}

section('5. Solana: real ed25519 transaction signature');
{
  const kp = Keypair.fromSecretKey(bs58.decode(keys.sol.secret));
  const tx = new SolTx({ recentBlockhash: Keypair.generate().publicKey.toBase58(), feePayer: kp.publicKey });
  tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: Keypair.generate().publicKey, lamports: Math.round(0.01 * LAMPORTS_PER_SOL) }));
  tx.sign(kp);
  ok('secret key restores derived public key', kp.publicKey.toBase58() === keys.sol.address);
  ok('ed25519 signature verifies', tx.verifySignatures(), tx.signatures[0].signature ? 'signature present' : '');
  ok('serialised transaction is valid', tx.serialize().length > 100);
}

section('6. Telegram Mini App auth (HMAC-SHA256 initData)');
{
  const token = '123456:TEST_TOKEN_FOR_SELFTEST';
  const user = JSON.stringify({ id: 42, first_name: 'Nova', username: 'nova_test' });
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user, query_id: 'AAH123' });
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
  const valid = validateInitData(`${params.toString()}&hash=${hash}`, token);
  ok('valid initData accepted', valid.id === 'tg_42' && valid.name === 'Nova');
  let rejected = false;
  try { validateInitData(`${params.toString()}&hash=${'0'.repeat(64)}`, token); } catch { rejected = true; }
  ok('forged signature rejected', rejected);
  getOrCreateUser({ id: 'demo_guest', name: 'Self-test', source: 'demo' });
  const sess = issueSession('demo_guest');
  ok('session token round-trip', !!verifySession(sess));
  ok('tampered session rejected', !verifySession(sess.slice(0, -3) + 'aaa'));
}

section('7. Address validation, risk surface and sandbox simulation');
{
  ok('EVM address validator', validateAddress('ethereum', keys.evm.address) && !validateAddress('ethereum', 'nope'));
  ok('BTC address validator', validateAddress('bitcoin', keys.btc.address) && !validateAddress('bitcoin', '0xabc'));
  ok('SOL address validator', validateAddress('solana', keys.sol.address) && !validateAddress('solana', 'hello'));
  const sim = simulateSandbox({ chainId: 'ethereum', from: addr.evm, to: '0x1111111111111111111111111111111111111111', asset: 'ETH', amount: '0.01' });
  ok('sandbox simulation is offline and ready', sim.ready && sim.sandbox && sim.method === 'Native transfer');
  ok('6 chains configured', Object.keys(CHAINS).length === 6, Object.keys(CHAINS).join(', '));
}

console.log(`\n${'─'.repeat(58)}`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`${'─'.repeat(58)}\n`);
process.exit(fail ? 1 : 0);
