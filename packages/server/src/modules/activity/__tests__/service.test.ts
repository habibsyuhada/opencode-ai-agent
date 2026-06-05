/**
 * Tests for the Activity service — event recording and querying.
 *
 * These tests mock Prisma to verify the service logic without a real database.
 * Focus areas:
 * - Activity event CRUD
 * - Feed querying with filters
 * - Statistics aggregation
 *
 * Story: STORY-012 — Budget & Governance Backend
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma Mock Setup ────────────────────────────────────────────

const {
  mockActivityEventFindFirst,
  mockActivityEventCreate,
  mockActivityEventCount,
  mockActivityEventGroupBy,
  mockPrisma,
} = vi.hoisted(() => {
  const mockActivityEventFindFirst = vi.fn();
  const mockActivityEventCreate = vi.fn();
  const mockActivityEventCount = vi.fn();
  const mockActivityEventGroupBy = vi.fn();

  const mockPrisma = {
    activityEvent: {
      findFirst: mockActivityEventFindFirst,
      findMany: vi.fn(),
      create: mockActivityEventCreate,
      count: mockActivityEventCount,
      groupBy: mockActivityEventGroupBy,
    },
  };

  return {
    mockActivityEventFindFirst,
    mockActivityEventCreate,
    mockActivityEventCount,
    mockActivityEventGroupBy,
    mockPrisma,
  };
});

vi.mock('../../../db/client.js', () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Import after mocks ────────────────────────────────────────────

import {
  getActivityEventById,
  createActivityEvent,
  getActivityFeed,
  getActivityStats,
} from '../service.js';

// ── Test Data ─────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
const EVENT_ID = 'event-1';

const createMockEvent = (overrides?: Record<string, unknown>) => ({
  id: EVENT_ID,
  companyId: COMPANY_ID,
  actorType: 'AGENT',
  actorId: 'agent-1',
  action: 'TASK_CHECKOUT',
  targetType: 'TASK',
  targetId: 'task-1',
  metadata: null,
  createdAt: new Date('2026-06-04T12:00:00Z'),
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────

describe('Activity Service — CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActivityEventById', () => {
    it('should return an activity event by ID', async () => {
      mockActivityEventFindFirst.mockResolvedValueOnce(createMockEvent());

      const result = await getActivityEventById(EVENT_ID, COMPANY_ID);

      expect(result).toBeDefined();
      expect(result!.id).toBe(EVENT_ID);
    });

    it('should return null when event not found', async () => {
      mockActivityEventFindFirst.mockResolvedValueOnce(null);

      const result = await getActivityEventById('nonexistent', COMPANY_ID);

      expect(result).toBeNull();
    });
  });

  describe('createActivityEvent', () => {
    it('should create an activity event', async () => {
      mockActivityEventCreate.mockResolvedValueOnce(createMockEvent());

      const result = await createActivityEvent(
        {
          actorType: 'AGENT',
          actorId: 'agent-1',
          action: 'TASK_CHECKOUT',
          targetType: 'TASK',
          targetId: 'task-1',
        },
        COMPANY_ID
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(EVENT_ID);
      expect(mockActivityEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            actorType: 'AGENT',
            action: 'TASK_CHECKOUT',
          }),
        })
      );
    });

    it('should create an event with metadata', async () => {
      mockActivityEventCreate.mockResolvedValueOnce(
        createMockEvent({ metadata: { status: 'IN_PROGRESS' } })
      );

      const result = await createActivityEvent(
        {
          actorType: 'AGENT',
          actorId: 'agent-1',
          action: 'TASK_CHECKOUT',
          targetType: 'TASK',
          targetId: 'task-1',
          metadata: { status: 'IN_PROGRESS' },
        },
        COMPANY_ID
      );

      expect(result).toBeDefined();
    });
  });
});

describe('Activity Service — Feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return activity feed', async () => {
    const mockFeed = [createMockEvent(), createMockEvent({ id: 'event-2' })];
    (mockPrisma.activityEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFeed);

    const result = await getActivityFeed(COMPANY_ID);

    expect(result).toHaveLength(2);
  });

  it('should filter by actions', async () => {
    (mockPrisma.activityEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getActivityFeed(COMPANY_ID, { actions: ['TASK_CHECKOUT', 'TASK_RELEASE'] });

    expect(mockPrisma.activityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { in: ['TASK_CHECKOUT', 'TASK_RELEASE'] },
        }),
      })
    );
  });

  it('should filter by actorTypes', async () => {
    (mockPrisma.activityEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await getActivityFeed(COMPANY_ID, { actorTypes: ['AGENT'] });

    expect(mockPrisma.activityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorType: { in: ['AGENT'] },
        }),
      })
    );
  });
});

describe('Activity Service — Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return activity statistics', async () => {
    mockActivityEventCount.mockResolvedValueOnce(100); // total
    mockActivityEventGroupBy.mockResolvedValueOnce([
      { action: 'TASK_CHECKOUT', _count: { id: 30 } },
      { action: 'TASK_RELEASE', _count: { id: 25 } },
    ]);
    mockActivityEventGroupBy.mockResolvedValueOnce([
      { actorType: 'AGENT', _count: { id: 80 } },
      { actorType: 'USER', _count: { id: 20 } },
    ]);

    const stats = await getActivityStats(COMPANY_ID);

    expect(stats.total).toBe(100);
    expect(stats.byAction).toHaveLength(2);
    expect(stats.byActorType).toHaveLength(2);
  });
});

describe('Activity Service — Schema Validation', () => {
  it('should validate createActivityEventSchema requires fields', async () => {
    const { createActivityEventSchema } = await import('../schema.js');
    const result = createActivityEventSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should validate createActivityEventSchema with valid input', async () => {
    const { createActivityEventSchema } = await import('../schema.js');
    const result = createActivityEventSchema.safeParse({
      actorType: 'AGENT',
      actorId: 'agent-1',
      action: 'TASK_CHECKOUT',
      targetType: 'TASK',
      targetId: 'task-1',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid actorType', async () => {
    const { createActivityEventSchema } = await import('../schema.js');
    const result = createActivityEventSchema.safeParse({
      actorType: 'INVALID',
      actorId: 'agent-1',
      action: 'TASK_CHECKOUT',
      targetType: 'TASK',
      targetId: 'task-1',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid actorTypes', async () => {
    const { createActivityEventSchema } = await import('../schema.js');
    const validTypes = ['USER', 'AGENT', 'SYSTEM'];

    for (const actorType of validTypes) {
      const result = createActivityEventSchema.safeParse({
        actorType,
        actorId: 'agent-1',
        action: 'TEST',
        targetType: 'TASK',
        targetId: 'task-1',
      });
      expect(result.success).toBe(true);
    }
  });
});
