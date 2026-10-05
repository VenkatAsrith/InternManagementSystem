const BASE_URL = 'http://localhost:5000/api/v1';

async function req(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(fullUrl, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return { status: res.status, data };
}

async function runVerification() {
  console.log('🚀 Starting Complete IMS Flow Verification (using Node fetch)...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.status} - ${JSON.stringify(err.data || err.message)}`);
      failed++;
    }
  }

  // 1. HR Admin Login
  let hrToken = '';
  await test('HR Admin Authentication', async () => {
    const res = await req('/auth/login', {
      method: 'POST',
      body: {
        email: 'hr@techmecha.com',
        password: 'Password2026!'
      }
    });
    if (!res.data?.data?.token) throw new Error('No token returned');
    hrToken = res.data.data.token;
  });

  const hrHeaders = { Authorization: `Bearer ${hrToken}` };

  // 2. Performance Flow
  let activeReviewId = '';
  await test('Performance Reviews: GET /performance/reviews', async () => {
    const res = await req('/performance/reviews', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected array of reviews');
    if (res.data.data.length > 0) {
      activeReviewId = res.data.data[0]._id;
    }
  });

  await test('Performance Root: GET /performance', async () => {
    const res = await req('/performance', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected array of reviews');
  });

  // 3. Finance Flow
  let pendingPaymentId = '';
  await test('Finance: GET /finance/payments', async () => {
    const res = await req('/finance/payments', { headers: hrHeaders });
    const payments = res.data.data.payments || res.data.data;
    if (!Array.isArray(payments)) throw new Error('Expected payments array');
    const pending = payments.find(p => p.status === 'PENDING');
    if (pending) pendingPaymentId = pending._id;
  });

  if (pendingPaymentId) {
    await test(`Finance: POST /finance/payments/${pendingPaymentId}/process by HR Admin`, async () => {
      const res = await req(`/finance/payments/${pendingPaymentId}/process`, {
        method: 'POST',
        headers: hrHeaders,
        body: {
          paymentMethod: 'BANK_TRANSFER',
          paymentReference: `VERIFY-TMT-${Date.now()}`,
          notes: 'Automated test disbursement'
        }
      });
      if (res.data.data.status !== 'PAID') throw new Error('Status not updated to PAID');
    });
  }

  // 4. Recruitment Pipeline
  await test('Recruitment: GET /recruitment/applications', async () => {
    const res = await req('/recruitment/applications', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected applications array');
  });

  await test('Recruitment: GET /recruitment/openings/public (Public ATS)', async () => {
    const res = await req('/recruitment/openings/public');
    if (!Array.isArray(res.data.data)) throw new Error('Expected public openings array');
  });

  // 5. Interviews
  await test('Interviews: GET /interviews', async () => {
    const res = await req('/interviews', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected interviews array');
  });

  // 6. Offers
  await test('Offers: GET /offers', async () => {
    const res = await req('/offers', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected offers array');
  });

  // 7. Onboarding
  await test('Onboarding: GET /onboarding', async () => {
    const res = await req('/onboarding', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected onboarding plans array');
  });

  // 8. Interns Directory
  let sampleInternId = '';
  await test('Interns: GET /interns?status=ACTIVE', async () => {
    const res = await req('/interns?status=ACTIVE', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected active interns array');
    if (res.data.data.length > 0) sampleInternId = res.data.data[0]._id;
  });

  if (sampleInternId) {
    await test(`Interns: GET /interns/${sampleInternId}/timeline`, async () => {
      const res = await req(`/interns/${sampleInternId}/timeline`, { headers: hrHeaders });
      if (!Array.isArray(res.data.data)) throw new Error('Expected timeline array');
    });
  }

  // 9. Tasks & Projects
  await test('Projects: GET /projects', async () => {
    const res = await req('/projects', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected projects array');
  });

  await test('Tasks: GET /tasks', async () => {
    const res = await req('/tasks', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected tasks array');
  });

  // 10. Leaves
  await test('Leaves: GET /leaves', async () => {
    const res = await req('/leaves', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected leaves array');
  });

  // 11. Assets
  await test('Assets: GET /assets', async () => {
    const res = await req('/assets', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected assets array');
  });

  // 12. Certificates & Readiness
  await test('Certificates: GET /certificates', async () => {
    const res = await req('/certificates', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected certificates array');
  });

  if (sampleInternId) {
    await test(`Certificates Readiness: GET /certificates/readiness/${sampleInternId}`, async () => {
      const res = await req(`/certificates/readiness/${sampleInternId}`, { headers: hrHeaders });
      if (!res.data.data) throw new Error('Expected readiness object');
    });
  }

  // 13. Exits & Offboarding
  await test('Exits: GET /exits', async () => {
    const res = await req('/exits', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected exits array');
  });

  // 14. Document Templates & Letter Library
  await test('Templates: GET /templates', async () => {
    const res = await req('/templates', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected templates array');
  });

  // 15. Audit Logs
  await test('Audit Logs: GET /audit-logs?limit=50', async () => {
    const res = await req('/audit-logs?limit=50', { headers: hrHeaders });
    if (!Array.isArray(res.data.data.logs || res.data.data)) throw new Error('Expected audit logs array');
  });

  // 16. Roles Center & Catalog
  await test('Roles: GET /roles', async () => {
    const res = await req('/roles', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected roles array');
  });

  await test('Roles Catalog: GET /roles/catalog/permissions', async () => {
    const res = await req('/roles/catalog/permissions', { headers: hrHeaders });
    if (!res.data.data?.groups || !Array.isArray(res.data.data.groups)) {
      throw new Error('Expected permissions catalog groups array');
    }
  });

  // 17. Settings & Organization
  await test('Settings: GET /organizations/current', async () => {
    const res = await req('/organizations/current', { headers: hrHeaders });
    if (!res.data.data?.name) throw new Error('Expected organization data');
  });

  await test('Settings: GET /organizations/departments', async () => {
    const res = await req('/organizations/departments', { headers: hrHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected departments array');
  });

  // 18. Intern Self-Service Flow
  let internToken = '';
  await test('Intern Authentication', async () => {
    const res = await req('/auth/login', {
      method: 'POST',
      body: {
        email: 'arjun.sharma@example.com',
        password: 'Password2026!'
      }
    });
    internToken = res.data.data.token;
  });

  const internHeaders = { Authorization: `Bearer ${internToken}` };

  await test('Intern Profile: GET /interns/me', async () => {
    const res = await req('/interns/me', { headers: internHeaders });
    if (!res.data.data?.intern) throw new Error('Expected intern profile');
  });

  await test('Intern Performance: GET /performance/reviews', async () => {
    const res = await req('/performance/reviews', { headers: internHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected reviews array for intern');
  });

  await test('Intern Finance: GET /finance/me', async () => {
    const res = await req('/finance/me', { headers: internHeaders });
    if (res.data.data?.totalEarned === undefined) throw new Error('Expected intern financial summary with totalEarned');
  });

  await test('Intern Attendance: GET /attendance/today', async () => {
    const res = await req('/attendance/today', { headers: internHeaders });
    if (res.data?.success !== true) throw new Error('Expected success response for attendance');
  });

  await test('Intern Leaves: GET /leaves/me', async () => {
    const res = await req('/leaves/me', { headers: internHeaders });
    if (!Array.isArray(res.data.data)) throw new Error('Expected leaves array');
  });

  // Summary
  console.log('\n========================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL IMS FLOWS OPERATING WITH 100% SUCCESS!');
  }
}

runVerification();
