import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import * as bitcoin from 'bitcoinjs-lib';
import { HDNodeWallet } from 'ethers';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { DATA_DIR, CHAINS, IS_MAINNET } from './config.js';
import { VAULT_KEY } from './keystore.js';

const VAULT_FILE = path.join(DATA_DIR, 'vault.enc');
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

let SEED = null;
let FINGERPRINT = null;
const cache = new Map();

function seal(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { v: 1, alg: 'aes-256-gcm', iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ct: ct.toString('hex') };
}
function open(obj) {
  if (obj.v !== 1 || obj.alg !== 'aes-256-gcm') throw new Error('Unsupported vault format');
  const d = crypto.createDecipheriv('aes-256-gcm', VAULT_KEY, Buffer.from(obj.iv, 'hex'));
  d.setAuthTag(Buffer.from(obj.tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(obj.ct, 'hex')), d.final()]).toString('utf8');
}

/** Load (or create) the encrypted BIP-39 master mnemonic. Never logged, never exported in API. */
export function loadVault() {
  if (SEED) return { fingerprint: FINGERPRINT, encrypted: true };
  let mnemonic;
  if (fs.existsSync(VAULT_FILE)) {
    mnemonic = open(JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')));
  } else {
    if (process.env.MASTER_MNEMONIC) {
      mnemonic = process.env.MASTER_MNEMONIC.trim();
    } else {
      mnemonic = bip39.generateMnemonic(256); // 24 words, 256-bit entropy
      console.warn('[vault] NEW master mnemonic generated and sealed. Store vault.key + vault.enc together, offline.');
    }
    if (!bip39.validateMnemonic(mnemonic)) throw new Error('Invalid BIP-39 master mnemonic');
    fs.writeFileSync(VAULT_FILE, JSON.stringify(seal(mnemonic), null, 2), { mode: 0o600 });
  }
  SEED = bip39.mnemonicToSeedSync(mnemonic);
  FINGERPRINT = crypto.createHash('sha256').update(mnemonic).digest('hex').slice(0, 8).toUpperCase();
  // best-effort scrub of the plaintext local variable
  mnemonic = '0'.repeat(256);
  return { fingerprint: FINGERPRINT, encrypted: true };
}

export function vaultInfo() {
  loadVault();
  return {
    mode: IS_MAINNET ? 'mainnet' : 'testnet',
    encryption: 'AES-256-GCM',
    fingerprint: FINGERPRINT,
    derivation: {
      evm: "m/44'/60'/0'/0/{index}",
      btc: `m/84'/${CHAINS.bitcoin.coinType}'/0'/0/{index} (P2WPKH)`,
      sol: "m/44'/501'/{index}'/0' (SLIP-0010 ed25519)",
    },
  };
}

/**
 * Deterministic per-user key derivation. One encrypted master seed -> isolated
 * child keys per user. Index is allocated by the DB, so two users never collide.
 */
export function deriveFor(index) {
  loadVault();
  if (cache.has(index)) return cache.get(index);

  // --- EVM (secp256k1, BIP-44) — one address shared by all EVM chains
  const evmNode = HDNodeWallet.fromSeed(SEED).derivePath(`m/44'/60'/0'/0/${index}`);

  // --- Bitcoin (BIP-84 native SegWit / P2WPKH)
  const btcChain = CHAINS.bitcoin;
  const btcNet = IS_MAINNET ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  const btcNode = bip32.fromSeed(SEED).derivePath(`m/84'/${btcChain.coinType}'/0'/0/${index}`);
  const btcAddress = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(btcNode.publicKey), network: btcNet }).address;
  const btcWif = ECPair.fromPrivateKey(Buffer.from(btcNode.privateKey), { network: btcNet }).toWIF();

  // --- Solana (SLIP-0010 ed25519, hardened path required)
  const solDerived = derivePath(`m/44'/501'/${index}'/0'`, SEED.toString('hex'));
  const solKeypair = Keypair.fromSeed(solDerived.key);

  const out = {
    index,
    evm: { address: evmNode.address, privateKey: evmNode.privateKey },
    btc: { address: btcAddress, wif: btcWif },
    sol: { address: solKeypair.publicKey.toBase58(), secret: bs58.encode(solKeypair.secretKey) },
  };
  cache.set(index, out);
  return out;
}

/** Public addresses only — safe to send to the client. */
export function addressesFor(index) {
  const k = deriveFor(index);
  return {
    evm: k.evm.address,
    bitcoin: k.btc.address,
    solana: k.sol.address,
  };
}

/** Recovery export. Returns secrets — caller MUST gate behind explicit user consent. */
export function exportFor(index) {
  const k = deriveFor(index);
  return {
    warning: 'Это приватные ключи. Любой, кто их увидит, получит полный контроль над средствами.',
    evm_private_key: k.evm.privateKey,
    bitcoin_wif: k.btc.wif,
    solana_secret_key: k.sol.secret,
  };
}
