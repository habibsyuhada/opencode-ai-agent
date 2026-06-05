/**
 * Heartbeat service — core execution loop for agent task processing.
 *
 * The Heartbeat Engine is the central orchestrator that:
 * 1. Accepts execution trigger requests (Manual, Scheduled, Event)
 * 2. Validates agent and task availability
 * 3. Checks budget limits before execution
 * 4. Resolves next task from queue (auto-pick) if not specified
 * 5. Loads agent-specific skills from configuration
 * 6. Injects scoped secrets into the execution environment
 * 7. Creates a Heartbeat record in the database
 * 8. Dispatches execution to the OpenCode adapter
 * 9. Records results, token usage, and cost events
 * 10. Updates task status and budget usage upon completion
 * 11. Records activity events for audit trail
 * 12. Handles orphaned run recovery (stale RUNNING heartbeats)
 *
 * Architecture reference: docs/architecture/architecture.md §4, §6
 * - "Hono Server acting as the Brain/Heartbeat to manage execution logic and state."
 * - "Heartbeat Engine: Task Dispatch, State Manager, Cost Tracker"
 *
 * PRD reference: docs/prd/prd.md §9 (FR-005, FR-006, FR-007, FR-008)
 * - "Provide a system for Projects, Goals, and Tasks with atomic checkouts."
 * - "Create an adapter to spawn OpenCode child processes, pass prompts,
 *    capture artifacts, and record token usage."
 * - "Implement an execution loop to check status, resolve tasks,
 *    load skills, and run the OpenCode adapter."
 * - "Track costs per agent/task, enforce monthly limits."
 */

import prisma from '../../db/client.js';
import { OpenCodeAdapter, createOpenCodeAdapter } from '../../adapters/opencode.js';
import type { AdapterResult, AdapterRunConfig } from '../../adapters/base.js';
import type {
  TriggerHeartbeatInput,
  AutoTriggerHeartbeatInput,
  ListHeartbeatsQuery,
  TriggerType,
  RecoverOrphansInput,
} from './schema.js';
import { logger } from '../../utils/logger.js';
import { recordActivity, ActivityActions } from '../../utils/activity.js';
import { loadDecryptedSecrets } from '../secrets/service.js';
import { heartbeatLogEmitter } from './log-emitter.js';
import type { Prisma } from '@prisma/client';

// ── Default Configuration ────────────────────────────────────────

/** Default timeout for heartbeat executions (5 minutes) */
const DEFAULT_TIMEOUT_MS = 300_000;

/** Default working directory if no workspace is configured */
const DEFAULT_WORKING_DIRECTORY = process.cwd();

/** Default stale threshold for orphaned runs (10 minutes) */
const DEFAULT_ORPHAN_STALE_MINUTES = 10;

/** Maximum tasks to auto-pick per agent per cycle */
const MAX_AUTO_PICK_TASKS = 1;

// ── Singleton Adapter ────────────────────────────────────────────

/**
 * Singleton adapter instance.
 * In production, this could be a pool of adapters for parallel execution.
 */
let adapterInstance: OpenCodeAdapter | null = null;

function getAdapter(): OpenCodeAdapter {
  if (!adapterInstance) {
    adapterInstance = createOpenCodeAdapter();
  }
  return adapterInstance;
}

/**
 * Reset the adapter instance (useful for testing).
 */
export function resetAdapter(): void {
  adapterInstance = null;
}

// ── Core Heartbeat Functions ─────────────────────────────────────

/**
 * Trigger a new heartbeat execution for an agent with a specific task.
 *
 * This is the main entry point for Manual trigger type. It:
 * 1. Validates the agent exists and is active
 * 2. Validates the task exists and is assigned to this agent
 * 3. Checks budget limits before proceeding
 * 4. Creates a PENDING Heartbeat record
 * 5. Executes the task via the OpenCode adapter (async)
 * 6. Updates the Heartbeat with results
 * 7. Creates CostEvent records for budget tracking
 * 8. Records activity events
 *
 * @param agentId - The agent triggering the heartbeat
 * @param input - Execution configuration (taskId, prompt, timeout, etc.)
 * @param companyId - The company scope for multi-tenant isolation
 * @returns The created heartbeat ID and initial status
 *
 * @throws {Error} If agent not found, not active, task not assignable, or budget exceeded
 */
export async function triggerHeartbeat(
  agentId: string,
  input: TriggerHeartbeatInput,
  companyId: string
): Promise<{ heartbeatId: string; status: string }> {
  // 1. Validate agent exists and belongs to this company
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      companyId,
    },
  });

  if (!agent) {
    throw new AgentNotFoundError(agentId);
  }

  if (agent.status !== 'ACTIVE') {
    throw new AgentNotActiveError(agentId, agent.status);
  }

  // 2. Validate task exists and is accessible
  const task = await prisma.task.findFirst({
    where: {
      id: input.taskId,
      goal: { project: { companyId } },
    },
    include: {
      goal: { select: { id: true, name: true, project: { select: { id: true, name: true } } } },
    },
  });

  if (!task) {
    throw new TaskNotFoundError(input.taskId);
  }

  // Check if task is already locked by another agent
  if (task.lockedAt && task.assigneeId !== agentId) {
    throw new TaskLockedError(input.taskId, task.assigneeId || 'unknown');
  }

  // 3. Check budget limits
  const budgetCheck = await checkBudget(companyId, agentId);
  if (!budgetCheck.allowed) {
    throw new BudgetExceededError(companyId, budgetCheck.reason);
  }

  // 3b. Check for pending approvals on this task
  const approvalCheck = await checkPendingApproval(input.taskId, companyId);
  if (approvalCheck.hasPendingApproval) {
    // Create heartbeat in PAUSED_FOR_APPROVAL state
    const heartbeat = await prisma.heartbeat.create({
      data: {
        taskId: input.taskId,
        agentId,
        status: 'PAUSED_FOR_APPROVAL',
        startedAt: new Date(),
        log: `Task paused: pending approval (type: ${approvalCheck.approvalType}, id: ${approvalCheck.approvalId})`,
      },
    });

    logger.info('Heartbeat paused for approval', {
      heartbeatId: heartbeat.id,
      agentId,
      taskId: input.taskId,
      approvalId: approvalCheck.approvalId,
      approvalType: approvalCheck.approvalType,
    });

    await recordActivity({
      companyId,
      actorType: 'AGENT',
      actorId: agentId,
      action: ActivityActions.HEARTBEAT_START,
      targetType: 'HEARTBEAT',
      targetId: heartbeat.id,
      metadata: {
        taskId: input.taskId,
        triggerType: input.triggerType,
        agentRole: agent.role,
        pausedForApproval: true,
        approvalId: approvalCheck.approvalId,
      },
    });

    return {
      heartbeatId: heartbeat.id,
      status: 'PAUSED_FOR_APPROVAL',
    };
  }

  // 4. Build the execution prompt
  const prompt = buildPrompt(agent, task, input.prompt);

  // 5. Load agent-specific skills
  const skills = loadAgentSkills(agent);

  // 6. Inject scoped secrets
  const secrets = await loadSecrets(companyId, agentId);

  // 7. Create PENDING heartbeat record with trigger type
  const heartbeat = await prisma.heartbeat.create({
    data: {
      taskId: input.taskId,
      agentId,
      status: 'PENDING',
      startedAt: new Date(),
    },
  });

  logger.info('Heartbeat created', {
    heartbeatId: heartbeat.id,
    agentId,
    taskId: input.taskId,
    agentRole: agent.role,
    triggerType: input.triggerType,
  });

  // 8. Record activity — heartbeat started
  await recordActivity({
    companyId,
    actorType: 'AGENT',
    actorId: agentId,
    action: ActivityActions.HEARTBEAT_START,
    targetType: 'HEARTBEAT',
    targetId: heartbeat.id,
    metadata: {
      taskId: input.taskId,
      triggerType: input.triggerType,
      agentRole: agent.role,
    },
  });

  // 9. Execute asynchronously (fire-and-forget from the caller's perspective)
  // The caller gets the heartbeatId immediately and can poll for status.
  executeHeartbeat(heartbeat.id, agent, task, prompt, input, companyId, skills, secrets).catch(
    (err) => {
      logger.error('Heartbeat execution failed unexpectedly', {
        heartbeatId: heartbeat.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  );

  return {
    heartbeatId: heartbeat.id,
    status: 'PENDING',
  };
}

/**
 * Auto-trigger a heartbeat by picking the next available task from the agent's queue.
 *
 * This is the entry point for Scheduled and Event-based triggers. It:
 * 1. Validates the agent exists and is active
 * 2. Checks budget limits
 * 3. Finds the next available task (assigned to this agent, in TODO or IN_PROGRESS status)
 * 4. Triggers the heartbeat with the resolved task
 *
 * If no tasks are available, returns null without creating a heartbeat.
 *
 * @param agentId - The agent to auto-trigger for
 * @param input - Auto-trigger configuration
 * @param companyId - The company scope
 * @returns The created heartbeat info, or null if no tasks available
 */
export async function autoTriggerHeartbeat(
  agentId: string,
  input: AutoTriggerHeartbeatInput,
  companyId: string
): Promise<{ heartbeatId: string; status: string } | null> {
  // 1. Validate agent exists and belongs to this company
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      companyId,
    },
  });

  if (!agent) {
    throw new AgentNotFoundError(agentId);
  }

  if (agent.status !== 'ACTIVE') {
    throw new AgentNotActiveError(agentId, agent.status);
  }

  // 2. Check budget limits before even looking for tasks
  const budgetCheck = await checkBudget(companyId, agentId);
  if (!budgetCheck.allowed) {
    logger.warn('Auto-trigger skipped — budget exceeded', {
      agentId,
      companyId,
      reason: budgetCheck.reason,
    });
    return null;
  }

  // 3. Find the next available task for this agent
  const nextTask = await resolveNextTask(agentId, companyId);

  if (!nextTask) {
    logger.info('Auto-trigger skipped — no tasks available', {
      agentId,
      companyId,
    });
    return null;
  }

  // 4. Atomic checkout: lock the task for this agent
  const checkoutResult = await atomicCheckout(nextTask.id, agentId, companyId);

  if (!checkoutResult) {
    logger.warn('Auto-trigger skipped — task checkout failed (concurrent modification)', {
      agentId,
      taskId: nextTask.id,
    });
    return null;
  }

  // 5. Trigger the heartbeat with the resolved task
  const triggerInput: TriggerHeartbeatInput = {
    taskId: nextTask.id,
    prompt: input.prompt,
    timeoutMs: input.timeoutMs,
    contextFiles: input.contextFiles,
    triggerType: input.triggerType,
  };

  return triggerHeartbeat(agentId, triggerInput, companyId);
}

/**
 * Recover orphaned heartbeat runs.
 *
 * Finds heartbeat records stuck in RUNNING status beyond the stale threshold
 * and marks them as FAILED with an appropriate error message. Also unlocks
 * the associated tasks so they can be retried.
 *
 * @param input - Recovery configuration (staleMinutes threshold)
 * @param companyId - The company scope
 * @returns Recovery statistics
 */
export async function recoverOrphanedRuns(
  input: RecoverOrphansInput,
  companyId: string
): Promise<{
  recovered: number;
  failed: number;
  heartbeats: Array<{ id: string; taskId: string; agentId: string; status: string }>;
}> {
  const staleThreshold = new Date();
  staleThreshold.setMinutes(staleThreshold.getMinutes() - input.staleMinutes);

  // Find orphaned heartbeats: RUNNING status, started before the stale threshold
  const orphaned = await prisma.heartbeat.findMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: staleThreshold },
      agent: { companyId },
    },
    include: {
      agent: { select: { id: true, companyId: true } },
      task: { select: { id: true, lockedAt: true } },
    },
  });

  logger.info('Orphaned heartbeat recovery started', {
    companyId,
    staleMinutes: input.staleMinutes,
    orphanedCount: orphaned.length,
  });

  const results: Array<{ id: string; taskId: string; agentId: string; status: string }> = [];
  let recovered = 0;
  let failed = 0;

  for (const hb of orphaned) {
    try {
      // Mark heartbeat as FAILED
      await prisma.heartbeat.update({
        where: { id: hb.id },
        data: {
          status: 'FAILED',
          endedAt: new Date(),
          log: `Orphaned run recovered after ${input.staleMinutes} minutes stale threshold`,
        },
      });

      // Unlock the associated task
      if (hb.task.lockedAt) {
        await prisma.task.update({
          where: { id: hb.taskId },
          data: { lockedAt: null },
        });
      }

      // Record activity
      await recordActivity({
        companyId,
        actorType: 'SYSTEM',
        actorId: 'orphan-recovery',
        action: ActivityActions.HEARTBEAT_FAIL,
        targetType: 'HEARTBEAT',
        targetId: hb.id,
        metadata: {
          reason: 'orphaned_run_recovery',
          staleMinutes: input.staleMinutes,
          originalAgentId: hb.agentId,
        },
      });

      results.push({
        id: hb.id,
        taskId: hb.taskId,
        agentId: hb.agentId,
        status: 'FAILED',
      });
      recovered++;
    } catch (err) {
      logger.error('Failed to recover orphaned heartbeat', {
        heartbeatId: hb.id,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        id: hb.id,
        taskId: hb.taskId,
        agentId: hb.agentId,
        status: 'RECOVERY_FAILED',
      });
      failed++;
    }
  }

  logger.info('Orphaned heartbeat recovery completed', {
    recovered,
    failed,
    total: orphaned.length,
  });

  return { recovered, failed, heartbeats: results };
}

/**
 * Get a heartbeat by ID.
 *
 * Returns the heartbeat record with agent and task details.
 * Company isolation is enforced via Agent → Company.
 *
 * @param id - Heartbeat ID
 * @param companyId - Company scope
 * @returns Heartbeat record or null if not found
 */
export async function getHeartbeatById(id: string, companyId: string) {
  return prisma.heartbeat.findFirst({
    where: {
      id,
      agent: { companyId },
    },
    include: {
      agent: {
        select: { id: true, name: true, role: true },
      },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          goal: {
            select: { id: true, name: true, project: { select: { id: true, name: true } } },
          },
        },
      },
      costEvents: true,
    },
  });
}

/**
 * List heartbeats with optional filters.
 *
 * @param companyId - Company scope
 * @param filters - Optional filters (agentId, taskId, status, triggerType)
 * @returns Array of heartbeat records
 */
export async function listHeartbeats(companyId: string, filters?: ListHeartbeatsQuery) {
  return prisma.heartbeat.findMany({
    where: {
      ...(filters?.agentId && { agentId: filters.agentId }),
      ...(filters?.taskId && { taskId: filters.taskId }),
      ...(filters?.status && { status: filters.status }),
      agent: { companyId },
    },
    include: {
      agent: {
        select: { id: true, name: true, role: true },
      },
      task: {
        select: { id: true, title: true, status: true },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: filters?.limit ?? 20,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get heartbeat statistics for an agent.
 *
 * Returns aggregated data for the dashboard (total runs, tokens, cost).
 *
 * @param agentId - Agent ID
 * @param companyId - Company scope
 * @returns Aggregated heartbeat statistics
 */
export async function getHeartbeatStats(agentId: string, companyId: string) {
  // Verify agent belongs to company
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, companyId },
  });

  if (!agent) {
    return null;
  }

  const [totalRuns, completedRuns, failedRuns, aggregates] = await Promise.all([
    prisma.heartbeat.count({ where: { agentId } }),
    prisma.heartbeat.count({ where: { agentId, status: 'COMPLETED' } }),
    prisma.heartbeat.count({ where: { agentId, status: 'FAILED' } }),
    prisma.heartbeat.aggregate({
      where: { agentId, status: 'COMPLETED' },
      _sum: { tokensUsed: true, cost: true },
      _avg: { tokensUsed: true, cost: true },
    }),
  ]);

  return {
    agentId,
    totalRuns,
    completedRuns,
    failedRuns,
    successRate: totalRuns > 0 ? completedRuns / totalRuns : 0,
    totalTokens: aggregates._sum.tokensUsed || 0,
    totalCost: aggregates._sum.cost || 0,
    avgTokens: Math.round(aggregates._avg.tokensUsed || 0),
    avgCost: aggregates._avg.cost || 0,
  };
}

// ── Internal Execution Logic ─────────────────────────────────────

/**
 * Execute a heartbeat run.
 *
 * This is the core execution loop that implements all 13 steps:
 * 1. Check agent is ACTIVE (already validated in triggerHeartbeat)
 * 2. Check budget not exceeded (already validated in triggerHeartbeat)
 * 3. Resolve next task (already resolved in triggerHeartbeat)
 * 4. Resolve workspace directory
 * 5. Load agent-specific skills (already loaded in triggerHeartbeat)
 * 6. Inject secrets if scoped (already loaded in triggerHeartbeat)
 * 7. Create Heartbeat record (status: RUNNING)
 * 8. Invoke OpenCode adapter
 * 9. Parse result, capture cost
 * 10. Update task status
 * 11. Update budget usage
 * 12. Record activity
 * 13. Handle orphaned runs (recovery) — separate function
 *
 * Runs asynchronously — the caller gets the heartbeatId immediately.
 */
async function executeHeartbeat(
  heartbeatId: string,
  agent: { id: string; role: string; name: string; config: unknown },
  task: {
    id: string;
    title: string;
    description: string | null;
    goal: { name: string; project: { name: string } };
  },
  prompt: string,
  input: TriggerHeartbeatInput | AutoTriggerHeartbeatInput,
  companyId: string,
  skills: string[],
  secrets: Record<string, string>
): Promise<void> {
  const adapter = getAdapter();
  const startTime = Date.now();

  try {
    // 1. Update status to RUNNING
    await prisma.heartbeat.update({
      where: { id: heartbeatId },
      data: { status: 'RUNNING' },
    });

    logger.info('Heartbeat execution starting', { heartbeatId });

    // 2. Check adapter availability
    const available = await adapter.isAvailable();
    if (!available) {
      throw new AdapterUnavailableError();
    }

    // 3. Resolve workspace directory (use input override if provided)
    const workingDirectory = input.workingDirectory || await resolveWorkingDirectory(companyId);

    // 4. Augment prompt with skills context
    let augmentedPrompt = prompt;
    if (skills.length > 0) {
      augmentedPrompt += `\n\n## Agent Skills\nThe following skills are available to you:\n`;
      for (const skill of skills) {
        augmentedPrompt += `- ${skill}\n`;
      }
    }

    // 5. Build adapter run configuration with secrets
    const runConfig: AdapterRunConfig = {
      prompt: augmentedPrompt,
      agentRole: agent.role,
      agentName: agent.name,
      workingDirectory,
      timeoutMs: input.timeoutMs || DEFAULT_TIMEOUT_MS,
      contextFiles: input.contextFiles,
      env: Object.keys(secrets).length > 0 ? secrets : undefined,
      // STORY-019: Wire log callback for real-time streaming
      onLogChunk: (stream, data) => {
        heartbeatLogEmitter.emitLog(heartbeatId, stream, data);
      },
    };

    // 6. Execute via adapter
    // STORY-019: Emit 'started' status for real-time log UI
    heartbeatLogEmitter.emitStatus(heartbeatId, 'started');
    const result = await adapter.start(runConfig);

    // 7. Record results
    await recordHeartbeatResult(heartbeatId, result);

    // STORY-019: Emit completion status for real-time log UI
    heartbeatLogEmitter.emitStatus(
      heartbeatId,
      result.success ? 'completed' : 'failed',
      result.output || result.error
    );

    // Schedule buffer cleanup after 5 minutes
    setTimeout(() => heartbeatLogEmitter.cleanup(heartbeatId), 5 * 60 * 1000);

    // 8. Create cost event for budget tracking
    if (result.tokensUsed > 0) {
      await createCostEvent(heartbeatId, result);
      // 9. Update budget usage
      await updateBudgetUsage(companyId, agent.id, result.cost);
    }

    // 10. Update task status based on result
    if (result.success) {
      await updateTaskOnSuccess(task.id, agent.id, result);

      // 10b. Check if this is a documentation task — advance to next phase
      try {
        const { advanceDocumentationPhase } = await import('../orchestrator/service.js');
        await advanceDocumentationPhase(task.id, companyId);
      } catch (err) {
        // Non-critical — log and continue
        logger.debug('Could not advance documentation phase', {
          taskId: task.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      await updateTaskOnFailure(task.id, agent.id, result);
    }

    // 11. Record activity — heartbeat completed
    await recordActivity({
      companyId,
      actorType: 'AGENT',
      actorId: agent.id,
      action: result.success ? ActivityActions.HEARTBEAT_COMPLETE : ActivityActions.HEARTBEAT_FAIL,
      targetType: 'HEARTBEAT',
      targetId: heartbeatId,
      metadata: {
        taskId: task.id,
        success: result.success,
        tokensUsed: result.tokensUsed,
        cost: result.cost,
        durationMs: result.durationMs,
        model: result.model,
      },
    });

    logger.info('Heartbeat execution completed', {
      heartbeatId,
      success: result.success,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      durationMs: result.durationMs,
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;

    logger.error('Heartbeat execution failed', {
      heartbeatId,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    });

    // STORY-019: Emit failure status for real-time log UI
    const errorMsg = err instanceof Error ? err.message : String(err);
    heartbeatLogEmitter.emitStatus(heartbeatId, 'failed', errorMsg);
    setTimeout(() => heartbeatLogEmitter.cleanup(heartbeatId), 5 * 60 * 1000);

    // Update heartbeat as FAILED
    await prisma.heartbeat
      .update({
        where: { id: heartbeatId },
        data: {
          status: 'FAILED',
          endedAt: new Date(),
          log: err instanceof Error ? err.message : String(err),
        },
      })
      .catch((updateErr) => {
        logger.error('Failed to update heartbeat status', {
          heartbeatId,
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      });

    // Record failure activity
    await recordActivity({
      companyId,
      actorType: 'AGENT',
      actorId: agent.id,
      action: ActivityActions.HEARTBEAT_FAIL,
      targetType: 'HEARTBEAT',
      targetId: heartbeatId,
      metadata: {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      },
    }).catch(() => {
      // Activity recording should never crash the error handler
    });
  }
}

/**
 * Build the execution prompt for the agent.
 *
 * Combines the task title, description, goal context, and any custom prompt.
 */
function buildPrompt(
  agent: { name: string; role: string },
  task: {
    title: string;
    description: string | null;
    goal: { name: string; project: { name: string } };
  },
  customPrompt?: string
): string {
  const sections: string[] = [];

  // Project context
  sections.push(`## Project Context`);
  sections.push(`Project: ${task.goal.project.name}`);
  sections.push(`Goal: ${task.goal.name}`);
  sections.push('');

  // Task details
  sections.push(`## Task`);
  sections.push(`Title: ${task.title}`);
  if (task.description) {
    sections.push(`Description:`);
    sections.push(task.description);
  }
  sections.push('');

  // Agent context
  sections.push(`## Agent`);
  sections.push(`You are acting as: ${agent.name} (${agent.role})`);
  sections.push('');

  // Custom prompt if provided
  if (customPrompt) {
    sections.push(`## Additional Instructions`);
    sections.push(customPrompt);
    sections.push('');
  }

  // Execution instructions
  sections.push(`## Execution Instructions`);
  sections.push(`- Complete the task as described above.`);
  sections.push(`- Produce any necessary artifacts (code, documentation, etc.).`);
  sections.push(`- Report your results clearly.`);
  sections.push(`- If you encounter blockers, describe them.`);

  return sections.join('\n');
}

/**
 * Resolve the working directory for the execution.
 *
 * Looks up the workspace for the company. Falls back to the default
 * working directory if no workspace is configured.
 */
async function resolveWorkingDirectory(companyId: string): Promise<string> {
  const workspace = await prisma.workspace.findFirst({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
  });

  if (workspace) {
    return workspace.path;
  }

  logger.warn('No workspace found for company, using default', {
    companyId,
    default: DEFAULT_WORKING_DIRECTORY,
  });

  return DEFAULT_WORKING_DIRECTORY;
}

/**
 * Load agent-specific skills from the agent's configuration.
 *
 * Skills are stored in the agent's config JSON field and represent
 * specialized capabilities or knowledge areas the agent can use.
 *
 * @param agent - The agent record with optional config
 * @returns Array of skill names/identifiers
 */
function loadAgentSkills(agent: { config: unknown }): string[] {
  if (!agent.config) {
    return [];
  }

  try {
    const config = typeof agent.config === 'string' ? JSON.parse(agent.config) : agent.config;

    if (config && typeof config === 'object' && 'skills' in config) {
      const skills = (config as Record<string, unknown>).skills;
      if (Array.isArray(skills)) {
        return skills.filter((s): s is string => typeof s === 'string');
      }
    }
  } catch {
    logger.warn('Failed to parse agent config for skills', { config: agent.config });
  }

  return [];
}

/**
 * Load and decrypt secrets scoped to this agent or company.
 *
 * Delegates to the secrets service which uses AES-256-GCM encryption.
 * Secrets are only injected during active heartbeat executions (NFR-004).
 *
 * @param companyId - The company scope
 * @param agentId - The agent scope (for AGENT-scoped secrets)
 * @returns Key-value map of secret name → decrypted value
 */
async function loadSecrets(
  companyId: string,
  agentId: string
): Promise<Record<string, string>> {
  try {
    // Load all secrets for this company (GLOBAL and AGENT scoped)
    // In the future, AGENT-scoped secrets could be filtered by agentId
    return await loadDecryptedSecrets(companyId);
  } catch (err) {
    logger.error('Failed to load secrets', {
      companyId,
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

/**
 * Check if a task has a pending approval that would pause execution.
 *
 * When a task has a PENDING approval, the heartbeat engine creates the
 * heartbeat in PAUSED_FOR_APPROVAL state instead of executing immediately.
 * Once the approval is decided (APPROVED or REJECTED), the task can proceed.
 *
 * This implements STORY-014's requirement: "Update the HeartbeatEngine
 * to support a state where a task is PAUSED_FOR_APPROVAL."
 *
 * @param taskId - The task to check
 * @param companyId - The company scope
 * @returns Whether there's a pending approval and its details
 */
async function checkPendingApproval(
  taskId: string,
  companyId: string
): Promise<{
  hasPendingApproval: boolean;
  approvalId?: string;
  approvalType?: string;
}> {
  try {
    const pendingApproval = await prisma.approval.findFirst({
      where: {
        companyId,
        targetType: 'TASK',
        targetId: taskId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingApproval) {
      return {
        hasPendingApproval: true,
        approvalId: pendingApproval.id,
        approvalType: pendingApproval.type,
      };
    }

    return { hasPendingApproval: false };
  } catch (err) {
    logger.error('Failed to check pending approval', {
      taskId,
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    // On error, don't block execution — fail open
    return { hasPendingApproval: false };
  }
}

/**
 * Resume a heartbeat that was paused for approval.
 *
 * Called when an approval is decided (APPROVED). If REJECTED,
 * the heartbeat is marked as FAILED.
 *
 * This is called from the governance service when an approval decision is made.
 *
 * @param approvalId - The approval that was decided
 * @param decision - The decision (APPROVED or REJECTED)
 * @param companyId - The company scope
 */
export async function resumeHeartbeatForApproval(
  approvalId: string,
  decision: 'APPROVED' | 'REJECTED',
  companyId: string
): Promise<void> {
  try {
    // Find heartbeats paused for this approval
    const pausedHeartbeats = await prisma.heartbeat.findMany({
      where: {
        status: 'PAUSED_FOR_APPROVAL',
        log: { contains: approvalId },
        agent: { companyId },
      },
    });

    for (const heartbeat of pausedHeartbeats) {
      if (decision === 'APPROVED') {
        // Resume the heartbeat — set back to PENDING so the engine picks it up
        await prisma.heartbeat.update({
          where: { id: heartbeat.id },
          data: {
            status: 'PENDING',
            log: `Resumed after approval ${approvalId} was APPROVED`,
          },
        });

        logger.info('Heartbeat resumed after approval', {
          heartbeatId: heartbeat.id,
          approvalId,
        });
      } else {
        // Reject — mark as FAILED
        await prisma.heartbeat.update({
          where: { id: heartbeat.id },
          data: {
            status: 'FAILED',
            endedAt: new Date(),
            log: `Failed: approval ${approvalId} was REJECTED`,
          },
        });

        // Unlock the task
        await prisma.task.update({
          where: { id: heartbeat.taskId },
          data: { lockedAt: null },
        });

        logger.info('Heartbeat failed after approval rejection', {
          heartbeatId: heartbeat.id,
          approvalId,
        });
      }

      await recordActivity({
        companyId,
        actorType: 'SYSTEM',
        actorId: 'approval-handler',
        action: decision === 'APPROVED' ? ActivityActions.HEARTBEAT_START : ActivityActions.HEARTBEAT_FAIL,
        targetType: 'HEARTBEAT',
        targetId: heartbeat.id,
        metadata: {
          approvalId,
          decision,
          resumedFromPaused: true,
        },
      }).catch(() => {});
    }
  } catch (err) {
    logger.error('Failed to resume heartbeat for approval', {
      approvalId,
      decision,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Check if the budget allows a new execution.
 *
 * Checks both company-level and agent-level budgets.
 * Returns an object indicating whether execution is allowed and the reason if not.
 *
 * @param companyId - The company scope
 * @param agentId - The agent scope
 * @returns { allowed: boolean, reason?: string }
 */
async function checkBudget(
  companyId: string,
  agentId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Check company-level budget
  const companyBudget = await prisma.budget.findFirst({
    where: {
      companyId,
      agentId: null, // Global company budget
    },
  });

  if (companyBudget && companyBudget.used >= companyBudget.monthly) {
    return {
      allowed: false,
      reason: `Company monthly budget exceeded: $${companyBudget.used.toFixed(2)} / $${companyBudget.monthly.toFixed(2)}`,
    };
  }

  // Check agent-level budget
  const agentBudget = await prisma.budget.findFirst({
    where: {
      companyId,
      agentId,
    },
  });

  if (agentBudget && agentBudget.used >= agentBudget.monthly) {
    return {
      allowed: false,
      reason: `Agent monthly budget exceeded: $${agentBudget.used.toFixed(2)} / $${agentBudget.monthly.toFixed(2)}`,
    };
  }

  // Check threshold warnings
  if (companyBudget && companyBudget.used >= companyBudget.monthly * companyBudget.threshold) {
    logger.warn('Company budget approaching limit', {
      companyId,
      used: companyBudget.used,
      monthly: companyBudget.monthly,
      threshold: companyBudget.threshold,
      percentUsed: Math.round((companyBudget.used / companyBudget.monthly) * 100),
    });
  }

  return { allowed: true };
}

/**
 * Update budget usage after an execution.
 *
 * Increments the used amount on both company and agent budgets.
 *
 * @param companyId - The company scope
 * @param agentId - The agent scope
 * @param cost - The cost to add
 */
async function updateBudgetUsage(
  companyId: string,
  agentId: string,
  cost: number
): Promise<void> {
  if (cost <= 0) return;

  try {
    // Update company-level budget
    const companyBudget = await prisma.budget.findFirst({
      where: { companyId, agentId: null },
    });

    if (companyBudget) {
      await prisma.budget.update({
        where: { id: companyBudget.id },
        data: { used: { increment: cost } },
      });
    }

    // Update agent-level budget
    const agentBudget = await prisma.budget.findFirst({
      where: { companyId, agentId },
    });

    if (agentBudget) {
      await prisma.budget.update({
        where: { id: agentBudget.id },
        data: { used: { increment: cost } },
      });
    }

    logger.debug('Budget usage updated', {
      companyId,
      agentId,
      cost,
    });
  } catch (err) {
    // Budget update failure should not crash the heartbeat
    logger.error('Failed to update budget usage', {
      companyId,
      agentId,
      cost,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Resolve the next available task for an agent.
 *
 * Finds tasks assigned to this agent that are in TODO or BACKLOG status
 * (not yet locked), ordered by priority and creation date.
 *
 * @param agentId - The agent to find tasks for
 * @param companyId - The company scope
 * @returns The next available task or null
 */
async function resolveNextTask(
  agentId: string,
  companyId: string
): Promise<{
  id: string;
  title: string;
  description: string | null;
  goal: { name: string; project: { name: string } };
} | null> {
  const task = await prisma.task.findFirst({
    where: {
      assigneeId: agentId,
      status: { in: ['TODO', 'BACKLOG'] },
      lockedAt: null, // Not already locked
      goal: { project: { companyId } },
    },
    include: {
      goal: {
        select: {
          id: true,
          name: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { priority: 'desc' }, // CRITICAL > HIGH > MEDIUM > LOW
      { createdAt: 'asc' },  // Older tasks first (FIFO)
    ],
    take: MAX_AUTO_PICK_TASKS,
  });

  return task;
}

/**
 * Atomic checkout for auto-triggered tasks.
 *
 * Uses Prisma's updateMany with a where clause to atomically lock a task.
 * This prevents race conditions when multiple instances try to pick the same task.
 *
 * @param taskId - The task to lock
 * @param agentId - The agent locking it
 * @param companyId - The company scope
 * @returns true if checkout succeeded, false if already locked
 */
async function atomicCheckout(
  taskId: string,
  agentId: string,
  companyId: string
): Promise<boolean> {
  try {
    // Atomic update: only lock if not already locked and belongs to company
    const result = await prisma.$transaction(async (tx) => {
      // Use raw query for SELECT ... FOR UPDATE semantics
      const [lockedRow] = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          lockedAt: Date | null;
          assigneeId: string | null;
        }>
      >`
        SELECT t.id, t.status, t."lockedAt", t."assigneeId"
        FROM "Task" t
        JOIN "Goal" g   ON g.id = t."goalId"
        JOIN "Project" gp ON gp.id = g."projectId"
        WHERE t.id = ${taskId}
          AND gp."companyId" = ${companyId}
        FOR UPDATE OF t
      `;

      if (!lockedRow) {
        return false;
      }

      // Check if already locked by another agent
      if (lockedRow.lockedAt && lockedRow.assigneeId !== agentId) {
        return false;
      }

      // Lock the task
      await tx.task.update({
        where: { id: taskId },
        data: {
          lockedAt: new Date(),
          assigneeId: agentId,
          status: 'IN_PROGRESS',
        },
      });

      return true;
    });

    if (result) {
      // Record activity outside transaction
      await recordActivity({
        companyId,
        actorType: 'AGENT',
        actorId: agentId,
        action: ActivityActions.TASK_CHECKOUT,
        targetType: 'TASK',
        targetId: taskId,
        metadata: { status: 'IN_PROGRESS', trigger: 'auto' },
      });
    }

    return result;
  } catch (err) {
    logger.error('Atomic checkout failed', {
      taskId,
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Record the heartbeat execution result in the database.
 */
async function recordHeartbeatResult(heartbeatId: string, result: AdapterResult): Promise<void> {
  await prisma.heartbeat.update({
    where: { id: heartbeatId },
    data: {
      status: result.success ? 'COMPLETED' : 'FAILED',
      endedAt: new Date(),
      log: result.output || result.error || null,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
    },
  });
}

/**
 * Create a CostEvent record for budget tracking.
 *
 * Links the cost to the heartbeat for audit trail.
 */
async function createCostEvent(heartbeatId: string, result: AdapterResult): Promise<void> {
  await prisma.costEvent.create({
    data: {
      heartbeatId,
      provider: result.provider,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      cost: result.cost,
    },
  });

  logger.debug('Cost event created', {
    heartbeatId,
    provider: result.provider,
    model: result.model,
    cost: result.cost,
  });
}

/**
 * Update task status on successful execution.
 *
 * Unlocks the task and marks it as REVIEW (ready for human review).
 * Artifacts from the execution are stored on the task.
 */
async function updateTaskOnSuccess(
  taskId: string,
  agentId: string,
  result: AdapterResult
): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'REVIEW',
      lockedAt: null,
      ...(result.artifacts.length > 0 && {
        artifacts: result.artifacts,
      }),
    },
  });

  logger.info('Task updated on success', {
    taskId,
    agentId,
    status: 'REVIEW',
    artifacts: result.artifacts.length,
  });
}

/**
 * Update task status on failed execution.
 *
 * Unlocks the task and keeps it in IN_PROGRESS for retry.
 */
async function updateTaskOnFailure(
  taskId: string,
  agentId: string,
  result: AdapterResult
): Promise<void> {
  // Don't change task status on failure — keep it IN_PROGRESS for retry
  await prisma.task.update({
    where: { id: taskId },
    data: {
      lockedAt: null, // Unlock for retry
    },
  });

  logger.warn('Task updated on failure', {
    taskId,
    agentId,
    error: result.error,
  });
}

// ── Custom Errors ────────────────────────────────────────────────

export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentNotActiveError extends Error {
  constructor(agentId: string, status: string) {
    super(`Agent is not active: ${agentId} (status: ${status})`);
    this.name = 'AgentNotActiveError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskLockedError extends Error {
  constructor(taskId: string, lockedBy: string) {
    super(`Task is locked by another agent: ${taskId} (locked by: ${lockedBy})`);
    this.name = 'TaskLockedError';
  }
}

export class AdapterUnavailableError extends Error {
  constructor() {
    super('OpenCode adapter is not available. Ensure the opencode binary is installed and in PATH.');
    this.name = 'AdapterUnavailableError';
  }
}

export class BudgetExceededError extends Error {
  constructor(companyId: string, reason?: string) {
    super(`Budget exceeded for company ${companyId}${reason ? `: ${reason}` : ''}`);
    this.name = 'BudgetExceededError';
  }
}
