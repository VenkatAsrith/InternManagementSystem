const fx = () => Cypress.expose('fx');
const openApp = (id) => cy.visit(`/admin/applications/${id}`);

/** Creates a brand-new application (isolated per test) and yields { id (db), applicationId, email, firstName, lastName }. */
function freshApplication() {
  return cy.apiApply(fx().ids.openingA).then((res) => {
    expect(res.status, 'apply').to.eq(201);
    return cy.api('hradmin', 'GET', `/recruitment/applications?search=${encodeURIComponent(res.data.applicationId)}`).then((list) => {
      const app = list.body.data.find((a) => a.applicationId === res.data.applicationId);
      return { id: app._id, applicationId: res.data.applicationId, email: res.email, firstName: res.payload.firstName, lastName: res.payload.lastName };
    });
  });
}

describe('Recruitment: applications list', () => {
  beforeEach(() => { cy.loginAs('hradmin'); });

  it('shows applications of THIS organization only, with real stages', () => {
    cy.intercept('GET', '**/recruitment/applications*').as('list');
    cy.visit('/admin/applications');
    cy.wait('@list');
    cy.tid('applications-table').should('be.visible');
    // fixtures are located by search: earlier tests keep adding newer applications ahead of them
    cy.tid('input-search').type(fx().apps.shortlisted.applicationId);
    cy.wait('@list');
    cy.contains('tr', fx().apps.shortlisted.applicationId).find('[data-status]').should('have.attr', 'data-status', 'SHORTLISTED');
    cy.tid('input-search').clear().type(fx().apps.orgB.applicationId);
    cy.wait('@list');
    cy.tid(`app-link-${fx().apps.orgB.applicationId}`).should('not.exist');
    cy.tid('applications-table-empty').should('be.visible');
  });

  it('search by name narrows the list and an empty result explains itself', () => {
    cy.intercept('GET', '**/recruitment/applications*').as('list');
    cy.visit('/admin/applications');
    cy.wait('@list');
    cy.tid('input-search').type('Shortlisted');
    cy.wait('@list').its('request.url').should('include', 'search=Shortlisted');
    cy.tid(`app-link-${fx().apps.shortlisted.applicationId}`).should('be.visible');
    cy.tid(`app-link-${fx().apps.applied.applicationId}`).should('not.exist');
    cy.tid('input-search').clear().type('nobody-with-this-name');
    cy.tid('applications-table-empty').should('contain.text', 'No applications match');
  });

  it('the stage filter is applied by the server', () => {
    cy.intercept('GET', '**/recruitment/applications*').as('list');
    cy.visit('/admin/applications');
    cy.wait('@list');
    cy.tid('input-stage').select('SHORTLISTED');
    cy.wait('@list').its('request.url').should('include', 'stage=SHORTLISTED');
    cy.tid('input-search').type(fx().apps.shortlisted.applicationId);
    cy.wait('@list').its('request.url').should('include', 'stage=SHORTLISTED');
    cy.tid(`app-link-${fx().apps.shortlisted.applicationId}`).should('be.visible');
    cy.get('[data-testid="applications-table"] [data-status]').each(($el) => expect($el.attr('data-status')).to.eq('SHORTLISTED'));
  });

  it('another organization\'s application is not reachable by direct URL or API (404)', () => {
    cy.visit(`/admin/applications/${fx().apps.orgB.id}`);
    cy.tid('error-state').should('have.attr', 'data-error-status', '404');
    cy.api('hradmin', 'GET', `/recruitment/applications/${fx().apps.orgB.id}`).its('status').should('eq', 404);
  });
});

describe('Recruitment: application detail and stage workflow', () => {
  beforeEach(() => { cy.loginAs('hradmin'); });

  it('shows candidate details and lets HR download the resume through the authenticated client', () => {
    freshApplication().then((a) => {
      openApp(a.id);
      cy.tid('page-title').should('contain.text', a.firstName);
      cy.tid('candidate-card').should('contain.text', a.email).and('contain.text', 'QA Institute of Technology');
      cy.intercept('GET', `**/applications/${a.id}/resume`).as('resume');
      cy.tid('download-resume').click();
      cy.wait('@resume').its('response').then((res) => {
        expect(res.statusCode).to.eq(200);
        expect(res.headers['content-type']).to.contain('application/pdf');
        expect(res.headers['x-content-type-options']).to.eq('nosniff');
      });
    });
  });

  it('moves an application through review and shortlist, offering only allowed next steps', () => {
    freshApplication().then((a) => {
      openApp(a.id);
      cy.tid('application-status').should('have.attr', 'data-status', 'APPLIED');
      // stages that are not legal from APPLIED are simply not offered
      cy.tid('stage-SELECTED').should('not.exist');
      cy.tid('stage-OFFER_SENT').should('not.exist');
      cy.tid('stage-SHORTLISTED').should('not.exist');

      cy.tid('stage-UNDER_REVIEW').click();
      cy.tid('confirm-accept').click();
      cy.expectToast('success', 'Under Review');
      cy.tid('application-status').should('have.attr', 'data-status', 'UNDER_REVIEW');

      cy.tid('stage-SHORTLISTED').click();
      cy.tid('confirm-accept').click();
      cy.tid('application-status').should('have.attr', 'data-status', 'SHORTLISTED');

      // the timeline records each step and the database agrees
      cy.tid('history-card').should('contain.text', 'Under Review').and('contain.text', 'Shortlisted');
      cy.task('db:find', { collection: 'applications', filter: { applicationId: a.applicationId } }).then((rows) => {
        expect(rows[0].status).to.eq('SHORTLISTED');
        expect(rows[0].timeline.map((t) => t.stage)).to.deep.eq(['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED']);
      });
    });
  });

  it('rejecting needs a reason: the confirm button stays disabled until one is typed', () => {
    freshApplication().then((a) => {
      openApp(a.id);
      cy.tid('stage-REJECTED').click();
      cy.tid('confirm-accept').should('be.disabled');
      cy.tid('confirm-reason').type('ab');
      cy.tid('confirm-accept').should('be.disabled');
      cy.tid('confirm-reason').type('c - does not meet the criteria');
      cy.tid('confirm-accept').should('not.be.disabled').click();
      cy.tid('application-status').should('have.attr', 'data-status', 'REJECTED');
      cy.tid('history-card').should('contain.text', 'does not meet the criteria');
      // terminal: no further actions are offered
      cy.tid('actions-card').find('button').should('have.length', 0);
    });
  });

  it('cancelling the confirmation changes nothing', () => {
    freshApplication().then((a) => {
      openApp(a.id);
      cy.tid('stage-UNDER_REVIEW').click();
      cy.tid('confirm-cancel').click();
      cy.modalClosed('confirm-dialog');
      cy.tid('application-status').should('have.attr', 'data-status', 'APPLIED');
    });
  });

  it('the API refuses illegal transitions with a 409 that names the allowed ones', () => {
    freshApplication().then((a) => {
      cy.api('hradmin', 'PATCH', `/recruitment/applications/${a.id}/stage`, { stage: 'OFFER_ACCEPTED' }).then((res) => {
        expect(res.status).to.eq(409);
        expect(res.body.error.code).to.eq('INVALID_TRANSITION');
        expect(res.body.error.details.allowed).to.include('UNDER_REVIEW');
      });
      cy.api('hradmin', 'PATCH', `/recruitment/applications/${a.id}/stage`, { stage: 'SELECTED' }).its('status').should('eq', 409);
      cy.api('hradmin', 'PATCH', `/recruitment/applications/${a.id}/stage`, { stage: 'REJECTED' }).then((res) => {
        expect(res.status, 'a rejection without a reason').to.be.oneOf([409, 422]);
      });
    });
  });

  it('selection is refused without a completed interview scorecard', () => {
    freshApplication().then((a) => {
      ['UNDER_REVIEW', 'SHORTLISTED'].forEach((stage) => cy.api('hradmin', 'PATCH', `/recruitment/applications/${a.id}/stage`, { stage }).its('status').should('eq', 200));
      cy.api('hradmin', 'PATCH', `/recruitment/applications/${a.id}/stage`, { stage: 'SELECTED' }).its('status').should('eq', 409);
    });
  });

  it('two people moving the same application at once cannot both win with conflicting results', () => {
    freshApplication().then((a) => {
      cy.api('hradmin', 'PATCH', `/recruitment/applications/${a.id}/stage`, { stage: 'UNDER_REVIEW' }).its('status').should('eq', 200);
      // A second, stale request for the SAME transition is now illegal.
      cy.api('recruiter', 'PATCH', `/recruitment/applications/${a.id}/stage`, { stage: 'UNDER_REVIEW' }).then((res) => {
        expect(res.status).to.eq(409);
        expect(res.body.error.code).to.eq('INVALID_TRANSITION');
      });
    });
  });

  it('a rejected candidate may apply again (their claim on the opening is released)', () => {
    freshApplication().then((a) => {
      cy.api('hradmin', 'PATCH', `/recruitment/applications/${a.id}/stage`, { stage: 'REJECTED', note: 'Not a fit right now' }).its('status').should('eq', 200);
      cy.apiApply(fx().ids.openingA, { email: a.email }).its('status').should('eq', 201);
    });
  });
});

describe('Recruitment: internal notes', () => {
  it('HR adds notes that persist; empty and oversized notes are refused with field errors', () => {
    cy.loginAs('hradmin');
    freshApplication().then((a) => {
      openApp(a.id);
      cy.tid('add-note').click();
      cy.expectFieldError('text', 'Note is required');
      cy.tid('input-text').type('Strong portfolio, follow up on Monday.');
      cy.tid('add-note').click();
      cy.expectToast('success', 'Note added');
      cy.tid('note-item').should('have.length', 1).and('contain.text', 'Strong portfolio');
      cy.tid('input-text').type('x'.repeat(2001), { delay: 0, parseSpecialCharSequences: false });
      cy.tid('add-note').click();
      cy.expectFieldError('text', 'at most 2000');
      cy.reload();
      cy.tid('note-item').should('have.length', 1);
    });
  });

  it('an interviewer never sees internal notes and only sees applications assigned to them', () => {
    cy.loginAs('interviewer');
    cy.visit('/admin/applications');
    cy.tid('applications-table-empty').should('be.visible');
    cy.api('interviewer', 'GET', `/recruitment/applications/${fx().apps.applied.id}`).its('status').should('eq', 404);
    cy.api('interviewer', 'POST', `/recruitment/applications/${fx().apps.applied.id}/notes`, { text: 'nope' }).its('status').should('eq', 403);
    cy.api('interviewer', 'GET', `/recruitment/applications/${fx().apps.applied.id}/resume`).its('status').should('eq', 404);
  });

  it('a read-only auditor can view applications but has no action buttons', () => {
    cy.loginAs('auditor');
    openApp(fx().apps.applied.id);
    cy.tid('page-title').should('be.visible');
    cy.tid('actions-card').should('contain.text', 'view this application but not change it');
    cy.get('[data-testid^="stage-"]').should('not.exist');
    cy.get('[data-testid="add-note"]').should('not.exist');
  });
});
