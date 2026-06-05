/**
 * Tests for the Governance service — Approval workflows, decision tracking.
 *
 * These tests mock Prisma to verify the service logic without a real database.
 * Focus areas:
 * - Approval CRUD with company isolation
 * - Decision workflow (approve/reject)
 * - Preventing double-decisions
 * - Statistics aggregation
 *
 * Story: STORY-012 — Budget & Governance Backend
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma Mock Setup ────────────────────────────────────────────

const {
  mockApprovalFindFirst,
  mockApprovalCreate,
  mockApprovalUpdate,
  mockApprovalDelete,
  mockApprovalCount,
  mockApprovalGroupBy,
  mockActivityEventCreate,
  mockPrisma,
} = vi.hoisted(() => {
  const mockApprovalFindFirst = vi.fn();
  const mockApprovalCreate = vi.fn();
  const mockApprovalUpdate = vi.fn();
  const mockApprovalDelete = vi.fn();
  const mockApprovalCount = vi.fn();
  const mockApprovalGroupBy = vi.fn();
  const mockActivityEventCreate = vi.fn();

  const mockPrisma = {
    approval: {
      findFirst: mockApprovalFindFirst,
      findMany: vi.fn(),
      create: mockApprovalCreate,
      update: mockApprovalUpdate,
      delete: mockApprovalDelete,
      count: mockApprovalCount,
      groupBy: mockApprovalGroupBy,
    },
    activityEvent: {
      create: mockActivityEventCreate,
    },
  };

  return {
    mockApprovalFindFirst,
    mockApprovalCreate,
    mockApprovalUpdate,
    mockApprovalDelete,
    mockApprovalCount,
    mockApprovalGroupBy,
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
    APPROVAL_REQUEST: 'APPROVAL_REQUEST',
    APPROVAL_DECISION: 'APPROVAL_DECISION',
  },
}));

// ── Import after mocks ────────────────────────────────────────────

import {
  createApproval,
  decideApproval,
  deleteApproval,
  getApprovalStats,
} from '../service.js';

// ── Test Data ─────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
const APPROVAL_ID = 'approval-1';
const AGENT_ID = 'agent-1';

const createMockApproval = (overrides?: Record<string, unknown>) => ({
  id: APPROVAL_ID,
  companyId: COMPANY_ID,
  type: 'DEPLOY',
  requestedBy: AGENT_ID,
  targetType: 'TASK',
  targetId: 'task-1',
  status: 'PENDING',
  decision: null,
  reason: 'Need approval for deployment',
  createdAt: new Date('2026-06-04T12:00:00Z'),
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────

describe('Governance Service — Approval CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createApproval', () => {
    it('should create an approval request', async () => {
      mockApprovalCreate.mockResolvedValueOnce(createMockApproval());

      const result = await createApproval(
        {
          type: 'DEPLOY',
          requestedBy: AGENT_ID,
          targetType: 'TASK',
          targetId: 'task-1',
          reason: 'Need approval for deployment',
        },
        COMPANY_ID
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(mockApprovalCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            type: 'DEPLOY',
            requestedBy: AGENT_ID,
            status: 'PENDING',
          }),
        })
      );
    });

    it('should record an activity event on creation', async () => {
      mockApprovalCreate.mockResolvedValueOnce(createMockApproval());

      await createApproval(
        {
          type: 'DEPLOY',
          requestedBy: AGENT_ID,
          targetType: 'TASK',
          targetId: 'task-1',
        },
        COMPANY_ID
      );

      const { recordActivity } = await import('../../../utils/activity.js');
      expect(recordActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROVAL_REQUEST',
          targetType: 'APPROVAL',
        })
      );
    });
  });

  describe('decideApproval', () => {
    it('should approve a pending approval', async () => {
      mockApprovalFindFirst.mockResolvedValueOnce(createMockApproval());
      mockApprovalUpdate.mockResolvedValueOnce(
        createMockApproval({ status: 'APPROVED', decision: 'APPROVED' })
      );

      const result = await decideApproval(
        APPROVAL_ID,
        { decision: 'APPROVED', reason: 'Looks good' },
        COMPANY_ID
      );

      expect(result.error).toBeUndefined();
      expect(result.data!.status).toBe('APPROVED');
    });

    it('should reject a pending approval', async () => {
      mockApprovalFindFirst.mockResolvedValueOnce(createMockApproval());
      mockApprovalUpdate.mockResolvedValueOnce(
        createMockApproval({ status: 'REJECTED', decision: 'REJECTED' })
      );

      const result = await decideApproval(
        APPROVAL_ID,
        { decision: 'REJECTED', reason: 'Needs changes' },
        COMPANY_ID
      );

      expect(result.error).toBeUndefined();
      expect(result.data!.status).toBe('REJECTED');
    });

    it('should return NOT_FOUND when approval does not exist', async () => {
      mockApprovalFindFirst.mockResolvedValueOnce(null);

      const result = await decideApproval(
        'nonexistent',
        { decision: 'APPROVED' },
        COMPANY_ID
      );

      expect(result.error).toBe('NOT_FOUND');
    });

    it('should return ALREADY_DECIDED when approval is not pending', async () => {
      mockApprovalFindFirst.mockResolvedValueOnce(
        createMockApproval({ status: 'APPROVED' })
      );

      const result = await decideApproval(
        APPROVAL_ID,
        { decision: 'REJECTED' },
        COMPANY_ID
      );

      expect(result.error).toBe('ALREADY_DECIDED');
    });
  });

  describe('deleteApproval', () => {
    it('should delete a pending approval', async () => {
      mockApprovalFindFirst.mockResolvedValueOnce(createMockApproval());
      mockApprovalDelete.mockResolvedValueOnce(createMockApproval());

      const result = await deleteApproval(APPROVAL_ID, COMPANY_ID);

      expect(result).toBeDefined();
      expect('data' in result!).toBe(true);
    });

    it('should return null when approval not found', async () => {
      mockApprovalFindFirst.mockResolvedValueOnce(null);

      const result = await deleteApproval('nonexistent', COMPANY_ID);

      expect(result).toBeNull();
    });

    it('should return ALREADY_DECIDED for non-pending approvals', async () => {
      mockApprovalFindFirst.mockResolvedValueOnce(
        createMockApproval({ status: 'APPROVED' })
      );

      const result = await deleteApproval(APPROVAL_ID, COMPANY_ID);

      expect(result).toBeDefined();
      expect('error' in result! && result.error).toBe('ALREADY_DECIDED');
    });
  });
});

describe('Governance Service — Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return approval statistics', async () => {
    mockApprovalCount.mockResolvedValue(10);
    mockApprovalCount.mockResolvedValueOnce(10); // total
    mockApprovalCount.mockResolvedValueOnce(3); // pending
    mockApprovalCount.mockResolvedValueOnce(5); // approved
    mockApprovalCount.mockResolvedValueOnce(2); // rejected
    mockApprovalGroupBy.mockResolvedValueOnce([
      { type: 'DEPLOY', _count: { id: 6 } },
      { type: 'BUDGET_INCREASE', _count: { id: 4 } },
    ]);

    const stats = await getApprovalStats(COMPANY_ID);

    expect(stats.total).toBe(10);
    expect(stats.pending).toBe(3);
    expect(stats.approved).toBe(5);
    expect(stats.rejected).toBe(2);
    expect(stats.byType).toHaveLength(2);
  });
});

describe('Governance Service — Schema Validation', () => {
  it('should validate createApprovalSchema requires type and requestedBy', async () => {
    const { createApprovalSchema } = await import('../schema.js');
    const result = createApprovalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should validate createApprovalSchema with valid input', async () => {
    const { createApprovalSchema } = await import('../schema.js');
    const result = createApprovalSchema.safeParse({
      type: 'DEPLOY',
      requestedBy: 'agent-1',
      targetType: 'TASK',
      targetId: 'task-1',
    });
    expect(result.success).toBe(true);
  });

  it('should validate decideApprovalSchema requires decision', async () => {
    const { decideApprovalSchema } = await import('../schema.js');
    const result = decideApprovalSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should validate decideApprovalSchema with valid input', async () => {
    const { decideApprovalSchema } = await import('../schema.js');
    const result = decideApprovalSchema.safeParse({ decision: 'APPROVED' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid approval type', async () => {
    const { createApprovalSchema } = await import('../schema.js');
    const result = createApprovalSchema.safeParse({
      type: 'INVALID_TYPE',
      requestedBy: 'agent-1',
      targetType: 'TASK',
      targetId: 'task-1',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid approval types', async () => {
    const { createApprovalSchema } = await import('../schema.js');
    const validTypes = ['DEPLOY', 'BUDGET_INCREASE', 'ROLE_CHANGE', 'TASK_OVERRIDE', 'CONFIG_CHANGE', 'CUSTOM'];

    for (const type of validTypes) {
      const result = createApprovalSchema.safeParse({
        type,
        requestedBy: 'agent-1',
        targetType: 'TASK',
        targetId: 'task-1',
      });
      expect(result.success).toBe(true);
    }
  });
});
