/**
 * Budget service — business logic for Budget CRUD, cost tracking,
 * threshold warnings, and auto-pause on exceed.
 *
 * All queries are scoped to the authenticated company via companyId.
 * Supports per-agent and global company budgets.
 *
 * Architecture reference: docs/architecture/architecture.md §5
 *   "Budget, CostEvent models, Server cost parser"
 *
 * PRD reference: docs/prd/prd.md §9 (FR-008)
 *   "Track costs per agent/task, enforce monthly limits,
 *    and trigger auto-pauses on exceedance."
 */

import prisma from '../../db/client.js';
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
  ListBudgetsQuery,
  RecordCostEventInput,
  ListCostEventsQuery,
  CostBreakdownQuery,
} from './schema.js';
import type { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { recordActivity, ActivityActions } from '../../utils/activity.js';

// ── Budget CRUD ─────────────────────────────────────────────────

/**
 * List budgets for a company with optional agent filter.
 */
export async function listBudgets(companyId: string, filters?: ListBudgetsQuery) {
  return prisma.budget.findMany({
    where: {
      companyId,
      ...(filters?.agentId !== undefined && { agentId: filters.agentId ?? null }),
    },
    include: {
      agent: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single budget by ID, scoped to company.
 */
export async function getBudgetById(id: string, companyId: string) {
  return prisma.budget.findFirst({
    where: { id, companyId },
    include: {
      agent: { select: { id: true, name: true, role: true } },
    },
  });
}

/**
 * Create a new budget.
 * Supports both global company budgets (agentId=null) and per-agent budgets.
 */
export async function createBudget(data: CreateBudgetInput, companyId: string) {
  // If agentId is provided, verify the agent belongs to this company
  if (data.agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: data.agentId, companyId },
    });

    if (!agent) {
      return { error: 'AGENT_NOT_FOUND' as const };
    }

    // Check for duplicate agent budget
    const existing = await prisma.budget.findFirst({
      where: { companyId, agentId: data.agentId },
    });

    if (existing) {
      return { error: 'DUPLICATE_BUDGET' as const };
    }
  } else {
    // Check for duplicate global budget
    const existing = await prisma.budget.findFirst({
      where: { companyId, agentId: null },
    });

    if (existing) {
      return { error: 'DUPLICATE_BUDGET' as const };
    }
  }

  const budget = await prisma.budget.create({
    data: {
      companyId,
      agentId: data.agentId ?? null,
      monthly: data.monthly,
      currency: data.currency,
      threshold: data.threshold,
    },
    include: {
      agent: { select: { id: true, name: true, role: true } },
    },
  });

  logger.info('Budget created', {
    budgetId: budget.id,
    companyId,
    agentId: data.agentId,
    monthly: data.monthly,
  });

  return { data: budget };
}

/**
 * Update an existing budget.
 * Scoped to the authenticated company.
 */
export async function updateBudget(id: string, data: UpdateBudgetInput, companyId: string) {
  const existing = await prisma.budget.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.budget.update({
    where: { id },
    data: {
      ...(data.monthly !== undefined && { monthly: data.monthly }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.threshold !== undefined && { threshold: data.threshold }),
    },
    include: {
      agent: { select: { id: true, name: true, role: true } },
    },
  });

  logger.info('Budget updated', { budgetId: id, companyId });

  return updated;
}

/**
 * Delete a budget by ID.
 * Scoped to the authenticated company.
 */
export async function deleteBudget(id: string, companyId: string) {
  const existing = await prisma.budget.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return null;
  }

  const deleted = await prisma.budget.delete({
    where: { id },
  });

  logger.info('Budget deleted', { budgetId: id, companyId });

  return deleted;
}

/**
 * Reset all budget used amounts to zero.
 * Typically called at the start of a new billing period.
 */
export async function resetBudgets(companyId: string): Promise<{ count: number }> {
  const result = await prisma.budget.updateMany({
    where: { companyId },
    data: { used: 0 },
  });

  logger.info('Budgets reset', { companyId, count: result.count });

  return { count: result.count };
}

// ── Cost Event Management ────────────────────────────────────────

/**
 * Record a cost event and update associated budget usage.
 *
 * Creates a CostEvent record linked to a heartbeat, then increments
 * the used amount on both company-level and agent-level budgets.
 * If budget threshold is exceeded, logs a warning.
 * If budget is fully exceeded, the agent can be auto-paused.
 */
export async function recordCostEvent(
  data: RecordCostEventInput,
  companyId: string
): Promise<{ costEvent: unknown; budgetWarning: boolean; budgetExceeded: boolean }> {
  // 1. Verify the heartbeat exists and belongs to this company
  const heartbeat = await prisma.heartbeat.findFirst({
    where: {
      id: data.heartbeatId,
      agent: { companyId },
    },
    include: {
      agent: { select: { id: true, name: true } },
    },
  });

  if (!heartbeat) {
    throw new Error(`Heartbeat not found: ${data.heartbeatId}`);
  }

  // 2. Create the cost event record
  const costEvent = await prisma.costEvent.create({
    data: {
      heartbeatId: data.heartbeatId,
      provider: data.provider,
      model: data.model,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      cost: data.cost,
    },
  });

  // 3. Update budget usage
  let budgetWarning = false;
  let budgetExceeded = false;

  if (data.cost > 0) {
    const updateResult = await updateBudgetUsage(
      companyId,
      heartbeat.agentId,
      data.cost
    );
    budgetWarning = updateResult.warning;
    budgetExceeded = updateResult.exceeded;
  }

  logger.info('Cost event recorded', {
    costEventId: costEvent.id,
    heartbeatId: data.heartbeatId,
    agentId: heartbeat.agentId,
    provider: data.provider,
    model: data.model,
    cost: data.cost,
    budgetWarning,
    budgetExceeded,
  });

  return { costEvent, budgetWarning, budgetExceeded };
}

/**
 * List cost events with optional filters.
 */
export async function listCostEvents(companyId: string, filters?: ListCostEventsQuery) {
  return prisma.costEvent.findMany({
    where: {
      ...(filters?.heartbeatId && { heartbeatId: filters.heartbeatId }),
      ...(filters?.provider && { provider: filters.provider }),
      heartbeat: {
        agent: { companyId },
        ...(filters?.agentId && { agentId: filters.agentId }),
      },
    },
    include: {
      heartbeat: {
        select: {
          id: true,
          agentId: true,
          taskId: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 20,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get cost breakdown by agent for a given time period.
 *
 * Returns per-agent aggregated cost data for the dashboard.
 */
export async function getCostBreakdown(
  companyId: string,
  query: CostBreakdownQuery
) {
  const now = new Date();
  let startDate: Date;

  switch (query.period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  // Get cost events grouped by agent
  const breakdown = await prisma.costEvent.groupBy({
    by: ['heartbeatId'],
    where: {
      createdAt: { gte: startDate },
      heartbeat: { agent: { companyId } },
    },
    _sum: { cost: true, tokensIn: true, tokensOut: true },
    _count: { id: true },
  });

  // Resolve agent IDs from heartbeats and aggregate
  const agentMap = new Map<
    string,
    { agentId: string; agentName: string; totalCost: number; totalTokensIn: number; totalTokensOut: number; eventCount: number }
  >();

  for (const row of breakdown) {
    const heartbeat = await prisma.heartbeat.findUnique({
      where: { id: row.heartbeatId },
      select: { agentId: true, agent: { select: { id: true, name: true } } },
    });

    if (!heartbeat) continue;

    const existing = agentMap.get(heartbeat.agentId);
    if (existing) {
      existing.totalCost += row._sum.cost || 0;
      existing.totalTokensIn += row._sum.tokensIn || 0;
      existing.totalTokensOut += row._sum.tokensOut || 0;
      existing.eventCount += row._count.id;
    } else {
      agentMap.set(heartbeat.agentId, {
        agentId: heartbeat.agentId,
        agentName: heartbeat.agent.name,
        totalCost: row._sum.cost || 0,
        totalTokensIn: row._sum.tokensIn || 0,
        totalTokensOut: row._sum.tokensOut || 0,
        eventCount: row._count.id,
      });
    }
  }

  return Array.from(agentMap.values()).sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Check budget status for a company and optionally an agent.
 * Returns whether execution is allowed and details about the budget state.
 */
export async function checkBudgetStatus(
  companyId: string,
  agentId?: string
): Promise<{
  allowed: boolean;
  companyBudget: { monthly: number; used: number; percentUsed: number } | null;
  agentBudget: { monthly: number; used: number; percentUsed: number } | null;
  warning: boolean;
  exceeded: boolean;
  reason?: string;
}> {
  // Check company-level budget
  const companyBudget = await prisma.budget.findFirst({
    where: { companyId, agentId: null },
  });

  const companyStatus = companyBudget
    ? {
        monthly: companyBudget.monthly,
        used: companyBudget.used,
        percentUsed: companyBudget.monthly > 0 ? companyBudget.used / companyBudget.monthly : 0,
      }
    : null;

  // Check agent-level budget
  const agentBudget = agentId
    ? await prisma.budget.findFirst({ where: { companyId, agentId } })
    : null;

  const agentStatus = agentBudget
    ? {
        monthly: agentBudget.monthly,
        used: agentBudget.used,
        percentUsed: agentBudget.monthly > 0 ? agentBudget.used / agentBudget.monthly : 0,
      }
    : null;

  // Determine if exceeded
  const companyExceeded = companyStatus ? companyStatus.used >= companyStatus.monthly : false;
  const agentExceeded = agentStatus ? agentStatus.used >= agentStatus.monthly : false;
  const exceeded = companyExceeded || agentExceeded;

  // Determine if warning threshold breached
  const companyWarning = companyBudget
    ? companyStatus!.percentUsed >= companyBudget.threshold
    : false;
  const agentWarning = agentBudget
    ? agentStatus!.percentUsed >= agentBudget.threshold
    : false;
  const warning = companyWarning || agentWarning;

  let reason: string | undefined;
  if (companyExceeded) {
    reason = `Company monthly budget exceeded: $${companyStatus!.used.toFixed(2)} / $${companyStatus!.monthly.toFixed(2)}`;
  } else if (agentExceeded) {
    reason = `Agent monthly budget exceeded: $${agentStatus!.used.toFixed(2)} / $${agentStatus!.monthly.toFixed(2)}`;
  }

  return {
    allowed: !exceeded,
    companyBudget: companyStatus,
    agentBudget: agentStatus,
    warning,
    exceeded,
    reason,
  };
}

// ── Internal Helpers ─────────────────────────────────────────────

/**
 * Update budget usage after a cost event.
 *
 * Increments the used amount on both company-level and agent-level budgets.
 * Checks threshold warnings and auto-pauses agents if budget exceeded.
 */
async function updateBudgetUsage(
  companyId: string,
  agentId: string,
  cost: number
): Promise<{ warning: boolean; exceeded: boolean }> {
  let warning = false;
  let exceeded = false;

  try {
    // Update company-level budget
    const companyBudget = await prisma.budget.findFirst({
      where: { companyId, agentId: null },
    });

    if (companyBudget) {
      const newUsed = companyBudget.used + cost;
      await prisma.budget.update({
        where: { id: companyBudget.id },
        data: { used: { increment: cost } },
      });

      // Check thresholds
      const percentUsed = newUsed / companyBudget.monthly;
      if (percentUsed >= 1.0) {
        exceeded = true;
        logger.warn('Company budget exceeded', {
          companyId,
          used: newUsed,
          monthly: companyBudget.monthly,
        });

        // Auto-pause all agents in the company
        await autoPauseAgents(companyId, 'Company budget exceeded');
      } else if (percentUsed >= companyBudget.threshold) {
        warning = true;
        logger.warn('Company budget approaching limit', {
          companyId,
          used: newUsed,
          monthly: companyBudget.monthly,
          threshold: companyBudget.threshold,
          percentUsed: Math.round(percentUsed * 100),
        });
      }
    }

    // Update agent-level budget
    const agentBudget = await prisma.budget.findFirst({
      where: { companyId, agentId },
    });

    if (agentBudget) {
      const newUsed = agentBudget.used + cost;
      await prisma.budget.update({
        where: { id: agentBudget.id },
        data: { used: { increment: cost } },
      });

      // Check thresholds
      const percentUsed = newUsed / agentBudget.monthly;
      if (percentUsed >= 1.0) {
        exceeded = true;
        logger.warn('Agent budget exceeded', {
          agentId,
          companyId,
          used: newUsed,
          monthly: agentBudget.monthly,
        });

        // Auto-pause this specific agent
        await autoPauseAgent(agentId, 'Agent budget exceeded');
      } else if (percentUsed >= agentBudget.threshold) {
        warning = true;
        logger.warn('Agent budget approaching limit', {
          agentId,
          companyId,
          used: newUsed,
          monthly: agentBudget.monthly,
          threshold: agentBudget.threshold,
          percentUsed: Math.round(percentUsed * 100),
        });
      }
    }
  } catch (err) {
    logger.error('Failed to update budget usage', {
      companyId,
      agentId,
      cost,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { warning, exceeded };
}

/**
 * Auto-pause all active agents in a company when the company budget is exceeded.
 */
async function autoPauseAgents(companyId: string, reason: string): Promise<void> {
  try {
    const result = await prisma.agent.updateMany({
      where: { companyId, status: 'ACTIVE' },
      data: { status: 'PAUSED' },
    });

    if (result.count > 0) {
      logger.warn('Auto-paused agents due to budget exceedance', {
        companyId,
        count: result.count,
        reason,
      });

      // Record activity for each paused agent
      await recordActivity({
        companyId,
        actorType: 'SYSTEM',
        actorId: 'budget-enforcer',
        action: ActivityActions.AGENT_STATUS_CHANGE,
        targetType: 'AGENT',
        targetId: companyId, // Bulk operation
        metadata: {
          reason,
          pausedCount: result.count,
          from: 'ACTIVE',
          to: 'PAUSED',
        },
      });
    }
  } catch (err) {
    logger.error('Failed to auto-pause agents', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Auto-pause a single agent when their individual budget is exceeded.
 */
async function autoPauseAgent(agentId: string, reason: string): Promise<void> {
  try {
    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: { status: 'PAUSED' },
    });

    logger.warn('Auto-paused agent due to budget exceedance', {
      agentId,
      reason,
    });

    await recordActivity({
      companyId: agent.companyId,
      actorType: 'SYSTEM',
      actorId: 'budget-enforcer',
      action: ActivityActions.AGENT_STATUS_CHANGE,
      targetType: 'AGENT',
      targetId: agentId,
      metadata: {
        reason,
        from: 'ACTIVE',
        to: 'PAUSED',
      },
    });
  } catch (err) {
    logger.error('Failed to auto-pause agent', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
