# Enterprise Role & Permission Matrix (RBAC)

**System:** TechMecha Torque Intern Management System (TMT-IMS)  
**Model:** Fine-Grained Role-Based Access Control with Scoped Wildcards

---

## 1. Enterprise Roles Defined (14 Roles)

1. **`SUPER_ADMIN`**: Global platform administrator. Cross-tenant access, system health, tenant provisioning.
2. **`ORGANIZATION_ADMIN`**: Enterprise organization owner/executive. Full control within tenant scope.
3. **`HR_ADMIN`**: Head of People/HR. Manages ATS, interviews, offers, onboarding, reviews, and exits.
4. **`HR_RECRUITER`**: Sourcing & candidate screening, interview scheduling, applicant communication.
5. **`PROGRAM_MANAGER`**: Oversees cohort tracks, mentor-intern pairing, projects, and milestone progress.
6. **`MENTOR`**: Direct technical supervisor. Assigns tasks, reviews PR deliverables, provides daily journal feedback, and submits performance appraisals.
7. **`TEAM_LEAD`**: Technical team leader managing sprint items, code reviews, and daily standups.
8. **`INTERVIEWER`**: Panelist conducting technical/cultural rounds and recording scorecards.
9. **`FINANCE_ADMIN`**: Stipend processing, ledger adjustments, deductions, payment disbursements, and settlement approval.
10. **`FINANCE_VIEWER`**: Read-only auditor for financial statements, payment histories, and invoices.
11. **`DOCUMENT_ADMIN`**: Manages letter templates, template versioning, signature configurations, and official document issuance.
12. **`AUDITOR`**: Compliance officer with read-only access to immutable audit trails, change logs, and system events.
13. **`INTERN`**: Active participant. Daily check-in/out, task delivery, daily journal writing, LMS progress, and credential downloads.
14. **`CANDIDATE`**: Applicant tracking own application status, viewing interview schedules, and accepting offers.

---

## 2. Comprehensive Role-to-Permission Matrix

| Functional Module | Permission String | SUPER_ADMIN | ORG_ADMIN | HR_ADMIN | RECRUITER | MENTOR | FINANCE_ADMIN | INTERN | AUDITOR |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Recruitment** | `openings.manage` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ Read |
| | `applications.screen` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ Read |
| | `applications.stage` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ Read |
| **Interviews** | `interviews.schedule`| ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ Read |
| | `interviews.score` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 👁️ Read |
| **Offers** | `offers.create` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ Read |
| | `offers.approve` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ Read |
| | `offers.accept` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | 👁️ Read |
| **Onboarding** | `onboarding.manage` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ Read |
| | `documents.verify` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ Read |
| | `documents.upload` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ |
| **Interns** | `interns.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (Own) | 👁️ Read |
| | `interns.update` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Attendance** | `attendance.check_in`| ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ |
| | `attendance.manage` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ Read |
| **Tasks & PRs** | `tasks.assign` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | 👁️ Read |
| | `tasks.submit` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ |
| | `tasks.review` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | 👁️ Read |
| **Journals** | `journals.submit` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Own) | ❌ |
| | `journals.review` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | 👁️ Read |
| **Finance** | `finance.view` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ (Own) | 👁️ Read |
| | `finance.process` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Exit / Offboarding** | `exit.initiate`| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ Read |
| | `exit.clearance` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | 👁️ Read |
| | `exit.finalize` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ Read |
| **Certificates** | `certificates.issue`| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ Read |
| | `certificates.read` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ (Own) | 👁️ Read |
| **Audit Logs** | `audit.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Settings** | `settings.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*(Legend: ✅ Full Access | 👁️ Read-Only | ❌ Forbidden | Own: Restricted to caller's own record)*
