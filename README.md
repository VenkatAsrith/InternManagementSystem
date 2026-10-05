# 🎓 Industry-Grade Intern Management System (IMS)

A production-grade, enterprise-ready **Intern Management System** built with a pure **MERN stack** (MongoDB + Express + React 18 + Node.js) using a clean **Modular Monolith** architecture.

Designed for end-to-end lifecycle continuity:
```
APPLICATION ➔ ATS SCREENING ➔ INTERVIEWS ➔ OFFER ISSUANCE ➔ ATOMIC ONBOARDING ➔ 
WORKSPACE ➔ TASKS & DELIVERABLES ➔ ATTENDANCE & CHECK-IN ➔ JOURNALS ➔ 
PERFORMANCE EVALUATION ➔ PDF CERTIFICATES & LOR ➔ ALUMNI NETWORK
```

---

## ⚡ Tech Stack

| Layer | Technology |
|---|---|
| **Database** | MongoDB 6.0+ with Mongoose ODM (24 collections, multi-tenant indexes, atomic transitions) |
| **Backend** | Node.js 20+, Express.js, Helmet, Morgan, Winston, Rate Limiting, JWT Auth, PDFKit |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Recharts |
| **Storage** | Abstracted File Provider with local filesystem adapter & path traversal protection |
| **DevOps** | Docker, Docker Compose, Nginx reverse proxy |

---

## 🚀 Quick Start (Local Server)

### Prerequisites
- Node.js >= 18.x
- MongoDB >= 6.x (running locally on `mongodb://127.0.0.1:27017`)

### 1. Installation
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd server && npm install

# Install frontend dependencies
cd ../client && npm install
cd ..
```

### 2. Seed Realistic Demo Data
The seed script provisions 1 realistic enterprise organization (`TechMecha Torque`), 4 departments, 8 role accounts, 10 realistic interns across all lifecycle states, 30+ tasks, LMS learning paths, historical attendance records, daily journals, performance reviews, and verified certificates.

```bash
cd server
node src/database/seed.js
```

### 3. Run Development Servers
Open two terminal windows:

**Terminal 1 (Backend API):**
```bash
cd server
npm run dev
# Server running at http://localhost:5000
# Health check: http://localhost:5000/health
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Client running at http://localhost:3000
```

---

## 🔑 Demo Accounts (Pre-configured)

All accounts share the password: `Password2026!`

| Role | Email | Capabilities |
|---|---|---|
| **Super Admin** | `admin@techmecha.com` | Cross-organization access, audit logs, system settings |
| **HR Admin** | `hr@techmecha.com` | ATS recruitment pipeline, offers, onboarding, certificates, live analytics |
| **Mentor** | `elena.rostova@techmecha.com` | Task assignment, code review, journal feedback, intern appraisals |
| **Active Intern** | `arjun.sharma@example.com` | Tasks Kanban, daily attendance check-in, engineering journal, LMS courses |
| **Onboarding Intern** | `priya.patel@example.com` | Onboarding document submission checklist |
| **Completed Intern** | `kartik.iyer@example.com` | Verified certificate download & Letter of Recommendation |

> 💡 **Quick Login:** The `/login` page features 1-click demo login buttons for each key role.

---

## 🐳 Docker Deployment

To launch the complete multi-container stack (MongoDB, Node.js API, Nginx React SPA) with a single command:

```bash
docker-compose up -d --build
```

Access services:
- **Frontend Application:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000/api/v1`
- **Health Check:** `http://localhost:5000/health`

---

## 🧪 Automated Testing & Verification

### Run Automated Integration Tests (Jest & Supertest)
```bash
cd server
npm test
```
*Tests 8 comprehensive API endpoints including RBAC boundaries, public verification, and MongoDB aggregation analytics.*

### Run Complete 14-Stage E2E Lifecycle Simulation
```bash
node scripts/e2e_verify.js
```
*Programmatically executes the entire lifecycle: public application submission ➔ HR screening ➔ interview scheduling ➔ offer generation ➔ atomic offer acceptance & intern provisioning ➔ intern login ➔ attendance check-in ➔ journal submission ➔ certificate verification ➔ live analytics aggregations.*

---

## 📂 Project Structure

```
InternManagementSystem/
├── client/                     # React 18 SPA (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Common UI, layouts, modals, navbar, sidebar
│   │   ├── context/            # AuthContext & global state
│   │   ├── pages/              # Public, Admin/HR, Mentor, Intern pages
│   │   └── services/           # Axios HTTP client with auto-JWT interceptors
│   ├── Dockerfile
│   └── nginx.conf
├── server/                     # Express.js Modular Monolith
│   ├── src/
│   │   ├── database/           # Connection & comprehensive realistic seed script
│   │   ├── middleware/         # Auth, RBAC, tenant extractor, audit logger, file upload
│   │   ├── modules/            # 21 self-contained domain modules
│   │   ├── utils/              # IdGenerator, StorageService, PDFGenerator, Response
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/                  # Jest & Supertest integration suite
│   └── Dockerfile
├── shared/                     # Cross-tier ES module constants & enums
├── docs/                       # Architecture, Lifecycle & API specifications
├── scripts/                    # End-to-end verification and utility scripts
├── docker-compose.yml          # Multi-container orchestration
└── README.md
```

---

## 🛡️ Key Features Implemented

1. **Strict Multi-Tenancy:** All queries and documents are scoped by `organizationId`.
2. **Atomic Offer Acceptance:** Single transaction updates offer state, creates user account, generates intern record, and initializes the onboarding plan.
3. **Real Calculations & Aggregations:** Zero hardcoded analytics; uses MongoDB `$match`, `$group`, and `$avg` aggregation pipelines.
4. **Interactive Attendance:** One-click check-in with automatic late calculation.
5. **Tamper-Proof Certificate Verification:** Public lookup at `/verify/certificate/:id` with real-time verification and PDF downloads.
6. **Immutable Audit Trail:** Comprehensive tracking of all write actions, actors, and IP addresses.
