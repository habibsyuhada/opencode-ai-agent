# STORY-008 — OpenCode Process Adapter Foundation
Status: Ready

## Requirement IDs
- FR-006 [OpenCode Adapter]
- AC-003

## Acceptance Criteria IDs
- AC-003: The OpenCode adapter successfully spawns a process, executes a task, and logs the result.

## Business Context
The core of our platform relies on executing the OpenCode CLI to perform AI tasks. We need a reliable way to spawn and manage these external processes from our Node.js server.

## Technical Context
Building a utility class/function in the `server` package to spawn the `opencode` binary using Node's `child_process`.

## Scope
- Create `OpenCodeAdapter` class in `packages/server/src/engine/opencode.ts`.
- Implement a method to `spawn` the process with given arguments (e.g., prompt, workspace path).
- Capture `stdout` and `stderr`.
- Handle process exit codes and basic timeout management.

## Out of Scope
- Parsing complex cost or token data from the output.
- Integrating this with the database (Heartbeat engine).

## Files Likely Affected
- `/packages/server/src/engine/opencode.ts` (new)

## Implementation Notes
- Use `spawn` instead of `exec` to handle potentially large streams of output and to better manage the process lifecycle.
- Consider creating a mock `opencode` script for testing purposes if the real binary is slow or unavailable in CI.

## Test Requirements
- Unit tests verify that the adapter can execute a simple command (e.g., `opencode --version` or a mock command) and return the output.

## Edge Cases
- Command not found errors.
- Process hanging indefinitely (needs timeout).

## Dependencies
- STORY-003 (Initial Server Package Setup)

## Definition of Done
- [ ] Story context reviewed by Developer
- [ ] Code implemented
- [ ] Tests written
- [ ] Tests pass locally
- [ ] Dev notes created
- [ ] Scrum Master completion review passed
- [ ] QA review passed
- [ ] Story closed
