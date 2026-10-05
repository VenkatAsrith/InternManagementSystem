# Architecture Audit: Modular Monolith Assessment

**System:** TechMecha Torque Intern Management System (TMT-IMS)  
**Date:** September 2026  
**Document Type:** Deep System Architectural Review

---

## 1. Architectural Style & Boundaries

The IMS is structured as an Express.js **Modular Monolith**:
```text
client/                         (React 18 SPA - Vite, Tailwind, TanStack Query)
server/
  ├── src/
  │   ├── app.js               (Express pipeline, middleware, routing)
  │   ├── server.js            (Server entry point, port listener)
  │   ├── config/              (Env validation, winston logger)
  │   ├── database/            (Mongoose connection, seed orchestrator)
  │   ├── middleware/          (Auth, RBAC, tenant isolation, rate limit, audit)
  │   ├── modules/             (21 domain folders)
  │   │   ├── [domain]/        (*.model.js, *.controller.js, *.routes.js, *.service.js)
  │   └── utils/               (Response formatter, ID generator, storage, PDFKit)
  └── tests/                   (Jest & Supertest integration specs)
shared/                        (Constants, RBAC permissions, lifecycle enums)
```

### Strengths:
1. **Domain Cohesion:** Each folder in `modules/` encapsulates its model, controller, and routes.
2. **Atomic Sequential IDs:** Centralized `counters` collection ensures collision-free sequential IDs (`APP-*`, `INTV-*`, `OFFER-*`, `INT-*`, `CERT-*`) without race conditions.
3. **Transaction Safety:** The offer acceptance flow uses `mongoose.startSession()` and replica-set transaction detection (`canUseTransactions()`) with standalone fallback.

### Architectural Deficiencies:
1. **Controller-Heavy Business Logic:** Controllers directly manipulate Mongoose models, construct audit logs, and trigger side effects rather than delegating to an Application Service layer.
2. **Synchronous Processing in HTTP Request Paths:** Heavy operations like PDF generation with PDFKit run synchronously inside the request-response thread, posing denial-of-service risks under concurrent load.
3. **Absence of Domain Event Bus:** Side effects (e.g. `OfferAccepted` triggering `createIntern`, `createOnboardingPlan`, `sendWelcomeEmail`) are chained imperatively rather than emitted via an in-memory or message broker event emitter.

---

## 2. Multi-Tenancy & Data Isolation Review

### Current Tenancy Model:
- **Tenant Key:** `organizationId` (ObjectId referencing `Organization`).
- **Scoping Rule:** All domain queries enforce `{ organizationId: req.organizationId }`.
- **Super Admin Exception:** `SUPER_ADMIN` users bypass tenant filters to support platform-wide operations.

### Vulnerabilities & Risks:
1. **Ad-Hoc Query Scoping:** Tenant scoping relies on individual controller queries explicitly passing `organizationId`. If a developer writes `Intern.findById(req.params.id)` without checking `organizationId`, cross-tenant data leakage occurs.
2. **Missing Mongoose Pre-Query Plugin:** There is no global Mongoose plugin automatically enforcing `find`, `findOne`, `findOneAndUpdate`, and `countDocuments` tenant filtering at the ORM layer.
3. **Public Endpoint Exposure:** Public career and certificate verification endpoints correctly omit tenant scope for candidates, but must guard against ID enumeration attacks.

---

## 3. Storage & Document Architecture

### Current Implementation:
```text
Browser Form Submit ──► Multer MemoryStorage / Disk ──► LocalStorageService (uploads/)
```
- Files are saved to disk with `uuidv4() + ext`.
- Prefix verification prevents basic directory traversal (`path.normalize`).

### Architecture Target:
```text
Client Upload 
   └──► Temp Staging (/tmp or /uploads/temp)
          ├── 1. Magic byte / MIME validation
          ├── 2. Antivirus / file sanity check
          ├── 3. Size & ownership checks
          └──► StorageProvider Abstraction
                 ├── LocalStorageProvider (Development / Testing)
                 └── CloudinaryStorageProvider / S3 (Production)
```
- Temporary files must have TTL-based automatic expiration and cleanup.
- Private documents (resumes, NDAs, identity cards) must require signed URLs or authenticated proxy downloads, never direct public file serving.

---

## 4. Observability & Request Correlation

### Strengths:
- **Request ID Injection:** `app.use((req, res, next) => ...)` attaches `x-request-id` to every request and response header.
- **Append-Only Audit Trail:** `AuditLog` captures actor ID, role, action, entity type, entity ID, before/after snapshots, client IP, and user-agent.

### Missing Observability:
1. `requestId` is not consistently attached to Winston logger entries in child execution contexts.
2. Audit logs do not capture `requestId`, making it impossible to correlate an audit record with an exact HTTP request trace.
3. No readiness probes checking SMTP or storage availability (`/ready` only checks MongoDB).

---

## 5. Scalability & Deployment Readiness

- **Containerization:** Dockerfile and Docker Compose exist.
- **Statelessness:** The API server is stateless regarding session memory (JWT tokens), allowing horizontal scaling behind an Nginx reverse proxy.
- **Background Jobs Bottleneck:** Because all processing happens within Express event loops, long-running tasks (bulk candidate email dispatch, certificate generation for 100+ interns) will block HTTP throughput until an asynchronous job queue is introduced.
