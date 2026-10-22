import { Intern } from './intern.model.js';
import { ROLES } from '../../../../shared/constants.js';
import { notFound, forbidden } from '../../utils/errors.js';

/**
 * Who may see which intern?
 *   INTERN / INTERN_TRAINEE -> only their own engagement
 *   MENTOR/TEAM_LEAD        -> only interns they supervise (mentor or manager)
 *   everyone else           -> the whole organisation (their permission decides whether they may call the endpoint at all)
 */
export function internScope(req) {
  const scope = { organizationId: req.organizationId };
  if (req.userRole === ROLES.INTERN || req.userRole === ROLES.INTERN_TRAINEE) scope.userId = req.userId;
  else if ([ROLES.MENTOR, ROLES.TEAM_LEAD].includes(req.userRole)) scope.$or = [{ mentorId: req.userId }, { managerId: req.userId }];
  return scope;
}

export function canAccessIntern(req, intern) {
  if (!intern) return false;
  if (String(intern.organizationId) !== String(req.organizationId)) return false;
  if (req.userRole === ROLES.INTERN || req.userRole === ROLES.INTERN_TRAINEE) return String(intern.userId?._id || intern.userId) === String(req.userId);
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

/** The intern engagement belonging to the signed-in user (interns and trainees). */
export async function getOwnIntern(req, { required = true } = {}) {
  let intern = await Intern.findOne({ userId: req.userId, organizationId: req.organizationId });
  if (!intern && (req.userRole === ROLES.INTERN_TRAINEE || req.userRole === ROLES.INTERN)) {
    // If user has a TrainingEngagement, ensure an Intern record exists and is linked
    try {
      const { TrainingEngagement } = await import('../training/training.model.js');
      const { Department } = await import('../organizations/organization.model.js');
      const { InternshipProgram } = await import('../recruitment/recruitment.model.js');
      const { generateId } = await import('../../utils/idGenerator.js');

      const engagement = await TrainingEngagement.findOne({ userId: req.userId, organizationId: req.organizationId })
        .populate('programId');

      if (engagement) {
        let deptId = engagement.departmentId;
        if (!deptId) {
          const anyDept = await Department.findOne({ organizationId: req.organizationId });
          deptId = anyDept?._id;
        }
        let progId = engagement.programId?._id;
        if (!progId) {
          const anyProg = await InternshipProgram.findOne({ organizationId: req.organizationId });
          progId = anyProg?._id;
        }
        if (deptId && progId) {
          intern = await Intern.create({
            internId: engagement.traineeId || await generateId('TRN'),
            userId: req.userId,
            organizationId: req.organizationId,
            departmentId: deptId,
            programId: progId,
            mentorId: engagement.mentorId || engagement.trainerId,
            managerId: engagement.managerId,
            workMode: engagement.workMode || 'REMOTE',
            startDate: engagement.startDate || new Date(),
            expectedEndDate: engagement.expectedEndDate || new Date(Date.now() + 60 * 86400000),
            status: 'ACTIVE',
            source: engagement.source || 'APPLICATION',
            institution: engagement.institution || '',
            degree: engagement.degree || '',
            location: engagement.location || '',
            compensation: engagement.compensation || { type: 'UNPAID', amount: 0, currency: 'INR', frequency: 'MONTHLY' }
          });
          engagement.internId = intern._id;
          await engagement.save();
        }
      }
    } catch {
      // Continue to check required
    }
  }

  if (!intern && required) throw forbidden('An intern profile is required for this action.', 'INTERN_PROFILE_REQUIRED');
  return intern;
}
