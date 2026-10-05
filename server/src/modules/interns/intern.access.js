import { Intern } from './intern.model.js';
import { ROLES } from '../../../../shared/constants.js';
import { notFound, forbidden } from '../../utils/errors.js';

/**
 * Who may see which intern?
 *   INTERN            -> only their own engagement
 *   MENTOR/TEAM_LEAD  -> only interns they supervise (mentor or manager)
 *   everyone else     -> the whole organisation (their permission decides whether they may call the endpoint at all)
 */
export function internScope(req) {
  const scope = { organizationId: req.organizationId };
  if (req.userRole === ROLES.INTERN) scope.userId = req.userId;
  else if ([ROLES.MENTOR, ROLES.TEAM_LEAD].includes(req.userRole)) scope.$or = [{ mentorId: req.userId }, { managerId: req.userId }];
  return scope;
}

export function canAccessIntern(req, intern) {
  if (!intern) return false;
  if (String(intern.organizationId) !== String(req.organizationId)) return false;
  if (req.userRole === ROLES.INTERN) return String(intern.userId?._id || intern.userId) === String(req.userId);
  if ([ROLES.MENTOR, ROLES.TEAM_LEAD].includes(req.userRole)) {
    return [intern.mentorId?._id || intern.mentorId, intern.managerId?._id || intern.managerId].some(id => id && String(id) === String(req.userId));
  }
  return true;
}

/** Loads an intern by id, applying the caller's visibility. Out-of-scope interns look like they do not exist (404). */
export async function loadScopedIntern(req, id, populate = []) {
  const query = Intern.findOne({ _id: id, ...internScope(req) });
  for (const p of populate) query.populate(p);
  const intern = await query;
  if (!intern) throw notFound('Intern record not found');
  return intern;
}

/** The intern engagement belonging to the signed-in user (interns only). */
export async function getOwnIntern(req, { required = true } = {}) {
  const intern = await Intern.findOne({ userId: req.userId, organizationId: req.organizationId });
  if (!intern && required) throw forbidden('An intern profile is required for this action.', 'INTERN_PROFILE_REQUIRED');
  return intern;
}
