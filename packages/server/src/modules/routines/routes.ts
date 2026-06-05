/**
 * Routines routes — Hono REST endpoints for Routine CRUD,
 * trigger, and run history.
 *
 * All routes are mounted under /api/routines.
 * Multi-tenant isolation is enforced by the company scope middleware.
 *
 * Key endpoints:
 * - GET    /api/routines              — List routines
 * - GET    /api/routines/:id          — Get routine by ID
 * - POST   /api/routines              — Create routine
 * - PATCH  /api/routines/:id          — Update routine
 * - DELETE /api/routines/:id          — Delete routine
 * - POST   /api/routines/:id/trigger  — Manually trigger a routine
 * - GET    /api/routines/:id/runs     — List run history
 * - GET    /api/routines/:id/runs/:runId — Get run detail
 * - GET    /api/routines/:id/stats    — Get routine statistics
 *
 * Architecture reference: docs/architecture/architecture.md §6
 *   "FR-8: Schedules & Routines — Routine model, Cron trigger system"
 */

import { Hono } from 'hono';
import {
  createRoutineSchema,
  updateRoutineSchema,
  routineIdParamSchema,
  listRoutinesQuerySchema,
  listRoutineRunsQuerySchema,
  triggerRoutineSchema,
} from './schema.js';
import {
  listRoutines,
  getRoutineById,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  triggerRoutine,
  listRoutineRuns,
  getRoutineRunById,
  getRoutineStats,
} from './service.js';

const routines = new Hono();

/**
 * GET /api/routines
 * List routines with optional filters (agentId, enabled).
 */
routines.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listRoutinesQuerySchema.parse(query);

  const result = await listRoutines(companyId, filters);
  return c.json({ data: result });
});

/**
 * GET /api/routines/stats
 * Get aggregate routine statistics for the company.
 */
routines.get('/stats', async (c) => {
  const companyId = c.get('companyId');

  // Return a placeholder for now — individual stats are on /:id/stats
  return c.json({
    data: {
      companyId,
      message: 'Use /api/routines/:id/stats for per-routine statistics',
    },
  });
});

/**
 * GET /api/routines/:id
 * Get a single routine by ID with recent run history.
 */
routines.get('/:id', async (c) => {
  const { id } = routineIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const routine = await getRoutineById(id, companyId);

  if (!routine) {
    return c.json({ error: 'Routine not found', code: 404 }, 404);
  }

  return c.json({ data: routine });
});

/**
 * POST /api/routines
 * Create a new routine.
 */
routines.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createRoutineSchema.parse(body);

  const routine = await createRoutine(data, companyId);
  return c.json({ data: routine }, 201);
});

/**
 * PATCH /api/routines/:id
 * Update an existing routine.
 */
routines.patch('/:id', async (c) => {
  const { id } = routineIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = updateRoutineSchema.parse(body);

  const result = await updateRoutine(id, data, companyId);

  if (result.error === 'NOT_FOUND') {
    return c.json({ error: 'Routine not found', code: 404 }, 404);
  }

  return c.json({ data: result.data });
});

/**
 * DELETE /api/routines/:id
 * Delete a routine and all its run history.
 */
routines.delete('/:id', async (c) => {
  const { id } = routineIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const result = await deleteRoutine(id, companyId);

  if (result.error === 'NOT_FOUND') {
    return c.json({ error: 'Routine not found', code: 404 }, 404);
  }

  return c.json({ message: 'Routine deleted' });
});

/**
 * POST /api/routines/:id/trigger
 * Manually trigger a routine execution.
 *
 * Creates a RoutineRun and dispatches execution immediately.
 * Respects concurrency policies.
 */
routines.post('/:id/trigger', async (c) => {
  const { id } = routineIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json().catch(() => ({}));
  const input = triggerRoutineSchema.parse(body);

  const result = await triggerRoutine(id, input, companyId);

  if (result.error === 'NOT_FOUND') {
    return c.json({ error: 'Routine not found', code: 404 }, 404);
  }

  if (result.error === 'DISABLED') {
    return c.json({ error: 'Routine is disabled', code: 409 }, 409);
  }

  if (result.error === 'CONCURRENCY_LIMIT') {
    return c.json(
      { error: 'Concurrency limit reached — a run is already in progress', code: 409 },
      409
    );
  }

  return c.json({ data: result.data }, 202); // 202 Accepted
});

/**
 * GET /api/routines/:id/runs
 * List run history for a routine.
 */
routines.get('/:id/runs', async (c) => {
  const { id } = routineIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listRoutineRunsQuerySchema.parse(query);

  const result = await listRoutineRuns(id, companyId, filters);

  if (result === null) {
    return c.json({ error: 'Routine not found', code: 404 }, 404);
  }

  return c.json({ data: result });
});

/**
 * GET /api/routines/:id/runs/:runId
 * Get a single routine run detail.
 */
routines.get('/:id/runs/:runId', async (c) => {
  const { id } = routineIdParamSchema.parse(c.req.param());
  const runId = c.req.param('runId');
  const companyId = c.get('companyId');

  const run = await getRoutineRunById(runId, id, companyId);

  if (!run) {
    return c.json({ error: 'Routine run not found', code: 404 }, 404);
  }

  return c.json({ data: run });
});

/**
 * GET /api/routines/:id/stats
 * Get routine execution statistics.
 */
routines.get('/:id/stats', async (c) => {
  const { id } = routineIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const stats = await getRoutineStats(id, companyId);

  if (!stats) {
    return c.json({ error: 'Routine not found', code: 404 }, 404);
  }

  return c.json({ data: stats });
});

export default routines;
