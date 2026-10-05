import { AuditLog } from '../modules/audit/audit.model.js';
import { logger } from '../config/logger.js';

const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'passwordSetupTokenHash', 'acceptTokenHash', 'refreshTokenHash',
  'token', 'accessToken', 'refreshToken', 'accountNumber', 'accountNumberMasked'
]);

/** Deep copy that drops secrets and converts documents/ObjectIds to plain JSON-safe data. */
export function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 6) return '[truncated]';
  if (typeof value.toObject === 'function') value = value.toObject();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.slice(0, 200).map(v => redact(v, depth + 1));
  if (typeof value === 'object') {
    if (value._bsontype === 'ObjectId' || value.constructor?.name === 'ObjectId') return String(value);
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) continue;
      out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Append one audit event. When `req` is supplied the actor, role, organisation, IP, user agent and
 * correlation id are filled automatically, so a call site only has to say WHAT happened.
 */
export async function recordAuditLog({
  organizationId,
  actorId,
  actorEmail,
  actorRole,
  action,
  entityType,
  entityId,
  before = null,
  after = null,
  req = null,
  metadata = {}
}) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    const userAgent = req ? req.headers['user-agent'] : '';

    await AuditLog.create({
      organizationId: organizationId ?? req?.organizationId,
      actorId: actorId ?? req?.userId,
      actorEmail: actorEmail ?? req?.user?.email,
      actorRole: actorRole ?? req?.user?.role,
      action,
      entityType,
      entityId: String(entityId),
      before: redact(before),
      after: redact(after),
      ipAddress,
      userAgent,
      correlationId: req?.requestId,
      metadata: redact(metadata)
    });
  } catch (err) {
    logger.error(`Failed to record audit log (${action}): ${err.message}`);
    // Never interrupt the business workflow because of an audit failure.
  }
}
