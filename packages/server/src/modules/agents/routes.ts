/**
 * Agent routes — Hono REST endpoints for Agent CRUD and org chart.
 *
 * All routes are mounted under /api/agents.
 * Multi-tenant isolation is enforced by the company scope middleware.
 */

import { Hono } from 'hono';
import {
  createAgentSchema,
  updateAgentSchema,
  agentIdParamSchema,
  listAgentsQuerySchema,
} from './schema.js';
import {
  listAgents,
  getAgentById,
  getOrgChart,
  createAgent,
  updateAgent,
} from './service.js';

const agents = new Hono();

/**
 * GET /api/agents
 * List agents with optional filters (role, status, managerId).
 * Query param ?tree=true returns the org chart tree structure.
 */
agents.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();

  // Support ?tree=true for org chart visualization
  if (query.tree === 'true') {
    const tree = await getOrgChart(companyId);
    return c.json({ data: tree });
  }

  const filters = listAgentsQuerySchema.parse(query);
  const result = await listAgents(companyId, filters);

  return c.json({ data: result });
});

/**
 * GET /api/agents/:id
 * Get a single agent by ID.
 */
agents.get('/:id', async (c) => {
  const { id } = agentIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const agent = await getAgentById(id, companyId);

  if (!agent) {
    return c.json({ error: 'Agent not found', code: 404 }, 404);
  }

  return c.json({ data: agent });
});

/**
 * POST /api/agents
 * Hire a new agent.
 */
agents.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createAgentSchema.parse(body);

  const agent = await createAgent(data, companyId);
  return c.json({ data: agent }, 201);
});

/**
 * PATCH /api/agents/:id
 * Update an existing agent (e.g., pause/resume, change role).
 */
agents.patch('/:id', async (c) => {
  const { id } = agentIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = updateAgentSchema.parse(body);

  const agent = await updateAgent(id, data, companyId);

  if (!agent) {
    return c.json({ error: 'Agent not found', code: 404 }, 404);
  }

  return c.json({ data: agent });
});

export default agents;
