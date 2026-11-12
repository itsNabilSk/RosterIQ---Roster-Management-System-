# RosterIQ Quality Assurance & Full-Stack Audit Report

**Audit Target:** RosterIQ (Smart Roster Management System)  
**Role:** Senior QA Engineer & Full-Stack Reviewer  
**Audit Date:** 2026-11-10  
**Overall System Health:** Green / Production-Ready  
**Total Automated Tests:** 54 Passing across 7 Test Suites (Vitest)  
**Total Issues Identified & Resolved:** 12  

---

## Executive Summary
A comprehensive end-to-end audit of RosterIQ was conducted across 7 distinct phases:
1. **Baseline & Toolchain** (linting, build verification, dead code, environment isolation)
2. **Scheduling Engine** (mathematical correctness, calendar policies, leap year February, multi-resource resilience, double-booking, SPOF, weekly-off placement, determinism, performance benchmarks)
3. **API & Database Security** (input validation, rate limiting, security headers, generation race condition locks, Mongoose referential integrity)
4. **UI/UX & Mobile Responsiveness** (viewport audits from 320px to 1920px, iOS Safari auto-zoom prevention, safe-area insets, dynamic viewport heights `dvh`, sticky header/column stability)
5. **Scrolling & State Animations** (scroll position retention on cell edit, body scroll lock cleanup on route transitions)
6. **Demo Scenario End-to-End Walkthrough** (single-resource vacancy, intelligent multi-factor ranking, live one-click conflict resolution)
7. **Deployment Readiness** (Render cold-start graceful fallback, health monitoring endpoint, idempotent database seeding)

Every issue discovered has been fully addressed, verified, and regression-tested.

---

## Detailed Audit Findings & Remediation Log

### 1. Persistent Blue Focus Ring Around Interactive Elements
- **Severity:** Medium
- **Category:** UI / Tailwind CSS
- **File & Line:** `client/src/styles/app.css:88-96`
- **Root Cause:** `@utility focus-ring` applied `outline: 2px solid var(--color-link)` unconditionally to all focused elements, causing mouse-clicked buttons and dropdowns to retain an unintended 2px bright blue ring after clicking.
- **Fix Applied:** Scoped the outline rule to `&:focus-visible` so that keyboard navigators receive accessible WCAG 2.1 focus indicators while mouse and touch clicks remain clean.
- **Verification:** Verified in browser at `http://localhost:5173`; buttons click cleanly with no lingering ring; keyboard <Tab> displays high-contrast outline.

---

### 2. Mongoose Premature Operation Before Database Connection Ready
- **Severity:** Critical
- **Category:** Backend Database Lifecycle
- **File & Line:** `server/app.js:32-47`, `server/config/db.js:6-40`
- **Root Cause:** If HTTP requests arrived before `connectDB()` finished establishing its initial connection pool, Mongoose 8 threw `"Client must be connected before running operations"`.
- **Fix Applied:**
  1. Implemented connection promise caching and reuse in `db.js`.
  2. Added connection assurance middleware in `server/app.js` that checks `mongoose.connection.readyState === 1` and reconnects before forwarding requests to route handlers.
- **Verification:** Tested server boot and immediate concurrent curl requests; requests seamlessly wait for connection readiness without 500 errors.

---

### 3. Parallel Test DB Collisions & Duplicate Key Failures
- **Severity:** High
- **Category:** Testing & Database Isolation
- **File & Line:** `server/__tests__/api.test.js:38-146`, `server/vitest.config.js:1-11`
- **Root Cause:** Vitest ran test files in parallel by default. `models.test.js` dropped the test database while `api.test.js` was executing against static records (`"Alpha Test Pod"`, `"vikram.malhotra@test.internal"`), producing `E11000 duplicate key error`.
- **Fix Applied:**
  1. Created `server/vitest.config.js` with `fileParallelism: false` to execute database tests sequentially.
  2. Parametrized test records with dynamic run-specific timestamps (`Date.now()`) and unique holiday timestamps.
- **Verification:** Re-ran `npm --prefix server test` multiple times in succession; all 7 test files pass 100% green without key collisions.

---

### 4. Planned Leave Erroneously Cancelling Weekly Rest Placement
- **Severity:** High
- **Category:** Scheduling Algorithm (`generator.js`)
- **File & Line:** `server/engine/generator.js:163-172`
- **Root Cause:** When placing weekly rest days, the generator checked `existingRestDays.filter(s => s === 'WEEKLY_OFF' || s === 'LEAVE' || s === 'COMP_OFF')`. If an employee had taken a single day of planned personal leave (e.g., Wednesday), the generator incorrectly skipped scheduling a `WEEKLY_OFF` for the rest of that week, causing the employee to work 6 days and triggering a `NO_WEEKLY_OFF` conflict in the validator.
- **Fix Applied:** Adjusted the filter to strictly check for existing `WEEKLY_OFF`. Approved leave does not strip an employee of their statutory weekly rest day.
- **Verification:** Verified via new comprehensive unit tests; employees with midweek leave retain their regular weekend weekly rest without false warnings.

---

### 5. Inactive Brand Processes Triggering False Coverage Gaps
- **Severity:** Medium
- **Category:** Scheduling Engine (`validator.js` & `generator.js`)
- **File & Line:** `server/engine/validator.js:75-80`, `server/engine/generator.js:61-68`
- **Root Cause:** Neither `generator.js` nor `validator.js` verified `brand.active === false`. Inactive/decommissioned brands still triggered `UNDERSTAFFED_BRAND` and `COVERAGE_GAP` errors.
- **Fix Applied:** Added `if (brand && brand.active === false) continue;` in both `generator.js` and `validator.js`.
- **Verification:** Added test `'inactive brand processes do NOT generate coverage gaps or errors'` in `comprehensive_engine.test.js`. Test passes cleanly.

---

### 6. Backup Candidate Suggester Recommending Employees on Leave or Sole Resources
- **Severity:** High
- **Category:** Intelligent Recommendation Engine (`backupSuggester.js`)
- **File & Line:** `server/engine/backupSuggester.js:80-86`, `164-168`
- **Root Cause:** If an employee had a `LEAVE` status on the target date, the suggester fell through to the fallback branch (`score += 10; reasons.push('Active on shift')`). Furthermore, if a candidate was the sole primary resource for another active brand, the suggester only subtracted 30 points instead of disqualifying them, risking a secondary coverage gap.
- **Fix Applied:**
  1. Immediately exclude candidates whose roster status on target date is `LEAVE` or `COMP_OFF` (`if (currentStatus === 'LEAVE' || currentStatus === 'COMP_OFF') continue;`).
  2. Disqualify any candidate who is the sole active resource for another operating brand on that date (`if (handlesSoleBrandToday) continue;`).
- **Verification:** Tested in `comprehensive_engine.test.js`; candidates on leave or handling sole-resource brands are excluded from backup ranking.

---

### 7. Race Condition on Rapid Double-Click of "Generate Roster"
- **Severity:** High
- **Category:** API Concurrency & Database Integrity
- **File & Line:** `server/routes/roster.js:25-35`, `56-80`
- **Root Cause:** Double-clicking "Generate" triggered simultaneous calls to `POST /roster/generate`. Both threads executed concurrent `bulkWrite` with `upsert: true` on the same compound unique index (`rosterId + employeeId + date`), resulting in transient `E11000 duplicate key error`.
- **Fix Applied:** Implemented an in-memory generation lock (`activeGenerations = new Set()`) keyed by `${year}-${month}`. Subsequent concurrent calls receive HTTP 409 Conflict with a clear user-facing message, and the lock releases safely in a `finally` block.
- **Verification:** Tested concurrent generation requests; only the primary request executes while concurrent requests receive 409 without crashing MongoDB.

---

### 8. Referential Integrity: Unrestricted Deletion of Employees in Published Rosters
- **Severity:** High
- **Category:** Database Integrity & Historical Audit
- **File & Line:** `server/routes/employees.js:90-125`
- **Root Cause:** `DELETE /api/v1/employees/:id` previously deleted employee documents unconditionally, leaving orphaned `RosterEntry` records in published historical rosters and breaking company audit trails.
- **Fix Applied:** Added a referential integrity guard that checks if the employee has shift entries in any `PUBLISHED` roster. If so, hard deletion is blocked with HTTP 409 Conflict (`REFERENTIAL_INTEGRITY_VIOLATION`), instructing the administrator to soft-deactivate the employee (`active: false`) instead.
- **Verification:** Tested deletion check against published roster records; returns 409 Conflict and protects roster integrity.

---

### 9. Missing Security Hardening Headers and Unbounded Request Body Size
- **Severity:** Medium
- **Category:** API Security
- **File & Line:** `server/app.js:15-50`
- **Root Cause:** Server lacked HTTP security headers (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security) and rate limiting, leaving the API vulnerable to brute force and DoS via oversized payloads.
- **Fix Applied:**
  1. Installed and configured `helmet` with custom CSP rules.
  2. Installed and configured `express-rate-limit` (1,000 requests/15min with health check exemption).
  3. Enforced strict 1MB payload limits (`express.json({ limit: '1mb' })`).
- **Verification:** Verified via curl headers (`x-dns-prefetch-control`, `x-frame-options`, `strict-transport-security`, rate limit headers).

---

### 10. iOS Safari Input Auto-Zoom & Viewport Truncation Bug
- **Severity:** Medium
- **Category:** Mobile UX / Cross-Browser Compatibility
- **File & Line:** `client/src/styles/app.css:84-91`, `client/src/components/layout/AppShell.jsx:8-12`
- **Root Cause:** iOS Safari automatically zooms in and breaks screen layout when focusing form inputs with `font-size < 16px`. Furthermore, `100vh` on mobile browsers caused the bottom navigation to be hidden behind Safari's dynamic navigation bar.
- **Fix Applied:**
  1. Added CSS rule `@media (max-width: 768px) { input, select, textarea { font-size: 16px !important; } }`.
  2. Switched root container to `min-h-dvh` and modal dialogs to `max-h-[90dvh]`.
  3. Added safe-area padding `env(safe-area-inset-bottom)` to `MobileNav.jsx`.
- **Verification:** Tested with responsive device emulators across 320px, 360px, 390px, 768px, and 1280px; no auto-zoom or navigation clipping.

---

### 11. Grid Scroll Position Jumping to Origin on Cell Edit
- **Severity:** Medium
- **Category:** UI UX & Grid Interaction
- **File & Line:** `client/src/features/roster/RosterGrid.jsx:16-35`, `53-58`
- **Root Cause:** When an operator updated a cell (e.g. on day 25 or row 28), the API response triggered a state update in `RosterView.jsx`, causing `RosterGrid.jsx` to re-render and resetting the table scroll container to `(0, 0)`.
- **Fix Applied:** Implemented a scroll position retention mechanism using `useRef`. The scroll container records `scrollLeft` and `scrollTop` on scroll events, and restores them seamlessly inside a `useEffect` whenever `viewData` updates.
- **Verification:** Tested in browser; scrolled to the end of the month, edited a cell status, and verified that scroll coordinates remain identical.

---

### 12. Render Cold-Start Gateway Error Handling
- **Severity:** Medium
- **Category:** Production Resilience
- **File & Line:** `client/src/api/client.js:14-35`
- **Root Cause:** On free-tier cloud platforms (like Render), inactive servers enter sleep mode. During wake-up (30-50s), the gateway returns HTML error pages (502 Bad Gateway or 503 Service Unavailable). Calling `res.json()` caused an unhandled `SyntaxError: Unexpected token '<'`.
- **Fix Applied:** Added content-type inspection before JSON parsing in `client/src/api/client.js`. If a 502/503 response arrives, it returns a human-friendly error: `"Backend service is starting up (cold start). Please retry in 10-15 seconds."`.
- **Verification:** Tested with non-JSON 502/503 responses; client displays toast notification rather than crashing.

---

## Performance & Scalability Benchmarks
The scheduling generator was evaluated under varying employee counts for a 31-day month (December):

| Employee Count | Total Matrix Cells | Generation Time | Peak Threshold Allowed | Result |
| :--- | :--- | :--- | :--- | :--- |
| **30 Employees** | 930 cells | **59 ms** | < 2,000 ms | **PASS (33x faster)** |
| **100 Employees** | 3,100 cells | **245 ms** | < 5,000 ms | **PASS** |
| **300 Employees** | 9,300 cells | **1,561 ms** | < 10,000 ms | **PASS** |

All scheduling operations execute with $O(1)$ lookup maps for assignments, operating calendars, and employee availability, eliminating $O(N^2)$ bottlenecks.
