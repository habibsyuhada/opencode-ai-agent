# Bugfix Notes
Story ID: STORY-019
Bug report: BUG-001 — Stale `isFinished` closure in `useHeartbeatLogs` hook causes unnecessary reconnect after completion

## Root Cause
The `connect` function (created via `useCallback`) captured `isFinished` (a React state variable) in its closure. When the SSE stream delivered a terminal status event (`completed`/`failed`/`timeout`) and the server closed the connection, the `onerror` handler read a stale `isFinished` value (`false`) from the closure — the value at the time `connect` was created, not the current value after `setIsFinished(true)` was called.

**Why this happened:**
1. `connect()` is called with `isFinished=false` captured in its closure
2. EventSource is created; `onerror` captures `isFinished=false`
3. Status event arrives → `setIsFinished(true)` (updates state, but old closure is unaffected)
4. Server closes connection → `onerror` fires
5. `onerror` checks `isFinished` → `false` (stale!) → triggers unnecessary reconnect
6. Result: visible UX flicker — `completed → disconnected → connecting → completed`

## Fix Summary
Replaced the `isFinished` state variable reference in the `connect` function's closure with a `useRef` (`isFinishedRef`). Refs are mutable objects whose `.current` property always reflects the latest value, regardless of which closure reads them. This ensures the `onerror` handler always sees the current value of `isFinished`.

**Changes made:**
1. Added `const isFinishedRef = useRef(false)` alongside existing refs
2. Updated the ref in the `status` event handler: `isFinishedRef.current = true` (before `setIsFinished(true)`)
3. Changed `onerror` handler to read `isFinishedRef.current` instead of `isFinished`
4. Removed `isFinished` from the `connect` useCallback dependency array (no longer needed since the ref doesn't trigger re-creation)
5. Reset `isFinishedRef.current = false` in the `reconnectFn` callback (alongside `setIsFinished(false)`)

## Files Changed
1. `packages/ui/src/hooks/useHeartbeatLogs.ts` — Fixed stale closure by using `useRef` for `isFinished`

## Tests Added or Updated
No new tests were added. The existing 154 UI tests in `src/test/components.test.tsx` were run to verify no regressions. The stale closure issue is a runtime race condition that is difficult to reproduce in jsdom without a mock EventSource, so the fix is validated through code review and existing test coverage.

## Test Commands Run
```bash
cd packages/ui && node node_modules\vitest\vitest.mjs run --reporter verbose
# Result: 154 passed
```

## Test Results
All 154 UI tests pass:
- **154/154 passed** (no regressions)

## Ready for QA Recheck?
Status: READY_FOR_QA_RECHECK

The fix is minimal and targeted: only `packages/ui/src/hooks/useHeartbeatLogs.ts` was changed, with 4 specific edits (add ref, update ref in status handler, read ref in onerror, reset ref in reconnect). The `isFinished` state variable is still used for rendering (returned to consumers); the ref is only used for the closure-sensitive `onerror` handler. No new features were added. All existing tests pass.
