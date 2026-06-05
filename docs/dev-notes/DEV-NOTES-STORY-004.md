# Dev Notes

**Story ID:** STORY-004 — Server Initialization (Hono + Zod Schemas)

## Story Context Reviewed

The server package (`packages/server`) required initialization with the Hono web framework, Zod validation schemas, and supporting middleware. The existing codebase had a Prisma schema already defined with models for Company, Agent, Project, Goal, Task, Heartbeat, Budget, CostEvent, Approval, ActivityEvent, Routine, and Secret.

The shared package (`@armiai/shared`) was already set up with TypeScript types and enums.

## Files Changed

| File | Status | Description |
|---|---|---|
| `packages/server/package.json` | Modified | Added hono, @hono/node-server, zod, dotenv dependencies; added tsx, @types/node devDependencies; updated dev/build/start scripts |
| `packages/server/src/index.ts` | Rewritten | Hono server entry point with health check, CORS, middleware chain, and route mounting |
| `packages/server/src/utils/logger.ts` | New | Structured logger with DEBUG/INFO/WARN/ERROR levels |
| `packages/server/src/middleware/error-handler.ts` | New | Global error handler — catches Zod, HTTP, and Prisma errors |
| `packages/server/src/middleware/auth.ts` | New | Authentication middleware stub (sets default admin user) |
| `packages/server/src/middleware/company-scope.ts` | New | Company isolation middleware (extracts companyId from auth context) |
| `packages/server/src/modules/companies/schema.ts` | New | Zod schemas for Company CRUD operations |
| `packages/server/src/modules/agents/schema.ts` | New | Zod schemas for Agent CRUD + role/status enums |
| `packages/server/src/modules/tasks/schema.ts` | New | Zod schemas for Task CRUD + checkout/release + status/priority enums |
| `packages/server/src/modules/projects/schema.ts` | New | Zod schemas for Project CRUD operations |
| `packages/server/src/modules/goals/schema.ts` | New | Zod schemas for Goal CRUD + status enum |

## Implementation Summary

### Hono Server (`src/index.ts`)
- Initialized Hono app with CORS middleware (configurable via `CORS_ORIGIN` env var)
- Applied global error handler as the outermost middleware
- Created a public `/health` endpoint returning service status, uptime, and timestamp
- Created `/api` route group with auth + company scope middleware applied
- Added 404 handler for unmatched routes
- Server listens on configurable `PORT` (default 3000) and `HOST` (default 0.0.0.0)
- Uses `@hono/node-server` for Node.js HTTP serving
- Loads `.env` via `dotenv/config`

### Middleware
- **error-handler.ts**: Catches ZodError (→ 400), HTTP errors with status, Prisma known errors (P2002→409, P2025→404, P2003→400), and unknown errors (→ 500). Returns standard `{ error, code, details? }` JSON shape.
- **auth.ts**: Stub implementation that sets a default admin user on every request. Defines `AuthUser` interface with id, companyId, role. Extends Hono's ContextVariableMap for type-safe `c.get('user')`.
- **company-scope.ts**: Reads companyId from the authenticated user context and exposes it via `c.get('companyId')` for downstream Prisma query scoping. Returns 401 if no user context exists.

### Zod Schemas
Each module (`companies`, `agents`, `tasks`, `projects`, `goals`) has a `schema.ts` file containing:
- Create input validation schema
- Update input validation schema (all fields optional)
- ID parameter schema
- List/query filter schema
- Inferred TypeScript types for all schemas

Task schema additionally includes `checkoutTaskSchema` and `releaseTaskSchema` for the atomic checkout pattern described in the architecture.

### Logger (`src/utils/logger.ts`)
- Simple structured logger with DEBUG/INFO/WARN/ERROR levels
- JSON context appended to log messages when provided
- DEBUG logs only emitted in development mode
- Consistent timestamp format (ISO 8601)

### Package.json Updates
- `dev`: `tsx watch src/index.ts` (hot-reload development server)
- `build`: `tsc` (TypeScript compilation)
- `start`: `node dist/index.js` (production execution)
- `typecheck`: `tsc --noEmit` (kept existing)

## Tests Added or Updated

No unit tests were added in this story as the implementation is foundational infrastructure (server bootstrap, middleware stubs, schema definitions). Testing will be integrated with subsequent stories that implement actual route handlers and business logic.

## Test Commands Run

```
tsc --noEmit
```

**Result:** ✅ Passed — zero TypeScript errors.

## Test Results

| Command | Result |
|---|---|
| `tsc --noEmit` (packages/server) | ✅ PASS — 0 errors |

## Commit Notes

Suggested commit message:
```
feat(server): initialize Hono server with Zod schemas and middleware

- Add Hono server entry point with health check endpoint
- Add global error handler middleware (Zod/HTTP/Prisma error mapping)
- Add authentication middleware stub
- Add company isolation middleware for multi-tenant scoping
- Add Zod validation schemas for companies, agents, tasks, projects, goals
- Add structured logger utility
- Update package.json with dev/build/start scripts
- Install hono, @hono/node-server, zod, dotenv, tsx, @types/node
```

## Risks / Limitations

- **Auth middleware is a stub**: Always sets a default admin user. Real authentication (JWT/session) will be implemented in a future story.
- **No route handlers yet**: The `/api` group is scaffolded but has no resource endpoints — those come in subsequent stories.
- **Zod v4**: Using Zod 4.x which has some API differences from v3. Current usage is compatible with both.
- **No test framework configured**: Vitest or similar will need to be set up when tests are required.

## Ready for Scrum Master Review?

**Status: READY_FOR_SM_REVIEW**
