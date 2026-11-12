# RosterIQ — Smart Roster Management System

> **Hiring Assignment Project**  
> Built with **React 19 + Vite + Tailwind CSS v4**, **Node.js + Express**, **MongoDB + Mongoose**, and a **Pure Deterministic Scheduling Engine** in JavaScript.  
> Designed following the Vercel Geist design system, WCAG 2.1 AA accessibility, and mobile-first responsive guidelines.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Client (React 19 + Tailwind v4 + React Router v7)"]
        UI["5 Views: Company / Pod / Brand / Process / Employee"]
        Grid["Interactive Roster Grid & Mobile Agenda"]
        ConflictPanel["Real-Time Conflict Panel (Errors vs Warnings)"]
        CellEditor["In-Place Cell Editor (Instant Re-validation)"]
        BackupSuggester["AI-Driven Backup Recommendation Modal"]
        DemoWalkthrough["Interactive One-Click Demo Walkthrough"]
    end

    subgraph Server ["Server (Node.js + Express)"]
        REST["REST API Layer (/api/v1)"]
        Hydrator["DB Hydrator (Fetches Snapshot)"]
        Middleware["Centralized Error Interceptor (Mongoose / Dup Keys)"]
    end

    subgraph PureEngine ["Pure Deterministic Engine (/server/engine) - Zero DB Calls"]
        CalendarRules["calendarRules.js (ALL_365, MON_SAT, MON_FRI, etc.)"]
        Availability["availability.js (Leaves, Comp-Offs, Shifts)"]
        Generator["generator.js (Most-Constrained-First Greedy Placement)"]
        Validator["validator.js (O(1) Matrix Validation < 50ms)"]
        Suggester["backupSuggester.js (Multi-Factor Scoring)"]
    end

    subgraph Database ["Database (MongoDB Atlas / Local MongoDB 8.2)"]
        Mongoose["Mongoose Schemas with Compound Indexes"]
        Seed["Realistic Seed Data (32 Emps, 5 Pods, 20 Brands)"]
    end

    Client <-->|REST API / JSON| REST
    REST --> Hydrator
    Hydrator --> Database
    Hydrator -->|Plain JS Snapshot| PureEngine
    PureEngine -->|{ entries, conflicts }| REST
    REST --> Database
```

---

## Stack & Technologies

- **Frontend**: React 19, Vite, Tailwind CSS v4 (using `@tailwindcss/vite`, `@import "tailwindcss";`, and `@theme` CSS-first configuration), React Router v7, Lucide React icons.
- **Backend**: Node.js v24, Express, Mongoose 8, CORS, Dotenv.
- **Scheduling Engine**: Pure deterministic JavaScript in `/server/engine` with zero external or database dependencies (100% unit-testable in isolation).
- **Testing**: Vitest for unit tests and API integration testing.
- **Database**: MongoDB 8.2 (Local) / MongoDB Atlas (Production).
- **Deployment**: Vercel (Client) + Render (Server).

---

## Getting Started

### Prerequisites
- Node.js >= 20 (Node 24 recommended)
- MongoDB instance running locally on `mongodb://127.0.0.1:27017` or a MongoDB Atlas connection string.

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/itsNabilSk/RosterIQ---Roster-Management-System-.git
cd RosterIQ---Roster-Management-System-

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
cd ..
```

### 2. Configure Environment Variables

Create `.env` in `/server`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/rosteriq
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

Create `.env` in `/client`:
```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 3. Seed Realistic Database

Populates 5 pods with designated leads, 32 employees, 20 brands (~80% single-resource), ~40 processes with mixed calendars, public holidays, and the deliberate demo conflict:

```bash
npm run seed
# or: cd server && npm run seed
```

### 4. Run Development Servers

```bash
# Terminal 1: Start Express Backend API
cd server
npm run dev

# Terminal 2: Start Vite Frontend Client
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

### 5. Run Automated Tests

```bash
cd server
npm test
```

Runs all 58 automated unit and integration tests across engine modules, schemas, calendar rules, validator, backup suggester, plan comparator, demo scenarios, and REST APIs.

---

## Deployed URLs

- **Frontend (Vercel)**: `https://roster-iq-roster-management-system.vercel.app`
- **Backend API (Render)**: `https://rosteriq-roster-management-system-1.onrender.com/api/v1`
- **Database**: MongoDB Atlas M0 Cluster

---

## Core System Assumptions

1. **Operating Calendar vs Employee Availability Separation**: Brand and process operating rules (`ALL_365`, `MON_SAT`, `MON_FRI`) are decoupled from employee availability. A coverage gap occurs only when a process operates on a date AND active available assigned staff is less than `minStaffRequired`.
2. **Deterministic & Unit-Testable Engine**: The scheduling and conflict detection engine in `/server/engine` performs **zero database queries**. It accepts pure JavaScript snapshots, allowing instantaneous execution (< 50ms for validation, ~150ms for 32 employees × 31 days generation).
3. **Never Silently Generate an Invalid Roster**: When constraints clash (e.g., single-resource employee absent on an operating shift), the system never silently drops coverage or fakes attendance. It generates the best valid schedule, explicitly records an `ERROR` conflict, and prevents publishing without a written manager override reason.
4. **Accessible Multi-Signal UI**: Status cells never convey state via color alone. Every shift cell pairs a high-contrast letter code (`W`, `WO`, `L`, `CO`, `H`), icon, textual label, and descriptive tooltip.
5. **Standardized Time Zone**: All date calculations are executed in UTC midnight (`YYYY-MM-DD`) to avoid local browser timezone shifts across month boundaries.

---

## How I Think — Design Decisions & Trade-offs

### 1. How did you model employees, brands, processes, pods, and their relationships?

I started by looking at the real-world org chart. Pods are basically teams — a group of people under one lead. Employees belong to a pod. Brands are the clients, and each brand can have multiple processes (CS, ACC, NDR, etc.). The tricky part was the employee-to-process relationship — it's genuinely many-to-many. One person can handle CS for Brand A and ACC for Brand B, or two people can share CS for the same brand.

So I created a separate `Assignment` collection that links an employee to a specific process, with a role (primary or backup) and allocation percentage. This is basically a join table, and it turned out to be the single most important modeling decision. Without it, I'd have been hardcoding relationships and the whole system would break the moment someone got reassigned.

For the rest: `Pod` has a `leadId` pointing to an employee. `Process` belongs to a `Brand` and carries its own calendar rule (ALL_365, MON_SAT, MON_FRI, etc.) and minimum staffing requirement. `Leave` and `Holiday` are separate — holidays are company-wide dates, leaves are per-employee with an approval status. And then `Roster` is the monthly parent doc, with `RosterEntry` being individual day-level cells (one per employee per date).

I used compound unique indexes pretty aggressively — `{ employeeId, processId }` on assignments, `{ rosterId, employeeId, date }` on entries, `{ month, year }` on rosters — because duplicate data here would silently corrupt schedules, and I'd rather have Mongoose throw an error than debug phantom double-bookings later.

---

### 2. How does your system generate a roster and determine whether it satisfies the required constraints?

The generation logic lives in `/server/engine/generator.js` and it's completely pure — zero database calls, just takes a plain JS snapshot of employees, assignments, leaves, holidays, and processes, and returns entries + conflicts.

The algorithm works in phases:

First, I lock in the non-negotiables. Approved leaves become `LEAVE` cells, comp-offs become `COMP_OFF`, and public holidays get marked for employees whose processes don't operate on holidays. These are locked — the algorithm won't touch them.

Then comes the hard part: weekly-off placement. I sort employees by how "constrained" they are — someone who's the sole person on a 365-day brand gets processed first, because their off-day choices are the most restricted. For each employee in each calendar week, I try their preferred off-day first. Before placing it, I simulate: "If this person is off on Wednesday, does any of their assigned processes drop below minimum staff?" If yes, I skip that day and try the next option. If no valid day exists without breaking coverage, I don't force it — I leave them working all 7 days and flag a `NO_WEEKLY_OFF` warning.

Finally, every remaining unlocked cell becomes `WORKING`, and the whole matrix gets passed to `validator.js`. The validator checks coverage gaps, SPOF risks, consecutive work-day violations, and preference mismatches. It classifies everything as either `ERROR` (must fix before publishing) or `WARNING` (should fix, but won't block you).

The key design choice was keeping the engine pure. No DB calls means I can unit test every edge case — leap years, impossible constraints, 300-employee performance — without spinning up MongoDB. It also means validation runs in under 50ms, so the UI can re-validate after every single cell edit in real time.

---

### 3. How did you handle the difference between single-resource brands and brands with multiple employees?

This was one of the first things I thought about because ~80% of brands have just one person handling everything. For those brands, any absence is a crisis — there's literally nobody else.

The engine tracks how many primary assignees each brand-process has. For single-resource setups, if that one employee is on leave or has a weekly off on an operating day, the validator raises two errors: `COVERAGE_GAP` (staff count is 0, minimum is 1) and `SPOF_RISK` (this brand has a single point of failure with no coverage).

For multi-employee brands, it's more nuanced. Say Beta Support has Sanjay, Ritu, and Harish on CS with `minStaff: 2`. If Harish is on leave, I check remaining available staff — Sanjay and Ritu are still there, 2 ≥ 2, so no error. The system only flags a gap when enough people are simultaneously absent that coverage actually drops below the threshold.

I didn't want false alarms. If a brand has 3 people and one takes a day off, that's normal. The manager shouldn't see a red error for something that's perfectly fine operationally.

---

### 4. What happens when an employee manages all processes for a brand but is unavailable on a required working day?

This is the classic SPOF scenario, and honestly where the app earns its keep.

When Rahul (sole person on Brand Alpha) has an approved leave on December 1st, and Alpha's CS process runs ALL_365, the validator catches it immediately. It flags both `COVERAGE_GAP` and `SPOF_RISK` errors with the specific date, brand, and affected processes listed.

Then the backup suggester kicks in. It scores every other employee in the company using a few factors I found made sense: same-pod teammates get priority (they know the workflows), people who already have backup assignments on that brand score higher (they're cross-trained), and then I check availability and workload — someone already working 6 days that week scores lower than someone with a lighter schedule.

There's also a critical negative filter: if assigning someone as backup would leave *their own* brand unstaffed (because they're the sole resource there), they get heavily penalized or excluded entirely. I don't want to solve one SPOF by creating another.

The UI shows the top candidates with reason badges explaining why each was ranked. The manager picks one, clicks "Assign Backup," and the conflict resolves live — no page reload, no re-generation needed.

---

### 5. How does your system handle conflicting requirements or insufficient staffing?

The core principle I stuck with: **never silently generate a broken roster**. If constraints can't all be satisfied, I'd rather show an honest error than pretend everything's fine.

Conflicts are split into two severity levels:
- **ERROR**: Things that genuinely break operations — a brand with zero coverage on an operating day, someone double-booked, a process below minimum staff. These block publishing.
- **WARNING**: Things that aren't ideal but aren't operational failures — someone working 7 days straight, weekly off on a non-preferred day, an employee with no off in a given week. These show up but don't block publishing.

If a manager absolutely needs to publish with unresolved errors (maybe there's an external contractor covering that brand, or the client agreed to reduced coverage), they can override — but they have to type a reason. That reason gets saved on the roster document permanently. It's an accountability trail, not a "dismiss and forget" button.

I considered auto-resolving conflicts by pulling in backups automatically, but decided against it. The manager needs to see the problem and make the call. Automation should surface the issue and suggest solutions, not make staffing decisions silently.

---

### 6. Which parts of the process did you automate, and which did you leave under human control? Why?

**Automated:** Roster generation, conflict detection, and backup candidate ranking. These are purely computational — checking 32 people × 31 days against calendar rules and staffing requirements is exactly the kind of combinatorial work that humans are terrible at and computers are great at. A person doing this manually would miss things. The engine doesn't.

**Human-controlled:** Leave approvals, backup assignment decisions, and the final publish action. These require context the system doesn't have — maybe the manager knows that Priya is dealing with a personal situation and shouldn't be asked to cover an extra shift, even though the algorithm ranked her #1. Or maybe the team already discussed informally that Amit will cover Alpha next Monday. These are judgment calls, not math problems.

I also left manual cell editing in human hands. After generation, the manager can click any cell and change it — switch someone's off-day, mark a leave, assign a working day. Every edit triggers instant re-validation, so they see the impact immediately. The system guides, the human decides.

---

### 7. If the company doubled its team and brand count, what would you change about your solution?

Honestly, at 64 employees and 40 brands, not much needs to change architecturally. The engine currently handles 32 employees in about 150ms. I ran benchmarks with 100 and 300 synthetic employees — 100 stays well under 1 second, 300 pushes to about 1.5 seconds. For 64 employees, generation would probably run in ~300ms, which is perfectly fine.

The frontend grid would be the first real bottleneck. 64 rows × 31 columns is ~2,000 interactive cells. Modern browsers handle that okay, but once you're past 100 employees, I'd add row virtualization (probably `@tanstack/react-virtual`) so the DOM only renders visible rows. The current approach of rendering everything is simpler and works for now, but it wouldn't scale to 200+.

On the database side, I'd want to add better caching for the hydration step — right now every generation fetches the full snapshot of employees, assignments, processes, leaves, and holidays. At scale, I'd cache the mostly-static parts (assignments don't change mid-month) and only re-fetch what changed.

If we're talking 500+ employees, I'd move generation to a background worker (Node.js Worker Thread or a job queue like BullMQ) so it doesn't block the API server. And I'd probably split the UI into pod-level views where each pod lead manages their own team's roster independently, rather than one manager seeing the entire company grid at once.

---

### 8. If you had one additional week to work on this, what would you improve first?

First thing: **drag-and-drop shift swapping**. Right now, changing an assignment means opening a modal and clicking through options. Being able to drag Rahul's shift cell onto Ananya's row with a live green/red preview of whether it creates a conflict would make the whole experience way more intuitive.

Second: **employee self-service**. A separate login where employees can see their own schedule, request leaves, and immediately see "heads up — this date would leave Brand X uncovered" before submitting. Right now only the manager interacts with the system.

Third: **CSV/Excel export**. Operations teams live in spreadsheets. Even with a great web UI, someone's going to ask "can I download this?" within the first week of using it. A clean export with colored status cells and a summary row would save them from screenshotting the grid.

And honestly, I'd spend time on polish — better loading skeletons, optimistic UI updates, maybe keyboard shortcuts for power users who manage rosters daily. The core scheduling logic works well; it's the last-mile UX that makes people actually want to use a tool every day.

---

## Interactive Demo Scenario Walkthrough

To verify the hiring assignment's required demo scenario, click **"Interactive Demo"** in the top navigation or navigate to `/demo`:

1. **Step 1 — Baseline Single-Resource Brand**:
   - Brand **Alpha CS** relies solely on employee **Rahul Sharma** to operate Customer Support (`ALL_365`), Account Management (`MON_SAT`), and NDR (`MON_FRI`).
2. **Step 2 — Absence & Immediate Detection**:
   - Rahul has an approved leave on **Monday, Dec 1, 2025**.
   - RosterIQ immediately flags `SPOF_RISK` and `COVERAGE_GAP` errors across all 3 processes.
3. **Step 3 — Multi-Factor AI Backup Recommendation**:
   - The engine scores available employees. **Ananya Iyer** is ranked #1 due to Same Pod (*Pod Titan*), zero secondary conflict risk, and light workload.
4. **Step 4 — One-Click Resolution**:
   - Click **"Assign Backup Live"**. The schedule updates, and all errors for Brand Alpha CS resolve immediately to 0.
5. **Step 5 — Multi-Employee Resilience Verification**:
   - Inspect Brand **Beta Support** (3 employees: Sanjay, Ritu, Harish, `minStaff: 2`). Harish is on leave on Monday, Dec 1, but Sanjay and Ritu maintain 2/2 coverage, remaining green with 0 errors.

---


