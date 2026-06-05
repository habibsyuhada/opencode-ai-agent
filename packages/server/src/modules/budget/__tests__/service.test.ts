/**
 * Tests for the Budget service — CRUD, cost tracking, threshold warnings, auto-pause.
 *
 * These tests mock Prisma to verify the service logic without a real database.
 * Focus areas:
 * - Budget CRUD with company isolation
 * - Cost event recording and budget usage updates
 * - Threshold warnings and auto-pause on exceed
 * - Duplicate budget prevention
 *
 * Story: STORY-012 — Budget & Governance Backend
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma Mock Setup ────────────────────────────────────────────

const {
  mockBudgetFindFirst,
  mockBudgetCreate,
  mockBudgetUpdate,
  mockBudgetDelete,
  mockBudgetUpdateMany,
  mockCostEventCreate,
  mockCostEventGroupBy,
  mockHeartbeatFindFirst,
  mockHeartbeatFindUnique,
  mockAgentFindFirst,
  mockAgentUpdate,
  mockAgentUpdateMany,
  mockActivityEventCreate,
  mockPrisma,
} = vi.hoisted(() => {
  const mockBudgetFindFirst = vi.fn();
  const mockBudgetCreate = vi.fn();
  const mockBudgetUpdate = vi.fn();
  const mockBudgetDelete = vi.fn();
  const mockBudgetUpdateMany = vi.fn();
  const mockCostEventCreate = vi.fn();
  const mockCostEventGroupBy = vi.fn();
  const mockHeartbeatFindFirst = vi.fn();
  const mockHeartbeatFindUnique = vi.fn();
  const mockAgentFindFirst = vi.fn();
  const mockAgentUpdate = vi.fn();
  const mockAgentUpdateMany = vi.fn();
  const mockActivityEventCreate = vi.fn();

  const mockPrisma = {
    budget: {
      findFirst: mockBudgetFindFirst,
      findMany: vi.fn(),
      create: mockBudgetCreate,
      update: mockBudgetUpdate,
      delete: mockBudgetDelete,
      updateMany: mockBudgetUpdateMany,
    },
    costEvent: {
      create: mockCostEventCreate,
      findMany: vi.fn(),
      groupBy: mockCostEventGroupBy,
    },
    heartbeat: {
      findFirst: mockHeartbeatFindFirst,
      findUnique: mockHeartbeatFindUnique,
    },
    agent: {
      findFirst: mockAgentFindFirst,
      update: mockAgentUpdate,
      updateMany: mockAgentUpdateMany,
    },
    activityEvent: {
      create: mockActivityEventCreate,
    },
  };

  return {
    mockBudgetFindFirst,
    mockBudgetCreate,
    mockBudgetUpdate,
    mockBudgetDelete,
    mockBudgetUpdateMany,
    mockCostEventCreate,
    mockCostEventGroupBy,
    mockHeartbeatFindFirst,
    mockHeartbeatFindUnique,
    mockAgentFindFirst,
    mockAgentUpdate,
    mockAgentUpdateMany,
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
    AGENT_STATUS_CHANGE: 'AGENT_STATUS_CHANGE',
    BUDGET_CREATE: 'BUDGET_CREATE',
    BUDGET_UPDATE: 'BUDGET_UPDATE',
    BUDGET_DELETE: 'BUDGET_DELETE',
  },
}));

// ── Import after mocks ────────────────────────────────────────────

import {
  createBudget,
  updateBudget,
  deleteBudget,
  checkBudgetStatus,
  recordCostEvent,
} from '../service.js';

// ── Test Data ─────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
const AGENT_ID = 'agent-1';
const BUDGET_ID = 'budget-1';
const HEARTBEAT_ID = 'heartbeat-1';

const createMockBudget = (overrides?: Record<string, unknown>) => ({
  id: BUDGET_ID,
  companyId: COMPANY_ID,
  agentId: null,
  monthly: 100.0,
  used: 0.0,
  currency: 'USD',
  threshold: 0.8,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────

describe('Budget Service — CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBudget', () => {
    it('should create a global company budget', async () => {
      // Arrange: no existing budget
      mockBudgetFindFirst.mockResolvedValueOnce(null);
      mockBudgetCreate.mockResolvedValueOnce(createMockBudget());

      // Act
      const result = await createBudget(
        { monthly: 100, currency: 'USD', threshold: 0.8 },
        COMPANY_ID
      );

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(mockBudgetCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            agentId: null,
            monthly: 100,
          }),
        })
      );
    });

    it('should create an agent-specific budget', async () => {
      mockAgentFindFirst.mockResolvedValueOnce({ id: AGENT_ID, companyId: COMPANY_ID });
      mockBudgetFindFirst.mockResolvedValueOnce(null);
      mockBudgetCreate.mockResolvedValueOnce(
        createMockBudget({ agentId: AGENT_ID })
      );

      const result = await createBudget(
        { monthly: 50, agentId: AGENT_ID },
        COMPANY_ID
      );

      expect(result.error).toBeUndefined();
      expect(result.data!.agentId).toBe(AGENT_ID);
    });

    it('should return AGENT_NOT_FOUND when agent does not exist', async () => {
      mockAgentFindFirst.mockResolvedValueOnce(null);

      const result = await createBudget(
        { monthly: 50, agentId: 'nonexistent-agent' },
        COMPANY_ID
      );

      expect(result.error).toBe('AGENT_NOT_FOUND');
    });

    it('should return DUPLICATE_BUDGET when global budget already exists', async () => {
      mockBudgetFindFirst.mockResolvedValueOnce(createMockBudget());

      const result = await createBudget(
        { monthly: 100 },
        COMPANY_ID
      );

      expect(result.error).toBe('DUPLICATE_BUDGET');
    });

    it('should return DUPLICATE_BUDGET when agent budget already exists', async () => {
      mockAgentFindFirst.mockResolvedValueOnce({ id: AGENT_ID, companyId: COMPANY_ID });
      mockBudgetFindFirst.mockResolvedValueOnce(
        createMockBudget({ agentId: AGENT_ID })
      );

      const result = await createBudget(
        { monthly: 50, agentId: AGENT_ID },
        COMPANY_ID
      );

      expect(result.error).toBe('DUPLICATE_BUDGET');
    });
  });

  describe('updateBudget', () => {
    it('should update budget monthly limit', async () => {
      mockBudgetFindFirst.mockResolvedValueOnce(createMockBudget());
      mockBudgetUpdate.mockResolvedValueOnce(
        createMockBudget({ monthly: 200 })
      );

      const result = await updateBudget(BUDGET_ID, { monthly: 200 }, COMPANY_ID);

      expect(result).toBeDefined();
      expect(result!.monthly).toBe(200);
    });

    it('should return null when budget not found', async () => {
      mockBudgetFindFirst.mockResolvedValueOnce(null);

      const result = await updateBudget('nonexistent', { monthly: 200 }, COMPANY_ID);

      expect(result).toBeNull();
    });
  });

  describe('deleteBudget', () => {
    it('should delete a budget', async () => {
      mockBudgetFindFirst.mockResolvedValueOnce(createMockBudget());
      mockBudgetDelete.mockResolvedValueOnce(createMockBudget());

      const result = await deleteBudget(BUDGET_ID, COMPANY_ID);

      expect(result).toBeDefined();
      expect(mockBudgetDelete).toHaveBeenCalledWith({ where: { id: BUDGET_ID } });
    });

    it('should return null when budget not found', async () => {
      mockBudgetFindFirst.mockResolvedValueOnce(null);

      const result = await deleteBudget('nonexistent', COMPANY_ID);

      expect(result).toBeNull();
    });
  });
});

describe('Budget Service — Status Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should report allowed when no budgets exist', async () => {
    mockBudgetFindFirst.mockResolvedValue(null);

    const status = await checkBudgetStatus(COMPANY_ID);

    expect(status.allowed).toBe(true);
    expect(status.exceeded).toBe(false);
    expect(status.warning).toBe(false);
  });

  it('should report allowed when budget is under threshold', async () => {
    mockBudgetFindFirst.mockResolvedValueOnce(
      createMockBudget({ monthly: 100, used: 50, threshold: 0.8 })
    );

    const status = await checkBudgetStatus(COMPANY_ID);

    expect(status.allowed).toBe(true);
    expect(status.exceeded).toBe(false);
    expect(status.warning).toBe(false);
  });

  it('should report warning when budget exceeds threshold', async () => {
    mockBudgetFindFirst.mockResolvedValueOnce(
      createMockBudget({ monthly: 100, used: 85, threshold: 0.8 })
    );

    const status = await checkBudgetStatus(COMPANY_ID);

    expect(status.allowed).toBe(true);
    expect(status.warning).toBe(true);
  });

  it('should report exceeded when budget is fully used', async () => {
    mockBudgetFindFirst.mockResolvedValueOnce(
      createMockBudget({ monthly: 100, used: 100 })
    );

    const status = await checkBudgetStatus(COMPANY_ID);

    expect(status.allowed).toBe(false);
    expect(status.exceeded).toBe(true);
    expect(status.reason).toContain('exceeded');
  });
});

describe('Budget Service — Cost Event Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should record a cost event and update budget', async () => {
    // Heartbeat exists
    mockHeartbeatFindFirst.mockResolvedValueOnce({
      id: HEARTBEAT_ID,
      agentId: AGENT_ID,
      agent: { id: AGENT_ID, name: 'DevBot' },
    });

    // Cost event created
    mockCostEventCreate.mockResolvedValueOnce({
      id: 'cost-event-1',
      heartbeatId: HEARTBEAT_ID,
    });

    // Company budget
    mockBudgetFindFirst.mockResolvedValueOnce(
      createMockBudget({ monthly: 100, used: 50 })
    );
    mockBudgetUpdate.mockResolvedValueOnce({});
    // Agent budget (not found)
    mockBudgetFindFirst.mockResolvedValueOnce(null);

    const result = await recordCostEvent(
      {
        heartbeatId: HEARTBEAT_ID,
        provider: 'openai',
        model: 'gpt-4',
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.05,
      },
      COMPANY_ID
    );

    expect(result.costEvent).toBeDefined();
    expect(mockCostEventCreate).toHaveBeenCalled();
  });

  it('should throw when heartbeat not found', async () => {
    mockHeartbeatFindFirst.mockResolvedValueOnce(null);

    await expect(
      recordCostEvent(
        {
          heartbeatId: 'nonexistent',
          provider: 'openai',
          model: 'gpt-4',
          tokensIn: 100,
          tokensOut: 50,
          cost: 0.05,
        },
        COMPANY_ID
      )
    ).rejects.toThrow('Heartbeat not found');
  });

  it('should warn when budget threshold exceeded', async () => {
    mockHeartbeatFindFirst.mockResolvedValueOnce({
      id: HEARTBEAT_ID,
      agentId: AGENT_ID,
      agent: { id: AGENT_ID, name: 'DevBot' },
    });
    mockCostEventCreate.mockResolvedValueOnce({ id: 'cost-event-2' });

    // Company budget near threshold
    mockBudgetFindFirst.mockResolvedValueOnce(
      createMockBudget({ monthly: 100, used: 79, threshold: 0.8 })
    );
    mockBudgetUpdate.mockResolvedValueOnce({});
    mockBudgetFindFirst.mockResolvedValueOnce(null);

    const result = await recordCostEvent(
      { heartbeatId: HEARTBEAT_ID, provider: 'openai', model: 'gpt-4', tokensIn: 100, tokensOut: 50, cost: 2 },
      COMPANY_ID
    );

    expect(result.budgetWarning).toBe(true);
  });
});

describe('Budget Service — Schema Validation', () => {
  it('should validate createBudgetSchema requires monthly', async () => {
    const { createBudgetSchema } = await import('../schema.js');
    const result = createBudgetSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should validate createBudgetSchema with valid input', async () => {
    const { createBudgetSchema } = await import('../schema.js');
    const result = createBudgetSchema.safeParse({ monthly: 100 });
    expect(result.success).toBe(true);
  });

  it('should validate recordCostEventSchema requires all fields', async () => {
    const { recordCostEventSchema } = await import('../schema.js');
    const result = recordCostEventSchema.safeParse({ heartbeatId: 'h-1' });
    expect(result.success).toBe(false);
  });

  it('should validate recordCostEventSchema with valid input', async () => {
    const { recordCostEventSchema } = await import('../schema.js');
    const result = recordCostEventSchema.safeParse({
      heartbeatId: 'h-1',
      provider: 'openai',
      model: 'gpt-4',
      tokensIn: 100,
      tokensOut: 50,
      cost: 0.05,
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative cost', async () => {
    const { recordCostEventSchema } = await import('../schema.js');
    const result = recordCostEventSchema.safeParse({
      heartbeatId: 'h-1',
      provider: 'openai',
      model: 'gpt-4',
      tokensIn: 100,
      tokensOut: 50,
      cost: -1,
    });
    expect(result.success).toBe(false);
  });
});
