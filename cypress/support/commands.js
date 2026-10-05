/// <reference types="cypress" />
// Custom commands. Selectors are ALWAYS data-testid based; nothing here waits with a fixed sleep.

const API = () => `${Cypress.expose('apiUrl')}/api/v1`;
export const PASSWORD = () => Cypress.expose('fx').password;
export const fx = () => Cypress.expose('fx');

Cypress.Commands.add('tid', (id, options) => cy.get(`[data-testid="${id}"]`, options));
Cypress.Commands.add('tidLike', (prefix, options) => cy.get(`[data-testid^="${prefix}"]`, options));

// ---------------------------------------------------------------------------------------------------------------
// API access (setup and assertions about server truth). Tokens are cached per spec run.
// ---------------------------------------------------------------------------------------------------------------
const tokens = {};

Cypress.Commands.add('apiLoginRaw', (email, password) => cy.request({ method: 'POST', url: `${API()}/auth/login`, body: { email, password }, failOnStatusCode: false }));

/** Logs a fixture user in through the API. Yields { token, refreshToken, user, permissions }. */
Cypress.Commands.add('apiLogin', (key, org = 'A') => {
  const cacheKey = `${org}:${key}`;
  if (tokens[cacheKey] && tokens[cacheKey].expires > Date.now()) return cy.wrap(tokens[cacheKey].auth, { log: false });
  const user = fx().users[org][key];
  return cy.apiLoginRaw(user.email, PASSWORD()).then((res) => {
    expect(res.status, `login as ${key}`).to.eq(200);
    tokens[cacheKey] = { auth: res.body.data, expires: Date.now() + 60 * 60 * 1000 };
    return res.body.data;
  });
});

/** Authenticated API call as a fixture user. Never fails on HTTP status: assert on it. */
Cypress.Commands.add('api', (as, method, path, body, options = {}) => {
  const { org = 'A', actingOrg, headers = {}, form } = options;
  return cy.apiLogin(as, org).then((auth) => cy.request({
    method, url: `${API()}${path}`, body: form ? undefined : body, form: !!form,
    headers: { Authorization: `Bearer ${auth.token}`, ...(actingOrg ? { 'x-organization-id': actingOrg } : {}), ...headers },
    failOnStatusCode: false
  }));
});

/** Same, but with an explicit bearer token (for users created during the test). */
Cypress.Commands.add('apiWithToken', (token, method, path, body, headers = {}) => cy.request({
  method, url: `${API()}${path}`, body, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, failOnStatusCode: false
}));

/** Anonymous API call. */
Cypress.Commands.add('apiPublic', (method, path, body, headers = {}) => cy.request({ method, url: `${API()}${path}`, body, headers, failOnStatusCode: false }));

// ---------------------------------------------------------------------------------------------------------------
// Browser sessions
// ---------------------------------------------------------------------------------------------------------------
/** Signs a fixture user into the browser without the login form (the form itself is tested in auth/login.cy.js). */
Cypress.Commands.add('loginAs', (key, options = {}) => {
  const { org = 'A' } = options;
  cy.session(['fixture', org, key], () => {
    cy.apiLogin(key, org).then((auth) => {
      // apiLogin caches; a session must own a fresh token pair so refresh-token rotation cannot invalidate other specs.
      cy.apiLoginRaw(fx().users[org][key].email, PASSWORD()).then((res) => {
        const a = res.body.data;
        window.localStorage.setItem('ims_token', a.token);
        window.localStorage.setItem('ims_refresh', a.refreshToken);
        window.localStorage.setItem('ims_user', JSON.stringify(a.user));
      });
    });
  }, {
    validate() {
      cy.window().then((win) => {
        const token = win.localStorage.getItem('ims_token');
        expect(token, 'stored access token').to.be.a('string');
        cy.request({ url: `${API()}/auth/me`, headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false }).its('status').should('eq', 200);
      });
    },
    cacheAcrossSpecs: false
  });
});


/**
 * Visits a page as a fixture user with a FRESH token pair that is not cached across tests.
 * Use it (instead of loginAs) for tests that rotate or revoke tokens: cy.session would otherwise restore a
 * refresh token that an earlier test already rotated away.
 */
Cypress.Commands.add('visitAs', (key, path = '/', options = {}) => {
  const { org = 'A', visit = {} } = options;
  cy.apiLoginRaw(fx().users[org][key].email, PASSWORD()).then((res) => {
    expect(res.status, `login as ${key}`).to.eq(200);
    const a = res.body.data;
    cy.visit(path, {
      ...visit,
      onBeforeLoad(win) {
        win.localStorage.setItem('ims_token', a.token);
        win.localStorage.setItem('ims_refresh', a.refreshToken);
        win.localStorage.setItem('ims_user', JSON.stringify(a.user));
        visit.onBeforeLoad?.(win);
      }
    });
  });
});


/** Client-side navigation (no page reload) through the router, so large route matrices stay fast. */
Cypress.Commands.add('navigateClient', (path) => {
  cy.window({ log: false }).then((win) => {
    win.history.pushState({}, '', path);
    win.dispatchEvent(new win.PopStateEvent('popstate'));
  });
  cy.location('pathname').should('eq', path.split('?')[0]);
});

/** Signs in a user created during the test (email + password known). */
Cypress.Commands.add('loginWithCredentials', (email, password, cacheId) => {
  cy.session(['custom', cacheId || email], () => {
    cy.apiLoginRaw(email, password).then((res) => {
      expect(res.status, `login ${email}`).to.eq(200);
      window.localStorage.setItem('ims_token', res.body.data.token);
      window.localStorage.setItem('ims_refresh', res.body.data.refreshToken);
      window.localStorage.setItem('ims_user', JSON.stringify(res.body.data.user));
    });
  });
});

/** Fills and submits the real login form. */
Cypress.Commands.add('uiLogin', (email, password) => {
  cy.visit('/login');
  cy.tid('input-email').clear().type(email);
  cy.tid('input-password').clear().type(password, { log: false });
  cy.tid('login-submit').click();
});

Cypress.Commands.add('logoutViaUi', () => {
  cy.tid('user-menu-button').click();
  cy.tid('logout-button').click();
  cy.location('pathname').should('eq', '/login');
});

// ---------------------------------------------------------------------------------------------------------------
// UI assertions
// ---------------------------------------------------------------------------------------------------------------
Cypress.Commands.add('expectToast', (type, text) => {
  const chain = cy.get(`[data-testid="toast-${type}"]`);
  return text ? chain.should('contain.text', text) : chain.should('be.visible');
});

Cypress.Commands.add('expectPage', (title) => {
  cy.tid('page-title').should('be.visible');
  if (title) cy.tid('page-title').should('contain.text', title);
});

Cypress.Commands.add('expectForbidden', () => { cy.tid('page-forbidden').should('be.visible'); });

Cypress.Commands.add('expectFieldError', (name, text) => {
  const c = cy.get(`[data-testid="error-${name}"]`).should('be.visible');
  if (text) c.should('contain.text', text);
});

/** A modal is open when its dialog is visible. Closing it is verified by its absence. */
Cypress.Commands.add('modal', (testId) => cy.get(`[data-testid="${testId}"][role="dialog"]`).should('be.visible'));
Cypress.Commands.add('modalClosed', (testId) => cy.get(`[data-testid="${testId}"]`).should('not.exist'));

/** Row of a data table by its testid suffix. */
Cypress.Commands.add('row', (id) => cy.get(`[data-testid="row-${id}"]`));

/** Wait until the page finished its initial loading (no spinner, no skeleton rows). */
Cypress.Commands.add('loaded', () => {
  cy.get('[data-testid="loading"]').should('not.exist');
  cy.get('[data-testid="table-skeleton-row"]').should('not.exist');
});

// ---------------------------------------------------------------------------------------------------------------
// Accessibility (axe-core, injected from node_modules; violations fail the test with readable output)
// ---------------------------------------------------------------------------------------------------------------
Cypress.Commands.add('a11y', (context, options = {}) => {
  cy.readFile('node_modules/axe-core/axe.min.js', 'utf8', { log: false }).then((source) => {
    cy.window({ log: false }).then((win) => {
      if (!win.axe) win.eval(source);
      const run = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, ...options };
      return win.axe.run(context || win.document, run).then((results) => {
        const summary = results.violations.map((v) => `${v.impact} - ${v.id}: ${v.help} (${v.nodes.length} node(s))\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n   ')}`);
        expect(results.violations, `accessibility violations:\n${summary.join('\n')}`).to.have.length(0);
      });
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------------------------------------------
let seq = 0;
/** Unique, readable token so parallel/re-run data never collides: "t1726938422123x4". */
export const uid = () => `t${Date.now()}x${++seq}`;
export const uniqueEmail = (prefix = 'qa') => `${prefix}.${uid()}@tmt-qa.test`;

export const applicantBody = (openingId, overrides = {}) => {
  const id = uid();
  return {
    openingId, firstName: 'Auto', lastName: `Applicant${id}`, email: `qa.${id}@tmt-qa.test`, phone: '+91 98765 43210', city: 'Pune', state: 'MH', country: 'India',
    college: 'QA Institute of Technology', degree: 'B.Tech', branch: 'Computer Science', graduationYear: '2027', cgpa: '8.4', technicalSkills: 'JavaScript, Testing',
    coverLetter: 'Generated by the automated QA suite.', privacyConsent: 'true', ...overrides
  };
};

/** Public application submitted through the API (multipart, from Node). Yields { status, data, error, email, payload }. */
Cypress.Commands.add('apiApply', (openingId, overrides = {}) => {
  const body = applicantBody(openingId, overrides);
  return cy.task('api:apply', { url: `${Cypress.expose('apiUrl')}/api/v1/recruitment/applications/public`, body }).then((res) => ({ status: res.status, data: res.body.data, error: res.body.error, email: body.email, payload: body }));
});
