/**
 * Budget routes — Hono REST endpoints for Budget CRUD, cost events,
 * cost breakdown, and budget status.
 *
 * All routes are mounted under /api/budgets.
 * Multi-tenant isolation is enforced by the company scope middleware.
 *
 * Key endpoints:
 * - GET    /api/budgets              — List budgets
 * - GET    /api/budgets/:id          — Get budget by ID
 * - POST   /api/budgets              — Create budget
 * - PATCH  /api/budgets/:id          — Update budget
 * - DELETE /api/budgets/:id          — Delete budget
 * - POST   /api/budgets/reset        — Reset all budgets (new billing period)
 * - GET    /api/budgets/status       — Check budget status
 * - GET    /api/budgets/breakdown    — Per-agent cost breakdown
 * - GET    /api/budgets/cost-events  — List cost events
 * - POST   /api/budgets/cost-events  — Record cost event
 */

import { Hono } from 'hono';
import {
  createBudgetSchema,
  updateBudgetSchema,
  budgetIdParamSchema,
  listBudgetsQuerySchema,
  recordCostEventSchema,
  listCostEventsQuerySchema,
  costBreakdownQuerySchema,
} from './schema.js';
import {
  listBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  resetBudgets,
  checkBudgetStatus,
  getCostBreakdown,
  recordCostEvent,
  listCostEvents,
} from './service.js';

const budgets = new Hono();

/**
 * GET /api/budgets
 * List budgets with optional agent filter.
 */
budgets.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listBudgetsQuerySchema.parse(query);

  const result = await listBudgets(companyId, filters);
  return c.json({ data: result });
});

/**
 * GET /api/budgets/status
 * Check budget status for the company or a specific agent.
 * Query param ?agentId=<id> to check agent-specific budget.
 */
budgets.get('/status', async (c) => {
  const companyId = c.get('companyId');
  const agentId = c.req.query('agentId');

  const status = await checkBudgetStatus(companyId, agentId);
  return c.json({ data: status });
});

/**
 * GET /api/budgets/breakdown
 * Get per-agent cost breakdown for a time period.
 * Query param ?period=day|week|month (default: month)
 */
budgets.get('/breakdown', async (c) => {
  const companyId = c.get('companyId');
  const query = costBreakdownQuerySchema.parse(c.req.query());

  const breakdown = await getCostBreakdown(companyId, query);
  return c.json({ data: breakdown });
});

/**
 * GET /api/budgets/cost-events
 * List cost events with optional filters.
 */
budgets.get('/cost-events', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listCostEventsQuerySchema.parse(query);

  const result = await listCostEvents(companyId, filters);
  return c.json({ data: result });
});

/**
 * POST /api/budgets/cost-events
 * Record a new cost event.
 */
budgets.post('/cost-events', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = recordCostEventSchema.parse(body);

  try {
    const result = await recordCostEvent(data, companyId);
    return c.json({ data: result }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Heartbeat not found')) {
      return c.json({ error: err.message, code: 404 }, 404);
    }
    throw err;
  }
});

/**
 * POST /api/budgets/reset
 * Reset all budget used amounts to zero.
 * Typically called at the start of a new billing period.
 */
budgets.post('/reset', async (c) => {
  const companyId = c.get('companyId');

  const result = await resetBudgets(companyId);
  return c.json({ data: result });
});

/**
 * GET /api/budgets/:id
 * Get a single budget by ID.
 */
budgets.get('/:id', async (c) => {
  const { id } = budgetIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const budget = await getBudgetById(id, companyId);

  if (!budget) {
    return c.json({ error: 'Budget not found', code: 404 }, 404);
  }

  return c.json({ data: budget });
});

/**
 * POST /api/budgets
 * Create a new budget.
 * Supports both global company budgets (no agentId) and per-agent budgets.
 */
budgets.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createBudgetSchema.parse(body);

  const result = await createBudget(data, companyId);

  if (result.error === 'AGENT_NOT_FOUND') {
    return c.json({ error: 'Agent not found in this company', code: 404 }, 404);
  }

  if (result.error === 'DUPLICATE_BUDGET') {
    return c.json(
      { error: 'A budget already exists for this scope (agent or company)', code: 409 },
      409
    );
  }

  return c.json({ data: result.data }, 201);
});

/**
 * PATCH /api/budgets/:id
 * Update an existing budget (monthly limit, currency, threshold).
 */
budgets.patch('/:id', async (c) => {
  const { id } = budgetIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = updateBudgetSchema.parse(body);

  const budget = await updateBudget(id, data, companyId);

  if (!budget) {
    return c.json({ error: 'Budget not found', code: 404 }, 404);
  }

  return c.json({ data: budget });
});

/**
 * DELETE /api/budgets/:id
 * Delete a budget.
 */
budgets.delete('/:id', async (c) => {
  const { id } = budgetIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const result = await deleteBudget(id, companyId);

  if (!result) {
    return c.json({ error: 'Budget not found', code: 404 }, 404);
  }

  return c.json({ message: 'Budget deleted' });
});

export default budgets;
