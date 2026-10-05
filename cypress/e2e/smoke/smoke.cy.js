/**
 * SMOKE: the platform is alive, the public pages render, and nothing logs a console error.
 * These are the first tests to run; if any fails, nothing deeper is worth running.
 */
describe('Smoke: platform is up', () => {
  it('API health endpoint reports a connected database', () => {
    cy.request(`${Cypress.expose('apiUrl')}/health`).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.status).to.eq('ok');
      expect(res.body.database).to.eq('connected');
      expect(res.body.environment).to.eq('qa');
    });
  });

  it('unknown API routes answer with a JSON 404, never HTML or a stack trace', () => {
    cy.request({ url: `${Cypress.expose('apiUrl')}/api/v1/does-not-exist`, failOnStatusCode: false }).then((res) => {
      expect(res.status).to.eq(404);
      expect(res.body.success).to.eq(false);
      expect(res.body.error.code).to.eq('ROUTE_NOT_FOUND');
      expect(JSON.stringify(res.body)).not.to.match(/at .*\.js:\d+/);
    });
  });

  it('home page renders with the deterministic opening from the database', () => {
    cy.visit('/');
    cy.tid('page-title').should('contain.text', 'real engineering work');
    cy.tid('home-openings').should('be.visible');
    cy.tid('opening-card-qa-software-engineering-intern').should('contain.text', 'QA Software Engineering Intern');
  });

  it('openings list, opening detail and application form are reachable', () => {
    cy.visit('/internships');
    cy.tid('openings-list').should('be.visible');
    cy.tid('opening-view-qa-software-engineering-intern').click();
    cy.location('pathname').should('eq', '/internships/qa-software-engineering-intern');
    cy.tid('page-title').should('contain.text', 'QA Software Engineering Intern');
    cy.tid('apply-button').click();
    cy.location('pathname').should('eq', '/apply/qa-software-engineering-intern');
    cy.tid('application-form').should('be.visible');
  });

  it('login page renders without any demo credentials', () => {
    cy.visit('/login');
    cy.tid('login-form').should('be.visible');
    cy.get('body').should('not.contain.text', 'Password2026');
    cy.get('body').should('not.contain.text', 'One-Click');
  });

  it('unknown URLs show the friendly 404 page', () => {
    cy.visit('/this/route/does/not/exist');
    cy.tid('page-not-found').should('be.visible');
  });

  it('tracker and verification pages render', () => {
    cy.visit('/application/status');
    cy.tid('status-form').should('be.visible');
    cy.visit('/verify/certificate');
    cy.tid('verify-form').should('be.visible');
  });

  it('a signed-out visitor is sent from a private URL to the login page', () => {
    cy.visit('/admin/dashboard');
    cy.location('pathname').should('eq', '/login');
  });
});
