# Database Audit & Gap Matrix

**System:** TechMecha Torque Intern Management System (TMT-IMS)  
**Database:** MongoDB 6.0+ with Mongoose ODM  
**Date:** September 2026

---

## 1. Existing Collections & Schema Analysis

| Collection / Model | Key Fields Present | Multi-Tenant Index | Soft Delete | Gap Analysis & Deficiencies |
|---|---|---|---|---|
| **organizations** | `name`, `slug`, `code`, `signatory`, `status` | Yes (`slug` unique) | No | Missing attendance policy configuration (`startTime`, `graceMinutes`) and payment settings. |
| **departments** | `organizationId`, `name`, `code` | Yes (`organizationId + code`) | No | Fully operational. |
| **users** | `organizationId`, `email`, `password`, `role`, `isActive` | Yes (`organizationId + email`) | No | Missing refresh token references, session tracking, failed login count, account lock timestamps. |
| **candidates** | `firstName`, `email`, `phone`, `college`, `skills` | No (email unique per org missing) | No | Candidates not linked to canonical `Person` record; no duplicate detection index on `email + openingId`. |
| **applications** | `applicationId`, `openingId`, `candidateId`, `status`, `timeline` | Yes (`organizationId + applicationId`) | No | Lacks withdrawal reason, priority score, recruiter assignment, and state machine lock. |
| **interviews** | `interviewId`, `applicationId`, `candidateId`, `roundType`, `scorecard` | Yes (`organizationId + interviewId`) | No | Lacks historical reschedule log and interviewer reassignment history. |
| **offers** | `offerId`, `applicationId`, `stipend`, `status`, `acceptedAt` | Yes (`organizationId + offerId`) | No | Stipend is a plain string (`₹35,000 / Month`). Missing structured financial fields, template version, and approval flow. |
| **onboarding_plans** | `applicationId`, `candidateId`, `status`, `tasks` | Yes (`organizationId + applicationId`) | No | Lacks dynamic checklist customization per department/role; document rejection reasons not modeled cleanly. |
| **interns** | `internId`, `userId`, `applicationId`, `startDate`, `status` | Yes (`organizationId + internId`) | No | Status lacks exit states (`EXIT_INITIATED`, `TERMINATED`, `ALUMNI`). Missing asset link and financial balance. |
| **attendance** | `internId`, `date`, `checkIn`, `checkOut`, `status`, `workMode` | Yes (`organizationId + internId + date`) | No | Missing leave reconciliation (`LEAVE`, `HOLIDAY`). Hardcodes late calculation rather than using org policy. |
| **tasks** | `title`, `internId`, `mentorId`, `status`, `deliverableUrl` | Yes (`organizationId + internId`) | No | Lacks sprint linkage, estimated vs. actual hours, and milestone dependencies. |
| **journals** | `internId`, `date`, `dayNumber`, `workSummary`, `mentorFeedback` | Yes (`organizationId + internId + date`) | No | Well-structured for daily logs. |
| **learning_paths** | `title`, `departmentId`, `modules` | Yes (`organizationId + departmentId`) | No | LMS structure is functional for self-paced courses. |
| **performance_reviews** | `internId`, `reviewType`, `metrics`, `weightedScore`, `status` | Yes (`organizationId + internId + reviewType`) | No | Lacks intern self-review fields and immutable finalization lock/hash. |
| **certificates** | `certificateId`, `internId`, `verificationCode`, `pdfUrl` | Yes (`organizationId + certificateId`) | No | Missing document hash, revocation reason, and Letter of Recommendation (LOR) record. |
| **audit_logs** | `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `diff` | Yes (`organizationId + createdAt`) | Immutable | Lacks `requestId` correlation field. |

---

## 2. Missing Collections Required for Production

To fulfill the Master Prompt requirements, the following **10 new collections** must be introduced:

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ 1. persons                  │     │ 2. sessions                 │
│ Canonical master identity   │     │ Refresh tokens & devices    │
└─────────────────────────────┘     └─────────────────────────────┘
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ 3. payments                 │     │ 4. payment_ledgers          │
│ Monthly payment cycles      │     │ Immutable financial ledger  │
└─────────────────────────────┘     └─────────────────────────────┘
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ 5. exits                    │     │ 6. assets                   │
│ Offboarding & settlements   │     │ Equipment & laptop tracking │
└─────────────────────────────┘     └─────────────────────────────┘
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ 7. leaves                   │     │ 8. document_templates       │
│ Leave requests & balances   │     │ Versioned TMT letter specs  │
└─────────────────────────────┘     └─────────────────────────────┘
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ 9. email_logs               │     │ 10. letters_documents      │
│ SMTP audit & idempotency    │     │ Generated versioned letters │
└─────────────────────────────┘     └─────────────────────────────┘
```

### Schemas Details for Missing Models:
1. **`Person`**: Unifies Candidate, User, Intern, and Alumni identities into one permanent record.
2. **`Session`**: Tracks `refreshTokenHash`, `ipAddress`, `userAgent`, `expiresAt`, and `isRevoked` for active logins.
3. **`Payment`**: Tracks compensation cycle, gross stipend, deductions, net payable, status (`PAID`, `PENDING`, `FAILED`, etc.), and payment reference (`TMT-PAY-YYYY-XXXXXX`).
4. **`PaymentLedger`**: Append-only transactional ledger recording every bonus, deduction, penalty, and adjustment. Never overwritten.
5. **`Exit`**: Tracks 10-stage offboarding workflow (`EXIT_INITIATED` ➔ `ALUMNI`), reason, last working day, asset returns, settlement amount, and clearance sign-offs.
6. **`Asset`**: Tracks physical/digital equipment (Laptop, Monitor, ID Card, Cloud access) with status (`ASSIGNED`, `RETURN_PENDING`, `RETURNED`, `DAMAGED`).
7. **`Leave`**: Tracks leave requests, types (Sick, Casual, Academic), dates, approvals, and balance deductions.
8. **`DocumentTemplate`**: Stores letter templates with versioning (`OFFER_LETTER_V1`, `OFFER_LETTER_V2`), dynamic handlebars/variable schemas, and approval status.
9. **`EmailLog`**: Records recipient, subject, template, status (`QUEUED`, `SENT`, `FAILED`), provider, messageId, idempotency key, and retry count.
10. **`GeneratedDocument`**: Stores generated letters/PDFs with documentNumber (`DOC-YYYY-XXXXXX`), templateVersion, recipient, content hash, storage URL, and approval status.

---

## 3. Indexing & Query Optimization Strategy

### Compound Indexes to Add:
- `applications`: `{ organizationId: 1, openingId: 1, candidateEmail: 1 }` (Enforce unique application per candidate per opening)
- `attendance`: `{ organizationId: 1, internId: 1, date: -1 }` (Fast monthly report aggregation)
- `payments`: `{ organizationId: 1, internId: 1, cycle: 1 }` (Prevent duplicate stipend runs)
- `payment_ledgers`: `{ organizationId: 1, paymentId: 1, createdAt: 1 }` (Audit ordering)
- `assets`: `{ organizationId: 1, assignedTo: 1, status: 1 }` (Clearance lookup)
- `email_logs`: `{ idempotencyKey: 1 }` (Enforce single-dispatch guarantee)
- `sessions`: `{ refreshTokenHash: 1, isRevoked: 1 }` (Instant token rotation verification)
