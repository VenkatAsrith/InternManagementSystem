import { ALLOWED, OWN_SCOPE_API, ROLE_KEYS, SCREENS } from '../../support/rbac-matrix';

/**
 * RBAC, API layer (the authority). Same matrix as the UI test, checked against real HTTP responses:
 * an allowed role gets 200, everybody else gets 403 - never data, never a 500.
 */
describe('RBAC: API authorization for every role and read endpoint', () => {
  ROLE_KEYS.forEach((role) => {
    it(`${role}: read endpoints answer 200 or 403 exactly as the matrix says`, () => {
      SCREENS.filter((s) => s.endpoint).forEach((screen) => {
        const expected = ALLOWED[role].includes(screen.key) || (OWN_SCOPE_API[role] || []).includes(screen.key) ? 200 : 403;
        cy.api(role, 'GET', screen.endpoint).then((res) => {
          expect(res.status, `${role} GET ${screen.endpoint}`).to.eq(expected);
          if (expected === 403) expect(res.body.error.code, `${role} ${screen.endpoint}`).to.match(/FORBIDDEN|NOT_ASSIGNABLE|PERMISSION/);
        });
      });
    });
  });

  it('read-own endpoints return only the caller own records, never another intern work', () => {
    const fx = Cypress.expose('fx');
    cy.api('intern', 'GET', '/tasks').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.data.length, 'tasks').to.be.greaterThan(0);
      res.body.data.forEach((t) => expect(t.assignedTo.map((a) => a._id), `task ${t.title}`).to.include(fx.users.A.intern.id));
      expect(res.body.data.map((t) => t._id)).not.to.include(fx.ids.taskB);
    });
    cy.api('intern', 'GET', `/tasks/${fx.ids.taskB}`).its('status').should('eq', 404);
    cy.api('intern', 'GET', '/journals').its('body.data').then((rows) => rows.forEach((j) => expect(j.userId._id).to.eq(fx.users.A.intern.id)));
    cy.api('intern', 'GET', '/performance/reviews').its('body.data').then((rows) => rows.forEach((r) => expect(r.userId._id).to.eq(fx.users.A.intern.id)));
  });

  it('no request without a token is answered with data', () => {
    SCREENS.filter((s) => s.endpoint).forEach((s) => cy.apiPublic('GET', s.endpoint).its('status').should('eq', 401));
  });

  it('a token supplied in the query string is ignored', () => {
    cy.apiLogin('hradmin').then((auth) => {
      cy.apiPublic('GET', `/interns?token=${auth.token}`).its('status').should('eq', 401);
    });
  });

  it('write endpoints refuse roles that lack the write permission (403), even when they can read', () => {
    // FINANCE_VIEWER can read payments but must not generate, adjust or pay.
    cy.api('financeviewer', 'POST', '/finance/generate-cycle', { cycle: '2026-01' }).its('status').should('eq', 403);
    cy.api('financeviewer', 'POST', '/finance/compensation', { internId: Cypress.expose('fx').ids.intern, compensationType: 'MONTHLY_STIPEND', baseAmount: 1 }).its('status').should('eq', 403);
    // HR_ADMIN reads finance but must not disburse (segregation of duties).
    cy.api('hradmin', 'POST', '/finance/payments/000000000000000000000000/process', { paymentReference: 'REF-0001' }).its('status').should('eq', 403);
    // MENTOR cannot create users, roles, offers or programs.
    cy.api('mentor', 'POST', '/users', { firstName: 'X', lastName: 'Y', email: 'x@y.test', role: 'HR_ADMIN' }).its('status').should('eq', 403);
    cy.api('mentor', 'POST', '/roles', { key: 'EVIL', label: 'Evil', permissions: ['*'] }).its('status').should('eq', 403);
    cy.api('mentor', 'POST', '/offers', {}).its('status').should('eq', 403);
    cy.api('mentor', 'POST', '/recruitment/programs', {}).its('status').should('eq', 403);
    // INTERN cannot reach any staff mutation.
    cy.api('intern', 'PATCH', `/interns/${Cypress.expose('fx').ids.intern}`, { status: 'ACTIVE' }).its('status').should('eq', 403);
    cy.api('intern', 'POST', '/tasks', { title: 'x' }).its('status').should('eq', 403);
    cy.api('intern', 'POST', '/certificates/generate', { internId: Cypress.expose('fx').ids.intern }).its('status').should('eq', 403);
  });

  it('privilege escalation is blocked: nobody can grant a role or permission they do not hold', () => {
    const fx = Cypress.expose('fx');
    // HR_ADMIN may not make anyone SUPER_ADMIN or ORGANIZATION_ADMIN.
    cy.api('hradmin', 'POST', '/roles/assign', { userId: fx.users.A.mentor2.id, newRoleKey: 'SUPER_ADMIN', reason: 'test escalation' }).its('status').should('eq', 403);
    cy.api('hradmin', 'POST', '/roles/assign', { userId: fx.users.A.mentor2.id, newRoleKey: 'ORGANIZATION_ADMIN', reason: 'test escalation' }).its('status').should('eq', 403);
    // Nobody changes their own role.
    cy.api('orgadmin', 'POST', '/roles/assign', { userId: fx.users.A.orgadmin.id, newRoleKey: 'HR_ADMIN', reason: 'self change' }).its('status').should('eq', 403);
    // A custom role may not contain the wildcard nor permissions its creator lacks.
    cy.api('orgadmin', 'POST', '/roles', { key: 'ALL_ACCESS', label: 'All', permissions: ['*'] }).its('status').should('be.oneOf', [403, 422]);
    cy.api('hradmin', 'POST', '/roles', { key: 'HR_SUPER', label: 'HR super', permissions: ['finance.process'] }).its('status').should('eq', 403);
    // INTERN and CANDIDATE accounts are never created by hand.
    cy.api('orgadmin', 'POST', '/users', { firstName: 'Fake', lastName: 'Intern', email: `fake.${Date.now()}@tmt-qa.test`, role: 'INTERN' }).its('status').should('eq', 422);
  });

  it('a forged or tampered JWT is rejected with 401', () => {
    cy.apiLogin('intern').then((auth) => {
      const [h, p, s] = auth.token.split('.');
      const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
      payload.role = 'SUPER_ADMIN';
      const forged = `${h}.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.${s}`;
      cy.apiWithToken(forged, 'GET', '/audit-logs').its('status').should('eq', 401);
      cy.apiWithToken(`${h}.${p}.AAAA`, 'GET', '/interns/me').its('status').should('eq', 401);
      cy.apiWithToken('not.a.jwt', 'GET', '/interns/me').its('status').should('eq', 401);
      // The claimed role inside a valid token is not what grants access: permissions come from the database.
      cy.apiWithToken(auth.token, 'GET', '/audit-logs').its('status').should('eq', 403);
    });
  });
});
