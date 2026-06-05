# STORY-012 — Budget & Cost Tracking Schema and Parser
Status: Ready

## Requirement IDs
- FR-008 [Budgeting]

## Acceptance Criteria IDs
- AC-003: ...logs the result and cost to the database.

## Business Context
AI operations can get expensive quickly. We must track the cost of every task to provide visibility and prevent budget overruns.

## Technical Context
Updating the database schema for Budgets and CostEvents, and enhancing the OpenCode Adapter to parse token usage from the CLI output.

## Scope
- Update `schema.prisma` to include `Budget` and `CostEvent` models as per architecture.
- Create migration.
- Update `OpenCodeAdapter` to extract token usage/cost from the OpenCode CLI stdout/stderr (assuming it outputs a specific format, e.g., JSON log at the end).
- Update the `HeartbeatEngine` to create `CostEvent` records linked to the `Heartbeat` and `Task`.

## Out of Scope
- Actually enforcing budget limits (stopping execution).
- UI visualization of costs.

## Files Likely Affected
- `/packages/server/prisma/schema.prisma`
- `/packages/server/src/engine/opencode.ts`
- `/packages/server/src/engine/heartbeat.ts`

## Implementation Notes
- You will need to determine the exact regex or JSON parsing strategy needed to extract costs from the OpenCode binary's output.

## Test Requirements
- Running a heartbeat successfully creates a `CostEvent` record with the correct parsed values.

## Edge Cases
- OpenCode fails to output cost information (should fallback gracefully, maybe log a warning, cost = 0).

## Dependencies
- STORY-009 (Task Atomic Checkout & Heartbeat Loop)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
