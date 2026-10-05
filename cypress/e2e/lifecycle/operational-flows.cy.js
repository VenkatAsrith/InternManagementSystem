/// <reference types="cypress" />
import { fx } from '../../support/commands.js';

describe('TMT Operations Platform: Master Operational Flows E2E', () => {
  let orgAId;
  let testAppId;
  let testInternId;
  let generatedDocId;
  let generatedDocMongoId;
  let testBootcampId;
  let testSlotId;
  let candidate1PassCode;

  before(() => {
    orgAId = fx().orgA;
    testInternId = fx().ids.intern;

    // Apply for an opening to generate a real application with a resume PDF
    cy.apiApply(fx().ids.openingA, {
      firstName: 'Devika',
      lastName: 'Nambiar',
      email: `candidate.resume.${Date.now()}@tmt-e2e.test`,
      phone: '+91 91234 56789'
    }).then((res) => {
      expect(res.status).to.eq(201);
      return cy.api('hradmin', 'GET', `/recruitment/applications?search=${encodeURIComponent(res.data.applicationId)}`).then((list) => {
        const app = list.body.data.find((a) => a.applicationId === res.data.applicationId);
        testAppId = app._id;
      });
    });
  });

  // =========================================================================
  // FLOW 1: Global Admin User Provisioning & Role Transparency
  // =========================================================================
  describe('Flow 1: Global Admin User Creation & Live Role Boundaries', () => {
    it('Global Admin provisions internal user with role assignment, permission transparency & audit logging', () => {
      const newUserEmail = `new.hradmin.${Date.now()}@tmt-qa.test`;
      const firstName = 'Siddharth';
      const lastName = 'Varma';

      // 1. Visit Global Command Center as Super Admin
      cy.visitAs('superadmin', '/admin/global-command');
      cy.loaded();
      cy.tid('page-title').should('contain.text', 'Global command center');

      // 2. Open Create Internal User modal
      cy.tid('open-global-user-modal').should('be.visible').click();
      cy.modal('global-user-modal');

      // 3. Fill User Details
      cy.get('[data-testid="global-user-modal"] input[name="firstName"]').type(firstName);
      cy.get('[data-testid="global-user-modal"] input[name="lastName"]').type(lastName);
      cy.get('[data-testid="global-user-modal"] input[name="email"]').type(newUserEmail);
      cy.get('[data-testid="global-user-modal"] select[name="organizationId"]').select(1);

      // 4. Select Role and verify Live Role Boundary & Permission Card
      cy.get('[data-testid="global-user-modal"] select[name="role"]').select('HR_ADMIN');
      cy.tid('role-summary-card').should('be.visible');
      cy.tid('role-summary-card').should('contain.text', 'HR Admin');
      cy.tid('role-summary-card').should('contain.text', 'Head of People Operations');
      cy.tid('role-summary-card').should('contain.text', 'Stipends and payroll mutations restricted');

      // 5. Submit User Creation
      cy.get('[data-testid="global-user-modal"] button[type="submit"]').click();
      cy.modalClosed('global-user-modal');

      // Completion modal displays setup link
      cy.modal('global-user-created');
      cy.tid('global-setup-link-value').should('be.visible');
      cy.tid('global-user-done').click();
      cy.modalClosed('global-user-created');

      // 6. Verify via API that user exists and audit log recorded the action
      cy.api('superadmin', 'GET', '/global-admin/users').then((res) => {
        expect(res.status).to.eq(200);
        const users = res.body.data?.rows || res.body.data || [];
        const created = users.find((u) => u.email === newUserEmail);
        expect(created, 'created user in user list').to.exist;
        expect(created.role).to.eq('HR_ADMIN');
        expect(created.isActive).to.eq(true);
      });

      cy.api('superadmin', 'GET', '/audit-logs', null, { actingOrg: orgAId }).then((res) => {
        expect(res.status).to.eq(200);
        const logs = res.body.data?.rows || res.body.data || [];
        const userLog = logs.find((l) => l.action === 'USER_CREATED_GLOBAL' || l.action === 'USER_CREATED' || l.action === 'USER_INVITED');
        expect(userLog, 'audit log entry for user creation').to.exist;
      });
    });
  });

  // =========================================================================
  // FLOW 2: Role Access Enforcement & Deactivation Blocking
  // =========================================================================
  describe('Flow 2: Role Permissions & User Deactivation Enforcement', () => {
    it('HR Admin sees only permitted modules, and deactivated users are rejected at login', () => {
      // 1. HR Admin visits operational modules
      cy.visitAs('hradmin', '/admin/bootcamps');
      cy.loaded();
      cy.tid('page-title').should('contain.text', 'Bootcamps & Cohorts');

      cy.navigateClient('/admin/interns');
      cy.loaded();
      cy.tid('page-title').should('contain.text', 'Interns');

      // 2. HR Admin is strictly refused access to Global Command and Learning
      cy.navigateClient('/admin/global-command');
      cy.expectForbidden();

      cy.navigateClient('/admin/learning');
      cy.expectForbidden();

      // Intern is refused access to Bootcamps
      cy.visitAs('intern', '/admin/bootcamps');
      cy.expectForbidden();

      // 3. Deactivate a test user and verify login is blocked
      const deactEmail = `deact.test.${Date.now()}@tmt-qa.test`;
      let deactUserId;

      // Create a user to deactivate
      cy.api('superadmin', 'POST', '/global-admin/users', {
        firstName: 'Deact',
        lastName: 'Target',
        email: deactEmail,
        password: 'TempPassword123!',
        role: 'MENTOR',
        organizationId: orgAId
      }).then((createRes) => {
        expect(createRes.status).to.eq(201);
        deactUserId = createRes.body.data.user._id;

        // Deactivate the user
        cy.api('orgadmin', 'POST', `/users/${deactUserId}/deactivate`, {}).then((statusRes) => {
          expect(statusRes.status).to.eq(200);
          expect(statusRes.body.data.isActive).to.eq(false);

          // Attempt login via API with deactivated user -> 403 rejection
          cy.apiLoginRaw(deactEmail, 'TempPassword123!').then((loginRes) => {
            expect(loginRes.status).to.eq(403);
            expect(loginRes.body.error?.code).to.eq('ACCOUNT_INACTIVE');
          });

          // Attempt login via UI
          cy.clearAllLocalStorage();
          cy.visit('/login');
          cy.tid('input-email').type(deactEmail);
          cy.tid('input-password').type('TempPassword123!');
          cy.tid('login-submit').click();
          cy.tid('form-error').should('be.visible').and('contain.text', 'deactivated');
          cy.location('pathname').should('eq', '/login');
        });
      });
    });
  });

  // =========================================================================
  // FLOW 3: Bootcamp Discovery, Capacity Control & Anti-Duplicate Check-In
  // =========================================================================
  describe('Flow 3: Bootcamp Discovery, Capacity Control & Anti-Duplicate Check-In', () => {
    it('Manages bootcamps, inspects operational preview, enforces slot capacity, and prevents duplicate check-in', () => {
      const bootcampTitle = `Cloud Native Mastery Cohort ${Date.now()}`;
      const candidate1Email = `candidate1.${Date.now()}@tmt-test.com`;
      const candidate2Email = `candidate2.${Date.now()}@tmt-test.com`;
      const candidate3Email = `candidate3.${Date.now()}@tmt-test.com`;

      // 1. Visit Bootcamps page
      cy.visitAs('hradmin', '/admin/bootcamps');
      cy.loaded();
      cy.tid('page-title').should('contain.text', 'Bootcamps & Cohorts');
      cy.tid('bootcamp-kpis').should('be.visible');

      // 2. Create a Bootcamp with capacity = 2 via API
      cy.api('hradmin', 'POST', '/growth/bootcamps', {
        title: bootcampTitle,
        description: 'Rigorous 2-day microservices and container orchestration bootcamp',
        venue: 'TMT Tech Hub Bengaluru',
        date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
        totalCapacity: 2,
        slots: [{
          slotName: 'Cohort Alpha Slot',
          startTime: '09:00 AM',
          endTime: '12:00 PM',
          capacity: 2,
          bookedCount: 0,
          checkedInCount: 0
        }]
      }).then((res) => {
        expect(res.status).to.eq(201);
        testBootcampId = res.body.data._id;
        testSlotId = res.body.data.slots[0]._id;

        // 3. Open Operational Preview in UI
        cy.visitAs('hradmin', `/admin/bootcamps/${testBootcampId}`);
        cy.loaded();
        cy.tid('page-title').should('contain.text', bootcampTitle);
        cy.tid('bootcamp-operational-preview').should('be.visible');
        cy.tid('bootcamp-operational-preview').should('contain.text', '0 / 2 Booked');

        // 4. Register Candidate 1 (Slot capacity becomes 1/2)
        cy.api('hradmin', 'POST', `/growth/bootcamps/${testBootcampId}/register`, {
          slotId: testSlotId,
          candidateName: 'Rohan Deshmukh',
          candidateEmail: candidate1Email
        }).then((reg1Res) => {
          expect(reg1Res.status).to.eq(201);
          candidate1PassCode = reg1Res.body.data.passCode;
          expect(candidate1PassCode).to.include('TMT-PASS-');

          // 5. Register Candidate 2 (Slot capacity becomes 2/2 - FULL)
          cy.api('hradmin', 'POST', `/growth/bootcamps/${testBootcampId}/register`, {
            slotId: testSlotId,
            candidateName: 'Priya Iyer',
            candidateEmail: candidate2Email
          }).then((reg2Res) => {
            expect(reg2Res.status).to.eq(201);

            // 6. Attempt Candidate 3 registration on full slot -> STRICT 409 REJECTION
            cy.api('hradmin', 'POST', `/growth/bootcamps/${testBootcampId}/register`, {
              slotId: testSlotId,
              candidateName: 'Vijay Kumar',
              candidateEmail: candidate3Email
            }).then((reg3Res) => {
              expect(reg3Res.status).to.eq(409);
              expect(reg3Res.body.error?.code).to.eq('SLOT_FULL');
            });

            // 7. Verify Operational Preview reflects full capacity
            cy.reload();
            cy.loaded();
            cy.tid('bootcamp-operational-preview').should('contain.text', '2 / 2 Booked (100%)');

            // 8. Check In Candidate 1's Pass
            cy.api('hradmin', 'POST', '/growth/passes/check-in', {
              passCode: candidate1PassCode
            }).then((checkRes) => {
              expect(checkRes.status).to.eq(200);
              expect(checkRes.body.data.status).to.eq('CHECKED_IN');
              expect(checkRes.body.data.checkedInAt).to.be.a('string');

              // 9. DUPLICATE CHECK-IN ATTEMPT -> STRICT 409 REJECTION
              cy.api('hradmin', 'POST', '/growth/passes/check-in', {
                passCode: candidate1PassCode
              }).then((dupCheckRes) => {
                expect(dupCheckRes.status).to.eq(409);
                expect(dupCheckRes.body.error?.code).to.eq('DUPLICATE_CHECK_IN');
              });

              // 10. Operational preview now shows 1 Attended
              cy.reload();
              cy.loaded();
              cy.tid('bootcamp-operational-preview').should('contain.text', '1 Attended');
            });
          });
        });
      });
    });
  });

  // =========================================================================
  // FLOW 4: Candidate Resume In-Browser Preview & Security Protection
  // =========================================================================
  describe('Flow 4: Candidate Resume Handling & In-Browser Preview', () => {
    it('Allows authorized staff to preview and download candidate resume, while blocking unauthorized access', () => {
      // 1. Visit application details as HR Admin
      cy.visitAs('hradmin', `/admin/applications/${testAppId}`);
      cy.loaded();
      cy.tid('candidate-card').should('be.visible');

      // 2. Verify Resume Preview & Download buttons
      cy.tid('preview-resume').should('be.visible').click();
      cy.modal('resume-preview-modal');
      cy.tid('resume-preview-close').should('be.visible');
      cy.tid('resume-preview-download').should('be.visible');

      // Close preview modal
      cy.tid('resume-preview-close').click();
      cy.modalClosed('resume-preview-modal');

      // 3. Security Assertion: Intern cannot access candidate resume API
      cy.api('intern', 'GET', `/recruitment/applications/${testAppId}/resume`).then((res) => {
        expect(res.status).to.eq(403);
      });
    });
  });

  // =========================================================================
  // FLOW 5: Document Center Pre-Send Preview, Multi-Channel Dispatch & Immutability
  // =========================================================================
  describe('Flow 5: Document Pre-Send Preview, Multi-Channel Sending & Immutability', () => {
    it('Generates document, previews before send, dispatches multi-channel, and preserves document immutability', () => {
      let initialChecksum;

      // 1. Generate an official document for an intern
      cy.api('orgadmin', 'POST', '/documents/generate', {
        internId: testInternId,
        templateCode: 'JOINING_LETTER',
        metadata: {
          role: 'Full Stack Engineering Intern',
          joiningDate: new Date().toISOString().slice(0, 10),
          stipend: 'INR 25,000 / month'
        }
      }).then((genRes) => {
        expect(genRes.status).to.eq(201);
        generatedDocMongoId = genRes.body.data._id;
        generatedDocId = genRes.body.data.documentId;
        initialChecksum = genRes.body.data.checksum;
        expect(initialChecksum, 'initial document checksum').to.be.a('string');

        // 2. Open Documents page in UI
        cy.visitAs('hradmin', '/admin/documents');
        cy.loaded();
        cy.tid('page-title').should('contain.text', 'Letters & documents');

        // 3. Preview Document in UI Modal
        cy.tid(`doc-preview-${generatedDocId}`).should('be.visible').click();
        cy.modal('document-preview-modal');
        cy.get('[data-testid="document-preview-modal"]').should('contain.text', generatedDocId);
        cy.tid('doc-preview-close').click();
        cy.modalClosed('document-preview-modal');

        // 4. Open Multi-Channel Send Modal in UI
        cy.tid(`doc-send-${generatedDocId}`).should('be.visible').click();
        cy.modal('send-document-modal');
        cy.get('[data-testid="send-document-modal"]').should('contain.text', generatedDocId);

        // 5. Select WhatsApp channel (Email & Portal are already checked by default)
        cy.tid('channel-whatsapp').click();

        // 6. Dispatch Document
        cy.tid('confirm-send-document').click();

        // 7. Verify Dispatch Confirmation Modal
        cy.modal('send-result-modal');
        cy.get('[data-testid="send-result-modal"]').should('contain.text', 'EMAIL');
        cy.get('[data-testid="send-result-modal"]').should('contain.text', 'PORTAL');
        cy.get('[data-testid="send-result-modal"]').should('contain.text', 'WHATSAPP');
        cy.tid('send-result-done').click();
        cy.modalClosed('send-result-modal');

        // 8. Verify Server Truth: Delivery history recorded & Checksum is 100% IMMUTABLE
        cy.api('hradmin', 'GET', `/documents/${generatedDocMongoId}`).then((docRes) => {
          expect(docRes.status).to.eq(200);
          const doc = docRes.body.data;
          expect(doc.deliveryHistory).to.have.length(3);

          const channels = doc.deliveryHistory.map((h) => h.channel);
          expect(channels).to.include('EMAIL');
          expect(channels).to.include('PORTAL');
          expect(channels).to.include('WHATSAPP');

          // IMMUTABILITY ASSERTION
          expect(doc.checksum, 'document checksum remained immutable').to.eq(initialChecksum);
        });
      });
    });
  });
});
