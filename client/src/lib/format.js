// Display helpers. Money is always shown from server-calculated numbers; the UI never computes payroll.
const DEFAULT_TZ = 'Asia/Kolkata';
let displayTz = DEFAULT_TZ;

export function setDisplayTimezone(tz) {
  displayTz = tz || DEFAULT_TZ;
}

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value) {
  if (typeof value === 'string' && dateOnly.test(value)) {
    // Calendar dates carry no time zone: render them as written instead of shifting them.
    const [y, m, d] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  }
  const d = toDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: displayTz }).format(d);
}

export function fmtDateTime(value) {
  const d = toDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: displayTz
  }).format(d);
}

export function fmtTime(value) {
  const d = toDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: displayTz }).format(d);
}

/** yyyy-mm-dd in the organisation's time zone, for <input type="date"> defaults. */
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: displayTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** yyyy-mm-dd of an instant, in the organisation's time zone. */
export function dateISO(value) {
  const d = toDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: displayTz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Converts an ISO timestamp to the value format required by <input type="datetime-local"> in org time. */
export function toDateTimeLocal(value) {
  const d = toDate(value);
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: displayTz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

export function fmtMoney(amount, currency = 'INR') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '-';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function fmtNumber(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat('en-IN').format(Number(n));
}

export function fmtPercent(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return `${Number(n).toFixed(digits)}%`;
}

export function humanize(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export function fullName(person) {
  if (!person) return '-';
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || '-';
}

export function initials(person) {
  const a = person?.firstName?.[0] || person?.email?.[0] || '?';
  const b = person?.lastName?.[0] || '';
  return `${a}${b}`.toUpperCase();
}

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Removes empty-string values so optional filters are not sent to the API as `status=`. */
export function cleanParams(params) {
  return Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}
