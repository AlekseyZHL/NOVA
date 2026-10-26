import express from 'express';
import path from 'node:path';
import { PORT, PUBLIC_DIR, MODE, WEBAPP_URL, BOT_TOKEN, IS_MAINNET } from './config.js';
import { APP_VERSION } from './version.js';
import { api } from './routes/api.js';
import { startBot } from './bot.js';
import { loadVault, vaultInfo } from './vault.js';

loadVault(); // fail fast if the encrypted vault cannot be opened

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '64kb' }));

// Deliberately NO X-Frame-Options / frame-ancestors: Telegram and the Arena
// preview both embed this app in an iframe.
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Метод не найден' }));

app.use(express.static(PUBLIC_DIR, {
  index: 'index.html',
  setHeaders(res, p) {
    if (p.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status === 500) console.error('[server]', err);
  res.status(status).json({ error: status === 500 ? 'Внутренняя ошибка сервера' : err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  const v = vaultInfo();
  console.log('');
  console.log('  ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ');
  console.log('  ████╗  ██║██╔═══██╗██║   ██║██╔══██╗');
  console.log('  ██╔██╗ ██║██║   ██║██║   ██║███████║');
  console.log('  ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║');
  console.log('  ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║');
  console.log('  ╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝');
  console.log(`  NOVA Wallet v${APP_VERSION}  ·  ${MODE.toUpperCase()}  ·  vault ${v.fingerprint}`);
  console.log(`  http://0.0.0.0:${PORT}   →   ${WEBAPP_URL}`);
  if (IS_MAINNET) console.warn('  ⚠️  MAINNET ENABLED — реальные средства. Убедитесь в наличии аудита и KMS.');
  console.log('');
  startBot();
});
