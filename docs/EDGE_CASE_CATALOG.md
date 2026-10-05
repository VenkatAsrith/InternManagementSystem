# Enterprise Edge Case Catalog & Handling Rules

**System:** TechMecha Torque Intern Management System (TMT-IMS)  
**Objective:** Zero silent failures, zero corrupted records, and explicit handling of non-happy paths.

---

## 1. Recruitment & Applicant Edge Cases

### 1.1 Duplicate Application for Same Opening
* **Scenario:** Candidate submits a second application for the exact same opening using the same email address.
* **System Action:**
  1. Check compound uniqueness index `{ organizationId, openingId, email }`.
  2. Reject submission with HTTP 409 Conflict: `"You have already submitted an active application for this opening."`
  3. Provide direct deep-link to candidate status tracking page (`/application/status?id=APP-...`).

### 1.2 Multi-Opening Application by Single Candidate
* **Scenario:** A candidate applies for both "Full-Stack Intern" and "Data Science Intern".
* **System Action:**
  1. Maintain **1 Person** record matching `email`.
  2. Link **2 distinct Application** documents, each with its own `applicationId` and independent stage pipeline.
  3. Candidate dashboard displays both applications concurrently.

### 1.3 Candidate Withdraws Application
* **Scenario:** Candidate accepts another company's offer and withdraws.
* **System Action:**
  1. Transition application stage to `WITHDRAWN`.
  2. Prompt for optional withdrawal reason.
  3. Cancel any scheduled interviews automatically and notify panelists.
  4. Prevent recruiter from accidentally advancing withdrawn applications.

### 1.4 Interview Rescheduling & Panelist Reassignment
* **Scenario:** Panelist becomes unavailable 2 hours before technical round.
* **System Action:**
  1. Allow HR/Coordinator to reassign panelist without deleting existing feedback rubrics.
  2. When rescheduled, push old `{ scheduledDate, startTime, meetingLink, reason }` into `rescheduleHistory` array.
  3. Retain complete audit trail of time modifications.

---

## 2. Offer & Onboarding Edge Cases

### 2.1 Concurrent Acceptance Across Devices (Race Condition)
* **Scenario:** Candidate clicks "Accept Offer" on mobile and desktop at the exact same millisecond.
* **System Action:**
  1. Execute update query with optimistic status filter:
     `Offer.findOneAndUpdate({ _id: offerId, status: { $ne: 'ACCEPTED' } }, { $set: { status: 'ACCEPTED' } })`
  2. The first request acquires the update and triggers intern provisioning.
  3. The second request matches 0 documents and safely returns HTTP 400: `"This offer has already been accepted."`

### 2.2 Offer Expiry
* **Scenario:** Candidate fails to accept before `expiryDate` (e.g. 7 days after issue).
* **System Action:**
  1. Scheduled cron job checks offers where `status === 'SENT'` and `expiryDate < now`.
  2. Transition offer status to `EXPIRED` and application to `OFFER_EXPIRED`.
  3. Notify candidate and HR recruiter. Acceptance link is deactivated.

### 2.3 Post-Offer Rejection / Revocation by HR
* **Scenario:** Background check fails after offer has been dispatched.
* **System Action:**
  1. Requires elevated role (`HR_ADMIN` or `ORGANIZATION_ADMIN`).
  2. Requires mandatory revocation justification note.
  3. Offer status set to `REVOKED`. Record immutable audit event.

---

## 3. Attendance, Leave & Operations Edge Cases

### 3.1 Attendance vs Leave Conflict
* **Scenario:** Intern attempts to check-in on a date where an approved full-day sick leave already exists.
* **System Action:**
  1. Check `Leave` collection for active approved leave on current date.
  2. If leave is present, check-in prompts confirmation: `"You have approved leave today. Checking in will convert your leave to Present. Proceed?"`
  3. If confirmed, leave status adjusts to `CANCELLED_WORKED` and attendance is marked `PRESENT`.

### 3.2 Late Arrival & Grace Period
* **Scenario:** Intern checks in at 10:14 AM when start time is 10:00 AM and grace period is 15 minutes.
* **System Action:**
  1. Policy-driven check: `10:14 <= 10:15` ➔ marked `PRESENT`.
  2. Check-in at 10:16 AM ➔ marked `LATE (16 mins)` with late reason prompt.

---

## 4. Exit, Offboarding & Termination Edge Cases

### 4.1 Resignation Prior to Completion Date
* **Scenario:** Intern resigns 45 days into a 90-day internship.
* **System Action:**
  1. Transition to `EXIT_INITIATED` with reason `RESIGNATION`.
  2. Record `actualEndDate` alongside original `expectedEndDate`.
  3. Eligibility engine sets certificate status to `NOT_ELIGIBLE` (unless special waiver approved by VP).
  4. Experience letter generated specifying exact 45 days tenure.

### 4.2 Termination Effective Immediately vs Future Date
* **Scenario A (Gross Misconduct):** Effective immediately ➔ User account `isActive = false`, active refresh tokens revoked in DB, access to Slack/GitHub flagged for revocation.
* **Scenario B (Standard Notice Period):** Last working day set 14 days in future ➔ Access remains active until 11:59 PM of last working day, then automated cron locks account.

### 4.3 Unreturned Hardware Assets at Exit
* **Scenario:** Intern departs without returning company laptop.
* **System Action:**
  1. Exit state remains locked at `OFFBOARDING_INCOMPLETE`.
  2. Final financial settlement and Relieving Letter are withheld.
  3. Authorized admin can explicitly mark asset `DAMAGED` or `DEDUCTED_FROM_STIPEND` to unblock settlement.

### 4.4 Certificate Revocation Post-Issuance
* **Scenario:** Academic plagiarism discovered in intern's code repository 6 months after graduation.
* **System Action:**
  1. Admin executes `POST /api/v1/certificates/:id/revoke` with revocation reason.
  2. Certificate record marked `status: 'REVOKED'`.
  3. Public verification endpoint `/verify/certificate/:id` displays clear warning badge: `"REVOKED: This certificate was rescinded on [Date] due to [Reason]."`
