# API Reference: Intern Management System (IMS)

Base URL: `http://localhost:5000/api/v1`

---

## 1. Authentication & Identity
- `POST /auth/login`: Authenticate with email & password. Returns JWT access token & user profile.
- `GET /auth/me`: Get current authenticated user profile.
- `POST /auth/refresh`: Refresh expired JWT access token.
- `POST /auth/logout`: Invalidate session.

## 2. Recruitment & ATS
- `GET /recruitment/openings/public`: List active public internship openings.
- `GET /recruitment/openings/public/:slug`: View opening details.
- `POST /recruitment/applications/public`: Submit application with resume upload.
- `GET /recruitment/applications/public/status/:id`: Public application tracker.
- `GET /recruitment/applications`: HR list & filter all applications.
- `PATCH /recruitment/applications/:id/stage`: Advance candidate stage.
- `POST /recruitment/applications/:id/notes`: Add internal recruiter notes.

## 3. Interviews
- `GET /interviews`: List scheduled and completed interviews.
- `POST /interviews`: Schedule technical / managerial interview.
- `GET /interviews/:id`: View interview details and candidate scorecards.
- `POST /interviews/:id/scorecard`: Submit interviewer feedback and recommendation.

## 4. Offers & Onboarding
- `GET /offers`: List generated offers.
- `POST /offers`: Generate formal internship offer letter.
- `POST /offers/:id/accept`: Accept offer (triggers atomic intern creation & onboarding sequence).
- `GET /onboarding/plans`: List onboarding plans.
- `PATCH /onboarding/tasks/:taskId`: Update checklist task status (upload document / review).

## 5. Interns Directory
- `GET /interns`: Directory of all interns across lifecycle states.
- `GET /interns/:id`: Comprehensive intern dossier (mentor, tasks, attendance, reviews, documents).
- `GET /interns/me`: Active intern profile for the logged-in intern.

## 6. Tasks & Projects
- `GET /tasks`: Query tasks (auto-scoped to assigned intern if intern role).
- `POST /tasks`: Create project milestone task.
- `POST /tasks/:id/submit`: Intern submits task deliverables with repo/PR links.
- `POST /tasks/:id/review`: Mentor approves or requests revisions on submission.

## 7. Attendance & Check-in
- `POST /attendance/check-in`: Record daily arrival (auto-calculates late status).
- `POST /attendance/check-out`: Record daily departure.
- `GET /attendance/today`: Today's attendance state.
- `GET /attendance/my-history`: Intern's historical calendar attendance records.

## 8. Daily Journals
- `POST /journals`: Intern submits daily reflection and hours worked.
- `GET /journals`: Query journal entries.
- `POST /journals/:id/feedback`: Mentor comments and provides feedback.

## 9. Learning Management (LMS)
- `GET /learning/paths`: List curated learning curricula.
- `GET /learning/modules/:id`: View module lessons and resources.
- `POST /learning/progress`: Record lesson completion.

## 10. Performance Reviews
- `GET /performance`: List evaluations.
- `POST /performance`: Create performance review.
- `PATCH /performance/:id/finalize`: Finalize ratings and recommendations.

## 11. Certificates & Letters
- `GET /certificates/verify/:certificateId`: **Public** tamper-proof certificate verification.
- `GET /certificates/readiness/:internId`: Validate completion criteria.
- `POST /certificates/complete/:internId`: Mark internship completed and generate PDF certificate and LOR.
- `GET /certificates/:id/download`: Download high-resolution landscape certificate PDF.

## 12. Analytics & Reporting
- `GET /analytics/dashboard`: Real MongoDB aggregation pipeline metrics (recruitment funnel, task completion %, attendance rate %, active interns).

## 13. Audit Logging
- `GET /audit`: Immutable audit trail of system events, actors, IPs, and entity diffs.
