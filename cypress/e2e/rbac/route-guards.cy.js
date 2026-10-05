import { ALLOWED, ROLE_KEYS, SCREENS } from '../../support/rbac-matrix';

/**
 * RBAC, UI layer: every role x every private screen.
 * An allowed screen renders its own title; a refused one renders the access-denied page instead.
 * The API is checked separately (api-authorization.cy.js): hiding a screen is a courtesy, the API is the authority.
 */
describe('RBAC: route guards for every role and screen', () => {
  ROLE_KEYS.forEach((role) => {
    it(`${role}: allowed screens open, every other screen is refused`, () => {
      cy.visitAs(role, '/account');
      cy.tid('page-title').should('contain.text', 'Account');
      const failures = [];
      SCREENS.forEach((screen) => {
        const shouldOpen = ALLOWED[role].includes(screen.key);
        cy.navigateClient(screen.path);
        if (shouldOpen) {
          cy.tid('page-title').should('be.visible');
          cy.get('[data-testid="page-forbidden"]').should('not.exist');
        } else {
          cy.tid('page-forbidden').should('be.visible');
          cy.get('[data-testid="page-title"]').should('not.exist');
        }
      });
      cy.wrap(failures).should('have.length', 0);
    });
  });

  it('a visitor without a session is redirected to login from every private URL', () => {
    cy.clearAllLocalStorage();
    ['/admin/finance', '/admin/interns/123456789012345678901234', '/intern/tasks', '/mentor/dashboard', '/account'].forEach((p) => {
      cy.visit(p);
      cy.location('pathname').should('eq', '/login');
    });
  });

  it('after signing in the user returns to the page they originally asked for', () => {
    cy.clearAllLocalStorage();
    cy.visit('/admin/interns');
    cy.location('pathname').should('eq', '/login');
    cy.tid('input-email').type(Cypress.expose('fx').users.A.hradmin.email);
    cy.tid('input-password').type(Cypress.expose('fx').password, { log: false });
    cy.tid('login-submit').click();
    cy.location('pathname').should('eq', '/admin/interns');
  });

  it('only a global administrator can open the Global Command Center', () => {
    cy.visitAs('orgadmin', '/admin/global-command');
    cy.tid('page-forbidden').should('be.visible');
    cy.visitAs('superadmin', '/admin/global-command');
    cy.tid('page-title').should('contain.text', 'Global command center');
  });

  it('an intern who types an admin URL sees the denial page, not a blank screen', () => {
    cy.visitAs('intern', '/admin/finance');
    cy.tid('page-forbidden').should('be.visible');
    cy.tid('forbidden-home').click();
    cy.location('pathname').should('eq', '/intern/dashboard');
  });
});
