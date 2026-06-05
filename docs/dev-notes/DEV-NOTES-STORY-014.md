# Dev Notes
Story ID: STORY-014

## Story Context Reviewed
- STORY-014.md describes "Governance: Approval Workflows" — the Approval model already existed in schema.prisma and the governance module (routes, service, schema) was already implemented
- The user requested implementation of "Routines & Scheduling" which extends the existing Routine model and adds a full routines module
- Additionally, the heartbeat engine was updated to support `PAUSED_FOR_APPROVAL` state per the story's requirement: "Update the HeartbeatEngine or related logic to support a state where a task is PAUSED_FOR_APPROVAL"

## Files Changed

### Prisma Schema
- `packages/server/prisma/schema.prisma` — Extended `Routine` model with description, lastRunAt, nextRunAt, concurrencyPolicy, catchUpPolicy, maxConcurrentRuns, timeoutMs, updatedAt; added `RoutineRun` model for run history tracking; added `routineRuns` relation to `Heartbeat` model

### Server — Routines Module (NEW)
- `packages/server/src/modules/routines/schema.ts` — Zod schemas for Routine CRUD, trigger, run listing, concurrency/catch-up policy enums
- `packages/server/src/modules/routines/service.ts` — Full service with CRUD, manual trigger, scheduled execution (executeDueRoutines), concurrency policy enforcement (ALLOW_OVERLAP, SKIP_IF_RUNNING, QUEUE), catch-up policy (SKIP, RUN_ONCE, RUN_ALL), run history, cron next-run computation
- `packages/server/src/modules/routines/routes.ts` — Hono REST endpoints: GET/POST/PATCH/DELETE /api/routines, POST /:id/trigger, GET /:id/runs, GET /:id/stats

### Server — Heartbeat Integration
- `packages/server/src/modules/heartbeat/schema.ts` — Added `PAUSED_FOR_APPROVAL` to heartbeat status enum
- `packages/server/src/modules/heartbeat/service.ts` — Added `checkPendingApproval()` to gate execution when a task has a pending approval; added `resumeHeartbeatForApproval()` to resume/fail heartbeats when approvals are decided

### Server — Governance Integration
- `packages/server/src/modules/governance/service.ts` — Updated `decideApproval()` to call `resumeHeartbeatForApproval()` when an approval for a TASK is decided

### Server — Route Registration
- `packages/server/src/index.ts` — Registered routines routes at `/api/routines`; added to endpoints listing

### Server — Activity Actions
- `packages/server/src/utils/activity.ts` — Added ROUTINE target type and ROUTINE_CREATE, ROUTINE_UPDATE, ROUTINE_DELETE, ROUTINE_RUN, ROUTINE_RUN_COMPLETE, ROUTINE_RUN_FAIL, ROUTINE_RUN_SKIP actions

### UI — Routines
- `packages/ui/src/hooks/useRoutines.ts` — TanStack Query hooks: useRoutines, useRoutine, useRoutineRuns, useRoutineStats, useCreateRoutine, useUpdateRoutine, useDeleteRoutine, useTriggerRoutine
- `packages/ui/src/pages/RoutinesPage.tsx` — Full page with routine list table, create form (cron, action, concurrency/catch-up policies), detail view with run history, manual trigger, enable/disable toggle

### UI — Governance
- `packages/ui/src/pages/GovernancePage.tsx` — Full page with approval stats dashboard, approval list with filter tabs (pending/approved/rejected), approve/reject actions, detail modal with decision reason

### Tests
- `packages/server/src/modules/routines/__tests__/service.test.ts` — 28 tests covering CRUD, trigger with concurrency policies, statistics, cron utilities, and schema validation

## Implementation Summary

### Routines & Scheduling
- Routines are scheduled jobs that execute on a cron schedule
- Each routine has a configurable action (heartbeat:<taskId> for agent execution, or system:<action> for system tasks)
- Three concurrency policies: ALLOW_OVERLAP (unbounded), SKIP_IF_RUNNING (dedup), QUEUE (bounded by maxConcurrentRuns)
- Three catch-up policies: SKIP (ignore missed), RUN_ONCE (catch up once), RUN_ALL (replay all missed)
- Each execution creates a RoutineRun record linked to the routine and optionally to a Heartbeat
- Run history is fully queryable with status filters

### Approval-Heartbeat Integration (PAUSED_FOR_APPROVAL)
- When a heartbeat is triggered for a task that has a PENDING approval, the heartbeat is created in PAUSED_FOR_APPROVAL state instead of executing
- When an approval is decided (APPROVED), paused heartbeats are resumed back to PENDING for the engine to pick up
- When an approval is REJECTED, paused heartbeats are marked as FAILED and the task is unlocked
- The integration is in the heartbeat service's `triggerHeartbeat()` function and the governance service's `decideApproval()` function

## Tests Added or Updated
- `packages/server/src/modules/routines/__tests__/service.test.ts` — 28 new tests

## Test Commands Run
```
node vitest.mjs run "packages/server/src/modules/routines/__tests__/service.test.ts"
```

## Test Results
```
Test Files  1 passed (1)
Tests       28 passed (28)
```

All 7 server module test files pass (166 total tests):
```
Test Files  7 passed (7)
Tests       166 passed (166)
```

## Commit Notes
Suggested commit message:
```
feat(STORY-014): implement routines & scheduling + approval-heartbeat integration

- Add full Routines module with CRUD, cron scheduling, concurrency policies
- Add RoutineRun model for execution history tracking
- Add PAUSED_FOR_APPROVAL heartbeat state for approval gate integration
- Implement checkPendingApproval() in heartbeat engine
- Implement resumeHeartbeatForApproval() for approval decision handling
- Add Routines UI with list, create form, detail, run history
- Add Governance UI with approval stats, filters, decision actions
- Add 28 tests for routines service (166 total across all modules)
```

## Risks / Limitations
- Cron next-run computation is simplified — production should use a proper cron parser library (e.g., cron-parser)
- The `executeDueRoutines()` function needs a scheduler/timer to call it periodically (not yet wired to a cron daemon)
- The heartbeat-to-approval link uses log text matching (`contains: approvalId`) — a dedicated relation field would be more robust
- Catch-up missed run counting is a heuristic — proper cron interval calculation needed for RUN_ALL

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
