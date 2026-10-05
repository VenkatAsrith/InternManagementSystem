import { draftOffer, isoDay, selectedApplication, sentOffer } from '../../support/flows';

const fx = () => Cypress.expose('fx');

describe('Offers: HR drafts, edits, sends and revokes', () => {
  beforeEach(() => { cy.loginAs('hradmin'); });

  it('drafts an offer from a selected application through the form and lists it as a draft', () => {
    selectedApplication().then((app) => {
      cy.visit(`/admin/applications/${app.id}`);
      cy.tid('draft-offer').click();
      cy.modal('offer-modal');
      cy.tid('input-startDate').clear().type(isoDay(5));
      cy.tid('input-endDate').clear().type(isoDay(65));
      cy.tid('input-stipendAmount').clear().type('18000');
      cy.tid('input-mentorId').select(fx().users.A.mentor.id);
      cy.intercept('POST', '**/offers').as('create');
      cy.tid('offer-modal-submit').click();
      cy.wait('@create').its('response.statusCode').should('eq', 201);
      cy.expectToast('success', 'Offer drafted');
      cy.tid('application-status').should('have.attr', 'data-status', 'OFFER_DRAFT');
      cy.tid('offer-card').should('contain.text', 'Draft');
      // the server derived the duration and the display text: the browser did not send them
      cy.task('db:find', { collection: 'offers', filter: { applicationId: app.id } }).then((rows) => {
        expect(rows).to.have.length(1);
        expect(rows[0].stipendAmount).to.eq(18000);
        expect(rows[0].durationDays).to.eq(61);
        expect(rows[0].stipend).to.contain('18,000');
        expect(rows[0].status).to.eq('DRAFT');
      });
    });
  });

  it('validates dates, the stipend and the unpaid rule client-side and server-side', () => {
    selectedApplication().then((app) => {
      cy.visit(`/admin/applications/${app.id}`);
      cy.tid('draft-offer').click();
      cy.intercept('POST', '**/offers', cy.spy().as('create'));
      cy.tid('input-endDate').clear().type(isoDay(1));
      cy.tid('input-startDate').clear().type(isoDay(5));
      cy.tid('offer-modal-submit').click();
      cy.expectFieldError('endDate', 'after the start');
      cy.expectFieldError('stipendAmount', 'greater than 0');
      cy.get('@create').should('not.have.been.called');
      // choosing Unpaid removes the amount requirement and forces 0
      cy.tid('input-compensationType').select('UNPAID');
      cy.tid('input-stipendAmount').should('be.disabled').and('have.value', '0');
      // server-side: a paid plan with amount 0 and an unpaid plan with an amount are both refused
      cy.api('hradmin', 'POST', '/offers', { applicationId: app.applicationId, startDate: isoDay(5), endDate: isoDay(65), compensationType: 'MONTHLY_STIPEND', stipendAmount: 0 }).its('status').should('eq', 422);
      cy.api('hradmin', 'POST', '/offers', { applicationId: app.applicationId, startDate: isoDay(5), endDate: isoDay(65), compensationType: 'UNPAID', stipendAmount: 500 }).its('status').should('eq', 422);
      cy.api('hradmin', 'POST', '/offers', { applicationId: app.applicationId, startDate: isoDay(-3), endDate: isoDay(65), stipendAmount: 1000 }).its('status').should('eq', 422);
      cy.api('hradmin', 'POST', '/offers', { applicationId: app.applicationId, startDate: isoDay(5), endDate: isoDay(600), stipendAmount: 1000 }).its('status').should('eq', 422);
    });
  });

  it('only a Selected application can be offered, and only one open offer may exist at a time', () => {
    selectedApplication().then((app) => {
      draftOffer(app).then(() => {
        cy.api('hradmin', 'POST', '/offers', { applicationId: app.applicationId, startDate: isoDay(5), endDate: isoDay(65), stipendAmount: 1000 }).then((r) => {
          expect(r.status).to.eq(409);
          expect(r.body.error.code).to.be.oneOf(['OPEN_OFFER_EXISTS', 'INVALID_APPLICATION_STATE']);
        });
      });
    });
    cy.api('hradmin', 'POST', '/offers', { applicationId: fx().apps.applied.applicationId, startDate: isoDay(5), endDate: isoDay(65), stipendAmount: 1000 }).its('body.error.code').should('eq', 'INVALID_APPLICATION_STATE');
  });

  it('edits a draft, then sends it: the secure link is shown once and the status changes everywhere', () => {
    selectedApplication().then((app) => draftOffer(app).then((o) => {
      cy.visit('/admin/offers');
      cy.tid('input-status').select('DRAFT');
      cy.tid(`offer-edit-${o.offerId}`).click();
      cy.modal('offer-modal');
      cy.tid('input-stipendAmount').clear().type('22000');
      cy.tid('offer-modal-submit').click();
      cy.expectToast('success', 'Offer updated');
      cy.tid(`offer-send-${o.offerId}`).click();
      cy.expectToast('success', 'Offer sent');
      cy.modal('link-modal');
      cy.tid('secure-link-value').invoke('val').should('match', /\/offer\/[A-Za-z0-9_-]{20,}$/);
      cy.tid('link-modal-done').click();
      cy.modalClosed('link-modal');
      cy.api('hradmin', 'GET', `/offers/${o.offerId}`).then((r) => {
        expect(r.body.data.status).to.eq('SENT');
        expect(r.body.data.stipendAmount).to.eq(22000);
        expect(r.body.data.acceptTokenHash, 'the token hash is never returned by the API').to.be.undefined;
        expect(JSON.stringify(r.body)).not.to.match(/acceptToken/);
      });
      cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'OFFER_SENT');
      // a sent offer can no longer be edited
      cy.api('hradmin', 'PATCH', `/offers/${o.offerId}`, { stipendAmount: 1 }).its('body.error.code').should('eq', 'OFFER_NOT_EDITABLE');
    }));
  });

  it('three simultaneous send requests send the offer exactly once; the others get a clear 409', () => {
    selectedApplication().then((app) => draftOffer(app).then((o) => {
      cy.apiLogin('hradmin').then((auth) => {
        cy.task('api:race', { url: `${Cypress.expose('apiUrl')}/api/v1/offers/${o.offerId}/send`, headers: { Authorization: `Bearer ${auth.token}` }, count: 3 }).then((results) => {
          const codes = results.map((r) => r.status).sort();
          expect(codes, JSON.stringify(results)).to.deep.eq([200, 409, 409]);
          results.filter((r) => r.status === 409).forEach((r) => expect(r.code).to.eq('OFFER_NOT_DRAFT'));
        });
      });
      cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'OFFER_SENT');
      cy.task('db:count', { collection: 'offers', filter: { applicationId: app.id } }).should('eq', 1);
    }));
  });

  it('HR revokes with a mandatory reason; the application returns to Selected and a new offer can be drafted', () => {
    selectedApplication().then((app) => sentOffer(app).then((o) => {
      cy.visit('/admin/offers');
      cy.tid('input-status').select('SENT');
      cy.tid(`offer-revoke-${o.offerId}`).click();
      cy.modal('revoke-offer-modal');
      cy.tid('revoke-offer-modal-submit').click();
      cy.expectFieldError('reason', 'Reason is required');
      cy.tid('input-reason').type('Budget changed for this cohort');
      cy.tid('revoke-offer-modal-submit').click();
      cy.expectToast('success', 'Offer revoked');
      cy.api('hradmin', 'GET', `/offers/${o.offerId}`).its('body.data.status').should('eq', 'REVOKED');
      cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'SELECTED');
      // the old link is dead
      cy.apiPublic('GET', `/offers/public/${o.token}`).its('status').should('eq', 404);
      draftOffer(app).its('offerCode').should('be.a', 'string');
    }));
  });
});
