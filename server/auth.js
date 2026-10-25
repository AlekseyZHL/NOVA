import crypto from 'node:crypto';
import { BOT_TOKEN, LIMITS, DEMO_ENABLED, MODE } from './config.js';
import { SESSION_KEY } from './keystore.js';
import { db, getOrCreateUser } from './db.js';

const b64u = b => Buffer.from(b).toString('base64url');

/**
 * Official Telegram Mini App validation:
 *   secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *   expected   = HMAC_SHA256(key=secret_key, msg=data_check_string)
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(initData, token = BOT_TOKEN) {
  if (!token) throw Object.assign(new Error('BOT_TOKEN is not configured'), { status: 503 });
  if (!initData || typeof initData !== 'string' || initData.length > 8192) {
    throw Object.assign(new Error('initData отсутствует или повреждён'), { status: 401 });
  }
  const params = new URLSearchParams(initData);
  const received = params.get('hash');
  if (!received) throw Object.assign(new Error('initData: нет hash'), { status: 401 });
  params.delete('hash');
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = crypto.createHmac('sha256', secret).update(dcs).digest();
  const got = Buffer.from(received, 'hex');
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) {
    throw Object.assign(new Error('initData: подпись недействительна'), { status: 401 });
  }
  const age = Math.floor(Date.now() / 1000) - Number(params.get('auth_date') || 0);
  if (!Number.isFinite(age) || age > LIMITS.initDataMaxAgeSec || age < -300) {
    throw Object.assign(new Error('initData устарел — перезапустите Mini App'), { status: 401 });
  }
  let user = {};
  try { user = JSON.parse(params.get('user') || '{}'); } catch { /* noop */ }
  if (!user.id) throw Object.assign(new Error('initData: нет пользователя'), { status: 401 });
  return {
    id: `tg_${user.id}`,
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Друг',
    username: user.username || '',
    photo: user.photo_url || '',
    lang: user.language_code || 'ru',
    source: 'telegram',
  };
}

export function issueSession(userId) {
  const payload = b64u(JSON.stringify({ uid: userId, exp: Date.now() + LIMITS.sessionDays * 86400_000 }));
  const sig = crypto.createHmac('sha256', SESSION_KEY).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_KEY).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp < Date.now()) return null;
    return db().users[data.uid] || null;
  } catch { return null; }
}

export function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export function requireAuth(req, res, next) {
  const user = verifySession(bearer(req));
  if (!user) return res.status(401).json({ error: 'Сессия истекла — перезапустите приложение' });
  req.user = user;
  next();
}

/** Browser preview / local dev identity. Hard-disabled in mainnet unless explicitly forced. */
export function demoProfile() {
  if (!DEMO_ENABLED) throw Object.assign(new Error('Demo auth is disabled in mainnet'), { status: 403 });
  return {
    id: 'demo_guest', name: 'Гость NOVA', username: 'nova_demo',
    photo: '', lang: 'ru', source: 'demo',
  };
}

export function authMode() {
  return { mode: MODE, telegram: !!BOT_TOKEN, demo: DEMO_ENABLED };
}
