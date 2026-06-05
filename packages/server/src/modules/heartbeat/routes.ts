/**
 * Heartbeat routes — Hono REST endpoints for triggering and monitoring executions.
 *
 * All routes are mounted under /api/heartbeats and /api/agents/:agentId/heartbeat.
 * Multi-tenant isolation is enforced via the company scope middleware.
 *
 * Key endpoints:
 * - POST /api/agents/:agentId/heartbeat       — Trigger immediate execution (Manual)
 * - POST /api/agents/:agentId/heartbeat/auto   — Auto-pick task and trigger (Scheduled/Event)
 * - GET  /api/heartbeats/:id                    — Poll execution status
 * - GET  /api/heartbeats/:id/logs               — Stream execution logs via SSE (STORY-019)
 * - GET  /api/heartbeats                        — List heartbeats with filters
 * - GET  /api/agents/:agentId/heartbeat/stats   — Agent execution statistics
 * - POST /api/heartbeats/recover                — Recover orphaned runs
 *
 * Architecture reference: docs/architecture/architecture.md §7
 * - "POST /api/agents/:agentId/heartbeat — Triggers immediate execution loop"
 * - "GET /api/heartbeats/:id — Polls status"
 *
 * STORY-009: Added auto-trigger, orphan recovery, and trigger type support.
 * STORY-019: Added SSE endpoint for real-time log streaming.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  triggerHeartbeatSchema,
  autoTriggerHeartbeatSchema,
  heartbeatIdParamSchema,
  agentIdParamSchema,
  listHeartbeatsQuerySchema,
  recoverOrphansSchema,
} from './schema.js';
import {
  triggerHeartbeat,
  autoTriggerHeartbeat,
  recoverOrphanedRuns,
  getHeartbeatById,
  listHeartbeats,
  getHeartbeatStats,
  AgentNotFoundError,
  AgentNotActiveError,
  TaskNotFoundError,
  TaskLockedError,
  AdapterUnavailableError,
  BudgetExceededError,
} from './service.js';
import { heartbeatLogEmitter, type LogChunk, type LogStatusEvent } from './log-emitter.js';

/**
 * Heartbeat routes mounted under /api/heartbeats.
 *
 * Provides status polling, listing, and recovery endpoints.
 */
const heartbeats = new Hono();

/**
 * GET /api/heartbeats
 * List heartbeats with optional filters (agentId, taskId, status, triggerType).
 */
heartbeats.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listHeartbeatsQuerySchema.parse(query);

  const result = await listHeartbeats(companyId, filters);
  return c.json({ data: result });
});

/**
 * GET /api/heartbeats/:id
 * Get a single heartbeat by ID with agent, task, and cost event details.
 */
heartbeats.get('/:id', async (c) => {
  const { id } = heartbeatIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const heartbeat = await getHeartbeatById(id, companyId);

  if (!heartbeat) {
    return c.json({ error: 'Heartbeat not found', code: 404 }, 404);
  }

  return c.json({ data: heartbeat });
});

/**
 * GET /api/heartbeats/:id/logs
 * Stream real-time execution logs via Server-Sent Events (SSE).
 *
 * STORY-019: Real-time Heartbeat Logs UI
 *
 * Connects to the HeartbeatLogEmitter to receive log chunks as they arrive
 * from the OpenCode adapter's stdout/stderr streams.
 *
 * Behavior:
 * - Replays buffered log chunks to the client immediately upon connection
 * - Streams new log chunks in real-time as they arrive
 * - Emits status events (started, completed, failed, timeout)
 * - Sends a heartbeat ping every 15 seconds to keep the connection alive
 * - Automatically closes when execution completes/fails/timeout
 *
 * SSE Event Types:
 * - `log`: A log chunk with stream (stdout/stderr), data, and timestamp
 * - `status`: Execution status change (started/completed/failed/timeout)
 * - `ping`: Keep-alive signal
 */
heartbeats.get('/:id/logs', async (c) => {
  const { id: heartbeatId } = heartbeatIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  // Verify the heartbeat exists and belongs to this company
  const heartbeat = await getHeartbeatById(heartbeatId, companyId);
  if (!heartbeat) {
    return c.json({ error: 'Heartbeat not found', code: 404 }, 404);
  }

  return streamSSE(c, async (stream) => {
    let closed = false;

    // Helper to safely write to the stream
    const safeWrite = async (event: string, data: string, id?: string) => {
      if (closed) return;
      try {
        await stream.writeSSE({ event, data, id });
      } catch {
        closed = true;
      }
    };

    // 1. Replay buffered log chunks
    const buffer = heartbeatLogEmitter.getBuffer(heartbeatId);
    for (const chunk of buffer) {
      await safeWrite('log', JSON.stringify(chunk), `log-${chunk.timestamp}`);
    }

    // 2. Subscribe to new log chunks
    const unsubLog = heartbeatLogEmitter.onLog(heartbeatId, async (chunk: LogChunk) => {
      await safeWrite('log', JSON.stringify(chunk), `log-${chunk.timestamp}`);
    });

    // 3. Subscribe to status events
    const unsubStatus = heartbeatLogEmitter.onStatus(
      heartbeatId,
      async (event: LogStatusEvent) => {
        await safeWrite('status', JSON.stringify(event), `status-${event.timestamp}`);
        // Close stream on terminal status
        if (event.status === 'completed' || event.status === 'failed' || event.status === 'timeout') {
          // Small delay to let final events flush
          setTimeout(() => {
            closed = true;
            stream.close();
          }, 500);
        }
      }
    );

    // 4. Send initial status if execution already completed
    if (heartbeat.status === 'COMPLETED' || heartbeat.status === 'FAILED') {
      await safeWrite(
        'status',
        JSON.stringify({
          heartbeatId,
          status: heartbeat.status === 'COMPLETED' ? 'completed' : 'failed',
          timestamp: new Date().toISOString(),
          finalOutput: heartbeat.log,
        } satisfies LogStatusEvent)
      );
      // Close after sending final status
      setTimeout(() => {
        closed = true;
        stream.close();
      }, 500);
    }

    // 5. Keep-alive ping every 15 seconds
    const pingInterval = setInterval(async () => {
      if (closed) {
        clearInterval(pingInterval);
        return;
      }
      await safeWrite('ping', JSON.stringify({ timestamp: new Date().toISOString() }));
    }, 15_000);

    // 6. Cleanup on client disconnect
    stream.onAbort(() => {
      closed = true;
      clearInterval(pingInterval);
      unsubLog();
      unsubStatus();
    });

    // 7. Keep stream open until closed
    while (!closed) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Final cleanup
    clearInterval(pingInterval);
    unsubLog();
    unsubStatus();
  });
});

/**
 * POST /api/heartbeats/recover
 * Recover orphaned heartbeat runs.
 *
 * Finds heartbeat records stuck in RUNNING status beyond the stale threshold
 * and marks them as FAILED. Also unlocks associated tasks.
 *
 * Request body:
 * - staleMinutes: number (optional, default: 10) — Minutes before a run is considered orphaned
 */
heartbeats.post('/recover', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json().catch(() => ({}));
  const input = recoverOrphansSchema.parse(body);

  const result = await recoverOrphanedRuns(input, companyId);

  return c.json({ data: result });
});

export default heartbeats;

/**
 * Agent-specific heartbeat routes mounted under /api/agents/:agentId/heartbeat.
 *
 * Provides trigger and statistics endpoints scoped to a specific agent.
 */
const agentHeartbeats = new Hono();

/**
 * POST /api/agents/:agentId/heartbeat
 * Trigger an immediate heartbeat execution for the agent with a specific task.
 *
 * Creates a PENDING heartbeat record and starts async execution.
 * Returns the heartbeat ID immediately for status polling.
 *
 * Request body:
 * - taskId: string (required) — The task to execute
 * - prompt: string (optional) — Custom prompt override
 * - timeoutMs: number (optional) — Execution timeout
 * - contextFiles: string[] (optional) — Additional context files
 * - triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT' (optional, default: 'MANUAL')
 */
agentHeartbeats.post('/', async (c) => {
  const { agentId } = agentIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const input = triggerHeartbeatSchema.parse(body);

  try {
    const result = await triggerHeartbeat(agentId, input, companyId);
    return c.json({ data: result }, 202); // 202 Accepted — async execution started
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      return c.json({ error: err.message, code: 404 }, 404);
    }
    if (err instanceof AgentNotActiveError) {
      return c.json({ error: err.message, code: 409 }, 409);
    }
    if (err instanceof TaskNotFoundError) {
      return c.json({ error: err.message, code: 404 }, 404);
    }
    if (err instanceof TaskLockedError) {
      return c.json({ error: err.message, code: 409 }, 409);
    }
    if (err instanceof AdapterUnavailableError) {
      return c.json({ error: err.message, code: 503 }, 503);
    }
    if (err instanceof BudgetExceededError) {
      return c.json({ error: err.message, code: 402 }, 402);
    }
    throw err; // Let error handler middleware catch unexpected errors
  }
});

/**
 * POST /api/agents/:agentId/heartbeat/auto
 * Auto-trigger a heartbeat by picking the next available task from the agent's queue.
 *
 * The engine automatically finds the highest-priority unblocked task assigned
 * to this agent and triggers execution. This is the endpoint for scheduled
 * (cron) and event-based triggers.
 *
 * If no tasks are available, returns 204 No Content.
 * If budget is exceeded, returns 402 Payment Required.
 *
 * Request body:
 * - prompt: string (optional) — Custom prompt override
 * - timeoutMs: number (optional) — Execution timeout
 * - contextFiles: string[] (optional) — Additional context files
 * - triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT' (optional, default: 'SCHEDULED')
 */
agentHeartbeats.post('/auto', async (c) => {
  const { agentId } = agentIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json().catch(() => ({}));
  const input = autoTriggerHeartbeatSchema.parse(body);

  try {
    const result = await autoTriggerHeartbeat(agentId, input, companyId);

    if (!result) {
      return c.json(
        { data: null, message: 'No tasks available or budget exceeded' },
        204
      );
    }

    return c.json({ data: result }, 202);
  } catch (err) {
    if (err instanceof AgentNotFoundError) {
      return c.json({ error: err.message, code: 404 }, 404);
    }
    if (err instanceof AgentNotActiveError) {
      return c.json({ error: err.message, code: 409 }, 409);
    }
    if (err instanceof BudgetExceededError) {
      return c.json({ error: err.message, code: 402 }, 402);
    }
    throw err;
  }
});

/**
 * GET /api/agents/:agentId/heartbeat/stats
 * Get heartbeat execution statistics for the agent.
 *
 * Returns aggregated data: total runs, success rate, total tokens, total cost.
 */
agentHeartbeats.get('/stats', async (c) => {
  const { agentId } = agentIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const stats = await getHeartbeatStats(agentId, companyId);

  if (!stats) {
    return c.json({ error: 'Agent not found', code: 404 }, 404);
  }

  return c.json({ data: stats });
});

export { agentHeartbeats };
