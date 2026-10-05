import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { env } from '../src/config/env.js';

let hrToken = '';
let internToken = '';

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
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
        email: 'arjun.sharma@example.com',
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
    expect(res.body.data.recruitment.funnel.length).toBeGreaterThan(0);
    expect(res.body.data.interns.total).toBeGreaterThan(0);
    expect(res.body.data.tasks.total).toBeGreaterThan(0);
  });

  test('9. Finance & Payments GET /api/v1/finance/payments returns stipend runs', async () => {
    const res = await request(app)
      .get('/api/v1/finance/payments')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.payments)).toBe(true);
    expect(res.body.data.payments.length).toBeGreaterThan(0);
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
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('12. Document Template Engine GET /api/v1/templates returns seeded TMT letters', async () => {
    const res = await request(app)
      .get('/api/v1/templates')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('13. Exit Offboarding GET /api/v1/exits returns offboarding cases', async () => {
    const res = await request(app)
      .get('/api/v1/exits')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
