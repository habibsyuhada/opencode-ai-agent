# Bug Report
Story ID: STORY-019
Status: CLOSED (FIXED)

## Summary
The `useHeartbeatLogs` hook has a stale closure bug where the `isFinished` state variable is captured in the `connect` function's closure. When the SSE stream delivers a terminal status event (completed/failed/timeout) and the server subsequently closes the connection, the `onerror` handler reads the stale `isFinished` value (`false` from when `connect` was created) instead of the current value (`true`). This triggers an unnecessary reconnect cycle, causing visible UX flicker: `completed → disconnected → connecting → completed`.

## Steps to Reproduce
1. Trigger a heartbeat execution for an agent (any task)
2. Open the HeartbeatsPage and click on the running heartbeat to view details
3. The HeartbeatLogs component connects to `GET /api/heartbeats/:id/logs` via SSE
4. Observe logs streaming in real-time (works correctly)
5. Wait for the execution to complete
6. The server sends a `status` event with `status: 'completed'` and closes the SSE stream
7. **Observe**: The connection status badge briefly shows "Complete" (green), then flickers to "Disconnected" (gray), then to "Connecting" (yellow), then back to "Complete" (green)

## Expected Result
When the server sends a terminal status event and closes the SSE connection:
1. The `status` event is received and processed
2. `isFinished` is set to `true`, `finalStatus` is set to the terminal status
3. Connection status shows "Complete"
4. When the connection closes (server-side), the `onerror` handler should detect `isFinished === true` and set status to "completed" without reconnecting
5. No flicker or unnecessary reconnection

## Actual Result
When the server sends a terminal status event and closes the SSE connection:
1. The `status` event is received and processed — `setIsFinished(true)` is called
2. Connection status shows "Complete"
3. When the connection closes, the `onerror` handler fires
4. The `onerror` handler reads `isFinished` from its closure — which is `false` (captured when `connect` was created, before `isFinished` changed)
5. The handler falls through to the reconnect logic
6. Status flickers to "Disconnected", then "Connecting"
7. The reconnect creates a new EventSource
8. The server sees the heartbeat is already COMPLETED, sends terminal status, closes connection
9. Status returns to "Complete"

## Evidence

### Root Cause Analysis

**File:** `packages/ui/src/hooks/useHeartbeatLogs.ts`

The `connect` function (line 149) is created via `useCallback` with `isFinished` in its dependency array (line 248):

```typescript
const connect = useCallback(() => {
    // ...
    es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        if (isFinished) {   // <-- This captures the value at connect() creation time
            setStatus('completed');
            return;
        }

        // Falls through to reconnect logic...
    };
}, [heartbeatId, enabled, baseUrl, disconnect, addEntry, isFinished]); // isFinished in deps
```

The `useEffect` that calls `connect` (line 259) only depends on `[heartbeatId, enabled]`:

```typescript
useEffect(() => {
    if (enabled && heartbeatId) {
        connect();
    }
    return () => {
        disconnect();
    };
}, [heartbeatId, enabled]); // Does NOT depend on connect or isFinished
```

When `isFinished` changes from `false` to `true`:
- `connect` is recreated (new function reference)
- But the `useEffect` does NOT re-run (its deps haven't changed)
- The EventSource created by the OLD `connect` still has the OLD `onerror` handler
- The OLD handler sees `isFinished === false` and triggers reconnect

### Code Flow Diagram
```
1. connect() called with isFinished=false
2. EventSource created, onerror captures isFinished=false
3. Status event arrives → setIsFinished(true) [NEW state, OLD closure unaffected]
4. Server closes connection → onerror fires
5. onerror checks isFinished → false (stale!) → triggers reconnect
6. Reconnect creates new EventSource
7. Server sends terminal status again → setIsFinished(true) [already true, no-op]
8. Server closes again → onerror fires → isFinished still false in old closure
   BUT: this connect was created after isFinished was set to true, so it sees true!
9. Finally: setStatus('completed'), no more reconnects
```

The flicker happens at step 5 and resolves at step 8-9.

## Severity
**Medium** — The streaming functionality works correctly during execution. The bug only manifests at the moment of completion, causing a brief but visible UX flicker. Users see the connection status cycle through completed → disconnected → connecting → completed over ~1-2 seconds. The data is not lost and the final state is correct.

## Suggested Area to Inspect

### Fix: Use a ref for `isFinished` to avoid stale closure

In `packages/ui/src/hooks/useHeartbeatLogs.ts`:

1. Add a ref alongside the state:
```typescript
const isFinishedRef = useRef(false);
```

2. Update the ref AND state together in the status event handler:
```typescript
// In the 'status' event listener:
if (statusEvent.status === 'completed' || statusEvent.status === 'failed' || statusEvent.status === 'timeout') {
    isFinishedRef.current = true;  // Ref for closure access
    setIsFinished(true);           // State for rendering
    setFinalStatus(statusEvent.status);
    setStatus('completed');
}
```

3. Use the ref in the `onerror` handler:
```typescript
es.onerror = () => {
    es.close();
    eventSourceRef.current = null;

    if (isFinishedRef.current) {  // Ref is always current
        setStatus('completed');
        return;
    }
    // ... reconnect logic
};
```

4. Remove `isFinished` from the `connect` useCallback dependency array (line 248), since the ref doesn't need the function to be recreated:
```typescript
}, [heartbeatId, enabled, baseUrl, disconnect, addEntry]); // Remove isFinished
```

5. Reset the ref in `reconnectFn`:
```typescript
const reconnectFn = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isFinishedRef.current = false;  // Reset ref
    setIsFinished(false);
    setFinalStatus(null);
    connect();
}, [connect]);
```

### Additional test to add:
```typescript
it('should not reconnect after receiving terminal status', async () => {
    // Mock EventSource that fires 'status' with completed, then onerror
    // Assert: status transitions to 'completed', NOT disconnected/connecting
});
```
