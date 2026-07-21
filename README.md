# ZetaQ EMS — Employee Management System

A full-stack, role-based Employee Management System built on the MERN stack. Three portals — **Admin**, **Manager**, and **Employee** — share one codebase, one REST API, and one MongoDB database, covering the full HR operations loop: attendance, leave, tasks, timesheets, daily reports, payroll, messaging, and department management.

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

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB Atlas connection string (or local MongoDB instance)

### Setup

```bash
# install dependencies for both workspaces
npm install

# configure environment variables
cp apps/api/.env.example apps/api/.env
# then edit apps/api/.env with your MongoDB URI and JWT secret
```

### Run in development

```bash
npm run dev
```

This starts both workspaces together via Turborepo:
- API on **http://localhost:5000**
- Web app on **http://localhost:5174**

Run a single workspace instead with `npm run dev:api` or `npm run dev:web`.

### Build for production

```bash
npm run build
```

## License

Private project — not licensed for reuse.
