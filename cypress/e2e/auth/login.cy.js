import { fx, PASSWORD } from '../../support/commands';

// Where each of the 14 roles must land after signing in.
const LANDING = [
  ['superadmin', '/admin/global-command'],
  ['orgadmin', '/admin/dashboard'],
  ['hradmin', '/admin/dashboard'],
  ['recruiter', '/admin/dashboard'],
  ['manager', '/admin/dashboard'],
  ['mentor', '/mentor/dashboard'],
  ['lead', '/mentor/dashboard'],
  ['interviewer', '/admin/interviews'],
  ['finance', '/admin/finance'],
  ['financeviewer', '/admin/finance'],
  ['documentadmin', '/admin/documents'],
  ['auditor', '/admin/dashboard'],
  ['intern', '/intern/dashboard'],
  ['candidate', '/account']
];

describe('Authentication: login form', () => {
  beforeEach(() => { cy.clearAllLocalStorage(); });

  LANDING.forEach(([key, path]) => {
    it(`${key} signs in through the form and lands on ${path}`, () => {
      const user = fx().users.A[key];
      cy.intercept('POST', '**/auth/login').as('login');
      cy.uiLogin(user.email, PASSWORD());
      cy.wait('@login').its('response.statusCode').should('eq', 200);
      cy.location('pathname').should('eq', path);
      cy.tid('page-title').should('be.visible');
      cy.tid('user-role').should('contain.text', user.role);
      cy.window().then((win) => {
        expect(win.localStorage.getItem('ims_token'), 'access token stored').to.be.a('string').and.not.be.empty;
      });
    });
  });

  it('wrong password shows a clear error, stores no token and stays on the login page', () => {
    cy.intercept('POST', '**/auth/login').as('login');
    cy.uiLogin(fx().users.A.hradmin.email, 'definitely-wrong-1');
    cy.wait('@login').its('response.statusCode').should('eq', 401);
    cy.tid('form-error').should('contain.text', 'Invalid credentials').and('have.attr', 'data-error-code', 'INVALID_CREDENTIALS');
    cy.location('pathname').should('eq', '/login');
    cy.window().then((win) => { expect(win.localStorage.getItem('ims_token')).to.be.null; });
  });

  it('an unknown email gets the same message as a wrong password (no account enumeration)', () => {
    cy.uiLogin('nobody.here@tmt-qa.test', 'Whatever123');
    cy.tid('form-error').should('contain.text', 'Invalid credentials');
  });

  it('empty submit shows field errors and sends no request', () => {
    cy.intercept('POST', '**/auth/login', cy.spy().as('loginCall'));
    cy.visit('/login');
    cy.tid('login-submit').click();
    cy.expectFieldError('email', 'Email is required');
    cy.expectFieldError('password', 'Password is required');
    cy.get('@loginCall').should('not.have.been.called');
    cy.focused().should('have.attr', 'data-testid', 'input-email');
  });

  it('a malformed email is rejected client-side with a specific message', () => {
    cy.visit('/login');
    cy.tid('input-email').type('not-an-email');
    cy.tid('input-password').type('x');
    cy.tid('login-submit').click();
    cy.expectFieldError('email', 'valid email');
  });

  it('double-clicking Sign in sends exactly one request', () => {
    const calls = [];
    cy.intercept('POST', '**/auth/login', (req) => { calls.push(1); }).as('login');
    cy.visit('/login');
    cy.tid('input-email').type(fx().users.A.hradmin.email);
    cy.tid('input-password').type(PASSWORD(), { log: false });
    cy.tid('login-submit').dblclick();
    cy.wait('@login');
    cy.location('pathname').should('eq', '/admin/dashboard').then(() => { expect(calls).to.have.length(1); });
  });

  it('the password field is masked and the form has autocomplete hints', () => {
    cy.visit('/login');
    cy.tid('input-password').should('have.attr', 'type', 'password').and('have.attr', 'autocomplete', 'current-password');
    cy.tid('input-email').should('have.attr', 'autocomplete', 'username');
  });

  it('a NoSQL-injection style email cannot bypass the API (422, never 500)', () => {
    cy.apiPublic('POST', '/auth/login', { email: { $gt: '' }, password: PASSWORD() }).its('status').should('eq', 422);
  });

  it('a deactivated user cannot sign in and is told why', () => {
    // A throw-away account, so no shared fixture is disturbed.
    const email = `qa.deact.${Date.now()}@tmt-qa.test`;
    cy.api('orgadmin', 'POST', '/users', { firstName: 'Deact', lastName: 'Ivated', email, role: 'HR_RECRUITER' }).then((res) => {
      expect(res.status).to.eq(201);
      const token = new URL(res.body.data.setupLink).searchParams.get('token');
      cy.apiPublic('POST', '/auth/setup-password', { token, password: 'Deact2026pass' }).its('status').should('eq', 200);
      cy.api('orgadmin', 'POST', `/users/${res.body.data.user._id}/deactivate`, {}).its('status').should('eq', 200);
    });
    cy.uiLogin(email, 'Deact2026pass');
    cy.tid('form-error').should('contain.text', 'deactivated').and('have.attr', 'data-error-code', 'ACCOUNT_INACTIVE');
  });

  it('an already signed-in user who opens /login is sent to their workspace', () => {
    cy.loginAs('hradmin');
    cy.visit('/login');
    cy.location('pathname').should('eq', '/admin/dashboard');
  });
});

describe('Authentication: session lifecycle', () => {
  it('logout clears every stored credential and protects private pages afterwards', () => {
    cy.intercept('POST', '**/auth/logout').as('logout');
    cy.visitAs('hradmin', '/admin/dashboard');
    cy.tid('page-title').should('contain.text', 'Dashboard');
    cy.logoutViaUi();
    cy.wait('@logout');
    cy.window().then((win) => {
      ['ims_token', 'ims_refresh', 'ims_user'].forEach((k) => expect(win.localStorage.getItem(k), k).to.be.null);
    });
    cy.tid('session-ended').should('contain.text', 'signed out');
    cy.visit('/admin/interns');
    cy.location('pathname').should('eq', '/login');
    cy.go('back');
    cy.tid('login-form').should('be.visible');
  });

  it('the refresh token is revoked server-side on logout (it cannot be reused)', () => {
    cy.apiLoginRaw(fx().users.A.hradmin.email, PASSWORD()).then((res) => {
      const { token, refreshToken } = res.body.data;
      cy.apiWithToken(token, 'POST', '/auth/logout', { refreshToken }).its('status').should('eq', 200);
      cy.apiPublic('POST', '/auth/refresh', { refreshToken }).its('status').should('eq', 401);
    });
  });

  it('a session survives a page reload', () => {
    cy.loginAs('mentor');
    cy.visit('/mentor/dashboard');
    cy.tid('page-title').should('contain.text', 'My mentees');
    cy.reload();
    cy.tid('page-title').should('contain.text', 'My mentees');
    cy.location('pathname').should('eq', '/mentor/dashboard');
  });

  it('an expired access token is refreshed silently and the original request is retried', () => {
    let first = true;
    cy.intercept('GET', '**/analytics/dashboard', (req) => {
      if (first) { first = false; req.reply({ statusCode: 401, body: { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Authentication token expired.' } } }); }
    }).as('dash');
    cy.intercept('POST', '**/auth/refresh').as('refresh');
    cy.visitAs('hradmin', '/admin/dashboard');
    cy.wait('@refresh').its('response.statusCode').should('eq', 200);
    cy.wait('@dash');
    cy.tid('dashboard-loaded').should('be.visible');
    cy.location('pathname').should('eq', '/admin/dashboard');
  });

  it('several requests failing with an expired token trigger ONE refresh (single flight)', () => {
    let refreshCalls = 0;
    const expireOnce = { dash: true, notifications: true };
    cy.intercept('GET', '**/analytics/dashboard', (req) => { if (expireOnce.dash) { expireOnce.dash = false; req.reply({ statusCode: 401, body: { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } } }); } });
    cy.intercept('GET', '**/notifications', (req) => { if (expireOnce.notifications) { expireOnce.notifications = false; req.reply({ statusCode: 401, body: { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } } }); } });
    cy.intercept('POST', '**/auth/refresh', () => { refreshCalls += 1; }).as('refresh');
    cy.visitAs('hradmin', '/admin/dashboard');
    cy.tid('dashboard-loaded').should('be.visible');
    cy.then(() => { expect(refreshCalls, 'refresh calls').to.be.at.most(1); });
  });

  it('when the refresh token is also dead the user is signed out with an explanation', () => {
    cy.intercept('GET', '**/analytics/dashboard', { statusCode: 401, body: { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } } });
    cy.intercept('POST', '**/auth/refresh', { statusCode: 401, body: { success: false, error: { code: 'TOKEN_REVOKED', message: 'revoked' } } });
    cy.visitAs('hradmin', '/admin/dashboard');
    cy.location('pathname').should('eq', '/login');
    cy.tid('session-ended').should('be.visible');
  });

  it('signing out in one tab signs the other tab out too', () => {
    cy.visitAs('hradmin', '/admin/dashboard');
    cy.tid('page-title').should('be.visible');
    cy.window().then((win) => {
      win.localStorage.removeItem('ims_token');
      win.dispatchEvent(new win.StorageEvent('storage', { key: 'ims_token', newValue: null, oldValue: 'x' }));
    });
    cy.location('pathname').should('eq', '/login');
  });
});
