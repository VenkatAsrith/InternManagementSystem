#!/usr/bin/env node
/**
 * API lifecycle runner.  Resets the QA database, boots the QA API server, runs the three lifecycle
 * suites in order (they share state through qa-artifacts/golden-*.json) and shuts the server down.
 * Exits non-zero if any suite fails.
 *
 *   node qa/api/run-all.mjs            (or: npm run qa:api)
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const envFile = path.join(root, '.env.qa');
const suites = fs.readdirSync(path.dirname(fileURLToPath(import.meta.url))).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort();
const logFile = path.join(root, 'qa-artifacts', 'api-server.log');
fs.mkdirSync(path.dirname(logFile), { recursive: true });

const reset = spawnSync(process.execPath, ['scripts/qa-reset.js'], { cwd: root, stdio: 'inherit', env: { ...process.env, ENV_FILE: envFile } });
if (reset.status !== 0) { console.error('qa-reset failed'); process.exit(2); }

const out = fs.openSync(logFile, 'w');
const server = spawn(process.execPath, ['src/server.js'], { cwd: path.join(root, 'server'), env: { ...process.env, ENV_FILE: envFile }, stdio: ['ignore', out, out] });
const stop = () => { try { spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} try { server.kill(); } catch {} };
process.on('exit', stop);

const base = process.env.QA_API_URL || 'http://localhost:5100';
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try { const r = await fetch(`${base}/health`); up = r.ok; } catch {}
  if (!up) await new Promise((r) => setTimeout(r, 500));
}
if (!up) { console.error('QA API server did not become healthy; see qa-artifacts/api-server.log'); process.exit(2); }

let failed = 0;
for (const s of suites) {
  console.log(`\n######## ${s}`);
  const r = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), s)], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) { failed++; console.error(`SUITE FAILED: ${s}`); }
}
stop();
console.log(failed ? `\nAPI SUITES: ${failed} failed` : '\nAPI SUITES: all passed');
process.exit(failed ? 1 : 0);
