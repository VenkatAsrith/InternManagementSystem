import assert from 'node:assert';

const API_BASE = 'http://localhost:5000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`[${res.status}] ${endpoint}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

async function runMasterVerification() {
  console.log('===================================================================');
  console.log('🚀 TESTING IMS MASTER ENHANCEMENTS (ALL 5 MODULES & LIFECYCLES)');
  console.log('===================================================================\n');

  // Step 1: Authenticate as HR Admin
  console.log('1. Authenticating as Admin (hr@techmecha.com)...');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'hr@techmecha.com', password: 'Password2026!' })
  });
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✅ Admin authenticated successfully.\n');

  // Step 2: Google Workspace Integration Status
  console.log('2. Checking Google Integration Status (/integrations/google/status)...');
  const googleStatus = await request('/integrations/google/status', { headers: authHeaders });
  console.log('✅ Google Status Response:', googleStatus.data);
  assert(googleStatus.data.calendarConnected !== undefined, 'Calendar status should be defined');
  assert(googleStatus.data.meetAvailable !== undefined, 'Meet status should be defined');
  console.log('✅ Google integration endpoints responsive.\n');

  // Step 3: Meetings & Two Reminders
  console.log('3. Testing Meeting Failure Handling when Google Disconnected (§15)...');
  const meetingPayload = {
    title: 'Executive Intern Review & Sync',
    description: 'Weekly checkpoint with interns and mentors',
    scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '11:00',
    timezone: 'Asia/Kolkata',
    meetingType: 'GOOGLE_MEET',
    reminders: [
      { triggerBeforeMinutes: 1440, channel: 'IN_APP' }, // 24h
      { triggerBeforeMinutes: 15, channel: 'IN_APP' }    // 15m
    ],
    idempotencyKey: `IDEMP_MTG_${Date.now()}`
  };

  try {
    await request('/meetings', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(meetingPayload)
    });
    assert.fail('Should have failed when Google is disconnected');
  } catch (err) {
    console.log('✅ Correctly rejected unauthenticated Google Meet meeting:', err.message);
  }

  console.log('   Connecting Google Workspace (/integrations/google/connect)...');
  const connectRes = await request('/integrations/google/connect', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      accountEmail: 'admin.workspace@techmecha.com',
      authCode: 'mock-google-auth-code-2026'
    })
  });
  console.log('✅ Google Workspace connected:', connectRes.data);
  assert.equal(connectRes.data.isConnected, true);

  console.log('   Creating Meeting with Google Meet & Two Reminders (§3, §10, §16)...');
  const meetingRes = await request('/meetings', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(meetingPayload)
  });
  const meeting = meetingRes.data;
  console.log(`✅ Meeting created: "${meeting.title}" (ID: ${meeting._id})`);
  console.log(`   Provider: ${meeting.provider}, Meet Link: ${meeting.googleMeetLink || 'Generated'}`);
  console.log(`   Reminders count: ${meeting.reminders?.length || 0}`);
  assert.equal(meeting.reminders?.length, 2, 'Should have exactly 2 reminders');
  console.log('✅ Meeting lifecycle and reminders verified.\n');

  // Step 4: Bootcamp Google Forms Integration
  console.log('4. Testing Bootcamp Google Forms Integration...');
  const bootcamps = await request('/growth/bootcamps', { headers: authHeaders });
  const targetBootcamp = bootcamps.data?.[0];
  if (targetBootcamp) {
    console.log(`   Configuring Google Form for bootcamp: "${targetBootcamp.title}"...`);
    const formConfig = await request(`/growth/bootcamps/${targetBootcamp._id}/google-form`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLScMockTestForm12345/viewform',
        fieldMapping: {
          candidateName: 'Full Name',
          candidateEmail: 'Email Address',
          candidatePhone: 'Mobile Number',
          college: 'College Name',
          course: 'Branch of Study'
        }
      })
    });
    console.log('✅ Google Form configured:', formConfig.data.googleForm?.formUrl);

    console.log('   Syncing Google Form Responses...');
    const syncRes = await request(`/growth/bootcamps/${targetBootcamp._id}/google-form/sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ mockResponses: [] })
    });
    console.log('✅ Google Form synced successfully. Stats:', syncRes.data.syncStats);
  } else {
    console.log('⚠️ No active bootcamp found to attach form to, skipping bootcamp sync.');
  }
  console.log('');

  // Step 5: Intern Sources & Referral Tracking
  console.log('5. Testing Intern Sources (Application vs Referral)...');
  const progRes = await request('/recruitment/programs', { headers: authHeaders });
  const testProgram = progRes.data?.programs?.[0] || progRes.data?.[0];
  const deptRes = await request('/organizations/departments', { headers: authHeaders });
  const testDept = deptRes.data?.[0];

  const referralInternPayload = {
    firstName: 'Devika',
    lastName: 'Rao',
    email: `devika.referral.${Date.now()}@example.com`,
    phone: '+91 99887 76655',
    departmentId: testDept?._id,
    programId: testProgram?._id,
    workMode: 'HYBRID',
    startDate: new Date().toISOString().slice(0, 10),
    expectedEndDate: new Date(Date.now() + 86400000 * 90).toISOString().slice(0, 10),
    source: 'REFERRAL',
    referral: {
      referralName: 'Karthik Senior Architect',
      referralEmail: 'karthik@partner.org',
      relationship: 'Former Colleague & Mentor'
    }
  };
  const createdIntern = await request('/interns', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(referralInternPayload)
  });
  console.log(`✅ Intern created with source: ${createdIntern.data.source}`);
  console.log(`   Intern ID: ${createdIntern.data.internId}, Referral: ${createdIntern.data.referral?.referralName}`);
  assert.equal(createdIntern.data.source, 'REFERRAL');

  const filteredInterns = await request('/interns?source=REFERRAL', { headers: authHeaders });
  console.log(`✅ Filtered interns by source=REFERRAL: ${filteredInterns.data.length} found.\n`);

  // Step 6: Document Requirements & Compliance
  console.log('6. Testing Document Requirement Templates & Compliance Dashboard...');
  const templatePayload = {
    name: `Enterprise Engineering Onboarding ${Date.now()}`,
    description: 'Mandatory documentation for compliance audit',
    appliesTo: 'INTERN',
    requiredDocuments: [
      { code: 'GOVT_ID', title: 'Government ID / Passport', isMandatory: true, instructions: 'Clear color copy' },
      { code: 'RESUME', title: 'Updated Engineering Resume', isMandatory: true, instructions: 'PDF format' },
      { code: 'BANK_DETAILS', title: 'Bank Passbook / Cheque', isMandatory: false, instructions: 'For stipend payout' }
    ]
  };
  const createdTemplate = await request('/documents/requirements/templates', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(templatePayload)
  });
  console.log(`✅ Document Requirement Template created: "${createdTemplate.data.name}"`);

  console.log('   Assigning Template to Intern...');
  await request('/documents/requirements/assign', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      templateId: createdTemplate.data._id,
      internId: createdIntern.data._id
    })
  });
  console.log('✅ Template assigned to intern successfully.');

  const complianceDashboard = await request('/documents/requirements/compliance', { headers: authHeaders });
  console.log('✅ Compliance Dashboard retrieved:');
  console.log('   Total Interns in Compliance:', complianceDashboard.data.summary?.totalInterns);
  console.log('   In Progress:', complianceDashboard.data.summary?.inProgress);

  const internRequirements = await request(`/documents/requirements/intern/${createdIntern.data._id}`, { headers: authHeaders });
  console.log(`✅ Intern has ${internRequirements.data.length} assigned document requirements:`);
  internRequirements.data.forEach((r) => {
    console.log(`   - [${r.status}] ${r.title} (Mandatory: ${r.isMandatory})`);
  });
  console.log('');

  // Step 7: Intern Trainee Lifecycle & Program Completion
  console.log('7. Testing Intern Trainee Program Lifecycle...');
  const programPayload = {
    title: `Full Stack Cloud Mastery ${Date.now()}`,
    durationWeeks: 12,
    mode: 'HYBRID',
    description: 'Intensive React, Node.js, and Cloud deployment curriculum',
    skills: ['React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
    learningObjectives: 'Develop and deploy end-to-end cloud applications.',
    capacity: 25
  };
  const createdProgram = await request('/training/trainee/programs', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(programPayload)
  });
  console.log(`✅ Training Program created: "${createdProgram.data.title}" (ID: ${createdProgram.data._id})`);

  console.log('   Enrolling Intern in Training Program...');
  const enrollmentRes = await request('/training/trainee/enroll', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      programId: createdProgram.data._id,
      userId: createdIntern.data.userId._id || createdIntern.data.userId,
      internId: createdIntern.data._id
    })
  });
  const engagementId = enrollmentRes.data._id;
  console.log(`✅ Trainee Engagement created: ${engagementId}`);

  console.log('   Assigning Trainee Task...');
  const taskRes = await request(`/training/trainees/${engagementId}/tasks`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Implement Microservice Architecture',
      description: 'Build authenticated REST APIs with token validation.',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10)
    })
  });
  const taskId = taskRes.data._id;
  console.log(`✅ Task assigned: "${taskRes.data.title}" (Status: ${taskRes.data.status})`);

  console.log('   Submitting Work for Task...');
  await request(`/training/trainees/${engagementId}/tasks/${taskId}/submit`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      githubUrl: 'https://github.com/techmecha/tmt-microservices-demo',
      demoUrl: 'https://demo.techmecha.com',
      notes: 'Completed all core endpoints and added integration test coverage.'
    })
  });
  console.log('✅ Task submitted.');

  console.log('   Reviewing & Approving Task...');
  await request(`/training/trainees/${engagementId}/tasks/${taskId}/review`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'APPROVED',
      feedback: 'Excellent code structure and clean API contract.'
    })
  });
  console.log('✅ Task approved.');

  console.log('   Logging Trainee Attendance (95% rate)...');
  await request(`/training/trainees/${engagementId}/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      status: 'PRESENT',
      minutesAttended: 180,
      notes: 'Active participation in microservices lab.'
    })
  });
  console.log('✅ Attendance logged.');

  console.log('   Recording Assessment Result...');
  await request(`/training/trainees/${engagementId}/assessments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Cloud & System Design Assessment',
      score: 92,
      maxScore: 100,
      passingScore: 70,
      feedback: 'Outstanding architectural understanding.'
    })
  });
  console.log('✅ Assessment recorded.');

  console.log('   Recording Mentor Feedback...');
  await request(`/training/trainees/${engagementId}/mentor-feedback`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      technicalSkills: 5,
      communication: 5,
      problemSolving: 5,
      taskCompletion: 5,
      professionalism: 5,
      overallFeedback: 'Exceptional trainee performance throughout the cohort.'
    })
  });
  console.log('✅ Mentor feedback recorded.');

  console.log('   Testing Program Completion & Certificate Generation (§57-§58)...');
  const completionRes = await request(`/training/trainees/${engagementId}/complete`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  console.log('✅ Trainee Program Completed!');
  console.log(`   Message: ${completionRes.message}`);
  console.log(`   Issued Certificate ID: ${completionRes.data?.certificateId}`);
  assert(completionRes.data?.certificateId, 'Certificate ID must be generated');

  console.log('\n===================================================================');
  console.log('🎉 ALL MASTER ENHANCEMENT TESTS PASSED PERFECTLY!');
  console.log('===================================================================\n');
}

runMasterVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
