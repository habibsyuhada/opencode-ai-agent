/**
 * Zod schemas for Heartbeat validation.
 *
 * Mirrors the Prisma Heartbeat model from prisma/schema.prisma
 * and defines request/response schemas for the heartbeat API endpoints.
 *
 * Architecture reference: docs/architecture/architecture.md §7
 * "POST /api/agents/:agentId/heartbeat — Triggers immediate execution loop"
 * "GET /api/heartbeats/:id — Polls status"
 *
 * STORY-009: Enhanced with trigger types, budget checks, and recovery schemas.
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────

/**
 * Heartbeat execution status.
 * Maps to the Heartbeat model's status field.
 */
export const heartbeatStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'PAUSED_FOR_APPROVAL',
]);

/**
 * Heartbeat trigger type.
 *
 * Determines how the heartbeat was initiated:
 * - MANUAL: Explicitly triggered via API (e.g., user clicks "Run")
 * - SCHEDULED: Triggered by the cron scheduler (Routine model)
 * - EVENT: Triggered by a system event (e.g., task assigned, status change)
 */
export const triggerTypeSchema = z.enum([
  'MANUAL',
  'SCHEDULED',
  'EVENT',
]);

// ── Request Schemas ──────────────────────────────────────────────

/**
 * Schema for triggering a new heartbeat execution.
 *
 * POST /api/agents/:agentId/heartbeat
 */
export const triggerHeartbeatSchema = z.object({
  /** The task ID to execute */
  taskId: z.string().min(1, 'Task ID is required'),

  /** Optional custom prompt override (defaults to task description) */
  prompt: z.string().max(50000).optional(),

  /** Optional timeout in milliseconds (defaults to 300000 = 5 minutes) */
  timeoutMs: z
    .number()
    .int()
    .min(10000, 'Minimum timeout is 10 seconds')
    .max(3600000, 'Maximum timeout is 1 hour')
    .optional(),

  /** Optional context files to include in the execution */
  contextFiles: z.array(z.string()).optional(),

  /** Trigger type — how this heartbeat was initiated (default: MANUAL) */
  triggerType: triggerTypeSchema.default('MANUAL'),
});

/**
 * Schema for triggering a heartbeat with automatic task resolution.
 *
 * POST /api/agents/:agentId/heartbeat/auto
 *
 * Instead of specifying a taskId, the engine automatically picks
 * the next available task from the agent's queue (assigned tasks
 * in TODO or IN_PROGRESS status).
 */
export const autoTriggerHeartbeatSchema = z.object({
  /** Optional custom prompt override */
  prompt: z.string().max(50000).optional(),

  /** Optional timeout in milliseconds */
  timeoutMs: z
    .number()
    .int()
    .min(10000, 'Minimum timeout is 10 seconds')
    .max(3600000, 'Maximum timeout is 1 hour')
    .optional(),

  /** Optional context files to include */
  contextFiles: z.array(z.string()).optional(),

  /** Trigger type (default: SCHEDULED for auto-pick) */
  triggerType: triggerTypeSchema.default('SCHEDULED'),
});

/**
 * Schema for the heartbeat ID parameter.
 */
export const heartbeatIdParamSchema = z.object({
  id: z.string().min(1, 'Heartbeat ID is required'),
});

/**
 * Schema for the agent ID parameter (used in trigger endpoint).
 */
export const agentIdParamSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
});

/**
 * Schema for listing heartbeats with optional filters.
 *
 * GET /api/heartbeats
 */
export const listHeartbeatsQuerySchema = z.object({
  agentId: z.string().optional(),
  taskId: z.string().optional(),
  status: heartbeatStatusSchema.optional(),
  triggerType: triggerTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Schema for orphaned run recovery.
 *
 * POST /api/heartbeats/recover
 *
 * Finds and cleans up heartbeat runs stuck in RUNNING status
 * beyond the configured timeout threshold.
 */
export const recoverOrphansSchema = z.object({
  /** Maximum age in minutes before a RUNNING heartbeat is considered orphaned (default: 10) */
  staleMinutes: z.coerce.number().int().min(1).max(1440).default(10),
});

// ── Response Schemas ─────────────────────────────────────────────

/**
 * Schema for a heartbeat status response.
 *
 * Returned by GET /api/heartbeats/:id
 */
export const heartbeatResponseSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  agentId: z.string(),
  status: heartbeatStatusSchema,
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  log: z.string().nullable(),
  tokensUsed: z.number(),
  cost: z.number(),
  createdAt: z.string(),
});

/**
 * Schema for a heartbeat trigger response.
 *
 * Returned by POST /api/agents/:agentId/heartbeat
 */
export const triggerHeartbeatResponseSchema = z.object({
  heartbeatId: z.string(),
  status: heartbeatStatusSchema,
  message: z.string(),
});

/**
 * Schema for orphan recovery response.
 *
 * Returned by POST /api/heartbeats/recover
 */
export const recoverOrphansResponseSchema = z.object({
  recovered: z.number(),
  failed: z.number(),
  heartbeats: z.array(z.object({
    id: z.string(),
    taskId: z.string(),
    agentId: z.string(),
    status: z.string(),
  })),
});

// ── Inferred Types ───────────────────────────────────────────────

export type HeartbeatStatus = z.infer<typeof heartbeatStatusSchema>;
export type TriggerType = z.infer<typeof triggerTypeSchema>;
export type TriggerHeartbeatInput = z.infer<typeof triggerHeartbeatSchema>;
export type AutoTriggerHeartbeatInput = z.infer<typeof autoTriggerHeartbeatSchema>;
export type HeartbeatIdParam = z.infer<typeof heartbeatIdParamSchema>;
export type AgentIdParam = z.infer<typeof agentIdParamSchema>;
export type ListHeartbeatsQuery = z.infer<typeof listHeartbeatsQuerySchema>;
export type RecoverOrphansInput = z.infer<typeof recoverOrphansSchema>;
export type HeartbeatResponse = z.infer<typeof heartbeatResponseSchema>;
export type TriggerHeartbeatResponse = z.infer<typeof triggerHeartbeatResponseSchema>;
export type RecoverOrphansResponse = z.infer<typeof recoverOrphansResponseSchema>;
