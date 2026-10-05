# Architecture Specification: Intern Management System (IMS)

## 1. System Overview

The **Intern Management System (IMS)** is engineered as a **Modular Monolith** built purely on the **MERN** stack:
- **Database:** MongoDB 6.0+ (Mongoose ODM) with multi-tenant data modeling and atomic transactions.
- **Backend API:** Node.js 20+ & Express.js Modular Monolith with strictly separated domain modules.
- **Frontend SPA:** React 18, Vite, Tailwind CSS, Lucide Icons, and Recharts.
- **Deployment:** Docker & Docker Compose for on-premise private server and containerized environments.

```
┌─────────────────────────────────────────────────────────────┐
│                       React 18 SPA                          │
│   (Public Portal, Candidate Wizard, HR/Admin ATS, Workspace)│
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON API (JWT Bearer)
┌──────────────────────────────▼──────────────────────────────┐
│                    Express API Gateway                      │
│   (Rate Limiter, Helmet, CORS, Audit Logger, JWT Auth)       │
├─────────────────────────────────────────────────────────────┤
│                    Domain Modules Layer                     │
│  ┌──────────────┬──────────────┬─────────────┬────────────┐ │
│  │ Recruitment  │  Interviews  │   Offers    │ Onboarding │ │
│  ├──────────────┼──────────────┼─────────────┼────────────┤ │
│  │   Interns    │    Tasks     │  Learning   │ Attendance │ │
│  ├──────────────┼──────────────┼─────────────┼────────────┤ │
│  │   Journals   │   Meetings   │ Performance │Certificates│ │
│  └──────────────┴──────────────┴─────────────┴────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Cross-Cutting Layer                     │
│    (Audit Logs, Storage Provider, PDF Generator, Mailer)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Mongoose ODM
┌──────────────────────────────▼──────────────────────────────┐
│                      MongoDB Database                       │
│    (24 Collections, Compound Indexes, Atomic Transactions)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Tenancy & Data Scoping

All business documents in the system are explicitly scoped by `organizationId`:
- Enforced at the middleware level (`extractTenant` / `authenticate`).
- Pre-save hooks and query middleware ensure query isolation across all organizations.
- Super Admins can manage cross-organization configurations, while Organization Admins, HR Admins, Mentors, and Interns are strictly isolated within their assigned organization.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Role | Recruitment / ATS | Offers & Onboarding | Intern Workspace | Attendance & Journals | Performance & Certs | System Settings & Audits |
|---|---|---|---|---|---|---|
| **SUPER_ADMIN** | Full Access | Full Access | Full Access | Full Access | Full Access | Full Access |
| **ORGANIZATION_ADMIN**| Full Access | Full Access | Full Access | Full Access | Full Access | Org Settings & Audits |
| **HR_ADMIN** | Full Access | Full Access | Read-Only | Read / Reports | Finalize / Generate | Org Users & Audits |
| **PROGRAM_MANAGER** | Review & Screen | View Plans | Full Project & Task Mgmt | View / Verify | Review / Evaluate | View Reports |
| **MENTOR** | Interviewer | View Tasks | Assign Tasks / Review Submissions | View / Comment | Evaluate Interns | None |
| **INTERVIEWER** | Score Interviews | None | None | None | None | None |
| **INTERN** | Track Own Status | Accept Own Offer | Work on Tasks / Submit Code | Check-in / Submit Journals | View Reviews / Download Certs | Profile Only |

---

## 4. Abstracted Storage Architecture

All document and certificate uploads are managed via the Abstract Storage Provider:
- Storage interface supports `saveFile`, `getFileStream`, and `deleteFile`.
- Default **Local Storage Adapter** saves files under `uploads/` with UUID-based hashed paths and strict path traversal protections (`path.normalize`).
- Cloud storage adapters (e.g. AWS S3, Azure Blob, MinIO) can be swapped in without modifying any domain module logic.

---

## 5. Automated Identifier Generation

All human-readable references follow atomic, collision-free sequential counters using the `counters` collection:
- Applications: `APP-YYYY-XXXXXX` (e.g., `APP-2026-000001`)
- Interviews: `INTV-YYYY-XXXXXX`
- Offers: `OFFER-YYYY-XXXXXX`
- Interns: `INT-YYYY-XXXXXX`
- Certificates: `CERT-YYYY-XXXXXX`
