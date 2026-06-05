# QA Review
Story ID: STORY-019
Status: PASS

## Summary
STORY-019 implements real-time heartbeat log streaming via SSE. The server-side implementation (log emitter, SSE endpoint, adapter wiring) is solid and well-tested. The UI component (HeartbeatLogs) renders correctly with terminal-style styling. **Re-review after bugfix:** The stale closure bug (BUG-001) in `useHeartbeatLogs` has been correctly fixed by replacing the `isFinished` state variable in the closure with a `useRef`. The fix is minimal, targeted, and introduces no regressions. All 154 UI tests pass.

## Acceptance Criteria Check

### AC-004.1: Update the Hono server to support SSE for streaming heartbeat logs
**PASS**
- SSE endpoint at `GET /api/heartbeats/:id/logs` using Hono's `streamSSE`
- Multi-tenant isolation: verifies heartbeat belongs to company before streaming
- Buffer replay on connection for late-joining clients
- Keep-alive pings every 15 seconds
- Auto-close on terminal status (completed/failed/timeout)
- Proper cleanup on client disconnect via `stream.onAbort()`

### AC-004.2: Update the OpenCodeAdapter to emit log chunks as they arrive
**PASS**
- `onLogChunk` callback added to `AdapterRunConfig` interface in `base.ts`
- `opencode.ts` calls `config.onLogChunk('stdout', chunk)` and `config.onLogChunk('stderr', chunk)` during process execution
- `service.ts` wires `heartbeatLogEmitter.emitLog` as the callback and emits status events at lifecycle points
- Auto-cleanup of buffers after 5 minutes via `setTimeout`

### AC-004.3: Create a HeartbeatLogs component in the UI to display the streaming output
**PASS**
- HeartbeatLogs component: terminal-style dark UI, monospace font, color-coded streams
- Auto-scroll with pause/resume toggle
- Connection status badge with animated indicators
- Reconnect button on disconnect/error
- Clear logs button
- useHeartbeatLogs hook: EventSource management, exponential backoff reconnect
- HeartbeatsPage integration: replaced static log display with live component
- **BUG-001 FIXED:** No more stale closure — completion transitions smoothly without flicker

## Test Commands Run
```bash
# UI component tests (re-review)
cd packages/ui && node node_modules/vitest/vitest.mjs run --reporter verbose
# Result: 154/154 passed
```

## Test Results
All 154 UI tests pass:
- UI components: **154/154 passed** (includes 10 HeartbeatLogs tests)
- **No regressions introduced by the bugfix**

## Manual Review

### BUG-001 Fix Verification
**Status: FIXED**

The bugfix correctly addresses the stale closure issue. Verified the following changes in `packages/ui/src/hooks/useHeartbeatLogs.ts`:

1. **Ref added** (line 105): `const isFinishedRef = useRef(false)` — mutable ref alongside existing state
2. **Ref updated in status handler** (line 193): `isFinishedRef.current = true` is set BEFORE `setIsFinished(true)` (line 194) — ensures ref is always current for closures
3. **onerror reads ref** (line 214): `if (isFinishedRef.current)` instead of `if (isFinished)` — ref is always current, no stale closure
4. **isFinished removed from connect deps** (line 250): `[heartbeatId, enabled, baseUrl, disconnect, addEntry]` — `connect` is no longer unnecessarily recreated when `isFinished` changes
5. **Ref reset in reconnectFn** (line 255): `isFinishedRef.current = false` alongside `setIsFinished(false)` — clean reset for manual reconnect

**Why this fix works:**
- React refs are mutable objects whose `.current` property always reflects the latest value
- Unlike state variables, refs do NOT cause closures to capture stale values
- The `onerror` handler now always reads the current `isFinishedRef.current` value, regardless of when `connect` was called
- When the server sends a terminal status event and closes the connection, `isFinishedRef.current` is `true`, so `onerror` sets status to `'completed'` without triggering reconnect
- No more flicker: `completed → completed` (smooth)

### SSE Implementation Correctness
**Good:**
- Proper use of Hono's `streamSSE` with event types: `log`, `status`, `ping`
- Event IDs formatted as `log-{timestamp}` and `status-{timestamp}`
- `safeWrite` helper prevents writes after stream close
- Terminal status triggers stream close with 500ms delay for flush
- Already-completed heartbeats send final status immediately and close

### Connection Handling and Reconnect Logic
**Good (server-side):**
- Buffer replay on connection
- Keep-alive pings every 15 seconds
- Proper `stream.onAbort()` cleanup

**Good (client-side, post-fix):**
- `isFinishedRef.current` correctly prevents reconnect after terminal status
- Exponential backoff reconnect (1s → 30s, max 10 attempts) for genuine connection drops
- Manual reconnect resets all state cleanly

### Memory Management (Buffer Cleanup)
**Good:**
- `MAX_BUFFER_SIZE = 1000` per heartbeat
- Buffer cleanup after 5 minutes via `setTimeout` in service.ts
- Client-side: configurable `maxEntries = 500` with automatic trimming
- `cleanup()` removes buffers and all listeners

**Note:**
- Buffer stops accepting after MAX_BUFFER_SIZE (does not ring-buffer)
- Late-connecting clients see first 1000 lines, miss subsequent ones
- Documented limitation, not a bug

### Security (Multi-tenant Isolation)
**Good:**
- SSE endpoint calls `getHeartbeatById(heartbeatId, companyId)` which scopes by company
- Returns 404 if heartbeat not found or doesn't belong to company
- `companyId` extracted from Hono context (set by middleware)
- Log channels are isolated per heartbeatId (no cross-contamination)

## Edge Cases Checked
1. **Connection drops during streaming**: Server handles via `stream.onAbort()` — cleans up subscriptions and intervals. Client has exponential backoff reconnect (1s → 30s, max 10 attempts). **FIXED:** No unnecessary reconnect after normal completion — `isFinishedRef.current` is checked in `onerror`.
2. **Late-connecting SSE client**: Buffer replay sends all buffered chunks on connection. Works correctly up to 1000 chunks.
3. **Already-completed heartbeat**: SSE endpoint sends final status immediately and closes. Works correctly.
4. **Multiple SSE clients for same heartbeat**: Each gets its own subscription. Buffer replay works for each. No cross-contamination.
5. **Buffer overflow (1000+ chunks)**: Buffer stops accepting silently. Live streaming still works. Documented limitation.
6. **Terminal status → connection close (BUG-001 scenario)**: Status event sets `isFinishedRef.current = true`, then server closes connection. `onerror` reads `isFinishedRef.current === true`, sets status to `'completed'`, returns without reconnect. **No flicker.**

## Bugs Found
None. BUG-001 has been fixed.

## Regression Risk
- **Low**: The bugfix is minimal — only `packages/ui/src/hooks/useHeartbeatLogs.ts` was changed, with 4 specific edits (add ref, update ref in status handler, read ref in onerror, reset ref in reconnect).
- **No new features introduced**: The `isFinished` state variable is still used for rendering (returned to consumers); the ref is only used for the closure-sensitive `onerror` handler.
- **All 154 existing tests pass**: No regressions detected.
- **No database schema changes**: Uses existing `heartbeat.log` field for final output.

## Final Verdict
**PASS** — BUG-001 (stale `isFinished` closure) has been correctly fixed using `useRef`. The fix is minimal, targeted, and introduces no regressions. All acceptance criteria are satisfied. The connection lifecycle now works correctly: terminal status → `isFinishedRef.current = true` → server closes connection → `onerror` reads ref → status set to `'completed'` → no reconnect → no flicker.

---
Reviewed by: QA Engineer
Review date: 2026-06-05 (re-review after bugfix)
Previous review: 2026-06-05 (FAIL — BUG-001)
