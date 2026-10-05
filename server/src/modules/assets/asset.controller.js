import { Asset } from './asset.model.js';
import { Intern } from '../interns/intern.model.js';
import { getOwnIntern } from '../interns/intern.access.js';
import { generateId } from '../../utils/idGenerator.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';
import { recordAuditLog } from '../../middleware/auditLogger.js';
import { createNotification } from '../notifications/notification.service.js';
import { ASSET_STATUS, ASSET_TYPE } from '../../../../shared/constants.js';
import { INTERN_CLOSED_STATUSES } from '../../../../shared/lifecycle.js';
import { ah } from '../../utils/asyncHandler.js';
import { notFound, conflict, unprocessable } from '../../utils/errors.js';
import { Validator, parsePagination, isObjectId } from '../../utils/validate.js';
import { toDay, startOfDay } from '../../utils/time.js';

const OUT = [ASSET_STATUS.ASSIGNED, ASSET_STATUS.RETURN_PENDING];

export const createAsset = ah(async (req, res) => {
  const body = new Validator(req.body).string('name', { required: true, max: 150 }).oneOf('type', ASSET_TYPE, { required: true })
    .string('serialNumber', { max: 100 }).string('specifications', { max: 500 }).done();
  try {
    const asset = await Asset.create({ assetTag: await generateId('AST'), organizationId: req.organizationId, ...body, status: ASSET_STATUS.AVAILABLE });
    await recordAuditLog({ action: 'ASSET_CREATED', entityType: 'Asset', entityId: asset._id, after: asset.toObject(), req });
    return successResponse(res, asset, 'Asset registered successfully', 201);
  } catch (err) {
    if (err?.code === 11000) throw conflict('An asset with this serial number is already registered.', 'DUPLICATE_SERIAL');
    throw err;
  }
});

export const getAssets = ah(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const query = { organizationId: req.organizationId };
  if (Object.values(ASSET_STATUS).includes(req.query.status)) query.status = req.query.status;
  if (Object.values(ASSET_TYPE).includes(req.query.type)) query.type = req.query.type;
  if (isObjectId(req.query.internId)) query.internId = req.query.internId;
  const [assets, total] = await Promise.all([
    Asset.find(query)
      .populate({ path: 'internId', select: 'internId userId departmentId', populate: { path: 'userId', select: 'firstName lastName email' } })
      .populate('assignedBy', 'firstName lastName').populate('verifiedReturnBy', 'firstName lastName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Asset.countDocuments(query)
  ]);
  return paginatedResponse(res, assets, { page, limit, total });
});

export const assignAsset = ah(async (req, res) => {
  const body = new Validator(req.body).objectId('internId', { required: true }).string('returnDueDate', { max: 30 }).done();
  const intern = await Intern.findOne({ _id: body.internId, organizationId: req.organizationId });
  if (!intern) throw notFound('Intern not found');
  if (INTERN_CLOSED_STATUSES.includes(intern.status)) {
    throw conflict(`Assets cannot be assigned to an intern in status ${intern.status}.`, 'INTERN_NOT_ELIGIBLE');
  }
  let due;
  if (body.returnDueDate) {
    due = toDay(body.returnDueDate, req.timezone);
    if (!due || due < startOfDay(new Date(), req.timezone)) throw unprocessable('Return date must be today or later', [{ field: 'returnDueDate', message: 'Invalid return date' }]);
  }
  const now = new Date();
  // Atomic: an asset can only be handed to one person; a second click or a competing HR user gets a conflict.
  const asset = await Asset.findOneAndUpdate(
    { _id: req.params.id, organizationId: req.organizationId, status: ASSET_STATUS.AVAILABLE },
    { $set: { internId: intern._id, status: ASSET_STATUS.ASSIGNED, assignedDate: now, returnDueDate: due, assignedBy: req.userId, returnDate: null, conditionNotes: '' },
      $push: { assignments: { internId: intern._id, assignedDate: now, assignedBy: req.userId } } },
    { new: true }
  );
  if (!asset) {
    const existing = await Asset.findOne({ _id: req.params.id, organizationId: req.organizationId });
    if (!existing) throw notFound('Asset not found');
    throw conflict(`This asset is ${existing.status} and cannot be assigned.`, 'ASSET_NOT_AVAILABLE');
  }
  await createNotification({ organizationId: req.organizationId, recipientId: intern.userId, type: 'ASSET_ASSIGNED', title: 'Equipment assigned', message: `${asset.name} (${asset.assetTag}) was assigned to you.`, entityType: 'Asset', entityId: asset._id });
  await recordAuditLog({ action: 'ASSET_ASSIGNED', entityType: 'Asset', entityId: asset._id, after: { internId: intern.internId, returnDueDate: due }, req });
  return successResponse(res, asset, `Asset ${asset.assetTag} assigned to intern ${intern.internId}`);
});

// The person doing the inspection records the ACTUAL condition. There is no default "good condition" note.
export const returnAsset = ah(async (req, res) => {
  const body = new Validator(req.body).oneOf('outcome', ['RETURNED', 'DAMAGED', 'LOST'], { defaultValue: 'RETURNED' }).string('conditionNotes', { required: true, min: 3, max: 500 }).done();
  const existing = await Asset.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!existing) throw notFound('Asset not found');
  if (!OUT.includes(existing.status)) throw conflict(`Only assigned assets can be returned (current: ${existing.status}).`, 'ASSET_NOT_ASSIGNED');

  const now = new Date();
  const nextStatus = body.outcome === 'RETURNED' ? ASSET_STATUS.AVAILABLE : ASSET_STATUS[body.outcome];
  const asset = await Asset.findOneAndUpdate(
    { _id: existing._id, status: { $in: OUT } },
    { $set: { status: nextStatus, returnDate: now, verifiedReturnBy: req.userId, conditionNotes: body.conditionNotes, internId: null,
      'assignments.$[row].returnDate': now, 'assignments.$[row].outcome': body.outcome, 'assignments.$[row].conditionNotes': body.conditionNotes, 'assignments.$[row].verifiedBy': req.userId } },
    { new: true, arrayFilters: [{ 'row.returnDate': { $exists: false }, 'row.internId': existing.internId }] }
  );
  if (!asset) throw conflict('This asset was already processed.', 'STATE_CHANGED');
  await recordAuditLog({ action: 'ASSET_RETURNED', entityType: 'Asset', entityId: asset._id, after: { outcome: body.outcome, conditionNotes: body.conditionNotes }, req });
  return successResponse(res, asset, `Asset ${asset.assetTag} return recorded (${body.outcome})`);
});

export const getMyAssets = ah(async (req, res) => {
  const intern = await getOwnIntern(req);
  const assets = await Asset.find({ internId: intern._id }).populate('assignedBy', 'firstName lastName').sort({ assignedDate: -1 });
  return successResponse(res, assets);
});
