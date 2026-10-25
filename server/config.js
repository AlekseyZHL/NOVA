import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const PORT = Number(process.env.PORT || 3000);

/** SAFETY: mainnet is opt-in and must be enabled explicitly. */
export const MODE = process.env.ALLOW_MAINNET === 'true' ? 'mainnet' : 'testnet';
export const IS_MAINNET = MODE === 'mainnet';

export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const WEBAPP_URL = process.env.WEBAPP_URL ||
  (process.env.E2B_SANDBOX_ID
    ? `https://${PORT}-${process.env.E2B_SANDBOX_ID}.e2b.app`
    : `http://localhost:${PORT}`);

/** Guest/demo auth is only ever allowed in testnet mode. */
export const DEMO_ENABLED = !IS_MAINNET || process.env.DEMO_AUTH === 'true';

export const LIMITS = {
  perTxUsd: Number(process.env.PER_TX_LIMIT_USD || 250),
  dailyUsd: Number(process.env.DAILY_LIMIT_USD || 1000),
  initDataMaxAgeSec: Number(process.env.INITDATA_MAX_AGE || 86400),
  sessionDays: 7,
};

const EVM_TESTNET = {
  ethereum: {
    id: 'ethereum', kind: 'evm', name: 'Ethereum', sub: 'Sepolia', symbol: 'ETH',
    chainId: 11155111, rpc: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io', faucet: 'https://sepolia-faucet.pk910.de/',
    color: '#7b8cff', glyph: 'Ξ', coingeckoId: 'ethereum', decimals: 18,
    tokens: [{ symbol: 'USDC', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6, coingeckoId: 'usd-coin' }],
  },
  base: {
    id: 'base', kind: 'evm', name: 'Base', sub: 'Sepolia', symbol: 'ETH',
    chainId: 84532, rpc: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org', faucet: 'https://portal.cdp.coinbase.com/products/faucet',
    color: '#3b82f6', glyph: 'B', coingeckoId: 'ethereum', decimals: 18,
    tokens: [{ symbol: 'USDC', address: '0x036CbD53842c5426634e7929541eC2318f3dCF7c', decimals: 6, coingeckoId: 'usd-coin' }],
  },
  arbitrum: {
    id: 'arbitrum', kind: 'evm', name: 'Arbitrum', sub: 'Sepolia', symbol: 'ETH',
    chainId: 421614, rpc: process.env.ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io', faucet: 'https://faucet.quicknode.com/arbitrum/sepolia',
    color: '#28a0f0', glyph: 'A', coingeckoId: 'ethereum', decimals: 18, tokens: [],
  },
  polygon: {
    id: 'polygon', kind: 'evm', name: 'Polygon', sub: 'Amoy', symbol: 'POL',
    chainId: 80002, rpc: process.env.AMOY_RPC || 'https://polygon-amoy-bor-rpc.publicnode.com',
    explorer: 'https://amoy.polygonscan.com', faucet: 'https://faucet.polygon.technology/',
    color: '#a377f7', glyph: 'P', coingeckoId: 'matic-network', decimals: 18, tokens: [],
  },
};

const EVM_MAINNET = {
  ethereum: { ...EVM_TESTNET.ethereum, sub: 'Mainnet', chainId: 1, rpc: process.env.ETH_RPC || 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io', faucet: null, tokens: [{ symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' }] },
  base: { ...EVM_TESTNET.base, sub: 'Mainnet', chainId: 8453, rpc: process.env.BASE_RPC || 'https://mainnet.base.org', explorer: 'https://basescan.org', faucet: null, tokens: [{ symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' }] },
  arbitrum: { ...EVM_TESTNET.arbitrum, sub: 'Mainnet', chainId: 42161, rpc: process.env.ARB_RPC || 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io', faucet: null },
  polygon: { ...EVM_TESTNET.polygon, sub: 'Mainnet', chainId: 137, rpc: process.env.POLYGON_RPC || 'https://polygon-bor-rpc.publicnode.com', explorer: 'https://polygonscan.com', faucet: null },
};

const BTC = IS_MAINNET ? {
  id: 'bitcoin', kind: 'btc', name: 'Bitcoin', sub: 'Mainnet', symbol: 'BTC',
  api: 'https://mempool.space/api', explorer: 'https://mempool.space', faucet: null,
  network: 'bitcoin', coinType: 0, color: '#f7931a', glyph: '₿',
  coingeckoId: 'bitcoin', decimals: 8, tokens: [],
} : {
  id: 'bitcoin', kind: 'btc', name: 'Bitcoin', sub: 'Testnet4', symbol: 'BTC',
  api: 'https://mempool.space/testnet4/api', explorer: 'https://mempool.space/testnet4',
  faucet: 'https://mempool.space/testnet4/faucet',
  network: 'testnet', coinType: 1, color: '#f7931a', glyph: '₿',
  coingeckoId: 'bitcoin', decimals: 8, tokens: [],
};

const SOL = IS_MAINNET ? {
  id: 'solana', kind: 'sol', name: 'Solana', sub: 'Mainnet', symbol: 'SOL',
  rpc: process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
  explorer: 'https://explorer.solana.com', faucet: null,
  color: '#14f195', glyph: 'S', coingeckoId: 'solana', decimals: 9, tokens: [],
} : {
  id: 'solana', kind: 'sol', name: 'Solana', sub: 'Devnet', symbol: 'SOL',
  rpc: process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com',
  explorer: 'https://explorer.solana.com/?cluster=devnet', faucet: 'https://faucet.solana.com/',
  color: '#14f195', glyph: 'S', coingeckoId: 'solana', decimals: 9, tokens: [],
};

export const CHAINS = { ...(IS_MAINNET ? EVM_MAINNET : EVM_TESTNET), bitcoin: BTC, solana: SOL };
export const CHAIN_LIST = Object.values(CHAINS);
export const CHAIN_IDS = Object.keys(CHAINS);

export function chainOrThrow(id) {
  const c = CHAINS[id];
  if (!c) { const e = new Error('Неизвестная сеть: ' + id); e.status = 400; throw e; }
  return c;
}
