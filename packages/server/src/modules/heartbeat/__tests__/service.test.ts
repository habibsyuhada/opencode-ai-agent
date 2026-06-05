/**
 * Tests for the Heartbeat service.
 *
 * Tests the core heartbeat execution logic with mocked Prisma
 * and adapter dependencies. Covers:
 * - Manual trigger (triggerHeartbeat)
 * - Auto-trigger with task queue (autoTriggerHeartbeat)
 * - Orphaned run recovery (recoverOrphanedRuns)
 * - Budget checking
 * - Skill loading
 * - Secret injection
 * - Activity recording
 *
 * STORY-009: Enhanced tests for full heartbeat loop.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the prisma client
vi.mock('../../../db/client.js', () => ({
  default: {
    agent: {
      findFirst: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    heartbeat: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    costEvent: {
      create: vi.fn(),
    },
    budget: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    secret: {
      findMany: vi.fn(),
    },
    workspace: {
      findFirst: vi.fn(),
    },
    activityEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

// Mock the OpenCode adapter
vi.mock('../../../adapters/opencode.js', () => ({
  OpenCodeAdapter: vi.fn().mockImplementation(() => ({
    name: 'opencode',
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue('idle'),
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
  createOpenCodeAdapter: vi.fn().mockReturnValue({
    name: 'opencode',
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue('idle'),
    isAvailable: vi.fn().mockResolvedValue(true),
  }),
}));

// Mock the logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the activity utility
vi.mock('../../../utils/activity.js', () => ({
  recordActivity: vi.fn().mockResolvedValue({ id: 'activity-001' }),
  ActivityActions: {
    TASK_CHECKOUT: 'TASK_CHECKOUT',
    TASK_RELEASE: 'TASK_RELEASE',
    TASK_ASSIGN: 'TASK_ASSIGN',
    TASK_COMMENT: 'TASK_COMMENT',
    TASK_CREATE: 'TASK_CREATE',
    TASK_UPDATE: 'TASK_UPDATE',
    TASK_DELETE: 'TASK_DELETE',
    TASK_STATUS_CHANGE: 'TASK_STATUS_CHANGE',
    AGENT_CREATE: 'AGENT_CREATE',
    AGENT_UPDATE: 'AGENT_UPDATE',
    AGENT_STATUS_CHANGE: 'AGENT_STATUS_CHANGE',
    HEARTBEAT_START: 'HEARTBEAT_START',
    HEARTBEAT_COMPLETE: 'HEARTBEAT_COMPLETE',
    HEARTBEAT_FAIL: 'HEARTBEAT_FAIL',
    APPROVAL_REQUEST: 'APPROVAL_REQUEST',
    APPROVAL_DECISION: 'APPROVAL_DECISION',
  },
}));

import prisma from '../../../db/client.js';
import {
  triggerHeartbeat,
  autoTriggerHeartbeat,
  recoverOrphanedRuns,
  getHeartbeatById,
  listHeartbeats,
  getHeartbeatStats,
  resetAdapter,
  AgentNotFoundError,
  AgentNotActiveError,
  TaskNotFoundError,
  TaskLockedError,
  BudgetExceededError,
} from '../service.js';
import { recordActivity } from '../../../utils/activity.js';

// ── Test Fixtures ────────────────────────────────────────────────

const mockAgent = {
  id: 'agent-001',
  companyId: 'company-001',
  name: 'Dev Agent',
  role: 'developer',
  status: 'ACTIVE',
  config: null,
  createdAt: new Date(),
};

const mockAgentWithSkills = {
  ...mockAgent,
  config: { skills: ['typescript', 'react', 'testing'] },
};

const mockTask = {
  id: 'task-001',
  goalId: 'goal-001',
  assigneeId: 'agent-001',
  title: 'Implement feature X',
  description: 'Implement the feature as described in the PRD',
  status: 'TODO',
  priority: 'HIGH',
  lockedAt: null,
  artifacts: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  goal: {
    id: 'goal-001',
    name: 'Core Feature Set',
    project: {
      id: 'project-001',
      name: 'ArmiAI Platform',
    },
  },
};

const mockHeartbeat = {
  id: 'heartbeat-001',
  taskId: 'task-001',
  agentId: 'agent-001',
  status: 'PENDING',
  startedAt: new Date(),
  endedAt: null,
  log: null,
  tokensUsed: 0,
  cost: 0,
  createdAt: new Date(),
};

const mockBudget = {
  id: 'budget-001',
  companyId: 'company-001',
  agentId: null,
  monthly: 100.0,
  used: 10.0,
  currency: 'USD',
  threshold: 0.8,
};

const mockAgentBudget = {
  id: 'budget-002',
  companyId: 'company-001',
  agentId: 'agent-001',
  monthly: 50.0,
  used: 5.0,
  currency: 'USD',
  threshold: 0.8,
};

const mockCompany = 'company-001';

// ── Tests ────────────────────────────────────────────────────────

describe('Heartbeat Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Manual Trigger ──────────────────────────────────────────────

  describe('triggerHeartbeat', () => {
    it('should create a heartbeat and return its ID', async () => {
      // Setup mocks
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.budget.findFirst as any).mockResolvedValue(mockBudget);
      (prisma.heartbeat.create as any).mockResolvedValue(mockHeartbeat);
      (prisma.secret.findMany as any).mockResolvedValue([]);

      const result = await triggerHeartbeat(
        'agent-001',
        { taskId: 'task-001', triggerType: 'MANUAL' },
        mockCompany
      );

      expect(result).toEqual({
        heartbeatId: 'heartbeat-001',
        status: 'PENDING',
      });

      expect(prisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-001', companyId: 'company-001' },
      });

      expect(prisma.heartbeat.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-001',
          agentId: 'agent-001',
          status: 'PENDING',
          startedAt: expect.any(Date),
        },
      });
    });

    it('should throw AgentNotFoundError if agent not found', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(null);

      await expect(
        triggerHeartbeat(
          'agent-999',
          { taskId: 'task-001', triggerType: 'MANUAL' },
          mockCompany
        )
      ).rejects.toThrow(AgentNotFoundError);
    });

    it('should throw AgentNotActiveError if agent is paused', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue({
        ...mockAgent,
        status: 'PAUSED',
      });

      await expect(
        triggerHeartbeat(
          'agent-001',
          { taskId: 'task-001', triggerType: 'MANUAL' },
          mockCompany
        )
      ).rejects.toThrow(AgentNotActiveError);
    });

    it('should throw TaskNotFoundError if task not found', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.task.findFirst as any).mockResolvedValue(null);

      await expect(
        triggerHeartbeat(
          'agent-001',
          { taskId: 'task-999', triggerType: 'MANUAL' },
          mockCompany
        )
      ).rejects.toThrow(TaskNotFoundError);
    });

    it('should throw TaskLockedError if task is locked by another agent', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.task.findFirst as any).mockResolvedValue({
        ...mockTask,
        lockedAt: new Date(),
        assigneeId: 'agent-002',
      });

      await expect(
        triggerHeartbeat(
          'agent-001',
          { taskId: 'task-001', triggerType: 'MANUAL' },
          mockCompany
        )
      ).rejects.toThrow(TaskLockedError);
    });

    it('should throw BudgetExceededError if company budget exceeded', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.budget.findFirst as any).mockResolvedValue({
        ...mockBudget,
        used: 150.0, // Over the 100.0 monthly limit
      });

      await expect(
        triggerHeartbeat(
          'agent-001',
          { taskId: 'task-001', triggerType: 'MANUAL' },
          mockCompany
        )
      ).rejects.toThrow(BudgetExceededError);
    });

    it('should throw BudgetExceededError if agent budget exceeded', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.budget.findFirst as any)
        .mockResolvedValueOnce(mockBudget) // company budget OK
        .mockResolvedValueOnce({
          ...mockAgentBudget,
          used: 60.0, // Over the 50.0 monthly limit
        });

      await expect(
        triggerHeartbeat(
          'agent-001',
          { taskId: 'task-001', triggerType: 'MANUAL' },
          mockCompany
        )
      ).rejects.toThrow(BudgetExceededError);
    });

    it('should accept custom prompt and timeout', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.budget.findFirst as any).mockResolvedValue(mockBudget);
      (prisma.heartbeat.create as any).mockResolvedValue(mockHeartbeat);
      (prisma.secret.findMany as any).mockResolvedValue([]);

      const result = await triggerHeartbeat(
        'agent-001',
        {
          taskId: 'task-001',
          prompt: 'Custom prompt for this task',
          timeoutMs: 60000,
          contextFiles: ['README.md'],
          triggerType: 'MANUAL',
        },
        mockCompany
      );

      expect(result.heartbeatId).toBe('heartbeat-001');
    });

    it('should record activity on heartbeat start', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.budget.findFirst as any).mockResolvedValue(mockBudget);
      (prisma.heartbeat.create as any).mockResolvedValue(mockHeartbeat);
      (prisma.secret.findMany as any).mockResolvedValue([]);

      await triggerHeartbeat(
        'agent-001',
        { taskId: 'task-001', triggerType: 'MANUAL' },
        mockCompany
      );

      expect(recordActivity).toHaveBeenCalledWith({
        companyId: mockCompany,
        actorType: 'AGENT',
        actorId: 'agent-001',
        action: 'HEARTBEAT_START',
        targetType: 'HEARTBEAT',
        targetId: 'heartbeat-001',
        metadata: expect.objectContaining({
          taskId: 'task-001',
          triggerType: 'MANUAL',
        }),
      });
    });

    it('should load secrets for execution', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.budget.findFirst as any).mockResolvedValue(mockBudget);
      (prisma.heartbeat.create as any).mockResolvedValue(mockHeartbeat);
      (prisma.secret.findMany as any).mockResolvedValue([
        {
          id: 'secret-001',
          name: 'API_KEY',
          // Use proper AES-256-GCM format for the mock (secrets service will try to decrypt)
          // But since we mock the whole loadDecryptedSecrets, we just need the mock to return
          encryptedValue: 'iv:tag:ciphertext',
          scope: 'GLOBAL',
        },
      ]);

      const result = await triggerHeartbeat(
        'agent-001',
        { taskId: 'task-001', triggerType: 'MANUAL' },
        mockCompany
      );

      expect(result.heartbeatId).toBe('heartbeat-001');
      // Secrets are now loaded via the secrets service (loadDecryptedSecrets)
      // which queries prisma.secret.findMany with companyId
      expect(prisma.secret.findMany).toHaveBeenCalledWith({
        where: {
          companyId: mockCompany,
        },
      });
    });
  });

  // ── Auto Trigger ────────────────────────────────────────────────

  describe('autoTriggerHeartbeat', () => {
    it('should find next task and trigger heartbeat', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.budget.findFirst as any).mockResolvedValue(mockBudget);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.heartbeat.create as any).mockResolvedValue(mockHeartbeat);
      (prisma.secret.findMany as any).mockResolvedValue([]);
      // Mock $transaction for atomic checkout
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([mockTask]),
          task: {
            update: vi.fn().mockResolvedValue(mockTask),
          },
        };
        return fn(tx);
      });

      const result = await autoTriggerHeartbeat(
        'agent-001',
        { triggerType: 'SCHEDULED' },
        mockCompany
      );

      expect(result).not.toBeNull();
      expect(result?.heartbeatId).toBe('heartbeat-001');
    });

    it('should return null if no tasks available', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.budget.findFirst as any).mockResolvedValue(mockBudget);
      (prisma.task.findFirst as any).mockResolvedValue(null);

      const result = await autoTriggerHeartbeat(
        'agent-001',
        { triggerType: 'SCHEDULED' },
        mockCompany
      );

      expect(result).toBeNull();
    });

    it('should return null if budget exceeded', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.budget.findFirst as any).mockResolvedValue({
        ...mockBudget,
        used: 150.0,
      });

      const result = await autoTriggerHeartbeat(
        'agent-001',
        { triggerType: 'SCHEDULED' },
        mockCompany
      );

      expect(result).toBeNull();
    });

    it('should throw AgentNotFoundError if agent not found', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(null);

      await expect(
        autoTriggerHeartbeat(
          'agent-999',
          { triggerType: 'SCHEDULED' },
          mockCompany
        )
      ).rejects.toThrow(AgentNotFoundError);
    });

    it('should throw AgentNotActiveError if agent is paused', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue({
        ...mockAgent,
        status: 'PAUSED',
      });

      await expect(
        autoTriggerHeartbeat(
          'agent-001',
          { triggerType: 'SCHEDULED' },
          mockCompany
        )
      ).rejects.toThrow(AgentNotActiveError);
    });

    it('should return null if atomic checkout fails', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.budget.findFirst as any).mockResolvedValue(mockBudget);
      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      // Mock $transaction to return false (checkout failed)
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([{
            ...mockTask,
            lockedAt: new Date(),
            assigneeId: 'agent-002', // Locked by another agent
          }]),
          task: {
            update: vi.fn(),
          },
        };
        return fn(tx);
      });

      const result = await autoTriggerHeartbeat(
        'agent-001',
        { triggerType: 'SCHEDULED' },
        mockCompany
      );

      expect(result).toBeNull();
    });
  });

  // ── Orphaned Run Recovery ───────────────────────────────────────

  describe('recoverOrphanedRuns', () => {
    it('should recover orphaned heartbeat runs', async () => {
      const orphanedHeartbeats = [
        {
          id: 'hb-orphan-1',
          taskId: 'task-orphan-1',
          agentId: 'agent-001',
          status: 'RUNNING',
          startedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
          agent: { id: 'agent-001', companyId: mockCompany },
          task: { id: 'task-orphan-1', lockedAt: new Date() },
        },
      ];

      (prisma.heartbeat.findMany as any).mockResolvedValue(orphanedHeartbeats);
      (prisma.heartbeat.update as any).mockResolvedValue({});
      (prisma.task.update as any).mockResolvedValue({});

      const result = await recoverOrphanedRuns(
        { staleMinutes: 10 },
        mockCompany
      );

      expect(result.recovered).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.heartbeats).toHaveLength(1);
      expect(result.heartbeats[0].status).toBe('FAILED');

      expect(prisma.heartbeat.update).toHaveBeenCalledWith({
        where: { id: 'hb-orphan-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          log: expect.stringContaining('Orphaned run recovered'),
        }),
      });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-orphan-1' },
        data: { lockedAt: null },
      });
    });

    it('should return zero counts if no orphans found', async () => {
      (prisma.heartbeat.findMany as any).mockResolvedValue([]);

      const result = await recoverOrphanedRuns(
        { staleMinutes: 10 },
        mockCompany
      );

      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.heartbeats).toHaveLength(0);
    });

    it('should handle recovery failures gracefully', async () => {
      const orphanedHeartbeats = [
        {
          id: 'hb-orphan-1',
          taskId: 'task-orphan-1',
          agentId: 'agent-001',
          status: 'RUNNING',
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          agent: { id: 'agent-001', companyId: mockCompany },
          task: { id: 'task-orphan-1', lockedAt: new Date() },
        },
      ];

      (prisma.heartbeat.findMany as any).mockResolvedValue(orphanedHeartbeats);
      (prisma.heartbeat.update as any).mockRejectedValue(new Error('DB error'));

      const result = await recoverOrphanedRuns(
        { staleMinutes: 10 },
        mockCompany
      );

      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.heartbeats[0].status).toBe('RECOVERY_FAILED');
    });

    it('should record activity for recovered runs', async () => {
      const orphanedHeartbeats = [
        {
          id: 'hb-orphan-1',
          taskId: 'task-orphan-1',
          agentId: 'agent-001',
          status: 'RUNNING',
          startedAt: new Date(Date.now() - 20 * 60 * 1000),
          agent: { id: 'agent-001', companyId: mockCompany },
          task: { id: 'task-orphan-1', lockedAt: new Date() },
        },
      ];

      (prisma.heartbeat.findMany as any).mockResolvedValue(orphanedHeartbeats);
      (prisma.heartbeat.update as any).mockResolvedValue({});
      (prisma.task.update as any).mockResolvedValue({});

      await recoverOrphanedRuns({ staleMinutes: 10 }, mockCompany);

      expect(recordActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'SYSTEM',
          actorId: 'orphan-recovery',
          action: 'HEARTBEAT_FAIL',
          targetType: 'HEARTBEAT',
          targetId: 'hb-orphan-1',
        })
      );
    });
  });

  // ── Query Functions ─────────────────────────────────────────────

  describe('getHeartbeatById', () => {
    it('should return heartbeat with relations', async () => {
      const heartbeatWithRelations = {
        ...mockHeartbeat,
        agent: { id: 'agent-001', name: 'Dev Agent', role: 'developer' },
        task: {
          id: 'task-001',
          title: 'Implement feature X',
          status: 'IN_PROGRESS',
          goal: {
            id: 'goal-001',
            name: 'Core Feature Set',
            project: { id: 'project-001', name: 'ArmiAI Platform' },
          },
        },
        costEvents: [],
      };

      (prisma.heartbeat.findFirst as any).mockResolvedValue(heartbeatWithRelations);

      const result = await getHeartbeatById('heartbeat-001', mockCompany);

      expect(result).toEqual(heartbeatWithRelations);
      expect(prisma.heartbeat.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'heartbeat-001',
          agent: { companyId: 'company-001' },
        },
        include: expect.any(Object),
      });
    });

    it('should return null if heartbeat not found', async () => {
      (prisma.heartbeat.findFirst as any).mockResolvedValue(null);

      const result = await getHeartbeatById('heartbeat-999', mockCompany);
      expect(result).toBeNull();
    });
  });

  describe('listHeartbeats', () => {
    it('should return heartbeats with default pagination', async () => {
      const heartbeats = [mockHeartbeat];
      (prisma.heartbeat.findMany as any).mockResolvedValue(heartbeats);

      const result = await listHeartbeats(mockCompany);

      expect(result).toEqual(heartbeats);
      expect(prisma.heartbeat.findMany).toHaveBeenCalledWith({
        where: { agent: { companyId: 'company-001' } },
        include: expect.any(Object),
        orderBy: { startedAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should apply filters correctly', async () => {
      (prisma.heartbeat.findMany as any).mockResolvedValue([]);

      await listHeartbeats(mockCompany, {
        agentId: 'agent-001',
        status: 'RUNNING',
        limit: 10,
        offset: 5,
      });

      expect(prisma.heartbeat.findMany).toHaveBeenCalledWith({
        where: {
          agentId: 'agent-001',
          status: 'RUNNING',
          agent: { companyId: 'company-001' },
        },
        include: expect.any(Object),
        orderBy: { startedAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('getHeartbeatStats', () => {
    it('should return aggregated statistics', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.heartbeat.count as any)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // completed
        .mockResolvedValueOnce(2); // failed
      (prisma.heartbeat.aggregate as any).mockResolvedValue({
        _sum: { tokensUsed: 50000, cost: 1.5 },
        _avg: { tokensUsed: 6250, cost: 0.1875 },
      });

      const stats = await getHeartbeatStats('agent-001', mockCompany);

      expect(stats).toEqual({
        agentId: 'agent-001',
        totalRuns: 10,
        completedRuns: 8,
        failedRuns: 2,
        successRate: 0.8,
        totalTokens: 50000,
        totalCost: 1.5,
        avgTokens: 6250,
        avgCost: 0.1875,
      });
    });

    it('should return null if agent not found', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(null);

      const stats = await getHeartbeatStats('agent-999', mockCompany);
      expect(stats).toBeNull();
    });

    it('should handle zero runs gracefully', async () => {
      (prisma.agent.findFirst as any).mockResolvedValue(mockAgent);
      (prisma.heartbeat.count as any).mockResolvedValue(0);
      (prisma.heartbeat.aggregate as any).mockResolvedValue({
        _sum: { tokensUsed: null, cost: null },
        _avg: { tokensUsed: null, cost: null },
      });

      const stats = await getHeartbeatStats('agent-001', mockCompany);

      expect(stats).toEqual({
        agentId: 'agent-001',
        totalRuns: 0,
        completedRuns: 0,
        failedRuns: 0,
        successRate: 0,
        totalTokens: 0,
        totalCost: 0,
        avgTokens: 0,
        avgCost: 0,
      });
    });
  });
});
