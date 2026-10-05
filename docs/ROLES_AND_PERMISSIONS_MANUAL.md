# TechMecha Torque (TMT) — Enterprise Role, Persona & RBAC Manual

**System:** TechMecha Torque Intern Management System (TMT-IMS)  
**Version:** 2.0 Enterprise Release  
**Architecture:** Scoped Multi-Tenant Role-Based Access Control (RBAC) with Wildcard Grants  
**Canonical Source:** `shared/constants.js` • `server/src/middleware/rbac.js` • `server/src/modules/users/`

---

## 1. Executive Summary & Architecture Overview

The TechMecha Torque Intern Management System utilizes an **industry-standard, multi-tiered RBAC engine**. Access control operates across three layers:

```
┌──────────────────────────────────────────────────────────────────┐
│                   Layer 1: JWT Authentication                    │
│   Verifies token signature, extracts user identity & organization│
└─────────────────────────────────┬────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│              Layer 2: Multi-Tenant Scoping (Tenant Guard)         │
│   Ensures non-Super Admins are strictly scoped to organizationId │
└─────────────────────────────────┬────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                Layer 3: Granular RBAC & Wildcard Engine          │
│   Matches role permissions & wildcards (e.g., 'tasks.*', 'offers.read')│
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Who is Performing Which Role? (Active Personas & Credentials)

Below is the complete registry of seeded staff members, managers, mentors, interviewers, and interns currently active in the TechMecha Torque platform:

### 2.1 Staff & Leadership Directory

| Name | Role | Email | Default Password | Department | Primary Responsibilities | Portal / View |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Antigravity GlobalAdmin** | `SUPER_ADMIN` | `admin@techmecha.com` | `Password2026!` | Global / All | Complete cross-tenant authority, database maintenance, system health | Admin Portal |
| **Arthur Pendleton** | `ORGANIZATION_ADMIN` | `orgadmin@techmecha.com` | `Password2026!` | Engineering | Organization settings, cohort approvals, executive analytics | Admin Portal |
| **Rachel Adams** | `HR_ADMIN` | `hr@techmecha.com` | `Password2026!` | Engineering / HR | Candidate screening, ATS, interviews, offer letters, asset assignment, offboarding | Admin Portal |
| **Sarah Jenkins** | `PROGRAM_MANAGER` | `sarah.jenkins@techmecha.com` | `Password2026!` | Software Engineering | Cohort management, sprint tracks, project ownership, milestone tracking | Admin Portal |
| **Vikram Mehta** | `PROGRAM_MANAGER` | `vikram.mehta@techmecha.com` | `Password2026!` | Product & Design | Product track leadership, UX deliverables, autonomous route optimization project | Admin Portal |
| **Elena Rostova** | `MENTOR` | `elena.rostova@techmecha.com` | `Password2026!` | Software Engineering | Technical oversight, PR reviews, daily journal feedback, 1-on-1 syncs | Mentor Portal |
| **Marcus Vance** | `MENTOR` | `marcus.vance@techmecha.com` | `Password2026!` | Software Engineering | Backend code reviews, Docker/cloud mentorship, sprint demo evaluations | Mentor Portal |
| **Aisha Khan** | `MENTOR` | `aisha.khan@techmecha.com` | `Password2026!` | Data & Intelligence | Data pipeline reviews, telemetry modeling, ML project guidance | Mentor Portal |
| **David Chen** | `INTERVIEWER` | `david.chen@techmecha.com` | `Password2026!` | Software Engineering | Conducts technical interviews, records candidate scorecards and recommendations | ATS / Interviews |

---

### 2.2 Intern Cohort Directory (Sample Active Interns)

| Name | Role | Email | Password | Assigned Mentor | Assigned Project | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Arjun Sharma** | `INTERN` | `arjun.sharma@example.com` | `Password2026!` | Elena Rostova | Torque Cloud Telemetry Dashboard | `ACTIVE` |
| **Priya Patel** | `INTERN` | `priya.patel@example.com` | `Password2026!` | Marcus Vance | Fleet Ingestion & Diagnostics Engine | `ACTIVE` |
| **Rahul Verma** | `INTERN` | `rahul.verma@example.com` | `Password2026!` | Elena Rostova | Torque Cloud Telemetry Dashboard | `ACTIVE` |
| **Ananya Deshmukh** | `INTERN` | `ananya.deshmukh@example.com` | `Password2026!` | Aisha Khan | Autonomous Route Optimization API | `ACTIVE` |
| **Rohan Gupta** | `INTERN` | `rohan.gupta@example.com` | `Password2026!` | Marcus Vance | Fleet Ingestion & Diagnostics Engine | `ACTIVE` |
| **Sneha Reddy** | `INTERN` | `sneha.reddy@example.com` | `Password2026!` | Elena Rostova | Torque Cloud Telemetry Dashboard | `ACTIVE` |
| **Kavya Nair** | `INTERN` | `kavya.nair@example.com` | `Password2026!` | Elena Rostova | Full Stack Web Engineering | `ONBOARDING` |
| **Aditya Joshi** | `INTERN` | `aditya.joshi@example.com` | `Password2026!` | Marcus Vance | Full Stack Web Engineering | `PRE_ONBOARDING` |
| **Tanvi Agarwal** | `INTERN` | `tanvi.agarwal@example.com` | `Password2026!` | Marcus Vance | Fleet Ingestion & Diagnostics Engine | `ACTIVE` |
| **Kartik Iyer** | `INTERN` | `kartik.iyer@example.com` | `Password2026!` | Elena Rostova | Completed Program (Certificate Issued) | `COMPLETED` |

---

## 3. Which Roles Perfectly Exist in the System?

The system has **14 canonical enterprise roles** declared in `shared/constants.js`:

```javascript
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORGANIZATION_ADMIN: 'ORGANIZATION_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  HR_RECRUITER: 'HR_RECRUITER',
  PROGRAM_MANAGER: 'PROGRAM_MANAGER',
  MENTOR: 'MENTOR',
  TEAM_LEAD: 'TEAM_LEAD',
  INTERVIEWER: 'INTERVIEWER',
  FINANCE_ADMIN: 'FINANCE_ADMIN',
  FINANCE_VIEWER: 'FINANCE_VIEWER',
  DOCUMENT_ADMIN: 'DOCUMENT_ADMIN',
  AUDITOR: 'AUDITOR',
  INTERN: 'INTERN',
  CANDIDATE: 'CANDIDATE'
};
```

---

### 3.1 Role Descriptions & Exact Permission Arrays

#### 1. `SUPER_ADMIN`
- **Scope:** Global / Multi-Tenant Platform Master
- **Permissions:** `['*']` (Unrestricted root bypass)
- **Key Capabilities:** Tenant onboarding, cross-organization audits, direct schema management.

#### 2. `ORGANIZATION_ADMIN`
- **Scope:** Entire Tenant (`TechMecha Torque`)
- **Permissions:**
  ```javascript
  [
    'organizations.*', 'departments.*', 'programs.*', 'openings.*',
    'candidates.*', 'applications.*', 'interviews.*', 'offers.*',
    'onboarding.*', 'interns.*', 'mentors.*', 'projects.*', 'tasks.*',
    'learning.*', 'attendance.*', 'leaves.*', 'journals.*', 'meetings.*', 'feedback.*',
    'performance.*', 'documents.*', 'templates.*', 'certificates.*', 'finance.*',
    'assets.*', 'exit.*', 'analytics.*', 'settings.*', 'audit.read'
  ]
  ```

#### 3. `HR_ADMIN`
- **Scope:** Human Resources, Recruitment, People Operations & Compliance
- **Permissions:**
  ```javascript
  [
    'openings.*', 'candidates.*', 'applications.*', 'interviews.*', 'offers.*',
    'onboarding.*', 'interns.*', 'documents.*', 'templates.read', 'attendance.read',
    'attendance.manage', 'leaves.*', 'performance.*', 'certificates.*', 'assets.read',
    'exit.*', 'finance.read', 'analytics.read', 'audit.read'
  ]
  ```

#### 4. `HR_RECRUITER`
- **Scope:** ATS Funnel, Sourcing & Interview Scheduling
- **Permissions:**
  ```javascript
  [
    'openings.*', 'candidates.*', 'applications.*', 'interviews.*', 'offers.read',
    'onboarding.read', 'analytics.read'
  ]
  ```

#### 5. `PROGRAM_MANAGER`
- **Scope:** Academic Cohorts, Track Schedules, Project Progress & Mentorship Oversight
- **Permissions:**
  ```javascript
  [
    'programs.read', 'interns.read', 'projects.*', 'tasks.*', 'learning.*',
    'attendance.read', 'leaves.read', 'journals.read', 'meetings.*', 'feedback.*',
    'performance.*', 'assets.read', 'analytics.read'
  ]
  ```

#### 6. `MENTOR`
- **Scope:** Technical Supervision, PR & Task Submissions, Daily Journals & 1-on-1s
- **Permissions:**
  ```javascript
  [
    'interns.read', 'projects.read', 'tasks.*', 'journals.read', 'journals.review',
    'meetings.*', 'feedback.*', 'performance.review', 'leaves.read'
  ]
  ```

#### 7. `TEAM_LEAD`
- **Scope:** Technical Deliverables, Sprint Coordination & Code Review
- **Permissions:**
  ```javascript
  [
    'interns.read', 'projects.read', 'tasks.*', 'journals.read', 'meetings.*',
    'performance.review'
  ]
  ```

#### 8. `INTERVIEWER`
- **Scope:** Candidate Assessment Panels & Scorecard Submission
- **Permissions:**
  ```javascript
  [
    'candidates.read', 'applications.read', 'interviews.read', 'interviews.feedback'
  ]
  ```

#### 9. `FINANCE_ADMIN`
- **Scope:** Stipend Processing, Compensation Plans, Payment Ledgers & Exit Settlement
- **Permissions:**
  ```javascript
  [
    'finance.*', 'interns.read', 'offers.read', 'exit.clearance', 'analytics.finance', 'audit.read'
  ]
  ```

#### 10. `FINANCE_VIEWER`
- **Scope:** Financial Reporting & Read-Only Audit
- **Permissions:**
  ```javascript
  [
    'finance.read', 'analytics.finance'
  ]
  ```

#### 11. `DOCUMENT_ADMIN`
- **Scope:** Official Document Generation, Legal Clauses & Dynamic Templates
- **Permissions:**
  ```javascript
  [
    'templates.*', 'documents.*', 'certificates.*'
  ]
  ```

#### 12. `AUDITOR`
- **Scope:** Legal, Regulatory & Security Compliance (Read-Only)
- **Permissions:**
  ```javascript
  [
    'audit.read', 'applications.read', 'offers.read', 'interns.read', 'attendance.read',
    'finance.read', 'performance.read', 'documents.read', 'certificates.read', 'exit.read'
  ]
  ```

#### 13. `INTERN`
- **Scope:** Self-Service Intern Workspace (Scoped strictly to `_own` records)
- **Permissions:**
  ```javascript
  [
    'profile.read', 'profile.update', 'interns.read_own', 'projects.read_own',
    'tasks.read_own', 'tasks.submit', 'learning.read', 'learning.progress',
    'attendance.check_in', 'attendance.check_out', 'attendance.read_own',
    'leaves.request', 'leaves.read_own', 'journals.create', 'journals.read_own',
    'meetings.read_own', 'feedback.read_own', 'performance.read_own',
    'documents.read_own', 'documents.upload', 'certificates.read_own',
    'finance.read_own', 'assets.read_own', 'exit.read_own'
  ]
  ```

#### 14. `CANDIDATE`
- **Scope:** External Applicant Tracking Portal
- **Permissions:**
  ```javascript
  [
    'applications.read_own', 'interviews.read_own', 'offers.read_own', 'offers.accept_own'
  ]
  ```

---

## 4. Operational Permission Comparison Matrix

| Module | SUPER_ADMIN | ORG_ADMIN | HR_ADMIN | RECRUITER | MENTOR | FINANCE_ADMIN | INTERN | AUDITOR |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Openings & Recruitment** | Full | Full | Full | Full | ❌ | ❌ | ❌ | Read-Only |
| **Applications & Screening**| Full | Full | Full | Full | ❌ | ❌ | Read Own | Read-Only |
| **Interview Scheduling** | Full | Full | Full | Full | Score Only| ❌ | Read Own | Read-Only |
| **Offers & Contracts** | Full | Full | Full | Read-Only | ❌ | Read-Only | Accept Own| Read-Only |
| **Onboarding & Documents** | Full | Full | Full | Read-Only | ❌ | ❌ | Upload Own| Read-Only |
| **Intern Profiles** | Full | Full | Full | Read-Only | Read-Only | Read-Only | Read Own | Read-Only |
| **Tasks & Submissions** | Full | Full | Full | ❌ | Review/Assign | ❌ | Submit Own| Read-Only |
| **Daily Journals** | Full | Full | Full | ❌ | Review/Sign | ❌ | Write Own | Read-Only |
| **Attendance & Clocks** | Full | Full | Manage | ❌ | Read-Only | ❌ | Clock In/Out| Read-Only |
| **Leaves Management** | Full | Full | Approve | ❌ | Review | ❌ | Request Own| Read-Only |
| **Performance Reviews** | Full | Full | Finalize | ❌ | Evaluate | ❌ | Self-Appraise| Read-Only |
| **Stipends & Ledgers** | Full | Full | Read-Only | ❌ | ❌ | Full Process| Read Own | Read-Only |
| **Hardware & IT Assets** | Full | Full | Read-Only | ❌ | ❌ | ❌ | View Own | Read-Only |
| **Offboarding & Exit** | Full | Full | Approve | ❌ | Clear Tasks | Clear Finance| View Own | Read-Only |
| **Certificates & Badges** | Full | Full | Issue | ❌ | ❌ | ❌ | Download Own| Read-Only |
| **Audit Logs** | Full | Read-Only| Read-Only | ❌ | ❌ | Read-Only | ❌ | Read-Only |

---

## 5. How to Assign, Change, and Delete User Roles

### 5.1 Assigning a Role to a New User

User accounts are created and assigned roles via the authenticated API:

#### Endpoint:
`POST /api/users`  
**Authorization Required:** `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, or `HR_ADMIN`

#### Request Payload:
```json
{
  "firstName": "Liam",
  "lastName": "O'Connor",
  "email": "liam.oconnor@techmecha.com",
  "password": "TemporaryPassword2026!",
  "role": "MENTOR",
  "departmentId": "66e40939115d48ad8718012b",
  "phone": "+1 555 333 4444"
}
```

#### cURL Example:
```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Liam",
    "lastName": "OConnor",
    "email": "liam.oconnor@techmecha.com",
    "password": "Password2026!",
    "role": "MENTOR",
    "phone": "+1 555 333 4444"
  }'
```

---

### 5.2 Changing / Promoting an Existing User's Role

To promote an employee (for example, promoting a `MENTOR` to `TEAM_LEAD` or `PROGRAM_MANAGER`):

#### Via MongoDB Shell / Mongoose Script:
```javascript
import { User } from './server/src/modules/users/user.model.js';
import { ROLES } from './shared/constants.js';

await User.updateOne(
  { email: 'elena.rostova@techmecha.com' },
  { $set: { role: ROLES.TEAM_LEAD } }
);
```

> [!IMPORTANT]
> When a user's role is updated, their existing JWT token remains valid until expiry (or refresh). To immediately enforce permissions, call the token invalidation endpoint or have the user re-login.

---

### 5.3 Soft Deleting / Revoking a User's Role

In enterprise environments, users are **soft-deleted** or deactivated to preserve historical audit trails and signed documents:

```javascript
// Deactivating user access while keeping records intact
await User.updateOne(
  { email: 'user@techmecha.com' },
  { 
    $set: { 
      isActive: false, 
      deletedAt: new Date() 
    } 
  }
);
```

When `isActive: false`:
1. The `authenticate` middleware in `auth.js` automatically rejects login and token refresh requests.
2. The user will be blocked with `401 UNAUTHORIZED: Account has been deactivated`.

---

## 6. How to Add a Brand New Custom Role to the Platform

Follow this systematic 5-step checklist whenever introducing a new role (e.g. `QUALITY_ENGINEER` or `LEGAL_COUNSEL`):

### Step 1: Declare the Role in Constants
File: [shared/constants.js](file:///d:/SeptClaude2026/InternManagementSystem/shared/constants.js)

```javascript
export const ROLES = {
  // Existing roles...
  LEGAL_COUNSEL: 'LEGAL_COUNSEL'  // <--- Add new key
};
```

### Step 2: Configure Granular Permissions
File: [shared/constants.js](file:///d:/SeptClaude2026/InternManagementSystem/shared/constants.js)

```javascript
export const ROLE_PERMISSIONS = {
  // Existing roles...
  LEGAL_COUNSEL: [
    'documents.*',
    'templates.*',
    'offers.read',
    'exit.read',
    'audit.read'
  ]
};
```

### Step 3: Verify Mongoose Schema Validation
File: [server/src/modules/users/user.model.js](file:///d:/SeptClaude2026/InternManagementSystem/server/src/modules/users/user.model.js)

The User model dynamically loads all roles from `Object.values(ROLES)`:
```javascript
role: {
  type: String,
  enum: Object.values(ROLES), // Automatically includes LEGAL_COUNSEL!
  default: ROLES.INTERN,
  index: true
}
```

### Step 4: Protect Backend Endpoints with Middleware
File: Your target route file (e.g. `documentTemplate.routes.js`)

```javascript
import { requireRole, requirePermission } from '../../middleware/rbac.js';
import { ROLES } from '../../../../shared/constants.js';

// By specific role:
router.post('/templates', requireRole(ROLES.SUPER_ADMIN, ROLES.LEGAL_COUNSEL), createTemplate);

// OR by permission string:
router.post('/templates', requirePermission('templates.create'), createTemplate);
```

### Step 5: Configure Frontend Sidebar Navigation
File: [client/src/components/layout/Sidebar.jsx](file:///d:/SeptClaude2026/InternManagementSystem/client/src/components/layout/Sidebar.jsx)

Define the navigation group and map it to `currentNav`:
```javascript
const legalNav = [
  {
    group: 'Compliance & Legal',
    items: [
      { label: 'Document Templates', path: '/admin/templates', icon: FileCode },
      { label: 'NDAs & Agreements', path: '/admin/documents', icon: FileText },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: Shield }
    ]
  }
];

// In currentNav mapping:
const currentNav = 
  role === 'INTERN' ? internNav : 
  (role === 'MENTOR' ? mentorNav : 
  (role === 'LEGAL_COUNSEL' ? legalNav : adminNav));
```

---

## 7. How to Delete / Decommission a Role

To safely remove a role from the platform without causing runtime exceptions or orphaned references:

### Step 1: Scan for Active Users Assigned to the Role
Run a verification query in MongoDB:
```javascript
const count = await User.countDocuments({ role: 'TARGET_ROLE' });
console.log(`Users currently assigned: ${count}`);
```

### Step 2: Migrate Active Users to a Fallback Role
Never delete a role that still has active users. Reassign them first:
```javascript
await User.updateMany(
  { role: 'TARGET_ROLE' },
  { $set: { role: ROLES.AUDITOR } }
);
```

### Step 3: Check Relational Foreign Keys
Check if the role is referenced as a specialized foreign key:
- Mentors are referenced in `Intern.mentorId` and `Project.ownerId`.
- Interviewers are referenced in `Interview.interviewers`.
- If decommissioning `MENTOR`, ensure assigned interns have their `mentorId` reassigned.

### Step 4: Remove from Codebase
1. Remove key from `ROLES` in `shared/constants.js`.
2. Remove permission array from `ROLE_PERMISSIONS`.
3. Remove custom navigation items in `Sidebar.jsx`.

---

## 8. Frontend Navigation Routing Matrix

| Navigation Group | Accessible Roles |
| :--- | :--- |
| **Admin Navigation (`adminNav`)** | `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `HR_ADMIN`, `PROGRAM_MANAGER`, `FINANCE_ADMIN` |
| **Mentorship Navigation (`mentorNav`)** | `MENTOR`, `TEAM_LEAD` |
| **Intern Navigation (`internNav`)** | `INTERN` |
| **Public ATS Portal** | `CANDIDATE`, Public Guests (No login required) |

---

## 9. Security & Governance Principles

1. **Principle of Least Privilege (PoLP):** No user possesses more rights than required to execute their specific duty.
2. **Segregation of Duties (SoD):**
   - Mentors can score journals and review tasks, but cannot disburse stipend payments.
   - Finance Admins disburse payments, but cannot alter performance review scores.
   - HR Admins issue contracts and letters, but cannot change core system database schemas.
3. **Multi-Tenant Isolation:** Every query on the server is scoped with `{ organizationId: req.organizationId }`, guaranteeing that users in Tenant A can never view or manipulate records belonging to Tenant B.
4. **Tamper-Evident Audit Logging:** All critical actions (role elevation, offer approval, payment disbursement, certificate revocation) automatically trigger an immutable audit entry in the `AuditLog` collection.
