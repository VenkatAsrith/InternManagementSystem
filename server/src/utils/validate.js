import mongoose from 'mongoose';
import { unprocessable } from './errors.js';

export const isObjectId = (v) =>
  (typeof v === 'string' && /^[a-f\d]{24}$/i.test(v)) || v instanceof mongoose.Types.ObjectId;

export const escapeRegex = (s) => String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s().-]{5,18}[0-9]$/;
const CONTROL_RE = /[\u0000-\u001F\u007F]/;

/** Page/limit clamp. Prevents limit=1000000 and negative pages. */
export function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, skip: (page - 1) * limit };
}

/** True only for http(s) URLs. Blocks javascript:, data:, file:, vbscript: etc. */
export function isSafeHttpUrl(v) {
  if (typeof v !== 'string' || v.length > 2048 || CONTROL_RE.test(v) || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

export function safeQueryObjectId(value) {
  return isObjectId(value) ? String(value) : undefined;
}

/**
 * Collects field errors so the API answers with every problem at once:
 *   422 { error: { code:'VALIDATION_ERROR', details:[{field,message}] } }
 */
export class Validator {
  constructor(source = {}) {
    this.src = source && typeof source === 'object' ? source : {};
    this.out = {};
    this.errors = [];
  }

  _has(field) {
    const v = this.src[field];
    return v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
  }

  fail(field, message) {
    this.errors.push({ field, message });
    return this;
  }

  string(field, { required = false, min = 0, max = 500, pattern, patternMessage, lower = false, upper = false, allowEmpty = false } = {}) {
    if (!this._has(field)) {
      if (required) this.fail(field, `${field} is required`);
      else if (allowEmpty && this.src[field] === '') this.out[field] = '';
      return this;
    }
    const raw = this.src[field];
    if (typeof raw !== 'string' && typeof raw !== 'number') return this.fail(field, `${field} must be text`);
    let value = String(raw).trim();
    if (value.length < min) return this.fail(field, `${field} must be at least ${min} characters`);
    if (value.length > max) return this.fail(field, `${field} must be at most ${max} characters`);
    if (pattern && !pattern.test(value)) return this.fail(field, patternMessage || `${field} has an invalid format`);
    if (lower) value = value.toLowerCase();
    if (upper) value = value.toUpperCase();
    this.out[field] = value;
    return this;
  }

  email(field, { required = false } = {}) {
    if (!this._has(field)) {
      if (required) this.fail(field, `${field} is required`);
      return this;
    }
    const value = typeof this.src[field] === 'string' ? this.src[field].trim().toLowerCase() : '';
    if (!EMAIL_RE.test(value) || value.length > 254) return this.fail(field, 'Enter a valid email address');
    this.out[field] = value;
    return this;
  }

  phone(field, { required = false } = {}) {
    if (!this._has(field) || (!required && (this.src[field] === '' || this.src[field] === null || this.src[field] === undefined))) {
      if (required) this.fail(field, `${field} is required`);
      return this;
    }
    const value = String(this.src[field]).trim();
    if (!PHONE_RE.test(value)) return this.fail(field, 'Enter a valid phone number (7-15 digits, optional +)');
    this.out[field] = value;
    return this;
  }

  url(field, { required = false } = {}) {
    if (!this._has(field)) {
      if (required) this.fail(field, `${field} is required`);
      return this;
    }
    const value = typeof this.src[field] === 'string' ? this.src[field].trim() : '';
    if (!isSafeHttpUrl(value)) return this.fail(field, 'Enter a valid http(s) URL');
    this.out[field] = value;
    return this;
  }

  number(field, { required = false, min, max, integer = false } = {}) {
    if (!this._has(field)) {
      if (required) this.fail(field, `${field} is required`);
      return this;
    }
    const raw = this.src[field];
    const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(value)) return this.fail(field, `${field} must be a number`);
    if (integer && !Number.isInteger(value)) return this.fail(field, `${field} must be a whole number`);
    if (min !== undefined && value < min) return this.fail(field, `${field} must be at least ${min}`);
    if (max !== undefined && value > max) return this.fail(field, `${field} must be at most ${max}`);
    this.out[field] = value;
    return this;
  }

  boolean(field, { required = false, defaultValue } = {}) {
    if (!this._has(field) && typeof this.src[field] !== 'boolean') {
      if (required) this.fail(field, `${field} is required`);
      else if (defaultValue !== undefined) this.out[field] = defaultValue;
      return this;
    }
    const raw = this.src[field];
    if (raw === true || raw === 'true') this.out[field] = true;
    else if (raw === false || raw === 'false') this.out[field] = false;
    else this.fail(field, `${field} must be true or false`);
    return this;
  }

  date(field, { required = false, min, max } = {}) {
    if (!this._has(field)) {
      if (required) this.fail(field, `${field} is required`);
      return this;
    }
    const raw = this.src[field];
    const value = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(value.getTime())) return this.fail(field, `${field} must be a valid date`);
    if (min && value < min) return this.fail(field, `${field} is too early`);
    if (max && value > max) return this.fail(field, `${field} is too late`);
    this.out[field] = value;
    return this;
  }

  oneOf(field, allowed, { required = false, defaultValue } = {}) {
    const list = Array.isArray(allowed) ? allowed : Object.values(allowed);
    if (!this._has(field)) {
      if (required) this.fail(field, `${field} is required`);
      else if (defaultValue !== undefined) this.out[field] = defaultValue;
      return this;
    }
    const value = String(this.src[field]).trim();
    if (!list.includes(value)) return this.fail(field, `${field} must be one of: ${list.join(', ')}`);
    this.out[field] = value;
    return this;
  }

  objectId(field, { required = false } = {}) {
    if (!this._has(field)) {
      if (required) this.fail(field, `${field} is required`);
      return this;
    }
    const raw = this.src[field];
    const value = raw && typeof raw === 'object' && raw._id ? String(raw._id) : String(raw);
    if (!isObjectId(value)) return this.fail(field, `${field} must be a valid identifier`);
    this.out[field] = value;
    return this;
  }

  objectIdList(field, { required = false, max = 50 } = {}) {
    const raw = this.src[field];
    if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0 && !required)) {
      if (required) this.fail(field, `${field} is required`);
      else if (Array.isArray(raw)) this.out[field] = [];
      return this;
    }
    if (!Array.isArray(raw)) return this.fail(field, `${field} must be a list`);
    if (raw.length > max) return this.fail(field, `${field} may contain at most ${max} items`);
    if (required && raw.length === 0) return this.fail(field, `${field} is required`);
    const ids = raw.map(x => (x && typeof x === 'object' && x._id ? String(x._id) : String(x)));
    if (ids.some(x => !isObjectId(x))) return this.fail(field, `${field} contains an invalid identifier`);
    this.out[field] = [...new Set(ids)];
    return this;
  }

  /** Accepts an array or a comma separated string. */
  stringList(field, { max = 50, itemMax = 100, separator = ',' } = {}) {
    const raw = this.src[field];
    if (raw === undefined || raw === null || raw === '') return this;
    let list = Array.isArray(raw) ? raw : String(raw).split(separator);
    list = list.map(x => String(x).trim()).filter(Boolean);
    if (list.length > max) return this.fail(field, `${field} may contain at most ${max} items`);
    if (list.some(x => x.length > itemMax)) return this.fail(field, `${field} items must be at most ${itemMax} characters`);
    this.out[field] = list;
    return this;
  }

  /** Copies a value untouched (use only after the field was validated elsewhere). */
  passthrough(field) {
    if (this.src[field] !== undefined) this.out[field] = this.src[field];
    return this;
  }

  done() {
    if (this.errors.length) throw unprocessable('Validation failed. Please correct the highlighted fields.', this.errors);
    return this.out;
  }
}

export const validate = (source) => new Validator(source);

export function pick(obj = {}, keys = []) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export function requireObjectId(value, field = 'id') {
  if (!isObjectId(value)) throw unprocessable(`${field} must be a valid identifier`, [{ field, message: 'Invalid identifier' }]);
  return String(value);
}
