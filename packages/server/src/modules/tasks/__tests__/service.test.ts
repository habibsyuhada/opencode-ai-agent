/**
 * Tests for the Task service — atomic checkout, release, assignment, comments.
 *
 * These tests mock Prisma to verify the service logic without a real database.
 * Focus areas:
 * - Atomic checkout prevents concurrent locking (race conditions)
 * - Release verifies ownership before unlocking
 * - Assignment validates agent existence
 * - Comments are recorded as ActivityEvent
 *
 * Story: STORY-008 — Task Atomic Checkout
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma Mock Setup ────────────────────────────────────────────
// Use vi.hoisted() to make mock references available in the hoisted vi.mock factory.

const {
  mockQueryRaw,
  mockTaskUpdate,
  mockTaskFindFirst,
  mockGoalFindFirst,
  mockAgentFindFirst,
  mockActivityEventCreate,
  mockTransaction,
  mockPrisma,
} = vi.hoisted(() => {
  const mockQueryRaw = vi.fn();
  const mockTaskUpdate = vi.fn();
  const mockTaskFindFirst = vi.fn();
  const mockGoalFindFirst = vi.fn();
  const mockAgentFindFirst = vi.fn();
  const mockActivityEventCreate = vi.fn();

  const mockPrisma = {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        $queryRaw: mockQueryRaw,
        task: {
          findFirst: mockTaskFindFirst,
          update: mockTaskUpdate,
        },
      };
      return fn(tx);
    }),
    $queryRaw: mockQueryRaw,
    task: {
      findFirst: mockTaskFindFirst,
      update: mockTaskUpdate,
    },
    goal: {
      findFirst: mockGoalFindFirst,
    },
    agent: {
      findFirst: mockAgentFindFirst,
    },
    activityEvent: {
      create: mockActivityEventCreate,
    },
  };

  return {
    mockQueryRaw,
    mockTaskUpdate,
    mockTaskFindFirst,
    mockGoalFindFirst,
    mockAgentFindFirst,
    mockActivityEventCreate,
    mockTransaction: mockPrisma.$transaction,
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
    TASK_CHECKOUT: 'TASK_CHECKOUT',
    TASK_RELEASE: 'TASK_RELEASE',
    TASK_ASSIGN: 'TASK_ASSIGN',
    TASK_COMMENT: 'TASK_COMMENT',
    TASK_CREATE: 'TASK_CREATE',
    TASK_UPDATE: 'TASK_UPDATE',
    TASK_DELETE: 'TASK_DELETE',
    TASK_STATUS_CHANGE: 'TASK_STATUS_CHANGE',
  },
}));

// ── Import after mocks ────────────────────────────────────────────

import {
  checkoutTask,
  releaseTask,
  assignTask,
  addTaskComment,
} from '../service.js';

// ── Test Data ─────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
const AGENT_A = 'agent-a';
const AGENT_B = 'agent-b';
const TASK_ID = 'task-1';

const createMockTaskRow = (overrides?: Record<string, unknown>) => ({
  id: TASK_ID,
  status: 'TODO',
  lockedAt: null,
  assigneeId: null,
  companyId: COMPANY_ID,
  ...overrides,
});

const createMockUpdatedTask = (overrides?: Record<string, unknown>) => ({
  id: TASK_ID,
  status: 'IN_PROGRESS',
  lockedAt: new Date('2026-06-04T12:00:00Z'),
  assigneeId: AGENT_A,
  assignee: { id: AGENT_A, name: 'DevBot', role: 'developer' },
  ...overrides,
});

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Configure mockQueryRaw to return specific rows.
 * Each call to $queryRaw consumes the next entry in the queue.
 */
let queryRawQueue: Array<unknown[]> = [];
let queryRawCallCount = 0;

function enqueueQueryRaw(...resultSets: Array<unknown[]>) {
  queryRawQueue = resultSets;
  queryRawCallCount = 0;
  mockQueryRaw.mockImplementation(async () => {
    const result = queryRawQueue[queryRawCallCount] ?? [];
    queryRawCallCount++;
    return result;
  });
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Task Service — Atomic Checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRawQueue = [];
    queryRawCallCount = 0;
  });

  describe('checkoutTask', () => {
    it('should checkout an unlocked task successfully', async () => {
      // Arrange: task exists and is unlocked
      enqueueQueryRaw([createMockTaskRow()]);
      mockTaskUpdate.mockResolvedValueOnce(createMockUpdatedTask());

      // Act
      const result = await checkoutTask(
        TASK_ID,
        { agentId: AGENT_A },
        COMPANY_ID
      );

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('IN_PROGRESS');
      expect(result.data!.assigneeId).toBe(AGENT_A);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTaskUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TASK_ID },
          data: expect.objectContaining({
            lockedAt: expect.any(Date),
            assigneeId: AGENT_A,
            status: 'IN_PROGRESS',
          }),
        })
      );
    });

    it('should return NOT_FOUND when task does not exist', async () => {
      // Arrange: $queryRaw returns empty (task not found)
      enqueueQueryRaw([]);

      // Act
      const result = await checkoutTask(
        'nonexistent-task',
        { agentId: AGENT_A },
        COMPANY_ID
      );

      // Assert
      expect(result.error).toBe('NOT_FOUND');
      expect(result.data).toBeUndefined();
    });

    it('should return ALREADY_LOCKED when locked by another agent', async () => {
      // Arrange: task is locked by agent B
      enqueueQueryRaw([
        createMockTaskRow({
          lockedAt: new Date('2026-06-04T11:00:00Z'),
          assigneeId: AGENT_B,
        }),
      ]);

      // Act
      const result = await checkoutTask(
        TASK_ID,
        { agentId: AGENT_A },
        COMPANY_ID
      );

      // Assert
      expect(result.error).toBe('ALREADY_LOCKED');
      expect(result.data).toBeUndefined();
    });

    it('should allow re-checkout by the same agent (idempotent)', async () => {
      // Arrange: task is already locked by agent A
      enqueueQueryRaw([
        createMockTaskRow({
          lockedAt: new Date('2026-06-04T11:00:00Z'),
          assigneeId: AGENT_A,
          status: 'IN_PROGRESS',
        }),
      ]);
      mockTaskUpdate.mockResolvedValueOnce(
        createMockUpdatedTask({
          status: 'IN_PROGRESS',
          assigneeId: AGENT_A,
        })
      );

      // Act
      const result = await checkoutTask(
        TASK_ID,
        { agentId: AGENT_A },
        COMPANY_ID
      );

      // Assert: should succeed (same agent re-checkout is idempotent)
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });
  });

  describe('Concurrent Checkout — Race Condition Prevention', () => {
    it('should allow first agent and reject second when two agents checkout simultaneously', async () => {
      // This test simulates two concurrent checkout attempts.
      // The first $queryRaw call sees the task unlocked; the second sees it locked.
      // In a real PostgreSQL scenario, SELECT ... FOR UPDATE would block the second
      // transaction until the first commits, at which point it would see the lock.

      enqueueQueryRaw(
        [createMockTaskRow({ lockedAt: null, assigneeId: null })],
        [createMockTaskRow({ lockedAt: new Date(), assigneeId: AGENT_A })]
      );

      // First checkout succeeds
      mockTaskUpdate.mockResolvedValueOnce(createMockUpdatedTask());

      const resultA = await checkoutTask(
        TASK_ID,
        { agentId: AGENT_A },
        COMPANY_ID
      );

      // Second checkout should fail with ALREADY_LOCKED
      const resultB = await checkoutTask(
        TASK_ID,
        { agentId: AGENT_B },
        COMPANY_ID
      );

      // Assert: Agent A gets the task, Agent B is rejected
      expect(resultA.error).toBeUndefined();
      expect(resultA.data!.assigneeId).toBe(AGENT_A);

      expect(resultB.error).toBe('ALREADY_LOCKED');
      expect(resultB.data).toBeUndefined();
    });

    it('should use $transaction to ensure atomicity', async () => {
      enqueueQueryRaw([createMockTaskRow()]);
      mockTaskUpdate.mockResolvedValueOnce(createMockUpdatedTask());

      await checkoutTask(TASK_ID, { agentId: AGENT_A }, COMPANY_ID);

      // Verify $transaction was called (Prisma interactive transaction)
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(typeof mockTransaction.mock.calls[0][0]).toBe('function');
    });

    it('should use SELECT FOR UPDATE via $queryRaw', async () => {
      enqueueQueryRaw([createMockTaskRow()]);
      mockTaskUpdate.mockResolvedValueOnce(createMockUpdatedTask());

      await checkoutTask(TASK_ID, { agentId: AGENT_A }, COMPANY_ID);

      // Verify $queryRaw was called within the transaction
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Task Service — Release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRawQueue = [];
    queryRawCallCount = 0;
  });

  it('should release a task by its assigned agent', async () => {
    // Arrange: task locked by agent A
    enqueueQueryRaw([
      createMockTaskRow({
        lockedAt: new Date('2026-06-04T11:00:00Z'),
        assigneeId: AGENT_A,
        status: 'IN_PROGRESS',
      }),
    ]);
    mockTaskUpdate.mockResolvedValueOnce({
      id: TASK_ID,
      status: 'DONE',
      lockedAt: null,
      assigneeId: AGENT_A,
      assignee: { id: AGENT_A, name: 'DevBot', role: 'developer' },
    });

    // Act
    const result = await releaseTask(
      TASK_ID,
      { agentId: AGENT_A },
      COMPANY_ID,
      { status: 'DONE', artifacts: { files: ['src/index.ts'] } }
    );

    // Assert
    expect(result.error).toBeUndefined();
    expect(result.data!.lockedAt).toBeNull();
    expect(result.data!.status).toBe('DONE');
  });

  it('should return NOT_FOUND when task does not exist', async () => {
    enqueueQueryRaw([]);

    const result = await releaseTask(
      'nonexistent-task',
      { agentId: AGENT_A },
      COMPANY_ID
    );

    expect(result.error).toBe('NOT_FOUND');
  });

  it('should return NOT_ASSIGNED when releasing agent is not the assignee', async () => {
    // Task is locked by agent A, but agent B tries to release
    enqueueQueryRaw([
      createMockTaskRow({
        lockedAt: new Date(),
        assigneeId: AGENT_A,
      }),
    ]);

    const result = await releaseTask(
      TASK_ID,
      { agentId: AGENT_B },
      COMPANY_ID
    );

    expect(result.error).toBe('NOT_ASSIGNED');
  });

  it('should release without status or artifact updates', async () => {
    enqueueQueryRaw([
      createMockTaskRow({
        lockedAt: new Date(),
        assigneeId: AGENT_A,
        status: 'IN_PROGRESS',
      }),
    ]);
    mockTaskUpdate.mockResolvedValueOnce({
      id: TASK_ID,
      status: 'IN_PROGRESS',
      lockedAt: null,
      assigneeId: AGENT_A,
      assignee: { id: AGENT_A, name: 'DevBot', role: 'developer' },
    });

    const result = await releaseTask(
      TASK_ID,
      { agentId: AGENT_A },
      COMPANY_ID
    );

    expect(result.error).toBeUndefined();
    expect(result.data!.lockedAt).toBeNull();
    // Status unchanged
    expect(result.data!.status).toBe('IN_PROGRESS');
  });

  it('should use $transaction with SELECT FOR UPDATE', async () => {
    enqueueQueryRaw([
      createMockTaskRow({
        lockedAt: new Date(),
        assigneeId: AGENT_A,
      }),
    ]);
    mockTaskUpdate.mockResolvedValueOnce({
      id: TASK_ID,
      status: 'TODO',
      lockedAt: null,
      assigneeId: AGENT_A,
      assignee: { id: AGENT_A, name: 'DevBot', role: 'developer' },
    });

    await releaseTask(TASK_ID, { agentId: AGENT_A }, COMPANY_ID);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('Task Service — Assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should assign a task to a valid agent', async () => {
    mockTaskFindFirst.mockResolvedValueOnce({
      id: TASK_ID,
      assigneeId: null,
      title: 'Test Task',
    });
    mockAgentFindFirst.mockResolvedValueOnce({
      id: AGENT_A,
      name: 'DevBot',
      companyId: COMPANY_ID,
    });
    mockTaskUpdate.mockResolvedValueOnce({
      id: TASK_ID,
      assigneeId: AGENT_A,
      assignee: { id: AGENT_A, name: 'DevBot', role: 'developer' },
    });

    const result = await assignTask(
      TASK_ID,
      { agentId: AGENT_A },
      COMPANY_ID
    );

    expect(result.error).toBeUndefined();
    expect(result.data!.assigneeId).toBe(AGENT_A);
  });

  it('should return NOT_FOUND when task does not exist', async () => {
    mockTaskFindFirst.mockResolvedValueOnce(null);

    const result = await assignTask(
      TASK_ID,
      { agentId: AGENT_A },
      COMPANY_ID
    );

    expect(result.error).toBe('NOT_FOUND');
  });

  it('should return AGENT_NOT_FOUND when agent does not exist', async () => {
    mockTaskFindFirst.mockResolvedValueOnce({ id: TASK_ID, assigneeId: null });
    mockAgentFindFirst.mockResolvedValueOnce(null);

    const result = await assignTask(
      TASK_ID,
      { agentId: 'nonexistent-agent' },
      COMPANY_ID
    );

    expect(result.error).toBe('AGENT_NOT_FOUND');
  });

  it('should return ALREADY_ASSIGNED when task is already assigned to this agent', async () => {
    mockTaskFindFirst.mockResolvedValueOnce({
      id: TASK_ID,
      assigneeId: AGENT_A,
    });
    mockAgentFindFirst.mockResolvedValueOnce({
      id: AGENT_A,
      name: 'DevBot',
      companyId: COMPANY_ID,
    });

    const result = await assignTask(
      TASK_ID,
      { agentId: AGENT_A },
      COMPANY_ID
    );

    expect(result.error).toBe('ALREADY_ASSIGNED');
  });
});

describe('Task Service — Comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add a comment to a task', async () => {
    mockTaskFindFirst.mockResolvedValueOnce({
      id: TASK_ID,
      title: 'Test Task',
    });
    mockActivityEventCreate.mockResolvedValueOnce({
      id: 'activity-1',
      createdAt: new Date(),
    });

    const result = await addTaskComment(
      TASK_ID,
      {
        actorId: AGENT_A,
        actorType: 'AGENT',
        comment: 'Working on this task now',
      },
      COMPANY_ID
    );

    expect(result.error).toBeUndefined();
    expect(result.data!.id).toBeDefined();
  });

  it('should return NOT_FOUND when task does not exist', async () => {
    mockTaskFindFirst.mockResolvedValueOnce(null);

    const result = await addTaskComment(
      TASK_ID,
      {
        actorId: AGENT_A,
        actorType: 'AGENT',
        comment: 'This will fail',
      },
      COMPANY_ID
    );

    expect(result.error).toBe('NOT_FOUND');
  });

  it('should accept USER actorType', async () => {
    mockTaskFindFirst.mockResolvedValueOnce({
      id: TASK_ID,
      title: 'Test Task',
    });
    mockActivityEventCreate.mockResolvedValueOnce({
      id: 'activity-2',
      createdAt: new Date(),
    });

    const result = await addTaskComment(
      TASK_ID,
      {
        actorId: 'user-1',
        actorType: 'USER',
        comment: 'Please prioritize this',
      },
      COMPANY_ID
    );

    expect(result.error).toBeUndefined();
  });
});

describe('Task Service — Schema Validation', () => {
  it('should validate checkoutTaskSchema requires agentId', async () => {
    const { checkoutTaskSchema } = await import('../schema.js');
    const result = checkoutTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should validate assignTaskSchema requires agentId', async () => {
    const { assignTaskSchema } = await import('../schema.js');
    const result = assignTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should validate addCommentSchema requires comment and actorId', async () => {
    const { addCommentSchema } = await import('../schema.js');
    const result = addCommentSchema.safeParse({ actorId: 'a-1' });
    expect(result.success).toBe(false);
  });

  it('should accept valid addCommentSchema input', async () => {
    const { addCommentSchema } = await import('../schema.js');
    const result = addCommentSchema.safeParse({
      actorId: 'agent-1',
      actorType: 'AGENT',
      comment: 'This is a valid comment',
    });
    expect(result.success).toBe(true);
  });
});
