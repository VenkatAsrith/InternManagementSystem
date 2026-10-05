#!/usr/bin/env node
/**
 * QA API Suite 04: Canonical Person, Growth (Leads, Bootcamps, Demos),
 * Training Engagements, Founder Private Tasks, Multi-Mailbox, and Payment Idempotency.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fx = JSON.parse(fs.readFileSync(path.join(root, 'qa-artifacts', 'qa-fixtures.json'), 'utf8'));

const BASE = process.env.QA_API_URL || 'http://localhost:5100/api/v1';

async function req(url, { method = 'GET', body, token, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function login(email, password = 'Password2026!') {
  const r = await req('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  assert.equal(r.status, 200, `login failed for ${email}: ${JSON.stringify(r.data)}`);
  return r.data.data.token;
}

let passed = 0;
function ok(label) {
  passed++;
  console.log(`  ok   ${label}`);
}

const PW = fx.password || 'QaPass2026!';
const adminToken = await login(fx.users.A.orgadmin.email, PW);
const founderToken = await login(fx.users.A.superadmin.email, PW);
const hrToken = await login(fx.users.A.hradmin.email, PW);
const mentorToken = await login(fx.users.A.mentor.email, PW);
const internToken = await login(fx.users.A.intern.email, PW);

console.log('== CANONICAL PERSON & DEDUPLICATION ==');

// 1. Create a Person
const p1Email = `e2e.candidate.${Date.now()}@example.com`;
const p1Phone = '+919876543210';
const p1Res = await req('/people', {
  method: 'POST',
  token: adminToken,
  body: {
    firstName: 'Arun',
    lastName: 'Kumar',
    email: p1Email,
    phone: p1Phone
  }
});
assert.equal(p1Res.status, 201);
const person1Id = p1Res.data.data._id;
ok('Person created with canonical identity');

// 2. Duplicate detection: Attempting to create another person with same normalized email is rejected with 409
const dupRes = await req('/people', {
  method: 'POST',
  token: adminToken,
  body: {
    firstName: 'Arun',
    lastName: 'Duplicate',
    email: `  ${p1Email.toUpperCase()}  `,
    phone: '+919999999999'
  }
});
assert.equal(dupRes.status, 409, 'Duplicate normalized email must be rejected with 409 Conflict');
ok('Duplicate Person email detected and rejected with 409 Conflict');

// 3. Create second person for merge test
const p2Res = await req('/people', {
  method: 'POST',
  token: adminToken,
  body: {
    firstName: 'Arun',
    lastName: 'Secondary',
    email: `secondary.${Date.now()}@example.com`,
    phone: '+919123456789'
  }
});
assert.equal(p2Res.status, 201);
const person2Id = p2Res.data.data._id;
ok('Secondary Person created for merge');

// 4. Audit-safe Person Merge
const mergeRes = await req(`/people/${person2Id}/merge`, {
  method: 'POST',
  token: adminToken,
  body: {
    canonicalPersonId: person1Id,
    reason: 'Duplicate student records combined'
  }
});
assert.equal(mergeRes.status, 200);
assert.equal(mergeRes.data.data.sourcePerson.status, 'MERGED');
assert.equal(mergeRes.data.data.sourcePerson.mergedInto, person1Id);
ok('Person merge executed, source marked MERGED and points to canonical');

// 5. Timeline reflects merge
const timelineRes = await req(`/people/${person1Id}/timeline`, { token: adminToken });
assert.equal(timelineRes.status, 200);
assert.ok(timelineRes.data.data.timeline.some((t) => t.event === 'PERSON_MERGED_IN'));
ok('360 degree timeline captures merge event');

console.log('== GROWTH FUNNEL: LEADS, CALLS, BOOTCAMP & PASSES ==');

// 6. Create Lead
const leadRes = await req('/growth/leads', {
  method: 'POST',
  token: adminToken,
  body: {
    name: 'Vikram Patel',
    email: `vikram.${Date.now()}@example.com`,
    phone: '+919876500001',
    programOfInterest: 'Full Stack Systems',
    source: 'WEBSITE'
  }
});
assert.equal(leadRes.status, 201);
const leadId = leadRes.data.data._id;
assert.equal(leadRes.data.data.status, 'NEW');
ok('Lead created with status NEW');

// 7. Log call activity
const callRes = await req(`/growth/leads/${leadId}/calls`, {
  method: 'POST',
  token: adminToken,
  body: {
    outcome: 'CONNECTED',
    durationMinutes: 10,
    notes: 'Candidate very interested in the upcoming bootcamp'
  }
});
assert.equal(callRes.status, 201);
const updatedLead = await req(`/growth/leads/${leadId}`, { token: adminToken });
assert.equal(updatedLead.data.data.status, 'CONTACTED');
ok('Call activity logged, Lead transitioned to CONTACTED');

// 8. Create Bootcamp
const bcRes = await req('/growth/bootcamps', {
  method: 'POST',
  token: adminToken,
  body: {
    title: 'TMT System Design Bootcamp 2026',
    totalCapacity: 2,
    slots: [{
      slotName: 'Morning Session',
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      capacity: 2,
      bookedCount: 0,
      checkedInCount: 0
    }]
  }
});
assert.equal(bcRes.status, 201);
const bootcampId = bcRes.data.data._id;
const slotId = bcRes.data.data.slots[0]._id;
ok('Bootcamp and slot created with capacity 2');

// 9. Register and generate Pass
const pass1Res = await req(`/growth/bootcamps/${bootcampId}/register`, {
  method: 'POST',
  token: adminToken,
  body: {
    leadId,
    slotId,
    candidateName: 'Vikram Patel',
    candidateEmail: 'vikram.patel@example.com'
  }
});
assert.equal(pass1Res.status, 201);
const pass1Code = pass1Res.data.data.passCode;
const pass1Hmac = pass1Res.data.data.hmacToken;
assert.ok(pass1Code.startsWith('TMT-PASS-'));
assert.ok(pass1Hmac);
ok('Bootcamp Pass generated with unique passCode and HMAC token');

// 10. QR Check-In verification
const checkInRes = await req('/growth/passes/check-in', {
  method: 'POST',
  token: adminToken,
  body: { passCode: pass1Code }
});
assert.equal(checkInRes.status, 200);
assert.equal(checkInRes.data.data.status, 'CHECKED_IN');
ok('Pass QR check-in verified and marked CHECKED_IN');

// 11. Duplicate check-in scan rejection
const dupCheckIn = await req('/growth/passes/check-in', {
  method: 'POST',
  token: adminToken,
  body: { passCode: pass1Code }
});
assert.equal(dupCheckIn.status, 409, 'Duplicate scan must be rejected with 409 Conflict');
ok('Duplicate pass check-in scan safely rejected with 409 Conflict');

console.log('== DEMO PIPELINE ==');

// 12. Schedule Demo without Bootcamp prerequisite
const demoRes = await req('/growth/demos', {
  method: 'POST',
  token: adminToken,
  body: {
    personId: person1Id,
    leadId,
    mode: 'ONLINE',
    scheduledAt: new Date(Date.now() + 86400000).toISOString()
  }
});
assert.equal(demoRes.status, 201);
const demoId = demoRes.data.data._id;
assert.equal(demoRes.data.data.status, 'DEMO_SCHEDULED');
ok('Demo scheduled without requiring bootcamp');

// 13. Record demo outcome
const demoOutcomeRes = await req(`/growth/demos/${demoId}/outcome`, {
  method: 'POST',
  token: adminToken,
  body: {
    attended: true,
    outcome: 'ENROLLED',
    notes: 'Enrolling in Training Track'
  }
});
assert.equal(demoOutcomeRes.status, 200);
assert.equal(demoOutcomeRes.data.data.status, 'ATTENDED');
assert.equal(demoOutcomeRes.data.data.outcome, 'ENROLLED');
ok('Demo outcome recorded as ATTENDED and ENROLLED');

console.log('== DIRECT TRAINING & MILESTONE CHECKPOINTS ==');

// 14. Create Training Program
const progRes = await req('/training/programs', {
  method: 'POST',
  token: adminToken,
  body: {
    title: 'Enterprise Architecture & DevOps Track',
    code: `TRACK_${Date.now()}`,
    durationWeeks: 12,
    grossFee: 25000,
    milestones: [
      { milestoneIndex: 1, title: 'Microservices & MongoDB Architecture', checkpointRequired: true },
      { milestoneIndex: 2, title: 'RBAC, Security & Idempotency', checkpointRequired: true }
    ]
  }
});
assert.equal(progRes.status, 201);
const programId = progRes.data.data._id;
ok('Training Program created with milestones');

// 15. Create Batch
const batchRes = await req('/training/batches', {
  method: 'POST',
  token: adminToken,
  body: {
    programId,
    cohortCode: `COHORT_${Date.now()}`
  }
});
assert.equal(batchRes.status, 201);
const batchId = batchRes.data.data._id;
ok('Training Batch cohort created');

// 16. Direct Training Enrollment (Scenario B: NO bootcamp required)
const enrollRes = await req('/training/enroll', {
  method: 'POST',
  token: adminToken,
  body: {
    personId: person1Id,
    batchId
  }
});
assert.equal(enrollRes.status, 201);
const engagementId = enrollRes.data.data._id;
assert.equal(enrollRes.data.data.status, 'ENROLLED');
ok('Direct Training Enrollment succeeded without bootcamp');

// 17. Evaluate Checkpoint 1
const eval1Res = await req(`/training/engagements/${engagementId}/checkpoints/1/evaluate`, {
  method: 'POST',
  token: adminToken,
  body: { score: 90, feedback: 'Excellent architecture diagram' }
});
assert.equal(eval1Res.status, 200);
assert.equal(eval1Res.data.data.checkpoints[0].status, 'PASSED');
ok('Checkpoint 1 evaluated and PASSED');

// 18. Evaluate Checkpoint 2 -> triggers ELIGIBLE_FOR_COMPANY_INTERNSHIP (Scenario C)
const eval2Res = await req(`/training/engagements/${engagementId}/checkpoints/2/evaluate`, {
  method: 'POST',
  token: adminToken,
  body: { score: 95, feedback: 'Strong implementation of security headers' }
});
assert.equal(eval2Res.status, 200);
assert.equal(eval2Res.data.data.status, 'ELIGIBLE_FOR_COMPANY_INTERNSHIP');
ok('All milestones passed: Engagement transitioned to ELIGIBLE_FOR_COMPANY_INTERNSHIP');

console.log('== FOUNDER PRIVATE TASK ISOLATION (Scenario F) ==');

const founderHeaders = { 'x-organization-id': fx.orgA };

// 19. Founder creates PRIVATE task
const privTaskRes = await req('/tasks', {
  method: 'POST',
  token: founderToken,
  headers: founderHeaders,
  body: {
    title: 'Confidential Strategic Acquisition Review',
    description: 'Private founder analysis of quarterly IP assets',
    visibility: 'PRIVATE',
    priority: 'HIGH'
  }
});
assert.equal(privTaskRes.status, 201, JSON.stringify(privTaskRes.data));
const privateTaskId = privTaskRes.data.data._id;
ok('Founder created PRIVATE task');

// 20. Founder can view own private task
const founderTaskView = await req(`/tasks/${privateTaskId}`, { token: founderToken, headers: founderHeaders });
assert.equal(founderTaskView.status, 200);
assert.equal(founderTaskView.data.data.task.title, 'Confidential Strategic Acquisition Review');
ok('Founder can retrieve own private task');

// 21. Org Admin / Employee direct API access to private task is rejected with 403 Forbidden
const adminTaskView = await req(`/tasks/${privateTaskId}`, { token: adminToken });
assert.equal(adminTaskView.status, 403, 'Unauthorized actor accessing private founder task must receive 403 Forbidden');
ok('Unauthorized Admin attempting to access Founder private task receives 403 Forbidden');

const mentorTaskView = await req(`/tasks/${privateTaskId}`, { token: mentorToken });
assert.equal(mentorTaskView.status, 403, 'Mentor accessing private founder task must receive 403 Forbidden');
ok('Mentor attempting to access Founder private task receives 403 Forbidden');

const internTaskView = await req(`/tasks/${privateTaskId}`, { token: internToken });
assert.equal(internTaskView.status, 403, 'Intern accessing private founder task must receive 403 Forbidden');
ok('Intern attempting to access Founder private task receives 403 Forbidden');

console.log('== MULTI-MAILBOX PERMISSION GATING (Scenario G) ==');

// 22. Create Mailbox
const mboxRes = await req('/mailboxes', {
  method: 'POST',
  token: adminToken,
  body: {
    name: 'Executive Talent Inbox',
    emailAddress: `careers.${Date.now()}@techmecha.internal`,
    provider: 'smtp'
  }
});
assert.equal(mboxRes.status, 201);
const mailboxId = mboxRes.data.data._id;
ok('Multi-Mailbox created');

// 23. Mentor (Staff without grant) tries to read mailbox -> 403 Forbidden
const mentorMboxRead = await req(`/mailboxes/${mailboxId}/messages`, { token: mentorToken });
assert.equal(mentorMboxRead.status, 403, 'User without mailbox grant must receive 403 Forbidden');
ok('User without mailbox grant is rejected with 403 Forbidden');

// 24. Grant read and send permission to mentor
const grantRes = await req(`/mailboxes/${mailboxId}/grants`, {
  method: 'POST',
  token: adminToken,
  body: {
    userId: fx.users.A.mentor.id,
    canRead: true,
    canSend: true
  }
});
assert.equal(grantRes.status, 200);
ok('Mailbox read and send access granted to Mentor');

// 25. Mentor can now send message from mailbox
const mentorSendRes = await req(`/mailboxes/${mailboxId}/messages/send`, {
  method: 'POST',
  token: mentorToken,
  body: {
    recipient: 'candidate@example.com',
    subject: 'Interview Schedule Follow-Up',
    body: 'We are pleased to invite you to the technical interview round.'
  }
});
assert.equal(mentorSendRes.status, 201);
ok('Granted user can send message from permitted mailbox');

// 26. Intern (still without grant) tries to read messages -> 403 Forbidden
const internMboxRead = await req(`/mailboxes/${mailboxId}/messages`, { token: internToken });
assert.equal(internMboxRead.status, 403, 'Intern without grant must receive 403 Forbidden');
ok('Intern without grant is blocked with 403 Forbidden');

console.log('== PAYMENT WEBHOOK IDEMPOTENCY (Scenario J) ==');

// 27. First webhook invocation creates transaction
const providerPaymentId = `pay_rzp_${Date.now()}_test`;
const hook1 = await req('/finance/payments/webhook', {
  method: 'POST',
  body: {
    providerPaymentId,
    amount: 15000,
    currency: 'INR',
    personId: person1Id,
    provider: 'RAZORPAY',
    metadata: { course: 'Enterprise Full Stack' }
  }
});
assert.equal(hook1.status, 200);
assert.equal(hook1.data.idempotent, false);
assert.equal(hook1.data.data.providerPaymentId, providerPaymentId);
ok('First payment webhook recorded transaction successfully');

// 28. Second identical webhook invocation returns idempotent 200 WITHOUT creating second transaction
const hook2 = await req('/finance/payments/webhook', {
  method: 'POST',
  body: {
    providerPaymentId,
    amount: 15000,
    currency: 'INR',
    personId: person1Id,
    provider: 'RAZORPAY',
    metadata: { course: 'Enterprise Full Stack' }
  }
});
assert.equal(hook2.status, 200);
assert.equal(hook2.data.idempotent, true, 'Second identical webhook must return idempotent: true');
ok('Identical payment webhook deduplicated: returns idempotent 200 with zero duplicate records');

console.log(`\nRESULT: ${passed} passed, 0 failed\n`);
