/**
 * Goal routes — Hono REST endpoints for Goal CRUD.
 *
 * All routes are mounted under /api/goals.
 * Multi-tenant isolation is enforced via project ownership validation.
 */

import { Hono } from 'hono';
import {
  createGoalSchema,
  updateGoalSchema,
  goalIdParamSchema,
  listGoalsQuerySchema,
} from './schema.js';
import {
  listGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
} from './service.js';

const goals = new Hono();

/**
 * GET /api/goals
 * List goals with optional filters (projectId, status).
 */
goals.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listGoalsQuerySchema.parse(query);

  const result = await listGoals(companyId, filters);
  return c.json({ data: result });
});

/**
 * GET /api/goals/:id
 * Get a single goal by ID with nested tasks.
 */
goals.get('/:id', async (c) => {
  const { id } = goalIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const goal = await getGoalById(id, companyId);

  if (!goal) {
    return c.json({ error: 'Goal not found', code: 404 }, 404);
  }

  return c.json({ data: goal });
});

/**
 * POST /api/goals
 * Create a new goal under a project.
 */
goals.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createGoalSchema.parse(body);

  const goal = await createGoal(data, companyId);

  if (!goal) {
    return c.json({ error: 'Project not found', code: 404 }, 404);
  }

  return c.json({ data: goal }, 201);
});

/**
 * PATCH /api/goals/:id
 * Update an existing goal.
 */
goals.patch('/:id', async (c) => {
  const { id } = goalIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = updateGoalSchema.parse(body);

  const goal = await updateGoal(id, data, companyId);

  if (!goal) {
    return c.json({ error: 'Goal not found', code: 404 }, 404);
  }

  return c.json({ data: goal });
});

/**
 * DELETE /api/goals/:id
 * Delete a goal and cascade to tasks.
 */
goals.delete('/:id', async (c) => {
  const { id } = goalIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const result = await deleteGoal(id, companyId);

  if (!result) {
    return c.json({ error: 'Goal not found', code: 404 }, 404);
  }

  return c.json({ message: 'Goal deleted' });
});

export default goals;
