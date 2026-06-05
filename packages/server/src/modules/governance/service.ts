/**
 * Governance service — business logic for Approval workflows and decision tracking.
 *
 * Approvals are governance gates that require human (or system) intervention
 * before critical actions can proceed. All queries are scoped to the
 * authenticated company via companyId.
 *
 * Architecture reference: docs/architecture/architecture.md §5
 *   "Approval model, Auth middleware"
 *
 * PRD reference: docs/prd/prd.md §9 (FR-009)
 *   "Implement approval workflows for critical agent actions."
 */

import prisma from '../../db/client.js';
import type {
  CreateApprovalInput,
  DecideApprovalInput,
  ListApprovalsQuery,
} from './schema.js';
import { logger } from '../../utils/logger.js';
import { recordActivity, ActivityActions } from '../../utils/activity.js';
import { resumeHeartbeatForApproval } from '../heartbeat/service.js';

// ── Approval CRUD ───────────────────────────────────────────────

/**
 * List approvals for a company with optional filters.
 */
export async function listApprovals(companyId: string, filters?: ListApprovalsQuery) {
  return prisma.approval.findMany({
    where: {
      companyId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.type && { type: filters.type }),
      ...(filters?.requestedBy && { requestedBy: filters.requestedBy }),
      ...(filters?.targetType && { targetType: filters.targetType }),
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 20,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get a single approval by ID, scoped to company.
 */
export async function getApprovalById(id: string, companyId: string) {
  return prisma.approval.findFirst({
    where: { id, companyId },
  });
}

/**
 * Create a new approval request.
 *
 * Creates a PENDING approval that requires human intervention.
 * Records an activity event for the audit trail.
 */
export async function createApproval(data: CreateApprovalInput, companyId: string) {
  const approval = await prisma.approval.create({
    data: {
      companyId,
      type: data.type,
      requestedBy: data.requestedBy,
      targetType: data.targetType,
      targetId: data.targetId,
      status: 'PENDING',
      reason: data.reason ?? null,
    },
  });

  logger.info('Approval request created', {
    approvalId: approval.id,
    companyId,
    type: data.type,
    requestedBy: data.requestedBy,
    targetType: data.targetType,
    targetId: data.targetId,
  });

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'AGENT',
    actorId: data.requestedBy,
    action: ActivityActions.APPROVAL_REQUEST,
    targetType: 'APPROVAL',
    targetId: approval.id,
    metadata: {
      type: data.type,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
    },
  });

  return approval;
}

/**
 * Make a decision on an approval request.
 *
 * Updates the approval status to APPROVED or REJECTED.
 * Only PENDING approvals can be decided.
 * Records an activity event for the audit trail.
 */
export async function decideApproval(
  id: string,
  data: DecideApprovalInput,
  companyId: string
) {
  // Verify approval exists and is pending
  const existing = await prisma.approval.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return { error: 'NOT_FOUND' as const };
  }

  if (existing.status !== 'PENDING') {
    return { error: 'ALREADY_DECIDED' as const };
  }

  const updated = await prisma.approval.update({
    where: { id },
    data: {
      status: data.decision,
      decision: data.decision,
      reason: data.reason ?? existing.reason,
    },
  });

  logger.info('Approval decision made', {
    approvalId: id,
    companyId,
    decision: data.decision,
    reason: data.reason,
  });

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'system', // In real impl, this would be the authenticated user
    action: ActivityActions.APPROVAL_DECISION,
    targetType: 'APPROVAL',
    targetId: id,
    metadata: {
      decision: data.decision,
      reason: data.reason,
      originalType: existing.type,
      originalRequestedBy: existing.requestedBy,
    },
  });

  // Resume any heartbeats paused for this approval
  // This implements STORY-014: "PAUSED_FOR_APPROVAL" state
  if (existing.targetType === 'TASK') {
    await resumeHeartbeatForApproval(id, data.decision as 'APPROVED' | 'REJECTED', companyId);
  }

  return { data: updated };
}

/**
 * Delete an approval by ID.
 * Only PENDING approvals can be cancelled/deleted.
 */
export async function deleteApproval(id: string, companyId: string) {
  const existing = await prisma.approval.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return null;
  }

  if (existing.status !== 'PENDING') {
    return { error: 'ALREADY_DECIDED' as const };
  }

  const deleted = await prisma.approval.delete({
    where: { id },
  });

  logger.info('Approval deleted', { approvalId: id, companyId });

  return { data: deleted };
}

/**
 * Get approval statistics for a company.
 *
 * Returns counts by status and type for the governance dashboard.
 */
export async function getApprovalStats(companyId: string) {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.approval.count({ where: { companyId } }),
    prisma.approval.count({ where: { companyId, status: 'PENDING' } }),
    prisma.approval.count({ where: { companyId, status: 'APPROVED' } }),
    prisma.approval.count({ where: { companyId, status: 'REJECTED' } }),
  ]);

  // Get breakdown by type
  const byType = await prisma.approval.groupBy({
    by: ['type'],
    where: { companyId },
    _count: { id: true },
  });

  return {
    total,
    pending,
    approved,
    rejected,
    byType: byType.map((row) => ({
      type: row.type,
      count: row._count.id,
    })),
  };
}
