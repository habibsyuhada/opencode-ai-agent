# STORY-009 — Task Atomic Checkout & Heartbeat Loop Basics
Status: Ready

## Requirement IDs
- FR-005 [Task Management]
- FR-007 [Heartbeat Engine]

## Acceptance Criteria IDs
- AC-003: ...executes a task, and logs the result and cost to the database.

## Business Context
To prevent multiple agents (or multiple server instances) from working on the same task simultaneously, we need a secure checkout mechanism. Then, we need a loop that finds these checked-out tasks and runs them.

## Technical Context
Implementing the core execution loop in the Hono server.

## Scope
- Implement `POST /api/tasks/:id/checkout` endpoint. Use Prisma to atomically update the task status to `IN_PROGRESS` and set `lockedAt`, ensuring it wasn't already locked.
- Create a basic `HeartbeatEngine` service.
- The engine should poll (or be triggered) to find `IN_PROGRESS` tasks.
- For a found task, it should create a `Heartbeat` database record.
- It should call the `OpenCodeAdapter` (from STORY-008) to execute the task.
- Upon completion, it updates the `Heartbeat` record and the `Task` status (`DONE` or `FAILED`).

## Out of Scope
- Complex retry logic.
- Cost tracking (next story).

## Files Likely Affected
- `/packages/server/src/routes/tasks.ts`
- `/packages/server/src/engine/heartbeat.ts` (new)

## Implementation Notes
- Atomic checkout in Prisma often involves a `updateMany` with a `where` clause checking the current status, and verifying if 1 row was updated.
- The Heartbeat engine can be a simple `setInterval` for now, or triggered explicitly via API.

## Test Requirements
- Concurrent checkout requests should only result in one successful checkout.
- A task goes through PENDING -> IN_PROGRESS -> DONE lifecycle when processed by the heartbeat engine.

## Edge Cases
- Handling crashes during a heartbeat (task remains locked). We will need a timeout/reaper mechanism later.

## Dependencies
- STORY-007 (Hono RPC API Setup)
- STORY-008 (OpenCode Process Adapter Foundation)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
