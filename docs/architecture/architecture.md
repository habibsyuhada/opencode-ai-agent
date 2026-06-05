# Architecture Document
Status: Ready

## 1. Architecture Overview
The ArmiAI Platform is a monorepo application using a modern TypeScript stack to orchestrate AI agents for software development workflows. It transitions from a simple configuration-based prototype to a comprehensive platform.

The system is designed with this specific vision:
- **Hono Server** acting as the Brain/Heartbeat to manage execution logic and state.
- **OpenCode CLI** acting as the Hands/Execution Engine, spawned as isolated child processes to perform tasks.
- **PostgreSQL + Prisma** acting as the single source of truth for the Org Chart, Tasks, and Budgets.
- **React + Vite Dashboard** acting as the Management Interface for users to monitor and interact with the AI team.

The old prototype templates from `old_version/v2/template/.opencode/opencode.json` will be migrated into Prisma database seeds to populate the Agent Role Templates, ensuring continuity while moving to a robust database structure.

### Component Diagram
```text
+-------------------------------------------------------------+
|                     Client (Web/CLI)                        |
|   +-------------------+              +------------------+   |
|   |  Web UI (React)   |              |  CLI Tooling     |   |
|   +-------------------+              +------------------+   |
+-------------+----------------------------------+------------+
              |                                  |
              v                                  v
+-------------------------------------------------------------+
|                       Server (Hono)                         |
|   +------------------+  +-----------------+  +----------+   |
|   |  REST/RPC API    |  |  Auth/Gov Mod   |  | Activity |   |
|   +------------------+  +-----------------+  +----------+   |
|   +-----------------------------------------------------+   |
|   |                  Heartbeat Engine                   |   |
|   |  +------------+   +---------------+   +----------+  |   |
|   |  | Task Disp  |   | State Manager |   | Cost Trk |  |   |
|   |  +------------+   +---------------+   +----------+  |   |
|   +--------------------------+--------------------------+   |
|                              |                              |
|                              v                              |
|   +-----------------------------------------------------+   |
|   |                 OpenCode Adapter                    |   |
|   |  +-------------+  +---------------+  +-----------+  |   |
|   |  | Process Mgr |  | Sec Injector  |  | Result    |  |   |
|   |  +-------------+  +---------------+  +-----------+  |   |
|   +-----------------------------------------------------+   |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      Data Layer (Prisma)                    |
|   +-----------------------------------------------------+   |
|   |                   PostgreSQL Database               |   |
|   +-----------------------------------------------------+   |
+-------------------------------------------------------------+
```

## 2. Requirement Mapping

| ID | Description | Technical Component |
|---|---|---|
| FR-1 | Multi-Company Isolation | Prisma schema `Company` model + Hono middleware |
| FR-2 | Agent Org Chart & Roles | `Agent` model with parent/child relations |
| FR-3 | Task System | `Task`, `Goal`, `Project` models, Atomic checkout in Hono |
| FR-4 | Execution Engine | Hono Server Heartbeat Engine + OpenCode Adapter (CLI spawning) |
| FR-5 | Budget & Cost Tracking | `Budget`, `CostEvent` models, Server cost parser |
| FR-6 | Governance & Approvals | `Approval` model, Auth middleware |
| FR-7 | Activity Auditing | `ActivityEvent` model, Global audit middleware |
| FR-8 | Schedules & Routines | `Routine` model, Cron trigger system |
| FR-9 | Web Dashboard | React UI interacting via Hono RPC/REST |
| NFR-1 | Performance | Sub-100ms API, optimized Prisma queries |
| NFR-2 | Security | Encrypted secrets (`Secret` model), scoped injection |
| NFR-3 | Reliability | Orphaned execution handling, atomic checkouts |

## 3. System Context
The platform exists within the larger ArmiAI ecosystem, serving as the central orchestration layer between human operators and AI agents.
- **Users**: Interact via the React + Vite Dashboard (Management Interface) to manage agents, assign tasks, and track budgets. CLI users can perform setup tasks.
- **Hono Server**: Acts as the Brain/Heartbeat. Holds business logic, state, and scheduling.
- **OpenCode CLI**: Acts as the Hands/Execution Engine. The server spawns OpenCode as a child process to perform the AI work.
- **PostgreSQL + Prisma**: Acts as the single source of truth for the Org Chart, Tasks, and Budgets. Persistent storage for state.

## 4. Tech Stack
- **Database**: PostgreSQL, Prisma (ORM)
- **Backend (Server)**: Node.js, Hono (REST/RPC), Zod (Validation)
- **Frontend (UI)**: React, Vite, Tailwind CSS, TanStack Query, React Router, Recharts, Lucide Icons
- **CLI**: Node.js CLI tools
- **Agent Engine**: OpenCode (External CLI binary spawned as child processes)
- **Language**: TypeScript across the monorepo
- **Package Manager**: pnpm (workspaces)

## 5. Folder Structure
The project utilizes a pnpm monorepo structure.

```
/
├── packages/
│   ├── server/           # Hono API server, Prisma schema, Heartbeat engine, OpenCode Adapter
│   │   ├── prisma/       # schema.prisma, migrations, seeds (including legacy template migration)
│   │   ├── src/
│   │   │   ├── api/      # Hono routes and controllers
│   │   │   ├── engine/   # Heartbeat loop, OpenCode adapter, process spawning
│   │   │   ├── models/   # Zod schemas, DB interaction logic
│   │   │   └── utils/
│   ├── ui/               # React + Vite Dashboard
│   │   ├── src/
│   │   │   ├── components/ # Reusable UI components
│   │   │   ├── pages/      # Dashboard, Agents, Tasks, Budget, etc.
│   │   │   └── hooks/      # TanStack query hooks connecting to server API
│   ├── shared/           # Shared types, interfaces, constants, enums
│   │   ├── src/
│   │   │   ├── types/
│   │   │   └── enums/
│   └── cli/              # CLI tools
│       ├── src/
│       │   └── commands/ # onboard, dev, migrate, etc.
├── docs/                 # Documentation (PRD, Architecture)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## 6. Data Model
Key entities based on Prisma schema design:

- **Company**: Top-level tenant. `id`, `name`, `slug`, `mission`.
- **Workspace**: Physical/logical working area. `id`, `companyId`, `path`.
- **Agent**: AI actor in the Org Chart. `id`, `companyId`, `name`, `role`, `title`, `managerId` (self-relation), `status`, `config`. 
  - *Note: Old prototype templates (`old_version/v2/template/.opencode/opencode.json`) are migrated into Prisma database seeds as Agent Role Templates.*
- **Project**: High-level container. `id`, `companyId`, `name`.
- **Goal**: Mid-level objective. `id`, `projectId`, `name`, `status`.
- **Task**: Actionable item. `id`, `goalId`, `assigneeId`, `title`, `description`, `status`, `priority`, `lockedAt`, `artifacts`. Atomic checkout handled via `lockedAt` and `status` fields.
- **Heartbeat**: A single execution run. `id`, `taskId`, `agentId`, `status`, `startedAt`, `endedAt`, `log`, `tokensUsed`, `cost`.
- **Budget**: Financial constraints. `id`, `companyId`, `agentId` (optional), `monthly`, `used`, `currency`, `threshold`.
- **CostEvent**: Record of expenditure. `id`, `heartbeatId`, `provider`, `model`, `tokensIn`, `tokensOut`, `cost`.
- **Approval**: Governance gate. `id`, `companyId`, `type`, `requestedBy`, `targetType`, `targetId`, `status`, `decision`, `reason`.
- **ActivityEvent**: Audit log entry. `id`, `companyId`, `actorType`, `actorId`, `action`, `targetType`, `targetId`, `metadata`.
- **Routine**: Scheduled job. `id`, `companyId`, `agentId`, `name`, `cron`, `action`, `enabled`.
- **Secret**: Encrypted configuration. `id`, `companyId`, `name`, `encryptedValue`, `scope`.

## 7. API / Interface Design
Hono will expose a RESTful (or RPC via hc) API. All endpoints are scoped to the authenticated user's company context via the `X-Company-Id` header.

**Core Routes:**
- `GET /api/agents` (Supports filtering, tree structure for org chart)
- `POST /api/agents` (Hires a new agent, mapping to seeded role templates)
- `PATCH /api/agents/:id`
- `GET /api/tasks`
- `POST /api/tasks`
- `POST /api/tasks/:id/checkout` (Atomic checkout)
- `POST /api/tasks/:id/release`
- `POST /api/agents/:agentId/heartbeat` (Triggers immediate execution loop)
- `GET /api/heartbeats/:id` (Polls status)
- `GET /api/budgets`
- `GET /api/approvals`
- `POST /api/approvals/:id/approve`

## 8. UI Structure
- **Framework**: React + Vite Dashboard.
- **Layout**: Persistent left sidebar for navigation, top header for company switcher and user profile, main content area.
- **Dashboard**: High-level widgets (Active agents, budget dial, pending approvals).
- **Agents View**: Org chart (tree view) showing reporting lines, list view. Detailed agent profile with role config.
- **Tasks View**: Kanban board (Todo, In Progress, Review, Done). Task detail modal.
- **Budget View**: Charts (Recharts) showing spend over time, breakdown by agent/model.
- **Heartbeats View**: Live streaming logs of active executions, historical list.
- **Settings/Governance**: Tables for approvals, routines, and secret management.

## 9. Authentication and Authorization
- Multi-tenant architecture requires every request to identify the `companyId`.
- Initially, simple token-based or session-based auth for users.
- Role-based access control (RBAC) ensuring only authorized users can approve governance requests or view billing.

## 10. Error Handling
- Hono middleware captures all unhandled exceptions, returning standard JSON error responses (`{ error: string, code: number }`).
- Prisma errors (e.g., unique constraint violations) are mapped to appropriate HTTP status codes (e.g., 409 Conflict).
- OpenCode adapter failures (process crash, timeout) are caught, logging the error to the `Heartbeat` record and setting status to `FAILED`.

## 11. Testing Strategy
- **Shared/Utils**: Unit tests using Vitest.
- **Server**: Integration tests for Hono endpoints using in-memory SQLite or a dedicated test PostgreSQL DB. Focus on atomic checkout concurrency testing.
- **UI**: React Testing Library for component rendering and interaction.
- **CLI**: E2E tests mocking the OpenCode process.

## 12. Security Considerations
- **Secrets Management**: API keys and tokens are encrypted at rest in the database. They are decrypted only when injected into the OpenCode environment during a heartbeat.
- **Multi-Company Isolation**: Strict application-level filtering ensuring `companyId` is always applied in Prisma queries, or RLS in PostgreSQL.
- **Process Isolation**: The OpenCode child process runs in a constrained workspace directory to prevent arbitrary file system access outside the designated area.

## 13. Performance Considerations
- Database indexing on foreign keys (`companyId`, `agentId`, `taskId`) and status fields to speed up Kanban and dashboard queries.
- Atomic checkouts must be fast; use PostgreSQL `SELECT ... FOR UPDATE` or optimistic locking via Prisma to prevent race conditions when multiple agents look for tasks.
- UI uses TanStack Query for efficient caching and background refetching.

## 14. Deployment Notes
- Server and UI can be deployed as standard Node.js applications (e.g., via Docker, Vercel, Render).
- The environment requires the `opencode` binary to be available in the system PATH or a specified location.
- Database requires PostgreSQL instance setup and seeding of legacy `opencode.json` role templates.
- CLI handles local development setup (`pnpm dev`, `pnpm db:push`).

## 15. Risks and Trade-Offs
- **Child Process Overhead**: Spawning OpenCode CLI repeatedly might introduce latency. *Mitigation: Keep initialization minimal; explore persistent OpenCode server mode if available later.*
- **Concurrency Control**: Ensuring agents don't pick the same task simultaneously. *Mitigation: Strict DB-level locking during checkout in PostgreSQL.*
- **Parsing Output**: Relying on OpenCode's stdout/stderr format for token and cost calculation. *Mitigation: Request structured output (JSON) from OpenCode.*

## 16. Open Questions
- What is the exact output format of the `opencode` CLI that the adapter needs to parse for cost and token usage?
- How are complex file modifications synced back to the UI in real-time during a heartbeat? (Currently planned as end-of-heartbeat sync).
