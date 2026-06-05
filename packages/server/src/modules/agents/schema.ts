/**
 * Zod schemas for Agent validation.
 *
 * Mirrors the Prisma Agent model from prisma/schema.prisma.
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────

export const agentRoleSchema = z.enum([
  'CEO',
  'CTO',
  'DEVELOPER',
  'QA',
  'SCRUM_MASTER',
  'PRODUCT_MANAGER',
  'DESIGNER',
]);

export const agentStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'TERMINATED']);

// ── Base schemas ─────────────────────────────────────────────────

/** Schema for creating a new agent (hiring) */
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  role: agentRoleSchema,
  title: z.string().max(255).optional(),
  managerId: z.string().optional(),
  status: agentStatusSchema.default('ACTIVE'),
  config: z
    .object({
      instructions: z.string(),
      tools: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
});

/** Schema for updating an existing agent */
export const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: agentRoleSchema.optional(),
  title: z.string().max(255).optional(),
  managerId: z.string().nullable().optional(),
  status: agentStatusSchema.optional(),
  config: z
    .object({
      instructions: z.string(),
      tools: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
});

/** Schema for agent ID parameter */
export const agentIdParamSchema = z.object({
  id: z.string().min(1, 'Agent ID is required'),
});

/** Schema for listing agents with optional filters */
export const listAgentsQuerySchema = z.object({
  role: agentRoleSchema.optional(),
  status: agentStatusSchema.optional(),
  managerId: z.string().optional(),
});

// ── Inferred types ───────────────────────────────────────────────

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type AgentIdParam = z.infer<typeof agentIdParamSchema>;
export type ListAgentsQuery = z.infer<typeof listAgentsQuerySchema>;
