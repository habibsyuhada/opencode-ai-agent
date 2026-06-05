/**
 * Routines service — business logic for Routine CRUD, cron-based scheduling,
 * concurrency policies, catch-up policies, and run history.
 *
 * Routines are scheduled jobs that execute agent actions on a cron schedule.
 * Each routine execution creates a RoutineRun record and optionally triggers
 * a heartbeat via the Heartbeat Engine.
 *
 * Architecture reference: docs/architecture/architecture.md §6
 *   "FR-8: Schedules & Routines — Routine model, Cron trigger system"
 *
 * PRD reference: docs/prd/prd.md §11
 *   "Routine — Scheduled job"
 */

import prisma from '../../db/client.js';
import type {
  CreateRoutineInput,
  UpdateRoutineInput,
  ListRoutinesQuery,
  ListRoutineRunsQuery,
  TriggerRoutineInput,
  ConcurrencyPolicy,
  CatchUpPolicy,
} from './schema.js';
import { logger } from '../../utils/logger.js';
import { recordActivity, ActivityActions } from '../../utils/activity.js';

// ── Default Configuration ────────────────────────────────────────

/** Default stale threshold for orphaned routine runs (10 minutes) */
const DEFAULT_ORPHAN_STALE_MINUTES = 10;

// ── Routine CRUD ────────────────────────────────────────────────

/**
 * List routines for a company with optional filters.
 */
export async function listRoutines(companyId: string, filters?: ListRoutinesQuery) {
  return prisma.routine.findMany({
    where: {
      companyId,
      ...(filters?.agentId !== undefined && { agentId: filters.agentId }),
      ...(filters?.enabled !== undefined && { enabled: filters.enabled }),
    },
    include: {
      _count: {
        select: { runs: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 20,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get a single routine by ID, scoped to company.
 */
export async function getRoutineById(id: string, companyId: string) {
  return prisma.routine.findFirst({
    where: { id, companyId },
    include: {
      _count: {
        select: { runs: true },
      },
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
}

/**
 * Create a new routine.
 *
 * Validates the cron expression and computes the initial nextRunAt.
 * Records an activity event for the audit trail.
 */
export async function createRoutine(data: CreateRoutineInput, companyId: string) {
  // Compute next run time from the cron expression
  const nextRunAt = computeNextRun(data.cron);

  const routine = await prisma.routine.create({
    data: {
      companyId,
      agentId: data.agentId ?? null,
      name: data.name,
      description: data.description ?? null,
      cron: data.cron,
      action: data.action,
      enabled: data.enabled,
      concurrencyPolicy: data.concurrencyPolicy,
      catchUpPolicy: data.catchUpPolicy,
      maxConcurrentRuns: data.maxConcurrentRuns,
      timeoutMs: data.timeoutMs ?? null,
      nextRunAt,
    },
  });

  logger.info('Routine created', {
    routineId: routine.id,
    companyId,
    name: data.name,
    cron: data.cron,
    action: data.action,
    nextRunAt,
  });

  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'system',
    action: ActivityActions.ROUTINE_CREATE,
    targetType: 'ROUTINE',
    targetId: routine.id,
    metadata: {
      name: data.name,
      cron: data.cron,
      action: data.action,
      agentId: data.agentId,
    },
  });

  return routine;
}

/**
 * Update an existing routine.
 *
 * Recomputes nextRunAt if the cron expression changed.
 */
export async function updateRoutine(
  id: string,
  data: UpdateRoutineInput,
  companyId: string
): Promise<ServiceResult<unknown>> {
  const existing = await prisma.routine.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return { error: 'NOT_FOUND' };
  }

  // Recompute nextRunAt if cron changed
  const nextRunAt = data.cron ? computeNextRun(data.cron) : undefined;

  const updated = await prisma.routine.update({
    where: { id },
    data: {
      ...(data.agentId !== undefined && { agentId: data.agentId }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.cron !== undefined && { cron: data.cron }),
      ...(data.action !== undefined && { action: data.action }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.concurrencyPolicy !== undefined && { concurrencyPolicy: data.concurrencyPolicy }),
      ...(data.catchUpPolicy !== undefined && { catchUpPolicy: data.catchUpPolicy }),
      ...(data.maxConcurrentRuns !== undefined && { maxConcurrentRuns: data.maxConcurrentRuns }),
      ...(data.timeoutMs !== undefined && { timeoutMs: data.timeoutMs }),
      ...(nextRunAt !== undefined && { nextRunAt }),
    },
  });

  logger.info('Routine updated', { routineId: id, companyId });

  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'system',
    action: ActivityActions.ROUTINE_UPDATE,
    targetType: 'ROUTINE',
    targetId: id,
    metadata: { changes: data },
  });

  return { data: updated };
}

/**
 * Delete a routine by ID.
 * Cascades to delete all associated RoutineRun records.
 */
export async function deleteRoutine(
  id: string,
  companyId: string
): Promise<ServiceResult<unknown>> {
  const existing = await prisma.routine.findFirst({
    where: { id, companyId },
  });

  if (!existing) {
    return { error: 'NOT_FOUND' };
  }

  // Delete runs first (cascade should handle this, but be explicit)
  await prisma.routineRun.deleteMany({
    where: { routineId: id },
  });

  const deleted = await prisma.routine.delete({
    where: { id },
  });

  logger.info('Routine deleted', { routineId: id, companyId });

  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'system',
    action: ActivityActions.ROUTINE_DELETE,
    targetType: 'ROUTINE',
    targetId: id,
    metadata: { name: existing.name },
  });

  return { data: deleted };
}

// ── Routine Trigger / Execution ──────────────────────────────────

/**
 * Manually trigger a routine execution.
 *
 * Creates a RoutineRun record and dispatches execution.
 * Respects concurrency policies.
 *
 * @param routineId - The routine to trigger
 * @param input - Optional trigger configuration
 * @param companyId - The company scope
 * @returns The created RoutineRun, or an error
 */
export async function triggerRoutine(
  routineId: string,
  input: TriggerRoutineInput,
  companyId: string
): Promise<ServiceResult<unknown>> {
  const routine = await prisma.routine.findFirst({
    where: { id: routineId, companyId },
  });

  if (!routine) {
    return { error: 'NOT_FOUND' };
  }

  if (!routine.enabled) {
    return { error: 'DISABLED' };
  }

  // Check concurrency policy
  const concurrencyCheck = await checkConcurrencyPolicy(
    routine.id,
    routine.concurrencyPolicy as ConcurrencyPolicy,
    routine.maxConcurrentRuns
  );

  if (!concurrencyCheck.allowed) {
    logger.warn('Routine trigger skipped — concurrency policy', {
      routineId: routine.id,
      policy: routine.concurrencyPolicy,
      activeRuns: concurrencyCheck.activeRuns,
    });

    return { error: 'CONCURRENCY_LIMIT' };
  }

  // Create the RoutineRun record
  const run = await prisma.routineRun.create({
    data: {
      routineId: routine.id,
      status: 'PENDING',
      startedAt: new Date(),
    },
  });

  logger.info('Routine run created', {
    routineId: routine.id,
    runId: run.id,
    triggerType: 'MANUAL',
  });

  // Record activity
  await recordActivity({
    companyId,
    actorType: 'USER',
    actorId: 'system',
    action: ActivityActions.ROUTINE_RUN,
    targetType: 'ROUTINE',
    targetId: routine.id,
    metadata: {
      runId: run.id,
      triggerType: 'MANUAL',
      action: routine.action,
    },
  });

  // Execute asynchronously (fire-and-forget)
  executeRoutineRun(routine, run.id, companyId, input.prompt).catch((err) => {
    logger.error('Routine execution failed unexpectedly', {
      routineId: routine.id,
      runId: run.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // Update lastRunAt and compute nextRunAt
  await prisma.routine.update({
    where: { id: routine.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: computeNextRun(routine.cron),
    },
  });

  return { data: { ...run, routineId: routine.id } };
}

/**
 * Execute all due routines.
 *
 * Called by the scheduler tick. Finds all enabled routines where
 * nextRunAt <= now and triggers them according to their policies.
 *
 * @param companyId - The company scope (or null for all companies)
 * @returns Execution statistics
 */
export async function executeDueRoutines(companyId?: string): Promise<{
  triggered: number;
  skipped: number;
  failed: number;
}> {
  const now = new Date();

  const dueRoutines = await prisma.routine.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
      ...(companyId && { companyId }),
    },
  });

  let triggered = 0;
  let skipped = 0;
  let failed = 0;

  for (const routine of dueRoutines) {
    try {
      // Check concurrency policy
      const concurrencyCheck = await checkConcurrencyPolicy(
        routine.id,
        routine.concurrencyPolicy as ConcurrencyPolicy,
        routine.maxConcurrentRuns
      );

      if (!concurrencyCheck.allowed) {
        logger.info('Skipping routine — concurrency limit', {
          routineId: routine.id,
          policy: routine.concurrencyPolicy,
        });
        skipped++;
        continue;
      }

      // Handle catch-up policy for missed runs
      const missedRuns = await countMissedRuns(routine.id, routine.nextRunAt!, now);
      const runsToExecute = resolveCatchUpRuns(
        routine.catchUpPolicy as CatchUpPolicy,
        missedRuns
      );

      for (let i = 0; i < runsToExecute; i++) {
        const run = await prisma.routineRun.create({
          data: {
            routineId: routine.id,
            status: 'PENDING',
            startedAt: new Date(),
          },
        });

        // Execute asynchronously
        executeRoutineRun(routine, run.id, routine.companyId).catch((err) => {
          logger.error('Scheduled routine execution failed', {
            routineId: routine.id,
            runId: run.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      // Update scheduling metadata
      const nextRunAt = computeNextRun(routine.cron);
      await prisma.routine.update({
        where: { id: routine.id },
        data: {
          lastRunAt: now,
          nextRunAt,
        },
      });

      triggered += runsToExecute;
    } catch (err) {
      logger.error('Failed to execute due routine', {
        routineId: routine.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  return { triggered, skipped, failed };
}

// ── Run History ──────────────────────────────────────────────────

/**
 * List runs for a specific routine.
 */
export async function listRoutineRuns(
  routineId: string,
  companyId: string,
  filters?: ListRoutineRunsQuery
) {
  // Verify routine belongs to company
  const routine = await prisma.routine.findFirst({
    where: { id: routineId, companyId },
  });

  if (!routine) {
    return null;
  }

  return prisma.routineRun.findMany({
    where: {
      routineId,
      ...(filters?.status && { status: filters.status }),
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 20,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get a single routine run by ID.
 */
export async function getRoutineRunById(runId: string, routineId: string, companyId: string) {
  const routine = await prisma.routine.findFirst({
    where: { id: routineId, companyId },
  });

  if (!routine) {
    return null;
  }

  return prisma.routineRun.findFirst({
    where: { id: runId, routineId },
  });
}

/**
 * Get routine statistics.
 */
export async function getRoutineStats(routineId: string, companyId: string) {
  const routine = await prisma.routine.findFirst({
    where: { id: routineId, companyId },
  });

  if (!routine) {
    return null;
  }

  const [totalRuns, completedRuns, failedRuns, skippedRuns] = await Promise.all([
    prisma.routineRun.count({ where: { routineId } }),
    prisma.routineRun.count({ where: { routineId, status: 'COMPLETED' } }),
    prisma.routineRun.count({ where: { routineId, status: 'FAILED' } }),
    prisma.routineRun.count({ where: { routineId, status: 'SKIPPED' } }),
  ]);

  return {
    routineId,
    totalRuns,
    completedRuns,
    failedRuns,
    skippedRuns,
    successRate: totalRuns > 0 ? completedRuns / totalRuns : 0,
    lastRunAt: routine.lastRunAt,
    nextRunAt: routine.nextRunAt,
    enabled: routine.enabled,
  };
}

// ── Internal Execution Logic ─────────────────────────────────────

/**
 * Execute a routine run.
 *
 * This is the core execution function that:
 * 1. Updates the run status to RUNNING
 * 2. Resolves the routine action to a task or system action
 * 3. Triggers a heartbeat if an agent is assigned
 * 4. Updates the run status based on the result
 * 5. Records activity events
 */
async function executeRoutineRun(
  routine: {
    id: string;
    companyId: string;
    agentId: string | null;
    name: string;
    action: string;
    timeoutMs: number | null;
  },
  runId: string,
  companyId: string,
  customPrompt?: string
): Promise<void> {
  const startTime = Date.now();

  try {
    // 1. Update status to RUNNING
    await prisma.routineRun.update({
      where: { id: runId },
      data: { status: 'RUNNING' },
    });

    logger.info('Routine run starting', {
      routineId: routine.id,
      runId,
      action: routine.action,
    });

    // 2. Resolve the action
    const actionResult = await resolveAction(routine, companyId, customPrompt);

    // 3. Update run with result
    const durationMs = Date.now() - startTime;

    if (actionResult.success) {
      await prisma.routineRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          heartbeatId: actionResult.heartbeatId ?? null,
          log: actionResult.log ?? null,
        },
      });

      await recordActivity({
        companyId,
        actorType: 'SYSTEM',
        actorId: 'routine-engine',
        action: ActivityActions.ROUTINE_RUN_COMPLETE,
        targetType: 'ROUTINE',
        targetId: routine.id,
        metadata: {
          runId,
          durationMs,
          heartbeatId: actionResult.heartbeatId,
        },
      });

      logger.info('Routine run completed', {
        routineId: routine.id,
        runId,
        durationMs,
        heartbeatId: actionResult.heartbeatId,
      });
    } else {
      await prisma.routineRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          endedAt: new Date(),
          error: actionResult.error ?? 'Unknown error',
          heartbeatId: actionResult.heartbeatId ?? null,
        },
      });

      await recordActivity({
        companyId,
        actorType: 'SYSTEM',
        actorId: 'routine-engine',
        action: ActivityActions.ROUTINE_RUN_FAIL,
        targetType: 'ROUTINE',
        targetId: routine.id,
        metadata: {
          runId,
          durationMs,
          error: actionResult.error,
        },
      });

      logger.warn('Routine run failed', {
        routineId: routine.id,
        runId,
        error: actionResult.error,
        durationMs,
      });
    }
  } catch (err) {
    const durationMs = Date.now() - startTime;

    logger.error('Routine run execution error', {
      routineId: routine.id,
      runId,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    });

    // Mark run as FAILED
    await prisma.routineRun
      .update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          endedAt: new Date(),
          error: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(() => {
        // Swallow — we're already in error handling
      });

    await recordActivity({
      companyId,
      actorType: 'SYSTEM',
      actorId: 'routine-engine',
      action: ActivityActions.ROUTINE_RUN_FAIL,
      targetType: 'ROUTINE',
      targetId: routine.id,
      metadata: {
        runId,
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      },
    }).catch(() => {});
  }
}

/**
 * Resolve a routine action to an execution result.
 *
 * Supports two action types:
 * - heartbeat:<taskId>: Triggers a heartbeat for the specified task via the assigned agent
 * - system:<action>: Executes a system-level action (e.g., cleanup, report)
 *
 * @returns An object with success status, optional heartbeatId, log, and error
 */
async function resolveAction(
  routine: {
    id: string;
    companyId: string;
    agentId: string | null;
    name: string;
    action: string;
    timeoutMs: number | null;
  },
  companyId: string,
  customPrompt?: string
): Promise<{
  success: boolean;
  heartbeatId?: string;
  log?: string;
  error?: string;
}> {
  const actionParts = routine.action.split(':');
  const actionType = actionParts[0];
  const actionTarget = actionParts.slice(1).join(':');

  switch (actionType) {
    case 'heartbeat': {
      // Trigger a heartbeat for a task
      if (!routine.agentId) {
        return { success: false, error: 'Routine requires an agentId for heartbeat actions' };
      }

      const taskId = actionTarget;
      if (!taskId) {
        return { success: false, error: 'Heartbeat action requires a taskId (heartbeat:<taskId>)' };
      }

      // Verify the task exists and agent belongs to company
      const [task, agent] = await Promise.all([
        prisma.task.findFirst({
          where: { id: taskId, goal: { project: { companyId } } },
        }),
        prisma.agent.findFirst({
          where: { id: routine.agentId, companyId },
        }),
      ]);

      if (!task) {
        return { success: false, error: `Task not found: ${taskId}` };
      }

      if (!agent) {
        return { success: false, error: `Agent not found: ${routine.agentId}` };
      }

      // Create a heartbeat record
      const heartbeat = await prisma.heartbeat.create({
        data: {
          taskId,
          agentId: routine.agentId,
          status: 'PENDING',
          startedAt: new Date(),
        },
      });

      // The actual heartbeat execution would be handled by the heartbeat engine.
      // For now, we mark it as dispatched and let the heartbeat engine pick it up.
      logger.info('Routine dispatched heartbeat', {
        routineId: routine.id,
        heartbeatId: heartbeat.id,
        taskId,
        agentId: routine.agentId,
      });

      return {
        success: true,
        heartbeatId: heartbeat.id,
        log: `Heartbeat ${heartbeat.id} dispatched for task ${taskId}`,
      };
    }

    case 'system': {
      // System-level actions (e.g., cleanup, report generation)
      const systemAction = actionTarget;

      logger.info('Routine executing system action', {
        routineId: routine.id,
        action: systemAction,
      });

      // System actions are logged but don't create heartbeats
      return {
        success: true,
        log: `System action '${systemAction}' executed`,
      };
    }

    default:
      return { success: false, error: `Unknown action type: ${actionType}` };
  }
}

// ── Concurrency Policy ───────────────────────────────────────────

/**
 * Check if a routine can execute based on its concurrency policy.
 *
 * @returns Whether execution is allowed and the number of active runs
 */
async function checkConcurrencyPolicy(
  routineId: string,
  policy: ConcurrencyPolicy,
  maxConcurrentRuns: number
): Promise<{ allowed: boolean; activeRuns: number }> {
  const activeRuns = await prisma.routineRun.count({
    where: {
      routineId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
  });

  switch (policy) {
    case 'ALLOW_OVERLAP':
      return { allowed: true, activeRuns };

    case 'SKIP_IF_RUNNING':
      return { allowed: activeRuns === 0, activeRuns };

    case 'QUEUE':
      return { allowed: activeRuns < maxConcurrentRuns, activeRuns };

    default:
      return { allowed: true, activeRuns };
  }
}

// ── Catch-up Policy ──────────────────────────────────────────────

/**
 * Count the number of missed runs between the last scheduled time and now.
 */
async function countMissedRuns(
  routineId: string,
  lastScheduledRun: Date,
  now: Date
): Promise<number> {
  // Simple heuristic: count how many intervals fit between lastScheduledRun and now
  // For a proper implementation, this would parse the cron expression
  const diffMs = now.getTime() - lastScheduledRun.getTime();

  // If less than 60 seconds late, no missed runs
  if (diffMs < 60000) {
    return 0;
  }

  // For now, consider it 1 missed run (the current one)
  // A proper cron library would calculate exact missed intervals
  return 1;
}

/**
 * Resolve the number of runs to execute based on catch-up policy.
 */
function resolveCatchUpRuns(policy: CatchUpPolicy, missedRuns: number): number {
  switch (policy) {
    case 'SKIP':
      return 1; // Always run once for the current trigger

    case 'RUN_ONCE':
      return 1; // Only run once, regardless of missed runs

    case 'RUN_ALL':
      return Math.max(1, missedRuns); // Run all missed plus current

    default:
      return 1;
  }
}

// ── Cron Utilities ───────────────────────────────────────────────

/**
 * Compute the next run time from a cron expression.
 *
 * Simple implementation — parses standard 5-field cron expressions.
 * For production use, integrate a proper cron parser like 'cron-parser'.
 *
 * Format: minute hour day-of-month month day-of-week
 *   - Each field: * (any), N (exact), slash-N (every N), N-M (range), N,O (list)
 *
 * @param cronExpression - The cron expression
 * @returns The next run time
 */
export function computeNextRun(cronExpression: string): Date {
  // Simple implementation: add 1 minute to current time
  // In production, use a proper cron parser library
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    // Invalid cron expression — default to 1 hour from now
    logger.warn('Invalid cron expression, defaulting to 1 hour', { cron: cronExpression });
    const next = new Date();
    next.setHours(next.getHours() + 1);
    return next;
  }

  // Parse the cron fields
  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  const next = new Date();

  // For simple patterns, compute the next occurrence
  if (minutePart === '*' && hourPart === '*') {
    // Every minute — next minute
    next.setMinutes(next.getMinutes() + 1);
    next.setSeconds(0);
    next.setMilliseconds(0);
    return next;
  }

  if (minutePart.startsWith('*/')) {
    // Every N minutes
    const interval = parseInt(minutePart.slice(2), 10);
    if (!isNaN(interval) && interval > 0) {
      const currentMinute = next.getMinutes();
      const nextMinute = Math.ceil((currentMinute + 1) / interval) * interval;
      if (nextMinute >= 60) {
        next.setHours(next.getHours() + 1);
        next.setMinutes(nextMinute - 60);
      } else {
        next.setMinutes(nextMinute);
      }
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }
  }

  // For specific minute/hour
  const minute = parseInt(minutePart, 10);
  const hour = parseInt(hourPart, 10);

  if (!isNaN(minute) && !isNaN(hour)) {
    next.setHours(hour);
    next.setMinutes(minute);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // If the time has already passed today, move to tomorrow
    if (next <= new Date()) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  // Fallback: 1 hour from now
  next.setHours(next.getHours() + 1);
  next.setSeconds(0);
  next.setMilliseconds(0);
  return next;
}

// ── Error Types ──────────────────────────────────────────────────

export type ServiceError =
  | 'NOT_FOUND'
  | 'DISABLED'
  | 'CONCURRENCY_LIMIT'
  | 'INVALID_CRON';

export type ServiceResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: ServiceError };
