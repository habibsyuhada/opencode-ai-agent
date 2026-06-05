# STORY-019 — Real-time Heartbeat Logs UI
Status: Ready

## Requirement IDs
- FR-010 [Dashboard UI]

## Acceptance Criteria IDs
- AC-004

## Business Context
When an agent is executing a task, users want to see what it is doing in real-time, similar to watching a CI/CD pipeline run.

## Technical Context
Streaming the output from the OpenCode Adapter to the UI.

## Scope
- Update the Hono server to support Server-Sent Events (SSE) or WebSockets for streaming heartbeat logs.
- Update the `OpenCodeAdapter` to emit log chunks as they arrive.
- Create a `HeartbeatLogs` component in the UI to display the streaming output.

## Out of Scope
- Persistent long-term storage of every single log line if it exceeds DB capacity (store a summary or rely on file logs).

## Files Likely Affected
- `/packages/server/src/routes/heartbeats.ts` (new/updated)
- `/packages/ui/src/components/HeartbeatLogs.tsx` (new)

## Implementation Notes
- SSE is usually easier to implement than WebSockets for simple one-way streaming of text.

## Test Requirements
- While a task is `IN_PROGRESS`, opening the task details in the UI shows the live terminal output from the OpenCode process.

## Edge Cases
- Connection drops during streaming.

## Dependencies
- STORY-009 (Task Atomic Checkout & Heartbeat Loop)
- STORY-011 (Dashboard UI: Task Kanban)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
