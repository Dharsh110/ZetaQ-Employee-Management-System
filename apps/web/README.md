# ZetaQ EMS — Frontend

Employee Management System web client for ZetaQ Technologies — three role-based portals (Admin, Manager, Employee) covering attendance, timesheets, tasks, leave, payroll, and reporting.

This repo contains the **frontend only** (React/Vite). The Express + MongoDB backend that powers it lives in a separate `apps/api` project and is not part of this repository.

## Tech Stack

- **React 18** + **TypeScript** + **Vite 5**
- **Redux Toolkit + RTK Query** — primary data layer (API calls, caching, mutations) across all three portals
- **React Router v6** — routing
- **Tailwind CSS** + **Radix UI** (shadcn/ui pattern) — components and styling
- **React Hook Form** — form handling/validation
- **Axios** — HTTP client (used alongside RTK Query's fetch-based baseQuery)
- **Recharts** — charts/analytics visualizations
- **React Hot Toast** — notifications/toasts

> Note: `zustand` and `@tanstack/react-query` are present as legacy dependencies from an earlier iteration of the app and are being phased out in favor of Redux Toolkit + RTK Query.

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs on **http://localhost:5173** by default (`vite.config.ts`) and proxies all `/api/*` requests to the backend at `http://localhost:5000` — so the backend (`apps/api`) must be running separately for the app to function with real data.

### Environment Variables

Create a `.env` file in this folder (see `.env` for the current template):

```
VITE_GOOGLE_CLIENT_ID=
```

- `VITE_GOOGLE_CLIENT_ID` — Google OAuth Client ID for the "Continue with Google" login option. Currently **disabled/commented out** in `src/pages/auth/Login.tsx` until a real Client ID is configured (see comments in that file for the 4 spots to uncomment).

### Other scripts

```bash
npm run build     # Type-check + production build
npm run preview   # Preview the production build locally
npm run lint      # ESLint
```

## Portals & Modules

### Admin Portal (`src/pages/admin`)
Dashboard, Employees, Departments, Attendance, Leaves, Tasks, Payroll, Timesheets, Team Reports, Daily Reports, Calendar, Analytics, Messages, Settings, Profile.

### Manager Portal (`src/pages/manager`)
Dashboard, My Team, Team Attendance, Leave Approvals, Task Review, Timesheet Approvals, Performance, Reports, Calendar, Daily Report, Messages, Settings, Profile.

### Employee Portal (`src/pages/employee`)
Dashboard, My Attendance, My Tasks, Submit Task, Timesheet, Daily Report, Uploaded Files, My Leaves, Calendar, Payslips, Messages, Settings, Profile.

### Shared (`src/pages/shared`, `src/pages/auth`)
Notifications, Calendar (shared component), Profile (shared component), Login, Forgot/Reset Password.

## Authentication

- Login is by **email or admin-assigned Employee ID** + password, scoped to one of three roles (Admin / Manager / Employee) selected on the login screen.
- There is **no public self-signup** — accounts (including Manager accounts) are provisioned by an Admin, and login credentials are surfaced to the admin at creation time to share with the new user.
- A JWT is issued on login and stored client-side; it's attached automatically to every API request via an Axios interceptor.
- Deactivated accounts are blocked from logging in with a clear error message.

### Manager model

Managers come in two flavors:
- **Main Manager** — no department assigned, has visibility across **all** departments.
- **Department Manager** — scoped to a single department's employees/data only.

## Key Features

- **Attendance** — check-in/out, daily/monthly reports, exact-date and year filters, department + employee cascading filters, distinct from Timesheet-based "Official Work Hours."
- **Timesheets** — multiple entries per day, submit/approve/reject/resubmit workflow with reason capture, real-time notifications on every state change, summary-card counts with click-to-filter, task/project/description/remarks detail on every entry.
- **Tasks** — assignment, review, status tracking, file attachments.
- **Leave Management** — apply, approve/reject/cancel, balance tracking by leave type.
- **Payroll** — payslip generation and viewing.
- **Daily Reports** — structured end-of-day reporting (achievements, challenges, next-day plan, mood).
- **Notifications** — real-time, categorized (Timesheet, Task, Leave, Payroll, Message, etc.), with read/archive/delete states.
- **Reporting** — department/employee/date-range filterable reports across Attendance, Timesheets, and Tasks.

## Demo/Test Credentials

For local testing only — see the "Test credentials (demo)" panel on the login screen:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@zetaq.com` | `Admin@1234` |
| Manager (Main Manager) | `manager@zetaq.com` | `MainMgr@1234` |
| Employee | `arjun@zetaq.com` | `Arjun@1234` |
