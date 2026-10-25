export const httpErr = (status, message) => Object.assign(new Error(message), { status });

export function withTimeout(promise, ms = 15000, label = 'Сеть') {
  let t;
  const guard = new Promise((_, reject) => {
    t = setTimeout(() => reject(httpErr(504, `${label}: время ожидания истекло`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(t));
}

export const short = (s, n = 6) => s ? `${s.slice(0, n)}…${s.slice(-4)}` : '—';
export const num = (v, dp = 6) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: dp });
