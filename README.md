# ZetaQ EMS — Employee Management System

A full-stack, role-based Employee Management System built on the MERN stack. Three portals — **Admin**, **Manager**, and **Employee** — share one codebase, one REST API, and one MongoDB database, covering the full HR operations loop: attendance, leave, tasks, timesheets, daily reports, payroll, messaging, and department management.

## Portals

| Portal | Who uses it | What they can do |
|---|---|---|
| **Admin** | HR / org owner | Full access to every module across every department — manage employees, create/promote department managers, view all attendance/leave/tasks/payroll, org-wide reports |
| **Manager** | Team leads | Two modes on the same portal, controlled by whether the account is department-scoped: a **main manager** (unscoped) sees the whole org, a **department manager** is automatically restricted to their own department's people and data at the API level |
| **Employee** | Everyone else | Personal workspace — check in/out, apply for leave, view/update assigned tasks, submit timesheets and daily reports, message their manager |

Permissions are enforced **server-side** (in the API's authorization middleware and query filters), not just hidden in the UI — a department-scoped manager's requests physically cannot return another department's data.

## How It Works

```
apps/web (React SPA, :5174)
      │  REST calls, JWT in Authorization header
      ▼
apps/api (Express, :5000)
      │  role + department checked on every route
      ▼
MongoDB Atlas
```

The frontend never talks to the database directly — every read/write goes through the Express API, which verifies the JWT, checks the caller's role, and (for managers) scopes the query to their department before touching MongoDB. On the frontend, Redux Toolkit Query owns all server data: every mutation declares which cached queries it invalidates, so the UI stays in sync automatically without manually-written refetch logic.

## Tech Stack

**Frontend** (`apps/web`)
- React 18 + TypeScript + Vite
- Redux Toolkit + RTK Query — all server-state, caching, and cache-tag invalidation
- React Router v6
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- React Hook Form, React Hot Toast, Recharts, date-fns

**Backend** (`apps/api`)
- Node.js + Express + TypeScript
- Mongoose (MongoDB ODM)
- JWT authentication + bcrypt password hashing
- express-validator, helmet, cors, express-rate-limit
- Passport (Google OAuth), Nodemailer

**Database**
- MongoDB Atlas

**Tooling**
- Turborepo + npm workspaces (monorepo)

## Features

- **Three role-based portals** — Admin (full org access), Manager (main/unscoped or department-scoped), Employee (personal workspace) — all permissions enforced server-side, not just hidden in the UI
- **Attendance** — check-in/check-out, late tracking, team and personal history
- **Leave management** — apply, approve/reject, leave-balance tracking
- **Task tracker** — assignment, status, priority, department breakdown
- **Timesheets** — draft → submit → approve/reject pipeline with a full audit trail
- **Daily reports** — structured work reports with recipient targeting and manager comments
- **Messaging & notifications** — role/department-scoped internal messaging with a live-polling notification center
- **Department management** — admin-driven, in-place promotion of any employee to department manager, with auto-generated credentials
- **Payroll** — per-employee payroll records
- **Reports & analytics** — attendance %, leave distribution, performance scorecards

## Project Structure

```
zetaq-ems/
├── apps/
│   ├── api/          # Express + TypeScript REST API
│   │   └── src/
│   │       ├── controllers/
│   │       ├── models/
│   │       ├── routes/
│   │       └── middleware/
│   └── web/           # React + Vite frontend
│       └── src/
│           ├── pages/         # admin/, manager/, employee/
│           ├── components/
│           ├── store/api/     # RTK Query slices
│           └── context/
├── package.json        # workspace root
└── turbo.json
```

## API Overview

All routes are mounted under `/api/v1`. One route group per module:

```
/auth            login, forgot/reset password, Google OAuth
/employees       employee CRUD, credential issuance
/departments     department CRUD, head promotion
/attendance      check-in/check-out, attendance records
/leaves          apply, approve/reject, leave balance
/tasks           assignment, status updates
/timesheets      draft, submit, approve/reject, audit trail
/daily-reports   submit, comment, list
/messages        send, inbox/outbox
/notifications   fetch, mark read
/payroll         payroll records
/calendar        events
/reports         attendance % / performance aggregates
/uploads         file attachments
```

Every route (except `/auth`) requires a `Authorization: Bearer <JWT>` header and is gated by role; manager-only routes additionally scope by department server-side.

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB connection string — either a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster or a local MongoDB instance

### 1. Install dependencies

```bash
npm install
```

This installs both workspaces (`apps/api` and `apps/web`) in one pass via npm workspaces.

### 2. Configure environment variables

```bash
cp apps/api/.env.example apps/api/.env
```

Then edit `apps/api/.env`:

| Variable | Required | What it's for |
|---|---|---|
| `MONGODB_URI` | ✅ | Your MongoDB connection string |
| `JWT_SECRET` | ✅ | Any random string — signs access tokens |
| `JWT_REFRESH_SECRET` | ✅ | Any random string — signs refresh tokens |
| `PORT` | — | Defaults to `5000` |
| `CLIENT_URL` | — | Frontend origin, for CORS (`http://localhost:5174`) |
| `SMTP_*` / `FROM_EMAIL` / `FROM_NAME` | optional | Only needed for the "forgot password" email flow |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Only needed to enable the Google sign-in button |

`apps/web/.env` only needs `VITE_GOOGLE_CLIENT_ID` if you want Google sign-in on the frontend too — leave it blank otherwise.

### 3. Seed initial data

The database starts empty — nothing to log in with until you seed it:

```bash
cd apps/api
npm run seed
```

This creates the initial departments, an admin account, and demo employees/managers so the app is immediately usable. Check `apps/api/src/seed.ts` for the generated login credentials.

### 4. Demo login credentials

After seeding, these accounts are ready to use (also shown in-app on the Login page's "Test credentials" panel):

| Role | Email | Password | Scope |
|---|---|---|---|
| Admin | `admin@zetaq.com` | `Admin@1234` | Full system access |
| Manager | `manager@zetaq.com` | `MainMgr@1234` | Main Manager — all departments |
| Manager | `deepak.manager@zetaq.com` | `Deepak@1234` | Dept Manager — Engineering |
| Manager | `vivek.marketing.manager@zetaq.com` | `843d7c0a639a` | Dept Manager — Marketing |
| Manager | `sneha.finance.manager@zetaq.com` | `8f85b2a66d77` | Dept Manager — Finance |
| Manager | `vikram.product.manager@zetaq.com` | `c7152dd5d869` | Dept Manager — Product |
| Manager | `pooja.design.manager@zetaq.com` | `857b912a42e8` | Dept Manager — Design |
| Manager | `ananya.salesmarketing.manager@zetaq.com` | `41a7aef42334` | Dept Manager — Sales & Marketing |
| Manager | `kavya.support.manager@zetaq.com` | `f8d28ebe4f9d` | Dept Manager — Support |
| Manager | `nikhil.security.manager@zetaq.com` | `7d964c61a5ad` | Dept Manager — Security |
| Manager | `meena.hr.manager@zetaq.com` | `cb363af89c18` | Dept Manager — HR |
| Manager | `ganesh.bpo.manager@zetaq.com` | `9aa3b9af8e6d` | Dept Manager — BPO |
| Employee | `arjun@zetaq.com` | `Arjun@1234` | Personal workspace |

> All names, emails, and data belong to a fictional company ("ZetaQ") generated for demo purposes — no real people or organizations.

### 5. Run in development

```bash
npm run dev
```

Starts both workspaces together via Turborepo:
- API on **http://localhost:5000**
- Web app on **http://localhost:5174**

Run a single workspace instead with `npm run dev:api` or `npm run dev:web`.

### Build for production

```bash
npm run build
```

## License

Private project — not licensed for reuse.
