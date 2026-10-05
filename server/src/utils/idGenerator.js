import crypto from 'crypto';
import mongoose from 'mongoose';

// Authoritative identifiers are ALWAYS generated on the server:
//   APP-YYYY-XXXXXX  OFFER-YYYY-XXXXXX  INT-YYYY-XXXXXX  CERT-YYYY-XXXXXX  ...
// Sequential ids use an atomic per-prefix, per-year counter ($inc + upsert), so they are collision-safe.

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

export async function generateId(prefix = 'GEN', session = null) {
  const year = new Date().getFullYear();
  const counterId = `${prefix}-${year}`;

  const query = Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  if (session) {
    query.session(session);
  }

  const res = await query.exec();
  const sequenceStr = String(res.seq).padStart(6, '0');
  return `${prefix}-${year}-${sequenceStr}`;
}

/**
 * Non-guessable identifier in the same PREFIX-YYYY-XXXXXX shape, for artefacts that are verified publicly
 * (certificates, documents). A sequential number would let anyone enumerate every holder's name.
 * `exists(id)` must return true when the id is already taken; the caller's unique index is the final guard.
 */
export async function generateRandomId(prefix, exists, maxAttempts = 12) {
  const year = new Date().getFullYear();
  for (let i = 0; i < maxAttempts; i++) {
    const id = `${prefix}-${year}-${String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')}`;
    if (!(await exists(id))) return id;
  }
  throw new Error(`Could not allocate a unique ${prefix} identifier`);
}

/** Opaque URL-safe secret (e.g. offer acceptance link, password setup link). Store only its hash. */
export function generateSecretToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
