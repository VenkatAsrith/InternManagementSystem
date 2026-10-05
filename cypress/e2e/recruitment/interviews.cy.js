const fx = () => Cypress.expose('fx');
let dayCounter = 5 + Math.floor(Math.random() * 300); // random start: re-runs on the same database must not collide with earlier bookings
/** A unique future day per call, so interviewer-availability conflicts never leak between tests. */
const futureDay = () => new Date(Date.now() + (dayCounter += 2) * 86400000).toISOString().slice(0, 10);
const RATINGS = ['technicalKnowledge', 'communication', 'problemSolving', 'relevantExperience', 'learningAbility', 'cultureFit'];
const CARD = { technicalKnowledge: 8, communication: 8, problemSolving: 8, relevantExperience: 7, learningAbility: 9, cultureFit: 8, recommendation: 'YES', comments: 'Strong candidate overall.' };

function shortlistedApplication() {
  return cy.apiApply(fx().ids.openingA).then((res) => {
    expect(res.status).to.eq(201);
    return cy.api('hradmin', 'GET', `/recruitment/applications?search=${res.data.applicationId}`).then((list) => {
      const app = list.body.data[0];
      return cy.api('hradmin', 'PATCH', `/recruitment/applications/${app._id}/stage`, { stage: 'UNDER_REVIEW' })
        .then(() => cy.api('hradmin', 'PATCH', `/recruitment/applications/${app._id}/stage`, { stage: 'SHORTLISTED' }))
        .then(() => ({ id: app._id, applicationId: res.data.applicationId, name: `${res.payload.firstName} ${res.payload.lastName}` }));
    });
  });
}

function scheduleViaApi(app, { interviewers, day = futureDay(), start = '10:00', end = '11:00' }) {
  return cy.api('hradmin', 'POST', '/interviews', { applicationId: app.applicationId, type: 'TECHNICAL', mode: 'ONLINE', scheduledDate: day, startTime: start, endTime: end, interviewers });
}

describe('Recruitment: scheduling interviews', () => {
  beforeEach(() => { cy.loginAs('hradmin'); });

  it('HR schedules an interview from the application; the stage advances and the panel is notified', () => {
    shortlistedApplication().then((app) => {
      cy.visit(`/admin/applications/${app.id}`);
      cy.tid('schedule-interview').click();
      cy.modal('schedule-modal');
      cy.tid('input-scheduledDate').clear().type(futureDay());
      cy.tid('input-startTime').clear().type('14:00');
      cy.tid('input-endTime').clear().type('15:00');
      cy.tid(`interviewer-${fx().users.A.interviewer.id}`).check();
      cy.intercept('POST', '**/interviews').as('schedule');
      cy.tid('schedule-modal-submit').click();
      cy.wait('@schedule').its('response.statusCode').should('eq', 201);
      cy.expectToast('success', 'Interview scheduled');
      cy.modalClosed('schedule-modal');
      cy.tid('application-status').should('have.attr', 'data-status', 'INTERVIEW_SCHEDULED');
      cy.tid('interviews-card').should('contain.text', 'Technical');
      cy.task('db:find', { collection: 'notifications', filter: { recipientId: fx().users.A.interviewer.id, type: 'INTERVIEW_SCHEDULED' } }).then((rows) => {
        expect(rows.length).to.be.greaterThan(0);
      });
    });
  });

  it('the form validates the panel, the time range and the location before sending', () => {
    shortlistedApplication().then((app) => {
      cy.visit(`/admin/applications/${app.id}`);
      cy.tid('schedule-interview').click();
      cy.intercept('POST', '**/interviews', cy.spy().as('schedule'));
      cy.tid('input-endTime').clear().type('09:00');
      cy.tid('input-startTime').clear().type('10:00');
      cy.tid('schedule-modal-submit').click();
      cy.expectFieldError('endTime', 'after the start');
      cy.expectFieldError('interviewers', 'At least one interviewer');
      cy.tid('input-mode').select('IN_PERSON');
      cy.tid('schedule-modal-submit').click();
      cy.expectFieldError('location', 'required for in-person');
      cy.get('@schedule').should('not.have.been.called');
    });
  });

  it('only people whose role may conduct interviews are offered as panelists', () => {
    shortlistedApplication().then((app) => {
      cy.visit(`/admin/applications/${app.id}`);
      cy.tid('schedule-interview').click();
      cy.tid('interviewer-options').should('be.visible');
      cy.tid(`interviewer-${fx().users.A.interviewer.id}`).should('exist');
      cy.tid(`interviewer-${fx().users.A.recruiter.id}`).should('exist');
      [fx().users.A.intern.id, fx().users.A.finance.id, fx().users.A.mentor.id].forEach((id) => cy.get(`[data-testid="interviewer-${id}"]`).should('not.exist'));
    });
  });

  it('the API refuses non-interviewers on the panel, past slots and double-booked interviewers', () => {
    shortlistedApplication().then((a1) => shortlistedApplication().then((a2) => {
      const day = futureDay();
      cy.api('hradmin', 'POST', '/interviews', { applicationId: a1.applicationId, scheduledDate: day, startTime: '10:00', endTime: '11:00', interviewers: [fx().users.A.mentor.id] }).its('status').should('eq', 422);
      cy.api('hradmin', 'POST', '/interviews', { applicationId: a1.applicationId, scheduledDate: '2020-01-01', startTime: '10:00', endTime: '11:00', interviewers: [fx().users.A.interviewer.id] }).its('status').should('eq', 422);
      scheduleViaApi(a1, { interviewers: [fx().users.A.interviewer.id], day }).its('status').should('eq', 201);
      cy.api('hradmin', 'POST', '/interviews', { applicationId: a2.applicationId, scheduledDate: day, startTime: '10:30', endTime: '11:30', interviewers: [fx().users.A.interviewer.id] }).its('status').should('eq', 409);
      cy.api('hradmin', 'POST', '/interviews', { applicationId: a1.applicationId, scheduledDate: futureDay(), startTime: '10:00', endTime: '11:00', interviewers: [fx().users.A.interviewer.id] }).its('body.error.code').should('eq', 'INVALID_APPLICATION_STATE');
    }));
  });

  it('applications that are not shortlisted cannot be scheduled', () => {
    cy.api('hradmin', 'POST', '/interviews', { applicationId: fx().apps.applied.applicationId, scheduledDate: futureDay(), startTime: '10:00', endTime: '11:00', interviewers: [fx().users.A.interviewer.id] }).then((res) => {
      expect(res.status).to.eq(409);
      expect(res.body.error.code).to.eq('INVALID_APPLICATION_STATE');
    });
  });
});

describe('Recruitment: scorecards and completion', () => {
  it('a panelist submits a validated scorecard through the UI; the interview stays open until every panelist has', () => {
    cy.loginAs('hradmin');
    shortlistedApplication().then((app) => {
      scheduleViaApi(app, { interviewers: [fx().users.A.interviewer.id, fx().users.A.recruiter.id] }).its('status').should('eq', 201);

      cy.loginAs('interviewer');
      cy.visit('/admin/interviews');
      cy.tid('input-search').type(app.applicationId);
      cy.contains('tr', app.name).find('[data-testid^="interview-score-"]').click();
      cy.modal('scorecard-modal');
      cy.tid('scorecard-modal-submit').click();
      RATINGS.forEach((r) => cy.expectFieldError(r, 'required'));
      cy.expectFieldError('recommendation');
      cy.expectFieldError('comments');
      RATINGS.forEach((r) => cy.tid(`input-${r}`).type('11'));
      cy.tid('scorecard-modal-submit').click();
      cy.expectFieldError('technicalKnowledge', 'at most 10');
      RATINGS.forEach((r, i) => cy.tid(`input-${r}`).clear().type(String(7 + (i % 3))));
      cy.tid('input-recommendation').select('YES');
      cy.tid('input-comments').type('Solid fundamentals and clear communication.');
      cy.intercept('POST', '**/feedback').as('feedback');
      cy.tid('scorecard-modal-submit').click();
      cy.wait('@feedback').its('response.statusCode').should('eq', 200);
      cy.expectToast('success', 'Scorecard submitted');

      // one of two panelists: not complete, the application has not moved on
      cy.api('hradmin', 'GET', `/interviews?applicationId=${app.id}`).its('body.data.0.status').should('eq', 'SCHEDULED');
      cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'INTERVIEW_SCHEDULED');
      cy.contains('tr', app.name).find('[data-testid^="interview-score-"]').should('not.exist');
      // blind evaluation: the interviewer's copy holds only their own scorecard
      cy.api('interviewer', 'GET', `/interviews?applicationId=${app.id}`).its('body.data.0.feedback').should('have.length', 1);
    });
  });

  it('when every panelist has submitted the interview completes, the application is Interviewed and HR can select the candidate', () => {
    shortlistedApplication().then((app) => {
      scheduleViaApi(app, { interviewers: [fx().users.A.interviewer.id, fx().users.A.recruiter.id] }).then((res) => {
        const iv = res.body.data._id;
        cy.api('hradmin', 'POST', `/interviews/${iv}/feedback`, CARD).its('body.error.code').should('eq', 'NOT_ON_PANEL');
        cy.api('interviewer', 'POST', `/interviews/${iv}/feedback`, CARD).its('status').should('eq', 200);
        cy.api('interviewer', 'POST', `/interviews/${iv}/feedback`, CARD).its('body.error.code').should('eq', 'FEEDBACK_ALREADY_SUBMITTED');
        // selection stays blocked while the interview is incomplete
        cy.api('hradmin', 'PATCH', `/recruitment/applications/${app.id}/stage`, { stage: 'SELECTED' }).its('status').should('eq', 409);
        cy.api('recruiter', 'POST', `/interviews/${iv}/feedback`, { ...CARD, recommendation: 'MAYBE' }).its('status').should('eq', 200);
        cy.api('hradmin', 'GET', `/interviews/${iv}`).then((r) => {
          expect(r.body.data.status).to.eq('COMPLETED');
          expect(r.body.data.feedback, 'HR sees all scorecards').to.have.length(2);
        });
        cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'INTERVIEWED');
        cy.api('recruiter', 'POST', `/interviews/${iv}/feedback`, CARD).its('status').should('eq', 409);
        cy.api('hradmin', 'PATCH', `/recruitment/applications/${app.id}/stage`, { stage: 'SELECTED' }).its('status').should('eq', 200);
      });
    });
  });

  it('a scorecard with an out-of-range rating, a fractional rating or a short comment is refused by the API too', () => {
    shortlistedApplication().then((app) => {
      scheduleViaApi(app, { interviewers: [fx().users.A.interviewer.id] }).then((res) => {
        const iv = res.body.data._id;
        [{ communication: 11 }, { communication: 0 }, { communication: 7.5 }, { comments: 'short' }, { recommendation: 'PERHAPS' }].forEach((patch) => {
          cy.api('interviewer', 'POST', `/interviews/${iv}/feedback`, { ...CARD, ...patch }).its('status').should('eq', 422);
        });
      });
    });
  });
});

describe('Recruitment: rescheduling and cancelling', () => {
  it('HR reschedules through the UI (reason required) and cancels; the application returns to Shortlisted and can be scheduled again', () => {
    cy.loginAs('hradmin');
    shortlistedApplication().then((app) => {
      scheduleViaApi(app, { interviewers: [fx().users.A.interviewer.id] }).its('status').should('eq', 201);
      cy.visit('/admin/interviews');
      cy.tid('input-search').type(app.applicationId);
      cy.contains('tr', app.name).find('[data-testid^="interview-reschedule-"]').click();
      cy.modal('reschedule-modal');
      cy.tid('reschedule-modal-submit').click();
      cy.expectFieldError('reason', 'Reason is required');
      cy.tid('input-scheduledDate').clear().type(futureDay());
      cy.tid('input-reason').type('Panelist unavailable');
      cy.tid('reschedule-modal-submit').click();
      cy.expectToast('success', 'rescheduled');
      cy.contains('tr', app.name).find('[data-status="RESCHEDULED"]').should('exist');

      cy.contains('tr', app.name).find('[data-testid^="interview-cancel-"]').click();
      cy.modal('cancel-interview-modal');
      cy.tid('input-reason').type('Candidate withdrew from this round');
      cy.tid('cancel-interview-modal-submit').click();
      cy.expectToast('success', 'Interview updated');
      cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'SHORTLISTED');
      scheduleViaApi(app, { interviewers: [fx().users.A.interviewer.id] }).its('status').should('eq', 201);
    });
  });
});
