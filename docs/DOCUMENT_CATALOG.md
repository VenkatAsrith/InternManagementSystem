# Document Catalog & Template Engine Specification

**System:** TechMecha Torque Intern Management System (TMT-IMS)  
**External Reference:** [TMT-Letters Repository](https://github.com/VenkatAsrith/TMT-Letters.git)  
**Engine:** Dynamic Handlebars-style variable interpolation + PDFKit Vector Rendering + Web Preview

---

## 1. Enterprise Document Types Catalog (26 Documents)

| ID | Document Type | Lifecycle Trigger | Recipient | Approval Required | Retention |
|---|---|---|---|:---:|---|
| **DOC-01** | `APPLICATION_CONFIRMATION` | Application Submitted | Candidate | No | 3 Years |
| **DOC-02** | `INTERVIEW_INVITATION` | Interview Scheduled | Candidate | No | 3 Years |
| **DOC-03** | `INTERVIEW_RESULT` | Scorecard Finalized | Candidate | Yes (HR) | 3 Years |
| **DOC-04** | `SELECTION_LETTER` | Candidate Selected | Candidate | Yes (HR) | 5 Years |
| **DOC-05** | `OFFER_LETTER` | Offer Generated | Candidate | Yes (Org Admin) | Permanent |
| **DOC-06** | `INTERNSHIP_AGREEMENT` | Offer Accepted | Intern | Yes (HR / Legal) | Permanent |
| **DOC-07** | `NDA_AGREEMENT` | Pre-Onboarding | Intern | Yes (Legal) | Permanent |
| **DOC-08** | `JOINING_LETTER` | First Day Check-In | Intern | No | Permanent |
| **DOC-09** | `WELCOME_LETTER` | Orientation Completed | Intern | No | 2 Years |
| **DOC-10** | `VERIFICATION_LETTER` | College/Visa Verification | Institution | Yes (HR) | 5 Years |
| **DOC-11** | `INTERN_ID_LETTER` | Physical ID Card Issuance | Intern | No | 2 Years |
| **DOC-12** | `PERFORMANCE_REVIEW` | Review Cycle Finalized | Intern | Yes (Mentor + HR)| Permanent |
| **DOC-13** | `WARNING_LETTER` | Policy Violation / Attendance | Intern | Yes (HR Admin) | Permanent |
| **DOC-14** | `EXTENSION_LETTER` | Cohort Extension Approved | Intern | Yes (HR Admin) | Permanent |
| **DOC-15** | `STIPEND_LETTER` | Compensation Revision | Intern | Yes (Finance) | Permanent |
| **DOC-16** | `PAYMENT_STATEMENT` | Monthly Stipend Disbursed | Intern | Yes (Finance) | 7 Years |
| **DOC-17** | `COMPLETION_LETTER` | Final Day Requirements Met | Intern | Yes (HR Admin) | Permanent |
| **DOC-18** | `EXPERIENCE_LETTER` | Internship Completed | Alumni | Yes (HR Admin) | Permanent |
| **DOC-19** | `CERTIFICATE` | Completion Verified | Alumni | Yes (VP / Signatory)| Permanent |
| **DOC-20** | `RECOMMENDATION_LETTER` (LOR)| High Performer (Score ≥4.5)| Alumni | Yes (Mentor + VP)| Permanent |
| **DOC-21** | `EXIT_LETTER` | Exit Initiated | Intern | Yes (HR Admin) | Permanent |
| **DOC-22** | `RESIGNATION_ACCEPTANCE` | Early Resignation Approved | Intern | Yes (HR Admin) | Permanent |
| **DOC-23** | `TERMINATION_LETTER` | Contract Terminated | Intern | Yes (Org Admin) | Permanent |
| **DOC-24** | `RELIEVING_LETTER` | Clearance Handover Complete| Alumni | Yes (HR Admin) | Permanent |
| **DOC-25** | `FINAL_SETTLEMENT_STATEMENT`| Financial Dues Cleared | Alumni | Yes (Finance) | 7 Years |
| **DOC-26** | `ASSET_HANDOVER_RECEIPT` | Laptops / Access Returned | IT / Intern | Yes (IT Admin) | 5 Years |

---

## 2. Dynamic Variable Dictionary

Templates use double curly brace variables `{{variable.path}}`:

```json
{
  "candidate": {
    "name": "Full Name",
    "email": "candidate@example.com",
    "phone": "+1 555-0199",
    "college": "Indian Institute of Technology",
    "degree": "B.Tech Computer Science"
  },
  "intern": {
    "internId": "INT-2026-000042",
    "role": "Full-Stack Engineering Intern",
    "department": "Software Engineering",
    "startDate": "2026-10-01",
    "endDate": "2026-12-31",
    "duration": "90 Days",
    "workMode": "Hybrid",
    "mentorName": "Elena Rostova",
    "mentorEmail": "elena.rostova@techmecha.com"
  },
  "stipend": {
    "grossAmount": "₹35,000",
    "netPayable": "₹34,500",
    "currency": "INR",
    "paymentFrequency": "Monthly",
    "paymentReference": "TMT-PAY-2026-000492"
  },
  "organization": {
    "name": "TechMecha Torque",
    "code": "TMT",
    "address": "450 Innovation Parkway, Suite 800, San Jose, CA",
    "signatoryName": "Dr. Evelyn Reed",
    "signatoryTitle": "VP of Engineering & Talent",
    "website": "https://techmecha.com"
  },
  "document": {
    "documentNumber": "DOC-2026-000108",
    "issueDate": "2026-09-13",
    "verificationUrl": "https://techmecha.com/verify/certificate/CERT-2026-000042"
  }
}
```

---

## 3. Template Versioning & Immutable Generation Architecture

```text
[ DocumentTemplate Model ]
   ├── templateCode: "OFFER_LETTER"
   ├── version: 3
   ├── bodyMarkdown / HTML: "..."
   └── approvedBy: userId
          │
          ▼ (Trigger: Generate Offer)
[ Generation Engine ]
   ├── Injects dynamic variables
   ├── Computes SHA-256 contentHash
   ├── Renders PDF via PDFKit / Headless Renderer
   └── Stored in [ GeneratedDocument Model ]
          ├── documentNumber: "DOC-2026-000054"
          ├── templateId: template._id
          ├── templateVersion: 3
          ├── contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
          └── storageUrl: "https://res.cloudinary.com/... or /uploads/..."
```

**Golden Rule:** If `OFFER_LETTER` template is updated to Version 4 tomorrow, historical offers generated with Version 3 **never change**. The document record is immutable.
