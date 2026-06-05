/**
 * Tests for the Routines service — CRUD, trigger, concurrency policies,
 * catch-up policies, and run history.
 *
 * These tests mock Prisma to verify the service logic without a real database.
 * Focus areas:
 * - Routine CRUD with company isolation
 * - Manual trigger with concurrency policy enforcement
 * - Run history tracking
 * - Cron next-run computation
 * - Schema validation
 *
 * Story: STORY-014 — Routines & Scheduling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma Mock Setup ────────────────────────────────────────────

const {
  mockRoutineFindFirst,
  mockRoutineFindMany,
  mockRoutineCreate,
  mockRoutineUpdate,
  mockRoutineDelete,
  mockRoutineRunCreate,
  mockRoutineRunFindMany,
  mockRoutineRunUpdate,
  mockRoutineRunCount,
  mockRoutineRunDeleteMany,
  mockHeartbeatCreate,
  mockAgentFindFirst,
  mockTaskFindFirst,
  mockActivityEventCreate,
  mockPrisma,
} = vi.hoisted(() => {
  const mockRoutineFindFirst = vi.fn();
  const mockRoutineFindMany = vi.fn();
  const mockRoutineCreate = vi.fn();
  const mockRoutineUpdate = vi.fn();
  const mockRoutineDelete = vi.fn();
  const mockRoutineRunCreate = vi.fn();
  const mockRoutineRunFindMany = vi.fn();
  const mockRoutineRunUpdate = vi.fn();
  const mockRoutineRunCount = vi.fn();
  const mockRoutineRunDeleteMany = vi.fn();
  const mockHeartbeatCreate = vi.fn();
  const mockAgentFindFirst = vi.fn();
  const mockTaskFindFirst = vi.fn();
  const mockActivityEventCreate = vi.fn();

  const mockPrisma = {
    routine: {
      findFirst: mockRoutineFindFirst,
      findMany: mockRoutineFindMany,
      create: mockRoutineCreate,
      update: mockRoutineUpdate,
      delete: mockRoutineDelete,
    },
    routineRun: {
      create: mockRoutineRunCreate,
      findMany: mockRoutineRunFindMany,
      findFirst: vi.fn(),
      update: mockRoutineRunUpdate,
      count: mockRoutineRunCount,
      deleteMany: mockRoutineRunDeleteMany,
    },
    heartbeat: {
      create: mockHeartbeatCreate,
    },
    agent: {
      findFirst: mockAgentFindFirst,
    },
    task: {
      findFirst: mockTaskFindFirst,
    },
    activityEvent: {
      create: mockActivityEventCreate,
    },
  };

  return {
    mockRoutineFindFirst,
    mockRoutineFindMany,
    mockRoutineCreate,
    mockRoutineUpdate,
    mockRoutineDelete,
    mockRoutineRunCreate,
    mockRoutineRunFindMany,
    mockRoutineRunUpdate,
    mockRoutineRunCount,
    mockRoutineRunDeleteMany,
    mockHeartbeatCreate,
    mockAgentFindFirst,
    mockTaskFindFirst,
    mockActivityEventCreate,
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

vi.mock('../../../utils/activity.js', () => ({
  recordActivity: vi.fn(async () => ({ id: 'activity-event-1' })),
  ActivityActions: {
    ROUTINE_CREATE: 'ROUTINE_CREATE',
    ROUTINE_UPDATE: 'ROUTINE_UPDATE',
    ROUTINE_DELETE: 'ROUTINE_DELETE',
    ROUTINE_RUN: 'ROUTINE_RUN',
    ROUTINE_RUN_COMPLETE: 'ROUTINE_RUN_COMPLETE',
    ROUTINE_RUN_FAIL: 'ROUTINE_RUN_FAIL',
    ROUTINE_RUN_SKIP: 'ROUTINE_RUN_SKIP',
  },
}));

// ── Import after mocks ────────────────────────────────────────────

import {
  createRoutine,
  updateRoutine,
  deleteRoutine,
  triggerRoutine,
  listRoutines,
  getRoutineById,
  getRoutineStats,
  computeNextRun,
} from '../service.js';

// ── Test Data ─────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
const ROUTINE_ID = 'routine-1';
const AGENT_ID = 'agent-1';
const TASK_ID = 'task-1';

const createMockRoutine = (overrides?: Record<string, unknown>) => ({
  id: ROUTINE_ID,
  companyId: COMPANY_ID,
  agentId: AGENT_ID,
  name: 'Test Routine',
  description: 'A test routine',
  cron: '0 * * * *',
  action: `heartbeat:${TASK_ID}`,
  enabled: true,
  concurrencyPolicy: 'SKIP_IF_RUNNING',
  catchUpPolicy: 'SKIP',
  maxConcurrentRuns: 1,
  timeoutMs: null,
  lastRunAt: null,
  nextRunAt: new Date('2026-06-04T13:00:00Z'),
  createdAt: new Date('2026-06-04T12:00:00Z'),
  updatedAt: new Date('2026-06-04T12:00:00Z'),
  ...overrides,
});

const createMockRoutineRun = (overrides?: Record<string, unknown>) => ({
  id: 'run-1',
  routineId: ROUTINE_ID,
  heartbeatId: null,
  status: 'PENDING',
  startedAt: new Date('2026-06-04T12:00:00Z'),
  endedAt: null,
  log: null,
  error: null,
  createdAt: new Date('2026-06-04T12:00:00Z'),
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────

describe('Routines Service — CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRoutine', () => {
    it('should create a routine with computed nextRunAt', async () => {
      mockRoutineCreate.mockResolvedValueOnce(createMockRoutine());

      const result = await createRoutine(
        {
          name: 'Test Routine',
          cron: '0 * * * *',
          action: `heartbeat:${TASK_ID}`,
          agentId: AGENT_ID,
          enabled: true,
          concurrencyPolicy: 'SKIP_IF_RUNNING',
          catchUpPolicy: 'SKIP',
          maxConcurrentRuns: 1,
        },
        COMPANY_ID
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Routine');
      expect(result.cron).toBe('0 * * * *');
      expect(mockRoutineCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            name: 'Test Routine',
            cron: '0 * * * *',
            action: `heartbeat:${TASK_ID}`,
            enabled: true,
            concurrencyPolicy: 'SKIP_IF_RUNNING',
            catchUpPolicy: 'SKIP',
          }),
        })
      );
    });

    it('should record an activity event on creation', async () => {
      mockRoutineCreate.mockResolvedValueOnce(createMockRoutine());

      await createRoutine(
        {
          name: 'Test Routine',
          cron: '0 * * * *',
          action: `heartbeat:${TASK_ID}`,
          enabled: true,
          concurrencyPolicy: 'ALLOW_OVERLAP',
          catchUpPolicy: 'SKIP',
          maxConcurrentRuns: 1,
        },
        COMPANY_ID
      );

      const { recordActivity } = await import('../../../utils/activity.js');
      expect(recordActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROUTINE_CREATE',
          targetType: 'ROUTINE',
        })
      );
    });
  });

  describe('updateRoutine', () => {
    it('should update an existing routine', async () => {
      mockRoutineFindFirst.mockResolvedValueOnce(createMockRoutine());
      mockRoutineUpdate.mockResolvedValueOnce(
        createMockRoutine({ name: 'Updated Routine' })
      );

      const result = await updateRoutine(
        ROUTINE_ID,
        { name: 'Updated Routine' },
        COMPANY_ID
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should return NOT_FOUND when routine does not exist', async () => {
      mockRoutineFindFirst.mockResolvedValueOnce(null);

      const result = await updateRoutine(
        'nonexistent',
        { name: 'Updated' },
        COMPANY_ID
      );

      expect(result.error).toBe('NOT_FOUND');
    });

    it('should recompute nextRunAt when cron changes', async () => {
      mockRoutineFindFirst.mockResolvedValueOnce(createMockRoutine());
      mockRoutineUpdate.mockResolvedValueOnce(
        createMockRoutine({ cron: '*/30 * * * *' })
      );

      await updateRoutine(
        ROUTINE_ID,
        { cron: '*/30 * * * *' },
        COMPANY_ID
      );

      expect(mockRoutineUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ROUTINE_ID },
          data: expect.objectContaining({
            cron: '*/30 * * * *',
            nextRunAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('deleteRoutine', () => {
    it('should delete a routine and its runs', async () => {
      mockRoutineFindFirst.mockResolvedValueOnce(createMockRoutine());
      mockRoutineRunDeleteMany.mockResolvedValueOnce({ count: 3 });
      mockRoutineDelete.mockResolvedValueOnce(createMockRoutine());

      const result = await deleteRoutine(ROUTINE_ID, COMPANY_ID);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(mockRoutineRunDeleteMany).toHaveBeenCalledWith({
        where: { routineId: ROUTINE_ID },
      });
    });

    it('should return NOT_FOUND when routine does not exist', async () => {
      mockRoutineFindFirst.mockResolvedValueOnce(null);

      const result = await deleteRoutine('nonexistent', COMPANY_ID);

      expect(result.error).toBe('NOT_FOUND');
    });
  });

  describe('listRoutines', () => {
    it('should list routines for a company', async () => {
      mockRoutineFindMany.mockResolvedValueOnce([createMockRoutine()]);

      const result = await listRoutines(COMPANY_ID);

      expect(result).toHaveLength(1);
      expect(mockRoutineFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_ID }),
        })
      );
    });

    it('should filter by enabled status', async () => {
      mockRoutineFindMany.mockResolvedValueOnce([]);

      await listRoutines(COMPANY_ID, { enabled: true });

      expect(mockRoutineFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ enabled: true }),
        })
      );
    });
  });

  describe('getRoutineById', () => {
    it('should get a routine by ID with run history', async () => {
      mockRoutineFindFirst.mockResolvedValueOnce({
        ...createMockRoutine(),
        runs: [createMockRoutineRun()],
        _count: { runs: 1 },
      });

      const result = await getRoutineById(ROUTINE_ID, COMPANY_ID);

      expect(result).toBeDefined();
      expect(result!.runs).toHaveLength(1);
    });

    it('should return null when routine not found', async () => {
      mockRoutineFindFirst.mockResolvedValueOnce(null);

      const result = await getRoutineById('nonexistent', COMPANY_ID);

      expect(result).toBeNull();
    });
  });
});

describe('Routines Service — Trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should trigger a routine and create a run', async () => {
    mockRoutineFindFirst.mockResolvedValueOnce(createMockRoutine());
    mockRoutineRunCount.mockResolvedValueOnce(0); // No active runs
    mockRoutineRunCreate.mockResolvedValueOnce(createMockRoutineRun());
    mockRoutineUpdate.mockResolvedValueOnce(createMockRoutine());
    mockAgentFindFirst.mockResolvedValueOnce({ id: AGENT_ID, companyId: COMPANY_ID });
    mockTaskFindFirst.mockResolvedValueOnce({ id: TASK_ID, goal: { project: { companyId: COMPANY_ID } } });
    mockHeartbeatCreate.mockResolvedValueOnce({ id: 'heartbeat-1' });

    const result = await triggerRoutine(ROUTINE_ID, {}, COMPANY_ID);

    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(mockRoutineRunCreate).toHaveBeenCalled();
  });

  it('should return NOT_FOUND when routine does not exist', async () => {
    mockRoutineFindFirst.mockResolvedValueOnce(null);

    const result = await triggerRoutine('nonexistent', {}, COMPANY_ID);

    expect(result.error).toBe('NOT_FOUND');
  });

  it('should return DISABLED when routine is disabled', async () => {
    mockRoutineFindFirst.mockResolvedValueOnce(createMockRoutine({ enabled: false }));

    const result = await triggerRoutine(ROUTINE_ID, {}, COMPANY_ID);

    expect(result.error).toBe('DISABLED');
  });

  it('should respect SKIP_IF_RUNNING concurrency policy', async () => {
    mockRoutineFindFirst.mockResolvedValueOnce(createMockRoutine());
    mockRoutineRunCount.mockResolvedValueOnce(1); // One active run

    const result = await triggerRoutine(ROUTINE_ID, {}, COMPANY_ID);

    expect(result.error).toBe('CONCURRENCY_LIMIT');
  });

  it('should allow ALLOW_OVERLAP concurrency policy', async () => {
    mockRoutineFindFirst.mockResolvedValueOnce(
      createMockRoutine({ concurrencyPolicy: 'ALLOW_OVERLAP' })
    );
    mockRoutineRunCount.mockResolvedValueOnce(5); // Many active runs
    mockRoutineRunCreate.mockResolvedValueOnce(createMockRoutineRun());
    mockRoutineUpdate.mockResolvedValueOnce(createMockRoutine());
    mockAgentFindFirst.mockResolvedValueOnce({ id: AGENT_ID, companyId: COMPANY_ID });
    mockTaskFindFirst.mockResolvedValueOnce({ id: TASK_ID, goal: { project: { companyId: COMPANY_ID } } });
    mockHeartbeatCreate.mockResolvedValueOnce({ id: 'heartbeat-1' });

    const result = await triggerRoutine(ROUTINE_ID, {}, COMPANY_ID);

    expect(result.error).toBeUndefined();
  });
});

describe('Routines Service — Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return routine statistics', async () => {
    mockRoutineFindFirst.mockResolvedValueOnce(createMockRoutine());
    mockRoutineRunCount.mockResolvedValueOnce(10); // total
    mockRoutineRunCount.mockResolvedValueOnce(7);  // completed
    mockRoutineRunCount.mockResolvedValueOnce(2);  // failed
    mockRoutineRunCount.mockResolvedValueOnce(1);  // skipped

    const stats = await getRoutineStats(ROUTINE_ID, COMPANY_ID);

    expect(stats).toBeDefined();
    expect(stats!.totalRuns).toBe(10);
    expect(stats!.completedRuns).toBe(7);
    expect(stats!.failedRuns).toBe(2);
    expect(stats!.skippedRuns).toBe(1);
    expect(stats!.successRate).toBe(0.7);
  });

  it('should return null when routine not found', async () => {
    mockRoutineFindFirst.mockResolvedValueOnce(null);

    const stats = await getRoutineStats('nonexistent', COMPANY_ID);

    expect(stats).toBeNull();
  });
});

describe('Routines Service — Cron Utilities', () => {
  it('should compute next run for every-minute cron', () => {
    const next = computeNextRun('* * * * *');
    const now = new Date();
    // Should be within the next minute
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getTime()).toBeLessThan(now.getTime() + 120000);
  });

  it('should compute next run for specific hour', () => {
    const next = computeNextRun('0 9 * * *');
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  it('should compute next run for every N minutes', () => {
    const next = computeNextRun('*/15 * * * *');
    expect(next.getMinutes() % 15).toBe(0);
  });

  it('should handle invalid cron expressions gracefully', () => {
    const next = computeNextRun('invalid');
    // Should default to 1 hour from now
    const expected = new Date();
    expected.setHours(expected.getHours() + 1);
    expect(next.getHours()).toBe(expected.getHours());
  });
});

describe('Routines Service — Schema Validation', () => {
  it('should validate createRoutineSchema requires name, cron, action', async () => {
    const { createRoutineSchema } = await import('../schema.js');
    const result = createRoutineSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should validate createRoutineSchema with valid input', async () => {
    const { createRoutineSchema } = await import('../schema.js');
    const result = createRoutineSchema.safeParse({
      name: 'Test Routine',
      cron: '0 * * * *',
      action: 'heartbeat:task-1',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid concurrency policy', async () => {
    const { createRoutineSchema } = await import('../schema.js');
    const result = createRoutineSchema.safeParse({
      name: 'Test',
      cron: '0 * * * *',
      action: 'test',
      concurrencyPolicy: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid concurrency policies', async () => {
    const { createRoutineSchema } = await import('../schema.js');
    const validPolicies = ['ALLOW_OVERLAP', 'SKIP_IF_RUNNING', 'QUEUE'];

    for (const policy of validPolicies) {
      const result = createRoutineSchema.safeParse({
        name: 'Test',
        cron: '0 * * * *',
        action: 'test',
        concurrencyPolicy: policy,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should accept all valid catch-up policies', async () => {
    const { createRoutineSchema } = await import('../schema.js');
    const validPolicies = ['SKIP', 'RUN_ONCE', 'RUN_ALL'];

    for (const policy of validPolicies) {
      const result = createRoutineSchema.safeParse({
        name: 'Test',
        cron: '0 * * * *',
        action: 'test',
        catchUpPolicy: policy,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should apply default values', async () => {
    const { createRoutineSchema } = await import('../schema.js');
    const result = createRoutineSchema.safeParse({
      name: 'Test',
      cron: '0 * * * *',
      action: 'test',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.concurrencyPolicy).toBe('ALLOW_OVERLAP');
      expect(result.data.catchUpPolicy).toBe('SKIP');
      expect(result.data.maxConcurrentRuns).toBe(1);
    }
  });
});
