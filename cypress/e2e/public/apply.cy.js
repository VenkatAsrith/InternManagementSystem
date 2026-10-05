import { uid } from '../../support/commands';

const SLUG = 'qa-software-engineering-intern';
const pdf = (name = 'resume.pdf') => ({ contents: Cypress.Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< >>\n%%EOF\n'), fileName: name, mimeType: 'application/pdf' });

function fillValid(email, overrides = {}) {
  const v = { firstName: 'Casey', lastName: `Tester${uid()}`, email, phone: '+91 98765 43210', college: 'QA Institute of Technology', degree: 'B.Tech', branch: 'Computer Science', graduationYear: '2027', ...overrides };
  cy.tid('input-firstName').type(v.firstName);
  cy.tid('input-lastName').type(v.lastName);
  cy.tid('input-email').type(v.email);
  cy.tid('input-phone').type(v.phone);
  cy.tid('input-college').type(v.college);
  cy.tid('input-degree').type(v.degree);
  cy.tid('input-branch').type(v.branch);
  cy.tid('input-graduationYear').type(v.graduationYear);
  return v;
}

describe('Public: application form', () => {
  beforeEach(() => { cy.visit(`/apply/${SLUG}`); cy.tid('application-form').should('be.visible'); });

  it('submitting an empty form lists every missing required field and sends nothing', () => {
    cy.intercept('POST', '**/applications/public', cy.spy().as('submit'));
    cy.tid('apply-submit').click();
    ['firstName', 'lastName', 'email', 'phone', 'college', 'degree', 'branch', 'graduationYear', 'resume', 'privacyConsent'].forEach((f) => cy.expectFieldError(f));
    cy.get('@submit').should('not.have.been.called');
    cy.focused().should('have.attr', 'data-testid', 'input-firstName');
  });

  it('validates formats: email, phone, graduation year and URLs', () => {
    cy.tid('input-email').type('bad@');
    cy.tid('input-phone').type('12');
    cy.tid('input-graduationYear').type('1850');
    cy.tid('input-github').type('javascript:alert(1)');
    cy.tid('input-portfolio').type('ftp://example.com');
    cy.tid('apply-submit').click();
    cy.expectFieldError('email', 'valid email');
    cy.expectFieldError('phone', 'valid phone');
    cy.expectFieldError('graduationYear', 'at least 1990');
    cy.expectFieldError('github', 'http');
    cy.expectFieldError('portfolio', 'http');
  });

  it('rejects a non-document resume and an oversized resume before uploading', () => {
    cy.tid('input-resume').selectFile({ contents: Cypress.Buffer.from('MZ binary'), fileName: 'virus.exe', mimeType: 'application/x-msdownload' }, { force: true });
    cy.tid('apply-submit').click();
    cy.expectFieldError('resume', 'PDF, DOC or DOCX');
    cy.tid('input-resume').selectFile({ contents: Cypress.Buffer.alloc(10 * 1024 * 1024 + 10, 1), fileName: 'huge.pdf', mimeType: 'application/pdf' }, { force: true });
    cy.tid('apply-submit').click();
    cy.expectFieldError('resume', 'smaller than 10 MB');
  });

  it('the server rejects a file whose content is not a real PDF even if it claims to be one', () => {
    fillValid(`qa.fake.${uid()}@tmt-qa.test`);
    cy.tid('input-resume').selectFile({ contents: Cypress.Buffer.from('<html><script>alert(1)</script></html>'), fileName: 'resume.pdf', mimeType: 'application/pdf' }, { force: true });
    cy.tid('input-privacyConsent').check();
    cy.tid('apply-submit').click();
    cy.tid('form-error').should('contain.text', 'does not match').and('have.attr', 'data-error-code', 'FILE_CONTENT_MISMATCH');
    cy.location('pathname').should('eq', `/apply/${SLUG}`);
  });

  it('privacy consent is mandatory', () => {
    fillValid(`qa.consent.${uid()}@tmt-qa.test`);
    cy.tid('input-resume').selectFile(pdf(), { force: true });
    cy.tid('apply-submit').click();
    cy.expectFieldError('privacyConsent', 'accept');
  });

  it('a valid application is stored, confirmed from the server, and trackable by its ID', () => {
    const email = `qa.ok.${uid()}@tmt-qa.test`;
    const v = fillValid(email);
    cy.tid('input-city').type('Pune');
    cy.tid('input-technicalSkills').type('React, Node.js, Testing');
    cy.tid('input-coverLetter').type('I would like to learn.');
    cy.tid('input-resume').selectFile(pdf(), { force: true });
    cy.tid('input-privacyConsent').check();
    cy.intercept('POST', '**/applications/public').as('apply');
    cy.tid('apply-submit').click();
    cy.wait('@apply').its('response.statusCode').should('eq', 201);

    cy.location('pathname').should('eq', '/application/success');
    cy.tid('page-title').should('contain.text', 'Application received');
    cy.tid('application-id').invoke('text').should('match', /^APP-\d{4}-\d{6}$/).then((appId) => {
      // the database really contains this person and this application
      cy.task('db:find', { collection: 'candidates', filter: { email } }).then((rows) => {
        expect(rows, 'candidate rows').to.have.length(1);
        expect(rows[0].firstName).to.eq(v.firstName);
        expect(rows[0].technicalSkills).to.deep.eq(['React', 'Node.js', 'Testing']);
      });
      cy.task('db:find', { collection: 'applications', filter: { applicationId: appId } }).then((rows) => {
        expect(rows).to.have.length(1);
        expect(rows[0].status).to.eq('APPLIED');
        expect(rows[0].privacyConsent).to.eq(true);
        expect(rows[0].resumePath).to.be.a('string').and.not.be.empty;
      });
      // the tracker shows the same truth
      cy.tid('track-application').click();
      cy.location('pathname').should('eq', '/application/status');
      cy.tid('status-result').should('contain.text', appId).and('contain.text', 'Applied');
    });
  });

  it('applying twice for the same opening with the same email is refused with a clear message', () => {
    const email = `qa.dup.${uid()}@tmt-qa.test`;
    cy.apiApply(Cypress.expose('fx').ids.openingA, { email }).its('status').should('eq', 201);
    fillValid(email);
    cy.tid('input-resume').selectFile(pdf(), { force: true });
    cy.tid('input-privacyConsent').check();
    cy.tid('apply-submit').click();
    cy.tid('duplicate-application').should('be.visible').and('contain.text', 'already applied');
    cy.task('db:find', { collection: 'candidates', filter: { email } }).then((c) => cy.task('db:count', { collection: 'applications', filter: { candidateId: c[0]._id } }).should('eq', 1));
  });

  it('double-clicking Submit creates exactly one application', () => {
    const email = `qa.dbl.${uid()}@tmt-qa.test`;
    fillValid(email);
    cy.tid('input-resume').selectFile(pdf(), { force: true });
    cy.tid('input-privacyConsent').check();
    const calls = [];
    cy.intercept('POST', '**/applications/public', (req) => { calls.push(1); }).as('apply');
    cy.tid('apply-submit').dblclick();
    cy.wait('@apply');
    cy.location('pathname').should('eq', '/application/success').then(() => { expect(calls).to.have.length(1); });
    cy.task('db:find', { collection: 'candidates', filter: { email } }).then((c) => cy.task('db:count', { collection: 'applications', filter: { candidateId: c[0]._id } }).should('eq', 1));
  });

  it('a server error keeps every typed value and shows why it failed', () => {
    const email = `qa.err.${uid()}@tmt-qa.test`;
    const v = fillValid(email);
    cy.tid('input-resume').selectFile(pdf(), { force: true });
    cy.tid('input-privacyConsent').check();
    cy.intercept('POST', '**/applications/public', { statusCode: 500, body: { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred. Please try again or contact support.' } } }).as('apply');
    cy.tid('apply-submit').click();
    cy.wait('@apply');
    cy.tid('form-error').should('contain.text', 'unexpected error');
    cy.tid('input-email').should('have.value', email);
    cy.tid('input-lastName').should('have.value', v.lastName);
    cy.location('pathname').should('eq', `/apply/${SLUG}`);
  });

  it('server-side field errors (422) appear on the matching fields', () => {
    fillValid(`qa.srv.${uid()}@tmt-qa.test`, { phone: '+91 98765 43210' });
    cy.tid('input-resume').selectFile(pdf(), { force: true });
    cy.tid('input-privacyConsent').check();
    cy.intercept('POST', '**/applications/public', { statusCode: 422, body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed.', details: [{ field: 'college', message: 'college must be at most 200 characters' }] } } });
    cy.tid('apply-submit').click();
    cy.expectFieldError('college', 'at most 200');
    cy.focused().should('have.attr', 'data-testid', 'input-college');
  });

  it('the tracker rejects malformed IDs and reports unknown ones honestly', () => {
    cy.visit('/application/status');
    cy.tid('input-applicationId').type('hello');
    cy.tid('status-submit').click();
    cy.expectFieldError('applicationId', 'APP-2026-000123');
    cy.tid('input-applicationId').clear().type('APP-2026-999999');
    cy.tid('status-submit').click();
    cy.tid('status-not-found').should('be.visible');
  });

  it('the success page refuses to show a made-up confirmation', () => {
    cy.visit('/application/success?id=APP-2026-999999');
    cy.tid('success-missing').should('be.visible');
    cy.visit('/application/success');
    cy.tid('success-missing').should('be.visible');
  });
});
