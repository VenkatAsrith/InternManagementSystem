import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/modules/users/user.model.js';
import { Intern } from '../src/modules/interns/intern.model.js';
import { Certificate } from '../src/modules/certificates/certificate.model.js';
import { Organization, Department } from '../src/modules/organizations/organization.model.js';
import { InternshipProgram, InternshipOpening } from '../src/modules/recruitment/recruitment.model.js';

let hrToken = '';
let internToken = '';

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);

  const org = await Organization.findOne();
  const dept = await Department.findOne({ organizationId: org?._id });
  let prog = await InternshipProgram.findOne({ organizationId: org?._id });
  if (!prog && org) {
    prog = await InternshipProgram.create({
      organizationId: org._id,
      departmentId: dept?._id,
      title: 'Full Stack Engineering Track',
      code: 'TRACK-FSE',
      slug: 'track-fse',
      durationDays: 90,
      description: 'Comprehensive Full Stack Track'
    });
  }

  // Ensure test intern user exists
  let testUser = await User.findOne({ email: 'test.intern@techmecha.com' }).select('+password');
  if (!testUser && org) {
    testUser = await User.create({
      organizationId: org._id,
      departmentId: dept?._id,
      firstName: 'Test',
      lastName: 'Intern',
      email: 'test.intern@techmecha.com',
      password: 'Password2026!',
      role: 'INTERN',
      isActive: true,
      approvalStatus: 'APPROVED'
    });
  } else if (testUser) {
    testUser.password = 'Password2026!';
    await testUser.save();
  }

  // Ensure test Intern engagement exists
  if (testUser && org) {
    let internDoc = await Intern.findOne({ userId: testUser._id });
    if (!internDoc) {
      await Intern.create({
        internId: 'INT-TEST-0001',
        userId: testUser._id,
        organizationId: org._id,
        departmentId: dept?._id || new mongoose.Types.ObjectId(),
        programId: prog?._id || new mongoose.Types.ObjectId(),
        startDate: new Date(Date.now() - 10 * 86400000),
        expectedEndDate: new Date(Date.now() + 80 * 86400000),
        status: 'ACTIVE',
        workMode: 'REMOTE',
        compensation: { type: 'UNPAID' }
      });
    }
  }

  // Ensure test Certificate exists for public verification
  let certDoc = await Certificate.findOne({ certificateId: 'CERT-2026-000001' });
  if (!certDoc && org) {
    await Certificate.create({
      certificateId: 'CERT-2026-000001',
      organizationId: org._id,
      internName: 'Kartik Iyer',
      programTitle: 'Web Development Internship',
      departmentName: dept?.name || 'Engineering',
      organizationName: org.name || 'TechMecha Torque',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      issueDate: '2026-04-01',
      status: 'ACTIVE'
    });
  }

  // Ensure test Opening exists for public listing
  const openingCount = await InternshipOpening.countDocuments({ status: 'OPEN' });
  if (openingCount === 0 && org) {
    await InternshipOpening.create({
      organizationId: org._id,
      departmentId: dept?._id,
      programId: prog?._id,
      title: 'Full Stack Engineer Intern',
      slug: 'full-stack-engineer-intern-test',
      description: 'Exciting Full Stack Engineering Internship opening.',
      status: 'OPEN',
      openings: 5,
      deadline: new Date(Date.now() + 30 * 86400000)
    });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('IMS Backend API & Lifecycle Test Suite', () => {
  test('1. Health Check GET /health returns ok and connected database', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
  });

  test('2. HR Admin Login POST /api/v1/auth/login succeeds', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'hr@techmecha.com',
        password: 'Password2026!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('HR_ADMIN');
    hrToken = res.body.data.token;
  });

  test('3. Intern Login POST /api/v1/auth/login succeeds', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test.intern@techmecha.com',
        password: 'Password2026!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('INTERN');
    internToken = res.body.data.token;
  });

  test('4. RBAC: Intern cannot access HR Applications management endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/recruitment/applications')
      .set('Authorization', `Bearer ${internToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('5. Public Openings GET /api/v1/recruitment/openings/public returns listings', async () => {
    const res = await request(app).get('/api/v1/recruitment/openings/public');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('6. Public Certificate Verification GET /api/v1/certificates/verify/:certId', async () => {
    const res = await request(app).get('/api/v1/certificates/verify/CERT-2026-000001');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isValid).toBe(true);
    expect(res.body.data.internName).toBe('Kartik Iyer');
    expect(res.body.data.certificateId).toBe('CERT-2026-000001');
  });

  test('7. Intern Dashboard Profile GET /api/v1/interns/me returns real workspace metrics', async () => {
    const res = await request(app)
      .get('/api/v1/interns/me')
      .set('Authorization', `Bearer ${internToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intern.internId).toBeDefined();
    expect(res.body.data.dashboard.dayNumber).toBeGreaterThan(0);
    expect(res.body.data.dashboard.tasks).toBeDefined();
    expect(res.body.data.dashboard.learning).toBeDefined();
  });

  test('8. HR Analytics Dashboard GET /api/v1/analytics/dashboard uses MongoDB aggregations', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recruitment).toBeDefined();
    expect(res.body.data.interns).toBeDefined();
    expect(res.body.data.tasks).toBeDefined();
  });

  test('9. Finance & Payments GET /api/v1/finance/payments returns stipend runs', async () => {
    const res = await request(app)
      .get('/api/v1/finance/payments')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.payments)).toBe(true);
  });

  test('10. Leave Management GET /api/v1/leaves returns time-off requests', async () => {
    const res = await request(app)
      .get('/api/v1/leaves')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('11. IT Assets GET /api/v1/assets returns equipment inventory', async () => {
    const res = await request(app)
      .get('/api/v1/assets')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('12. Document Template Engine GET /api/v1/templates returns seeded TMT letters', async () => {
    const res = await request(app)
      .get('/api/v1/templates')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('13. Exit Offboarding GET /api/v1/exits returns offboarding cases', async () => {
    const res = await request(app)
      .get('/api/v1/exits')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('14. Role Switch & Preview: Non-admin cannot switch roles arbitrarily', async () => {
    const res = await request(app)
      .post('/api/v1/auth/switch-role')
      .set('Authorization', `Bearer ${internToken}`)
      .send({ role: 'SUPER_ADMIN' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('15. Privilege Escalation Prevention: Non-admin passing x-preview-role header cannot escalate', async () => {
    const res = await request(app)
      .get('/api/v1/recruitment/applications')
      .set('Authorization', `Bearer ${internToken}`)
      .set('x-preview-role', 'SUPER_ADMIN');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('16. Google Integration Status: Returns real status without leaking tokens or fabricating connections', async () => {
    const res = await request(app)
      .get('/api/v1/integrations/google/status')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isConnected).toBe(false);
    expect(res.body.data.tokens).toBeUndefined();
  });

  test('17. Google Meet Protection: Rejects creating fake meetings when Google account is disconnected', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Real Integration Verification Meeting',
        meetingProvider: 'GOOGLE_MEET',
        scheduledDate: tomorrow,
        startTime: '14:00',
        endTime: '15:00',
        participants: []
      });

    // Must be 409 Conflict with actionable explanation rather than creating fake meet link
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/Google.*not connected|Google.*not configured/i);
  });
});

