# Dev Notes
Story ID: STORY-008

## Story Context Reviewed
- **Story**: STORY-008 — Task Atomic Checkout
- **Requirement IDs**: FR-005 [Task Management], FR-006 [OpenCode Adapter]
- **Acceptance Criteria**: AC-003 (Partial) — Task checkout/release with concurrency control
- **Goal**: Implement atomic task checkout/release with Prisma transactions, activity recording, task assignment, and task commenting
- **Dependencies**: STORY-005 (Database/Prisma), STORY-007 (Hono RPC API)

## Files Changed

### Created
- `packages/server/src/utils/activity.ts` — Centralised activity recording utility with `recordActivity()` function and `ActivityActions` constants. Wraps Prisma's ActivityEvent model for audit logging across all modules.
- `packages/server/src/utils/__tests__/activity.test.ts` — 7 tests covering recordActivity success/failure paths and ActivityActions constants.
- `packages/server/src/modules/tasks/__tests__/service.test.ts` — 23 tests covering atomic checkout, release, assignment, comments, schema validation, and concurrent race condition scenarios.

### Modified
- `packages/server/src/modules/tasks/service.ts` — Complete rewrite:
  - `checkoutTask()` now uses `prisma.$transaction` with `SELECT ... FOR UPDATE` via `$queryRaw` for true atomic checkout
  - `releaseTask()` now uses `prisma.$transaction` with `SELECT ... FOR UPDATE` for ownership verification
  - Added `assignTask()` for assigning tasks to agents without locking
  - Added `addTaskComment()` for storing comments as ActivityEvent records
  - All lifecycle actions now record activity events via `recordActivity()`
  - Added `ServiceResult<T>` and `ServiceError` types for consistent error handling
  - Added structured logging via `logger` utility
- `packages/server/src/modules/tasks/schema.ts` — Added:
  - `assignTaskSchema` — Zod schema for task assignment (requires agentId)
  - `addCommentSchema` — Zod schema for task comments (requires actorId, actorType, comment)
  - `AssignTaskInput` and `AddCommentInput` types
- `packages/server/src/modules/tasks/routes.ts` — Added:
  - `POST /api/tasks/:id/assign` — Assign task to an agent (404/409 error handling)
  - `POST /api/tasks/:id/comments` — Add comment to a task (201 on success)

## Implementation Summary

### 1. Atomic Checkout with Prisma $transaction + SELECT FOR UPDATE
The existing `checkoutTask` used a separate `findFirst` + `update` pattern which had a race condition window. The new implementation uses Prisma's interactive transactions (`$transaction`) with raw SQL `SELECT ... FOR UPDATE`:

```ts
const result = await prisma.$transaction(async (tx) => {
  // Lock the task row
  const [lockedRow] = await tx.$queryRaw`
    SELECT t.id, t.status, t."lockedAt", t."assigneeId", gp."companyId"
    FROM "Task" t
    JOIN "Goal" g ON g.id = t."goalId"
    JOIN "Project" gp ON gp.id = g."projectId"
    WHERE t.id = ${id} AND gp."companyId" = ${companyId}
    FOR UPDATE OF t
  `;
  // ... verify and update within transaction
});
```

This ensures that concurrent checkout attempts are serialized at the database level. The first transaction to acquire the row lock proceeds; subsequent attempts see the committed lock state.

### 2. Activity Recording Utility
Created a reusable `recordActivity()` utility that:
- Accepts structured input (companyId, actorType, actorId, action, targetType, targetId, metadata)
- Creates ActivityEvent records for audit logging
- Never throws (fire-and-forget) — logs errors but returns null on failure
- Uses `ActivityActions` constants to prevent typos

### 3. Task Assignment Endpoint
`POST /api/tasks/:id/assign` allows setting the assigneeId without locking the task. Validates that both the task and agent exist within the same company. Returns 409 if already assigned to the same agent.

### 4. Task Comment Endpoint
`POST /api/tasks/:id/comments` stores comments as ActivityEvent records with `action: 'TASK_COMMENT'` and the comment text in the metadata field. Supports USER, AGENT, and SYSTEM actor types.

## Tests Added or Updated
- **New**: `packages/server/src/modules/tasks/__tests__/service.test.ts` — 23 tests:
  - Atomic checkout: unlocked task, not found, already locked, idempotent re-checkout
  - Concurrent checkout: race condition simulation, $transaction usage, SELECT FOR UPDATE verification
  - Release: successful release, not found, not assigned, release without updates, transaction usage
  - Assignment: valid assignment, not found, agent not found, already assigned
  - Comments: add comment, not found, USER actorType
  - Schema validation: checkoutTaskSchema, assignTaskSchema, addCommentSchema
- **New**: `packages/server/src/utils/__tests__/activity.test.ts` — 7 tests:
  - recordActivity success, failure (does not throw), without metadata
  - ActivityActions constants: task, agent, heartbeat, approval actions

## Test Commands Run
```bash
cd packages/server && pnpm run test
# Result: 92 tests passed (6 test files)
# - rpc-routes.test.ts: 10 passed
# - heartbeat/service.test.ts: 13 passed
# - heartbeat/schema.test.ts: 19 passed
# - opencode.test.ts: 20 passed
# - tasks/service.test.ts: 23 passed
# - activity.test.ts: 7 passed
```

## Test Results
All 92 tests pass across 6 test files. No regressions in existing tests.

## Commit Notes
Suggested commit message:
```
feat(server): implement atomic task checkout with Prisma transactions (STORY-008)

- Rewrite checkoutTask/releaseTask to use $transaction + SELECT FOR UPDATE
- Add activity recording utility (utils/activity.ts) for audit logging
- Add POST /api/tasks/:id/assign endpoint for task assignment
- Add POST /api/tasks/:id/comments endpoint for task comments
- Add assignTaskSchema and addCommentSchema Zod validators
- Record activity events for all task lifecycle actions
- Add 30 new tests (23 task service + 7 activity utility)
- All 92 tests pass
```

## Risks / Limitations
1. **Raw SQL dependency**: The `SELECT ... FOR UPDATE` uses `$queryRaw` with template literals. This is PostgreSQL-specific and won't work with SQLite (used in some test environments). The tests mock this via `mockQueryRaw`.
2. **Activity recording outside transaction**: Activity events are recorded after the transaction commits (fire-and-forget). If the activity recording fails, the task state change still persists. This is intentional to avoid slowing down the critical path.
3. **No Comment model**: Comments are stored as ActivityEvent records. If a dedicated Comment model is needed later, a migration will be required.
4. **Mock-based concurrency testing**: The concurrent checkout tests simulate race conditions via mock return values. True concurrent testing requires a real PostgreSQL database and multiple async connections.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
