/**
 * Zod schemas for Task validation.
 *
 * Mirrors the Prisma Task model from prisma/schema.prisma.
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────

export const taskStatusSchema = z.enum([
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'DONE',
]);

export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// ── Base schemas ─────────────────────────────────────────────────

/** Schema for creating a new task */
export const createTaskSchema = z.object({
  goalId: z.string().min(1, 'Goal ID is required'),
  assigneeId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  status: taskStatusSchema.default('BACKLOG'),
  priority: taskPrioritySchema.default('MEDIUM'),
  artifacts: z.any().optional(),
});

/** Schema for updating an existing task */
export const updateTaskSchema = z.object({
  assigneeId: z.string().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  artifacts: z.any().optional(),
});

/** Schema for task ID parameter */
export const taskIdParamSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
});

/** Schema for listing tasks with optional filters */
export const listTasksQuerySchema = z.object({
  goalId: z.string().optional(),
  assigneeId: z.string().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
});

/** Schema for task checkout (atomic lock) */
export const checkoutTaskSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
});

/** Schema for task release (unlock) */
export const releaseTaskSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
});

/** Schema for assigning a task to an agent */
export const assignTaskSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
});

/** Schema for adding a comment to a task */
export const addCommentSchema = z.object({
  actorId: z.string().min(1, 'Actor ID is required'),
  actorType: z.enum(['USER', 'AGENT', 'SYSTEM']).default('AGENT'),
  comment: z.string().min(1, 'Comment is required').max(5000),
});

// ── Inferred types ───────────────────────────────────────────────

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CheckoutTaskInput = z.infer<typeof checkoutTaskSchema>;
export type ReleaseTaskInput = z.infer<typeof releaseTaskSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
