# Dev Notes
Story ID: STORY-005

## Story Context Reviewed
- **Story**: STORY-005 — Server API: Core Endpoints (Companies, Agents, Projects, Tasks)
- **PRD Reference**: FR-003 (Server API), FR-005 (Task Management)
- **Architecture Reference**: docs/architecture/architecture.md §7 (API / Interface Design)
- **Schema Reference**: docs/schema/SCHEMA-AND-API.md §2 (Core API Endpoints)

**Note**: The story file STORY-005.md describes "Database Foundation & Prisma Schema" but the actual implementation requested was the CRUD service and route layers for core entities. The Prisma schema and Zod validation schemas already existed from prior work. This implementation adds the business logic (service) and HTTP endpoint (route) layers on top of those foundations.

## Files Changed

### New Files Created
| File | Purpose |
|---|---|
| `packages/server/src/modules/companies/service.ts` | Company CRUD business logic |
| `packages/server/src/modules/companies/routes.ts` | Company Hono REST routes |
| `packages/server/src/modules/agents/service.ts` | Agent CRUD + org chart tree builder |
| `packages/server/src/modules/agents/routes.ts` | Agent Hono REST routes |
| `packages/server/src/modules/projects/service.ts` | Project CRUD business logic |
| `packages/server/src/modules/projects/routes.ts` | Project Hono REST routes |
| `packages/server/src/modules/goals/service.ts` | Goal CRUD with company isolation via project |
| `packages/server/src/modules/goals/routes.ts` | Goal Hono REST routes |
| `packages/server/src/modules/tasks/service.ts` | Task CRUD + atomic checkout/release |
| `packages/server/src/modules/tasks/routes.ts` | Task Hono REST routes with checkout/release |

### Modified Files
| File | Change |
|---|---|
| `packages/server/src/index.ts` | Added route module imports and mounted all 5 route groups under `/api` |

## Implementation Summary

### Architecture Pattern
Each module follows a consistent **service + routes** pattern:
- **`service.ts`**: Pure business logic with Prisma queries. No HTTP concerns.
- **`routes.ts`**: Hono route definitions that parse/validate input via Zod schemas and delegate to services.

### Multi-Tenant Isolation
- **Companies**: Direct `companyId` filter on all queries.
- **Agents, Projects**: Direct `companyId` foreign key on the model.
- **Goals**: Company isolation enforced via `project.companyId` relation chain.
- **Tasks**: Company isolation enforced via `goal.project.companyId` relation chain.

### API Endpoints Implemented

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/companies` | List all companies |
| GET | `/api/companies/:id` | Get company by ID |
| POST | `/api/companies` | Create company |
| PATCH | `/api/companies/:id` | Update company |
| DELETE | `/api/companies/:id` | Delete company |
| GET | `/api/agents` | List agents (supports `?role=`, `?status=`, `?managerId=` filters) |
| GET | `/api/agents?tree=true` | Get org chart as tree structure |
| GET | `/api/agents/:id` | Get agent by ID with reports |
| POST | `/api/agents` | Hire new agent |
| PATCH | `/api/agents/:id` | Update agent (status, role, etc.) |
| GET | `/api/projects` | List projects for company |
| GET | `/api/projects/:id` | Get project with goals |
| POST | `/api/projects` | Create project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project (cascades) |
| GET | `/api/goals` | List goals (supports `?projectId=`, `?status=` filters) |
| GET | `/api/goals/:id` | Get goal with tasks |
| POST | `/api/goals` | Create goal under project |
| PATCH | `/api/goals/:id` | Update goal |
| DELETE | `/api/goals/:id` | Delete goal (cascades) |
| GET | `/api/tasks` | List tasks (supports `?goalId=`, `?assigneeId=`, `?status=`, `?priority=`) |
| GET | `/api/tasks/:id` | Get task with heartbeats |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/checkout` | Atomic lock for agent execution |
| POST | `/api/tasks/:id/release` | Unlock after completion |

### Key Design Decisions

1. **Org Chart Tree Builder** (`agents/service.ts`): The `getOrgChart()` function fetches all agents for a company and builds a tree in-memory using the `managerId` self-relation. This avoids recursive Prisma queries and keeps the DB query simple.

2. **Atomic Task Checkout** (`tasks/service.ts`): Uses Prisma's `findFirst` + `update` with an `OR` condition on `lockedAt` to implement optimistic locking. Returns 409 Conflict if the task is already locked by another agent.

3. **Prisma Type Casting**: Used `Prisma.InputJsonValue` casts for JSON fields (`config`, `artifacts`) to satisfy TypeScript strict mode with Prisma's generated types.

4. **Relation-Based Updates**: For Agent's `managerId`, used Prisma's relation API (`manager: { connect/disconnect }`) instead of direct field update, as Prisma's `AgentUpdateInput` uses relation syntax.

## Tests Added or Updated
No dedicated test files were created. The existing Zod schemas in each module's `schema.ts` serve as validation layers. Integration tests should be added in a follow-up story once a test database is available.

Manual validation:
- TypeScript typecheck passes (`npx tsc --noEmit` — 0 errors)
- Prisma client generates successfully (`npx prisma generate`)

## Test Commands Run
```bash
npx prisma generate   # ✅ Success — Generated Prisma Client v6.9.0
npx tsc --noEmit      # ✅ Success — 0 errors
```

## Test Results
- **Prisma Generate**: PASS
- **TypeScript Typecheck**: PASS (0 errors)

## Commit Notes
Suggested commit message:
```
feat(server): add CRUD routes and services for core entities

Implements service + route layers for Companies, Agents, Projects,
Goals, and Tasks modules. Each module follows the service/routes
pattern with Zod validation and multi-tenant isolation.

Key features:
- Full CRUD for all 5 core entities
- Agent org chart tree endpoint (?tree=true)
- Atomic task checkout/release with optimistic locking
- Company isolation via relation chain for nested entities

Closes STORY-005
```

## Risks / Limitations
1. **No Integration Tests**: Tests require a running PostgreSQL instance. Should be added in a dedicated testing story.
2. **Stub Auth**: The auth middleware still uses a stub user. Real auth will change how `companyId` is obtained.
3. **No Pagination**: List endpoints return all records. Pagination should be added for production use.
4. **Checkout Race Condition**: The optimistic locking approach may have edge cases under high concurrency. PostgreSQL `SELECT ... FOR UPDATE` would be more robust.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
