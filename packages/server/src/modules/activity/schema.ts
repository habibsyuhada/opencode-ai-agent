/**
 * Zod schemas for ActivityEvent validation.
 *
 * Mirrors the Prisma ActivityEvent model from prisma/schema.prisma.
 *
 * Architecture reference: docs/architecture/architecture.md §5
 *   "ActivityEvent model, Global audit middleware"
 *
 * PRD reference: docs/prd/prd.md §11
 *   "ActivityEvent: Audit log entry."
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────

/** Actor types for activity events */
export const actorTypeSchema = z.enum(['USER', 'AGENT', 'SYSTEM']);

// ── Request Schemas ──────────────────────────────────────────────

/** Schema for creating an activity event */
export const createActivityEventSchema = z.object({
  actorType: actorTypeSchema,
  actorId: z.string().min(1, 'Actor ID is required'),
  action: z.string().min(1, 'Action is required'),
  targetType: z.string().min(1, 'Target type is required'),
  targetId: z.string().min(1, 'Target ID is required'),
  metadata: z.record(z.unknown()).optional(),
});

/** Schema for listing activity events with filters */
export const listActivityEventsQuerySchema = z.object({
  actorType: actorTypeSchema.optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Schema for activity event ID parameter */
export const activityEventIdParamSchema = z.object({
  id: z.string().min(1, 'Activity Event ID is required'),
});

// ── Inferred Types ───────────────────────────────────────────────

export type ActorType = z.infer<typeof actorTypeSchema>;
export type CreateActivityEventInput = z.infer<typeof createActivityEventSchema>;
export type ListActivityEventsQuery = z.infer<typeof listActivityEventsQuerySchema>;
export type ActivityEventIdParam = z.infer<typeof activityEventIdParamSchema>;
