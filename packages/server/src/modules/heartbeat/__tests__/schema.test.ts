/**
 * Tests for Heartbeat Zod schemas.
 *
 * Validates the request/response schemas for heartbeat endpoints.
 *
 * STORY-009: Added tests for trigger types, auto-trigger, and recovery schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  heartbeatStatusSchema,
  triggerTypeSchema,
  triggerHeartbeatSchema,
  autoTriggerHeartbeatSchema,
  heartbeatIdParamSchema,
  agentIdParamSchema,
  listHeartbeatsQuerySchema,
  recoverOrphansSchema,
} from '../schema.js';

describe('Heartbeat Schemas', () => {
  // ── Status Schema ───────────────────────────────────────────────

  describe('heartbeatStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(heartbeatStatusSchema.parse('PENDING')).toBe('PENDING');
      expect(heartbeatStatusSchema.parse('RUNNING')).toBe('RUNNING');
      expect(heartbeatStatusSchema.parse('COMPLETED')).toBe('COMPLETED');
      expect(heartbeatStatusSchema.parse('FAILED')).toBe('FAILED');
    });

    it('should reject invalid statuses', () => {
      expect(() => heartbeatStatusSchema.parse('INVALID')).toThrow();
      expect(() => heartbeatStatusSchema.parse('')).toThrow();
      expect(() => heartbeatStatusSchema.parse('pending')).toThrow(); // case-sensitive
    });
  });

  // ── Trigger Type Schema ─────────────────────────────────────────

  describe('triggerTypeSchema', () => {
    it('should accept valid trigger types', () => {
      expect(triggerTypeSchema.parse('MANUAL')).toBe('MANUAL');
      expect(triggerTypeSchema.parse('SCHEDULED')).toBe('SCHEDULED');
      expect(triggerTypeSchema.parse('EVENT')).toBe('EVENT');
    });

    it('should reject invalid trigger types', () => {
      expect(() => triggerTypeSchema.parse('INVALID')).toThrow();
      expect(() => triggerTypeSchema.parse('')).toThrow();
      expect(() => triggerTypeSchema.parse('manual')).toThrow(); // case-sensitive
      expect(() => triggerTypeSchema.parse('cron')).toThrow();
    });
  });

  // ── Trigger Heartbeat Schema ────────────────────────────────────

  describe('triggerHeartbeatSchema', () => {
    it('should accept valid trigger input with required fields only', () => {
      const result = triggerHeartbeatSchema.parse({ taskId: 'task-123' });
      expect(result.taskId).toBe('task-123');
      expect(result.prompt).toBeUndefined();
      expect(result.timeoutMs).toBeUndefined();
      expect(result.contextFiles).toBeUndefined();
      expect(result.triggerType).toBe('MANUAL'); // default
    });

    it('should accept full trigger input', () => {
      const input = {
        taskId: 'task-123',
        prompt: 'Custom prompt',
        timeoutMs: 60000,
        contextFiles: ['README.md', 'docs/architecture.md'],
        triggerType: 'EVENT',
      };
      const result = triggerHeartbeatSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('should default triggerType to MANUAL', () => {
      const result = triggerHeartbeatSchema.parse({ taskId: 'task-123' });
      expect(result.triggerType).toBe('MANUAL');
    });

    it('should accept all valid trigger types', () => {
      expect(
        triggerHeartbeatSchema.parse({ taskId: 'task-123', triggerType: 'MANUAL' }).triggerType
      ).toBe('MANUAL');
      expect(
        triggerHeartbeatSchema.parse({ taskId: 'task-123', triggerType: 'SCHEDULED' }).triggerType
      ).toBe('SCHEDULED');
      expect(
        triggerHeartbeatSchema.parse({ taskId: 'task-123', triggerType: 'EVENT' }).triggerType
      ).toBe('EVENT');
    });

    it('should reject empty taskId', () => {
      expect(() => triggerHeartbeatSchema.parse({ taskId: '' })).toThrow();
    });

    it('should reject missing taskId', () => {
      expect(() => triggerHeartbeatSchema.parse({})).toThrow();
    });

    it('should reject timeout too low', () => {
      expect(() =>
        triggerHeartbeatSchema.parse({ taskId: 'task-123', timeoutMs: 5000 })
      ).toThrow();
    });

    it('should reject timeout too high', () => {
      expect(() =>
        triggerHeartbeatSchema.parse({ taskId: 'task-123', timeoutMs: 4000000 })
      ).toThrow();
    });

    it('should accept prompt within limits', () => {
      const longPrompt = 'a'.repeat(50000);
      const result = triggerHeartbeatSchema.parse({
        taskId: 'task-123',
        prompt: longPrompt,
      });
      expect(result.prompt).toBe(longPrompt);
    });

    it('should reject prompt exceeding max length', () => {
      const tooLongPrompt = 'a'.repeat(50001);
      expect(() =>
        triggerHeartbeatSchema.parse({ taskId: 'task-123', prompt: tooLongPrompt })
      ).toThrow();
    });

    it('should reject invalid triggerType', () => {
      expect(() =>
        triggerHeartbeatSchema.parse({ taskId: 'task-123', triggerType: 'INVALID' })
      ).toThrow();
    });
  });

  // ── Auto Trigger Schema ─────────────────────────────────────────

  describe('autoTriggerHeartbeatSchema', () => {
    it('should accept empty input (all optional)', () => {
      const result = autoTriggerHeartbeatSchema.parse({});
      expect(result.triggerType).toBe('SCHEDULED'); // default
      expect(result.prompt).toBeUndefined();
      expect(result.timeoutMs).toBeUndefined();
      expect(result.contextFiles).toBeUndefined();
    });

    it('should accept full auto-trigger input', () => {
      const input = {
        prompt: 'Run the next task',
        timeoutMs: 120000,
        contextFiles: ['README.md'],
        triggerType: 'EVENT',
      };
      const result = autoTriggerHeartbeatSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('should default triggerType to SCHEDULED', () => {
      const result = autoTriggerHeartbeatSchema.parse({});
      expect(result.triggerType).toBe('SCHEDULED');
    });

    it('should accept all valid trigger types', () => {
      expect(autoTriggerHeartbeatSchema.parse({ triggerType: 'MANUAL' }).triggerType).toBe(
        'MANUAL'
      );
      expect(autoTriggerHeartbeatSchema.parse({ triggerType: 'SCHEDULED' }).triggerType).toBe(
        'SCHEDULED'
      );
      expect(autoTriggerHeartbeatSchema.parse({ triggerType: 'EVENT' }).triggerType).toBe('EVENT');
    });

    it('should reject timeout too low', () => {
      expect(() => autoTriggerHeartbeatSchema.parse({ timeoutMs: 5000 })).toThrow();
    });

    it('should reject timeout too high', () => {
      expect(() => autoTriggerHeartbeatSchema.parse({ timeoutMs: 4000000 })).toThrow();
    });

    it('should reject prompt exceeding max length', () => {
      const tooLongPrompt = 'a'.repeat(50001);
      expect(() => autoTriggerHeartbeatSchema.parse({ prompt: tooLongPrompt })).toThrow();
    });
  });

  // ── Param Schemas ───────────────────────────────────────────────

  describe('heartbeatIdParamSchema', () => {
    it('should accept valid ID', () => {
      const result = heartbeatIdParamSchema.parse({ id: 'heartbeat-123' });
      expect(result.id).toBe('heartbeat-123');
    });

    it('should reject empty ID', () => {
      expect(() => heartbeatIdParamSchema.parse({ id: '' })).toThrow();
    });
  });

  describe('agentIdParamSchema', () => {
    it('should accept valid agent ID', () => {
      const result = agentIdParamSchema.parse({ agentId: 'agent-123' });
      expect(result.agentId).toBe('agent-123');
    });

    it('should reject empty agent ID', () => {
      expect(() => agentIdParamSchema.parse({ agentId: '' })).toThrow();
    });
  });

  // ── List Query Schema ───────────────────────────────────────────

  describe('listHeartbeatsQuerySchema', () => {
    it('should accept empty query (all optional)', () => {
      const result = listHeartbeatsQuerySchema.parse({});
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should accept full query', () => {
      const query = {
        agentId: 'agent-123',
        taskId: 'task-456',
        status: 'RUNNING',
        triggerType: 'MANUAL',
        limit: '50',
        offset: '10',
      };
      const result = listHeartbeatsQuerySchema.parse(query);
      expect(result.agentId).toBe('agent-123');
      expect(result.taskId).toBe('task-456');
      expect(result.status).toBe('RUNNING');
      expect(result.triggerType).toBe('MANUAL');
      expect(result.limit).toBe(50); // coerced from string
      expect(result.offset).toBe(10); // coerced from string
    });

    it('should accept triggerType filter', () => {
      const result = listHeartbeatsQuerySchema.parse({ triggerType: 'SCHEDULED' });
      expect(result.triggerType).toBe('SCHEDULED');
    });

    it('should reject limit exceeding max', () => {
      expect(() => listHeartbeatsQuerySchema.parse({ limit: '101' })).toThrow();
    });

    it('should reject negative offset', () => {
      expect(() => listHeartbeatsQuerySchema.parse({ offset: '-1' })).toThrow();
    });

    it('should reject invalid status filter', () => {
      expect(() => listHeartbeatsQuerySchema.parse({ status: 'INVALID' })).toThrow();
    });

    it('should reject invalid triggerType filter', () => {
      expect(() => listHeartbeatsQuerySchema.parse({ triggerType: 'INVALID' })).toThrow();
    });
  });

  // ── Recovery Schema ─────────────────────────────────────────────

  describe('recoverOrphansSchema', () => {
    it('should accept empty input (use defaults)', () => {
      const result = recoverOrphansSchema.parse({});
      expect(result.staleMinutes).toBe(10);
    });

    it('should accept valid staleMinutes', () => {
      const result = recoverOrphansSchema.parse({ staleMinutes: 30 });
      expect(result.staleMinutes).toBe(30);
    });

    it('should coerce string to number', () => {
      const result = recoverOrphansSchema.parse({ staleMinutes: '15' });
      expect(result.staleMinutes).toBe(15);
    });

    it('should reject staleMinutes too low', () => {
      expect(() => recoverOrphansSchema.parse({ staleMinutes: 0 })).toThrow();
    });

    it('should reject staleMinutes too high', () => {
      expect(() => recoverOrphansSchema.parse({ staleMinutes: 1441 })).toThrow();
    });

    it('should accept boundary values', () => {
      expect(recoverOrphansSchema.parse({ staleMinutes: 1 }).staleMinutes).toBe(1);
      expect(recoverOrphansSchema.parse({ staleMinutes: 1440 }).staleMinutes).toBe(1440);
    });
  });
});
