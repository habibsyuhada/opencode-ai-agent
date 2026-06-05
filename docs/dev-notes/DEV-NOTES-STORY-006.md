# Dev Notes
Story ID: STORY-006 (OpenCode Adapter Implementation)

## Story Context Reviewed
- **Story file discrepancy**: `docs/stories/STORY-006.md` describes a "Prisma Seed Script" task, but the user's explicit instructions requested "OpenCode Adapter Implementation." The implementation was performed per the user's explicit direction, which aligns with FR-006 and FR-007 in the PRD.
- **Queue status**: `docs/queue/dev-queue.md` shows STORY-002 in progress; STORY-006 was not formally queued. Work was performed per explicit user instructions.
- **PRD alignment**: This implementation satisfies FR-006 (OpenCode Adapter) and FR-007 (Heartbeat Engine) from `docs/prd/prd.md`.
- **Architecture alignment**: Matches `docs/architecture/architecture.md` §4 (OpenCode Adapter), §6 (Heartbeat Engine), and §7 (API routes).

## Files Changed

### New Files
| File | Purpose |
|---|---|
| `packages/server/src/adapters/base.ts` | `AgentAdapter` interface with `start()`, `stop()`, `getStatus()`, `isAvailable()` methods |
| `packages/server/src/adapters/opencode.ts` | `OpenCodeAdapter` implementation — spawns opencode CLI, maps roles, parses output |
| `packages/server/src/modules/heartbeat/schema.ts` | Zod schemas for heartbeat request/response validation |
| `packages/server/src/modules/heartbeat/service.ts` | Core heartbeat execution loop — validates, creates records, dispatches to adapter |
| `packages/server/src/modules/heartbeat/routes.ts` | Hono REST endpoints for heartbeat trigger and status polling |
| `packages/server/src/adapters/__tests__/opencode.test.ts` | 20 unit tests for OpenCodeAdapter |
| `packages/server/src/modules/heartbeat/__tests__/schema.test.ts` | 19 unit tests for heartbeat Zod schemas |
| `packages/server/src/modules/heartbeat/__tests__/service.test.ts` | 13 unit tests for heartbeat service |
| `packages/server/vitest.config.ts` | Vitest configuration for the server package |

### Modified Files
| File | Change |
|---|---|
| `packages/server/src/index.ts` | Registered heartbeat routes (`/api/heartbeats`, `/api/agents/:agentId/heartbeat`) |
| `packages/server/package.json` | Added `vitest` to devDependencies, added `test` and `test:watch` scripts |

## Implementation Summary

### 1. AgentAdapter Interface (`adapters/base.ts`)
- Defines the `AgentAdapter` interface with `start()`, `stop()`, `getStatus()`, `isAvailable()` methods
- Includes `AdapterResult` type with tokens, cost, artifacts, and duration
- Includes `AdapterRunConfig` type for execution configuration
- Supports `AdapterStatus` enum: `idle`, `running`, `completed`, `failed`, `timeout`

### 2. OpenCodeAdapter (`adapters/opencode.ts`)
- **Process spawning**: Uses `child_process.spawn` to run the `opencode` CLI binary
- **Role mapping**: Maps 25+ database agent roles to opencode agent names (from `opencode.json` reference config)
- **Structured output**: Parses JSON output from `--output json` flag; falls back to regex text parsing
- **Token/cost tracking**: Calculates costs based on model-specific rates per 1K tokens
- **Timeout handling**: Kills process after configurable timeout (default 5 min)
- **Graceful shutdown**: SIGTERM with SIGKILL fallback after 5 seconds
- **Windows support**: Uses `shell: true` for command resolution on Windows
- **Environment injection**: Secrets injected only during active executions (NFR-004)

### 3. Heartbeat Schema (`modules/heartbeat/schema.ts`)
- `triggerHeartbeatSchema`: Validates task trigger requests (taskId required, prompt/timeout/contextFiles optional)
- `heartbeatIdParamSchema` / `agentIdParamSchema`: Path parameter validation
- `listHeartbeatsQuerySchema`: Query filters with coercion for numeric limit/offset
- Full type inference via Zod

### 4. Heartbeat Service (`modules/heartbeat/service.ts`)
- **triggerHeartbeat()**: Main entry point — validates agent/task, creates PENDING record, starts async execution
- **executeHeartbeat()**: Core loop — checks adapter, resolves workspace, runs adapter, records results
- **getHeartbeatById() / listHeartbeats()**: Query functions with company isolation
- **getHeartbeatStats()**: Aggregated stats for dashboard (total runs, success rate, tokens, cost)
- **Custom errors**: AgentNotFoundError, AgentNotActiveError, TaskNotFoundError, TaskLockedError, AdapterUnavailableError
- **Async execution**: Fire-and-forget pattern — caller gets heartbeatId immediately, polls for status

### 5. Heartbeat Routes (`modules/heartbeat/routes.ts`)
- `GET /api/heartbeats` — List with filters
- `GET /api/heartbeats/:id` — Get single heartbeat with relations
- `POST /api/agents/:agentId/heartbeat` — Trigger execution (returns 202 Accepted)
- `GET /api/agents/:agentId/heartbeat/stats` — Agent execution statistics

### 6. Route Registration (`src/index.ts`)
- Imported and mounted heartbeat routes at `/api/heartbeats` and `/api/agents/:agentId/heartbeat`
- Added `heartbeats` to the API root endpoint listing

## Tests Added or Updated

### Test Files
1. `src/adapters/__tests__/opencode.test.ts` — 20 tests
   - Constructor, status management, concurrent execution prevention
   - Agent role mapping (standard roles, unknown roles, case-insensitive)
   - Cost calculation (known models, unknown models, zero tokens)
   - Output parsing (JSON, text fallback, error detection, model extraction)
   - Agent name resolution (developer, QA, scrum-master, fallback)

2. `src/modules/heartbeat/__tests__/schema.test.ts` — 19 tests
   - Status enum validation
   - Trigger schema (required fields, full input, validation limits)
   - ID parameter validation
   - Query schema (pagination defaults, coercion, limits, filters)

3. `src/modules/heartbeat/__tests__/service.test.ts` — 13 tests
   - triggerHeartbeat (happy path, agent not found, agent inactive, task not found, task locked, custom prompt)
   - getHeartbeatById (found, not found)
   - listHeartbeats (default pagination, filters)
   - getHeartbeatStats (aggregated stats, agent not found, zero runs)

### Total: 52 tests across 3 test files

## Test Commands Run
```bash
# Type checking
node ../../node_modules/typescript/bin/tsc --noEmit
# Result: PASS (no errors)

# Unit tests
node node_modules/vitest/vitest.mjs run --config vitest.config.ts
# Result: 3 test files, 52 tests passed
```

## Test Results
- **TypeScript type check**: PASS (0 errors)
- **Vitest unit tests**: PASS (52/52 tests, 3 test files)
- **Test duration**: ~785ms total

## Commit Notes
Suggested commit message:
```
feat(server): implement OpenCode adapter and heartbeat engine

- Add AgentAdapter interface (base.ts) with start/stop/getStatus/isAvailable
- Add OpenCodeAdapter (opencode.ts) that spawns opencode CLI as child process
  with role mapping, structured output parsing, and cost tracking
- Add heartbeat module (schema, service, routes) for task execution orchestration
- Register heartbeat routes at /api/heartbeats and /api/agents/:agentId/heartbeat
- Add Vitest test framework with 52 unit tests across adapter and heartbeat modules
- Satisfies FR-006 (OpenCode Adapter) and FR-007 (Heartbeat Engine)

Refs: STORY-006, FR-006, FR-007
```

## Risks / Limitations
1. **OpenCode binary dependency**: The adapter requires `opencode` CLI to be installed and in PATH. The `isAvailable()` check handles this gracefully.
2. **Output format assumptions**: Token/cost parsing relies on either structured JSON output (`--output json`) or regex patterns in text. Format changes in opencode CLI may require parser updates.
3. **Cost rates**: Hardcoded default rates per model; actual costs vary by provider and tier. Should be made configurable via database.
4. **No real integration tests**: Tests mock the Prisma client and adapter. Integration tests with a real database and opencode binary are needed for full validation.
5. **Single execution per adapter**: The adapter supports one execution at a time. Parallel execution would require an adapter pool.
6. **Story file mismatch**: STORY-006.md content describes a Prisma seed script, not this implementation. The story file or queue should be updated.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW

All implementation files exist on disk. TypeScript compiles cleanly. All 52 unit tests pass. The implementation aligns with the PRD (FR-006, FR-007) and architecture document.
