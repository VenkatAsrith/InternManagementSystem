# Security Audit & Gap Matrix

**System:** TechMecha Torque Intern Management System (TMT-IMS)  
**Security Baseline:** OWASP Top 10 + Enterprise HR-Tech Compliance  
**Date:** September 2026

---

## 1. Vulnerability & Risk Assessment Matrix

| Threat Category | Existing Mechanism | Risk Identified | Risk Level | Remediation Plan |
|---|---|---|---|---|
| **Token Storage & Session Hijacking** | Single JWT stored in browser `localStorage`. Expiry up to 7 days. | If XSS occurs, long-lived token can be stolen. No server-side session revocation. | 🔴 **HIGH** | Switch to short-lived access tokens (15m) + HttpOnly, Secure, SameSite refresh tokens stored in `sessions` collection with IP/User-Agent hashing. |
| **Cross-Tenant Data Exposure** | `organizationId` attached to `req.user`. Controllers manually filter by `req.organizationId`. | If any controller endpoint forgets `organizationId` in a query, data can leak across organizations. | 🔴 **HIGH** | Implement Mongoose query middleware plugin that automatically enforces tenant scoping on all queries unless explicitly bypassed by Super Admin. |
| **Rate Limiting Granularity** | Single global rate limiter (`100 req / 15 min`) in `rateLimiter.js`. | Brute force login, OTP spam, or certificate enumeration attacks are not specifically throttled. | 🟡 **MEDIUM** | Implement tier-specific limiters: `authLimiter` (5 req / min), `publicSubmitLimiter` (10 req / hour), `apiLimiter` (120 req / min). |
| **File Upload Safety & Storage** | Multer memory buffer written to disk via `LocalStorageService`. Basic path traversal check. | MIME type is taken from browser header without magic number / file signature verification. Files stored permanently in local folder. | 🔴 **HIGH** | Implement file signature validation (magic bytes), file extension whitelist, and temporary upload staging with automatic TTL cleanup and Cloudinary streaming. |
| **Private Document Accessibility** | Document paths saved as relative paths on server. | If uploads directory is served statically without authentication, private resumes and ID cards become guessable. | 🔴 **HIGH** | Disallow public static serving of upload folders. Require authenticated stream endpoint `/api/v1/documents/:id/download` with RBAC and download audit logging. |
| **NoSQL Injection & Sanitization** | Express parses JSON without recursive `$`/`.` sanitization. | Malicious payloads with `{"$ne": null}` could bypass authentication or filters. | 🟡 **MEDIUM** | Introduce Mongo sanitization middleware (`express-mongo-sanitize` equivalent) to strip `$` and `.` operators from `req.body`, `req.query`, and `req.params`. |
| **Audit Correlation & Traceability** | `AuditLog` captures actor and before/after diff. | `requestId` is missing from `AuditLog`, hindering forensic tracing across web server logs and database entries. | 🟢 **LOW** | Add `requestId` to `AuditLog` schema and winston log context. |

---

## 2. Hardening Action Plan

1. **Authentication:**
   - Add `/api/v1/auth/refresh` endpoint using HttpOnly cookie refresh token.
   - Add `/api/v1/auth/revoke-all` to terminate all active sessions upon password reset or intern exit.
2. **Access Control:**
   - Enforce server-side permissions for every route.
   - Never trust frontend-supplied `role` or `organizationId`.
3. **Private Document Shield:**
   - All document downloads (resumes, ID cards, offer letters, NDAs) must pass through authorization guards.
   - Log every download in `audit_logs` with actor ID, document ID, IP address, and timestamp.
4. **Input & Schema Validation:**
   - Apply strict Zod schemas on all write endpoints (`POST`, `PUT`, `PATCH`).
