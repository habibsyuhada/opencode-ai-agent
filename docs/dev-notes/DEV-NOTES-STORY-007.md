# Dev Notes
Story ID: STORY-007

## Story Context Reviewed
- **Story**: STORY-007 — Hono RPC API Setup and Core Routes
- **Requirement IDs**: FR-003 [Server API]
- **Acceptance Criteria**: AC-004 (Partial) — Data available for dashboard
- **Goal**: Set up Hono's RPC client/server structure for end-to-end type safety between the server API and the React UI
- **Dependencies**: STORY-003 (Server Package), STORY-004 (Shared Package), STORY-005 (Database/Prisma)

## Files Changed

### Modified
- `packages/server/src/index.ts` — Restructured route setup from imperative calls to method chaining for Hono RPC type inference. Exported `AppType` type.
- `packages/server/package.json` — Added `main`, `types`, and `exports` fields for proper module resolution.
- `packages/ui/package.json` — Added `hono` dependency for the RPC client (`hc`).

### Created
- `packages/ui/src/lib/api.ts` — Hono RPC client (`hc`) setup with `AppType` generic for type-safe API calls.
- `packages/ui/src/types/env.d.ts` — Vite client type references for `import.meta.env`.
- `packages/server/src/rpc-types.ts` — Dedicated type-only export file for `AppType` (no runtime dependencies).
- `packages/server/src/__tests__/rpc-routes.test.ts` — Integration test verifying Hono RPC route structure and `testClient` usage.

## Implementation Summary

### 1. Server: Restructured Route Setup for Type Inference
The key change in `index.ts` is converting from imperative route registration to method chaining:

**Before** (imperative — types not inferred):
```ts
const api = new Hono();
api.route('/agents', agentsRoutes);
api.route('/tasks', tasksRoutes);
```

**After** (chained — types inferred by TypeScript):
```ts
const api = new Hono()
  .use('*', authMiddleware)
  .use('*', companyScopeMiddleware)
  .route('/agents', agentsRoutes)
  .route('/tasks', tasksRoutes);
```

This is critical because Hono's `.route()` method returns a new type with the merged schema only when used in a chain. Imperative calls don't update the TypeScript type, so `hc<AppType>()` would see no routes.

### 2. Exported AppType
Added `export type AppType = typeof app;` to `index.ts`. This type captures all route signatures (paths, methods, request/response types) from the chained setup.

### 3. UI: Hono RPC Client Setup
Created `packages/ui/src/lib/api.ts` with:
- `hc<AppType>(BASE_URL)` — typed Hono client
- `VITE_API_URL` environment variable support
- Comprehensive JSDoc with usage examples

### 4. Cross-Package Type Resolution
The server's `AppType` depends on the full Hono app construction (middleware, routes, etc.), which imports Node.js-specific modules. To avoid pulling these into the UI's TypeScript compilation context:
- The UI uses a local `AppType = Hono` declaration
- Once the server is built (generating `.d.ts` files), the actual `AppType` can be imported from `@armiai/server`
- The `rpc-types.ts` file in the server provides a clean type-only export path for future use

### 5. Existing Routes Verified
Both `/api/agents` and `/api/tasks` routes already have proper GET/POST handlers:
- `agents.get('/')` — List agents with filters, `?tree=true` for org chart
- `agents.post('/')` — Create agent (hire)
- `agents.get('/:id')` — Get single agent
- `agents.patch('/:id')` — Update agent
- `tasks.get('/')` — List tasks with filters
- `tasks.post('/')` — Create task
- `tasks.get('/:id')` — Get single task
- `tasks.patch('/:id')` — Update task
- `tasks.delete('/:id')` — Delete task
- `tasks.post('/:id/checkout')` — Atomic checkout
- `tasks.post('/:id/release')` — Release task

## Tests Added or Updated
- **New**: `packages/server/src/__tests__/rpc-routes.test.ts` — 10 tests covering:
  - Health check endpoint
  - API root endpoint with endpoint listing
  - GET /api/agents (list and single)
  - POST /api/agents (create)
  - GET /api/tasks (list and single)
  - POST /api/tasks (create)
  - RPC type inference verification
  - Chained route structure validation

## Test Commands Run
```bash
# Server typecheck
cd packages/server && pnpm run typecheck
# Result: PASS (clean)

# Server tests
cd packages/server && pnpm run test
# Result: 62 tests passed (4 test files)
# - rpc-routes.test.ts: 10 passed
# - service.test.ts: 13 passed
# - opencode.test.ts: 20 passed
# - schema.test.ts: 19 passed

# UI typecheck
cd packages/ui && pnpm run typecheck
# Result: PASS (clean)

# Install dependencies
pnpm install --no-frozen-lockfile
# Result: Success
```

## Test Results
All tests pass. Both server and UI packages typecheck cleanly.

## Commit Notes
Suggested commit message:
```
feat(server,ui): set up Hono RPC client/server structure (STORY-007)

- Restructure server route setup to use method chaining for Hono RPC type inference
- Export AppType from server for end-to-end type safety
- Create Hono RPC client (hc) in packages/ui/src/lib/api.ts
- Add hono dependency to UI package
- Add main/types/exports fields to server package.json
- Add rpc-routes.test.ts with 10 integration tests
```

## Risks / Limitations
1. **Cross-package type import**: The UI currently uses a local `AppType = Hono` declaration instead of importing from the server. Full type inference requires the server to be built first (generating `.d.ts` files). This is documented in `api.ts` with upgrade instructions.
2. **Middleware types**: The middleware (auth, companyScope) sets context variables (`user`, `companyId`) that are typed via `declare module 'hono'`. These augmentations work at the server level but may not propagate through the RPC client without the compiled types.
3. **Route chaining requirement**: Any future route additions to `index.ts` MUST use method chaining (not imperative calls) to maintain type inference. This is documented in the code comments.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
