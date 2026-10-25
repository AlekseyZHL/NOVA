/**
 * Fast syntax check for every JS file in the project.
 * Run: npm run check:syntax
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['server', 'public', 'scripts', 'tests'];
const SKIP = new Set(['node_modules', '.git']);

const files = [];
for (const dir of DIRS) {
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) files.push(p);
    }
  };
  const base = path.join(ROOT, dir);
  if (fs.existsSync(base)) walk(base);
}

let bad = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { bad++; console.error(`  ❌ ${path.relative(ROOT, f)}\n${e.stderr?.toString().trim() || ''}`); }
}
console.log(`  ${bad ? '❌' : '✅'} ${files.length} JS-файлов проверено, ошибок: ${bad}`);
process.exit(bad ? 1 : 0);
