import { models as M, mongoose } from '../../server/src/modelRegistry.js';
import { seedDefaultTemplates } from '../../server/src/modules/templates/template.service.js';
import { generateId } from '../../server/src/utils/idGenerator.js';
import { startOfDay, addDays } from '../../server/src/utils/time.js';
import { ROLES, INTERN_STATUS, APPLICATION_STATUS, ASSET_STATUS, COMPENSATION_TYPE } from '../../shared/constants.js';
import { assertQaDatabase } from './safety.js';

/** Everything the suites need to know about the deterministic data set. */
export const QA = {
  password: 'QaPass2026!',
  domain: 'tmt-qa.test',
  orgA: { name: 'TMT-QA-ORG', code: 'TMTQA', slug: 'tmt-qa-org' },
  orgB: { name: 'TMT-QA-ORG-B', code: 'TMTQB', slug: 'tmt-qa-org-b' },
  // key -> [role, first, last]
  usersA: {
    superadmin: [ROLES.SUPER_ADMIN, 'Sam', 'SuperAdmin'],
    orgadmin: [ROLES.ORGANIZATION_ADMIN, 'Olivia', 'OrgAdmin'],
    hradmin: [ROLES.HR_ADMIN, 'Hannah', 'HrAdmin'],
    recruiter: [ROLES.HR_RECRUITER, 'Rita', 'Recruiter'],
    manager: [ROLES.PROGRAM_MANAGER, 'Priya', 'Manager'],
    mentor: [ROLES.MENTOR, 'Mateo', 'Mentor'],
    mentor2: [ROLES.MENTOR, 'Maya', 'MentorTwo'],
    lead: [ROLES.TEAM_LEAD, 'Leo', 'TeamLead'],
    interviewer: [ROLES.INTERVIEWER, 'Ivy', 'Interviewer'],
    finance: [ROLES.FINANCE_ADMIN, 'Felix', 'Finance'],
    financeviewer: [ROLES.FINANCE_VIEWER, 'Fiona', 'FinanceViewer'],
    documentadmin: [ROLES.DOCUMENT_ADMIN, 'Dana', 'DocumentAdmin'],
    auditor: [ROLES.AUDITOR, 'Aria', 'Auditor'],
    intern: [ROLES.INTERN, 'Ian', 'Intern'],
    candidate: [ROLES.CANDIDATE, 'Cara', 'Candidate']
  },
  usersB: {
    orgadmin: [ROLES.ORGANIZATION_ADMIN, 'Bella', 'OrgAdminB'],
    hradmin: [ROLES.HR_ADMIN, 'Ben', 'HrAdminB'],
    mentor: [ROLES.MENTOR, 'Bo', 'MentorB'],
    intern: [ROLES.INTERN, 'Ivan', 'InternB']
  }
};

export const emailOf = (org, key) => (org === 'A' ? `qa.${key}@${QA.domain}` : `qa.b.${key}@${QA.domain}`);

export async function connectQa(uri = process.env.MONGO_URI) {
  assertQaDatabase(uri);
  if (mongoose.connection.readyState !== 1) await mongoose.connect(uri);
  return mongoose.connection;
}

export async function dropQaDatabase(uri = process.env.MONGO_URI) {
  assertQaDatabase(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(M).map(model => model.syncIndexes()));
}

export async function seedQaData() {
  assertQaDatabase(process.env.MONGO_URI);
  const tz = 'Asia/Kolkata';
  const today = startOfDay(new Date(), tz);
  const fx = { password: QA.password, users: { A: {}, B: {} }, ids: {} };

  // ---- organisations ---------------------------------------------------------------------------------------------
  const orgA = await M.Organization.create({ ...QA.orgA, domain: QA.domain, email: `contact@${QA.domain}`, timezone: tz, signatory: { name: 'Quinn QA-Signatory', title: 'Director of Programs' }, status: 'ACTIVE' });
  const orgB = await M.Organization.create({ ...QA.orgB, domain: QA.domain, email: `contact.b@${QA.domain}`, timezone: tz, signatory: { name: 'Bailey B-Signatory', title: 'Head of Talent' }, status: 'ACTIVE' });
  fx.orgA = String(orgA._id); fx.orgB = String(orgB._id);

  const deptA = await M.Department.create({ organizationId: orgA._id, name: 'QA Engineering', code: 'QAENG', description: 'Deterministic QA department' });
  const deptA2 = await M.Department.create({ organizationId: orgA._id, name: 'QA Design', code: 'QADSN', description: 'Second QA department' });
  const deptB = await M.Department.create({ organizationId: orgB._id, name: 'QA Engineering B', code: 'QAENGB' });
  fx.ids.deptA = String(deptA._id); fx.ids.deptA2 = String(deptA2._id); fx.ids.deptB = String(deptB._id);

  // ---- users -----------------------------------------------------------------------------------------------------
  for (const [key, [role, first, last]] of Object.entries(QA.usersA)) {
    const u = await M.User.create({
      organizationId: role === ROLES.SUPER_ADMIN ? undefined : orgA._id, departmentId: role === ROLES.SUPER_ADMIN ? undefined : deptA._id,
      firstName: first, lastName: last, email: emailOf('A', key), password: QA.password, role, phone: '+91 90000 00000', isActive: true
    });
    fx.users.A[key] = { id: String(u._id), email: u.email, role };
  }
  for (const [key, [role, first, last]] of Object.entries(QA.usersB)) {
    const u = await M.User.create({ organizationId: orgB._id, departmentId: deptB._id, firstName: first, lastName: last, email: emailOf('B', key), password: QA.password, role, isActive: true });
    fx.users.B[key] = { id: String(u._id), email: u.email, role };
  }

  await seedDefaultTemplates(orgA._id, fx.users.A.orgadmin.id);
  await seedDefaultTemplates(orgB._id, fx.users.B.orgadmin.id);

  // ---- programs / openings ---------------------------------------------------------------------------------------
  const programA = await M.InternshipProgram.create({
    organizationId: orgA._id, departmentId: deptA._id, title: 'QA Engineering Internship', slug: 'qa-engineering-internship', durationDays: 90,
    attendanceRequirementPercent: 85, completionRequirements: { minimumTasksCompleted: 1, minimumAttendancePercent: 85, finalReviewRequired: true, projectRequired: false }
  });
  const programB = await M.InternshipProgram.create({ organizationId: orgB._id, departmentId: deptB._id, title: 'QA Engineering B Internship', slug: 'qa-engineering-b', durationDays: 60 });
  fx.ids.programA = String(programA._id); fx.ids.programB = String(programB._id);

  const deadline = addDays(today, 30, tz);
  const opening = await M.InternshipOpening.create({
    organizationId: orgA._id, departmentId: deptA._id, programId: programA._id, title: 'QA Software Engineering Intern', slug: 'qa-software-engineering-intern',
    description: 'Deterministic opening used by the automated QA suite for the public application flow.', responsibilities: ['Write automated tests', 'Fix bugs'],
    requiredSkills: ['JavaScript', 'Testing'], duration: '90 Days', workMode: 'REMOTE', location: 'Remote', stipend: 'INR 20,000 per month', stipendAmount: 20000, openPositions: 5,
    deadline, status: 'OPEN', createdBy: fx.users.A.hradmin.id
  });
  const closedOpening = await M.InternshipOpening.create({
    organizationId: orgA._id, departmentId: deptA._id, programId: programA._id, title: 'QA Closed Position', slug: 'qa-closed-position',
    description: 'A closed opening: applications must be refused.', deadline, status: 'CLOSED', createdBy: fx.users.A.hradmin.id
  });
  const openingB = await M.InternshipOpening.create({
    organizationId: orgB._id, departmentId: deptB._id, programId: programB._id, title: 'QA Org B Intern', slug: 'qa-org-b-intern',
    description: 'Org B opening used by the tenant isolation tests.', deadline, status: 'OPEN', createdBy: fx.users.B.hradmin.id
  });
  fx.ids.openingA = String(opening._id); fx.ids.closedOpening = String(closedOpening._id); fx.ids.openingB = String(openingB._id);
  fx.openingSlug = opening.slug; fx.openingSlugB = openingB.slug;

  // ---- candidates + applications ---------------------------------------------------------------------------------
  const mkApp = async (org, opn, first, last, status) => {
    const candidate = await M.Candidate.create({
      organizationId: org._id, firstName: first, lastName: last, email: `qa.cand.${first.toLowerCase()}@${QA.domain}`, phone: '+91 91111 11111',
      education: { college: 'QA Institute of Technology', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2027, cgpa: '8.5' }, technicalSkills: ['JavaScript']
    });
    const app = await M.Application.create({
      applicationId: await generateId('APP'), organizationId: org._id, openingId: opn._id, candidateId: candidate._id, status, privacyConsent: true, privacyConsentAt: new Date(),
      timeline: [{ stage: APPLICATION_STATUS.APPLIED, note: 'QA fixture', timestamp: new Date() }]
    });
    return { candidate, app };
  };
  const a1 = await mkApp(orgA, opening, 'Alice', 'Applied', APPLICATION_STATUS.APPLIED);
  const a2 = await mkApp(orgA, opening, 'Sarah', 'Shortlisted', APPLICATION_STATUS.SHORTLISTED);
  const a3 = await mkApp(orgA, opening, 'Rory', 'Review', APPLICATION_STATUS.UNDER_REVIEW);
  const b1 = await mkApp(orgB, openingB, 'Bruno', 'BApplied', APPLICATION_STATUS.APPLIED);
  fx.apps = { applied: { id: String(a1.app._id), applicationId: a1.app.applicationId, email: a1.candidate.email }, shortlisted: { id: String(a2.app._id), applicationId: a2.app.applicationId }, underReview: { id: String(a3.app._id), applicationId: a3.app.applicationId }, orgB: { id: String(b1.app._id), applicationId: b1.app.applicationId } };

  // ---- active intern (org A) + org B intern --------------------------------------------------------------------------
  const mkIntern = async (org, dept, program, userKey, users, mentorKey, startOffsetDays, appHolder) => {
    const u = users[userKey];
    const start = addDays(today, startOffsetDays, tz);
    const cand = appHolder.candidate;
    const intern = await M.Intern.create({
      internId: await generateId('INT'), userId: u.id, applicationId: appHolder.app._id, candidateId: cand._id, organizationId: org._id, departmentId: dept._id, programId: program._id,
      mentorId: users[mentorKey].id, managerId: users.manager?.id, startDate: start, expectedEndDate: addDays(start, 90, tz), workMode: 'REMOTE', status: INTERN_STATUS.ACTIVE, activatedAt: start
    });
    await M.CompensationPlan.create({ organizationId: org._id, internId: intern._id, compensationType: COMPENSATION_TYPE.MONTHLY_STIPEND, baseAmount: 20000, currency: 'INR', effectiveFrom: start, isActive: true });
    return intern;
  };
  const internCand = await M.Candidate.create({ organizationId: orgA._id, userId: fx.users.A.intern.id, firstName: 'Ian', lastName: 'Intern', email: fx.users.A.intern.email, phone: '+91 92222 22222', education: { college: 'QA Institute', degree: 'B.Tech', branch: 'CS', graduationYear: 2027 } });
  const internApp = await M.Application.create({ applicationId: await generateId('APP'), organizationId: orgA._id, openingId: opening._id, candidateId: internCand._id, status: APPLICATION_STATUS.OFFER_ACCEPTED, privacyConsent: true, timeline: [{ stage: 'OFFER_ACCEPTED', note: 'QA fixture' }] });
  const internDoc = await mkIntern(orgA, deptA, programA, 'intern', fx.users.A, 'mentor', -14, { app: internApp, candidate: internCand });
  const internCandB = await M.Candidate.create({ organizationId: orgB._id, userId: fx.users.B.intern.id, firstName: 'Ivan', lastName: 'InternB', email: fx.users.B.intern.email, phone: '+91 93333 33333', education: { college: 'QA Institute B', degree: 'B.Tech', branch: 'CS', graduationYear: 2027 } });
  const internAppB = await M.Application.create({ applicationId: await generateId('APP'), organizationId: orgB._id, openingId: openingB._id, candidateId: internCandB._id, status: APPLICATION_STATUS.OFFER_ACCEPTED, privacyConsent: true, timeline: [{ stage: 'OFFER_ACCEPTED', note: 'QA fixture' }] });
  const internDocB = await mkIntern(orgB, deptB, programB, 'intern', fx.users.B, 'mentor', -7, { app: internAppB, candidate: internCandB });
  fx.ids.intern = String(internDoc._id); fx.internCode = internDoc.internId;
  fx.ids.internB = String(internDocB._id);

  // ---- work: project + tasks --------------------------------------------------------------------------------------
  const project = await M.Project.create({ organizationId: orgA._id, programId: programA._id, name: 'QA Platform Project', description: 'Deterministic project', ownerId: fx.users.A.mentor.id, members: [fx.users.A.intern.id], startDate: addDays(today, -14, tz), endDate: addDays(today, 76, tz), status: 'ACTIVE' });
  fx.ids.project = String(project._id);
  const mkTask = (title, status) => M.Task.create({ organizationId: orgA._id, projectId: project._id, title, description: `${title} (QA fixture)`, assignedTo: [fx.users.A.intern.id], createdBy: fx.users.A.mentor.id, priority: 'MEDIUM', status, dueDate: addDays(today, 7, tz) });
  const t1 = await mkTask('QA Task Todo', 'TODO');
  const t2 = await mkTask('QA Task In Progress', 'IN_PROGRESS');
  fx.ids.taskTodo = String(t1._id); fx.ids.taskInProgress = String(t2._id);
  const bTask = await M.Task.create({ organizationId: orgB._id, title: 'Org B Task', assignedTo: [fx.users.B.intern.id], createdBy: fx.users.B.mentor.id, status: 'TODO' });
  fx.ids.taskB = String(bTask._id);

  // ---- learning ----------------------------------------------------------------------------------------------------
  const path = await M.LearningPath.create({ organizationId: orgA._id, programId: programA._id, title: 'QA Learning Path', description: 'Deterministic LMS path' });
  const mod = await M.LearningModule.create({ pathId: path._id, organizationId: orgA._id, title: 'QA Module 1', order: 1 });
  const l1 = await M.LearningLesson.create({ moduleId: mod._id, organizationId: orgA._id, title: 'QA Reading', contentType: 'ARTICLE', content: 'Read this.', order: 1 });
  const l2 = await M.LearningLesson.create({ moduleId: mod._id, organizationId: orgA._id, title: 'QA Quiz', contentType: 'QUIZ', order: 2, quiz: { passScore: 60, questions: [{ prompt: '2 + 2 = ?', options: ['3', '4', '5'], correctIndex: 1 }, { prompt: 'Capital of France?', options: ['Paris', 'Rome'], correctIndex: 0 }] } });
  fx.ids.path = String(path._id); fx.ids.lesson1 = String(l1._id); fx.ids.lesson2 = String(l2._id);

  // ---- assets --------------------------------------------------------------------------------------------------------
  const asset = await M.Asset.create({ assetTag: await generateId('AST'), organizationId: orgA._id, name: 'QA Laptop', type: 'LAPTOP', serialNumber: 'QA-SERIAL-0001', status: ASSET_STATUS.AVAILABLE });
  fx.ids.asset = String(asset._id);

  // Reset the "today" markers other suites rely on.
  fx.today = today.toISOString();
  return fx;
}
