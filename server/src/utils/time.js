import { env } from '../config/env.js';

// All business "days" (attendance, leave, payroll) are calendar days in the ORGANISATION timezone,
// never in the server's local timezone.  A "day" value is the UTC instant of that local midnight.

const MS_DAY = 24 * 60 * 60 * 1000;
const fmtCache = new Map();

function formatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
  }
  return fmtCache.get(tz);
}

export function tzParts(date, tz = env.ORG_TIMEZONE) {
  const out = {};
  for (const p of formatter(tz).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year), month: Number(out.month), day: Number(out.day),
    hour: Number(out.hour) % 24, minute: Number(out.minute), second: Number(out.second), weekday: out.weekday
  };
}

function offsetMinutesAt(instant, tz) {
  const p = tzParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

export function ymdInTz(date, tz = env.ORG_TIMEZONE) {
  const p = tzParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** UTC instant of local midnight for the given moment. */
export function startOfDay(date = new Date(), tz = env.ORG_TIMEZONE) {
  const p = tzParts(date, tz);
  const guess = Date.UTC(p.year, p.month - 1, p.day);
  let inst = guess - offsetMinutesAt(new Date(guess), tz) * 60000;
  const off2 = offsetMinutesAt(new Date(inst), tz);
  inst = guess - off2 * 60000;
  return new Date(inst);
}

/** Parses 'YYYY-MM-DD' (or any ISO string / Date) to that day's local midnight. Returns null when invalid. */
export function toDay(input, tz = env.ORG_TIMEZONE) {
  if (input === undefined || input === null || input === '') return null;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const [y, m, d] = input.trim().split('-').map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d, 12));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
    const guess = Date.UTC(y, m - 1, d);
    let inst = guess - offsetMinutesAt(new Date(guess), tz) * 60000;
    inst = guess - offsetMinutesAt(new Date(inst), tz) * 60000;
    return new Date(inst);
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return startOfDay(d, tz);
}

export function addDays(day, n, tz = env.ORG_TIMEZONE) {
  // Add on the calendar (noon-anchored to survive DST) then normalise back to local midnight.
  return startOfDay(new Date(day.getTime() + n * MS_DAY + 12 * 60 * 60 * 1000), tz);
}

export function minutesOfDay(date = new Date(), tz = env.ORG_TIMEZONE) {
  const p = tzParts(date, tz);
  return p.hour * 60 + p.minute;
}

export function isWeekend(day, tz = env.ORG_TIMEZONE) {
  const w = tzParts(new Date(day.getTime() + 12 * 60 * 60 * 1000), tz).weekday;
  return w === 'Sat' || w === 'Sun';
}

/** Every local-midnight day between start and end inclusive. */
export function eachDay(start, end, tz = env.ORG_TIMEZONE) {
  const days = [];
  if (!start || !end) return days;
  let cur = startOfDay(start, tz);
  const last = startOfDay(end, tz);
  let guard = 0;
  while (cur <= last && guard++ < 4000) {
    days.push(cur);
    cur = addDays(cur, 1, tz);
  }
  return days;
}

export function weekdaysBetween(start, end, tz = env.ORG_TIMEZONE) {
  return eachDay(start, end, tz).filter(d => !isWeekend(d, tz));
}

export function countWeekdays(start, end, tz = env.ORG_TIMEZONE) {
  return weekdaysBetween(start, end, tz).length;
}

/** 'YYYY-MM' -> { start, end } (local midnights of first and last day). null when malformed. */
export function cycleRange(cycle, tz = env.ORG_TIMEZONE) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(cycle || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const start = toDay(`${m[1]}-${m[2]}-01`, tz);
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const end = toDay(`${m[1]}-${m[2]}-${String(lastDay).padStart(2, '0')}`, tz);
  return { start, end };
}

export function parseHHmm(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function formatDateLong(date, tz = env.ORG_TIMEZONE) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
}

export function formatDateISO(date, tz = env.ORG_TIMEZONE) {
  return date ? ymdInTz(new Date(date), tz) : '';
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
