/**
 * HeartbeatLogEmitter — Singleton event emitter for streaming heartbeat logs.
 *
 * Provides a pub/sub mechanism for real-time log streaming:
 * - The OpenCodeAdapter publishes stdout/stderr chunks during execution
 * - SSE endpoint subscribers receive chunks as Server-Sent Events
 * - Logs are buffered per heartbeat for replay to late-connecting clients
 *
 * Story: STORY-019 — Real-time Heartbeat Logs UI
 */

import { EventEmitter } from 'node:events';

/**
 * A single log chunk emitted during heartbeat execution.
 */
export interface LogChunk {
  /** The heartbeat ID this log belongs to */
  heartbeatId: string;

  /** The stream source: stdout or stderr */
  stream: 'stdout' | 'stderr';

  /** The text content of this chunk */
  data: string;

  /** ISO timestamp of when the chunk was received */
  timestamp: string;
}

/**
 * Connection status event emitted when a heartbeat execution state changes.
 */
export interface LogStatusEvent {
  /** The heartbeat ID */
  heartbeatId: string;

  /** The new status */
  status: 'started' | 'completed' | 'failed' | 'timeout';

  /** ISO timestamp */
  timestamp: string;

  /** Optional final output (sent with completed/failed) */
  finalOutput?: string;
}

/** Maximum number of log chunks to buffer per heartbeat for replay */
const MAX_BUFFER_SIZE = 1000;

/**
 * HeartbeatLogEmitter — manages log streaming channels per heartbeat.
 *
 * Uses Node.js EventEmitter internally. Each heartbeat gets its own
 * event channel identified by the heartbeat ID.
 *
 * Features:
 * - Per-heartbeat log chunk buffering (for replay to late subscribers)
 * - Log chunk events: `log:{heartbeatId}`
 * - Status events: `status:{heartbeatId}`
 * - Automatic cleanup of old buffers
 */
export class HeartbeatLogEmitter extends EventEmitter {
  /** Buffered log chunks per heartbeat, for replay to new subscribers */
  private buffers: Map<string, LogChunk[]> = new Map();

  /** Track active heartbeat executions */
  private activeHeartbeats: Set<string> = new Set();

  constructor() {
    super();
    // Increase max listeners to support multiple SSE subscribers per heartbeat
    this.setMaxListeners(100);
  }

  /**
   * Emit a log chunk for a heartbeat execution.
   *
   * Called by the OpenCodeAdapter when stdout/stderr data arrives.
   * The chunk is buffered and emitted to all subscribers.
   *
   * @param heartbeatId - The heartbeat ID
   * @param stream - Which stream (stdout or stderr)
   * @param data - The text data
   */
  emitLog(heartbeatId: string, stream: 'stdout' | 'stderr', data: string): void {
    const chunk: LogChunk = {
      heartbeatId,
      stream,
      data,
      timestamp: new Date().toISOString(),
    };

    // Buffer the chunk
    let buffer = this.buffers.get(heartbeatId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(heartbeatId, buffer);
    }

    if (buffer.length < MAX_BUFFER_SIZE) {
      buffer.push(chunk);
    }

    // Emit to subscribers
    this.emit(`log:${heartbeatId}`, chunk);
  }

  /**
   * Emit a status change event for a heartbeat.
   *
   * Called when execution starts, completes, fails, or times out.
   *
   * @param heartbeatId - The heartbeat ID
   * @param status - The new status
   * @param finalOutput - Optional final output (for completed/failed)
   */
  emitStatus(
    heartbeatId: string,
    status: LogStatusEvent['status'],
    finalOutput?: string
  ): void {
    const event: LogStatusEvent = {
      heartbeatId,
      status,
      timestamp: new Date().toISOString(),
      finalOutput,
    };

    if (status === 'started') {
      this.activeHeartbeats.add(heartbeatId);
    } else {
      this.activeHeartbeats.delete(heartbeatId);
    }

    this.emit(`status:${heartbeatId}`, event);
  }

  /**
   * Get the buffered log chunks for a heartbeat.
   *
   * Used by the SSE endpoint to replay past events to newly connected clients.
   *
   * @param heartbeatId - The heartbeat ID
   * @returns Array of buffered log chunks (empty if none)
   */
  getBuffer(heartbeatId: string): LogChunk[] {
    return this.buffers.get(heartbeatId) ?? [];
  }

  /**
   * Check if a heartbeat is currently executing.
   *
   * @param heartbeatId - The heartbeat ID
   * @returns true if the heartbeat is actively executing
   */
  isActive(heartbeatId: string): boolean {
    return this.activeHeartbeats.has(heartbeatId);
  }

  /**
   * Subscribe to log chunks for a heartbeat.
   *
   * @param heartbeatId - The heartbeat ID to subscribe to
   * @param onChunk - Callback invoked for each log chunk
   * @returns Unsubscribe function
   */
  onLog(heartbeatId: string, onChunk: (chunk: LogChunk) => void): () => void {
    const event = `log:${heartbeatId}`;
    this.on(event, onChunk);
    return () => {
      this.off(event, onChunk);
    };
  }

  /**
   * Subscribe to status events for a heartbeat.
   *
   * @param heartbeatId - The heartbeat ID to subscribe to
   * @param onStatus - Callback invoked on status change
   * @returns Unsubscribe function
   */
  onStatus(heartbeatId: string, onStatus: (event: LogStatusEvent) => void): () => void {
    const event = `status:${heartbeatId}`;
    this.on(event, onStatus);
    return () => {
      this.off(event, onStatus);
    };
  }

  /**
   * Clean up resources for a heartbeat.
   *
   * Removes the buffer and all listeners for this heartbeat.
   * Call this after a reasonable delay post-completion to free memory.
   *
   * @param heartbeatId - The heartbeat ID to clean up
   */
  cleanup(heartbeatId: string): void {
    this.buffers.delete(heartbeatId);
    this.activeHeartbeats.delete(heartbeatId);
    this.removeAllListeners(`log:${heartbeatId}`);
    this.removeAllListeners(`status:${heartbeatId}`);
  }

  /**
   * Get the number of active heartbeats being tracked.
   */
  getActiveCount(): number {
    return this.activeHeartbeats.size;
  }

  /**
   * Get the buffer size for a specific heartbeat.
   *
   * @param heartbeatId - The heartbeat ID
   * @returns Number of buffered chunks
   */
  getBufferSize(heartbeatId: string): number {
    return this.buffers.get(heartbeatId)?.length ?? 0;
  }
}

/**
 * Singleton instance of the HeartbeatLogEmitter.
 *
 * Used across the server for:
 * - Adapter: emitting log chunks during execution
 * - SSE route: subscribing to log streams for clients
 * - Service: emitting status transitions
 */
export const heartbeatLogEmitter = new HeartbeatLogEmitter();

export default heartbeatLogEmitter;
