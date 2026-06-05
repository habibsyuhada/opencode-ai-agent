/**
 * Activity routes — Hono REST endpoints for ActivityEvent querying
 * and the activity feed.
 *
 * All routes are mounted under /api/activity.
 * Multi-tenant isolation is enforced by the company scope middleware.
 *
 * Key endpoints:
 * - GET  /api/activity           — List activity events
 * - GET  /api/activity/feed      — Activity feed (recent activity)
 * - GET  /api/activity/stats     — Activity statistics
 * - GET  /api/activity/:id       — Get activity event by ID
 * - POST /api/activity           — Create activity event
 */

import { Hono } from 'hono';
import {
  createActivityEventSchema,
  listActivityEventsQuerySchema,
  activityEventIdParamSchema,
} from './schema.js';
import {
  listActivityEvents,
  getActivityEventById,
  createActivityEvent,
  getActivityFeed,
  getActivityStats,
} from './service.js';

const activity = new Hono();

/**
 * GET /api/activity
 * List activity events with optional filters.
 */
activity.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listActivityEventsQuerySchema.parse(query);

  const result = await listActivityEvents(companyId, filters);
  return c.json({ data: result });
});

/**
 * GET /api/activity/feed
 * Activity feed — recent activity across the company.
 * Optional query params: limit, actions (comma-separated), actorTypes (comma-separated)
 */
activity.get('/feed', async (c) => {
  const companyId = c.get('companyId');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const actionsStr = c.req.query('actions');
  const actorTypesStr = c.req.query('actorTypes');

  const actions = actionsStr ? actionsStr.split(',').map((s) => s.trim()) : undefined;
  const actorTypes = actorTypesStr ? actorTypesStr.split(',').map((s) => s.trim()) : undefined;

  const result = await getActivityFeed(companyId, {
    limit: Math.min(limit, 100),
    actions,
    actorTypes,
  });

  return c.json({ data: result });
});

/**
 * GET /api/activity/stats
 * Activity statistics for the company.
 */
activity.get('/stats', async (c) => {
  const companyId = c.get('companyId');

  const stats = await getActivityStats(companyId);
  return c.json({ data: stats });
});

/**
 * GET /api/activity/:id
 * Get a single activity event by ID.
 */
activity.get('/:id', async (c) => {
  const { id } = activityEventIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const event = await getActivityEventById(id, companyId);

  if (!event) {
    return c.json({ error: 'Activity event not found', code: 404 }, 404);
  }

  return c.json({ data: event });
});

/**
 * POST /api/activity
 * Create a new activity event.
 */
activity.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createActivityEventSchema.parse(body);

  const event = await createActivityEvent(data, companyId);
  return c.json({ data: event }, 201);
});

export default activity;
