/**
 * Zod schemas for Approval (Governance) validation.
 *
 * Mirrors the Prisma Approval model from prisma/schema.prisma.
 *
 * Architecture reference: docs/architecture/architecture.md §5
 *   "Approval model, Auth middleware"
 *
 * PRD reference: docs/prd/prd.md §9 (FR-009)
 *   "Implement approval workflows for critical agent actions."
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────

/** Approval status lifecycle */
export const approvalStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

/** Types of approvals supported */
export const approvalTypeSchema = z.enum([
  'DEPLOY',
  'BUDGET_INCREASE',
  'ROLE_CHANGE',
  'TASK_OVERRIDE',
  'CONFIG_CHANGE',
  'CUSTOM',
]);

// ── Request Schemas ──────────────────────────────────────────────

/** Schema for creating a new approval request */
export const createApprovalSchema = z.object({
  type: approvalTypeSchema,
  requestedBy: z.string().min(1, 'RequestedBy is required'),
  targetType: z.string().min(1, 'Target type is required'),
  targetId: z.string().min(1, 'Target ID is required'),
  reason: z.string().max(5000).optional(),
});

/** Schema for making a decision on an approval */
export const decideApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().max(5000).optional(),
});

/** Schema for approval ID parameter */
export const approvalIdParamSchema = z.object({
  id: z.string().min(1, 'Approval ID is required'),
});

/** Schema for listing approvals with optional filters */
export const listApprovalsQuerySchema = z.object({
  status: approvalStatusSchema.optional(),
  type: approvalTypeSchema.optional(),
  requestedBy: z.string().optional(),
  targetType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Inferred Types ───────────────────────────────────────────────

export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type ApprovalType = z.infer<typeof approvalTypeSchema>;
export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;
export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;
export type ApprovalIdParam = z.infer<typeof approvalIdParamSchema>;
export type ListApprovalsQuery = z.infer<typeof listApprovalsQuerySchema>;
