#!/usr/bin/env node
/**
 * Runs Cypress against an ALREADY RUNNING QA stack (start one with: node scripts/qa-servers.js --servers-only).
 *   node scripts/cy-spec.js cypress/e2e/auth/login.cy.js
 * Useful while developing: no database reset, no rebuild, no server start-up.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = process.argv[2];
const extra = process.argv.slice(3);
const env = { ...process.env, CYPRESS_API_URL: 'http://localhost:5100', MONGO_URI: 'mongodb://127.0.0.1:27017/tmt_qa' };
delete env.ELECTRON_RUN_AS_NODE;
const args = ['cypress', 'run', '--config', 'baseUrl=http://localhost:3100', ...(spec ? ['--spec', spec] : []), ...extra];
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env });
process.exit(r.status ?? 1);
