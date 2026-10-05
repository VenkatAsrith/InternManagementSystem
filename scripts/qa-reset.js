#!/usr/bin/env node
/**
 * QA RESET  -  drops the QA database and recreates the deterministic QA organisation, users, opening,
 * candidate and applications.
 *
 *   node scripts/qa-reset.js            (reads .env.qa)
 *
 * SAFETY: refuses to run unless the database name contains "qa" or "test". It can never touch the
 * developer database (intern_management_system) or production.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnvFile } from './lib/env.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFile(process.env.ENV_FILE || '.env.qa', { override: true });

const { connectQa, dropQaDatabase, seedQaData, QA } = await import('./lib/qa-data.js');
const { mongoose } = await import('../server/src/modelRegistry.js');
const { parseDbName } = await import('./lib/safety.js');

const artifacts = path.join(root, 'qa-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
// stale uploads from a previous run belong to a database that no longer exists
fs.rmSync(path.join(artifacts, 'uploads'), { recursive: true, force: true });

try {
  await connectQa();
  const db = parseDbName(process.env.MONGO_URI);
  await dropQaDatabase();
  const fx = await seedQaData();
  fs.writeFileSync(path.join(artifacts, 'qa-fixtures.json'), JSON.stringify(fx, null, 2));
  console.log(`QA reset complete. database=${db} orgs=${QA.orgA.name}, ${QA.orgB.name} users=${Object.keys(fx.users.A).length + Object.keys(fx.users.B).length}`);
  console.log('Fixtures written to qa-artifacts/qa-fixtures.json');
} catch (err) {
  console.error(`qa-reset failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
