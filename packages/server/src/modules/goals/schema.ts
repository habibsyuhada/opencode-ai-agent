/**
 * Zod schemas for Goal validation.
 *
 * Mirrors the Prisma Goal model from prisma/schema.prisma.
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────

export const goalStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']);

// ── Base schemas ─────────────────────────────────────────────────

/** Schema for creating a new goal */
export const createGoalSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  name: z.string().min(1, 'Name is required').max(500),
  status: goalStatusSchema.default('PENDING'),
});

/** Schema for updating an existing goal */
export const updateGoalSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  status: goalStatusSchema.optional(),
});

/** Schema for goal ID parameter */
export const goalIdParamSchema = z.object({
  id: z.string().min(1, 'Goal ID is required'),
});

/** Schema for listing goals with optional filters */
export const listGoalsQuerySchema = z.object({
  projectId: z.string().optional(),
  status: goalStatusSchema.optional(),
});

// ── Inferred types ───────────────────────────────────────────────

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type GoalIdParam = z.infer<typeof goalIdParamSchema>;
export type ListGoalsQuery = z.infer<typeof listGoalsQuerySchema>;
