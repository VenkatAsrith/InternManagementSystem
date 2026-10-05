import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Minimal .env loader (the scripts folder has no node_modules of its own).
 * Values already present in process.env are NOT overridden unless override=true, which is what the QA scripts
 * want: the QA file must win over anything a developer has in a real .env.
 */
export function loadEnvFile(file, { override = false } = {}) {
  const full = path.isAbsolute(file) ? file : path.join(ROOT, file);
  if (!fs.existsSync(full)) throw new Error(`Environment file not found: ${full}`);
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (override || process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
  process.env.ENV_FILE = full;
}
