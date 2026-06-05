/**
 * Zod schemas for Budget and CostEvent validation.
 *
 * Mirrors the Prisma Budget and CostEvent models from prisma/schema.prisma.
 *
 * Architecture reference: docs/architecture/architecture.md §5
 *   Budget: Financial constraints per agent or global company.
 *   CostEvent: Record of expenditure linked to heartbeats.
 *
 * PRD reference: docs/prd/prd.md §9 (FR-008)
 *   "Track costs per agent/task, enforce monthly limits."
 */

import { z } from 'zod';

// ── Budget Schemas ──────────────────────────────────────────────

/** Schema for creating a new budget */
export const createBudgetSchema = z.object({
  agentId: z.string().optional(), // null = global company budget
  monthly: z.number().positive('Monthly limit must be positive'),
  currency: z.string().length(3, 'Currency must be 3-letter ISO code').default('USD'),
  threshold: z
    .number()
    .min(0.01, 'Threshold must be at least 1%')
    .max(1.0, 'Threshold cannot exceed 100%')
    .default(0.8),
});

/** Schema for updating an existing budget */
export const updateBudgetSchema = z.object({
  monthly: z.number().positive('Monthly limit must be positive').optional(),
  currency: z.string().length(3).optional(),
  threshold: z.number().min(0.01).max(1.0).optional(),
});

/** Schema for budget ID parameter */
export const budgetIdParamSchema = z.object({
  id: z.string().min(1, 'Budget ID is required'),
});

/** Schema for listing budgets with optional filters */
export const listBudgetsQuerySchema = z.object({
  agentId: z.string().optional(),
});

/** Schema for recording a cost event */
export const recordCostEventSchema = z.object({
  heartbeatId: z.string().min(1, 'Heartbeat ID is required'),
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().min(1, 'Model is required'),
  tokensIn: z.number().int().min(0).default(0),
  tokensOut: z.number().int().min(0).default(0),
  cost: z.number().min(0, 'Cost cannot be negative'),
});

/** Schema for listing cost events */
export const listCostEventsQuerySchema = z.object({
  heartbeatId: z.string().optional(),
  agentId: z.string().optional(),
  provider: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Schema for cost breakdown query */
export const costBreakdownQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('month'),
});

// ── Inferred Types ───────────────────────────────────────────────

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type BudgetIdParam = z.infer<typeof budgetIdParamSchema>;
export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>;
export type RecordCostEventInput = z.infer<typeof recordCostEventSchema>;
export type ListCostEventsQuery = z.infer<typeof listCostEventsQuerySchema>;
export type CostBreakdownQuery = z.infer<typeof costBreakdownQuerySchema>;
