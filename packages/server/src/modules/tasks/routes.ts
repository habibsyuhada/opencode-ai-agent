/**
 * Task routes — Hono REST endpoints for Task CRUD, checkout, release,
 * assignment, and commenting.
 *
 * All routes are mounted under /api/tasks.
 * Multi-tenant isolation is enforced via Goal → Project → Company chain.
 *
 * Key endpoints:
 * - POST /api/tasks/:id/checkout  — Atomic lock for agent execution
 * - POST /api/tasks/:id/release   — Unlock after completion
 * - POST /api/tasks/:id/assign    — Assign task to an agent
 * - POST /api/tasks/:id/comments  — Add a comment to a task
 */

import { Hono } from 'hono';
import {
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
  listTasksQuerySchema,
  checkoutTaskSchema,
  releaseTaskSchema,
  assignTaskSchema,
  addCommentSchema,
} from './schema.js';
import {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  checkoutTask,
  releaseTask,
  assignTask,
  addTaskComment,
} from './service.js';

const tasks = new Hono();

/**
 * GET /api/tasks
 * List tasks with optional filters (goalId, assigneeId, status, priority).
 */
tasks.get('/', async (c) => {
  const companyId = c.get('companyId');
  const query = c.req.query();
  const filters = listTasksQuerySchema.parse(query);

  const result = await listTasks(companyId, filters);
  return c.json({ data: result });
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID with nested goal, assignee, and recent heartbeats.
 */
tasks.get('/:id', async (c) => {
  const { id } = taskIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const task = await getTaskById(id, companyId);

  if (!task) {
    return c.json({ error: 'Task not found', code: 404 }, 404);
  }

  return c.json({ data: task });
});

/**
 * POST /api/tasks
 * Create a new task under a goal.
 */
tasks.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createTaskSchema.parse(body);

  const task = await createTask(data, companyId);

  if (!task) {
    return c.json({ error: 'Goal not found', code: 404 }, 404);
  }

  return c.json({ data: task }, 201);
});

/**
 * PATCH /api/tasks/:id
 * Update an existing task.
 */
tasks.patch('/:id', async (c) => {
  const { id } = taskIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = updateTaskSchema.parse(body);

  const task = await updateTask(id, data, companyId);

  if (!task) {
    return c.json({ error: 'Task not found', code: 404 }, 404);
  }

  return c.json({ data: task });
});

/**
 * DELETE /api/tasks/:id
 * Delete a task.
 */
tasks.delete('/:id', async (c) => {
  const { id } = taskIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const result = await deleteTask(id, companyId);

  if (!result) {
    return c.json({ error: 'Task not found', code: 404 }, 404);
  }

  return c.json({ message: 'Task deleted' });
});

/**
 * POST /api/tasks/:id/checkout
 * Atomic checkout — lock a task for an agent to execute.
 * Uses Prisma $transaction with SELECT ... FOR UPDATE.
 * Returns 409 Conflict if already locked by another agent.
 *
 * Architecture reference: docs/architecture/architecture.md §7, §13
 */
tasks.post('/:id/checkout', async (c) => {
  const { id } = taskIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = checkoutTaskSchema.parse(body);

  const result = await checkoutTask(id, data, companyId);

  if (result.error === 'NOT_FOUND') {
    return c.json({ error: 'Task not found', code: 404 }, 404);
  }

  if (result.error === 'ALREADY_LOCKED') {
    return c.json(
      { error: 'Task is already locked by another agent', code: 409 },
      409
    );
  }

  return c.json({ data: result.data });
});

/**
 * POST /api/tasks/:id/release
 * Release — unlock a task after agent completes work.
 * Uses transaction to verify ownership and update atomically.
 * Optionally updates status and attaches artifacts.
 */
tasks.post('/:id/release', async (c) => {
  const { id } = taskIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const { agentId, status, artifacts } = body;

  const data = releaseTaskSchema.parse({ agentId });

  const result = await releaseTask(id, data, companyId, {
    status,
    artifacts,
  });

  if (result.error === 'NOT_FOUND') {
    return c.json({ error: 'Task not found', code: 404 }, 404);
  }

  if (result.error === 'NOT_ASSIGNED') {
    return c.json(
      { error: 'Agent is not assigned to this task', code: 403 },
      403
    );
  }

  return c.json({ data: result.data });
});

/**
 * POST /api/tasks/:id/assign
 * Assign a task to an agent.
 * Does not lock the task — use checkout for execution locks.
 * Returns 404 if task or agent not found, 409 if already assigned.
 */
tasks.post('/:id/assign', async (c) => {
  const { id } = taskIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = assignTaskSchema.parse(body);

  const result = await assignTask(id, data, companyId);

  if (result.error === 'NOT_FOUND') {
    return c.json({ error: 'Task not found', code: 404 }, 404);
  }

  if (result.error === 'AGENT_NOT_FOUND') {
    return c.json({ error: 'Agent not found in this company', code: 404 }, 404);
  }

  if (result.error === 'ALREADY_ASSIGNED') {
    return c.json(
      { error: 'Task is already assigned to this agent', code: 409 },
      409
    );
  }

  return c.json({ data: result.data });
});

/**
 * POST /api/tasks/:id/comments
 * Add a comment to a task.
 * Comments are stored as ActivityEvent records.
 */
tasks.post('/:id/comments', async (c) => {
  const { id } = taskIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = addCommentSchema.parse(body);

  const result = await addTaskComment(id, data, companyId);

  if (result.error === 'NOT_FOUND') {
    return c.json({ error: 'Task not found', code: 404 }, 404);
  }

  return c.json({ data: result.data }, 201);
});

export default tasks;
