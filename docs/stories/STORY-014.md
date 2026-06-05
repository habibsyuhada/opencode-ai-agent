# STORY-014 — Governance: Approval Workflows
Status: Ready

## Requirement IDs
- FR-009 [Governance]

## Acceptance Criteria IDs
- N/A (General feature requirement)

## Business Context
Some actions performed by AI agents (like deploying code, or exceeding a soft budget limit) are too critical to happen autonomously. They require human approval.

## Technical Context
Implementing the Approval data model and the logic to pause execution and wait for human input.

## Scope
- Update `schema.prisma` with the `Approval` model.
- Create API routes to list pending approvals and submit a decision (`approve`/`reject`).
- Update the `HeartbeatEngine` or related logic to support a state where a task is `PAUSED_FOR_APPROVAL`.

## Out of Scope
- Implementing specific triggers for every possible approval type. (Just build the mechanism and one example trigger, like a manual task pause).

## Files Likely Affected
- `/packages/server/prisma/schema.prisma`
- `/packages/server/src/routes/approvals.ts` (new)
- `/packages/server/src/engine/heartbeat.ts`

## Implementation Notes
- This requires careful state management. If an agent hits an approval gate, its current heartbeat must end or pause, and the system must know how to resume it once approved.

## Test Requirements
- Creating an approval record pauses a task; submitting an approve decision allows the task to be picked up again by the heartbeat loop.

## Edge Cases
- Approvals sitting indefinitely (might need a timeout/auto-reject).

## Dependencies
- STORY-009 (Task Atomic Checkout)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
