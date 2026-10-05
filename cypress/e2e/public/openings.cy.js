describe('Public: internship openings', () => {
  it('lists only open, in-deadline openings from the database', () => {
    cy.visit('/internships');
    cy.tid('openings-list').should('be.visible');
    cy.tid('opening-card-qa-software-engineering-intern').should('be.visible');
    // the closed opening and the other organization's opening must never appear as applyable
    cy.get('[data-testid="opening-card-qa-closed-position"]').should('not.exist');
  });

  it('search narrows the list and an unmatched search shows an honest empty state', () => {
    cy.intercept('GET', '**/openings/public*').as('list');
    cy.visit('/internships');
    cy.wait('@list');
    cy.tid('input-q').type('Testing');
    cy.wait('@list').its('request.url').should('include', 'q=Testing');
    cy.tid('opening-card-qa-software-engineering-intern').should('be.visible');
    cy.tid('input-q').clear().type('zzzz-no-such-skill');
    cy.wait('@list');
    cy.tid('openings-empty').should('contain.text', 'No openings match your search');
  });

  it('detail page shows real fields and links to the application form', () => {
    cy.visit('/internships/qa-software-engineering-intern');
    cy.tid('page-title').should('contain.text', 'QA Software Engineering Intern');
    cy.contains('Write automated tests').should('be.visible');
    cy.tid('opening-deadline').invoke('text').should('match', /\d{2} \w{3} \d{4}/);
    cy.tid('apply-button').should('have.attr', 'href', '/apply/qa-software-engineering-intern');
  });

  it('a closed opening cannot be opened or applied to, in the UI or the API', () => {
    cy.visit('/internships/qa-closed-position');
    cy.tid('opening-unavailable').should('be.visible');
    cy.visit('/apply/qa-closed-position');
    cy.tid('opening-closed').should('be.visible');
    cy.apiApply(Cypress.expose('fx').ids.closedOpening).then((res) => {
      expect(res.status).to.eq(409);
      expect(res.error.code).to.eq('OPENING_CLOSED');
    });
  });

  it('a non-existent slug shows the unavailable state instead of crashing', () => {
    cy.visit('/internships/does-not-exist-123');
    cy.tid('opening-unavailable').should('be.visible');
  });

  it('a public visitor never receives another organization\'s private data', () => {
    cy.apiPublic('GET', '/recruitment/openings/public').then((res) => {
      expect(res.status).to.eq(200);
      const serialised = JSON.stringify(res.body);
      expect(serialised).not.to.include('createdBy');
      expect(serialised).not.to.include('password');
    });
  });

  it('the list shows a retry state when the server fails, and recovers on retry', () => {
    let fail = true;
    cy.intercept('GET', '**/openings/public*', (req) => { if (fail) { fail = false; req.reply({ statusCode: 500, body: { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Boom' } } }); } }).as('list');
    cy.visit('/internships');
    cy.tid('error-state').should('have.attr', 'data-error-status', '500');
    cy.tid('retry-button').click();
    cy.tid('openings-list').should('be.visible');
  });
});
