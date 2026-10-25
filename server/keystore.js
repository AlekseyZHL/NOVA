import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * Returns a 32-byte key. Order of preference:
 *   1. environment variable (production: inject from a KMS / secret manager)
 *   2. a local 0600 key file, generated on first boot (development / preview)
 *
 * Key material and ciphertext are stored SEPARATELY. Never commit or upload
 * data/*.key or data/vault.enc — see SECURITY.md.
 */
export function getKey(file, envName) {
  const raw = process.env[envName];
  if (raw) {
    const key = Buffer.from(raw.replace(/^0x/, ''), 'hex');
    if (key.length !== 32) throw new Error(`${envName} must be 32 bytes in hex (64 chars)`);
    return key;
  }
  const p = path.join(DATA_DIR, file);
  if (fs.existsSync(p)) {
    const key = Buffer.from(fs.readFileSync(p, 'utf8').trim(), 'hex');
    if (key.length === 32) return key;
    throw new Error(`Key file ${file} is corrupt`);
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(p, key.toString('hex') + '\n', { mode: 0o600 });
  console.warn(`[keystore] generated ${file} — back it up securely, never share it`);
  return key;
}

export const VAULT_KEY = getKey('vault.key', 'VAULT_KEY');
export const SESSION_KEY = getKey('session.key', 'SESSION_SECRET');
