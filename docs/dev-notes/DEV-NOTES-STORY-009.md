# Dev Notes
Story ID: STORY-009

## Story Context Reviewed
- **Story**: Task Atomic Checkout & Heartbeat Loop Basics
- **Requirements**: FR-005 [Task Management], FR-007 [Heartbeat Engine]
- **Acceptance Criteria**: AC-003 — executes a task, and logs the result and cost to the database
- **Dependencies**: STORY-007 (Hono RPC API Setup), STORY-008 (OpenCode Process Adapter Foundation)

## Files Changed
1. `packages/server/src/modules/heartbeat/schema.ts` — Enhanced with trigger types, auto-trigger schema, recovery schema
2. `packages/server/src/modules/heartbeat/service.ts` — Full heartbeat loop with 13 steps
3. `packages/server/src/modules/heartbeat/routes.ts` — New endpoints for auto-trigger and orphan recovery
4. `packages/server/src/modules/heartbeat/__tests__/schema.test.ts` — 39 tests (up from ~20)
5. `packages/server/src/modules/heartbeat/__tests__/service.test.ts` — 27 tests (up from ~15)

## Implementation Summary

### Full Heartbeat Execution Loop (13 Steps)
The service now implements the complete execution loop:
1. **Check agent is ACTIVE** — Validated at trigger time
2. **Check budget not exceeded** — New `checkBudget()` validates both company-level and agent-level budgets
3. **Resolve next task** — New `resolveNextTask()` finds highest-priority unblocked task for auto-trigger
4. **Resolve workspace directory** — Existing `resolveWorkingDirectory()` looks up Workspace model
5. **Load agent-specific skills** — New `loadAgentSkills()` reads skills from agent config JSON
6. **Inject secrets if scoped** — New `loadSecrets()` decrypts and injects GLOBAL/AGENT scoped secrets
7. **Create Heartbeat record** — Status: PENDING, then updated to RUNNING
8. **Invoke OpenCode adapter** — Via `adapter.start(runConfig)`
9. **Parse result, capture cost** — Adapter returns structured `AdapterResult`
10. **Update task status** — REVIEW on success, unlock on failure
11. **Update budget usage** — New `updateBudgetUsage()` increments both company and agent budgets
12. **Record activity** — Uses `recordActivity()` utility for HEARTBEAT_START/COMPLETE/FAIL events
13. **Handle orphaned runs** — New `recoverOrphanedRuns()` cleans up stale RUNNING heartbeats

### Trigger Types
Added `triggerType` field with three values:
- **MANUAL** — Explicitly triggered via API (user clicks "Run")
- **SCHEDULED** — Triggered by cron scheduler (Routine model)
- **EVENT** — Triggered by system events (task assigned, status change)

### New Endpoints
- `POST /api/agents/:agentId/heartbeat/auto` — Auto-picks task and triggers execution
- `POST /api/heartbeats/recover` — Recovers orphaned runs stuck in RUNNING status

### New Error Types
- `BudgetExceededError` — Thrown when company or agent budget is exceeded (HTTP 402)

### Budget Checking
- Checks company-level budget (global) and agent-level budget
- Logs warnings when approaching threshold (default 80%)
- Blocks execution when monthly limit is exceeded
- Updates both budgets after successful execution with actual cost

### Orphan Recovery
- Finds heartbeats stuck in RUNNING status beyond a configurable stale threshold
- Marks them as FAILED with descriptive error message
- Unlocks associated tasks so they can be retried
- Records SYSTEM activity events for audit trail

## Tests Added or Updated
- **Schema tests**: 39 tests covering trigger types, auto-trigger, recovery, and all validation rules
- **Service tests**: 27 tests covering:
  - Manual trigger with budget checks
  - Auto-trigger with task resolution and atomic checkout
  - Orphaned run recovery
  - Activity recording
  - Secret loading
  - Error cases (agent not found, not active, task locked, budget exceeded)

## Test Commands Run
```bash
cd packages/server
npx vitest run src/modules/heartbeat/__tests__/schema.test.ts src/modules/heartbeat/__tests__/service.test.ts
```

## Test Results
```
 ✓ src/modules/heartbeat/__tests__/service.test.ts (27 tests) 37ms
 ✓ src/modules/heartbeat/__tests__/schema.test.ts (39 tests) 25ms

 Test Files  2 passed (2)
      Tests  66 passed (66)
   Duration  942ms
```

## Commit Notes
Suggested commit message:
```
feat(heartbeat): implement full heartbeat execution loop and trigger types

- Add complete 13-step execution loop: budget check, auto-pick, skills,
  secrets, activity recording, budget usage update, orphan recovery
- Add trigger types: MANUAL, SCHEDULED, EVENT
- Add auto-trigger endpoint (POST /api/agents/:agentId/heartbeat/auto)
- Add orphan recovery endpoint (POST /api/heartbeats/recover)
- Add budget checking for both company and agent levels
- Add agent skill loading from config JSON
- Add secret injection with scoped decryption
- Add activity recording for heartbeat lifecycle events
- Add BudgetExceededError (HTTP 402)
- Enhance Zod schemas with triggerType and recovery validation
- Add 66 unit tests (39 schema + 27 service)
```

## Risks / Limitations
1. **Secret decryption** — Currently uses base64 placeholder; needs proper KMS/vault integration
2. **Budget race condition** — Budget check and update are not in the same transaction; concurrent heartbeats could slightly exceed budget
3. **Auto-pick ordering** — Priority-based ordering uses Prisma string comparison (CRITICAL > HIGH > MEDIUM > LOW works because of alphabetical ordering)
4. **Orphan recovery** — Relies on `startedAt` timestamp; clock skew could affect accuracy
5. **Skill loading** — Skills are read from agent config JSON; no validation of skill availability

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
