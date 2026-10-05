# Internship Lifecycle Specification: Intern Management System (IMS)

The system enforces strict end-to-end continuity across 15 distinct stages:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 1. PUBLIC   │ ──► │ 2. ATS      │ ──► │ 3. TECH     │ ──► │ 4. OFFER    │
│ APPLICATION │     │ SCREENING   │     │ INTERVIEW   │     │ ISSUANCE    │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                   │
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 8. JOURNALS │ ◄── │ 7.ATTENDANCE│ ◄── │ 6. ONBOARD  │ ◄── │ 5. OFFER    │
│ & 1-ON-1s   │     │ CHECK-IN    │     │ CHECKLIST   │     │ ACCEPTANCE  │
└──────┬──────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 9. TASKS &  │ ──► │ 10. LMS     │ ──► │ 11. REVIEWS │ ──► │ 12. CERTS   │
│ SUBMISSIONS │     │ LEARNING    │     │ & FEEDBACK  │     │ & ALUMNI    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Lifecycle Stages Breakdown

### 1. Public Sourcing & Application (`APPLIED`)
- Candidate discovers openings on `/internships`.
- Multi-step wizard collects personal details, academic background, resume file, links, and statement of purpose.
- Atomic ID `APP-YYYY-XXXXXX` generated.
- Candidates can track their progress anytime on `/track`.

### 2. ATS Candidate Screening (`UNDER_REVIEW`, `SHORTLISTED`)
- HR and Recruiters review incoming applications in the Kanban or List view.
- Stage changes, internal notes, and candidate tags recorded with actor audit trails.

### 3. Interview Scheduling & Scoring (`INTERVIEW_SCHEDULED`, `INTERVIEWED`)
- Rounds scheduled (Technical, Managerial, HR) with calendar dates, time slots, and Google Meet/Zoom links.
- Interviewers enter rubrics, strengths, weaknesses, and recommendations (`STRONG_HIRE`, `HIRE`, `NO_HIRE`).

### 4. Selection & Offer Issuance (`SELECTED`, `OFFER_SENT`)
- Formal offer generated with stipend amount, start/end dates, working mode (Remote/Hybrid/On-site), and legal terms.
- Offer code `OFFER-YYYY-XXXXXX` assigned.

### 5. Atomic Offer Acceptance & Provisioning (`OFFER_ACCEPTED`)
- Candidate accepts offer via portal.
- **Atomic MongoDB Transaction** executes:
  1. Updates Offer status to `ACCEPTED`.
  2. Updates Application stage to `OFFER_ACCEPTED`.
  3. Provisions `User` account with role `INTERN`.
  4. Generates `Intern` record with ID `INT-YYYY-XXXXXX`.
  5. Generates `OnboardingPlan` with 10 default checklist tasks.

### 6. Onboarding & Compliance (`ONBOARDING`)
- Intern submits government ID proof, university bona fide, and signs NDA and internship agreement.
- HR reviews uploaded documents and marks checklist items approved.

### 7. Internship Workspace & Attendance (`ACTIVE`)
- Daily check-in / check-out with automatic late calculation (e.g. check-ins after 10:15 AM marked `LATE`).
- IP address, timestamp, and work mode captured.

### 8. Engineering Journals & 1-on-1s
- Interns submit daily reflections detailing work completed, key learnings, challenges, and plan for tomorrow.
- Mentors review and add feedback comments.

### 9. Tasks & Deliverables Pipeline
- Mentors assign Kanban tasks with priorities, estimated hours, and due dates.
- Interns submit deliverables with git repository links and pull request links.
- Mentors review, approve, or request revisions.

### 10. LMS Learning Paths
- Interns progress through structured curriculum modules, chapters, and lessons.
- Progress calculated in real-time.

### 11. Performance Evaluation
- Mid-term and final performance reviews with 5-point rating scales across Technical Competency, Delivery, Communication, and Initiative.
- Weighted score calculated.

### 12. Completion, Certificate Generation & Alumni (`COMPLETED`, `ALUMNI`)
- Automated readiness engine validates:
  1. Minimum required tasks completed.
  2. Minimum attendance percentage achieved (e.g., ≥85%).
  3. Final review finalized.
- PDF landscape Certificate of Completion and formal Letter of Recommendation (LOR) rendered.
- QR code and unique verification code `CERT-YYYY-XXXXXX` allow public validation on `/verify/certificate/:id`.
