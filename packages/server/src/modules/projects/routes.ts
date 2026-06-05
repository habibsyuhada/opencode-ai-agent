/**
 * Project routes — Hono REST endpoints for Project CRUD.
 *
 * All routes are mounted under /api/projects.
 * Multi-tenant isolation is enforced by the company scope middleware.
 */

import { Hono } from 'hono';
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
} from './schema.js';
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from './service.js';

const projects = new Hono();

/**
 * GET /api/projects
 * List all projects for the authenticated company.
 */
projects.get('/', async (c) => {
  const companyId = c.get('companyId');
  const result = await listProjects(companyId);

  return c.json({ data: result });
});

/**
 * GET /api/projects/:id
 * Get a single project by ID with nested goals.
 */
projects.get('/:id', async (c) => {
  const { id } = projectIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const project = await getProjectById(id, companyId);

  if (!project) {
    return c.json({ error: 'Project not found', code: 404 }, 404);
  }

  return c.json({ data: project });
});

/**
 * POST /api/projects
 * Create a new project.
 */
projects.post('/', async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = createProjectSchema.parse(body);

  const project = await createProject(data, companyId);
  return c.json({ data: project }, 201);
});

/**
 * PATCH /api/projects/:id
 * Update an existing project.
 */
projects.patch('/:id', async (c) => {
  const { id } = projectIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const data = updateProjectSchema.parse(body);

  const project = await updateProject(id, data, companyId);

  if (!project) {
    return c.json({ error: 'Project not found', code: 404 }, 404);
  }

  return c.json({ data: project });
});

/**
 * DELETE /api/projects/:id
 * Delete a project and cascade to goals/tasks.
 */
projects.delete('/:id', async (c) => {
  const { id } = projectIdParamSchema.parse(c.req.param());
  const companyId = c.get('companyId');

  const result = await deleteProject(id, companyId);

  if (!result) {
    return c.json({ error: 'Project not found', code: 404 }, 404);
  }

  return c.json({ message: 'Project deleted' });
});

export default projects;
