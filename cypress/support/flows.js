/**
 * Reusable business flows, driven through the API so specs can start from any lifecycle stage without repeating
 * the earlier UI steps (each of those steps has its own spec). Every helper creates its OWN data with generated ids.
 */
const fx = () => Cypress.expose('fx');
let slot = 20 + Math.floor(Math.random() * 250);
export const futureDay = (extra = 0) => new Date(Date.now() + (slot += 2 + extra) * 86400000).toISOString().slice(0, 10);
export const isoDay = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
export const CARD = { technicalKnowledge: 8, communication: 8, problemSolving: 8, relevantExperience: 8, learningAbility: 9, cultureFit: 8, recommendation: 'YES', comments: 'Strong candidate, recommended for hire.' };

/** Applies publicly, then yields { id, applicationId, email, name, payload }. */
export function newApplication(overrides = {}) {
  return cy.apiApply(fx().ids.openingA, overrides).then((res) => {
    expect(res.status, 'public apply').to.eq(201);
    return cy.api('hradmin', 'GET', `/recruitment/applications?search=${res.data.applicationId}`).then((list) => ({
      id: list.body.data[0]._id, applicationId: res.data.applicationId, email: res.email, name: `${res.payload.firstName} ${res.payload.lastName}`, payload: res.payload
    }));
  });
}

const stage = (id, s, note) => cy.api('hradmin', 'PATCH', `/recruitment/applications/${id}/stage`, { stage: s, ...(note ? { note } : {}) }).then((r) => { expect(r.status, `-> ${s}`).to.eq(200); });

export function shortlistedApplication(overrides) {
  return newApplication(overrides).then((app) => stage(app.id, 'UNDER_REVIEW').then(() => stage(app.id, 'SHORTLISTED')).then(() => app));
}

/** Application walked through interview + scorecard to SELECTED. */
export function selectedApplication(overrides) {
  return shortlistedApplication(overrides).then((app) => cy.api('hradmin', 'POST', '/interviews', {
    applicationId: app.applicationId, type: 'TECHNICAL', mode: 'ONLINE', scheduledDate: futureDay(), startTime: '10:00', endTime: '11:00', interviewers: [fx().users.A.interviewer.id]
  }).then((iv) => {
    expect(iv.status, 'schedule interview').to.eq(201);
    return cy.api('interviewer', 'POST', `/interviews/${iv.body.data._id}/feedback`, CARD).then((fb) => {
      expect(fb.status, 'scorecard').to.eq(200);
      return stage(app.id, 'SELECTED').then(() => ({ ...app, interviewId: iv.body.data._id }));
    });
  }));
}

/** Offer drafted (and optionally sent). Yields { offerId, offerCode, link, token, offer }. */
export function draftOffer(app, terms = {}) {
  const body = { applicationId: app.applicationId, startDate: isoDay(3), endDate: isoDay(63), compensationType: 'MONTHLY_STIPEND', stipendAmount: 15000, currency: 'INR', workMode: 'REMOTE', mentorId: fx().users.A.mentor.id, ...terms };
  return cy.api('hradmin', 'POST', '/offers', body).then((r) => {
    expect(r.status, 'draft offer').to.eq(201);
    return { offerId: r.body.data._id, offerCode: r.body.data.offerId, offer: r.body.data };
  });
}

export function sentOffer(app, terms) {
  return draftOffer(app, terms).then((o) => cy.api('hradmin', 'POST', `/offers/${o.offerId}/send`).then((r) => {
    expect(r.status, 'send offer').to.eq(200);
    const link = r.body.data.offerLink;
    return { ...o, link, token: link.split('/offer/')[1] };
  }));
}

/** Candidate accepts through the public link. Yields { internId (code), setupLink, setupToken }. */
export function acceptedOffer(app, terms) {
  return sentOffer(app, terms).then((o) => cy.apiPublic('POST', `/offers/public/${o.token}/accept`).then((r) => {
    expect(r.status, 'accept offer').to.eq(200);
    return { ...o, internCode: r.body.data.internId, setupLink: r.body.data.setupLink, setupToken: new URL(r.body.data.setupLink).searchParams.get('token') };
  }));
}

/** The new intern sets a password. Yields { email, password, token, user }. */
export function activatedAccount(accepted, app, password = 'InternPass2026') {
  return cy.apiPublic('POST', '/auth/setup-password', { token: accepted.setupToken, password }).then((r) => {
    expect(r.status, 'setup password').to.eq(200);
    return { email: app.email, password, token: r.body.data.token, user: r.body.data.user };
  });
}
