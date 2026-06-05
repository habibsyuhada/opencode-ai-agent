# Dev Notes
Story ID: STORY-019

## Story Context Reviewed
- **Story**: Real-time Heartbeat Logs UI
- **Requirement**: FR-010 (Dashboard UI), AC-004
- **Goal**: Stream OpenCode CLI stdout/stderr to the UI in real-time via SSE, similar to watching a CI/CD pipeline
- **Dependencies**: STORY-009 (Heartbeat Engine), STORY-013 (Dashboard UI)

## Files Changed

### New Files
1. `packages/server/src/modules/heartbeat/log-emitter.ts` — HeartbeatLogEmitter singleton (EventEmitter-based pub/sub for log streaming)
2. `packages/ui/src/hooks/useHeartbeatLogs.ts` — SSE hook for connection management with reconnect logic
3. `packages/ui/src/components/HeartbeatLogs.tsx` — Terminal-style log viewer component
4. `packages/server/src/modules/heartbeat/__tests__/log-emitter.test.ts` — 20 tests for log emitter
5. `docs/dev-notes/DEV-NOTES-STORY-019.md` — This file

### Modified Files
1. `packages/server/src/adapters/base.ts` — Added `onLogChunk` callback to `AdapterRunConfig` interface
2. `packages/server/src/adapters/opencode.ts` — Updated `executeOpenCode` to call `onLogChunk` on stdout/stderr data
3. `packages/server/src/modules/heartbeat/service.ts` — Wired log emitter to adapter; emit status events at key points
4. `packages/server/src/modules/heartbeat/routes.ts` — Added `GET /api/heartbeats/:id/logs` SSE endpoint
5. `packages/ui/src/pages/HeartbeatsPage.tsx` — Replaced static log display with HeartbeatLogs component
6. `packages/server/src/adapters/__tests__/opencode.test.ts` — Added 2 tests for log callback
7. `packages/ui/src/test/components.test.tsx` — Added 10 tests for HeartbeatLogs component

## Implementation Summary

### Architecture
The implementation follows a three-layer pattern:

```
OpenCodeAdapter (stdout/stderr data)
    ↓ onLogChunk callback
HeartbeatLogEmitter (EventEmitter singleton)
    ↓ pub/sub per heartbeatId
SSE Endpoint (GET /api/heartbeats/:id/logs)
    ↓ Server-Sent Events
useHeartbeatLogs hook → HeartbeatLogs component
```

### Server-Side (3 files changed, 1 new)
1. **HeartbeatLogEmitter** (`log-emitter.ts`): Singleton EventEmitter that manages per-heartbeat log channels. Features:
   - Per-heartbeat log chunk buffering (max 1000 chunks) for replay to late-connecting SSE clients
   - `emitLog(heartbeatId, stream, data)` — publish stdout/stderr chunks
   - `emitStatus(heartbeatId, status, finalOutput)` — publish execution status changes
   - `onLog()` / `onStatus()` — subscribe with unsubscribe functions
   - `cleanup(heartbeatId)` — free buffer and listeners after completion (auto after 5 min)
   - Active heartbeat tracking via `isActive()` / `getActiveCount()`

2. **Adapter Changes** (`base.ts`, `opencode.ts`): Added `onLogChunk?: (stream, data) => void` to `AdapterRunConfig`. The OpenCodeAdapter calls this callback on every stdout/stderr data event during process execution.

3. **Service Wiring** (`service.ts`): The `executeHeartbeat` function passes the emitter's `emitLog` as the callback, and emits status events at key lifecycle points (started, completed, failed).

4. **SSE Endpoint** (`routes.ts`): `GET /api/heartbeats/:id/logs` using Hono's `streamSSE`. Behavior:
   - Verifies heartbeat exists and belongs to company (multi-tenant isolation)
   - Replays buffered log chunks on connection
   - Streams new log chunks in real-time
   - Emits `log`, `status`, and `ping` (keep-alive every 15s) SSE event types
   - Auto-closes stream on terminal status (completed/failed/timeout)
   - Cleans up subscriptions on client disconnect

### Client-Side (1 new hook, 1 new component, 1 modified page)
1. **useHeartbeatLogs** (`useHeartbeatLogs.ts`): Custom React hook managing EventSource connection:
   - Auto-connects on mount, disconnects on unmount
   - Exponential backoff reconnect (1s → 30s, max 10 attempts)
   - Connection status tracking: connecting / connected / disconnected / completed / error
   - Log entry buffering with configurable max (default 500)
   - Handles `log`, `status`, and `ping` SSE event types
   - Returns: `{ entries, status, isFinished, finalStatus, reconnect, disconnect, clearLogs }`

2. **HeartbeatLogs** (`HeartbeatLogs.tsx`): Terminal-style log viewer:
   - Dark terminal UI with monospace font
   - Stdout (gray), stderr (red), status (cyan), system (yellow) color coding
   - Auto-scroll with pause/resume toggle
   - Connection status badge with animated indicators
   - Reconnect button on disconnect/error
   - Clear logs button
   - Entry count footer with auto-scroll indicator

3. **HeartbeatsPage.tsx**: Replaced static `<pre>` log display with `<HeartbeatLogs>` component in the HeartbeatDetail panel.

## Tests Added or Updated

### Server Tests (22 new tests)
- `packages/server/src/modules/heartbeat/__tests__/log-emitter.test.ts` — 20 tests:
  - Log emission: stdout/stderr chunks, separate buffers, no cross-contamination, buffer size limit
  - Status emission: started/completed/failed/timeout, finalOutput, active tracking
  - Buffer replay for late subscribers
  - Cleanup: removes buffers and listeners, isolates heartbeats
  - Unsubscribe: stops receiving events after unsub

- `packages/server/src/adapters/__tests__/opencode.test.ts` — 2 new tests:
  - onLogChunk callback acceptance in config
  - Default undefined onLogChunk

### UI Tests (10 new tests)
- `packages/ui/src/test/components.test.tsx` — 10 tests:
  - Component rendering: terminal header, body, waiting message
  - Connection status badge: disconnected (disabled), connecting (enabled)
  - Controls: auto-scroll toggle, clear logs button
  - Footer: line count, auto-scrolling indicator

## Test Commands Run
```bash
# Server log emitter tests
cd packages/server && node_modules\.bin\vitest.CMD run src/modules/heartbeat/__tests__/log-emitter.test.ts --reporter verbose
# Result: 20 passed

# Server adapter tests
cd packages/server && node_modules\.bin\vitest.CMD run src/adapters/__tests__/opencode.test.ts --reporter verbose
# Result: 22 passed

# UI component tests
cd packages/ui && node_modules\.bin\vitest.CMD run src/test/components.test.tsx --reporter verbose
# Result: 154 passed
```

## Test Results
All tests pass:
- Server log emitter: **20/20 passed**
- Server adapter: **22/22 passed**
- UI components: **154/154 passed** (includes 10 new HeartbeatLogs tests)

## Commit Notes
Suggested commit message:
```
feat(heartbeat): add real-time log streaming via SSE (STORY-019)

- Add HeartbeatLogEmitter singleton for pub/sub log streaming per heartbeat
- Add onLogChunk callback to AdapterRunConfig for stdout/stderr streaming
- Wire OpenCodeAdapter to emit log chunks during execution
- Add GET /api/heartbeats/:id/logs SSE endpoint with buffer replay
- Add useHeartbeatLogs hook with reconnect and exponential backoff
- Add HeartbeatLogs terminal-style component with auto-scroll
- Replace static log display in HeartbeatsPage with live streaming
- Add 32 tests across server and UI packages
```

## Risks / Limitations
1. **Memory**: Log buffers are limited to 1000 chunks per heartbeat with auto-cleanup after 5 minutes. Long-running executions may lose early log lines.
2. **EventSource browser support**: SSE via EventSource is supported in all modern browsers but not in IE11. Not a concern for this project.
3. **Single-server**: The EventEmitter-based approach works for single-server deployments. Multi-server would need Redis pub/sub or similar.
4. **No persistent log storage**: The SSE stream is ephemeral. If a user disconnects and reconnects after the buffer is cleaned up, they'll only see the final status. The final output is still stored in the `heartbeat.log` database field.

## Ready for Scrum Master Review?
Status: READY_FOR_SM_REVIEW
