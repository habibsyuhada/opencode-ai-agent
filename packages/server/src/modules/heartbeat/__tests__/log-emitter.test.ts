/**
 * Tests for HeartbeatLogEmitter.
 *
 * Tests the log streaming pub/sub mechanism including:
 * - Log chunk emission and buffering
 * - Status event emission
 * - Subscriber management
 * - Buffer replay for late subscribers
 * - Cleanup and memory management
 *
 * Story: STORY-019 — Real-time Heartbeat Logs UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeartbeatLogEmitter, type LogChunk, type LogStatusEvent } from '../log-emitter.js';

describe('HeartbeatLogEmitter', () => {
  let emitter: HeartbeatLogEmitter;

  beforeEach(() => {
    emitter = new HeartbeatLogEmitter();
  });

  describe('emitLog', () => {
    it('should emit a log chunk to subscribers', () => {
      const received: LogChunk[] = [];
      emitter.onLog('hb-1', (chunk) => received.push(chunk));

      emitter.emitLog('hb-1', 'stdout', 'Hello, world!');

      expect(received).toHaveLength(1);
      expect(received[0].heartbeatId).toBe('hb-1');
      expect(received[0].stream).toBe('stdout');
      expect(received[0].data).toBe('Hello, world!');
      expect(received[0].timestamp).toBeTruthy();
    });

    it('should emit stderr chunks', () => {
      const received: LogChunk[] = [];
      emitter.onLog('hb-1', (chunk) => received.push(chunk));

      emitter.emitLog('hb-1', 'stderr', 'Error occurred');

      expect(received).toHaveLength(1);
      expect(received[0].stream).toBe('stderr');
      expect(received[0].data).toBe('Error occurred');
    });

    it('should buffer chunks for replay', () => {
      emitter.emitLog('hb-1', 'stdout', 'line 1');
      emitter.emitLog('hb-1', 'stdout', 'line 2');
      emitter.emitLog('hb-1', 'stderr', 'error 1');

      const buffer = emitter.getBuffer('hb-1');
      expect(buffer).toHaveLength(3);
      expect(buffer[0].data).toBe('line 1');
      expect(buffer[1].data).toBe('line 2');
      expect(buffer[2].data).toBe('error 1');
    });

    it('should maintain separate buffers per heartbeat', () => {
      emitter.emitLog('hb-1', 'stdout', 'hb1 data');
      emitter.emitLog('hb-2', 'stdout', 'hb2 data');

      expect(emitter.getBuffer('hb-1')).toHaveLength(1);
      expect(emitter.getBuffer('hb-1')[0].data).toBe('hb1 data');
      expect(emitter.getBuffer('hb-2')).toHaveLength(1);
      expect(emitter.getBuffer('hb-2')[0].data).toBe('hb2 data');
    });

    it('should not cross-contaminate heartbeat channels', () => {
      const received1: LogChunk[] = [];
      const received2: LogChunk[] = [];
      emitter.onLog('hb-1', (chunk) => received1.push(chunk));
      emitter.onLog('hb-2', (chunk) => received2.push(chunk));

      emitter.emitLog('hb-1', 'stdout', 'data for hb1');
      emitter.emitLog('hb-2', 'stdout', 'data for hb2');

      expect(received1).toHaveLength(1);
      expect(received1[0].data).toBe('data for hb1');
      expect(received2).toHaveLength(1);
      expect(received2[0].data).toBe('data for hb2');
    });

    it('should limit buffer size to MAX_BUFFER_SIZE', () => {
      // Emit more than MAX_BUFFER_SIZE (1000) chunks
      for (let i = 0; i < 1050; i++) {
        emitter.emitLog('hb-1', 'stdout', `line ${i}`);
      }

      const buffer = emitter.getBuffer('hb-1');
      expect(buffer.length).toBeLessThanOrEqual(1000);
      // Buffer stops accepting after MAX_BUFFER_SIZE, so last accepted is line 999
      expect(buffer[buffer.length - 1].data).toBe('line 999');
      // First entry is still line 0
      expect(buffer[0].data).toBe('line 0');
    });
  });

  describe('emitStatus', () => {
    it('should emit status events to subscribers', () => {
      const received: LogStatusEvent[] = [];
      emitter.onStatus('hb-1', (event) => received.push(event));

      emitter.emitStatus('hb-1', 'started');

      expect(received).toHaveLength(1);
      expect(received[0].heartbeatId).toBe('hb-1');
      expect(received[0].status).toBe('started');
      expect(received[0].timestamp).toBeTruthy();
    });

    it('should include finalOutput for completed status', () => {
      const received: LogStatusEvent[] = [];
      emitter.onStatus('hb-1', (event) => received.push(event));

      emitter.emitStatus('hb-1', 'completed', 'Task done successfully');

      expect(received).toHaveLength(1);
      expect(received[0].status).toBe('completed');
      expect(received[0].finalOutput).toBe('Task done successfully');
    });

    it('should include finalOutput for failed status', () => {
      const received: LogStatusEvent[] = [];
      emitter.onStatus('hb-1', (event) => received.push(event));

      emitter.emitStatus('hb-1', 'failed', 'Error: something broke');

      expect(received).toHaveLength(1);
      expect(received[0].status).toBe('failed');
      expect(received[0].finalOutput).toBe('Error: something broke');
    });

    it('should track active heartbeats', () => {
      expect(emitter.isActive('hb-1')).toBe(false);

      emitter.emitStatus('hb-1', 'started');
      expect(emitter.isActive('hb-1')).toBe(true);

      emitter.emitStatus('hb-1', 'completed');
      expect(emitter.isActive('hb-1')).toBe(false);
    });

    it('should track multiple active heartbeats', () => {
      emitter.emitStatus('hb-1', 'started');
      emitter.emitStatus('hb-2', 'started');

      expect(emitter.getActiveCount()).toBe(2);
      expect(emitter.isActive('hb-1')).toBe(true);
      expect(emitter.isActive('hb-2')).toBe(true);

      emitter.emitStatus('hb-1', 'completed');
      expect(emitter.getActiveCount()).toBe(1);
      expect(emitter.isActive('hb-1')).toBe(false);
      expect(emitter.isActive('hb-2')).toBe(true);
    });

    it('should mark timeout as non-active', () => {
      emitter.emitStatus('hb-1', 'started');
      expect(emitter.isActive('hb-1')).toBe(true);

      emitter.emitStatus('hb-1', 'timeout');
      expect(emitter.isActive('hb-1')).toBe(false);
    });
  });

  describe('getBuffer', () => {
    it('should return empty array for unknown heartbeat', () => {
      expect(emitter.getBuffer('unknown')).toEqual([]);
    });

    it('should return buffered chunks in order', () => {
      emitter.emitLog('hb-1', 'stdout', 'first');
      emitter.emitLog('hb-1', 'stdout', 'second');
      emitter.emitLog('hb-1', 'stdout', 'third');

      const buffer = emitter.getBuffer('hb-1');
      expect(buffer.map((c) => c.data)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('cleanup', () => {
    it('should remove buffer and listeners', () => {
      const received: LogChunk[] = [];
      emitter.onLog('hb-1', (chunk) => received.push(chunk));
      emitter.emitLog('hb-1', 'stdout', 'data');

      expect(emitter.getBuffer('hb-1')).toHaveLength(1);

      emitter.cleanup('hb-1');

      expect(emitter.getBuffer('hb-1')).toHaveLength(0);
      expect(emitter.isActive('hb-1')).toBe(false);

      // After cleanup, new events should not reach old subscribers
      emitter.emitLog('hb-1', 'stdout', 'new data');
      expect(received).toHaveLength(1); // Only the pre-cleanup event
    });

    it('should not affect other heartbeats on cleanup', () => {
      emitter.emitLog('hb-1', 'stdout', 'hb1 data');
      emitter.emitLog('hb-2', 'stdout', 'hb2 data');

      emitter.cleanup('hb-1');

      expect(emitter.getBuffer('hb-1')).toHaveLength(0);
      expect(emitter.getBuffer('hb-2')).toHaveLength(1);
    });
  });

  describe('getBufferSize', () => {
    it('should return 0 for unknown heartbeat', () => {
      expect(emitter.getBufferSize('unknown')).toBe(0);
    });

    it('should return correct buffer size', () => {
      emitter.emitLog('hb-1', 'stdout', 'a');
      emitter.emitLog('hb-1', 'stdout', 'b');
      expect(emitter.getBufferSize('hb-1')).toBe(2);
    });
  });

  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', () => {
      const received: LogChunk[] = [];
      const unsub = emitter.onLog('hb-1', (chunk) => received.push(chunk));

      emitter.emitLog('hb-1', 'stdout', 'before unsub');
      expect(received).toHaveLength(1);

      unsub();
      emitter.emitLog('hb-1', 'stdout', 'after unsub');
      expect(received).toHaveLength(1); // Should not receive new events
    });

    it('should stop receiving status events after unsubscribe', () => {
      const received: LogStatusEvent[] = [];
      const unsub = emitter.onStatus('hb-1', (event) => received.push(event));

      emitter.emitStatus('hb-1', 'started');
      expect(received).toHaveLength(1);

      unsub();
      emitter.emitStatus('hb-1', 'completed');
      expect(received).toHaveLength(1);
    });
  });
});
