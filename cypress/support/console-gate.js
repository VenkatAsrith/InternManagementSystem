/**
 * Console-error gate.
 * Any console.error / console.warn raised by the application during a test FAILS that test. That catches React
 * key warnings, invalid DOM nesting, act() problems, unhandled promise messages and accessibility warnings that a
 * passing assertion would otherwise hide.
 *
 * There is deliberately NO global Cypress.on('uncaught:exception', () => false): an exception thrown by the app
 * fails the test, which is the point.
 *
 * A test that legitimately provokes a logged message may allow it for THAT test only:
 *   cy.allowConsole(/pattern/)
 */
let collected = [];
let allowed = [];

Cypress.Commands.add('allowConsole', (pattern) => { allowed.push(pattern); });

Cypress.on('window:before:load', (win) => {
  for (const level of ['error', 'warn']) {
    const original = win.console[level].bind(win.console);
    win.console[level] = (...args) => {
      try { collected.push(`[console.${level}] ${args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`); } catch { collected.push(`[console.${level}] (unserialisable)`); }
      original(...args);
    };
  }
});

beforeEach(() => { collected = []; allowed = []; });

afterEach(function checkConsole() {
  if (this.currentTest?.state && this.currentTest.state !== 'passed') return; // do not mask the original failure
  const problems = collected.filter((line) => !allowed.some((p) => (p instanceof RegExp ? p.test(line) : line.includes(p))));
  expect(problems, `console errors/warnings raised by the app:\n${problems.join('\n')}`).to.have.length(0);
});
