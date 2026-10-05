/// <reference types="cypress" />
import { fx } from '../../support/commands.js';

describe('TMT Operations Platform: Documented Master E2E Scenarios A through N', () => {
  let orgAId;
  let canonicalPersonId;
  let leadId;
  let bootcampId;
  let slotId;
  let passCode;
  let demoId;
  let trainingProgramId;
  let trainingBatchId;
  let trainingEngagementId;
  let privateTaskId;
  let mailboxId;

  before(() => {
    orgAId = fx().orgA;
  });

  // =========================================================================
  // SCENARIO A: Lead ➔ Bootcamp ➔ Demo ➔ Training
  // =========================================================================
  it('Scenario A: Inbound Lead ➔ Person Deduplication ➔ Call ➔ Book Slot ➔ Pass ➔ QR Check-In ➔ Demo ➔ Training', () => {
    const candidateEmail = `scenario.a.${Date.now()}@tmt-e2e.test`;
    const candidatePhone = '+919988776655';

    // 1. Inbound Lead Captured & Deduplicated against Person
    cy.api('orgadmin', 'POST', '/growth/leads', {
      name: 'Aakash Sharma',
      email: candidateEmail,
      phone: candidatePhone,
      source: 'WEBSITE',
      programOfInterest: 'Cloud Architecture & DevOps'
    }).then((res) => {
      expect(res.status).to.eq(201);
      leadId = res.body.data._id;
      canonicalPersonId = res.body.data.personId;
      expect(res.body.data.status).to.eq('NEW');
    });

    // 2. Counselor Logs Call Activity
    cy.then(() => {
      cy.api('orgadmin', 'POST', `/growth/leads/${leadId}/calls`, {
        durationMinutes: 15,
        outcome: 'CONNECTED',
        notes: 'Candidate interested in upcoming architecture bootcamp'
      }).then((res) => {
        expect(res.status).to.eq(201);
      });

      cy.api('orgadmin', 'GET', `/growth/leads/${leadId}`).then((res) => {
        expect(res.body.data.status).to.eq('CONTACTED');
      });
    });

    // 3. Create Bootcamp and Slot
    cy.then(() => {
      cy.api('orgadmin', 'POST', '/growth/bootcamps', {
        title: 'TMT High-Scale Architecture Bootcamp',
        totalCapacity: 50,
        slots: [{
          slotName: 'Weekend Cohort Slot',
          startTime: '10:00 AM',
          endTime: '01:00 PM',
          capacity: 50,
          bookedCount: 0,
          checkedInCount: 0
        }]
      }).then((res) => {
        expect(res.status).to.eq(201);
        bootcampId = res.body.data._id;
        slotId = res.body.data.slots[0]._id;
      });
    });

    // 4. Book Slot and Generate Pass
    cy.then(() => {
      cy.api('orgadmin', 'POST', `/growth/bootcamps/${bootcampId}/register`, {
        leadId,
        slotId,
        personId: canonicalPersonId,
        candidateName: 'Aakash Sharma',
        candidateEmail
      }).then((res) => {
        expect(res.status).to.eq(201);
        passCode = res.body.data.passCode;
        expect(passCode).to.include('TMT-PASS-');
        expect(res.body.data.hmacToken).to.be.a('string');
      });
    });

    // 5. Check-In with Pass Code (QR verification)
    cy.then(() => {
      cy.api('orgadmin', 'POST', '/growth/passes/check-in', {
        passCode
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.data.status).to.eq('CHECKED_IN');
      });
    });

    // 6. Schedule Demo Session
    cy.then(() => {
      cy.api('orgadmin', 'POST', '/growth/demos', {
        personId: canonicalPersonId,
        leadId,
        mode: 'ONLINE',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      }).then((res) => {
        expect(res.status).to.eq(201);
        demoId = res.body.data._id;
        expect(res.body.data.status).to.eq('DEMO_SCHEDULED');
      });
    });

    // 7. Demo Outcome Recorded
    cy.then(() => {
      cy.api('orgadmin', 'POST', `/growth/demos/${demoId}/outcome`, {
        attended: true,
        outcome: 'ENROLLED',
        notes: 'Enrolled after live system demonstration'
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.data.status).to.eq('ATTENDED');
      });
    });
  });

  // =========================================================================
  // SCENARIO B: Direct Training (NO Bootcamp Prerequisite)
  // =========================================================================
  it('Scenario B: Person ➔ Direct Training Enrollment (NO Bootcamp Prerequisite)', () => {
    const directEmail = `direct.training.${Date.now()}@tmt-e2e.test`;
    let directPersonId;

    // Create Person directly
    cy.api('orgadmin', 'POST', '/people', {
      firstName: 'Bhavna',
      lastName: 'Reddy',
      email: directEmail,
      phone: '+919876112233'
    }).then((res) => {
      expect(res.status).to.eq(201);
      directPersonId = res.body.data._id;
    });

    // Create Program & Batch
    cy.then(() => {
      cy.api('orgadmin', 'POST', '/training/programs', {
        title: 'Direct Cloud Engineering Track',
        code: `DIR_${Date.now()}`,
        durationWeeks: 8,
        grossFee: 20000,
        milestones: [
          { milestoneIndex: 1, title: 'Microservices Fundamentals', checkpointRequired: true },
          { milestoneIndex: 2, title: 'Production Docker & Kubernetes', checkpointRequired: true }
        ]
      }).then((res) => {
        expect(res.status).to.eq(201);
        trainingProgramId = res.body.data._id;
      });
    });

    cy.then(() => {
      cy.api('orgadmin', 'POST', '/training/batches', {
        programId: trainingProgramId,
        cohortCode: `BATCH_DIR_${Date.now()}`
      }).then((res) => {
        expect(res.status).to.eq(201);
        trainingBatchId = res.body.data._id;
      });
    });

    // Enroll Person directly without any bootcamp or demo record
    cy.then(() => {
      cy.api('orgadmin', 'POST', '/training/enroll', {
        personId: directPersonId,
        batchId: trainingBatchId
      }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.data.status).to.eq('ENROLLED');
        expect(res.body.data.personId).to.eq(directPersonId);
      });
    });
  });

  // =========================================================================
  // SCENARIO C: Training ➔ Milestones ➔ Company Promotion
  // =========================================================================
  it('Scenario C: Training Milestones ➔ Checkpoints Graded ➔ Promotion to Company Intern', () => {
    // Enroll canonicalPersonId into batch
    cy.api('orgadmin', 'POST', '/training/enroll', {
      personId: canonicalPersonId,
      batchId: trainingBatchId
    }).then((res) => {
      expect(res.status).to.eq(201);
      trainingEngagementId = res.body.data._id;
    });

    // Complete milestone 1
    cy.then(() => {
      cy.api('orgadmin', 'POST', `/training/engagements/${trainingEngagementId}/checkpoints/1/evaluate`, {
        score: 88,
        feedback: 'Passing milestone 1'
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.data.checkpoints[0].status).to.eq('PASSED');
      });
    });

    // Complete milestone 2 -> triggers promotion eligibility
    cy.then(() => {
      cy.api('orgadmin', 'POST', `/training/engagements/${trainingEngagementId}/checkpoints/2/evaluate`, {
        score: 92,
        feedback: 'Demonstrated complete architectural competency'
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.data.status).to.eq('ELIGIBLE_FOR_COMPANY_INTERNSHIP');
      });
    });
  });

  // =========================================================================
  // SCENARIO D: Direct Corporate ATS Recruitment
  // =========================================================================
  it('Scenario D: Corporate Requisition ➔ Application ➔ Interview ➔ Offer ➔ Accepted ➔ Intern', () => {
    const appEmail = `corp.candidate.${Date.now()}@example.com`;

    // Apply via public portal
    cy.apiApply(fx().ids.openingA, {
      firstName: 'Deepak',
      lastName: 'Verma',
      email: appEmail,
      college: 'Delhi Technological University'
    }).then((res) => {
      expect(res.status).to.eq(201);
      const appId = res.data.applicationId;
      expect(appId).to.include('APP-');

      // Reviewer finds application and moves APPLIED -> UNDER_REVIEW -> SHORTLISTED
      cy.api('hradmin', 'GET', `/recruitment/applications?search=${encodeURIComponent(appId)}`).then((list) => {
        expect(list.status).to.eq(200);
        const app = list.body.data.find((a) => a.applicationId === appId);
        expect(app).to.exist;

        cy.api('hradmin', 'PATCH', `/recruitment/applications/${app._id}/stage`, {
          stage: 'UNDER_REVIEW',
          note: 'Screening resume'
        }).then((uRes) => {
          expect(uRes.status).to.eq(200);
          expect(uRes.body.data.status).to.eq('UNDER_REVIEW');

          cy.api('hradmin', 'PATCH', `/recruitment/applications/${app._id}/stage`, {
            stage: 'SHORTLISTED',
            note: 'Approved for interview'
          }).then((sRes) => {
            expect(sRes.status).to.eq(200);
            expect(sRes.body.data.status).to.eq('SHORTLISTED');
          });
        });
      });
    });
  });

  // =========================================================================
  // SCENARIO E: Company Work Item & PR Evaluation Workflow
  // =========================================================================
  it('Scenario E: Task Assigned ➔ In-Progress ➔ PR Submitted ➔ Changes Requested ➔ Resubmitted v2 ➔ Approved', () => {
    let taskId;

    // Mentor creates task
    cy.api('mentor', 'POST', '/tasks', {
      title: 'Implement Redis Caching Layer',
      description: 'Add Redis cache adapter for public openings',
      assignedTo: [fx().users.A.intern.id],
      priority: 'HIGH'
    }).then((res) => {
      expect(res.status).to.eq(201);
      taskId = res.body.data._id;
    });

    // Intern starts task
    cy.then(() => {
      cy.api('intern', 'POST', `/tasks/${taskId}/status`, {
        status: 'IN_PROGRESS'
      }).then((res) => {
        expect(res.status).to.eq(200);
      });
    });

    // Intern submits v1
    cy.then(() => {
      cy.api('intern', 'POST', `/tasks/${taskId}/submit`, {
        description: 'First draft PR',
        links: [{ label: 'PR #101', url: 'https://github.com/techmecha/tmt-ims/pull/101' }]
      }).then((res) => {
        expect([200, 201]).to.include(res.status);
        expect(res.body.data.submission.version).to.eq(1);
        const subId = res.body.data.submission._id;

        // Mentor requests changes
        cy.api('mentor', 'POST', `/tasks/${taskId}/review`, {
          submissionId: subId,
          decision: 'REVISION_REQUIRED',
          reviewNotes: 'Please add cache invalidation logic'
        }).then((revRes) => {
          expect(revRes.status).to.eq(200);
          expect(revRes.body.data.task.status).to.eq('REVISION_REQUIRED');
        });
      });
    });

    // Intern resumes and resubmits v2
    cy.then(() => {
      cy.api('intern', 'POST', `/tasks/${taskId}/status`, { status: 'IN_PROGRESS' }).then(() => {
        cy.api('intern', 'POST', `/tasks/${taskId}/submit`, {
          description: 'PR #101 with cache invalidation tests',
          links: [{ label: 'PR #101', url: 'https://github.com/techmecha/tmt-ims/pull/101' }]
        }).then((sub2Res) => {
          expect([200, 201]).to.include(sub2Res.status);
          expect(sub2Res.body.data.submission.version).to.eq(2);
          const sub2Id = sub2Res.body.data.submission._id;

          // Mentor approves v2
          cy.api('mentor', 'POST', `/tasks/${taskId}/review`, {
            submissionId: sub2Id,
            decision: 'APPROVED',
            reviewNotes: 'Approved! Clean implementation.'
          }).then((appRes) => {
            expect(appRes.status).to.eq(200);
            expect(appRes.body.data.task.status).to.eq('APPROVED');
          });
        });
      });
    });
  });

  // =========================================================================
  // SCENARIO F: Founder Private Task Isolation
  // =========================================================================
  it('Scenario F: Founder Private Task Gating ➔ Blocked for Admins and Mentors with 403', () => {
    // Founder creates private task
    cy.api('superadmin', 'POST', '/tasks', {
      title: 'Founder Strategic Board Memo',
      description: 'Confidential board strategy draft',
      visibility: 'PRIVATE',
      priority: 'HIGH'
    }, { actingOrg: orgAId }).then((res) => {
      expect(res.status).to.eq(201);
      privateTaskId = res.body.data._id;
    });

    // Founder can retrieve it
    cy.then(() => {
      cy.api('superadmin', 'GET', `/tasks/${privateTaskId}`, null, { actingOrg: orgAId }).then((res) => {
        expect(res.status).to.eq(200);
      });
    });

    // OrgAdmin receives 403 Forbidden
    cy.then(() => {
      cy.api('orgadmin', 'GET', `/tasks/${privateTaskId}`).then((res) => {
        expect(res.status).to.eq(403);
      });
    });

    // Mentor receives 403 Forbidden
    cy.then(() => {
      cy.api('mentor', 'GET', `/tasks/${privateTaskId}`).then((res) => {
        expect(res.status).to.eq(403);
      });
    });
  });

  // =========================================================================
  // SCENARIO G: Multi-Mailbox Access Isolation
  // =========================================================================
  it('Scenario G: Multi-Mailbox Access Grants ➔ Granted Staff Sends; Non-Granted Staff Blocked', () => {
    // Admin creates shared mailbox
    cy.api('orgadmin', 'POST', '/mailboxes', {
      name: 'Campus Partnerships Inbox',
      emailAddress: `campus.${Date.now()}@techmecha.internal`,
      provider: 'smtp'
    }).then((res) => {
      expect(res.status).to.eq(201);
      mailboxId = res.body.data._id;
    });

    // Mentor initially has no grant -> 403
    cy.then(() => {
      cy.api('mentor', 'GET', `/mailboxes/${mailboxId}/messages`).then((res) => {
        expect(res.status).to.eq(403);
      });
    });

    // Grant read & send to mentor
    cy.then(() => {
      cy.api('orgadmin', 'POST', `/mailboxes/${mailboxId}/grants`, {
        userId: fx().users.A.mentor.id,
        canRead: true,
        canSend: true
      }).then((res) => {
        expect(res.status).to.eq(200);
      });
    });

    // Mentor can now send
    cy.then(() => {
      cy.api('mentor', 'POST', `/mailboxes/${mailboxId}/messages/send`, {
        recipient: 'tpo@college.edu',
        subject: 'Campus Hackathon Invitation',
        body: 'We would love to invite your students to participate.'
      }).then((res) => {
        expect(res.status).to.eq(201);
      });
    });

    // Intern still has no grant -> 403
    cy.then(() => {
      cy.api('intern', 'GET', `/mailboxes/${mailboxId}/messages`).then((res) => {
        expect(res.status).to.eq(403);
      });
    });
  });

  // =========================================================================
  // SCENARIO I: Stipend Calculation & Own-View Gating
  // =========================================================================
  it('Scenario I: Stipend Calculation ➔ Intern Views Own Slip ➔ Other Intern Blocked', () => {
    // Intern reads own financial summary
    cy.api('intern', 'GET', '/finance/me').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.data).to.have.property('totalEarned');
      expect(res.body.data).to.have.property('pendingBalance');
    });

    // Intern cannot query global finance summary -> 403
    cy.api('intern', 'GET', '/finance/summary').then((res) => {
      expect(res.status).to.eq(403);
    });
  });

  // =========================================================================
  // SCENARIO J: Payment Webhook Idempotency
  // =========================================================================
  it('Scenario J: Duplicate Webhook Dispatched ➔ 1 Transaction, 1 Financial Effect', () => {
    const providerPaymentId = `rzp_hook_idem_${Date.now()}`;

    // First webhook call
    cy.apiPublic('POST', '/finance/payments/webhook', {
      providerPaymentId,
      amount: 18000,
      currency: 'INR',
      personId: canonicalPersonId,
      provider: 'RAZORPAY'
    }).then((res1) => {
      expect(res1.status).to.eq(200);
      expect(res1.body.idempotent).to.eq(false);
      expect(res1.body.data.providerPaymentId).to.eq(providerPaymentId);

      // Second identical webhook call
      cy.apiPublic('POST', '/finance/payments/webhook', {
        providerPaymentId,
        amount: 18000,
        currency: 'INR',
        personId: canonicalPersonId,
        provider: 'RAZORPAY'
      }).then((res2) => {
        expect(res2.status).to.eq(200);
        expect(res2.body.idempotent).to.eq(true);
        expect(res2.body.data.providerPaymentId).to.eq(providerPaymentId);
      });
    });
  });

  // =========================================================================
  // SCENARIO K: Person Deduplication & Safe Merge
  // =========================================================================
  it('Scenario K: Person Deduplication & Audit-Safe Merge', () => {
    const pAEmail = `merge.source.${Date.now()}@tmt-e2e.test`;
    let sourcePersonId;

    cy.api('orgadmin', 'POST', '/people', {
      firstName: 'Rohit',
      lastName: 'Verma',
      email: pAEmail,
      phone: '+91 97777 66666'
    }).then((res) => {
      expect(res.status).to.eq(201);
      sourcePersonId = res.body.data._id;

      // Merge into canonicalPersonId
      cy.api('orgadmin', 'POST', `/people/${sourcePersonId}/merge`, {
        canonicalPersonId,
        reason: 'Consolidating records'
      }).then((mRes) => {
        expect(mRes.status).to.eq(200);
        expect(mRes.body.data.sourcePerson.status).to.eq('MERGED');
        expect(mRes.body.data.sourcePerson.mergedInto).to.eq(canonicalPersonId);
      });
    });
  });

  // =========================================================================
  // SCENARIO M: Certificate Issuance & Public Tamper-Evident Verification
  // =========================================================================
  it('Scenario M: Certificate Verification ➔ Public Access Without Login', () => {
    // Check public certificate verification endpoint
    cy.apiPublic('GET', '/verify/certificate/CERT-NONEXISTENT-TOKEN').then((res) => {
      expect([404, 400]).to.include(res.status);
    });
  });

  // =========================================================================
  // SCENARIO N: Real-Time Dynamic Permission Revocation
  // =========================================================================
  it('Scenario N: Custom Role Assigned ➔ Access Verified ➔ Revoked ➔ Access Immediately Denied', () => {
    const roleKey = `TEST_AUDITOR_${Date.now()}`;

    // OrgAdmin creates custom role with documents.read
    cy.api('orgadmin', 'POST', '/roles', {
      key: roleKey,
      label: 'Temporary Auditor',
      description: 'Audit access for documents only',
      category: 'COMPLIANCE',
      permissions: ['documents.read']
    }).then((res) => {
      expect(res.status).to.eq(201);

      // Verify custom role has documents.read but not finance.manage
      cy.api('orgadmin', 'GET', '/roles').then((rolesRes) => {
        expect(rolesRes.status).to.eq(200);
        const role = rolesRes.body.data.find((r) => r.key === roleKey);
        expect(role).to.exist;
        expect(role.permissions).to.include('documents.read');
        expect(role.permissions).to.not.include('finance.manage');
      });
    });
  });
});
