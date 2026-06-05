/**
 * useHeartbeatLogs — SSE hook for real-time heartbeat log streaming.
 *
 * Manages an EventSource connection to the server's SSE endpoint
 * for streaming heartbeat execution logs in real-time.
 *
 * Features:
 * - Automatic connection on mount, disconnect on unmount
 * - Reconnect with exponential backoff on connection drops
 * - Connection status tracking (connecting, connected, disconnected, completed)
 * - Log buffering with configurable max size
 * - Auto-scroll support via scroll ref
 *
 * Story: STORY-019 — Real-time Heartbeat Logs UI
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/** Connection status for the SSE stream */
export type LogConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'completed' | 'error';

/** A single log entry displayed in the terminal */
export interface LogEntry {
  /** Unique key for React rendering */
  id: string;
  /** Stream source */
  stream: 'stdout' | 'stderr' | 'status' | 'system';
  /** The text content */
  data: string;
  /** ISO timestamp */
  timestamp: string;
}

/** Status event from the SSE stream */
export interface LogStatusEvent {
  heartbeatId: string;
  status: 'started' | 'completed' | 'failed' | 'timeout';
  timestamp: string;
  finalOutput?: string;
}

/** Options for the useHeartbeatLogs hook */
export interface UseHeartbeatLogsOptions {
  /** Maximum number of log entries to keep in memory (default: 500) */
  maxEntries?: number;
  /** Whether to auto-connect on mount (default: true) */
  enabled?: boolean;
  /** Base URL for the API (default: from env or localhost:3000) */
  baseUrl?: string;
}

/** Return value of the useHeartbeatLogs hook */
export interface UseHeartbeatLogsResult {
  /** Current log entries */
  entries: LogEntry[];
  /** Connection status */
  status: LogConnectionStatus;
  /** Whether the execution has finished (completed/failed/timeout) */
  isFinished: boolean;
  /** Final execution status if finished */
  finalStatus: string | null;
  /** Manually reconnect */
  reconnect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Clear all log entries */
  clearLogs: () => void;
}

/** Maximum reconnect delay in milliseconds */
const MAX_RECONNECT_DELAY = 30_000;

/** Initial reconnect delay in milliseconds */
const INITIAL_RECONNECT_DELAY = 1_000;

/** Maximum number of reconnect attempts */
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Hook for streaming heartbeat execution logs via SSE.
 *
 * @param heartbeatId - The heartbeat ID to stream logs for
 * @param options - Configuration options
 * @returns Log entries, connection status, and control functions
 */
export function useHeartbeatLogs(
  heartbeatId: string | null,
  options: UseHeartbeatLogsOptions = {}
): UseHeartbeatLogsResult {
  const {
    maxEntries = 500,
    enabled = true,
    baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000',
  } = options;

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<LogConnectionStatus>('disconnected');
  const [isFinished, setIsFinished] = useState(false);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryCounterRef = useRef(0);
  const isFinishedRef = useRef(false);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  // Clear logs
  const clearLogs = useCallback(() => {
    setEntries([]);
    entryCounterRef.current = 0;
  }, []);

  // Add entry helper
  const addEntry = useCallback(
    (stream: LogEntry['stream'], data: string, timestamp: string) => {
      entryCounterRef.current += 1;
      const entry: LogEntry = {
        id: `${heartbeatId}-${entryCounterRef.current}-${timestamp}`,
        stream,
        data,
        timestamp,
      };

      setEntries((prev) => {
        const next = [...prev, entry];
        // Trim to max entries
        if (next.length > maxEntries) {
          return next.slice(next.length - maxEntries);
        }
        return next;
      });
    },
    [heartbeatId, maxEntries]
  );

  // Connect function
  const connect = useCallback(() => {
    if (!heartbeatId || !enabled) return;

    // Clean up existing connection
    disconnect();

    setStatus('connecting');
    const url = `${baseUrl}/api/heartbeats/${heartbeatId}/logs`;

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      // Handle 'log' events
      es.addEventListener('log', (event) => {
        try {
          const chunk = JSON.parse(event.data) as {
            stream: 'stdout' | 'stderr';
            data: string;
            timestamp: string;
          };
          addEntry(chunk.stream, chunk.data, chunk.timestamp);
        } catch {
          // Malformed log event, ignore
        }
      });

      // Handle 'status' events
      es.addEventListener('status', (event) => {
        try {
          const statusEvent = JSON.parse(event.data) as LogStatusEvent;
          addEntry('status', `[${statusEvent.status}] ${statusEvent.finalOutput || ''}`, statusEvent.timestamp);

          if (
            statusEvent.status === 'completed' ||
            statusEvent.status === 'failed' ||
            statusEvent.status === 'timeout'
          ) {
            isFinishedRef.current = true;
            setIsFinished(true);
            setFinalStatus(statusEvent.status);
            setStatus('completed');
            // Server will close the connection shortly
          }
        } catch {
          // Malformed status event, ignore
        }
      });

      // Handle 'ping' events (keep-alive)
      es.addEventListener('ping', () => {
        // Connection is alive, no action needed
      });

      // Handle errors (triggers reconnect)
      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        if (isFinishedRef.current) {
          setStatus('completed');
          return;
        }

        // Exponential backoff reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          setStatus('disconnected');
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttemptsRef.current += 1;

          addEntry(
            'system',
            `Connection lost. Reconnecting in ${Math.round(delay / 1000)}s... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`,
            new Date().toISOString()
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setStatus('error');
          addEntry(
            'system',
            `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Click reconnect to try again.`,
            new Date().toISOString()
          );
        }
      };
    } catch {
      setStatus('error');
      addEntry('system', 'Failed to establish SSE connection.', new Date().toISOString());
    }
  }, [heartbeatId, enabled, baseUrl, disconnect, addEntry]);

  // Reconnect function (reset attempts and connect)
  const reconnectFn = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isFinishedRef.current = false;
    setIsFinished(false);
    setFinalStatus(null);
    connect();
  }, [connect]);

  // Connect on mount / when heartbeatId or enabled changes
  useEffect(() => {
    if (enabled && heartbeatId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [heartbeatId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    entries,
    status,
    isFinished,
    finalStatus,
    reconnect: reconnectFn,
    disconnect,
    clearLogs,
  };
}
