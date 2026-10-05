/// <reference types="cypress" />
import { fx, PASSWORD } from '../../support/commands';

describe('Master Workflow: Invitation, Bootcamp Pass, Project Workspace & Real-time Chat', () => {
  beforeEach(() => {
    cy.clearAllLocalStorage();
  });

  it('1. Invitation Flow: Admin creates user without password; user activates and sets own password', () => {
    const timestamp = Date.now();
    const invitedEmail = `invited.staff.${timestamp}@tmt-qa.test`;
    const newPassword = 'Password2026!Strong';

    // Step A: Organization Admin provisions user via API invitation (never providing permanent password)
    cy.api('orgadmin', 'POST', '/users', {
      firstName: 'Invited',
      lastName: 'Staff',
      email: invitedEmail,
      role: 'HR_ADMIN',
      department: 'Human Resources'
    }).then((res) => {
      expect(res.status, 'create user via invitation').to.eq(201);
      expect(res.body.data.user.role).to.eq('HR_ADMIN');
      const inviteUrl = res.body.data.invitationLink || res.body.data.setupLink;
      expect(inviteUrl, 'invitation link generated').to.be.a('string');

      const urlObj = new URL(inviteUrl, 'http://localhost:3100');
      const token = urlObj.searchParams.get('token');
      expect(token, 'token present in invitation link').to.be.ok;

      // Step B: User opens activation page with token
      cy.visit(`/set-password?token=${token}`);
      cy.tid('invited-email-display', { timeout: 10000 }).should('be.visible').and('contain.text', invitedEmail);
      cy.tid('invited-role-badge').invoke('text').should('match', /hr.*admin/i);

      // Step C: User sets their own password
      cy.tid('new-password-input').type(newPassword);
      cy.tid('confirm-password-input').type(newPassword);
      cy.tid('accept-terms-checkbox').check();
      cy.tid('activate-account-submit').click();

      // Step D: Successfully activated: proceed to dashboard
      cy.tid('go-to-login', { timeout: 10000 }).should('be.visible').click();
      cy.location('pathname').should('eq', '/admin/dashboard');
      cy.tid('user-role').should('contain.text', 'HR_ADMIN');

      // Step E: Verify newly chosen password works for future authentications
      cy.clearAllLocalStorage();
      cy.visit('/login');
      cy.uiLogin(invitedEmail, newPassword);
      cy.location('pathname').should('eq', '/admin/dashboard');
      cy.tid('user-role').should('contain.text', 'HR_ADMIN');

      // Step F: Invitation token cannot be reused
      cy.apiPublic('POST', '/auth/setup-password', { token, password: newPassword }).then((reuseRes) => {
        expect(reuseRes.status, 'reusing token should fail').to.be.oneOf([400, 404]);
      });
    });
  });

  it('2. Bootcamp & Communication: Bootcamp preview, pass generation, and email composer', () => {
    cy.loginAs('hradmin');
    cy.visit('/admin/bootcamps');
    cy.tid('page-title').should('contain.text', 'Bootcamps');

    // Verify bootcamps table renders
    cy.tid('bootcamps-table').should('be.visible');

    // Create a new bootcamp with slots & registration via API
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    cy.api('hradmin', 'POST', '/growth/bootcamps', {
      title: `FullStack Architecture Bootcamp ${Date.now()}`,
      description: 'Hands-on system architecture bootcamp',
      startDate: tomorrow,
      endDate: tomorrow,
      mode: 'HYBRID',
      totalCapacity: 50,
      venue: 'Main Tech Center',
      registrationDeadline: tomorrow
    }).then((bcRes) => {
      expect(bcRes.status).to.eq(201);
      const bootcampId = bcRes.body.data._id;

      // Create a slot
      cy.api('hradmin', 'POST', `/growth/bootcamps/${bootcampId}/slots`, {
        slotName: 'Morning Hands-on Slot',
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        capacity: 25
      }).then((slotRes) => {
        expect(slotRes.status).to.eq(201);
        const slot = slotRes.body.data.slots[0];
        const slotId = slot._id;

        // Register candidate and generate pass
        cy.api('hradmin', 'POST', `/growth/bootcamps/${bootcampId}/register`, {
          fullName: 'Alex Candidate',
          email: `alex.candidate.${Date.now()}@tmt-qa.test`,
          phone: '+919876543210',
          slotId
        }).then((regRes) => {
          expect(regRes.status).to.eq(201);
          const pass = regRes.body.data;
          expect(pass.passCode).to.be.ok;

          // Visit Bootcamp Detail Page in UI
          cy.visit(`/admin/bootcamps/${bootcampId}`);
          cy.tid('bootcamp-detail-title').should('be.visible');

          // Open operational preview modal
          cy.tid('bootcamp-preview-btn').click();
          cy.tid('bootcamp-preview-modal').should('be.visible');
          cy.tid('bootcamp-preview-close').click();

          // Open Passes tab and Pass Communication Composer
          cy.tid('tab-passes').click();
          cy.tid(`send-pass-${pass.passCode}`).click();
          cy.tid('send-bootcamp-pass-modal').should('be.visible');
          cy.tid('preview-attached-pass-btn').should('be.visible');
          cy.tid('preview-email-btn').should('be.visible');
          cy.tid('send-bootcamp-pass-modal-close').click();
        });
      });
    });
  });

  it('3. Project Workspace: Tabs, documents, task tracking, and embedded team chat', () => {
    cy.loginAs('hradmin');
    cy.visit('/admin/projects');
    cy.tid('projects-table').should('be.visible');

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    // Create a project via API
    cy.api('hradmin', 'POST', '/projects', {
      name: `Telemetry Project ${Date.now()}`,
      description: 'Distributed cloud telemetry pipeline',
      objective: 'Build Kafka and ClickHouse ingestion pipeline',
      startDate: tomorrow,
      endDate: nextMonth
    }).then((projRes) => {
      expect(projRes.status).to.eq(201);
      const projectId = projRes.body.data._id;

      // Add intern to project
      const internUser = fx().users.A.intern;
      const internUserId = internUser.id || internUser._id;
      cy.api('hradmin', 'POST', `/projects/${projectId}/members`, {
        userId: internUserId
      }).then((memRes) => {
        expect(memRes.status).to.eq(200);

        // Open project detail in UI
        cy.visit('/admin/projects');
        cy.tid(`project-open-${projectId}`).click();
        cy.tid('project-detail').should('be.visible');

        // Verify tabs
        cy.tid('tab-overview').should('be.visible');
        cy.tid('tab-members').should('be.visible').click();
        cy.tid(`project-member-${internUserId}`).should('be.visible');

        cy.tid('tab-documents').should('be.visible').click();
        cy.tid('upload-project-doc-btn').should('be.visible');

        cy.tid('tab-chat').should('be.visible').click();
        cy.tid('chat-message-input').should('be.visible');

        // Send a message in project chat
        const testMsg = `Architecture spec ready for review ${Date.now()}`;
        cy.tid('chat-message-input').type(`${testMsg}{enter}`);
        cy.contains(testMsg).should('be.visible');
      });
    });
  });

  it('4. Real-time Collaboration: Direct and Group Chat', () => {
    cy.loginAs('hradmin');
    cy.visit('/chat');
    cy.tid('page-title').should('contain.text', 'Real-Time Collaboration');
    cy.tid('start-new-chat-btn').should('be.visible').click();

    // New Chat Modal
    cy.tid('new-chat-modal').should('be.visible');
    cy.tid('tab-group').click();
    cy.tid('group-name-input').type(`Sprint 1 Working Group ${Date.now()}`);
    cy.tidLike('group-peer-').first().click();
    cy.tid('create-group-btn').click();

    // Verify conversation is active
    cy.tid('chat-header-title').should('be.visible');
    cy.tid('chat-message-input').should('be.visible');

    const msg = `Hello team, starting sprint standup ${Date.now()}`;
    cy.tid('chat-message-input').type(`${msg}{enter}`);
    cy.contains(msg).should('be.visible');
  });
});
