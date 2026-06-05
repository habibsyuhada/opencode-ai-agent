# BLOCKER — STORY-007

## Story ID
STORY-007

## Date
2026-06-04

## Blocker Summary
Cannot proceed with STORY-007 implementation due to two critical discrepancies.

## Blocker Details

### 1. STORY-007 is NOT in the Developer Queue
The file `docs/queue/dev-queue.md` currently only contains:
```
- [ ] `docs/stories/STORY-007.md` — NOT listed
```
Only `STORY-002` is queued as "In Progress." Per workflow rules, the Developer must not work on unqueued stories.

### 2. Story Content vs. Requested Implementation Mismatch
- **Actual STORY-007.md content:** "Hono RPC API Setup and Core Routes" — about setting up Hono RPC client/server structure with GET/POST routes for `/api/agents` and `/api/tasks`, exporting `AppType`, and setting up `hc` (Hono Client) in `packages/ui`.
- **Requested implementation:** "CLI Enhancements" — creating CLI commands (`onboard`, `dev`, `configure`, `install`, `migrate`, `status`, `company`, `agent`, `task`, `doctor`), installing `commander`/`inquirer`/`chalk`, wiring up the bin entry in `packages/cli/package.json`.

These are entirely different scopes of work.

## Resolution Required
1. **Scrum Master** must add STORY-007 (or the correct story) to `docs/queue/dev-queue.md` before development can begin.
2. **Product Owner / Scrum Master** must clarify whether:
   - STORY-007.md should be rewritten to describe CLI Enhancements, OR
   - A new story (e.g., STORY-0XX) should be created for CLI Enhancements, and STORY-007 should remain as Hono RPC API work.
3. The story file content must match the intended implementation before coding proceeds.

## Status
BLOCKED
