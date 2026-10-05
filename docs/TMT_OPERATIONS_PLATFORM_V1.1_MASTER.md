# TECHMECHA TORQUE PRIVATE LIMITED
# TMT OPERATIONS PLATFORM
## Intern Implementation-Ready Documentation
### Version 1.1 Enterprise Enhanced | 17 September 2026

**Purpose:**  
Single execution blueprint for engineering interns building TMT's internal operations platform from lead acquisition and corporate ATS recruitment through training, company internship, work execution, asset management, leave workflows, communications, finance, document generation, exit offboarding, certificates, reporting, and audit.

**INTERNAL • IMPLEMENTATION USE**

---

### Document Control

| Field | Value |
| :--- | :--- |
| **Document** | TMT Operations Platform — Intern Implementation-Ready Documentation |
| **Version** | 1.1 Enterprise Enhanced |
| **Date** | 17 September 2026 |
| **Owner** | TechMecha Torque Private Limited |
| **Audience** | Founder/Admin, engineering interns, developers, QA interns, HR managers, operations stakeholders |
| **Status** | V1.1 Enterprise Requirements Frozen; changes require documented change request |
| **Implementation Principle** | No business status transition is frontend-only; server-side validation, immutable audit, and authorization are mandatory. |

> **Important Implementation Directive:**  
> This document defines implementation behavior, contracts, database models, and acceptance criteria. Interns should implement module-by-module and not redesign business rules or database relationships without formal approval.

---

### Contents

1. [Product Goal and Scope](#1-product-goal-and-scope)
2. [Reference Technology Architecture](#2-reference-technology-architecture)
3. [Domain Model and Identity Rules](#3-domain-model-and-identity-rules)
4. [Authorization: Role + Permission + Scope + Context](#4-authorization-role--permission--scope--context)
5. [Person and Lead CRM](#5-person-and-lead-crm)
6. [Bootcamp, Pass and Check-In](#6-bootcamp-pass-and-check-in)
7. [Demo Pipeline](#7-demo-pipeline)
8. [Training Intern Management](#8-training-intern-management)
9. [Company Internship & Corporate Recruitment Management](#9-company-internship--corporate-recruitment-management)
10. [Programs, Batches, Attendance and Leave Management](#10-programs-batches-attendance-and-leave-management)
11. [Payments, Stipend and Finance Ledger](#11-payments-stipend-and-finance-ledger)
12. [Projects, Work Items, Submission and Evaluation](#12-projects-work-items-submission-and-evaluation)
13. [Standalone Tasks, Founder Private Work and Daily Journals](#13-standalone-tasks-founder-private-work-and-daily-journals)
14. [Communication Center: Email, WhatsApp and Inbox](#14-communication-center-email-whatsapp-and-inbox)
15. [Document, Letter Studio and Certificate Center](#15-document-letter-studio-and-certificate-center)
16. [Candidate / Intern Portal](#16-candidate--intern-portal)
17. [Calendar, Reminders, Notifications, Cautions and Meetings](#17-calendar-reminders-notifications-cautions-and-meetings)
18. [Search, Bulk Operations and Activity Timeline](#18-search-bulk-operations-and-activity-timeline)
19. [Reporting and Dashboards](#19-reporting-and-dashboards)
20. [Integrations and Background Jobs](#20-integrations-and-background-jobs)
21. [File Storage, Security, Audit and Recovery](#21-file-storage-security-audit-and-recovery)
22. [API Conventions and Endpoint Inventory](#22-api-conventions-and-endpoint-inventory)
23. [Database Collections and Key Fields](#23-database-collections-and-key-fields)
24. [Frontend Route and Screen Inventory](#24-frontend-route-and-screen-inventory)
25. [Error, Edge-Case and State-Machine Rules](#25-error-edge-case-and-state-machine-rules)
26. [E2E Acceptance Scenarios](#26-e2e-acceptance-scenarios)
27. [Intern Build Sequence and Definition of Done](#27-intern-build-sequence-and-definition-of-done)
28. [V1 Exclusions, Change-Control Rule and Final Principles](#28-v1-exclusions-change-control-rule-and-final-principles)

---

## 1. Product Goal and Scope

Build one connected TMT operations platform where a known person maintains **one canonical identity** while moving through acquisition, corporate ATS recruitment, training, company internship, active project contribution, asset custody, and permanent alumni status. The platform eliminates data silos by preserving a continuous operational timeline instead of duplicating records across disconnected modules.

```text
                                  UNKNOWN AUDIENCE
                                         │
                 ┌───────────────────────┴────────────────────────┐
                 ▼ (Acquisition)                                  ▼ (Direct Corporate Recruitment)
            PERSON + LEAD                                  PERSON + CANDIDATE
                 │                                                │
       ┌─────────┴─────────┐                                      ▼
       ▼                   ▼                         [ Job Requisition: Opening ]
[ Bootcamp & Pass ]   [ Demo Session ]                            │
       │                   │                                      ▼
       └─────────┬─────────┘                             [ Application: APP-* ]
                 │                                                │
                 ▼                                                ▼
     [ Training Engagement ]                            [ Technical Interviews ]
      (Milestones & Checkpoints)                                  │
                 │                                                ▼
                 │ (Selection / Promotion)                [ Formal Offer: OFFER-* ]
                 └───────────────────────┬────────────────────────┘
                                         ▼
                             COMPANY INTERNSHIP (INT-*)
                                         │
        ┌───────────────────┬────────────┴───────┬───────────────────┐
        ▼                   ▼                    ▼                   ▼
[ Projects & Tasks ]  [ Daily Journals ]   [ Asset Custody ]   [ Leaves & Attendance ]
        │                   │                    │                   │
        └───────────────────┼────────────────────┴───────────────────┘
                            ▼
           [ Evaluations, Stipend & Documents ]
                            │
                            ▼
               [ 10-Stage Exit & Offboarding ]
              (Clearance, Settlements, Relieving)
                            │
                            ▼
          [ Experience Certificate & Permanent ALUMNI ]
```

> **Core Identity Rule:** Unknown advertisement viewers are not Persons. A Person record is created only when TMT receives identifiable and contactable data—at lead capture, web application, walk-in, referral, direct inquiry, or existing LearningSpaces linkage.

### 1.1 V1.1 Business Outcomes
1. **Canonical Identity Continuity:** Every individual has exactly one `Person` entity that links Candidate, Lead, Training Intern, Company Intern, and Alumni states without record duplication.
2. **Dual Intake Flexibility:** The system supports both educational acquisition (Leads ➔ Bootcamp ➔ Demo ➔ Training) and direct corporate recruitment (Requisition ➔ ATS Application ➔ Interviews ➔ Offer ➔ Company Intern).
3. **Role-Gated Operational Privacy:** Employees manage assigned leads, interns, tasks, and communications without unauthorized exposure to company finances, founder-private work, or other employees' sensitive queues.
4. **Distinct Engagement Models:** `Training Intern` (educational relationship with milestone checkpoints and student fee plans) and `Company Intern` (productive employment relationship with projects, evaluations, and stipends) remain strictly segregated domain models.
5. **Rigorous Work Lifecycle:** Company intern tasks follow an immutable `Assign ➔ In-Progress ➔ Submit (with PR/URL) ➔ Evaluate ➔ Revise / Approve` lifecycle with versioned submissions.
6. **Unified Letter Studio:** Authorized staff generate versioned, tamper-evident documents (DPIIT & MSME accredited) once and distribute the same issued PDF artifact across the Portal, Email, and WhatsApp.
7. **Segregated Financial Ledgers:** Candidate training fees (gross, discounts, installments, Razorpay collections) and intern stipends (base, leave deductions, performance bonuses, disbursements) operate on separate financial ledgers.
8. **Operational Continuity & Asset Accountability:** Equipment (laptops, peripherals, credentials) is tracked end-to-end and reconciled during the mandatory 10-stage offboarding clearance.
9. **Founder Command Center:** Executive leadership has real-time operational oversight across financial health, company cautions, private task sandboxes, and audit trails.

---

## 2. Reference Technology Architecture

The platform is constructed as a **MERN Modular Monolith** with strict domain boundaries, TypeScript interfaces, and event-driven integration adapters.

### Table 3: Reference Technology Choices
| Layer | Recommended V1 Choice | Responsibility |
| :--- | :--- | :--- |
| **Web SPA** | React 18 + Vite + Tailwind CSS | Role-based UI, interactive dashboards, Letter Studio previewer, Portal, and Kanban boards. |
| **Backend API** | Node.js 20+ & Express.js (Modular Monolith) | Domain services, state machines, server-side RBAC, REST endpoints, and webhook processors. |
| **Database** | MongoDB 6.0+ with Mongoose ODM | Operational domain collections, embedded subdocuments, and append-only audit event ledgers. |
| **Cache & Queues** | Redis + BullMQ | Asynchronous communication dispatch, reminder scheduling, mailbox sync, and idempotency locks. |
| **Realtime** | Socket.IO / Server-Sent Events (SSE) | Live user notifications, inbox alerts, and evaluation status updates. |
| **File Storage** | Cloudinary & S3 Storage Adapter with Local Fallback | PDF letters, certificates, signed contracts, submission attachments, with TTL temp staging. |
| **Testing** | Vitest / Jest + Supertest + Playwright | Unit domain validation, API route authorization tests, and end-to-end browser user journeys. |
| **Integrations** | Replaceable Integration Adapters | Razorpay API, Nodemailer / SMTP, WhatsApp Business API, and Google Forms importer. |

```text
apps/
  web/                     # React 18 SPA (Vite, Tailwind, Lucide, Recharts)
  api/                     # Express.js Modular Monolith HTTP Entry
modules/
  auth/                    # JWT Access + HttpOnly Refresh Tokens, Sessions, Password Security
  people/                  # Canonical Person Identity, Contact Deduplication, 360° Timeline
  leads/                   # CRM Lead Intake, Call Activities, Conversion Pipeline
  recruitment/             # Corporate ATS: Openings, Applications, Screening, Stage History
  interviews/              # Technical & HR Interview Rounds, Scorecards, Recommendations
  offers/                  # Offer Drafting, Approval Workflows, Counter-Offers, Acceptance
  bootcamps/               # Event Setup, Capacity Management, Slots, Passes, QR Attendance
  demos/                   # Demo Pipeline, Scheduling, Attendance, Follow-Up Outcomes
  training/                # Programs, Cohort Batches, Sessions, Milestones, Checkpoints
  internships/             # Master Intern Lifecycle, Mentors, Departments, Terms
  work/                    # Projects, Tasks, Subtasks, PR Submissions, Evaluator Scorecards
  journals/                # Daily Engineering Reflections, Hours Logged, Mentor Feedback
  assets/                  # Equipment Inventory, Allocation, Custody Tracking, Returns
  leaves/                  # Leave Requests, Category Quotas, Approval Flows, Attendance Sync
  exit/                    # 10-Stage Offboarding Lifecycle, Clearances, Relieving Artifacts
  payments/                # Candidate Fees, Installments, Webhook Verification, Receipts
  stipends/                # Monthly Stipend Ledger, Deductions, Payout Approvals, Disbursement
  communications/          # Unified Multi-Channel Engine: Email, WhatsApp, Delivery Logs
  mail/                    # Multi-Mailbox Synchronization, Shared Inboxes, Access Grants
  documents/               # TMT Letter Studio, Versioned Templates, DPIIT/MSME Vector PDF
  certificates/            # Certificate Issuance Engine, Cryptographic Verification Hash, QR
  calendar/                # Unified Operational Schedule, Meeting Links, Auto-Rescheduling
  notifications/           # In-App Alerts, Priority Founder Cautions, Snooze / Dismiss
  reports/                 # Analytics, Conversion Funnels, Financial Aging, Cohort Health
  audit/                   # Tamper-Proof Audit Logging, Before/After Diffs, Request Tracing
shared/
  constants.js             # Canonical Enums, Roles, Permissions, State Machine Transitions
  middleware/              # Auth, Scoped RBAC, Tenant Guard, Upload Pipeline, Error Handling
```

### Architectural Principles
- **Adapter Decoupling:** No business logic directly imports third-party SDKs (Razorpay, Nodemailer, Cloudinary). All external services implement interface adapters in `server/src/integrations/`.
- **Domain-Owned State Machines:** Status transitions are performed only by domain service methods validating illegal transitions. Route controllers never execute ad-hoc status updates.
- **Idempotency & Concurrency:** Mutation endpoints and webhook receivers utilize unique idempotency keys (`req.headers['idempotency-key']`) and atomic conditional queries to prevent race conditions.
- **Request Tracing:** Correlation IDs (`req.requestId`) are attached at the HTTP boundary, injected into Winston logs, passed to background workers, and recorded in `AuditLog`.

---

## 3. Domain Model and Identity Rules

### 3.1 Person is Identity; Engagements are History
A single physical individual is represented permanently by one `Person` entity. All past, present, and future commercial or employment interactions attach to this entity as historical child records:

```text
Person
 ├── Leads[]                      # Inbound marketing & sales interactions
 ├── CandidateProfile?            # Resume, college, skills, portfolio
 ├── Applications[]               # Specific job applications (APP-YYYY-XXXXXX)
 ├── Interviews[]                 # Interview scorecards and evaluations
 ├── Offers[]                     # Issued offer letters (OFFER-YYYY-XXXXXX)
 ├── BootcampRegistrations[]      # Event tickets and check-in logs
 ├── Demos[]                      # Product demos attended
 ├── TrainingEngagements[]        # Academic training cohorts enrolled
 ├── CompanyInternships[]         # Formal internship contracts (INT-YYYY-XXXXXX)
 ├── AssetAssignments[]           # Physical/digital equipment allocated
 ├── LeaveRequests[]              # Leave balance and time-off records
 ├── DailyJournals[]              # Daily work reflections and mentor reviews
 ├── ExitClearances[]             # Offboarding checklists and settlements
 ├── AlumniProfile?               # Permanent post-internship archive record
 ├── EmployeeProfile?             # Future conversion to permanent staff
 └── UserAccount?                 # Auth credentials, active sessions, and roles
```

### Table 4: Entity Registry
| Entity | Meaning | Can Repeat for One Person? |
| :--- | :--- | :--- |
| **Person** | Canonical physical identity and verified contact details. | **No** — exactly one active canonical identity. |
| **Lead** | Commercial acquisition opportunity for courses or training. | **Yes** — new inquiry creates a new lead under the Person. |
| **Application** | Formal submission for a corporate internship opening. | **Yes** — candidate can apply to multiple requisitions. |
| **Interview** | Structured evaluation round with an assigned panel. | **Yes** — multiple rounds per application. |
| **Offer** | Binding internship offer contract with compensation terms. | **Yes** — multiple revisions or distinct offers over time. |
| **TrainingEngagement** | Enrollment in an academic learning cohort. | **Yes** — multiple programs over time. |
| **CompanyInternship** | Active corporate work contract with operational duties. | **Yes** — e.g. Summer intern returning as Fall intern. |
| **AssetAssignment** | Custody record of hardware or access badges. | **Yes** — multiple items assigned and returned. |
| **LeaveRequest** | Time-off deduction record approved by management. | **Yes** — multiple leave requests. |
| **ExitRecord** | Formal resignation/termination clearance record. | **Yes** — one per completed internship contract. |
| **AlumniProfile** | Permanent alumni record with public credential verification. | **No** — one active historical alumni identity. |
| **UserAccount** | Authentication identity for Portal and internal system access. | **No** — one login account linked to `personId`. |

### 3.2 Duplicate Management
1. **Fuzzy Matching:** Before creating a new Person, the system checks normalized email (`lowercase`, `trim`) and normalized phone (`E.164` format).
2. **Review Instead of Silent Merging:** If a matching phone or email is detected with a different name or context, the system flags the record for administrative duplicate review rather than silently corrupting data.
3. **Audit-Safe Canonical Merge:** An authorized administrator can execute a merge operation:
   - One Person is designated canonical.
   - All leads, applications, interviews, payments, documents, and tasks are re-linked to the canonical `personId`.
   - The non-canonical Person is archived with a pointer `mergedInto: canonicalPersonId`.
   - Financial transactions, issued documents, certificates, and audit logs are **never deleted**.

---

## 4. Authorization: Role + Permission + Scope + Context

Security enforcement follows a strict 4-tier evaluation formula:
```text
ALLOW = hasPermission(user, requestedAction)
    AND scopeAllows(user, targetResource)
    AND contextAllows(user, targetResource)
    AND fieldPolicyAllows(user, requestedFields)
```

### Table 5: 14 Enterprise Roles Matrix
| Role | Default Intent | Operational Boundaries & Restrictions |
| :--- | :--- | :--- |
| `SUPER_ADMIN` / `FOUNDER` | Unrestricted company-wide system authority. | All actions are logged to immutable audit; private sandboxes are creator-only. |
| `ORGANIZATION_ADMIN` | Full operational authority within a tenant organization. | Scoped strictly to `organizationId`; cannot modify global tenant configurations. |
| `HR_ADMIN` | Manages recruitment, applicants, interviews, offers, assets, offboarding. | Cannot alter financial transaction ledgers or read mentor-private journals. |
| `PROGRAM_MANAGER` | Oversees cohort schedules, batch tracks, milestone completion. | Manages assigned programs and batches; cannot issue formal offers or payouts. |
| `MENTOR` | Technical guide for intern tasks, PR reviews, daily journals. | Scoped to assigned interns and projects; cannot access recruitment ATS or finance. |
| `INTERVIEWER` | Conducts candidate technical/culture interviews and scorecards. | Access restricted to assigned interview candidate dossiers and scorecards. |
| `FINANCE_ADMIN` | Manages candidate fee collections, refunds, intern stipend payouts. | Read/write access to financial ledgers; no access to candidate technical work. |
| `AUDITOR` | Compliance officer inspecting security, data integrity, and logs. | Read-only access across all modules; zero mutation permissions. |
| `EMPLOYEE` | Standard staff member executing assigned operational workflows. | Scoped to explicitly assigned leads, tasks, and permitted shared mailboxes. |
| `TRAINER` | Instructs academic batches, records attendance, grades checkpoints. | Scoped to assigned training batches and enrolled training interns. |
| `TRAINING_INTERN` | Student enrolled in learning programs. | Own portal, curriculum, attendance, fee invoices, and practice exercises. |
| `COMPANY_INTERN` | Active corporate contributor executing project tasks. | Own portal, assigned tasks, PR submissions, daily journals, leaves, stipend slip. |
| `CANDIDATE` / `PORTAL_USER` | External applicant tracking application and offer status. | Own application dossier, interview schedule, offer document, and pass QR. |
| `ALUMNI` | Former intern with completed or relieving status. | Read-only archive access to historical certificates, letters, and statements. |

### 4.1 Permission Catalog
- **Identity & CRM:** `people.read`, `people.create`, `people.update`, `people.merge`, `leads.read`, `leads.manage`, `leads.assign`
- **Recruitment & ATS:** `openings.manage`, `applications.read`, `applications.review`, `interviews.schedule`, `interviews.evaluate`, `offers.draft`, `offers.approve`, `offers.send`
- **Training & Demos:** `bootcamps.manage`, `passes.generate`, `attendance.mark`, `demos.schedule`, `demos.manage`, `training.manage`, `training.evaluate`
- **Internship Operations:** `interns.read`, `interns.manage`, `projects.manage`, `tasks.assign`, `tasks.evaluate`, `journals.review`
- **Assets & Leaves:** `assets.manage`, `assets.assign`, `assets.return`, `leaves.apply`, `leaves.approve`, `leaves.manage`
- **Offboarding & Exit:** `exit.initiate`, `exit.clearance`, `exit.relieving.generate`, `alumni.manage`
- **Finance & Stipends:** `payments.read`, `payments.verify`, `payments.refund`, `stipends.read`, `stipends.approve`, `stipends.disburse`
- **Documents & Letters:** `templates.read`, `templates.manage`, `documents.generate`, `documents.approve`, `documents.issue`, `certificates.issue`, `certificates.revoke`
- **Communications:** `mailboxes.read`, `mailboxes.send`, `communications.compose`, `communications.logs.read`
- **System & Audit:** `settings.manage`, `roles.manage`, `audit.read`, `metrics.view`

### Table 6: Scope Values
| Scope | Operational Boundary |
| :--- | :--- |
| `OWN` | Access restricted strictly to records created by or belonging to the authenticated user. |
| `ASSIGNED` | Access permitted for records where `assignedEmployeeId` or `mentorId` equals user ID. |
| `DEPARTMENT` | Access permitted for records belonging to the user's assigned organizational department. |
| `ORGANIZATION` | Access permitted across the entire tenant organization (`organizationId`). |
| `SELECTED` | Access explicitly granted to specific entity IDs via permission grants. |
| `ALL` | Cross-tenant system-wide access (exclusive to `SUPER_ADMIN`). |

---

## 5. Person and Lead CRM

### 5.1 Lead Creation Sources
1. Google Forms / Google Sheets live webhook importer.
2. Instagram / Meta advertising campaign webhook.
3. Direct inbound telephone call or WhatsApp inquiry.
4. Physical walk-in at TechMecha Torque office.
5. Employee referral.
6. Current student / intern referral.
7. College placement cell / TPO partnership.
8. LearningSpaces cross-sell inquiry.
9. TMT public careers website application.
10. Manual administrative lead creation.

### 5.2 Lead State Machine
```text
[ NEW ] ───► [ CONTACTED ] ───┬───► [ INTERESTED ] ───┬───► [ BOOTCAMP_BOOKED ] ──┐
                              │                       ├───► [ DEMO_SCHEDULED ]  ──┼──► [ CONVERTED ]
                              │                       ├───► [ DIRECT_TRAINING ] ──┤
                              │                       └───► [ FOLLOW_UP ] ────────┘
                              │
                              └───► [ NOT_INTERESTED ] ───► [ LOST ]
```

### Table 8: Lead Schema Fields
| Field Group | Required Fields | Description |
| :--- | :--- | :--- |
| **Identity** | `personId`, `name`, `email`, `phone` | Snapshot of contact details linked to canonical Person. |
| **Acquisition** | `source`, `campaign`, `formResponseRef`, `createdAt` | Channel origin and marketing attribution data. |
| **Ownership** | `assignedEmployeeId`, `assignedAt` | Responsible counselor or sales representative. |
| **Intent** | `programOfInterest`, `expectedCohort`, `notes` | Educational goals and background. |
| **Progress** | `status`, `callOutcome`, `nextFollowUpAt` | Stage and scheduled follow-up alarm timestamp. |
| **Conversion** | `conversionType`, `convertedAt`, `engagementId` | Links to created `TrainingEngagement` or `Application`. |
| **Loss** | `lostReason`, `lostNotes`, `lostAt` | Reason for drop-off (pricing, timing, competitor). |

### 5.4 Call Logging & Follow-Up Rules
- Every interaction creates an immutable `CallActivity` record storing employee ID, timestamp, outcome, call duration, and detailed notes.
- The follow-up queue prioritizes: (1) Overdue follow-ups, (2) Follow-ups due today, (3) High-priority leads.
- Converting or marking a lead `LOST` automatically deactivates pending reminder alarms.

---

## 6. Bootcamp, Pass and Check-In

### Table 9: Bootcamp Specifications
| Component | Required Behavior |
| :--- | :--- |
| **Bootcamp** | `title`, `date`, `venue`, `totalCapacity`, `registrationCutoff`, `status` (`DRAFT`, `PUBLISHED`, `COMPLETED`). |
| **Slot** | Time window (`startAt`, `endAt`), `capacity`, `bookedCount`, `checkedInCount`. |
| **Registration** | Binds `personId`, `bootcampId`, `slotId`, `status` (`REGISTERED`, `CONFIRMED`, `CANCELLED`). |
| **Pass** | Unique alphanumeric pass code (`TMT-PASS-XXXX`), cryptographic token, signed QR code. |
| **Attendance** | Check-in timestamp, staff verifier ID, validation method (`QR_SCAN`, `MANUAL_SEARCH`). |
| **Activation** | Check-in checklist: LinkedIn URL verified, Instagram follow verified, LearningSpaces account active. |

```text
BOOKING_REQUESTED ──► BOOKING_CONFIRMED ──► SLOT_ASSIGNED ──► PASS_GENERATED ──► PASS_SENT
  │
  └──► [ CHECKED_IN ] ──► [ ATTENDED ]
       (or CANCELLED / RESCHEDULED / WAITLISTED / NO_SHOW)
```

### 6.2 Check-In Security Rules
- The QR code contains only an encrypted HMAC verification token and pass identifier; no plaintext PII is embedded.
- Scanning an already checked-in QR code displays a duplicate warning with previous check-in details; it **never creates a duplicate attendance record**.

---

## 7. Demo Pipeline

```text
DEMO_TO_SCHEDULE ──► DEMO_SCHEDULED ──► REMINDER_SENT ──┬──► ATTENDED ──► OUTCOME_RECORDED ──► CONVERTED / LOST
                                                         │
                                                         └──► NO_SHOW ──► RESCHEDULED / LOST
```

### Table 10: Demo Fields & Policies
| Field | Type / Requirement | Policy |
| :--- | :--- | :--- |
| `personId` | ObjectId (Required) | Must resolve to valid canonical Person. |
| `assignedEmployeeId` | ObjectId (Required) | Staff member assigned to deliver the live session. |
| `scheduledAt` | DateTime (Required) | Timezone-aware timestamp (stored in UTC). |
| `mode` | Enum (`ONLINE`, `OFFLINE`) | Meeting link (Google Meet) or physical lab address. |
| `status` | State Machine Enum | Enforced transition rules. |
| `outcome` | Enum (`HIGH_INTEREST`, `NEEDS_FOLLOW_UP`, `ENROLLED`, `REJECTED`) | Captured upon completion. |
| `notes` | Text | Internal observations and recommended course curriculum. |

---

## 8. Training Intern Management

A **Training Intern** is a student enrolled in a structured learning curriculum. Training is educational and distinct from company product engineering. Bootcamp attendance is **not** a mandatory prerequisite for direct enrollment.

```text
ENROLLED ──► ACTIVE_TRAINING ──► CHECKPOINT_PENDING ◄──► TRAINING_IN_PROGRESS ──► TRAINING_COMPLETED ──► ELIGIBLE_FOR_COMPANY_INTERNSHIP
  │
  └──► (Exceptions: PAUSED / TRANSFERRED / DROPPED / EXTENDED)
```

### Table 11: Training Lifecycle Specs
| Category | Required Behavior |
| :--- | :--- |
| **Enrollment** | Binds Person, Program, Batch, Fee Plan, start/end dates. |
| **Curriculum Progress** | Sequential milestone progression; unlocks subsequent modules upon passing checkpoints. |
| **Attendance** | Session-by-session tracking (`PRESENT`, `ABSENT`, `EXCUSED`). Threshold default is 80%. |
| **Assessments** | Milestone checkpoints evaluate code submissions with numeric scores and qualitative trainer notes. |
| **Completion Action** | System evaluates automated completion eligibility; formal certificate issuance is an explicit authorized staff action. |
| **Company Promotion** | Completing training does not automatically grant an internship. It flags the candidate as `ELIGIBLE_FOR_COMPANY_INTERNSHIP` for HR review. |

---

## 9. Company Internship & Corporate Recruitment Management

A **Company Intern** actively contributes to production engineering, client deliverables, and internal tooling for professional experience and stipend compensation.

### Dual Entry Pathways to Company Internship
1. **Academic Promotion Route:** Training Intern ➔ Completes Curriculum & Checkpoints ➔ Evaluated as Eligible ➔ Offered Company Internship.
2. **Direct Corporate ATS Recruitment Route:** Corporate Requisition (`InternshipOpening`) ➔ Job Application (`Application`) ➔ Screening ➔ Technical Interviews ➔ Offer Issuance ➔ Company Internship.

```text
[ REQUISITION: Opening ] ──► [ APPLICATION: APP-* ] ──► [ SCREENING ] ──► [ INTERVIEW ROUNDS ]
                                                                               │
[ ELIGIBLE TRAINING INTERN ] ──────────────────────────────────────────────────┴──► [ OFFER DRAFT ]
                                                                                           │
                                                                                           ▼
[ ACTIVE COMPANY INTERNSHIP ] ◄── [ ONBOARDING ] ◄── [ OFFER ACCEPTED ] ◄── [ OFFER ISSUED ]
```

```text
OFFERED ──► OFFER_SENT ──► ACCEPTED ──► ONBOARDING ──► ACTIVE ──► (EXTENDED / PAUSED) ──► 10-STAGE EXIT LIFECYCLE
```

### 9.1 Comprehensive Onboarding Checklist
- [x] Official Offer Letter generated from versioned template and acknowledged by intern.
- [x] Identity & educational documents uploaded and verified (Aadhaar/PAN, College NOC).
- [x] Portal account and role credentials activated.
- [x] Project Git repository access and team communication channels provisioned.
- [x] **Asset Allocation:** Laptop, monitor, access badge logged in Asset Management.
- [x] **Leave Quota Initialization:** Standard monthly leave balance credited.
- [x] **Stipend Setup:** Bank account, IFSC, and pan verification logged for monthly payout ledger.
- [x] Reporting manager and technical mentor assigned.
- [x] Initial sprint task assigned.

### 9.2 Complete 10-Stage Offboarding & Exit Lifecycle
```text
1. ACTIVE ──► 2. EXIT_INITIATED ──► 3. NOTICE_PERIOD ──► 4. HANDOVER_IN_PROGRESS ──► 5. ASSET_CLEARANCE_PENDING
                                                                                              │
8. DEACTIVATED ◄── 7. RELIEVING_DOCS_ISSUED ◄── 6. STIPEND_SETTLEMENT_PENDING ◄──────────────┘
      │
      ▼
9. ARCHIVED ──► 10. ALUMNI (Permanent Archive & Credential Verification)
```

1. **`EXIT_INITIATED`:** Triggered by resignation submission or end-of-term scheduled completion.
2. **`NOTICE_PERIOD`:** Minimum transition window (typically 1 to 2 weeks) for knowledge transfer.
3. **`HANDOVER_IN_PROGRESS`:** Outstanding pull requests merged or reassigned; documentation signed off.
4. **`ASSET_CLEARANCE_PENDING`:** Equipment inspected and checked in by IT/Admin in Asset Management.
5. **`STIPEND_SETTLEMENT_PENDING`:** Final pro-rated stipend calculated, factoring leave deductions.
6. **`RELIEVING_DOCS_ISSUED`:** Formal Relieving Letter and Experience Certificate rendered and signed.
7. **`DEACTIVATED`:** Active credentials revoked; role transitioned to read-only access.
8. **`ARCHIVED`:** Operational record locked against further mutation.
9. **`ALUMNI`:** Person transitioned to permanent TMT Alumni directory with public credential verification.

---

## 10. Programs, Batches, Attendance and Leave Management

### Table 13: Programs & Cohort Entities
| Entity | Key Attributes | Responsibility |
| :--- | :--- | :--- |
| `TrainingProgram` | `name`, `code`, `durationWeeks`, `grossFee`, `curriculumTree` | Defines the educational syllabus. |
| `TrainingBatch` | `programId`, `trainerId`, `cohortCode`, `startDate`, `endDate`, `status` | Active delivery cohort. |
| `TrainingSession` | `batchId`, `date`, `startTime`, `topic`, `meetLink` | Individual class schedule. |
| `AttendanceRecord` | `personId`, `engagementId`, `date`, `checkInAt`, `status`, `lateFlag` | Daily tracking across training and internships. |
| `LeaveRequest` | `personId`, `leaveType`, `startDate`, `endDate`, `reason`, `status` | Formal time-off records. |
| `LeaveBalance` | `personId`, `totalCredits`, `usedCredits`, `pendingCredits` | Tracks available leave allowances. |

### 10.1 Leave Management Subsystem
- **Categories:** Casual Leave (`CL`), Sick Leave (`SL`), Academic/Exam Leave (`AL`), Unpaid Leave (`LOP`).
- **Approval Workflow:** `APPLIED ➔ PENDING_APPROVAL ➔ APPROVED / REJECTED`.
- **Attendance Synchronization:** Approved leave requests automatically mark the daily attendance record as `ON_LEAVE` with `leaveRequestId` reference, preventing erroneous `ABSENT` flags.
- **Deductions:** Unexcused absences or approved `LOP` days feed directly into the monthly Stipend Ledger for pro-rated calculation.

### 10.2 Daily Attendance Rules
- Configurable start time (e.g. 09:30 AM) with a 15-minute grace window. Check-ins after 09:45 AM are flagged `LATE`.
- Minimum 4 hours required for Half-Day; minimum 7 hours required for Full-Day.

---

## 11. Payments, Stipend and Finance Ledger

Financial operations maintain strict segregation between **Candidate Fee Collections** and **Intern Stipend Payouts**.

### 11.1 Candidate Fee Collections
```text
PAYMENT_REQUESTED ──► RAZORPAY_ORDER_CREATED ──► PAID_GATEWAY ──► WEBHOOK_VERIFIED ──► ALLOCATED ──► RECEIPT
                                                       │
(Manual Option: PROOF_SUBMITTED ──► ADMIN_VERIFIED) ───┴──► FAILED / EXPIRED
```
- **Webhook Idempotency:** Every Razorpay webhook checks `providerPaymentId`. If already recorded, returns HTTP 200 immediately without duplicating balances.
- **Installments:** Gross fee minus approved discounts yields net payable; scheduled across installment dates.

### 11.2 Monthly Intern Stipend Ledger
```text
SCHEDULED ──► PENDING_APPROVAL ──► APPROVED ──► PAID_DISBURSED ──► VERIFIED
  │
  └──► (Alternative: ON_HOLD / ADJUSTED / CANCELLED)
```

$$\text{Net Payout} = \text{Base Stipend} - \left(\frac{\text{Base Stipend}}{\text{Working Days}} \times \text{LOP Days}\right) + \text{Performance Bonus}$$

- **Segregated Access:** Interns view only their own stipend slips. Company-wide payroll ledgers are restricted to `FOUNDER` and `FINANCE_ADMIN`.
- **Immutable Ledger:** Every stipend payout creates a transaction record capturing period, gross, deductions, approver, reference ID, and audit hash.

---

## 12. Projects, Work Items, Submission and Evaluation

```text
Project
  └── WorkItem (PROJECT_TASK)
        └── WorkItem (SUBTASK)
```

```text
ASSIGNED ──► IN_PROGRESS ──► SUBMITTED ──► WAITING_FOR_EVALUATION ──┬──► APPROVED ──► COMPLETED
                                 ▲                                   │
                                 └─── CHANGES_REQUIRED ◄─────────────┘
```

### Table 14: Work Item & Evaluation Models
| Component | Required Specifications |
| :--- | :--- |
| **Work Item** | `title`, `description`, `projectId`, `assigneeId`, `evaluatorId`, `priority`, `dueAt`, `status`, `gitBranch`. |
| **Submission** | Versioned record: `versionNumber`, `prUrl`, `liveUrl`, `notes`, `attachments`, `submittedAt`. |
| **Versioning** | Resubmissions increment version (`v1`, `v2`); previous submission records remain immutable. |
| **Scorecard** | Criteria (1–5 scale): (1) Code Quality, (2) Completeness, (3) Documentation, (4) Communication, (5) Punctuality. |
| **Governance** | Interns cannot mark tasks `COMPLETED`. Completion requires evaluator sign-off. |

---

## 13. Standalone Tasks, Founder Private Work and Daily Journals

### 13.1 Founder Private Task Sandbox
- The Founder can create `PRIVATE` standalone tasks.
- Visibility is enforced at the database query level (`{ visibility: 'PRIVATE', creatorId: req.user._id }`). Other administrators receive a 403 / 404 response on direct API requests.

### 13.2 Daily Engineering Journals
- Interns submit a daily engineering reflection before end-of-day:
  - Tasks executed and PR links.
  - Hours worked breakdown.
  - Technical blockers / impediments.
  - Learning takeaways.
- Mentors review journals daily, post inline guidance, and record a sentiment check.

---

## 14. Communication Center: Email, WhatsApp and Inbox

```text
Business Event / Manual Compose ──► Template Renderer ──► Worker Queue (BullMQ) ──► Channel Adapter ──► Delivery Log
                                                                                               ├── SMTP Email
                                                                                               └── WhatsApp API
```

### Table 16: Multi-Mailbox & Communications
| Entity | Key Attributes | Policy |
| :--- | :--- | :--- |
| `Mailbox` | `displayName`, `address`, `provider`, `authConfig`, `syncStatus` | Encrypted SMTP/IMAP credentials; passwords never exposed to frontend. |
| `MailboxAccessGrant` | `mailboxId`, `userId`, `canRead`, `canSend`, `canReply` | Fine-grained mailbox permissions. |
| `EmailThread` | `mailboxId`, `subject`, `participants`, `linkedEntityRef` | Ties email conversations to Person, Candidate, or Intern. |
| `DeliveryLog` | `channel`, `recipient`, `templateId`, `status`, `providerMessageId` | Independent delivery tracking (`PENDING`, `SENT`, `DELIVERED`, `FAILED`). |

---

## 15. Document, Letter Studio and Certificate Center

Integrates the official **TechMecha Torque Letter Studio Engine** with dynamic vector rendering, DPIIT recognition, MSME Udyam credentials, and authorized digital signatures.

```text
DRAFT ──► GENERATED ──► APPROVED ──► SENT ──► VIEWED ──► ACKNOWLEDGED ──► SIGNED_COPY_UPLOADED ──► VERIFIED
```

### 15.1 Official 13-Template Letter Catalog
1. **Training Internship Enrollment Letter:** Academic cohort admission and fee schedule confirmation.
2. **Company Internship Offer Letter:** Corporate internship appointment with stipend and role terms.
3. **Joining Letter:** Formal reporting date and workstation instructions.
4. **Internship Extension Letter:** Mutual extension of active internship tenure.
5. **Work Mode Change Letter:** Transition between On-Site, Hybrid, and Remote status.
6. **Stipend Confirmation / Revision Letter:** Payout rate adjustments and performance bonuses.
7. **Internship Completion Letter:** Certification of completed project work.
8. **Experience Certificate:** Formal credential certifying skills and duration.
9. **Relieving Letter & No-Dues Clearance:** Final clearance confirming asset return and zero liabilities.
10. **Termination Letter:** Formal notice of contract cessation with cause.
11. **Commercial Payment Receipt:** Tax invoice for candidate training fees.
12. **Bootcamp Invitation & Pass:** QR-enabled entry ticket.
13. **Letter of Recommendation (LOR):** Personalized executive endorsement.

### 15.2 Template Architecture & Rendering Pipeline
- **Vector Layout:** Rendered using PDFKit vector graphics embedding official DPIIT and MSME seals.
- **Dynamic Merge Variables:** Controlled interpolation (`{{intern.name}}`, `{{intern.referenceCode}}`, `{{intern.stipend}}`, `{{intern.startDate}}`, `{{company.signatoryName}}`).
- **Template Versioning:** Updating a template creates version `N+1`; previously issued documents remain locked.
- **Web Previewer Modal:** React UI modal providing vector zoom, download, print, and approval actions.
- **Public Certificate Verification:** Tamper-evident verification URL (`/verify/certificate/:token`) displaying verified recipient, program, issue date, and cryptographic hash.

---

## 16. Candidate / Intern Portal

### Table 17: Portal Feature Scoping
| Section | Candidate / Applicant | Training Intern | Company Intern |
| :--- | :--- | :--- | :--- |
| **Profile** | Contact, college, resume. | Own contact, course status. | Complete corporate profile, mentor details. |
| **Recruitment** | Application status, interview dates. | Historical application. | Historical application. |
| **Bootcamp/Demo** | Passes, QR code, schedule. | Past event attendance. | Past event attendance. |
| **Training** | N/A | Modules, attendance, checkpoints. | Historical training records. |
| **Work Items** | N/A | Practice assignments. | Sprints, tasks, PR submissions, feedback. |
| **Journals** | N/A | N/A | Daily engineering journal submissions. |
| **Assets** | N/A | N/A | Acknowledged hardware & access cards. |
| **Leaves** | N/A | Leave requests for classes. | Leave requests, quota balances. |
| **Documents** | Offer letter, pass. | Enrollment letter, fee receipt. | Offer, NDAs, Relieving, Experience letter. |
| **Certificates** | Event pass. | Course completion certificate. | Internship completion certificate & LOR. |
| **Stipend** | N/A | N/A | Monthly stipend ledger & pay slip. |

---

## 17. Calendar, Reminders, Notifications, Cautions and Meetings

### Table 18: Operational Schedules & Alarms
| Source | Calendar / Meeting Items | Operational Cautions (High Priority) |
| :--- | :--- | :--- |
| **Growth** | Bootcamp schedules, lead follow-ups. | Uncontacted leads > 24 hours. |
| **Recruitment** | Candidate interview rounds. | Interview feedback pending > 48 hours. |
| **Training** | Class sessions, checkpoint due dates. | Student attendance falling below 80%. |
| **Work** | Task deadlines, sprint reviews, 1-on-1s. | Task overdue > 3 days; evaluation pending > 48h. |
| **Assets** | Return inspection appointments. | Unreturned equipment past scheduled exit date. |
| **Finance** | Installment dues, monthly stipend payouts. | Overdue student payments; pending stipend approvals. |
| **Exit** | Offboarding milestones, exit interviews. | Exit clearances stuck in pending status. |

---

## 18. Search, Bulk Operations and Activity Timeline

- **Permission-Safe Global Search:** Multi-entity search across Person, Leads, Applications, Interns, Documents, and Tasks. Results filter strictly by user role and scope; existence of unauthorized records is never revealed.
- **Safe Bulk Operations:** Bulk lead assignment, slot booking, pass generation, and email dispatch run in background jobs with pre-validation summaries and per-item success/failure reporting.
- **Person 360° Timeline:** Chronological, unified event feed consolidating lead calls, ATS applications, interview notes, offers, training checkpoints, task submissions, stipend disbursements, and exit clearances.

---

## 19. Reporting and Dashboards

### Table 19: Role-Specific KPIs
| Dashboard | Primary Metrics |
| :--- | :--- |
| **Founder / Admin** | Conversion funnel, company cash flow, active interns, overdue cautions, system health. |
| **HR Admin** | Requisition pipeline, interview velocity, offer acceptance %, asset custody, offboarding status. |
| **Program Manager** | Cohort attendance %, checkpoint pass rate, student drop-off rate, trainer ratings. |
| **Mentor** | Active sprint tasks, PR evaluation turnaround time, intern daily journal submissions. |
| **Finance Admin** | Gross fees collected, installment aging, refunds, stipend disbursements vs budget. |
| **Intern** | Task completion %, on-time delivery rate, evaluation scores, attendance %, leave balance. |

---

## 20. Integrations and Background Jobs

### Table 20: BullMQ Queue Definitions
| Queue Name | Job Responsibility | Concurrency & Retry Policy |
| :--- | :--- | :--- |
| `communication.send` | Dispatches outgoing SMTP emails and WhatsApp messages. | 5 workers, 3 retries with exponential backoff. |
| `communication.retry` | Handles delayed retries for transient provider downtime. | Exponential backoff up to 24 hours. |
| `mailbox.sync` | Background IMAP synchronization for shared mailboxes. | Periodic 5-minute cron with distributed Redis lock. |
| `reminder.dispatch` | Evaluates and sends time-sensitive alarms for tasks/calls. | High-frequency 1-minute poller. |
| `payment.reconcile` | Polls Razorpay for unsettled transactions. | Hourly scheduled job. |
| `document.render` | Generates heavy PDFKit vector documents. | Offloaded worker thread with temporary file cleanup. |
| `certificate.generate` | Renders signed completion certificates and QR hashes. | Dedicated generation worker. |
| `cleanup.tempFiles` | Purges orphaned upload files older than 24 hours. | Daily maintenance cron. |

---

## 21. File Storage, Security, Audit and Recovery

### 21.1 Dual Storage Strategy
- **Abstract Provider Interface:** `StorageProvider` (`upload`, `getUrl`, `delete`).
- **Implementations:** `CloudinaryStorageProvider` / `S3StorageProvider` for cloud production; `LocalStorageProvider` (`uploads/`) for local development.
- **Security:** Private documents served via short-lived signed URLs; mime-type whitelist and max file sizes strictly enforced.

### 21.2 Authentication & Session Hardening
- **Access Tokens:** Short-lived JWT (15-minute expiry) signed with `JWT_ACCESS_SECRET`.
- **Refresh Tokens:** Long-lived (7-day expiry) stored in HttpOnly, Secure, SameSite cookies and tracked in MongoDB `Session` collection with device/IP metadata.
- **Rotation & Revocation:** Every refresh rotates the token family. Attempted reuse of an invalidated refresh token immediately revokes all active sessions for that user.

### 21.3 Immutable Audit Logging
- Every sensitive mutation (role changes, offer approvals, payment verifications, document revocations, exit sign-offs) writes an append-only `AuditLog` entry capturing actor, IP, action, resource, correlation ID, and complete before/after state diffs.

---

## 22. API Conventions and Endpoint Inventory

### 22.1 HTTP Conventions
- Base URL: `/api/v1`
- Content-Type: `application/json` (multipart/form-data for file uploads)
- Envelope: `{ success: true, data: { ... }, meta: { ... } }`
- Errors: `{ success: false, error: { code: "ERROR_CODE", message: "Human message", details: [] } }`

### Table 21: Comprehensive Endpoint Catalog
| Module | Method & Route | Purpose |
| :--- | :--- | :--- |
| **Auth** | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | Authentication and session lifecycle. |
| **People** | `GET/POST /people`, `GET/PATCH /people/:id`, `POST /people/:id/merge`, `GET /people/:id/timeline` | Canonical Person CRM and history. |
| **Leads** | `GET/POST /leads`, `PATCH /leads/:id`, `POST /leads/:id/calls`, `POST /leads/:id/convert` | Lead tracking and conversion. |
| **Recruitment** | `CRUD /recruitment/openings`, `CRUD /recruitment/applications`, `POST /applications/:id/stage` | ATS job openings and candidate intake. |
| **Interviews** | `CRUD /interviews`, `POST /interviews/:id/scorecard` | Interview scheduling and evaluations. |
| **Offers** | `CRUD /offers`, `POST /offers/:id/approve`, `POST /offers/:id/send`, `POST /offers/:id/accept` | Offer drafting, approval, and acceptance. |
| **Bootcamps** | `CRUD /bootcamps`, `POST /bootcamps/:id/slots`, `POST /passes/check-in` | Event setup, ticketing, and QR scan. |
| **Demos** | `CRUD /demos`, `POST /demos/:id/reschedule`, `POST /demos/:id/outcome` | Demo pipeline management. |
| **Training** | `CRUD /programs`, `CRUD /batches`, `POST /training-engagements`, `POST /checkpoints/:id/evaluate` | Course delivery and progress tracking. |
| **Interns** | `CRUD /interns`, `GET /interns/:id/dossier`, `PATCH /interns/:id/status` | Master company intern management. |
| **Work** | `CRUD /projects`, `CRUD /tasks`, `POST /tasks/:id/submit`, `POST /tasks/:id/evaluate` | Sprints, tasks, PR reviews, scorecards. |
| **Journals** | `GET/POST /journals`, `POST /journals/:id/feedback` | Daily engineering reflections. |
| **Assets** | `CRUD /assets`, `POST /assets/:id/assign`, `POST /assets/:id/return` | Hardware inventory and custody tracking. |
| **Leaves** | `CRUD /leaves`, `POST /leaves/:id/approve`, `POST /leaves/:id/reject` | Leave requests and balance tracking. |
| **Exit** | `POST /exit/initiate`, `POST /exit/:id/clearance`, `POST /exit/:id/complete` | 10-stage offboarding state machine. |
| **Payments** | `POST /payments/request`, `POST /payments/manual-verify`, `POST /payments/webhook` | Student fee collections and Razorpay. |
| **Stipends** | `GET /stipends/ledger`, `POST /stipends/approve`, `POST /stipends/disburse` | Monthly intern stipend calculations. |
| **Documents** | `CRUD /templates`, `POST /documents/generate`, `POST /documents/:id/send`, `GET /documents/:id/preview` | TMT Letter Studio vector documents. |
| **Certificates**| `POST /certificates/issue`, `POST /certificates/:id/revoke`, `GET /verify/certificate/:token` | Certificate issuance and public QR verify. |
| **Mail** | `CRUD /mailboxes`, `GET /mail/threads`, `POST /mail/messages/reply` | Multi-mailbox shared inboxes. |
| **Admin** | `CRUD /roles`, `CRUD /organizations`, `GET /audit`, `GET /metrics` | Tenant administration and audit logs. |

---

## 23. Database Collections and Key Fields

### Table 29: Complete 29-Collection Enterprise Database Catalog
1. **`people`:** Canonical identity, full name, normalized email, normalized phone, duplicate review flags, primary address.
2. **`users`:** Authentication credentials, password hash, `personId`, assigned role strings, multi-tenant `organizationId`, active flag.
3. **`roles` / `permissions`:** Dynamic enterprise role catalog, wildcard permission definitions, and scoping rules.
4. **`sessions`:** Active refresh token records, hashed token string, device user-agent, IP address, family ID, expiry timestamp.
5. **`organizations` / `departments`:** Multi-tenant company definitions, branding, DPIIT/MSME numbers, authorized signatories, units.
6. **`employeeProfiles`:** Internal staff records, department linkage, reporting hierarchy, operational assignments.
7. **`leads`:** Acquisition records, source channel, assigned counselor, interest category, status enum, follow-up alarms.
8. **`callActivities`:** Append-only log of counselor phone conversations, outcomes, notes, and next follow-up dates.
9. **`bootcamps` / `bootcampSlots`:** Event configurations, total capacity, slot times, booked counts, checked-in counts.
10. **`registrations` / `passes`:** Attendee event tickets, unique pass code, HMAC cryptographic token, issue timestamp.
11. **`demos`:** Product demo records, assigned demonstrator, schedule timestamp, delivery mode, outcome enum.
12. **`internshipOpenings`:** Requisitions, title, description, skills required, opening code, department, status.
13. **`applications`:** Corporate candidate submissions (`APP-YYYY-XXXXXX`), opening reference, candidate dossier, stage timeline.
14. **`interviews`:** Structured interview rounds (`INTV-YYYY-XXXXXX`), interviewers, schedule, Google Meet link, scorecards.
15. **`offers`:** Formal employment contracts (`OFFER-YYYY-XXXXXX`), compensation terms, approval status, acceptance timestamp.
16. **`trainingPrograms` / `trainingBatches`:** Educational curriculum specifications, batch schedules, assigned trainers.
17. **`trainingEngagements`:** Student course enrollments, milestone completion counters, attendance records, fee schedule linkage.
18. **`curriculumMilestones` / `checkpoints`:** Learning track modules, student exercise submissions, trainer grades.
19. **`companyInternships`:** Master intern records (`INT-YYYY-XXXXXX`), terms, mentor, project assignment, 10-stage lifecycle status.
20. **`assets`:** Equipment registry, asset tag, serial number, item category, status enum (`AVAILABLE`, `ASSIGNED`, `MAINTENANCE`).
21. **`assetAssignments`:** Custody tracking linking asset, intern, condition notes, checkout date, return date, inspector ID.
22. **`leaveRequests` / `leaveBalances`:** Time-off submissions, category enum, dates, manager approvals, remaining quota balances.
23. **`projects` / `workItems`:** Project tracking and unified tasks/subtasks, priorities, dead-line timestamps, sprint tags.
24. **`submissions` / `evaluations`:** Versioned work submissions, PR URLs, evaluator scorecards (1–5 scale), feedback notes.
25. **`journals`:** Daily engineering reflections, hours worked, impediments, mentor guidance comments.
26. **`stipendPlans` / `stipendPayouts`:** Monthly stipend ledgers, base rate, leave deductions, bonus additions, net disbursement.
27. **`documentTemplates` / `generatedDocuments`:** TMT Letter Studio vector templates, versions, rendered PDF paths, delivery status.
28. **`certificates`:** Formal completion certificates (`CERT-YYYY-XXXXXX`), verification token, QR hash, public validity flag.
29. **`mailboxes` / `deliveryLogs` / `auditLogs`:** Shared mailboxes, email/WhatsApp delivery tracking, and immutable audit trails.

### Compound Index Requirements
- `people`: `{ normalizedEmail: 1 }, { normalizedPhone: 1 }`
- `applications`: `{ openingId: 1, candidateId: 1 }` (unique compound index)
- `attendance`: `{ personId: 1, date: 1 }` (unique compound index)
- `workItems`: `{ assigneeId: 1, status: 1, dueAt: 1 }`
- `stipendPayouts`: `{ internId: 1, period: 1 }` (unique compound index)
- `sessions`: `{ refreshTokenHash: 1 }, { expiresAt: 1 }` (TTL index)
- `auditLogs`: `{ correlationId: 1 }, { entityId: 1, createdAt: -1 }`

---

## 24. Frontend Route and Screen Inventory

### Table 30: Frontend Screen Catalog
| Route | Screen View | Authorized Roles |
| :--- | :--- | :--- |
| `/dashboard` | Contextual Dashboard (Founder, HR, Mentor, Intern). | All authenticated users. |
| `/people` | Global Person CRM Directory & 360° Timeline. | Staff, HR, Admin. |
| `/growth/leads` | Lead Pipeline Queue & Call Activity Logger. | Counselors, Staff, Admin. |
| `/growth/bootcamps` | Bootcamp Event Manager & Ticket Scanner. | Event Coordinators, Admin. |
| `/growth/demos` | Demo Schedule Board & Outcome Tracker. | Presenters, Staff, Admin. |
| `/recruitment/openings` | Job Requisitions & Opening Management. | HR Admin, Founders. |
| `/recruitment/applications` | ATS Candidate Applications Kanban Board. | HR Admin, Interviewers. |
| `/recruitment/interviews` | Interview Schedule & Scorecard Submission. | Interviewers, HR Admin. |
| `/recruitment/offers` | Offer Generation & Approval Workflow. | HR Admin, Founders. |
| `/training/batches` | Batch Cohorts, Sessions & Student Milestones. | Trainers, Program Managers. |
| `/internships` | Master Intern Directory & Dossiers. | Mentors, HR Admin, Founders. |
| `/work/projects` | Team Projects, Repositories & Sprints. | Mentors, Interns, Admin. |
| `/work/tasks` | Work Item Kanban Board & Task Details. | Mentors, Interns. |
| `/work/journals` | Daily Engineering Journal Log & Reviews. | Mentors, Interns. |
| `/admin/assets` | Hardware Inventory & Custody Management. | IT Admin, HR Admin. |
| `/leaves` | Leave Application & Team Absence Calendar. | All employees & Interns. |
| `/admin/exit` | 10-Stage Exit & Offboarding Clearance Hub. | HR Admin, IT Admin, Founders. |
| `/finance/payments` | Candidate Training Fee Invoices & Razorpay. | Finance Admin, Founders. |
| `/finance/stipends` | Monthly Intern Stipend Payroll & Slips. | Finance Admin, Founders. |
| `/documents/studio` | TMT Letter Studio & PDF Previewer Modal. | HR Admin, Founders. |
| `/certificates` | Certificate Issuance & QR Verification Manager. | HR Admin, Founders. |
| `/communication/inbox` | Permitted Multi-Mailbox Unified Inbox. | Permitted Staff members. |
| `/calendar` | Unified Schedule & Meeting Room Links. | All authenticated users. |
| `/portal` | Intern / Candidate Self-Service Home. | Candidates, Interns, Alumni. |
| `/verify/certificate/:token` | Public Tamper-Evident Certificate Verification. | Public (No auth required). |

---

## 25. Error, Edge-Case and State-Machine Rules

### Table 31: Enterprise Edge-Case Matrix
| Edge Case Scenario | Required System Handling Rule |
| :--- | :--- |
| **Duplicate Candidate Application** | Rejects second application for the same requisition; flags candidate profile with existing application ID. |
| **Offer Expiry During Review** | System automatically shifts offer state from `SENT` to `EXPIRED` if unacknowledged after deadline; prevents late acceptance. |
| **Unreturned Asset at Scheduled Exit** | System halts offboarding state machine at `ASSET_CLEARANCE_PENDING`; blocks generation of Relieving Letter and alerts HR. |
| **Leave Balance Exhausted** | System permits leave application only under `UNPAID_LEAVE` (`LOP`); triggers automatic warning of stipend deduction. |
| **Concurrent Work Item Evaluations** | Utilizes MongoDB optimistic version concurrency (`{ _id, __v }`); second evaluator receives conflict warning and must refresh. |
| **Refresh Token Replay Attack** | Detected reuse of an invalidated refresh token immediately revokes all active sessions for that user account; alerts user via email. |
| **Simultaneous Pass Check-In Scans** | Atomic database update (`findOneAndUpdate({ passId, checkedIn: false })`) ensures only one scan succeeds; second returns prior check-in details. |
| **Stipend Calculation with Mid-Month Exit**| Automatically calculates pro-rated stipend based on exact active days worked minus unexcused absences. |

---

## 26. E2E Acceptance Scenarios

- **Scenario A (Lead ➔ Bootcamp ➔ Demo ➔ Training):** Inbound lead captured ➔ Deduplicated ➔ Slot booked ➔ Pass generated ➔ QR check-in ➔ Demo attended ➔ Enrolled in training cohort.
- **Scenario B (Direct Corporate Recruitment ➔ Internship):** Candidate applies to opening (`APP-*`) ➔ Screened ➔ Technical interview evaluated with scorecard ➔ Offer drafted, approved, issued (`OFFER-*`) ➔ Accepted ➔ Onboarded as Company Intern.
- **Scenario C (Training ➔ Company Promotion):** Student completes curriculum milestones ➔ Checkpoints graded ➔ Minimum attendance verified ➔ Marked eligible ➔ Converted to Company Intern.
- **Scenario D (Work Execution & PR Evaluation):** Task assigned ➔ Intern moves to In-Progress ➔ Submits GitHub PR URL ➔ Mentor reviews, requests changes ➔ Intern resubmits ➔ Mentor approves and scores.
- **Scenario E (Asset Custody & Inspection):** Laptop assigned during onboarding ➔ Condition notes recorded ➔ Used during tenure ➔ Returned and inspected during exit clearance.
- **Scenario F (Leave Application & Attendance Sync):** Intern applies for 2-day leave ➔ Manager approves ➔ Daily attendance automatically marked `ON_LEAVE` ➔ No unexcused absence recorded.
- **Scenario G (Founder Private Work Isolation):** Founder creates private task ➔ Direct API calls by other staff/admin receive 403 Forbidden.
- **Scenario H (Multi-Mailbox Permission Gating):** Staff A granted careers mailbox; Staff B not granted. Staff A sends/receives emails; Staff B is blocked.
- **Scenario I (Monthly Stipend Ledger & Payout):** Base stipend loaded ➔ 1 day unexcused LOP deducted ➔ Net calculated ➔ Approved by Finance ➔ Disbursed ➔ Intern downloads slip.
- **Scenario J (Letter Studio PDF Generation & Multi-Channel Delivery):** Offer generated using TMT Letter Studio ➔ DPIIT/MSME vector seals rendered ➔ Vector preview inspected in modal ➔ Dispatched via Email & WhatsApp.
- **Scenario K (Complete 10-Stage Exit ➔ Alumni):** Resignation initiated ➔ Handover signed off ➔ Assets cleared ➔ Stipend settled ➔ Relieving letter & Experience certificate issued ➔ Account moved to read-only Alumni status.
- **Scenario L (Public Certificate QR Verification):** Third-party scans certificate QR code ➔ System displays verified student name, track, issue date, and authentic status without exposing PII.
- **Scenario M (Refresh Token Rotation & Revocation):** Access token expires ➔ Client calls `/auth/refresh` ➔ Returns new token pair ➔ Old refresh token invalidated.

---

## 27. Intern Build Sequence and Definition of Done

### Table 32: Phased Implementation Sequence
| Phase | Focus Area | Mandatory Exit Criteria |
| :---: | :--- | :--- |
| **0** | Repository, Docker, Linting, Testing Pipeline | Clean build, passing unit test baseline, Zod environment validation. |
| **1** | Auth, Scoped RBAC, Sessions & Refresh Tokens | Protected route tests, token rotation, 403 rejection tests pass. |
| **2** | Canonical Person, Lead CRM & Deduplication | Lead capture, duplicate detection modal, 360° timeline functional. |
| **3** | Corporate ATS Recruitment, Interviews & Offers | Openings, applications, interview scorecards, formal offer approval flow. |
| **4** | Bootcamps, QR Passes & Check-In Validation | Event slots, HMAC QR generation, duplicate scan rejection pass. |
| **5** | Demos, Programs, Cohorts & Training Engagements | Course enrollment, milestone progression, attendance tracking. |
| **6** | Company Internships, Onboarding & Projects | Intern onboarding checklist, project boards, task assignment. |
| **7** | Work Items, PR Submissions & Scorecard Reviews | Versioned submissions, mentor feedback loops, immutable completion. |
| **8** | Daily Engineering Journals & Standup Meetings | Journal entry submission, mentor inline comments, Google Meet links. |
| **9** | Asset Management & Custody Tracking | Hardware inventory, check-out/check-in logging, custody audits. |
| **10** | Leave Management & Daily Attendance Integration | Leave requests, manager approval flows, auto-sync to daily attendance. |
| **11** | Candidate Fee Payments & Razorpay Webhooks | Fee installment plans, webhook idempotency, transaction receipts. |
| **12** | Intern Stipend Ledger & Payout Approvals | Monthly calculation formula, leave deduction, disbursement ledger. |
| **13** | TMT Letter Studio, Vector Rendering & Templates | Official 13-template catalog, DPIIT/MSME branding, web previewer modal. |
| **14** | Complete 10-Stage Exit Offboarding & Alumni | Offboarding state machine, clearances, relieving letters, alumni archive. |
| **15** | Unified Communication Center & Shared Inboxes | SMTP worker queue, WhatsApp adapter, delivery logs, shared mailbox sync. |
| **16** | Founder Command Center, Cautions & Dashboards | KPI metric aggregations, high-priority cautions, private task sandbox. |
| **17** | Global Scoped Search & Safe Bulk Operations | Entity search, pre-flight bulk validation, partial failure retry. |
| **18** | Security Hardening, Backup Runbook & Final E2E | Playwright E2E suite passes, backup/restore verified, production ready. |

### 27.1 Per-Task Definition of Done
1. Acceptance criteria written and verified against this specification.
2. Mongoose schema, compound indexes, and validation rules documented.
3. Server-side validation and RBAC authorization unit tests pass.
4. Happy path, forbidden path (403), and boundary edge-case tests pass.
5. Frontend empty, loading, error, and optimistic UI states implemented.
6. Immutable audit log recorded for critical business state transitions.
7. Zero third-party secrets leaked to client network bundles or Winston logs.
8. End-to-end user journey covered by Playwright regression suite.

---

## 28. V1 Exclusions, Change-Control Rule and Final Principles

### V1 Exclusions
- Automatic scraping of social media profiles.
- Biometric hardware time-clock integration.
- Native mobile app wrapper (responsive web SPA fulfills all requirements).
- Built-in video calling server (integrates external Google Meet / Zoom links).
- Full accounting general ledger (TMT platform manages operational receivables and stipends).

### Change-Control Rule
Once implementation commences, new architectural features or domain modifications require a formal Change Request documenting: (1) Target Entity, (2) API Contracts, (3) RBAC Permissions, (4) Frontend Screen, (5) Background Jobs, (6) Audit Events, and (7) E2E Test Scenarios.

---

### Final Implementation Principles
1. **One Person, Many Historical Engagements:** A human being has exactly one persistent identity across the company lifecycle.
2. **Dual Acquisition Flexibility:** Educational bootcamps/demos and direct corporate ATS recruitment operate as parallel, first-class intake funnels.
3. **Training vs. Company Work Segregation:** Training Internships represent learning relationships; Company Internships represent productive enterprise work.
4. **Server-Side State Machine Authority:** Status changes are explicit domain service actions backed by invariant rules, never arbitrary client PUT/PATCH edits.
5. **Multi-Layered Authorization:** Permission evaluation combines Role, Explicit Grants, Resource Scope, Department, and Field Policies.
6. **Unified Artifact Distribution:** A generated document artifact is rendered once and shared across Portal, Email, and WhatsApp.
7. **Event-Driven Communications:** Email and WhatsApp dispatch operate through an asynchronous queue worker with immutable delivery logging.
8. **Editable Collaboration vs. Immutable History:** Human comments are editable with audit history; system domain activity is strictly append-only.
9. **Segregated Financial Ledgers:** Candidate fee receivables and intern stipend disbursements reside in separate financial collections.
10. **Pluggable Architecture:** All third-party providers (payment gateways, storage providers, notification APIs) sit behind replaceable adapter interfaces.
11. **Comprehensive Lifecycle Accountability:** Equipment, leaves, and financial dues are formally cleared during the mandatory 10-stage offboarding machine before alumni transition.
12. **Mandatory Automated Verification:** Every core user journey must pass automated end-to-end testing before production sign-off.
