#!/usr/bin/env node
/**
 * QA stack launcher.
 *
 *   node scripts/qa-servers.js --cypress=run [--spec=glob] [--no-build] [--no-reset] [--browser=electron]
 *   node scripts/qa-servers.js --servers-only          (leave API :5100 and UI :3100 running for manual work)
 *
 * 1. resets the isolated QA database (refuses any non-QA database, see scripts/lib/safety.js)
 * 2. starts the API on :5100 with .env.qa
 * 3. builds the client and serves it on :3100 with /api proxied to :5100
 * 4. runs Cypress, then always stops both servers, whatever the outcome
 * Exit code = Cypress exit code (non-zero when any test fails).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const API = 'http://localhost:5100';
const UI = 'http://localhost:3100';
const artifacts = path.join(root, 'qa-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const children = [];
function stopAll() {
  for (const c of children) {
    try {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-c.pid, 'SIGTERM');
    } catch { /* already gone */ }
  }
  children.length = 0;
}
process.on('exit', stopAll);
process.on('SIGINT', () => { stopAll(); process.exit(130); });

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  return r.status ?? 1;
}

function start(name, cmd, cmdArgs, opts = {}) {
  const out = fs.openSync(path.join(artifacts, `${name}.log`), 'w');
  const child = spawn(cmd, cmdArgs, { cwd: root, stdio: ['ignore', out, out], detached: process.platform !== 'win32', shell: process.platform === 'win32', ...opts });
  children.push(child);
  return child;
}

async function waitFor(url, label, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`${label} did not become ready at ${url}. See qa-artifacts/*.log`);
  stopAll();
  process.exit(2);
}

// Stale servers from an earlier run would silently serve old code.
for (const port of [5100, 3100]) {
  const probe = await fetch(port === 5100 ? `${API}/health` : UI).then(() => true).catch(() => false);
  if (probe) { console.error(`Port ${port} is already in use. Stop the previous QA stack first.`); process.exit(2); }
}

if (!args['no-reset']) {
  const code = run(process.execPath, ['scripts/qa-reset.js'], { shell: false, env: { ...process.env, ENV_FILE: path.join(root, '.env.qa') } });
  if (code !== 0) process.exit(2);
}

start('qa-api', process.execPath, ['src/server.js'], { cwd: path.join(root, 'server'), shell: false, env: { ...process.env, ENV_FILE: path.join(root, '.env.qa') } });
await waitFor(`${API}/health`, 'QA API');

if (!args['no-build']) {
  const code = run(npx, ['vite', 'build', '--logLevel', 'warn'], { cwd: path.join(root, 'client') });
  if (code !== 0) { console.error('Client build failed'); process.exit(2); }
}
start('qa-ui', npx, ['vite', 'preview', '--host', '127.0.0.1'], { cwd: path.join(root, 'client'), env: { ...process.env, VITE_API_PROXY: API, VITE_PORT: '3100' } });
await waitFor(UI, 'QA UI');
console.log(`QA stack ready: API ${API}  UI ${UI}`);

if (args['servers-only']) {
  console.log('Servers running. Press Ctrl+C to stop.');
  await new Promise(() => {});
}

const mode = args.cypress === 'open' ? 'open' : 'run';
const cyArgs = [mode, '--config', `baseUrl=${UI}`];
if (mode === 'run') {
  if (args.spec) cyArgs.push('--spec', String(args.spec));
  if (args.browser) cyArgs.push('--browser', String(args.browser));
}
// ELECTRON_RUN_AS_NODE is set by VS Code / Electron hosts and makes Cypress.exe behave like plain Node ("bad option: --smoke-test").
const cypressEnv = { ...process.env, CYPRESS_API_URL: API, MONGO_URI: 'mongodb://127.0.0.1:27017/tmt_qa' };
delete cypressEnv.ELECTRON_RUN_AS_NODE;
const code = run(npx, ['cypress', ...cyArgs], { env: cypressEnv });
stopAll();
process.exit(code);
