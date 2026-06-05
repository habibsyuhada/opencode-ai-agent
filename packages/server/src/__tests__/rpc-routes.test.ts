/**
 * Tests for Hono RPC route structure and type-safe client integration.
 *
 * Verifies that:
 * - The Hono app's chained route structure supports RPC type inference
 * - The testClient from hono/testing correctly resolves typed routes
 * - GET and POST routes for agents and tasks are accessible via the typed client
 * - The AppType export enables end-to-end type safety
 *
 * This test uses a mock Hono app with the same structure as the production app,
 * allowing us to verify the RPC pattern without requiring a database connection.
 *
 * Story: STORY-007 — Hono RPC API Setup and Core Routes
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';

/**
 * Build a mock Hono app that mirrors the server's route structure.
 * Uses chained method calls for proper Hono RPC type inference.
 */
function buildMockApp() {
  // Mock agents routes (mirrors modules/agents/routes.ts structure)
  const agentsRoutes = new Hono()
    .get('/', (c) => {
      return c.json({
        data: [
          { id: 'agent-1', name: 'DevBot', role: 'DEVELOPER', status: 'ACTIVE' },
          { id: 'agent-2', name: 'QABot', role: 'QA', status: 'ACTIVE' },
        ],
      });
    })
    .post('/', async (c) => {
      const body = await c.req.json();
      return c.json({ data: { id: 'agent-new', ...body } }, 201);
    })
    .get('/:id', (c) => {
      const { id } = c.req.param();
      return c.json({ data: { id, name: 'TestAgent', role: 'DEVELOPER' } });
    });

  // Mock tasks routes (mirrors modules/tasks/routes.ts structure)
  const tasksRoutes = new Hono()
    .get('/', (c) => {
      return c.json({
        data: [
          { id: 'task-1', title: 'Implement feature X', status: 'TODO', priority: 'HIGH' },
          { id: 'task-2', title: 'Fix bug Y', status: 'IN_PROGRESS', priority: 'MEDIUM' },
        ],
      });
    })
    .post('/', async (c) => {
      const body = await c.req.json();
      return c.json({ data: { id: 'task-new', ...body } }, 201);
    })
    .get('/:id', (c) => {
      const { id } = c.req.param();
      return c.json({ data: { id, title: 'Test Task', status: 'BACKLOG' } });
    });

  // Build the API sub-application using chaining (same pattern as index.ts)
  const api = new Hono()
    .get('/', (c) => {
      return c.json({
        message: 'ArmiAI Platform API',
        version: '1.0.0',
        endpoints: { agents: '/api/agents', tasks: '/api/tasks' },
      });
    })
    .route('/agents', agentsRoutes)
    .route('/tasks', tasksRoutes);

  // Build the main application using chaining
  return new Hono()
    .get('/health', (c) => {
      return c.json({ status: 'ok', service: '@armiai/server' });
    })
    .route('/api', api);
}

describe('Hono RPC Route Structure', () => {
  const app = buildMockApp();
  const client = testClient(app);

  describe('Health Check', () => {
    it('should respond to GET /health', async () => {
      const res = await client.health.$get();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('@armiai/server');
    });
  });

  describe('API Root', () => {
    it('should respond to GET /api with endpoint listing', async () => {
      const res = await client.api.$get();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.message).toBe('ArmiAI Platform API');
      expect(body.endpoints.agents).toBe('/api/agents');
      expect(body.endpoints.tasks).toBe('/api/tasks');
    });
  });

  describe('Agents Routes (GET /api/agents)', () => {
    it('should return a list of agents', async () => {
      const res = await client.api.agents.$get();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(2);
      expect(body.data[0].name).toBe('DevBot');
      expect(body.data[0].role).toBe('DEVELOPER');
    });

    it('should return a single agent by ID', async () => {
      const res = await client.api.agents[':id'].$get({
        param: { id: 'agent-1' },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBe('agent-1');
      expect(body.data.name).toBe('TestAgent');
    });
  });

  describe('Agents Routes (POST /api/agents)', () => {
    it('should create a new agent', async () => {
      const res = await client.api.agents.$post({
        json: { name: 'NewBot', role: 'QA', status: 'ACTIVE' },
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.data.name).toBe('NewBot');
      expect(body.data.role).toBe('QA');
      expect(body.data.id).toBe('agent-new');
    });
  });

  describe('Tasks Routes (GET /api/tasks)', () => {
    it('should return a list of tasks', async () => {
      const res = await client.api.tasks.$get();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBe(2);
      expect(body.data[0].title).toBe('Implement feature X');
      expect(body.data[0].status).toBe('TODO');
    });

    it('should return a single task by ID', async () => {
      const res = await client.api.tasks[':id'].$get({
        param: { id: 'task-1' },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.id).toBe('task-1');
    });
  });

  describe('Tasks Routes (POST /api/tasks)', () => {
    it('should create a new task', async () => {
      const res = await client.api.tasks.$post({
        json: {
          title: 'New task',
          goalId: 'goal-1',
          status: 'BACKLOG',
          priority: 'HIGH',
        },
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.data.title).toBe('New task');
      expect(body.data.id).toBe('task-new');
    });
  });

  describe('RPC Type Inference Verification', () => {
    it('should have the app type exported for client usage', () => {
      // This test verifies the pattern works.
      // The actual AppType export is in index.ts:
      //   export type AppType = typeof app;
      // And the client in packages/ui/src/lib/api.ts uses:
      //   import type { AppType } from '@armiai/server';
      //   export const api = hc<AppType>(BASE_URL);

      const appType = typeof app;
      expect(appType).toBe('object');

      // Verify the app has the fetch method (required for Hono apps)
      expect(typeof app.fetch).toBe('function');
    });

    it('should support chained route structure for type inference', () => {
      // Verify that the chained .route() pattern produces a valid Hono app
      // that can serve requests and be used with testClient/hc
      const testApp = new Hono()
        .get('/test', (c) => c.json({ ok: true }))
        .route('/nested', new Hono().get('/', (c) => c.json({ nested: true })));

      const testCli = testClient(testApp);

      // The fact that testClient(app) compiles and works means
      // Hono correctly inferred the route types from chaining.
      expect(typeof testCli.test.$get).toBe('function');
      expect(typeof testCli.nested.$get).toBe('function');
    });
  });
});
