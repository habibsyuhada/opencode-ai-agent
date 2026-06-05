/**
 * HeartbeatLogs — Real-time terminal-style log viewer.
 *
 * Displays streaming execution logs from a heartbeat run using
 * the SSE-based useHeartbeatLogs hook. Features:
 * - Terminal-like dark UI with monospace font
 * - Auto-scroll to bottom on new entries
 * - Connection status indicator (connecting/connected/disconnected/completed)
 * - Stdout/stderr color differentiation
 * - Status event highlighting
 * - Reconnect button on disconnect/error
 * - Clear logs button
 * - Pause/resume auto-scroll toggle
 *
 * Story: STORY-019 — Real-time Heartbeat Logs UI
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Terminal,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { useHeartbeatLogs, type LogConnectionStatus, type LogEntry } from '@/hooks/useHeartbeatLogs';

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

/** Connection status badge */
function ConnectionStatusBadge({ status }: { status: LogConnectionStatus }) {
  const config = {
    connecting: {
      icon: Loader2,
      label: 'Connecting',
      className: 'bg-yellow-100 text-yellow-700',
      animate: true,
    },
    connected: {
      icon: Wifi,
      label: 'Connected',
      className: 'bg-green-100 text-green-700',
      animate: false,
    },
    disconnected: {
      icon: WifiOff,
      label: 'Disconnected',
      className: 'bg-gray-100 text-gray-600',
      animate: false,
    },
    completed: {
      icon: CheckCircle,
      label: 'Complete',
      className: 'bg-blue-100 text-blue-700',
      animate: false,
    },
    error: {
      icon: XCircle,
      label: 'Error',
      className: 'bg-red-100 text-red-700',
      animate: false,
    },
  };

  const { icon: Icon, label, className, animate } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
      data-testid="log-connection-status"
    >
      <Icon size={12} className={animate ? 'animate-spin' : ''} />
      {label}
    </span>
  );
}

/** A single log line in the terminal */
function LogLine({ entry }: { entry: LogEntry }) {
  const streamColors = {
    stdout: 'text-gray-200',
    stderr: 'text-red-400',
    status: 'text-cyan-400 font-semibold',
    system: 'text-yellow-400 italic',
  };

  const timestamp = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className={`flex gap-2 text-xs font-mono leading-relaxed ${streamColors[entry.stream]}`}>
      <span className="text-gray-500 select-none shrink-0">{timestamp}</span>
      {entry.stream !== 'stdout' && (
        <span className="shrink-0 w-12 text-right opacity-70 select-none">
          [{entry.stream}]
        </span>
      )}
      <span className="whitespace-pre-wrap break-all">{entry.data}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────

export interface HeartbeatLogsProps {
  /** The heartbeat ID to stream logs for */
  heartbeatId: string;
  /** Whether to enable the SSE connection (default: true) */
  enabled?: boolean;
  /** Optional className for the container */
  className?: string;
}

export function HeartbeatLogs({ heartbeatId, enabled = true, className = '' }: HeartbeatLogsProps) {
  const { entries, status, isFinished, finalStatus, reconnect, clearLogs } =
    useHeartbeatLogs(heartbeatId, { enabled });

  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  // Detect manual scroll to pause auto-scroll
  const handleScroll = () => {
    if (!terminalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${className}`}
      data-testid="heartbeat-logs"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-gray-500" />
          <h4 className="text-sm font-semibold text-gray-900">Execution Log</h4>
          <ConnectionStatusBadge status={status} />
          {isFinished && finalStatus && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                finalStatus === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {finalStatus === 'completed' ? (
                <CheckCircle size={10} />
              ) : (
                <XCircle size={10} />
              )}
              {finalStatus}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded transition-colors ${
              autoScroll
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
            data-testid="toggle-autoscroll"
          >
            {autoScroll ? <Pause size={12} /> : <Play size={12} />}
          </button>

          {/* Reconnect button (shown on disconnect/error) */}
          {(status === 'disconnected' || status === 'error') && (
            <button
              onClick={reconnect}
              className="p-1.5 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
              title="Reconnect"
              data-testid="reconnect-button"
            >
              <RefreshCw size={12} />
            </button>
          )}

          {/* Clear logs button */}
          <button
            onClick={clearLogs}
            className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            title="Clear logs"
            data-testid="clear-logs-button"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={terminalRef}
        onScroll={handleScroll}
        className="bg-gray-900 p-4 overflow-y-auto font-mono text-xs"
        style={{ maxHeight: '400px', minHeight: '200px' }}
        data-testid="log-terminal"
      >
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            {status === 'connecting' ? (
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>Connecting to log stream...</span>
              </div>
            ) : isFinished ? (
              <span>No log output recorded.</span>
            ) : (
              <span>Waiting for execution output...</span>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.map((entry) => (
              <LogLine key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Footer with entry count */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-800 bg-gray-900">
        <span className="text-xs text-gray-500 font-mono">
          {entries.length} line{entries.length !== 1 ? 's' : ''}
        </span>
        {autoScroll && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Auto-scrolling
          </span>
        )}
      </div>
    </div>
  );
}

export default HeartbeatLogs;
