// Hard safety rails for every script that WRITES to a database.
// A destructive script may only ever run against a database whose name says it is disposable.

const QA_NAME = /(^|[_-])(qa|test)([_-]|$)/i;

export function parseDbName(uri) {
  const m = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri || '');
  return m ? decodeURIComponent(m[1]) : '';
}

/** Throws unless the URI points at a database named like *qa* / *test*. */
export function assertQaDatabase(uri) {
  const name = parseDbName(uri);
  if (!name || !QA_NAME.test(name)) {
    throw new Error(
      `REFUSING TO RUN: database "${name || '(none)'}" is not a QA database. ` +
      `Destructive QA scripts only run against a database whose name contains "qa" or "test" (for example tmt_qa).`
    );
  }
  if (process.env.NODE_ENV === 'production') throw new Error('REFUSING TO RUN: NODE_ENV=production.');
  return name;
}

export const DEV_DB_NAME = 'intern_management_system';

export function isDevDatabase(uri) {
  return parseDbName(uri) === DEV_DB_NAME;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      args[k] = v === undefined ? true : v;
    } else args._.push(a);
  }
  return args;
}
