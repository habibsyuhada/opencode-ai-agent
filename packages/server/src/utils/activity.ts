/**
 * Activity recording utility — centralised audit logging for the ArmiAI Platform.
 *
 * Wraps Prisma's ActivityEvent model to provide a clean API for recording
 * actions across all modules. Every significant state change (task checkout,
 * release, assignment, comment, approval, etc.) is recorded here.
 *
 * Architecture reference: docs/architecture/architecture.md §6
 *   ActivityEvent: Audit log entry. id, companyId, actorType, actorId,
 *   action, targetType, targetId, metadata.
 */

import prisma from '../db/client.js';
import type { Prisma } from '@prisma/client';

/**
 * Valid actor types for activity events.
 */
export type ActorType = 'USER' | 'AGENT' | 'SYSTEM';

/**
 * Valid target types for activity events.
 */
export type TargetType = 'TASK' | 'AGENT' | 'PROJECT' | 'GOAL' | 'HEARTBEAT' | 'APPROVAL' | 'BUDGET' | 'ROUTINE' | 'SECRET';

/**
 * Input for recording an activity event.
 */
export interface RecordActivityInput {
  /** The company this activity belongs to (tenant isolation) */
  companyId: string;
  /** Who performed the action */
  actorType: ActorType;
  /** ID of the actor (user ID, agent ID, or 'system') */
  actorId: string;
  /** What happened (e.g., 'TASK_CHECKOUT', 'TASK_RELEASE', 'TASK_ASSIGN', 'TASK_COMMENT') */
  action: string;
  /** Type of entity affected */
  targetType: TargetType;
  /** ID of the entity affected */
  targetId: string;
  /** Optional additional data (e.g., { status: 'IN_PROGRESS', comment: '...' }) */
  metadata?: Record<string, unknown>;
}

/**
 * Record an activity event in the audit log.
 *
 * This is a fire-and-forget utility — it should never block the caller.
 * If the recording fails, the error is logged but not propagated.
 *
 * @param input - Activity event data
 * @returns The created ActivityEvent, or null if recording failed
 *
 * @example
 * ```ts
 * await recordActivity({
 *   companyId: 'company-1',
 *   actorType: 'AGENT',
 *   actorId: 'agent-1',
 *   action: 'TASK_CHECKOUT',
 *   targetType: 'TASK',
 *   targetId: 'task-1',
 *   metadata: { status: 'IN_PROGRESS' },
 * });
 * ```
 */
export async function recordActivity(
  input: RecordActivityInput
): Promise<{ id: string } | null> {
  try {
    const event = await prisma.activityEvent.create({
      data: {
        companyId: input.companyId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
      select: { id: true },
    });

    return event;
  } catch (err) {
    // Activity recording should never crash the caller.
    // Log the error for diagnostics but don't propagate.
    console.error('[activity] Failed to record activity event', {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Predefined activity action constants.
 *
 * Using constants prevents typos and enables grep-ability across the codebase.
 */
export const ActivityActions = {
  // Task lifecycle
  TASK_CHECKOUT: 'TASK_CHECKOUT',
  TASK_RELEASE: 'TASK_RELEASE',
  TASK_ASSIGN: 'TASK_ASSIGN',
  TASK_COMMENT: 'TASK_COMMENT',
  TASK_CREATE: 'TASK_CREATE',
  TASK_UPDATE: 'TASK_UPDATE',
  TASK_DELETE: 'TASK_DELETE',
  TASK_STATUS_CHANGE: 'TASK_STATUS_CHANGE',

  // Agent lifecycle
  AGENT_CREATE: 'AGENT_CREATE',
  AGENT_UPDATE: 'AGENT_UPDATE',
  AGENT_STATUS_CHANGE: 'AGENT_STATUS_CHANGE',

  // Heartbeat lifecycle
  HEARTBEAT_START: 'HEARTBEAT_START',
  HEARTBEAT_COMPLETE: 'HEARTBEAT_COMPLETE',
  HEARTBEAT_FAIL: 'HEARTBEAT_FAIL',

  // Approval lifecycle
  APPROVAL_REQUEST: 'APPROVAL_REQUEST',
  APPROVAL_DECISION: 'APPROVAL_DECISION',

  // Budget lifecycle
  BUDGET_CREATE: 'BUDGET_CREATE',
  BUDGET_UPDATE: 'BUDGET_UPDATE',
  BUDGET_DELETE: 'BUDGET_DELETE',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  BUDGET_WARNING: 'BUDGET_WARNING',
  COST_EVENT: 'COST_EVENT',

  // Routine lifecycle
  ROUTINE_CREATE: 'ROUTINE_CREATE',
  ROUTINE_UPDATE: 'ROUTINE_UPDATE',
  ROUTINE_DELETE: 'ROUTINE_DELETE',
  ROUTINE_RUN: 'ROUTINE_RUN',
  ROUTINE_RUN_COMPLETE: 'ROUTINE_RUN_COMPLETE',
  ROUTINE_RUN_FAIL: 'ROUTINE_RUN_FAIL',
  ROUTINE_RUN_SKIP: 'ROUTINE_RUN_SKIP',

  // Secret lifecycle
  SECRET_CREATE: 'SECRET_CREATE',
  SECRET_DELETE: 'SECRET_DELETE',
} as const;

export default recordActivity;
