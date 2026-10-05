# Current State Assessment: TechMecha Torque IMS

**Generated At:** September 2026  
**System Name:** TechMecha Torque Intern Management System (TMT-IMS)  
**Architecture:** Pure MERN Modular Monolith (MongoDB, Express.js, React 18, Node.js 20)

---

## 1. Executive Summary

The existing Intern Management System represents a working **Modular Monolith** built on modern TypeScript-ready Node.js 20 ESM and React 18. It has active foundation modules covering the initial candidate application through basic intern certification. However, several enterprise subsystems (Finance & Stipends, Exit/Termination, Full Document Automation, Leave Management, Asset Management, SMTP Email Queues, and Cloudinary Storage) are currently either missing, mocked, or rudimentary.

---

## 2. Framework & Dependency Versions

### 2.1 Backend (`/server/package.json`)
* **Runtime:** Node.js 20+ (ES Modules: `"type": "module"`)
* **Core Framework:** `express` ^4.21.2
* **Database Driver:** `mongoose` ^8.9.5
* **Security & Network:** `helmet` ^8.0.0, `cors` ^2.8.5, `express-rate-limit` ^7.5.0
* **Authentication:** `jsonwebtoken` ^9.0.2, `bcryptjs` ^2.4.3
* **Validation:** `zod` ^3.24.1 (installed but underutilized in controllers)
* **File & Document:** `multer` ^1.4.5-lts.1, `pdfkit` ^0.16.0, `uuid` ^11.0.5
* **Logging & Telemetry:** `winston` ^3.17.0, `morgan` ^1.10.0
* **Test Suite:** `jest` ^29.7.0, `supertest` ^7.0.0

### 2.2 Frontend (`/client/package.json`)
* **Build Tool:** Vite ^6.0.7
* **Core Framework:** `react` ^18.3.1, `react-dom` ^18.3.1
* **Routing:** `react-router-dom` ^6.28.1
* **Data Fetching:** `@tanstack/react-query` ^5.64.2, `axios` ^1.7.9
* **Styling & Icons:** `tailwindcss` ^3.4.17, `clsx` ^2.1.1, `tailwind-merge` ^2.6.0, `lucide-react` ^0.473.0
* **Data Visualization:** `recharts` ^2.15.0

---

## 3. Current Database Design

The database runs on MongoDB 6.0+ with Mongoose schemas spread across `server/src/modules/`.

### Active Models (19 Models Found):
1. [User](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/users/user.model.js): Authentication credentials, role, organizationId, departmentId, active flag.
2. [Organization](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/organizations/organization.model.js): Tenant metadata, slug, branding, address, signatory.
3. [Department](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/organizations/organization.model.js): Org department units (ENG, PRD, DMI, etc.).
4. [InternshipProgram](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/recruitment/recruitment.model.js): Programs (e.g. Summer Cohort, Fall Fellowship).
5. [InternshipOpening](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/recruitment/recruitment.model.js): Job requisitions, requirements, stipend, opening code.
6. [Candidate](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/recruitment/recruitment.model.js): Personal, college, resume URL, skills, social links.
7. [Application](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/recruitment/recruitment.model.js): `APP-YYYY-XXXXXX`, opening/candidate links, status, stage timeline.
8. [Interview](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/interviews/interview.model.js): `INTV-YYYY-XXXXXX`, round type, scheduled date, meet link, scorecards.
9. [Offer](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/offers/offer.model.js): `OFFER-YYYY-XXXXXX`, dates, stipend string, workMode, status, acceptance timestamp.
10. [OnboardingPlan](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/onboarding/onboarding.model.js): Checklist items, document upload links, verification status.
11. [Intern](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/interns/intern.model.js): `INT-YYYY-XXXXXX`, master intern operational record, mentor linkage, dates.
12. [Project](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/projects/project.model.js): Team projects, repositories, status.
13. [Task](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/tasks/task.model.js): Tasks, deadlines, priorities, PR deliverable links, reviews.
14. [LearningCourse](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/learning/learning.model.js): LMS modules, chapters, lesson completion flags.
15. [AttendanceRecord](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/attendance/attendance.model.js): Check-in/out timestamps, late status, work mode, IP address.
16. [JournalEntry](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/journals/journal.model.js): Daily engineering reflections, hours worked, mentor comments.
17. [Meeting](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/meetings/meeting.model.js): Standups, 1-on-1s, sync calendar entries.
18. [PerformanceReview](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/performance/performance.model.js): Mid-term & final evaluations, 4 competency scores.
19. [Certificate](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/certificates/certificate.model.js): `CERT-YYYY-XXXXXX`, PDF generation metadata, verification hash.
20. [AuditLog](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/audit/audit.model.js): Append-only audit events, before/after diffs, actor role/IP.

---

## 4. Current Authentication & RBAC Strategy

* **Token Architecture:** Single JWT access token signed with `JWT_ACCESS_SECRET`. Token expiry configured in `.env` (defaults to 2 hours or 7 days).
* **Missing Refresh Token Flow:** While `JWT_REFRESH_SECRET` and `JWT_REFRESH_EXPIRES_IN` are declared in `env.js`, there is no refresh token rotation endpoint (`/auth/refresh`), no HttpOnly cookie storage, and no database `Session` / `RefreshToken` revocation mechanism.
* **RBAC Implementation:** Handled via [middleware/rbac.js](file:///d:/SeptClaude2026/InternManagementSystem/server/src/middleware/rbac.js) using `requireRole` and `requirePermission`. Wildcards (`*` and `domain.*`) are supported.
* **Tenant Isolation:** Enforced via `scopeToTenant` and manual queries (`organizationId: req.organizationId`). Super Admins bypass tenant filters.

---

## 5. Current Storage & Document Generation

* **Storage Service:** [LocalStorageService](file:///d:/SeptClaude2026/InternManagementSystem/server/src/utils/storage.js) writes to `./uploads` with UUID filenames.
* **Path Traversal Protection:** Basic `path.normalize` and prefix checking is implemented.
* **Missing Cloud Storage:** There is no Cloudinary provider, no S3 adapter, and no temporary upload cleanup pipeline.
* **Document Engine:** [pdfGenerator.js](file:///d:/SeptClaude2026/InternManagementSystem/server/src/utils/pdfGenerator.js) hardcodes PDFKit drawing commands for completion certificates and generic letters. It lacks template versioning, dynamic variable interpolation (`{{candidate.name}}`), and web preview rendering.

---

## 6. Current Email & Communication Engine

* **Status:** Completely missing. No SMTP transport, no Nodemailer, no background queue, no email delivery logs, and no idempotency keys.
* **Mock Notifications:** Notifications are stored in MongoDB (`Notification` model) and returned via polling.

---

## 7. Current Seeded Accounts

All seeded accounts share password: `Password2026!`
* **Super Admin:** `admin@techmecha.com`
* **Org Admin:** `orgadmin@techmecha.com`
* **HR Admin:** `hr@techmecha.com`
* **Program Manager:** `sarah.jenkins@techmecha.com`, `vikram.mehta@techmecha.com`
* **Mentor:** `elena.rostova@techmecha.com`, `marcus.vance@techmecha.com`
* **Active Intern:** `arjun.sharma@example.com`
* **Onboarding Intern:** `priya.patel@example.com`
* **Completed Intern:** `kartik.iyer@example.com`

---

## 8. Technical Debt & Immediate Gaps

1. **No Finance/Stipend Subsystem:** No models or routes for ledger entries, bonuses, deductions, payment cycles, payment statuses, or references.
2. **No Exit/Offboarding Subsystem:** No exit workflow, asset clearance, relieving letter generation, or access revocation.
3. **No Leave Management:** Attendance records cannot account for approved leaves, sick days, or holidays.
4. **No Asset Tracking:** Laptops, equipment, and ID cards cannot be assigned, tracked, or reclaimed upon exit.
5. **No Token Refresh or Session Model:** Active logins cannot be revoked server-side upon exit or termination.
6. **Hardcoded PDF Layouts:** Templates are not stored as configurable, versioned assets.
