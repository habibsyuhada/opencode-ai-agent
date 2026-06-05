/**
 * Tests for the Activity Recording Utility.
 *
 * Verifies that activity events are properly created and that
 * error handling is correct when the database is unavailable.
 *
 * Story: STORY-008 — Task Atomic Checkout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma Mock Setup ────────────────────────────────────────────
// Use vi.hoisted() so mock references are available in the hoisted vi.mock factory.

const { mockActivityEventCreate } = vi.hoisted(() => ({
  mockActivityEventCreate: vi.fn(),
}));

// Mock the PrismaClient constructor to prevent DB connection attempts
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    activityEvent: { create: mockActivityEventCreate },
  })),
}));

// Mock the db/client module
vi.mock('../../../db/client.js', () => ({
  default: {
    activityEvent: { create: mockActivityEventCreate },
  },
  prisma: {
    activityEvent: { create: mockActivityEventCreate },
  },
}));

// ── Import after mocks ────────────────────────────────────────────

import { recordActivity, ActivityActions } from '../activity.js';

// ── Tests ─────────────────────────────────────────────────────────

describe('Activity Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordActivity', () => {
    it('should create an activity event successfully', async () => {
      mockActivityEventCreate.mockResolvedValueOnce({
        id: 'event-1',
      });

      const result = await recordActivity({
        companyId: 'company-1',
        actorType: 'AGENT',
        actorId: 'agent-1',
        action: 'TASK_CHECKOUT',
        targetType: 'TASK',
        targetId: 'task-1',
        metadata: { status: 'IN_PROGRESS' },
      });

      expect(result).toEqual({ id: 'event-1' });
      expect(mockActivityEventCreate).toHaveBeenCalledWith({
        data: {
          companyId: 'company-1',
          actorType: 'AGENT',
          actorId: 'agent-1',
          action: 'TASK_CHECKOUT',
          targetType: 'TASK',
          targetId: 'task-1',
          metadata: { status: 'IN_PROGRESS' },
        },
        select: { id: true },
      });
    });

    it('should return null when recording fails (does not throw)', async () => {
      mockActivityEventCreate.mockRejectedValueOnce(new Error('DB connection failed'));

      const result = await recordActivity({
        companyId: 'company-1',
        actorType: 'SYSTEM',
        actorId: 'system',
        action: 'TASK_CREATE',
        targetType: 'TASK',
        targetId: 'task-1',
      });

      expect(result).toBeNull();
    });

    it('should work without metadata', async () => {
      mockActivityEventCreate.mockResolvedValueOnce({ id: 'event-2' });

      const result = await recordActivity({
        companyId: 'company-1',
        actorType: 'USER',
        actorId: 'user-1',
        action: 'TASK_ASSIGN',
        targetType: 'TASK',
        targetId: 'task-1',
      });

      expect(result).toEqual({ id: 'event-2' });
      expect(mockActivityEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: undefined,
          }),
        })
      );
    });
  });

  describe('ActivityActions constants', () => {
    it('should have task lifecycle actions', () => {
      expect(ActivityActions.TASK_CHECKOUT).toBe('TASK_CHECKOUT');
      expect(ActivityActions.TASK_RELEASE).toBe('TASK_RELEASE');
      expect(ActivityActions.TASK_ASSIGN).toBe('TASK_ASSIGN');
      expect(ActivityActions.TASK_COMMENT).toBe('TASK_COMMENT');
      expect(ActivityActions.TASK_CREATE).toBe('TASK_CREATE');
      expect(ActivityActions.TASK_STATUS_CHANGE).toBe('TASK_STATUS_CHANGE');
    });

    it('should have agent lifecycle actions', () => {
      expect(ActivityActions.AGENT_CREATE).toBe('AGENT_CREATE');
      expect(ActivityActions.AGENT_UPDATE).toBe('AGENT_UPDATE');
    });

    it('should have heartbeat lifecycle actions', () => {
      expect(ActivityActions.HEARTBEAT_START).toBe('HEARTBEAT_START');
      expect(ActivityActions.HEARTBEAT_COMPLETE).toBe('HEARTBEAT_COMPLETE');
      expect(ActivityActions.HEARTBEAT_FAIL).toBe('HEARTBEAT_FAIL');
    });

    it('should have approval lifecycle actions', () => {
      expect(ActivityActions.APPROVAL_REQUEST).toBe('APPROVAL_REQUEST');
      expect(ActivityActions.APPROVAL_DECISION).toBe('APPROVAL_DECISION');
    });
  });
});
