import { defineConfig } from 'cypress';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const requireFromServer = createRequire(path.join(root, 'server', 'package.json'));

function loadFixtures() {
  const file = path.join(root, 'qa-artifacts', 'qa-fixtures.json');
  if (!fs.existsSync(file)) throw new Error('qa-artifacts/qa-fixtures.json is missing. Run "npm run qa:reset" (or use npm run cy:run, which resets the QA database first).');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Cypress configuration.
 *  - No test is skipped, no exception is swallowed globally, no fixed sleeps are used for synchronisation.
 *  - retries are 0: a test that only passes on the second attempt is a race condition, and races are defects.
 *  - node tasks may ONLY touch the isolated QA database (tmt_qa); they refuse anything else.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3100',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1440,
    viewportHeight: 900,
    defaultCommandTimeout: 8000,
    requestTimeout: 15000,
    responseTimeout: 30000,
    pageLoadTimeout: 30000,
    retries: { runMode: 0, openMode: 0 },
    video: false,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'qa-artifacts/cypress/screenshots',
    downloadsFolder: 'qa-artifacts/cypress/downloads',
    trashAssetsBeforeRuns: false,
    manageBrowserMemory: true,
    numTestsKeptInMemory: 5,
    expose: { apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:5100' },
    setupNodeEvents(on, config) {
      config.expose.fx = loadFixtures();

      const dbName = () => (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tmt_qa').split('/').pop().split('?')[0];
      let conn;
      async function db() {
        const name = dbName();
        if (!/qa|test/i.test(name)) throw new Error(`Refusing to touch database "${name}": only QA/test databases are allowed.`);
        if (!conn) {
          const { MongoClient } = requireFromServer('mongodb');
          conn = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tmt_qa');
          await conn.connect();
        }
        return conn.db(name);
      }
      const oid = (id) => new (requireFromServer('mongodb').ObjectId)(String(id));

      on('task', {
        /** Test-only: make an offer look expired without waiting a week. */
        async 'db:expireOffer'({ offerId }) {
          const res = await (await db()).collection('offers').updateOne({ offerId }, { $set: { validUntil: new Date(Date.now() - 60_000) } });
          return res.modifiedCount;
        },
        /** Test-only: read a document so tests can assert what really reached the database. */
        async 'db:find'({ collection, filter }) {
          const norm = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, /Id$|^_id$/.test(k) && typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? oid(v) : v]));
          const docs = await (await db()).collection(collection).find(norm(filter)).limit(50).toArray();
          return JSON.parse(JSON.stringify(docs));
        },
        async 'db:count'({ collection, filter }) {
          const norm = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, /Id$|^_id$/.test(k) && typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? oid(v) : v]));
          return (await db()).collection(collection).countDocuments(norm(filter));
        },
        /** Test-only: forge the attendance history a working intern would have, so payroll can be verified. */
        async 'db:seedAttendance'({ internId, userId, organizationId, dates }) {
          const docs = dates.map((d) => ({
            internId: oid(internId), userId: oid(userId), organizationId: oid(organizationId), date: new Date(d), status: 'PRESENT', mode: 'MANUAL',
            checkIn: new Date(new Date(d).getTime() + 4 * 3600e3), checkOut: new Date(new Date(d).getTime() + 12 * 3600e3), totalHours: 8, createdAt: new Date(), updatedAt: new Date()
          }));
          if (docs.length) await (await db()).collection('attendancerecords').insertMany(docs, { ordered: false }).catch(() => {});
          return docs.length;
        },
        /** Multipart public application from Node (cy.request cannot post a file). */
        async 'api:apply'({ url, body }) {
          const form = new FormData();
          Object.entries(body).forEach(([k, v]) => form.append(k, v));
          const pdf = Buffer.from(['%PDF-1.4', '1 0 obj', '<< /Type /Catalog >>', 'endobj', 'trailer', '<< /Root 1 0 R >>', '%%EOF', ''].join(String.fromCharCode(10)));
          form.append('resume', new Blob([pdf], { type: 'application/pdf' }), 'resume.pdf');
          const res = await fetch(url, { method: 'POST', body: form });
          return { status: res.status, body: await res.json() };
        },
        /** Fires `count` identical requests at the same instant (true concurrency, unlike cy.request). Yields [{status, code}]. */
        async 'api:race'({ url, method = 'POST', headers = {}, body, count = 3 }) {
          const one = () => fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
            .then(async (r) => { let j = null; try { j = await r.json(); } catch { /* not json */ } return { status: r.status, code: j?.error?.code || null, data: j?.data || null }; });
          return Promise.all(Array.from({ length: count }, one));
        },
        log(message) { console.log(message); return null; }
      });
      on('after:run', async () => { if (conn) await conn.close(); });
      return config;
    }
  }
});
