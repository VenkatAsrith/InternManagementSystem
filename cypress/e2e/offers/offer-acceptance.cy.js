import { acceptedOffer, activatedAccount, selectedApplication, sentOffer } from '../../support/flows';

const fx = () => Cypress.expose('fx');
const API = () => `${Cypress.expose('apiUrl')}/api/v1`;

/** What acceptance must have created for ONE person, counted straight from the database. */
function provisioned(app) {
  return cy.task('db:find', { collection: 'candidates', filter: { email: app.email } }).then((cands) => {
    const candidateId = cands[0]._id;
    return cy.task('db:count', { collection: 'users', filter: { email: app.email } }).then((users) =>
      cy.task('db:count', { collection: 'interns', filter: { candidateId } }).then((interns) =>
        cy.task('db:count', { collection: 'onboardingplans', filter: { candidateId } }).then((plans) => ({ users, interns, plans }))));
  });
}

describe('Offers: candidate acceptance through the secure link', () => {
  it('shows the offer, accepts it once, and creates exactly one user, intern, onboarding plan and compensation plan', () => {
    selectedApplication().then((app) => sentOffer(app).then((o) => {
      cy.visit(`/offer/${o.token}`);
      cy.tid('page-title').should('contain.text', 'Internship offer');
      cy.tid('offer-details').should('contain.text', '15,000').and('contain.text', 'Remote');
      cy.tid('offer-status').should('have.attr', 'data-status').and('match', /SENT|VIEWED/);
      cy.tid('offer-valid-until').invoke('text').should('match', /\d{2} \w{3} \d{4}/);

      cy.intercept('POST', '**/offers/public/*/accept').as('accept');
      cy.tid('offer-accept').click();
      cy.wait('@accept').its('response.statusCode').should('eq', 200);
      cy.tid('offer-accepted').should('be.visible');
      cy.tid('offer-intern-id').invoke('text').should('match', /^INT-\d{4}-\d{6}$/).then((internCode) => {
        cy.task('db:find', { collection: 'offers', filter: { offerId: o.offerCode } }).then((rows) => {
          expect(rows[0].status).to.eq('ACCEPTED');
          expect(rows[0].acceptedVia).to.eq('CANDIDATE_LINK');
          expect(rows[0].provisioning.internId, 'offer points at the intern it created').to.be.a('string');
        });
        cy.task('db:find', { collection: 'interns', filter: { internId: internCode } }).then((rows) => {
          expect(rows).to.have.length(1);
          expect(rows[0].status).to.eq('PRE_ONBOARDING');
          expect(rows[0].mentorId).to.eq(fx().users.A.mentor.id);
          cy.task('db:count', { collection: 'onboardingplans', filter: { internId: rows[0]._id } }).should('eq', 1);
          cy.task('db:count', { collection: 'compensationplans', filter: { internId: rows[0]._id } }).should('eq', 1);
          cy.task('db:find', { collection: 'compensationplans', filter: { internId: rows[0]._id } }).its('0.baseAmount').should('eq', 15000);
        });
      });
      cy.task('db:count', { collection: 'users', filter: { email: app.email } }).should('eq', 1);
      cy.task('db:find', { collection: 'users', filter: { email: app.email } }).then((u) => {
        expect(u[0].role).to.eq('INTERN');
        expect(u[0].password, 'the placeholder password is hashed, never the setup token').to.match(/^\$2[aby]\$/);
      });
      cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'OFFER_ACCEPTED');
      cy.task('db:count', { collection: 'auditlogs', filter: { action: 'OFFER_ACCEPTED', entityId: o.offerId } }).should('be.gte', 1);
    }));
  });

  it('after accepting, the candidate sets a password from the one-time link and lands in the intern workspace', () => {
    selectedApplication().then((app) => acceptedOffer(app).then((acc) => {
      cy.visit(acc.setupLink);
      cy.tid('page-title').should('contain.text', 'Set your password');
      cy.tid('set-password-submit').click();
      cy.expectFieldError('password', 'required');
      cy.tid('input-password').type('short1');
      cy.tid('input-confirm').type('short1');
      cy.tid('set-password-submit').click();
      cy.expectFieldError('password', 'at least 8');
      cy.tid('input-password').clear().type('onlyletters');
      cy.tid('input-confirm').clear().type('onlyletters');
      cy.tid('set-password-submit').click();
      cy.expectFieldError('password', 'letter and a number');
      cy.tid('input-password').clear().type('InternPass2026');
      cy.tid('input-confirm').clear().type('Different2026');
      cy.tid('set-password-submit').click();
      cy.expectFieldError('confirm', 'do not match');
      cy.tid('input-confirm').clear().type('InternPass2026');
      cy.tid('set-password-submit').click();
      cy.location('pathname').should('eq', '/intern/dashboard');
      cy.tid('page-title').should('contain.text', 'Welcome');
      cy.tid('onboarding-banner').should('be.visible');
      cy.tid('intern-status').should('have.attr', 'data-status', 'PRE_ONBOARDING');
      // the link works once
      cy.apiPublic('POST', '/auth/setup-password', { token: acc.setupToken, password: 'AnotherPass2026' }).its('status').should('eq', 400);
    }));
  });

  it('reloading after acceptance shows an "already accepted" state with no accept button, and the API answers 409', () => {
    selectedApplication().then((app) => acceptedOffer(app).then((acc) => {
      cy.visit(`/offer/${acc.token}`);
      cy.tid('offer-status').should('have.attr', 'data-status', 'ACCEPTED');
      cy.tid('offer-not-actionable').should('contain.text', 'already accepted');
      cy.get('[data-testid="offer-accept"]').should('not.exist');
      cy.get('[data-testid="offer-decline"]').should('not.exist');
      cy.apiPublic('POST', `/offers/public/${acc.token}/accept`).then((r) => {
        expect(r.status).to.eq(409);
        expect(r.body.error.code).to.eq('OFFER_ALREADY_ACCEPTED');
      });
      cy.apiPublic('POST', `/offers/public/${acc.token}/decline`, {}).its('status').should('eq', 409);
    }));
  });

  it('double-clicking Accept sends one request and creates one intern', () => {
    selectedApplication().then((app) => sentOffer(app).then((o) => {
      let calls = 0;
      cy.intercept('POST', '**/offers/public/*/accept', () => { calls += 1; }).as('accept');
      cy.visit(`/offer/${o.token}`);
      cy.tid('offer-accept').dblclick();
      cy.wait('@accept');
      cy.tid('offer-accepted').should('be.visible').then(() => { expect(calls).to.eq(1); });
      cy.task('db:find', { collection: 'candidates', filter: { email: app.email } }).then((c) => cy.task('db:count', { collection: 'interns', filter: { candidateId: c[0]._id } }).should('eq', 1));
    }));
  });

  it('five simultaneous acceptances: exactly one wins, four get OFFER_ALREADY_ACCEPTED, and nothing is duplicated', () => {
    selectedApplication().then((app) => sentOffer(app).then((o) => {
      cy.task('api:race', { url: `${API()}/offers/public/${o.token}/accept`, count: 5, body: {} }).then((results) => {
        expect(results.map((r) => r.status).sort(), JSON.stringify(results)).to.deep.eq([200, 409, 409, 409, 409]);
        results.filter((r) => r.status === 409).forEach((r) => expect(r.code).to.eq('OFFER_ALREADY_ACCEPTED'));
        expect(results.filter((r) => r.status === 200), 'only ONE response carries the one-time setup link').to.have.length(1);
      });
      provisioned(app).then((p) => {
        expect(p.users, 'users').to.eq(1);
        expect(p.interns, 'interns').to.eq(1);
        expect(p.plans, 'onboarding plans').to.eq(1);
      });
    }));
  });

  it('acceptance by HR on behalf of the candidate records the channel, and races the candidate link safely', () => {
    selectedApplication().then((app) => sentOffer(app).then((o) => {
      cy.loginAs('hradmin');
      cy.visit('/admin/offers');
      cy.tid('input-status').select('SENT');
      cy.tid(`offer-accept-behalf-${o.offerId}`).click();
      cy.modal('accept-behalf-modal');
      cy.tid('accept-behalf-modal-submit').click();
      cy.expectFieldError('note', 'Note is required');
      cy.tid('input-channel').select('PHONE');
      cy.tid('input-note').type('Confirmed by phone with the candidate at 4 pm');
      cy.tid('accept-behalf-modal-submit').click();
      cy.expectToast('success', 'Acceptance recorded');
      cy.modal('link-modal');
      cy.tid('secure-link-value').invoke('val').should('contain', '/set-password?token=');
      cy.tid('link-modal-done').click();
      cy.task('db:find', { collection: 'offers', filter: { offerId: o.offerCode } }).then((r) => {
        expect(r[0].status).to.eq('ACCEPTED');
        expect(r[0].acceptedVia).to.eq('HR_ON_BEHALF');
        expect(r[0].acceptanceNote).to.contain('[PHONE]');
      });
      // the candidate's own link is now dead
      cy.apiPublic('POST', `/offers/public/${o.token}/accept`).its('status').should('eq', 409);
    }));
  });
});

describe('Offers: atomic provisioning (all or nothing)', () => {
  ['application', 'user', 'intern', 'onboarding', 'compensation', 'links'].forEach((step) => {
    it(`a failure after the "${step}" step rolls everything back and leaves the offer acceptable`, () => {
      selectedApplication().then((app) => sentOffer(app).then((o) => {
        cy.apiLogin('hradmin').then((auth) => {
          cy.request({
            method: 'POST', url: `${API()}/offers/${o.offerId}/accept`, failOnStatusCode: false,
            headers: { Authorization: `Bearer ${auth.token}`, 'x-qa-fail-step': step }, body: { channel: 'EMAIL', note: 'Injected failure test' }
          }).then((r) => { expect(r.status, `fault after ${step}`).to.eq(500); });
        });
        // nothing half-created: no user, no intern, no plan; offer and application are exactly where they were
        cy.task('db:count', { collection: 'users', filter: { email: app.email } }).should('eq', 0);
        cy.task('db:find', { collection: 'candidates', filter: { email: app.email } }).then((c) => {
          cy.task('db:count', { collection: 'interns', filter: { candidateId: c[0]._id } }).should('eq', 0);
          cy.task('db:count', { collection: 'onboardingplans', filter: { candidateId: c[0]._id } }).should('eq', 0);
          expect(c[0].userId, 'candidate is not linked to a user').to.be.undefined;
        });
        cy.task('db:find', { collection: 'offers', filter: { offerId: o.offerCode } }).its('0.status').should('be.oneOf', ['SENT', 'VIEWED']);
        cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'OFFER_SENT');
        // and the same offer can still be accepted afterwards
        cy.apiPublic('POST', `/offers/public/${o.token}/accept`).its('status').should('eq', 200);
        cy.task('db:count', { collection: 'users', filter: { email: app.email } }).should('eq', 1);
      }));
    });
  });

  it('an email that already belongs to a staff account cannot be turned into an intern (nothing is created)', () => {
    selectedApplication({ email: fx().users.A.mentor.email }).then((app) => sentOffer(app).then((o) => {
      cy.apiPublic('POST', `/offers/public/${o.token}/accept`).then((r) => {
        expect(r.status).to.eq(409);
        expect(r.body.error.code).to.eq('EMAIL_BELONGS_TO_STAFF');
      });
      cy.task('db:count', { collection: 'users', filter: { email: fx().users.A.mentor.email } }).should('eq', 1);
      cy.api('mentor', 'GET', '/interns/me').its('status').should('eq', 404);
    }));
  });
});

describe('Offers: expiry, decline and invalid links', () => {
  it('an expired offer is shown as expired and cannot be accepted', () => {
    selectedApplication().then((app) => sentOffer(app).then((o) => {
      cy.task('db:expireOffer', { offerId: o.offerCode }).should('eq', 1);
      cy.visit(`/offer/${o.token}`);
      cy.tid('offer-expired').should('be.visible');
      cy.apiPublic('POST', `/offers/public/${o.token}/accept`).then((r) => {
        expect(r.status).to.eq(410);
        expect(r.body.error.code).to.eq('OFFER_EXPIRED');
      });
      cy.task('db:count', { collection: 'users', filter: { email: app.email } }).should('eq', 0);
      cy.loginAs('hradmin');
      cy.api('hradmin', 'GET', `/offers/${o.offerId}`).its('body.data.status').should('eq', 'EXPIRED');
      cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'OFFER_EXPIRED');
    }));
  });

  it('declining requires confirmation, records the reason and releases the candidate to apply again', () => {
    selectedApplication().then((app) => sentOffer(app).then((o) => {
      cy.visit(`/offer/${o.token}`);
      cy.tid('offer-decline').click();
      cy.modal('decline-modal');
      cy.tid('input-declineReason').type('I accepted another position');
      cy.tid('offer-decline-confirm').click();
      cy.tid('offer-declined').should('be.visible');
      cy.task('db:find', { collection: 'offers', filter: { offerId: o.offerCode } }).then((r) => {
        expect(r[0].status).to.eq('DECLINED');
        expect(r[0].declineReason).to.eq('I accepted another position');
      });
      cy.api('hradmin', 'GET', `/recruitment/applications/${app.id}`).its('body.data.status').should('eq', 'OFFER_DECLINED');
      cy.apiPublic('POST', `/offers/public/${o.token}/accept`).its('status').should('eq', 409);
      cy.apiApply(fx().ids.openingA, { email: app.email }).its('status').should('eq', 201);
    }));
  });

  it('a malformed or unknown link shows a clear invalid state and leaks nothing', () => {
    ['not-a-real-token', 'a'.repeat(43), '%00%00'].forEach((t) => {
      cy.visit(`/offer/${t}`, { failOnStatusCode: false });
      cy.tid('offer-invalid').should('be.visible');
    });
    cy.apiPublic('GET', `/offers/public/${'b'.repeat(43)}`).then((r) => {
      expect(r.status).to.eq(404);
      expect(JSON.stringify(r.body)).not.to.match(/stipend|candidate|email/i);
    });
  });

  it('the offer link is stored only as a hash: the database never contains the token itself', () => {
    selectedApplication().then((app) => sentOffer(app).then((o) => {
      cy.task('db:find', { collection: 'offers', filter: { offerId: o.offerCode } }).then((r) => {
        const dump = JSON.stringify(r[0]);
        expect(dump).not.to.contain(o.token);
        expect(r[0].acceptTokenHash).to.match(/^[a-f0-9]{64}$/);
      });
    }));
  });
});

describe('Offers: the new intern can work with the account that acceptance created', () => {
  it('signs in with the password they chose and sees only their own workspace', () => {
    selectedApplication().then((app) => acceptedOffer(app).then((acc) => activatedAccount(acc, app).then((acct) => {
      cy.apiWithToken(acct.token, 'GET', '/interns/me').then((r) => {
        expect(r.status).to.eq(200);
        expect(r.body.data.intern.internId).to.eq(acc.internCode);
        expect(r.body.data.intern.status).to.eq('PRE_ONBOARDING');
      });
      cy.apiWithToken(acct.token, 'GET', '/interns').its('status').should('eq', 403);
      cy.apiWithToken(acct.token, 'GET', '/finance/payments').its('status').should('eq', 403);
    })));
  });
});
