# Canonical Lifecycle State Machine: Candidate to Alumni

**System:** TechMecha Torque Intern Management System (TMT-IMS)  
**Guiding Principle:** **Never lose lifecycle continuity.** Every intern traces back to their initial application and persists permanently into alumni state.

---

## 1. Complete 22-Stage Canonical Pipeline

```text
[ 1. SOURCE ]
      │
      ▼
[ 2. APPLICATION ] (APPLIED)
      │
      ▼
[ 3. SCREENING ] (UNDER_REVIEW)
      │
      ▼
[ 4. SHORTLISTING ] (SHORTLISTED)
      │
      ▼
[ 5. INTERVIEW ] (INTERVIEW_SCHEDULED ➔ INTERVIEWED)
      │
      ▼
[ 6. SELECTION ] (SELECTED)
      │
      ▼
[ 7. OFFER DRAFT & APPROVAL ] (DRAFT ➔ APPROVAL_PENDING ➔ APPROVED)
      │
      ▼
[ 8. OFFER ISSUANCE ] (OFFER_SENT)
      │
      ▼
[ 9. ATOMIC OFFER ACCEPTANCE ] (OFFER_ACCEPTED)
      │
      ├───────────────────────────────────────────────────────┐
      ▼                                                       ▼
[ 10. PRE-ONBOARDING ]                                 [ User Account Created ]
      │                                                [ Intern Profile Created (INT-*) ]
      ▼                                                [ Onboarding Checklist Seeded ]
[ 11. ONBOARDING & COMPLIANCE ] (ONBOARDING)
      │
      ▼
[ 12. ACTIVE INTERNSHIP ] (ACTIVE)
      │
      ├───────────────────────┼───────────────────────────────┐
      ▼                       ▼                               ▼
[ 13. DAILY ATTENDANCE ]   [ 14. TASKS & SPRINTS ]      [ 15. DAILY JOURNALS ]
(Check-in, Late detect)    (Kanban, PR Reviews)         (Reflections & Mentoring)
      │                       │                               │
      └───────────────────────┼───────────────────────────────┘
                              │
                              ▼
                       [ 16. LMS LEARNING ]
                       (Modules, Chapters, Quizzes)
                              │
                              ▼
                       [ 17. STIPENDS & FINANCE ]
                       (Monthly cycles, deductions, ledger)
                              │
                              ▼
                       [ 18. PERFORMANCE REVIEWS ]
                       (Mid-term & Final Competency Scoring)
                              │
                              ▼
                       [ 19. EXIT & OFFBOARDING ]
                       (EXIT_INITIATED ➔ ASSET_CLEARANCE ➔ SETTLEMENT)
                              │
                              ▼
                       [ 20. CERTIFICATION & LOR ]
                       (Eligibility Engine ➔ PDFKit Render ➔ Public Verification)
                              │
                              ▼
                       [ 21. DOCUMENT PACKAGE ]
                       (Relieving Letter, Experience Letter, Final Statement)
                              │
                              ▼
                       [ 22. ALUMNI ]
                       (Read-only archive, credential access, network)
```

---

## 2. State Transition Rules & Invariants

| State | Allowed Next States | Trigger Event | Invariants & Business Validations |
|---|---|---|---|
| `APPLIED` | `UNDER_REVIEW`, `REJECTED`, `WITHDRAWN` | Recruiter reviews or candidate withdraws | Candidate email must not already have an active application for the same opening. |
| `UNDER_REVIEW` | `SHORTLISTED`, `REJECTED`, `WITHDRAWN` | Recruiter moves candidate | Must attach reviewer note or tag. |
| `SHORTLISTED` | `INTERVIEW_SCHEDULED`, `REJECTED` | Interview coordinator schedules round | Requires interviewer assignment, date, time slot, and meeting link. |
| `INTERVIEW_SCHEDULED` | `INTERVIEWED`, `RESCHEDULED`, `CANCELLED` | Interview conducted or rescheduled | Reschedule must preserve previous schedule in historical array. |
| `INTERVIEWED` | `SELECTED`, `REJECTED`, `INTERVIEW_SCHEDULED` (Round 2) | Interviewer submits scorecard | Scorecard must include rubric scores and recommendation (`STRONG_YES`, etc.). |
| `SELECTED` | `OFFER_DRAFT` | HR generates offer | Requires approved stipend amount and start/end dates. |
| `OFFER_SENT` | `OFFER_ACCEPTED`, `OFFER_DECLINED`, `OFFER_EXPIRED` | Candidate clicks accept or expiry cron fires | Expiry check enforces `validUntil` timestamp. |
| `OFFER_ACCEPTED` | `PRE_ONBOARDING` | **Atomic Transaction** | Automatically generates `User`, `Intern`, and `OnboardingPlan`. Rolls back completely if any step fails. |
| `PRE_ONBOARDING` | `ONBOARDING` | Intern logs in first time | Validates account credentials and initial password change. |
| `ONBOARDING` | `ACTIVE` | HR approves compliance docs | Mandatory documents (ID, Agreement, NDA) must have status `APPROVED`. |
| `ACTIVE` | `EXIT_INITIATED`, `EXTENDED` | Normal completion date or resignation | Can record daily attendance, tasks, journals, and receive monthly stipend. |
| `EXIT_INITIATED` | `OFFBOARDING` | HR initiates exit review | Locks account from accepting new tasks or future attendance check-in. |
| `OFFBOARDING` | `ASSET_CLEARANCE` | Manager reviews pending deliverables | Assets must be marked `RETURNED` or `WAIVED`. |
| `ASSET_CLEARANCE` | `FINANCE_SETTLEMENT` | IT/Admin confirms asset handover | Finance calculates final earned vs paid stipend + deductions. |
| `FINANCE_SETTLEMENT` | `COMPLETED`, `TERMINATED` | Finance Admin authorizes payout | Produces formal final settlement statement document. |
| `COMPLETED` | `CERTIFICATE_ELIGIBLE` | Automated rules engine | Validates attendance ≥ threshold, tasks completed, final review finalized. |
| `CERTIFICATE_ELIGIBLE` | `ALUMNI` | Certificate generated & issued | Freezes operational account; grants permanent alumni portal read access. |

---

## 3. Concurrency, Rollback & Idempotency Rules

1. **Atomic Offer Acceptance:**
   ```javascript
   // Uses Mongoose session across Offer, Application, User, Intern, and OnboardingPlan
   const session = await mongoose.startSession();
   session.startTransaction();
   // 1. offer.status = 'ACCEPTED' (optimistic lock on status !== 'ACCEPTED')
   // 2. application.status = 'OFFER_ACCEPTED'
   // 3. User.create()
   // 4. Intern.create()
   // 5. OnboardingPlan.create()
   // If any fails: session.abortTransaction()
   ```
2. **Double-Click Protection:** Endpoints accept `Idempotency-Key` header. Repeated requests within 60 seconds return cached outcome without re-executing transactions.
3. **Immutable History:** Transitions push to `timeline` sub-documents (`stage`, `actorId`, `note`, `timestamp`). No status transition may ever overwrite prior history.
