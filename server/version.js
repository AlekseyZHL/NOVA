import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

/** Single source of truth: the version in package.json. Used by /api/health and the boot log. */
export const APP_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
