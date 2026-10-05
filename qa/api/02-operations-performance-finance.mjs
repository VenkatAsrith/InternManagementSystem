import fs from 'node:fs';
const BASE = (process.env.QA_API_URL || 'http://localhost:5100') + '/api/v1';
import { fileURLToPath as __f2p } from 'node:url';
const ART = __f2p(new URL('../../qa-artifacts/', import.meta.url));
const PW = 'QaPass2026!';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };
async function api(method, path, { token, body, form, headers = {} } = {}) {
  const h = { ...headers }; if (token) h.Authorization = `Bearer ${token}`;
  let payload; if (form) payload = form; else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  const ct = res.headers.get('content-type') || '';
  let json = null, raw = null;
  if (ct.includes('json')) { try { json = await res.json(); } catch {} } else { raw = Buffer.from(await res.arrayBuffer()); }
  return { status: res.status, json, data: json?.data, err: json?.error, raw, ct };
}
const login = async (email, pw = PW) => { const r = await api('POST', '/auth/login', { body: { email, password: pw } }); if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.json)}`); return r.data.token; };
const E = (k) => `qa.${k}@tmt-qa.test`;
const F = JSON.parse(fs.readFileSync(ART + 'qa-fixtures.json', 'utf8'));
const G = JSON.parse(fs.readFileSync(ART + 'golden-state.json', 'utf8'));
const pdf = () => new Blob(['%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'], { type: 'application/pdf' });
const today = () => new Date().toISOString().slice(0, 10);

const hr = await login(E('hradmin')), mentor = await login(E('mentor')), finance = await login(E('finance')), docadmin = await login(E('documentadmin'));
const orgadmin = await login(E('orgadmin')), lead = await login(E('lead')), financeviewer = await login(E('financeviewer'));
const gi = await login(G.goldenEmail, G.password);
const internId = G.internDbId;

console.log('== ONBOARDING ==');
let r = await api('GET', '/onboarding/my-plan', { token: gi });
ok('intern sees own plan with 10 tasks', r.status === 200 && r.data.tasks.length === 10, JSON.stringify(r.json)?.slice(0, 200));
const tasks = r.data.tasks; const byKey = Object.fromEntries(tasks.map(t => [t.key, t]));
r = await api('PATCH', `/onboarding/tasks/${byKey.ORIENTATION._id}`, { token: gi, body: { status: 'COMPLETED' } }); ok('intern cannot complete an HR task', r.status === 403);
r = await api('PATCH', `/onboarding/tasks/${byKey.GOV_ID._id}`, { token: gi, body: { status: 'COMPLETED' } }); ok('intern cannot tick a document task by hand', r.status === 403 || r.status === 409);
r = await api('GET', '/onboarding', { token: gi }); ok('intern cannot list all plans', r.status === 403);
const upload = async (key, type, tok = gi, name = 'doc.pdf', blob = pdf()) => { const f = new FormData(); f.append('type', type); f.append('onboardingTaskId', byKey[key]._id); f.append('file', blob, name); return api('POST', '/documents/upload', { token: tok, form: f }); };
r = await upload('GOV_ID', 'AGREEMENT'); ok('wrong document type for task rejected', r.status === 422);
r = await upload('GOV_ID', 'ID_PROOF', gi, 'x.exe', new Blob(['MZ....'], { type: 'application/pdf' })); ok('exe disguised as pdf rejected', r.status === 415);
const docIds = {};
for (const [key, type] of [['GOV_ID', 'ID_PROOF'], ['COLLEGE_ID', 'COLLEGE_ID'], ['TRANSCRIPTS', 'OTHER'], ['AGREEMENT', 'AGREEMENT'], ['NDA', 'NDA']]) {
  r = await upload(key, type); ok(`upload ${key}`, r.status === 201, JSON.stringify(r.json)); docIds[key] = r.data?._id;
}
r = await api('GET', `/interns/${internId}`, { token: hr }); ok('intern is ONBOARDING after first upload', r.data.intern.status === 'ONBOARDING', r.data.intern.status);
r = await api('GET', `/documents/${docIds.GOV_ID}/download`, { token: mentor }); ok('mentor cannot download ID proof (no documents.read)', r.status === 403 || r.status === 404, r.status);
r = await api('GET', `/documents/${docIds.GOV_ID}/download`, { token: (await login(E('intern'))) }); ok('another intern cannot download it', r.status === 404, r.status);
r = await api('GET', `/documents/${docIds.GOV_ID}/download`, { token: hr }); ok('HR can download; PDF content-type', r.status === 200 && r.ct.includes('pdf'));
r = await api('POST', `/documents/${docIds.GOV_ID}/approve`, { token: gi, body: {} }); ok('intern cannot approve their own doc', r.status === 403);
// replacement creates version 2 and archives version 1
r = await upload('TRANSCRIPTS', 'OTHER'); ok('replacement upload = version 2', r.status === 201 && r.data.version === 2); docIds.TRANSCRIPTS = r.data._id;
r = await api('POST', `/documents/${docIds.NDA}/reject`, { token: hr, body: { rejectionReason: 'Signature missing' } }); ok('HR rejects NDA with reason', r.status === 200);
r = await api('GET', '/onboarding/my-plan', { token: gi }); ok('rejected doc puts task back to PENDING with note', r.data.tasks.find(t => t.key === 'NDA').status === 'PENDING' && r.data.tasks.find(t => t.key === 'NDA').notes.includes('Signature'));
r = await upload('NDA', 'NDA'); docIds.NDA = r.data._id;
for (const k of Object.keys(docIds)) { r = await api('POST', `/documents/${docIds[k]}/approve`, { token: hr, body: {} }); ok(`HR approves ${k}`, r.status === 200, JSON.stringify(r.json)); }
r = await api('POST', `/documents/${docIds.NDA}/approve`, { token: hr, body: {} }); ok('double approve rejected', r.status === 409);
r = await api('PATCH', `/onboarding/tasks/${byKey.PROFILE._id}`, { token: gi, body: { status: 'COMPLETED' } }); ok('intern completes own PROFILE task', r.status === 200);
r = await api('GET', `/interns/${internId}`, { token: hr }); ok('still ONBOARDING (HR tasks open)', r.data.intern.status === 'ONBOARDING');
for (const k of ['ORIENTATION', 'ACCESS', 'MENTOR_1ON1', 'FIRST_TASK']) { r = await api('PATCH', `/onboarding/tasks/${byKey[k]._id}`, { token: hr, body: { status: 'COMPLETED' } }); ok(`HR completes ${k}`, r.status === 200); }
ok('last required task activates the intern', r.data.internStatus === 'ACTIVE' && r.data.planProgress === 100, JSON.stringify(r.data));
r = await api('PATCH', `/onboarding/tasks/${byKey.ORIENTATION._id}`, { token: hr, body: { status: 'PENDING' } }); ok('onboarding locked once ACTIVE', r.status === 409);

console.log('== ATTENDANCE ==');
r = await api('POST', '/attendance/check-in', { token: gi, body: { mode: 'TELEPORT' } }); ok('invalid work mode rejected', r.status === 422);
r = await api('POST', '/attendance/check-out', { token: gi }); ok('checkout before check-in rejected', r.status === 409 && r.err.code === 'NOT_CHECKED_IN');
const [ci1, ci2] = await Promise.all([api('POST', '/attendance/check-in', { token: gi, body: { mode: 'REMOTE' } }), api('POST', '/attendance/check-in', { token: gi, body: { mode: 'REMOTE' } })]);
ok('double-click check-in: one record only', [ci1.status, ci2.status].sort().join() === '201,409', `${ci1.status},${ci2.status}`);
const [co1, co2] = await Promise.all([api('POST', '/attendance/check-out', { token: gi }), api('POST', '/attendance/check-out', { token: gi })]);
ok('double-click check-out: one wins', [co1.status, co2.status].sort().join() === '200,409', `${co1.status},${co2.status}`);
r = await api('GET', '/attendance/today', { token: gi }); ok('today record has checkIn+checkOut, non-negative hours', r.data.checkOut && r.data.totalHours >= 0);
ok('instant check-out is a HALF_DAY (under 4h rule)', r.data.status === 'HALF_DAY', r.data.status);
const attId = r.data._id;
r = await api('PATCH', '/attendance/' + attId, { token: gi, body: { status: 'PRESENT', totalHours: 8, reason: 'cheating' } }); ok('intern cannot correct attendance', r.status === 403);
r = await api('PATCH', '/attendance/' + attId, { token: hr, body: { status: 'PRESENT', totalHours: 8 } }); ok('correction needs a reason', r.status === 422);
r = await api('PATCH', '/attendance/' + attId, { token: hr, body: { status: 'PRESENT', totalHours: 8, reason: 'Worked a full day, forgot to stay checked in' } }); ok('HR corrects attendance with reason', r.status === 200 && r.data.status === 'PRESENT');
r = await api('GET', '/attendance/summary', { token: gi }); ok('attendance summary computed (>=85%)', r.status === 200 && r.data.percent >= 85, JSON.stringify(r.data));
r = await api('POST', '/attendance/check-in', { token: hr }); ok('HR has no check-in permission', r.status === 403);

console.log('== TASKS ==');
const goldenUserId = (await api('GET', '/auth/me', { token: gi })).data.user._id;
r = await api('POST', '/tasks', { token: gi, body: { title: 'Self assigned', assignedTo: [goldenUserId] } }); ok('intern cannot create tasks', r.status === 403);
r = await api('POST', '/tasks', { token: mentor, body: { title: 'Golden task', description: 'Build the thing', assignedTo: [goldenUserId], dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), priority: 'HIGH' } }); ok('mentor creates task for own mentee', r.status === 201, JSON.stringify(r.json));
const taskId = r.data._id;
r = await api('POST', '/tasks', { token: (await login('qa.mentor2@tmt-qa.test')), body: { title: 'Poach', assignedTo: [goldenUserId] } }); ok('other mentor cannot assign to non-mentee', r.status === 403);
r = await api('PATCH', `/tasks/${taskId}`, { token: gi, body: { status: 'APPROVED' } }); ok('intern cannot PATCH task', r.status === 403);
r = await api('PATCH', `/tasks/${taskId}`, { token: mentor, body: { organizationId: F.orgB, status: 'APPROVED', title: 'Golden task v2' } }); ok('mass assignment ignored (org/status unchanged)', r.status === 200 && r.data.status === 'TODO' && r.data.organizationId === F.orgA && r.data.title === 'Golden task v2');
r = await api('POST', `/tasks/${taskId}/submit`, { token: gi, body: { description: 'done!!' } }); ok('cannot submit from TODO', r.status === 409);
r = await api('POST', `/tasks/${taskId}/status`, { token: gi, body: { status: 'APPROVED' } }); ok('intern cannot approve own task', r.status === 409 || r.status === 403);
r = await api('POST', `/tasks/${taskId}/status`, { token: gi, body: { status: 'IN_PROGRESS' } }); ok('intern starts task', r.status === 200);
r = await api('POST', `/tasks/${taskId}/submit`, { token: gi, body: { description: 'Implemented and tested', links: [{ label: 'PR', url: 'javascript:alert(1)' }] } }); ok('javascript: deliverable url rejected', r.status === 422);
const [s1, s2] = await Promise.all([1, 2].map(() => api('POST', `/tasks/${taskId}/submit`, { token: gi, body: { description: 'Implemented and tested', links: [{ label: 'Pull Request', url: 'https://github.com/org/repo/pull/1' }] } })));
ok('double submit: one submission', [s1.status, s2.status].sort().join() === '201,409', `${s1.status},${s2.status}`);
const sub = (s1.status === 201 ? s1 : s2).data.submission;
r = await api('POST', `/tasks/${taskId}/review`, { token: gi, body: { submissionId: sub._id, decision: 'APPROVED' } }); ok('intern cannot review', r.status === 403);
r = await api('POST', `/tasks/${taskId}/review`, { token: mentor, body: { submissionId: F.ids.taskB, decision: 'APPROVED' } }); ok('foreign/invalid submission id rejected', r.status === 422 || r.status === 404);
r = await api('POST', `/tasks/${taskId}/review`, { token: mentor, body: { submissionId: sub._id, decision: 'REVISION_REQUIRED', reviewNotes: 'Add tests' } }); ok('revision requested', r.status === 200 && r.data.task.status === 'REVISION_REQUIRED');
r = await api('POST', `/tasks/${taskId}/status`, { token: gi, body: { status: 'IN_PROGRESS' } }); ok('intern resumes', r.status === 200);
r = await api('POST', `/tasks/${taskId}/submit`, { token: gi, body: { description: 'Added tests and fixed edge cases' } }); ok('resubmission v2', r.status === 201 && r.data.submission.version === 2);
r = await api('POST', `/tasks/${taskId}/review`, { token: mentor, body: { submissionId: sub._id, decision: 'APPROVED' } }); ok('reviewing the OLD submission rejected', r.status === 422);
r = await api('POST', `/tasks/${taskId}/review`, { token: mentor, body: { submissionId: r.data?.submission?._id || (await api('GET', `/tasks/${taskId}`, { token: mentor })).data.submissions[0]._id, decision: 'APPROVED', reviewNotes: 'Great' } }); ok('approved', r.status === 200 && r.data.task.status === 'APPROVED');
r = await api('GET', `/tasks/${F.ids.taskB}`, { token: mentor }); ok('org B task invisible to org A mentor', r.status === 404);

console.log('== JOURNAL ==');
const journal = { workSummary: 'Implemented the golden feature end to end.', whatILearned: 'Testing strategies', hoursWorked: 7.5, nextSteps: 'Polish' };
r = await api('POST', '/journals', { token: gi, body: { ...journal, hoursWorked: 30 } }); ok('30 hours rejected', r.status === 422);
r = await api('POST', '/journals', { token: gi, body: { ...journal, workSummary: '' } }); ok('empty summary rejected', r.status === 422);
r = await api('POST', '/journals', { token: gi, body: journal }); ok('journal submitted, Day 1', r.status === 201 && r.data.dayNumber === 1, JSON.stringify(r.data));
const journalId = r.data._id;
r = await api('POST', '/journals', { token: gi, body: journal }); ok('duplicate journal rejected', r.status === 409);
r = await api('POST', `/journals/${journalId}/review`, { token: gi, body: { comments: 'me' } }); ok('intern cannot review journal', r.status === 403);
r = await api('POST', `/journals/${journalId}/review`, { token: mentor, body: { comments: 'Nice work' } }); ok('mentor reviews journal', r.status === 200);
r = await api('POST', `/journals/${journalId}/review`, { token: mentor, body: { comments: 'again' } }); ok('cannot review twice', r.status === 409);

console.log('== PERFORMANCE ==');
r = await api('POST', '/performance/reviews', { token: mentor, body: { internId, type: 'FINAL' } }); ok('mentor cannot create review cycle', r.status === 403);
r = await api('POST', '/performance/reviews', { token: hr, body: { internId, type: 'FINAL', metrics: [{ metricName: 'A', weightPercent: 50 }, { metricName: 'B', weightPercent: 20 }] } }); ok('weights not summing to 100 rejected', r.status === 422);
r = await api('POST', '/performance/reviews', { token: hr, body: { internId, type: 'FINAL', cycleTitle: 'Golden final review' } }); ok('FINAL review created', r.status === 201);
const rid = r.data._id;
r = await api('POST', '/performance/reviews', { token: hr, body: { internId, type: 'FINAL' } }); ok('second open FINAL review rejected', r.status === 409);
r = await api('GET', `/interns/${internId}`, { token: hr }); ok('intern is PERFORMANCE_REVIEW', r.data.intern.status === 'PERFORMANCE_REVIEW', r.data.intern.status);
r = await api('POST', `/performance/reviews/${rid}/mentor-assessment`, { token: mentor, body: { feedback: 'Good', scores: [] } }); ok('mentor cannot assess before self-assessment', r.status === 422 || r.status === 409);
r = await api('POST', `/performance/reviews/${rid}/self-assessment`, { token: gi, body: { strengths: 'Testing', growthAreas: 'Design' } }); ok('self assessment', r.status === 200);
r = await api('POST', `/performance/reviews/${rid}/self-assessment`, { token: gi, body: { strengths: 'Again', growthAreas: 'Again' } }); ok('self assessment cannot be resubmitted', r.status === 409);
r = await api('GET', `/performance/reviews/${rid}`, { token: gi }); ok('intern sees no mentor/manager content before finalization', !r.data.mentorAssessment && r.data.finalScore === null);
const names = (await api('GET', `/performance/reviews/${rid}`, { token: mentor })).data.metrics.map(m => m.metricName);
r = await api('POST', `/performance/reviews/${rid}/mentor-assessment`, { token: mentor, body: { feedback: 'Excellent contributor throughout.', scores: names.map(n => ({ metricName: n, score: 11 })) } }); ok('score 11 rejected', r.status === 422);
r = await api('POST', `/performance/reviews/${rid}/mentor-assessment`, { token: mentor, body: { feedback: 'Excellent contributor throughout.', scores: names.map(n => ({ metricName: n, score: 9 })) } }); ok('mentor assessment', r.status === 200 && r.data.finalScore === 9);
r = await api('POST', `/performance/reviews/${rid}/finalize`, { token: gi, body: { comments: 'me' } }); ok('intern cannot finalize', r.status === 403);
r = await api('POST', `/performance/reviews/${rid}/finalize`, { token: hr, body: { comments: 'Approved by management.' } }); ok('finalized with weighted score', r.status === 200 && r.data.status === 'FINALIZED' && r.data.finalScore === 9);
r = await api('POST', `/performance/reviews/${rid}/self-assessment`, { token: gi, body: { strengths: 'hackhack', growthAreas: 'hackhack' } }); ok('cannot un-finalize by re-submitting self-assessment', r.status === 409);
r = await api('GET', `/interns/${internId}`, { token: hr }); ok('intern back to ACTIVE', r.data.intern.status === 'ACTIVE');

console.log('== CERT ELIGIBILITY (before exit) ==');
r = await api('POST', '/certificates/generate', { token: hr, body: { internId } }); ok('certificate refused outside exit process', r.status === 409 && r.err.code === 'WRONG_LIFECYCLE_STAGE', JSON.stringify(r.json));

console.log('== FINANCE ==');
const cycle = new Date().toISOString().slice(0, 7);
r = await api('POST', '/finance/generate-cycle', { token: hr, body: { cycle } }); ok('HR cannot generate payroll', r.status === 403);
r = await api('POST', '/finance/generate-cycle', { token: finance, body: { cycle: '2026-13' } }); ok('bad cycle rejected', r.status === 422);
r = await api('POST', '/finance/generate-cycle', { token: finance, body: { cycle: '2099-01' } }); ok('future cycle rejected', r.status === 422);
r = await api('POST', '/finance/generate-cycle', { token: finance, body: { cycle, internId } });
ok('payroll generated for golden intern', r.status === 200 && r.data.generatedCount === 1, JSON.stringify(r.json));
const pay = r.data.payments[0];
console.log('    payroll:', JSON.stringify({ working: pay.workingDays, active: pay.activeDays, lop: pay.lopDays, absent: pay.absentDays, gross: pay.grossAmount, net: pay.netPayable }));
ok('gross is pro-rated (<= base), never the fake 15000 default', pay.grossAmount > 0 && pay.grossAmount <= 20000 && pay.grossAmount !== 15000 || pay.activeDays === pay.workingDays);
r = await api('POST', '/finance/generate-cycle', { token: finance, body: { cycle, internId } }); ok('regenerate: already generated (skipped, no duplicate)', r.status === 200 && r.data.generatedCount === 0 && r.data.skipped[0].reason === 'ALREADY_GENERATED');
r = await api('GET', `/finance/payments/${pay._id}`, { token: gi }); ok('intern can read OWN payment', r.status === 200);
r = await api('GET', `/finance/payments/${F.ids.taskB}`, { token: gi }); ok('bogus payment id 404', r.status === 404 || r.status === 400);
const otherIntern = await login(E('intern')); r = await api('GET', `/finance/payments/${pay._id}`, { token: otherIntern }); ok("other intern cannot read someone else's payment (IDOR fixed)", r.status === 404, r.status);
r = await api('POST', `/finance/payments/${pay._id}/adjustments`, { token: finance, body: { type: 'DEDUCTION', amount: 999999, description: 'too much' } }); ok('deduction beyond gross rejected (no silent clamp)', r.status === 422 && r.err.code === 'NEGATIVE_NET', JSON.stringify(r.json));
r = await api('POST', `/finance/payments/${pay._id}/adjustments`, { token: finance, body: { type: 'BONUS', amount: 500, description: 'Great work' } }); ok('bonus applied', r.status === 200 && r.data.payment.netPayable === +(pay.netPayable + 500).toFixed(2), JSON.stringify(r.data?.payment));
r = await api('POST', `/finance/payments/${pay._id}/adjustments`, { token: financeviewer, body: { type: 'BONUS', amount: 5, description: 'x' } }); ok('finance viewer cannot adjust', r.status === 403);
r = await api('POST', `/finance/payments/${pay._id}/process`, { token: hr, body: { paymentReference: 'UTR-QA-0001' } }); ok('HR cannot disburse', r.status === 403);
r = await api('POST', `/finance/payments/${pay._id}/process`, { token: finance, body: {} }); ok('disburse without reference rejected', r.status === 422);
const [p1, p2] = await Promise.all([1, 2].map(() => api('POST', `/finance/payments/${pay._id}/process`, { token: finance, body: { paymentReference: 'UTR-QA-0001', paymentMethod: 'UPI' } })));
ok('double disburse: exactly one payout', [p1.status, p2.status].sort().join() === '200,409', `${p1.status},${p2.status}`);
r = await api('POST', `/finance/payments/${pay._id}/adjustments`, { token: finance, body: { type: 'BONUS', amount: 5, description: 'late' } }); ok('paid payment locked', r.status === 409);
r = await api('GET', `/finance/payments/${pay._id}/payslip`, { token: gi }); ok('intern downloads own payslip PDF', r.status === 200 && r.ct.includes('pdf') && r.raw.subarray(0, 4).toString() === '%PDF');
r = await api('GET', `/finance/summary?cycle=${cycle}`, { token: financeviewer }); ok('server-side totals', r.status === 200 && r.data.paid > 0);

fs.writeFileSync(ART + 'golden-state2.json', JSON.stringify({ ...G, payId: pay._id, cycle, goldenUserId }));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
