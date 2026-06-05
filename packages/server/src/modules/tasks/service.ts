/**
 * Task service — business logic for Task CRUD, atomic checkout/release,
 * assignment, and commenting.
 *
 * Tasks are actionable items nested under Goals.
 * Supports atomic checkout (lock) and release (unlock) for concurrency control
 * using Prisma's $transaction with SELECT ... FOR UPDATE semantics.
 * Company isolation is enforced via the Goal → Project → Company chain.
 *
 * Architecture reference: docs/architecture/architecture.md §13
 *   "Atomic checkouts must be fast; use PostgreSQL SELECT ... FOR UPDATE
 *   or optimistic locking via Prisma to prevent race conditions."
 */

import prisma from '../../db/client.js';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
  CheckoutTaskInput,
  ReleaseTaskInput,
  AssignTaskInput,
  AddCommentInput,
} from './schema.js';
import type { Prisma } from '@prisma/client';
import { recordActivity, ActivityActions } from '../../utils/activity.js';
import { logger } from '../../utils/logger.js';

// ── Error codes for service results ───────────────────────────────

export type ServiceError =
  | 'NOT_FOUND'
  | 'ALREADY_LOCKED'
  | 'NOT_ASSIGNED'
  | 'AGENT_NOT_FOUND'
  | 'ALREADY_ASSIGNED';

export type ServiceResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: ServiceError };

// ── List ──────────────────────────────────────────────────────────

/**
 * List tasks with optional filters.
 * Company isolation is enforced via Goal → Project → Company.
 */
export async function listTasks(companyId: string, filters?: ListTasksQuery) {
  return prisma.task.findMany({
    where: {
      ...(filters?.goalId && { goalId: filters.goalId }),
      ...(filters?.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.priority && { priority: filters.priority }),
      // Company isolation via Goal → Project chain
      goal: { project: { companyId } },
    },
    include: {
      goal: {
        select: { id: true, name: true, projectId: true },
      },
      assignee: {
        select: { id: true, name: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ── Get by ID ─────────────────────────────────────────────────────

/**
 * Get a single task by ID.
 * Company isolation is enforced via Goal → Project → Company.
 */
export async function getTaskById(id: string, companyId: string) {
  return prisma.task.findFirst({
    where: {
      id,
      goal: { project: { companyId } },
    },
    include: {
      goal: {
        select: { id: true, name: true, project: { select: { id: true, name: true } } },
      },
      assignee: {
        select: { id: true, name: true, role: true },
      },
      heartbeats: {
        orderBy: { startedAt: 'desc' },
        take: 5,
      },
    },
  });
}

// ── Create ────────────────────────────────────────────────────────

/**
 * Create a new task under a goal.
 * Validates that the parent goal's project belongs to the authenticated company.
 */
export async function createTask(data: CreateTaskInput, companyId: string) {
  // Verify the goal belongs to a project in this company
  const goal = await prisma.goal.findFirst({
    where: {
      id: data.goalId,
      project: { companyId },
    },
  });

  if (!goal) {
    return null;
  }

  const task = await prisma.task.create({
    data: {
      goalId: data.goalId,
      assigneeId: data.assigneeId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'BACKLOG',
      priority: data.priority ?? 'MEDIUM',
      artifacts: (data.artifacts as Prisma.InputJsonValue) ?? undefined,
    },
    include: {
      goal: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, role: true } },
    },
  });

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'system',
    action: ActivityActions.TASK_CREATE,
    targetType: 'TASK',
    targetId: task.id,
    metadata: { title: task.title, status: task.status },
  });

  return task;
}

// ── Update ────────────────────────────────────────────────────────

/**
 * Update an existing task.
 * Company isolation is enforced via Goal → Project → Company.
 */
export async function updateTask(id: string, data: UpdateTaskInput, companyId: string) {
  const existing = await prisma.task.findFirst({
    where: {
      id,
      goal: { project: { companyId } },
    },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.artifacts !== undefined && { artifacts: data.artifacts }),
    },
  });

  // Record activity if status changed
  if (data.status && data.status !== existing.status) {
    await recordActivity({
      companyId,
      actorType: 'USER',
      actorId: 'system',
      action: ActivityActions.TASK_STATUS_CHANGE,
      targetType: 'TASK',
      targetId: id,
      metadata: { from: existing.status, to: data.status },
    });
  }

  return updated;
}

// ── Delete ────────────────────────────────────────────────────────

/**
 * Delete a task by ID.
 * Company isolation is enforced via Goal → Project → Company.
 */
export async function deleteTask(id: string, companyId: string) {
  const existing = await prisma.task.findFirst({
    where: {
      id,
      goal: { project: { companyId } },
    },
  });

  if (!existing) {
    return null;
  }

  const deleted = await prisma.task.delete({
    where: { id },
  });

  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'system',
    action: ActivityActions.TASK_DELETE,
    targetType: 'TASK',
    targetId: id,
    metadata: { title: existing.title },
  });

  return deleted;
}

// ── Atomic Checkout ───────────────────────────────────────────────

/**
 * Atomic checkout — lock a task for an agent using Prisma $transaction.
 *
 * Uses `SELECT ... FOR UPDATE` semantics via Prisma's interactive transactions.
 * The task is read with row-level locking, then updated atomically within
 * the same transaction. This prevents race conditions when multiple agents
 * attempt to checkout the same task concurrently.
 *
 * Flow:
 * 1. Begin transaction (serializable read)
 * 2. Find and lock the task row (SELECT ... FOR UPDATE)
 * 3. Verify task exists and belongs to company
 * 4. Check if already locked by another agent
 * 5. Update: set lockedAt, assigneeId, status = IN_PROGRESS
 * 6. Record activity event
 * 7. Commit transaction
 *
 * @param id - Task ID
 * @param data - Contains agentId
 * @param companyId - Company context for tenant isolation
 * @returns ServiceResult with the locked task or an error code
 */
export async function checkoutTask(
  id: string,
  data: CheckoutTaskInput,
  companyId: string
): Promise<ServiceResult<{
  id: string;
  status: string;
  lockedAt: Date | null;
  assigneeId: string | null;
  assignee: { id: string; name: string; role: string } | null;
}>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Lock the task row with SELECT ... FOR UPDATE
      // Using $queryRaw with FOR UPDATE to prevent concurrent modifications
      const [lockedRow] = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          lockedAt: Date | null;
          assigneeId: string | null;
          companyId: string;
        }>
      >`
        SELECT t.id, t.status, t."lockedAt", t."assigneeId",
               gp."companyId"
        FROM "Task" t
        JOIN "Goal" g   ON g.id = t."goalId"
        JOIN "Project" gp ON gp.id = g."projectId"
        WHERE t.id = ${id}
          AND gp."companyId" = ${companyId}
        FOR UPDATE OF t
      `;

      // Step 2: Verify task exists and belongs to company
      if (!lockedRow) {
        return { error: 'NOT_FOUND' as const };
      }

      // Step 3: Check if already locked by another agent
      if (lockedRow.lockedAt && lockedRow.assigneeId !== data.agentId) {
        logger.warn('Task checkout conflict — already locked by another agent', {
          taskId: id,
          requestedBy: data.agentId,
          lockedBy: lockedRow.assigneeId,
          lockedAt: lockedRow.lockedAt,
        });
        return { error: 'ALREADY_LOCKED' as const };
      }

      // Step 4: Perform the checkout update
      const updated = await tx.task.update({
        where: { id },
        data: {
          lockedAt: new Date(),
          assigneeId: data.agentId,
          status: 'IN_PROGRESS',
        },
        include: {
          assignee: { select: { id: true, name: true, role: true } },
        },
      });

      logger.info('Task checked out successfully', {
        taskId: id,
        agentId: data.agentId,
        status: updated.status,
      });

      return { data: updated };
    });

    // Step 5: Record activity (outside transaction to avoid slowing it down)
    if ('data' in result && result.data) {
      await recordActivity({
        companyId,
        actorType: 'AGENT',
        actorId: data.agentId,
        action: ActivityActions.TASK_CHECKOUT,
        targetType: 'TASK',
        targetId: id,
        metadata: { status: 'IN_PROGRESS', lockedAt: result.data.lockedAt },
      });
    }

    return result;
  } catch (err) {
    logger.error('Task checkout failed with error', {
      taskId: id,
      agentId: data.agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Release ───────────────────────────────────────────────────────

/**
 * Release — unlock a task after agent completes work.
 *
 * Uses a transaction to verify ownership and update atomically:
 * 1. Lock the task row (SELECT ... FOR UPDATE)
 * 2. Verify the releasing agent is the current assignee
 * 3. Clear lock, optionally update status and artifacts
 * 4. Record activity event
 *
 * @param id - Task ID
 * @param data - Contains agentId
 * @param companyId - Company context for tenant isolation
 * @param updates - Optional status and artifacts to apply
 * @returns ServiceResult with the released task or an error code
 */
export async function releaseTask(
  id: string,
  data: ReleaseTaskInput,
  companyId: string,
  updates?: { status?: string; artifacts?: unknown }
): Promise<ServiceResult<{
  id: string;
  status: string;
  lockedAt: Date | null;
  assigneeId: string | null;
  assignee: { id: string; name: string; role: string } | null;
}>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Lock the task row
      const [lockedRow] = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          lockedAt: Date | null;
          assigneeId: string | null;
          companyId: string;
        }>
      >`
        SELECT t.id, t.status, t."lockedAt", t."assigneeId",
               gp."companyId"
        FROM "Task" t
        JOIN "Goal" g   ON g.id = t."goalId"
        JOIN "Project" gp ON gp.id = g."projectId"
        WHERE t.id = ${id}
          AND gp."companyId" = ${companyId}
        FOR UPDATE OF t
      `;

      if (!lockedRow) {
        return { error: 'NOT_FOUND' as const };
      }

      // Step 2: Verify ownership
      if (lockedRow.assigneeId !== data.agentId) {
        logger.warn('Task release denied — agent is not the assignee', {
          taskId: id,
          requestedBy: data.agentId,
          assignedTo: lockedRow.assigneeId,
        });
        return { error: 'NOT_ASSIGNED' as const };
      }

      // Step 3: Build update payload
      const updateData: Prisma.TaskUpdateInput = {
        lockedAt: null,
      };
      if (updates?.status) {
        updateData.status = updates.status;
      }
      if (updates?.artifacts) {
        updateData.artifacts = updates.artifacts as Prisma.InputJsonValue;
      }

      // Step 4: Release the task
      const released = await tx.task.update({
        where: { id },
        data: updateData,
        include: {
          assignee: { select: { id: true, name: true, role: true } },
        },
      });

      logger.info('Task released successfully', {
        taskId: id,
        agentId: data.agentId,
        newStatus: released.status,
        hasArtifacts: !!updates?.artifacts,
      });

      return { data: released };
    });

    // Step 5: Record activity (outside transaction)
    if ('data' in result && result.data) {
      await recordActivity({
        companyId,
        actorType: 'AGENT',
        actorId: data.agentId,
        action: ActivityActions.TASK_RELEASE,
        targetType: 'TASK',
        targetId: id,
        metadata: {
          status: result.data.status,
          hasArtifacts: !!updates?.artifacts,
        },
      });
    }

    return result;
  } catch (err) {
    logger.error('Task release failed with error', {
      taskId: id,
      agentId: data.agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Assign ────────────────────────────────────────────────────────

/**
 * Assign a task to an agent.
 *
 * Does not lock the task (use checkoutTask for execution locks).
 * Simply sets the assigneeId so the Heartbeat Engine knows which
 * agent should pick up the task.
 *
 * @param id - Task ID
 * @param data - Contains agentId
 * @param companyId - Company context for tenant isolation
 * @returns ServiceResult with the updated task or an error code
 */
export async function assignTask(
  id: string,
  data: AssignTaskInput,
  companyId: string
): Promise<ServiceResult<{
  id: string;
  assigneeId: string | null;
  assignee: { id: string; name: string; role: string } | null;
}>> {
  // Verify task exists and belongs to company
  const task = await prisma.task.findFirst({
    where: {
      id,
      goal: { project: { companyId } },
    },
  });

  if (!task) {
    return { error: 'NOT_FOUND' as const };
  }

  // Verify the agent exists and belongs to the same company
  const agent = await prisma.agent.findFirst({
    where: {
      id: data.agentId,
      companyId,
    },
  });

  if (!agent) {
    return { error: 'AGENT_NOT_FOUND' as const };
  }

  // Check if already assigned to this agent
  if (task.assigneeId === data.agentId) {
    return { error: 'ALREADY_ASSIGNED' as const };
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { assigneeId: data.agentId },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
    },
  });

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'system',
    action: ActivityActions.TASK_ASSIGN,
    targetType: 'TASK',
    targetId: id,
    metadata: {
      agentId: data.agentId,
      agentName: agent.name,
      previousAssignee: task.assigneeId,
    },
  });

  logger.info('Task assigned', {
    taskId: id,
    agentId: data.agentId,
    agentName: agent.name,
  });

  return { data: updated };
}

// ── Comment ───────────────────────────────────────────────────────

/**
 * Add a comment to a task.
 *
 * Comments are stored as ActivityEvent records with a TASK_COMMENT action.
 * The comment text is stored in the metadata field.
 *
 * @param id - Task ID
 * @param data - Contains actorId, actorType, and comment text
 * @param companyId - Company context for tenant isolation
 * @returns ServiceResult with the created activity event or an error code
 */
export async function addTaskComment(
  id: string,
  data: AddCommentInput,
  companyId: string
): Promise<ServiceResult<{ id: string; createdAt: Date }>> {
  // Verify task exists and belongs to company
  const task = await prisma.task.findFirst({
    where: {
      id,
      goal: { project: { companyId } },
    },
  });

  if (!task) {
    return { error: 'NOT_FOUND' as const };
  }

  // Record the comment as an activity event
  const event = await recordActivity({
    companyId,
    actorType: data.actorType,
    actorId: data.actorId,
    action: ActivityActions.TASK_COMMENT,
    targetType: 'TASK',
    targetId: id,
    metadata: {
      comment: data.comment,
      taskTitle: task.title,
    },
  });

  if (!event) {
    // Activity recording failed — should not happen but handle gracefully
    logger.error('Failed to record task comment', { taskId: id, actorId: data.actorId });
    throw new Error('Failed to record comment');
  }

  logger.info('Task comment added', {
    taskId: id,
    actorId: data.actorId,
    actorType: data.actorType,
    commentLength: data.comment.length,
  });

  return {
    data: {
      id: event.id,
      createdAt: new Date(),
    },
  };
}
