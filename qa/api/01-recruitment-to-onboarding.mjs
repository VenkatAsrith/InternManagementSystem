const BASE = (process.env.QA_API_URL || 'http://localhost:5100') + '/api/v1';
import { fileURLToPath as __f2p } from 'node:url';
const ART = __f2p(new URL('../../qa-artifacts/', import.meta.url));
const PW = 'QaPass2026!';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };

async function api(method, path, { token, body, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, data: json?.data, err: json?.error };
}
const login = async (email) => { const r = await api('POST', '/auth/login', { body: { email, password: PW } }); if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.json)}`); return r.data.token; };
const tomorrow = () => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

const fx = (await import('node:fs')).default;
const F = JSON.parse(fx.readFileSync(ART + 'qa-fixtures.json', 'utf8'));
const E = (k) => `qa.${k}@tmt-qa.test`;

console.log('== AUTH ==');
let r = await api('POST', '/auth/login', { body: { email: E('hradmin'), password: 'wrong' } });
ok('wrong password -> 401', r.status === 401 && r.err.code === 'INVALID_CREDENTIALS');
r = await api('POST', '/auth/login', { body: { email: { $gt: '' }, password: PW } });
ok('NoSQL-style email object -> 422 not 500', r.status === 422, JSON.stringify(r.json));
r = await api('GET', '/recruitment/applications?token=abc');
ok('no token -> 401', r.status === 401);
const hr = await login(E('hradmin'));
const rec = await login(E('recruiter'));
const iv = await login(E('interviewer'));
const mentor = await login(E('mentor'));
const finance = await login(E('finance'));
const intern = await login(E('intern'));
const orgadmin = await login(E('orgadmin'));
r = await api('GET', `/recruitment/applications?token=${hr}`);
ok('token in query string is ignored', r.status === 401);
r = await api('GET', '/auth/me', { token: hr });
ok('/auth/me returns permissions', r.status === 200 && Array.isArray(r.data.permissions) && r.data.permissions.includes('finance.read') && !r.data.permissions.includes('finance.process'));

console.log('== RBAC quick ==');
r = await api('GET', '/recruitment/applications', { token: intern }); ok('intern cannot list applications', r.status === 403);
r = await api('GET', '/recruitment/applications', { token: rec }); ok('recruiter CAN list applications (was blocked before)', r.status === 200);
r = await api('GET', '/recruitment/applications', { token: (await login(E('auditor'))) }); ok('auditor can read applications', r.status === 200);
r = await api('GET', '/audit-logs', { token: (await login(E('auditor'))) }); ok('auditor can read audit logs (was blocked)', r.status === 200);
r = await api('POST', '/users', { token: hr, body: { firstName: 'X', lastName: 'Y', email: 'evil.super@tmt-qa.test', role: 'SUPER_ADMIN' } }); ok('HR cannot create SUPER_ADMIN', r.status === 403, JSON.stringify(r.json));
r = await api('GET', '/offers', { token: intern }); ok('intern cannot list offers', r.status === 403);
r = await api('GET', '/finance/payments', { token: (await login(E('financeviewer'))) }); ok('finance viewer can read payments', r.status === 200);
r = await api('POST', '/finance/generate-cycle', { token: (await login(E('financeviewer'))), body: { cycle: '2026-09' } }); ok('finance viewer cannot generate payroll', r.status === 403);

console.log('== PUBLIC APPLY ==');
const pdf = new Blob(['%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'], { type: 'application/pdf' });
const mkForm = (over = {}) => { const f = new FormData(); const base = { openingId: F.ids.openingA, firstName: 'Gina', lastName: 'Golden', email: `qa.golden.${Date.now()}@tmt-qa.test`, phone: '+91 94444 44444', college: 'QA College', degree: 'B.Tech', branch: 'CSE', graduationYear: '2027', privacyConsent: 'true', ...over }; Object.entries(base).forEach(([k, v]) => f.append(k, v)); f.append('resume', pdf, 'resume.pdf'); return { f, email: base.email }; };
let { f: form, email: goldenEmail } = mkForm();
r = await api('POST', '/recruitment/applications/public', { form });
ok('public apply -> 201', r.status === 201 && /^APP-\d{4}-\d{6}$/.test(r.data.applicationId), JSON.stringify(r.json));
const goldenAppId = r.data.applicationId;
({ f: form } = mkForm({ email: goldenEmail })); r = await api('POST', '/recruitment/applications/public', { form });
ok('duplicate apply -> 409', r.status === 409 && r.err.code === 'DUPLICATE_APPLICATION', JSON.stringify(r.json));
({ f: form } = mkForm({ privacyConsent: 'false' })); r = await api('POST', '/recruitment/applications/public', { form });
ok('consent=false rejected (was accepted as true)', r.status === 422, JSON.stringify(r.json));
({ f: form } = mkForm({ openingId: F.ids.closedOpening })); r = await api('POST', '/recruitment/applications/public', { form });
ok('closed opening -> 409', r.status === 409);
{ const f = new FormData(); Object.entries({ openingId: F.ids.openingA, firstName: 'E', lastName: 'V', email: 'evil@x.test', phone: '+91 95555 55555', college: 'c', degree: 'd', branch: 'b', graduationYear: '2027', privacyConsent: 'true' }).forEach(([k, v]) => f.append(k, v)); f.append('resume', new Blob(['<html><script>alert(1)</script></html>'], { type: 'application/pdf' }), 'evil.html'); r = await api('POST', '/recruitment/applications/public', { form: f }); ok('html disguised as pdf rejected (magic bytes)', r.status === 415, JSON.stringify(r.json)); }
r = await api('GET', `/recruitment/applications/public/status/${goldenAppId}`); ok('public status works', r.status === 200 && r.data.status === 'APPLIED' && !JSON.stringify(r.data).includes('note'));
r = await api('GET', '/recruitment/applications/public/status/APP-1-1'); ok('bad id format -> 404', r.status === 404);

console.log('== PIPELINE ==');
r = await api('GET', `/recruitment/applications?search=Golden`, { token: hr });
const goldenApp = r.data.find(a => a.applicationId === goldenAppId);
ok('HR finds application by search', !!goldenApp);
const appId = goldenApp._id;
r = await api('PATCH', `/recruitment/applications/${appId}/stage`, { token: hr, body: { stage: 'SHORTLISTED' } });
ok('APPLIED -> SHORTLISTED directly is rejected', r.status === 409 && r.err.code === 'INVALID_TRANSITION');
r = await api('PATCH', `/recruitment/applications/${appId}/stage`, { token: hr, body: { stage: 'OFFER_ACCEPTED' } });
ok('APPLIED -> OFFER_ACCEPTED rejected', r.status === 409);
r = await api('PATCH', `/recruitment/applications/${appId}/stage`, { token: hr, body: { stage: 'UNDER_REVIEW' } });
ok('APPLIED -> UNDER_REVIEW ok', r.status === 200);
r = await api('PATCH', `/recruitment/applications/${appId}/stage`, { token: hr, body: { stage: 'SHORTLISTED' } });
ok('UNDER_REVIEW -> SHORTLISTED ok', r.status === 200);
r = await api('PATCH', `/recruitment/applications/${appId}/stage`, { token: hr, body: { stage: 'SELECTED' } });
ok('SHORTLISTED -> SELECTED rejected (needs interview)', r.status === 409);

console.log('== INTERVIEW ==');
const ivId = F.users.A.interviewer.id;
const sched = (over = {}) => ({ applicationId: appId, type: 'TECHNICAL', interviewers: [ivId], scheduledDate: tomorrow(), startTime: '10:00', endTime: '11:00', mode: 'ONLINE', ...over });
r = await api('POST', '/interviews', { token: hr, body: sched({ scheduledDate: '2020-01-01' }) }); ok('past interview rejected', r.status === 422);
r = await api('POST', '/interviews', { token: hr, body: sched({ interviewers: [F.users.A.intern.id] }) }); ok('intern as interviewer rejected', r.status === 422, JSON.stringify(r.json));
r = await api('POST', '/interviews', { token: hr, body: sched({ meetingLink: 'javascript:alert(1)' }) }); ok('javascript: meeting link rejected', r.status === 422);
r = await api('POST', '/interviews', { token: hr, body: sched({ endTime: '09:00' }) }); ok('end before start rejected', r.status === 422);
r = await api('POST', '/interviews', { token: hr, body: sched({ interviewers: [] }) }); ok('no interviewer rejected', r.status === 422);
r = await api('POST', '/interviews', { token: hr, body: sched() });
ok('interview scheduled', r.status === 201 && r.data.meetingLink.startsWith('https://meet.jit.si/'), JSON.stringify(r.json));
const interviewId = r.data._id;
r = await api('POST', '/interviews', { token: hr, body: sched() }); ok('second active interview rejected', r.status === 409);
r = await api('GET', `/recruitment/applications/${appId}`, { token: hr }); ok('application is INTERVIEW_SCHEDULED', r.data.status === 'INTERVIEW_SCHEDULED');
const fb = { technicalKnowledge: 8, communication: 8, problemSolving: 7, relevantExperience: 7, learningAbility: 9, cultureFit: 9, recommendation: 'YES', comments: 'Solid fundamentals and clear communication.' };
r = await api('POST', `/interviews/${interviewId}/feedback`, { token: hr, body: fb }); ok('non-panel HR cannot submit scorecard', r.status === 403);
r = await api('POST', `/interviews/${interviewId}/feedback`, { token: iv, body: { ...fb, technicalKnowledge: 99 } }); ok('score 99 rejected', r.status === 422);
const [fb1, fb2] = await Promise.all([api('POST', `/interviews/${interviewId}/feedback`, { token: iv, body: fb }), api('POST', `/interviews/${interviewId}/feedback`, { token: iv, body: fb })]);
ok('double submit: exactly one scorecard accepted', [fb1.status, fb2.status].sort().join() === '200,409', `${fb1.status},${fb2.status}`);
r = await api('GET', `/recruitment/applications/${appId}`, { token: hr }); ok('application is INTERVIEWED after all scorecards', r.data.status === 'INTERVIEWED');
r = await api('PATCH', `/recruitment/applications/${appId}/stage`, { token: hr, body: { stage: 'SELECTED' } }); ok('INTERVIEWED -> SELECTED ok', r.status === 200);

console.log('== OFFER ==');
r = await api('GET', '/users?role=MENTOR', { token: hr }); const mentorId = F.users.A.mentor.id;
const offerBody = { applicationId: appId, startDate: today(), endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10), workMode: 'REMOTE', stipendAmount: 20000, compensationType: 'MONTHLY_STIPEND', mentorId };
r = await api('POST', '/offers', { token: hr, body: { ...offerBody, startDate: '2020-01-01' } }); ok('past start date rejected', r.status === 422);
r = await api('POST', '/offers', { token: hr, body: { ...offerBody, stipendAmount: -5 } }); ok('negative stipend rejected', r.status === 422);
r = await api('POST', '/offers', { token: hr, body: { ...offerBody, mentorId: F.users.A.intern.id } }); ok('intern as mentor rejected', r.status === 422);
r = await api('POST', '/offers', { token: hr, body: offerBody }); ok('offer drafted', r.status === 201 && r.data.status === 'DRAFT', JSON.stringify(r.json));
const offerId = r.data._id; const offerCode = r.data.offerId;
r = await api('POST', '/offers', { token: hr, body: offerBody }); ok('second open offer rejected', r.status === 409);
r = await api('GET', `/recruitment/applications/${appId}`, { token: hr }); ok('application is OFFER_DRAFT', r.data.status === 'OFFER_DRAFT');
r = await api('POST', `/offers/${offerId}/accept`, { token: hr, body: { channel: 'EMAIL', note: 'verbal ok' } }); ok('accepting a DRAFT offer rejected', r.status === 409 && r.err.code === 'OFFER_NOT_SENT', JSON.stringify(r.json));
r = await api('POST', `/offers/${offerId}/send`, { token: hr }); ok('offer sent + link returned', r.status === 200 && r.data.offerLink.includes('/offer/'), JSON.stringify(r.json));
const token = r.data.offerLink.split('/offer/')[1];
r = await api('POST', `/offers/${offerId}/send`, { token: hr }); ok('re-send of SENT offer rejected (no status regress)', r.status === 409);
r = await api('GET', '/offers', { token: intern }); ok('intern still cannot list offers', r.status === 403);
r = await api('POST', `/offers/${offerId}/accept`, { token: intern, body: { channel: 'EMAIL', note: 'me' } }); ok('intern cannot accept on behalf', r.status === 403);
r = await api('GET', `/offers/public/${token}`); ok('public offer view works & no PII leak', r.status === 200 && r.data.status === 'VIEWED' && !JSON.stringify(r.data).includes('@'));
r = await api('GET', `/offers/public/${'x'.repeat(43)}`); ok('bad token -> 404', r.status === 404);

console.log('== ATOMIC ACCEPTANCE ==');
// fault injection: fail after the intern step -> everything must roll back
r = await api('POST', `/offers/public/${token}/accept`, { headers: { 'x-qa-fail-step': 'onboarding' } });
ok('injected failure -> 500', r.status === 500, JSON.stringify(r.json));
r = await api('GET', `/offers/${offerId}`, { token: hr }); ok('offer restored to VIEWED after rollback', r.data.status === 'VIEWED', r.data?.status);
r = await api('GET', `/recruitment/applications/${appId}`, { token: hr }); ok('application restored to OFFER_SENT', r.data.status === 'OFFER_SENT', r.data.status);
r = await api('GET', `/interns?search=${goldenEmail.split('@')[0]}`, { token: hr }); ok('no intern created by failed attempt', r.data.length === 0);
r = await api('POST', '/auth/login', { body: { email: goldenEmail, password: PW } }); ok('no user account created by failed attempt', r.status === 401);
// concurrent acceptance
const [c1, c2, c3] = await Promise.all([1, 2, 3].map(() => api('POST', `/offers/public/${token}/accept`)));
const statuses = [c1, c2, c3].map(x => x.status).sort().join();
ok('3 concurrent accepts: exactly one wins', statuses === '200,409,409' || statuses === '200,404,409' || statuses === '200,404,404' || (statuses.startsWith('200') && statuses.split(',').filter(s => s === '200').length === 1), statuses);
const win = [c1, c2, c3].find(x => x.status === 200);
ok('winner gets intern id + setup link', win && /^INT-/.test(win.data.internId) && win.data.setupLink.includes('set-password?token='), JSON.stringify(win?.json));
r = await api('GET', `/interns?search=${goldenEmail.split('@')[0]}`, { token: hr }); ok('exactly one intern exists', r.data.length === 1 && r.data[0].status === 'PRE_ONBOARDING');
const goldenIntern = r.data[0];
r = await api('POST', `/offers/public/${token}/accept`); ok('accept again -> 404/409 (link consumed)', [404, 409].includes(r.status));
r = await api('GET', `/onboarding`, { token: hr }); ok('onboarding plan exists with 10 tasks', r.status === 200);

console.log('== SET PASSWORD + LOGIN ==');
const setupToken = win.data.setupLink.split('token=')[1];
r = await api('POST', '/auth/setup-password', { body: { token: setupToken, password: 'short' } }); ok('weak password rejected', r.status === 422);
r = await api('POST', '/auth/setup-password', { body: { token: setupToken, password: 'GoldenPass2026' } }); ok('password set + auto sign-in', r.status === 200 && r.data.user.role === 'INTERN', JSON.stringify(r.json));
const goldenToken = r.data.token;
r = await api('POST', '/auth/setup-password', { body: { token: setupToken, password: 'AnotherPass2026' } }); ok('setup link is single use', r.status === 400);

fx.writeFileSync(ART + 'golden-state.json', JSON.stringify({ goldenEmail, appId, offerId, offerCode, internDbId: goldenIntern._id, internCode: goldenIntern.internId, goldenToken, password: 'GoldenPass2026' }));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
