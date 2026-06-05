/**
 * Orchestrator Routes — API endpoints for project workflow management.
 *
 * Mounted under /api/orchestrator
 *
 * Endpoints:
 * - POST /projects — Create a new project with agents
 * - GET /projects — List all projects
 * - GET /projects/:id — Get project details
 * - POST /projects/:id/start-documentation — Start documentation phase
 * - POST /projects/:id/approve-documentation — Approve/reject documentation
 * - GET /projects/:id/questions — Get pending questions
 * - POST /questions/:id/answer — Answer a question
 */

import { Hono } from 'hono';
import {
  createProjectWithAgents,
  listProjects,
  getProjectDetails,
  startDocumentationPhase,
  approveDocumentation,
  getPendingQuestions,
  answerQuestion,
} from './service.js';

const orchestrator = new Hono();

// ── Project Management ────────────────────────────────────────

/**
 * POST /api/orchestrator/projects
 * Create a new project with auto-provisioned agents.
 * Body: { name, description, folderPath }
 */
orchestrator.post('/projects', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.name || !body.description || !body.folderPath) {
    return c.json({
      error: 'Missing required fields: name, description, folderPath',
    }, 400);
  }

  const result = await createProjectWithAgents(
    {
      name: body.name,
      description: body.description,
      folderPath: body.folderPath,
    },
    user.companyId
  );

  return c.json({ data: result }, 201);
});

/**
 * GET /api/orchestrator/projects
 * List all projects for the current company.
 */
orchestrator.get('/projects', async (c) => {
  const user = c.get('user');
  const projects = await listProjects(user.companyId);
  return c.json({ data: projects });
});

/**
 * GET /api/orchestrator/projects/:id
 * Get full project details including documentation, questions, and tasks.
 */
orchestrator.get('/projects/:id', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const project = await getProjectDetails(id, user.companyId);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  return c.json({ data: project });
});

// ── Documentation Phase ───────────────────────────────────────

/**
 * POST /api/orchestrator/projects/:id/start-documentation
 * Start the documentation phase for a project.
 * Creates tasks for PRD, Architecture, and Stories generation.
 */
orchestrator.post('/projects/:id/start-documentation', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  try {
    const result = await startDocumentationPhase(id, user.companyId);
    return c.json({ data: result });
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : 'Failed to start documentation',
    }, 400);
  }
});

/**
 * POST /api/orchestrator/projects/:id/approve-documentation
 * Approve or reject the project documentation.
 * Body: { approved: boolean, rejectionReason?: string }
 */
orchestrator.post('/projects/:id/approve-documentation', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();
  const body = await c.req.json();

  if (typeof body.approved !== 'boolean') {
    return c.json({ error: 'approved must be a boolean' }, 400);
  }

  try {
    const result = await approveDocumentation(
      id,
      user.companyId,
      body.approved,
      body.rejectionReason
    );
    return c.json({ data: result });
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : 'Failed to approve documentation',
    }, 400);
  }
});

// ── Questions ─────────────────────────────────────────────────

/**
 * GET /api/orchestrator/projects/:id/questions
 * Get all pending questions for a project.
 */
orchestrator.get('/projects/:id/questions', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();

  const questions = await getPendingQuestions(id, user.companyId);
  return c.json({ data: questions });
});

/**
 * POST /api/orchestrator/questions/:id/answer
 * Answer an agent's question.
 * Body: { answer: string }
 */
orchestrator.post('/questions/:id/answer', async (c) => {
  const user = c.get('user');
  const { id } = c.req.param();
  const body = await c.req.json();

  if (!body.answer) {
    return c.json({ error: 'answer is required' }, 400);
  }

  try {
    const result = await answerQuestion(id, body.answer, user.companyId);
    return c.json({ data: result });
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : 'Failed to answer question',
    }, 400);
  }
});

export default orchestrator;
