/**
 * Zod schemas for Routine validation.
 *
 * Mirrors the Prisma Routine and RoutineRun models from prisma/schema.prisma.
 *
 * Architecture reference: docs/architecture/architecture.md §6
 *   "FR-8: Schedules & Routines — Routine model, Cron trigger system"
 *
 * PRD reference: docs/prd/prd.md §11
 *   "Routine — Scheduled job"
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────

/**
 * Concurrency policy for routine execution.
 *
 * Determines what happens when a routine trigger fires while
 * previous runs are still executing:
 * - ALLOW_OVERLAP: Always start a new run (unbounded concurrency)
 * - SKIP_IF_RUNNING: Skip this trigger if any run is still active
 * - QUEUE: Queue the run and execute when a slot opens
 */
export const concurrencyPolicySchema = z.enum([
  'ALLOW_OVERLAP',
  'SKIP_IF_RUNNING',
  'QUEUE',
]);

/**
 * Catch-up policy for missed routine runs.
 *
 * Determines what happens when the scheduler was down and
 * missed scheduled triggers:
 * - SKIP: Ignore missed runs entirely
 * - RUN_ONCE: Run the routine once to catch up (most recent)
 * - RUN_ALL: Run all missed triggers in order
 */
export const catchUpPolicySchema = z.enum([
  'SKIP',
  'RUN_ONCE',
  'RUN_ALL',
]);

/**
 * Routine run execution status.
 */
export const routineRunStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
]);

// ── Request Schemas ──────────────────────────────────────────────

/** Schema for creating a new routine */
export const createRoutineSchema = z.object({
  agentId: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  cron: z.string().min(1, 'Cron expression is required').max(100),
  action: z.string().min(1, 'Action is required').max(500),
  enabled: z.boolean().default(true),
  concurrencyPolicy: concurrencyPolicySchema.default('ALLOW_OVERLAP'),
  catchUpPolicy: catchUpPolicySchema.default('SKIP'),
  maxConcurrentRuns: z.number().int().min(1).max(10).default(1),
  timeoutMs: z.number().int().min(10000).max(3600000).optional(),
});

/** Schema for updating an existing routine */
export const updateRoutineSchema = z.object({
  agentId: z.string().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  cron: z.string().min(1).max(100).optional(),
  action: z.string().min(1).max(500).optional(),
  enabled: z.boolean().optional(),
  concurrencyPolicy: concurrencyPolicySchema.optional(),
  catchUpPolicy: catchUpPolicySchema.optional(),
  maxConcurrentRuns: z.number().int().min(1).max(10).optional(),
  timeoutMs: z.number().int().min(10000).max(3600000).nullable().optional(),
});

/** Schema for routine ID parameter */
export const routineIdParamSchema = z.object({
  id: z.string().min(1, 'Routine ID is required'),
});

/** Schema for listing routines with optional filters */
export const listRoutinesQuerySchema = z.object({
  agentId: z.string().optional(),
  enabled: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Schema for listing routine runs with optional filters */
export const listRoutineRunsQuerySchema = z.object({
  status: routineRunStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Schema for manually triggering a routine */
export const triggerRoutineSchema = z.object({
  /** Optional custom prompt to pass to the triggered execution */
  prompt: z.string().max(50000).optional(),
});

// ── Inferred Types ───────────────────────────────────────────────

export type ConcurrencyPolicy = z.infer<typeof concurrencyPolicySchema>;
export type CatchUpPolicy = z.infer<typeof catchUpPolicySchema>;
export type RoutineRunStatus = z.infer<typeof routineRunStatusSchema>;
export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>;
export type RoutineIdParam = z.infer<typeof routineIdParamSchema>;
export type ListRoutinesQuery = z.infer<typeof listRoutinesQuerySchema>;
export type ListRoutineRunsQuery = z.infer<typeof listRoutineRunsQuerySchema>;
export type TriggerRoutineInput = z.infer<typeof triggerRoutineSchema>;
