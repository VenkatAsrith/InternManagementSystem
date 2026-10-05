import { AuditLog } from './audit.model.js';
import { paginatedResponse } from '../../utils/response.js';
import { ah } from '../../utils/asyncHandler.js';
import { escapeRegex, parsePagination } from '../../utils/validate.js';
import { unprocessable } from '../../utils/errors.js';

function buildQuery(req) {
  const query = { organizationId: req.organizationId };
  const { action, entityType, entityId, actorEmail, from, to } = req.query;
  if (action) query.action = new RegExp(`^${escapeRegex(String(action).slice(0, 80))}`, 'i');
  if (entityType) query.entityType = String(entityType).slice(0, 60);
  if (entityId) query.entityId = String(entityId).slice(0, 60);
  if (actorEmail) query.actorEmail = new RegExp(escapeRegex(String(actorEmail).slice(0, 120)), 'i');
  if (from || to) {
    query.timestamp = {};
    for (const [key, value] of [['$gte', from], ['$lte', to]]) {
      if (!value) continue;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) throw unprocessable('Invalid date filter', [{ field: key === '$gte' ? 'from' : 'to', message: 'Use YYYY-MM-DD' }]);
      query.timestamp[key] = d;
    }
  }
  return query;
}

export const getAuditLogs = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = buildQuery(req);
  const [logs, total] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(query)
  ]);
  return paginatedResponse(res, logs, { page, limit, total });
});

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`; // neutralise spreadsheet formulas

export const exportAuditLogs = ah(async (req, res) => {
  const logs = await AuditLog.find(buildQuery(req)).sort({ timestamp: -1 }).limit(5000).lean();
  const rows = [['timestamp', 'action', 'actorEmail', 'actorRole', 'entityType', 'entityId', 'ipAddress'].join(',')]
    .concat(logs.map(l => [l.timestamp?.toISOString(), l.action, l.actorEmail, l.actorRole, l.entityType, l.entityId, l.ipAddress].map(csvCell).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
  res.send(rows.join('\n'));
});
