# STORY-007 — Hono RPC API Setup and Core Routes
Status: Ready

## Requirement IDs
- FR-003 [Server API]

## Acceptance Criteria IDs
- AC-004 (Partial): Data available for dashboard.

## Business Context
The dashboard UI needs a way to fetch and manipulate data (agents, tasks). We will use Hono's RPC feature to provide end-to-end type safety between the server and client.

## Technical Context
Setting up the Hono RPC client/server structure and implementing basic CRUD operations for Agents and Tasks.

## Scope
- In `packages/server`, set up the Hono RPC routing structure.
- Implement GET/POST routes for `/api/agents`.
- Implement GET/POST routes for `/api/tasks`.
- Export the `AppType` from the server.
- In `packages/ui`, set up the `hc` (Hono Client) using the exported `AppType`.

## Out of Scope
- Complex filtering or advanced task manipulation (like atomic checkout).
- Authentication middleware (mock a default company for now).

## Files Likely Affected
- `/packages/server/src/index.ts`
- `/packages/server/src/routes/agents.ts` (new)
- `/packages/server/src/routes/tasks.ts` (new)
- `/packages/ui/src/lib/api.ts` (new)

## Implementation Notes
- Ensure Prisma Client is instantiated and available to the Hono routes.
- Temporarily hardcode a `companyId` in the routes until auth is implemented.

## Test Requirements
- UI can successfully fetch the list of seeded agents using the typed `hc` client.

## Edge Cases
- Circular dependencies if types are not exported correctly.

## Dependencies
- STORY-003 (Initial Server Package Setup)
- STORY-004 (Shared Package Setup)
- STORY-005 (Database Foundation & Prisma Schema)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
