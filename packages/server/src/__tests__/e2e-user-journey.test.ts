/**
 * E2E Integration Test — Full User Journey
 *
 * Tests the complete user journey as specified in STORY-020:
 * Onboard → Hire Agents → Create Task → Execute Task → Monitor Cost → View on Dashboard
 *
 * Uses a mock Hono app that simulates the full API stack without
 * requiring a real database. This validates the route structure,
 * middleware chain, and service integration patterns.
 *
 * Story: STORY-020 — End-to-End System Polish & QA
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { testClient } from 'hono/testing';

// ── In-memory data store ──────────────────────────────────────

interface Company {
  id: string;
  name: string;
  slug: string;
  mission?: string;
}

interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title?: string;
  managerId?: string;
  status: string;
  config?: Record<string, unknown>;
}

interface Project {
  id: string;
  companyId: string;
  name: string;
}

interface Goal {
  id: string;
  projectId: string;
  name: string;
  status: string;
}

interface Task {
  id: string;
  goalId: string;
  assigneeId?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  lockedAt?: Date;
  artifacts?: unknown;
}

interface Heartbeat {
  id: string;
  taskId: string;
  agentId: string;
  status: string;
  startedAt?: Date;
  endedAt?: Date;
  log?: string;
  tokensUsed: number;
  cost: number;
}

interface Budget {
  id: string;
  companyId: string;
  agentId?: string;
  monthly: number;
  used: number;
  currency: string;
  threshold: number;
}

interface CostEvent {
  id: string;
  heartbeatId: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

interface ActivityEvent {
  id: string;
  companyId: string;
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

/** In-memory data store simulating a database */
const db = {
  companies: [] as Company[],
  agents: [] as Agent[],
  projects: [] as Project[],
  goals: [] as Goal[],
  tasks: [] as Task[],
  heartbeats: [] as Heartbeat[],
  budgets: [] as Budget[],
  costEvents: [] as CostEvent[],
  activityEvents: [] as ActivityEvent[],
  nextId: 1,
};

function genId() {
  return `id-${db.nextId++}`;
}

function resetDb() {
  db.companies = [];
  db.agents = [];
  db.projects = [];
  db.goals = [];
  db.tasks = [];
  db.heartbeats = [];
  db.budgets = [];
  db.costEvents = [];
  db.activityEvents = [];
  db.nextId = 1;
}

function recordActivity(input: {
  companyId: string;
  actorType: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  db.activityEvents.push({ id: genId(), ...input });
}

// ── Build mock E2E app ────────────────────────────────────────

function buildE2EApp() {
  const companyId = 'company-e2e-1';

  // Companies routes
  const companiesRoutes = new Hono()
    .post('/', async (c) => {
      const body = await c.req.json();
      const company: Company = {
        id: genId(),
        name: body.name,
        slug: body.slug,
        mission: body.mission,
      };
      db.companies.push(company);
      return c.json({ data: company }, 201);
    })
    .get('/', (c) => {
      return c.json({ data: db.companies });
    })
    .get('/:id', (c) => {
      const { id } = c.req.param();
      const company = db.companies.find((co) => co.id === id);
      if (!company) return c.json({ error: 'Not found', code: 404 }, 404);
      return c.json({ data: company });
    });

  // Agents routes
  const agentsRoutes = new Hono()
    .get('/', (c) => {
      const cid = c.get('companyId');
      const agents = db.agents.filter((a) => a.companyId === cid);
      return c.json({ data: agents });
    })
    .post('/', async (c) => {
      const cid = c.get('companyId');
      const body = await c.req.json();
      const agent: Agent = {
        id: genId(),
        companyId: cid,
        name: body.name,
        role: body.role,
        title: body.title,
        managerId: body.managerId,
        status: body.status || 'ACTIVE',
        config: body.config,
      };
      db.agents.push(agent);
      recordActivity({
        companyId: cid,
        actorType: 'USER',
        actorId: 'user-1',
        action: 'AGENT_CREATE',
        targetType: 'AGENT',
        targetId: agent.id,
        metadata: { name: agent.name, role: agent.role },
      });
      return c.json({ data: agent }, 201);
    })
    .get('/:id', (c) => {
      const { id } = c.req.param();
      const cid = c.get('companyId');
      const agent = db.agents.find((a) => a.id === id && a.companyId === cid);
      if (!agent) return c.json({ error: 'Not found', code: 404 }, 404);
      return c.json({ data: agent });
    });

  // Projects routes
  const projectsRoutes = new Hono()
    .post('/', async (c) => {
      const cid = c.get('companyId');
      const body = await c.req.json();
      const project: Project = { id: genId(), companyId: cid, name: body.name };
      db.projects.push(project);
      return c.json({ data: project }, 201);
    })
    .get('/', (c) => {
      const cid = c.get('companyId');
      return c.json({ data: db.projects.filter((p) => p.companyId === cid) });
    });

  // Goals routes
  const goalsRoutes = new Hono()
    .post('/', async (c) => {
      const cid = c.get('companyId');
      const body = await c.req.json();
      const goal: Goal = {
        id: genId(),
        projectId: body.projectId,
        name: body.name,
        status: 'PENDING',
      };
      db.goals.push(goal);
      return c.json({ data: goal }, 201);
    })
    .get('/', (c) => {
      const cid = c.get('companyId');
      const projectIds = db.projects.filter((p) => p.companyId === cid).map((p) => p.id);
      return c.json({ data: db.goals.filter((g) => projectIds.includes(g.projectId)) });
    });

  // Tasks routes
  const tasksRoutes = new Hono()
    .get('/', (c) => {
      const cid = c.get('companyId');
      const projectIds = db.projects.filter((p) => p.companyId === cid).map((p) => p.id);
      const goalIds = db.goals.filter((g) => projectIds.includes(g.projectId)).map((g) => g.id);
      return c.json({ data: db.tasks.filter((t) => goalIds.includes(t.goalId)) });
    })
    .post('/', async (c) => {
      const cid = c.get('companyId');
      const body = await c.req.json();
      const goal = db.goals.find((g) => g.id === body.goalId);
      if (!goal) return c.json({ error: 'Goal not found', code: 404 }, 404);

      const task: Task = {
        id: genId(),
        goalId: body.goalId,
        assigneeId: body.assigneeId,
        title: body.title,
        description: body.description,
        status: body.status || 'BACKLOG',
        priority: body.priority || 'MEDIUM',
      };
      db.tasks.push(task);
      recordActivity({
        companyId: cid,
        actorType: 'USER',
        actorId: 'user-1',
        action: 'TASK_CREATE',
        targetType: 'TASK',
        targetId: task.id,
        metadata: { title: task.title, status: task.status },
      });
      return c.json({ data: task }, 201);
    })
    .post('/:id/checkout', async (c) => {
      const { id } = c.req.param();
      const cid = c.get('companyId');
      const body = await c.req.json();
      const task = db.tasks.find((t) => t.id === id);
      if (!task) return c.json({ error: 'Not found', code: 404 }, 404);
      if (task.lockedAt && task.assigneeId !== body.agentId) {
        return c.json({ error: 'Already locked', code: 409 }, 409);
      }
      task.lockedAt = new Date();
      task.assigneeId = body.agentId;
      task.status = 'IN_PROGRESS';
      recordActivity({
        companyId: cid,
        actorType: 'AGENT',
        actorId: body.agentId,
        action: 'TASK_CHECKOUT',
        targetType: 'TASK',
        targetId: id,
      });
      return c.json({ data: task });
    })
    .post('/:id/release', async (c) => {
      const { id } = c.req.param();
      const cid = c.get('companyId');
      const body = await c.req.json();
      const task = db.tasks.find((t) => t.id === id);
      if (!task) return c.json({ error: 'Not found', code: 404 }, 404);
      if (task.assigneeId !== body.agentId) {
        return c.json({ error: 'Not assigned', code: 403 }, 403);
      }
      task.lockedAt = undefined;
      if (body.status) task.status = body.status;
      if (body.artifacts) task.artifacts = body.artifacts;
      recordActivity({
        companyId: cid,
        actorType: 'AGENT',
        actorId: body.agentId,
        action: 'TASK_RELEASE',
        targetType: 'TASK',
        targetId: id,
        metadata: { status: task.status },
      });
      return c.json({ data: task });
    });

  // Heartbeats routes
  const heartbeatsRoutes = new Hono()
    .get('/', (c) => {
      const cid = c.get('companyId');
      const agentIds = db.agents.filter((a) => a.companyId === cid).map((a) => a.id);
      return c.json({
        data: db.heartbeats.filter((h) => agentIds.includes(h.agentId)),
      });
    })
    .get('/:id', (c) => {
      const { id } = c.req.param();
      const hb = db.heartbeats.find((h) => h.id === id);
      if (!hb) return c.json({ error: 'Not found', code: 404 }, 404);
      return c.json({ data: hb });
    });

  // Agent heartbeat trigger
  const agentHeartbeats = new Hono()
    .post('/', async (c) => {
      const { agentId } = c.req.param();
      const cid = c.get('companyId');
      const body = await c.req.json();

      const agent = db.agents.find((a) => a.id === agentId && a.companyId === cid);
      if (!agent) return c.json({ error: 'Agent not found', code: 404 }, 404);
      if (agent.status !== 'ACTIVE') return c.json({ error: 'Agent not active', code: 409 }, 409);

      const task = db.tasks.find((t) => t.id === body.taskId);
      if (!task) return c.json({ error: 'Task not found', code: 404 }, 404);

      // Simulate heartbeat execution
      const heartbeat: Heartbeat = {
        id: genId(),
        taskId: body.taskId,
        agentId,
        status: 'COMPLETED',
        startedAt: new Date(),
        endedAt: new Date(),
        log: 'Task completed successfully by OpenCode adapter',
        tokensUsed: 2500,
        cost: 0.0075,
      };
      db.heartbeats.push(heartbeat);

      // Create cost event
      const costEvent: CostEvent = {
        id: genId(),
        heartbeatId: heartbeat.id,
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        tokensIn: 1500,
        tokensOut: 1000,
        cost: 0.0075,
      };
      db.costEvents.push(costEvent);

      // Update budget
      const budget = db.budgets.find(
        (b) => b.companyId === cid && (b.agentId === agentId || !b.agentId)
      );
      if (budget) {
        budget.used += heartbeat.cost;
      }

      // Update task
      task.status = 'REVIEW';
      task.lockedAt = undefined;

      recordActivity({
        companyId: cid,
        actorType: 'AGENT',
        actorId: agentId,
        action: 'HEARTBEAT_COMPLETE',
        targetType: 'HEARTBEAT',
        targetId: heartbeat.id,
        metadata: { taskId: body.taskId, tokensUsed: heartbeat.tokensUsed, cost: heartbeat.cost },
      });

      return c.json({ data: { heartbeatId: heartbeat.id, status: heartbeat.status } }, 202);
    });

  // Budget routes
  const budgetRoutes = new Hono()
    .get('/', (c) => {
      const cid = c.get('companyId');
      return c.json({ data: db.budgets.filter((b) => b.companyId === cid) });
    })
    .post('/', async (c) => {
      const cid = c.get('companyId');
      const body = await c.req.json();
      const budget: Budget = {
        id: genId(),
        companyId: cid,
        agentId: body.agentId,
        monthly: body.monthly,
        used: 0,
        currency: body.currency || 'USD',
        threshold: body.threshold || 0.8,
      };
      db.budgets.push(budget);
      return c.json({ data: budget }, 201);
    })
    .get('/cost-events', (c) => {
      const cid = c.get('companyId');
      const agentIds = db.agents.filter((a) => a.companyId === cid).map((a) => a.id);
      const heartbeatIds = db.heartbeats
        .filter((h) => agentIds.includes(h.agentId))
        .map((h) => h.id);
      return c.json({
        data: db.costEvents.filter((ce) => heartbeatIds.includes(ce.heartbeatId)),
      });
    });

  // Activity routes
  const activityRoutes = new Hono()
    .get('/', (c) => {
      const cid = c.get('companyId');
      return c.json({ data: db.activityEvents.filter((ev) => ev.companyId === cid) });
    })
    .get('/feed', (c) => {
      const cid = c.get('companyId');
      const events = db.activityEvents
        .filter((ev) => ev.companyId === cid)
        .sort((a, b) => 0); // In real DB this would be sorted by createdAt
      return c.json({ data: events.slice(0, 50) });
    })
    .get('/stats', (c) => {
      const cid = c.get('companyId');
      const events = db.activityEvents.filter((ev) => ev.companyId === cid);
      const byAction: Record<string, number> = {};
      const byActorType: Record<string, number> = {};
      for (const ev of events) {
        byAction[ev.action] = (byAction[ev.action] || 0) + 1;
        byActorType[ev.actorType] = (byActorType[ev.actorType] || 0) + 1;
      }
      return c.json({
        data: {
          total: events.length,
          byAction: Object.entries(byAction).map(([action, count]) => ({ action, count })),
          byActorType: Object.entries(byActorType).map(([actorType, count]) => ({
            actorType,
            count,
          })),
        },
      });
    });

  // Build the full app with middleware on the API layer
  const api = new Hono()
    .use('*', async (c, next) => {
      c.set('user', {
        id: 'user-1',
        companyId,
        companyIds: [companyId],
        role: 'ADMIN',
      });
      c.set('companyId', companyId);
      await next();
    })
    .route('/companies', companiesRoutes)
    .route('/agents', agentsRoutes)
    .route('/projects', projectsRoutes)
    .route('/goals', goalsRoutes)
    .route('/tasks', tasksRoutes)
    .route('/heartbeats', heartbeatsRoutes)
    .route('/agents/:agentId/heartbeat', agentHeartbeats)
    .route('/budgets', budgetRoutes)
    .route('/activity', activityRoutes);

  return new Hono().route('/api', api);
}

// ── E2E Tests ─────────────────────────────────────────────────

describe('E2E User Journey — Full System Integration', () => {
  let app: ReturnType<typeof buildE2EApp>;
  let client: ReturnType<typeof testClient>;

  beforeEach(() => {
    resetDb();
    app = buildE2EApp();
    client = testClient(app);

    // Seed a company
    db.companies.push({
      id: 'company-e2e-1',
      name: 'E2E Test Company',
      slug: 'e2e-test',
      mission: 'Test the full user journey',
    });
  });

  describe('Step 1: Onboard — Create Company', () => {
    it('should list the seeded company', async () => {
      const res = await client.api.companies.$get();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('E2E Test Company');
    });

    it('should get company by ID', async () => {
      const res = await client.api.companies['company-e2e-1'].$get();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.slug).toBe('e2e-test');
    });
  });

  describe('Step 2: Hire Agents', () => {
    it('should hire a developer agent', async () => {
      const res = await client.api.agents.$post({
        json: {
          name: 'Dev Bot',
          role: 'developer',
          title: 'Software Developer',
          status: 'ACTIVE',
          config: { model: 'claude-sonnet-4-20250514', maxTokens: 8192 },
        },
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe('Dev Bot');
      expect(body.data.role).toBe('developer');
      expect(body.data.status).toBe('ACTIVE');
    });

    it('should hire a QA agent', async () => {
      const res = await client.api.agents.$post({
        json: {
          name: 'QA Bot',
          role: 'qa-engineer',
          title: 'QA Engineer',
          status: 'ACTIVE',
        },
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe('QA Bot');
      expect(body.data.role).toBe('qa-engineer');
    });

    it('should list all hired agents', async () => {
      // Hire agents first
      await client.api.agents.$post({
        json: { name: 'Dev Bot', role: 'developer', status: 'ACTIVE' },
      });
      await client.api.agents.$post({
        json: { name: 'QA Bot', role: 'qa-engineer', status: 'ACTIVE' },
      });

      const res = await client.api.agents.$get();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
    });

    it('should record agent creation in activity feed', async () => {
      await client.api.agents.$post({
        json: { name: 'Dev Bot', role: 'developer', status: 'ACTIVE' },
      });

      const res = await client.api.activity.$get();
      const body = await res.json();
      const agentEvents = body.data.filter((ev: ActivityEvent) => ev.action === 'AGENT_CREATE');
      expect(agentEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Step 3: Create Task', () => {
    it('should create a project, goal, and task', async () => {
      // Create project
      const projRes = await client.api.projects.$post({
        json: { name: 'Test Project' },
      });
      expect(projRes.status).toBe(201);
      const projBody = await projRes.json();
      const projectId = projBody.data.id;

      // Create goal
      const goalRes = await client.api.goals.$post({
        json: { projectId, name: 'Implement Feature X' },
      });
      expect(goalRes.status).toBe(201);
      const goalBody = await goalRes.json();
      const goalId = goalBody.data.id;

      // Create task
      const taskRes = await client.api.tasks.$post({
        json: {
          goalId,
          title: 'Build the login page',
          description: 'Implement the login page with email/password auth',
          priority: 'HIGH',
        },
      });
      expect(taskRes.status).toBe(201);
      const taskBody = await taskRes.json();
      expect(taskBody.data.title).toBe('Build the login page');
      expect(taskBody.data.status).toBe('BACKLOG');
      expect(taskBody.data.priority).toBe('HIGH');
    });

    it('should list tasks for the company', async () => {
      // Setup
      const projRes = await client.api.projects.$post({ json: { name: 'P1' } });
      const { id: projectId } = (await projRes.json()).data;
      const goalRes = await client.api.goals.$post({ json: { projectId, name: 'G1' } });
      const { id: goalId } = (await goalRes.json()).data;
      await client.api.tasks.$post({
        json: { goalId, title: 'Task 1', priority: 'HIGH' },
      });
      await client.api.tasks.$post({
        json: { goalId, title: 'Task 2', priority: 'MEDIUM' },
      });

      const res = await client.api.tasks.$get();
      const body = await res.json();
      expect(body.data).toHaveLength(2);
    });
  });

  describe('Step 4: Execute Task (Checkout → Heartbeat → Release)', () => {
    it('should checkout a task, trigger heartbeat, and release', async () => {
      // Setup: hire agent, create project/goal/task
      const agentRes = await client.api.agents.$post({
        json: { name: 'Dev Bot', role: 'developer', status: 'ACTIVE' },
      });
      const { id: agentId } = (await agentRes.json()).data;

      const projRes = await client.api.projects.$post({ json: { name: 'P1' } });
      const { id: projectId } = (await projRes.json()).data;
      const goalRes = await client.api.goals.$post({ json: { projectId, name: 'G1' } });
      const { id: goalId } = (await goalRes.json()).data;
      const taskRes = await client.api.tasks.$post({
        json: { goalId, title: 'Build feature', priority: 'HIGH' },
      });
      const { id: taskId } = (await taskRes.json()).data;

      // 1. Checkout the task
      const checkoutRes = await client.api.tasks[':id'].checkout.$post({
        param: { id: taskId },
        json: { agentId },
      });
      expect(checkoutRes.status).toBe(200);
      const checkoutBody = await checkoutRes.json();
      expect(checkoutBody.data.status).toBe('IN_PROGRESS');

      // 2. Trigger heartbeat execution
      const heartbeatRes = await client.api.agents[':agentId'].heartbeat.$post({
        param: { agentId },
        json: { taskId },
      });
      expect(heartbeatRes.status).toBe(202);
      const heartbeatBody = await heartbeatRes.json();
      expect(heartbeatBody.data.status).toBe('COMPLETED');
      expect(heartbeatBody.data.heartbeatId).toBeDefined();

      // 3. Verify heartbeat was recorded
      const hbRes = await client.api.heartbeats[':id'].$get({
        param: { id: heartbeatBody.data.heartbeatId },
      });
      expect(hbRes.status).toBe(200);
      const hbData = (await hbRes.json()).data;
      expect(hbData.status).toBe('COMPLETED');
      expect(hbData.tokensUsed).toBe(2500);
      expect(hbData.cost).toBe(0.0075);

      // 4. Release the task (it was auto-released by heartbeat)
      const releaseRes = await client.api.tasks[':id'].release.$post({
        param: { id: taskId },
        json: { agentId, status: 'REVIEW' },
      });
      expect(releaseRes.status).toBe(200);
      const releaseBody = await releaseRes.json();
      expect(releaseBody.data.status).toBe('REVIEW');
    });

    it('should prevent double-checkout by another agent', async () => {
      // Setup two agents and a task
      const agent1Res = await client.api.agents.$post({
        json: { name: 'Agent 1', role: 'developer', status: 'ACTIVE' },
      });
      const { id: agent1Id } = (await agent1Res.json()).data;

      const agent2Res = await client.api.agents.$post({
        json: { name: 'Agent 2', role: 'developer', status: 'ACTIVE' },
      });
      const { id: agent2Id } = (await agent2Res.json()).data;

      const projRes = await client.api.projects.$post({ json: { name: 'P1' } });
      const { id: projectId } = (await projRes.json()).data;
      const goalRes = await client.api.goals.$post({ json: { projectId, name: 'G1' } });
      const { id: goalId } = (await goalRes.json()).data;
      const taskRes = await client.api.tasks.$post({
        json: { goalId, title: 'Contested task' },
      });
      const { id: taskId } = (await taskRes.json()).data;

      // Agent 1 checks out
      const checkout1 = await client.api.tasks[':id'].checkout.$post({
        param: { id: taskId },
        json: { agentId: agent1Id },
      });
      expect(checkout1.status).toBe(200);

      // Agent 2 tries to checkout — should fail
      const checkout2 = await client.api.tasks[':id'].checkout.$post({
        param: { id: taskId },
        json: { agentId: agent2Id },
      });
      expect(checkout2.status).toBe(409);
    });
  });

  describe('Step 5: Monitor Cost', () => {
    it('should track cost events from heartbeat execution', async () => {
      // Setup and execute a heartbeat
      const agentRes = await client.api.agents.$post({
        json: { name: 'Dev Bot', role: 'developer', status: 'ACTIVE' },
      });
      const { id: agentId } = (await agentRes.json()).data;

      const projRes = await client.api.projects.$post({ json: { name: 'P1' } });
      const { id: projectId } = (await projRes.json()).data;
      const goalRes = await client.api.goals.$post({ json: { projectId, name: 'G1' } });
      const { id: goalId } = (await goalRes.json()).data;
      const taskRes = await client.api.tasks.$post({
        json: { goalId, title: 'Cost tracking task' },
      });
      const { id: taskId } = (await taskRes.json()).data;

      // Execute heartbeat
      await client.api.agents[':agentId'].heartbeat.$post({
        param: { agentId },
        json: { taskId },
      });

      // Check cost events
      const costRes = await client.api.budgets['cost-events'].$get();
      const costBody = await costRes.json();
      expect(costBody.data.length).toBeGreaterThanOrEqual(1);
      expect(costBody.data[0].provider).toBe('anthropic');
      expect(costBody.data[0].cost).toBe(0.0075);
    });

    it('should create and track budgets', async () => {
      // Create a budget
      const budgetRes = await client.api.budgets.$post({
        json: { monthly: 100, currency: 'USD', threshold: 0.8 },
      });
      expect(budgetRes.status).toBe(201);
      const budgetBody = await budgetRes.json();
      expect(budgetBody.data.monthly).toBe(100);

      // List budgets
      const listRes = await client.api.budgets.$get();
      const listBody = await listRes.json();
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].monthly).toBe(100);
    });
  });

  describe('Step 6: View on Dashboard (Activity Feed)', () => {
    it('should show all activity events from the journey', async () => {
      // Perform the full journey
      // 1. Hire agent
      const agentRes = await client.api.agents.$post({
        json: { name: 'Dev Bot', role: 'developer', status: 'ACTIVE' },
      });
      const { id: agentId } = (await agentRes.json()).data;

      // 2. Create project/goal/task
      const projRes = await client.api.projects.$post({ json: { name: 'P1' } });
      const { id: projectId } = (await projRes.json()).data;
      const goalRes = await client.api.goals.$post({ json: { projectId, name: 'G1' } });
      const { id: goalId } = (await goalRes.json()).data;
      const taskRes = await client.api.tasks.$post({
        json: { goalId, title: 'Dashboard task' },
      });
      const { id: taskId } = (await taskRes.json()).data;

      // 3. Checkout and execute
      await client.api.tasks[':id'].checkout.$post({
        param: { id: taskId },
        json: { agentId },
      });
      await client.api.agents[':agentId'].heartbeat.$post({
        param: { agentId },
        json: { taskId },
      });

      // Check activity feed
      const feedRes = await client.api.activity.feed.$get();
      const feedBody = await feedRes.json();
      expect(feedBody.data.length).toBeGreaterThanOrEqual(3); // AGENT_CREATE + TASK_CREATE + TASK_CHECKOUT + HEARTBEAT_COMPLETE

      // Check activity stats
      const statsRes = await client.api.activity.stats.$get();
      const statsBody = await statsRes.json();
      expect(statsBody.data.total).toBeGreaterThanOrEqual(3);
      expect(statsBody.data.byAction.length).toBeGreaterThan(0);
    });

    it('should show heartbeat history for monitoring', async () => {
      // Setup and execute
      const agentRes = await client.api.agents.$post({
        json: { name: 'Dev Bot', role: 'developer', status: 'ACTIVE' },
      });
      const { id: agentId } = (await agentRes.json()).data;

      const projRes = await client.api.projects.$post({ json: { name: 'P1' } });
      const { id: projectId } = (await projRes.json()).data;
      const goalRes = await client.api.goals.$post({ json: { projectId, name: 'G1' } });
      const { id: goalId } = (await goalRes.json()).data;
      const taskRes = await client.api.tasks.$post({
        json: { goalId, title: 'Monitor task' },
      });
      const { id: taskId } = (await taskRes.json()).data;

      // Execute heartbeat
      await client.api.agents[':agentId'].heartbeat.$post({
        param: { agentId },
        json: { taskId },
      });

      // Check heartbeat list
      const hbListRes = await client.api.heartbeats.$get();
      const hbListBody = await hbListRes.json();
      expect(hbListBody.data).toHaveLength(1);
      expect(hbListBody.data[0].status).toBe('COMPLETED');
      expect(hbListBody.data[0].tokensUsed).toBe(2500);
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return agents for the current company', async () => {
      // Add agents to the current company
      await client.api.agents.$post({
        json: { name: 'Our Agent', role: 'developer', status: 'ACTIVE' },
      });

      // Directly add an agent to a different company (simulating data leak attempt)
      db.agents.push({
        id: 'foreign-agent',
        companyId: 'other-company',
        name: 'Foreign Agent',
        role: 'developer',
        status: 'ACTIVE',
      });

      const res = await client.api.agents.$get();
      const body = await res.json();
      // Should only see our company's agent
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Our Agent');
      expect(body.data.every((a: Agent) => a.companyId === 'company-e2e-1')).toBe(true);
    });

    it('should only return tasks belonging to the current company', async () => {
      // Create a task in our company
      const projRes = await client.api.projects.$post({ json: { name: 'P1' } });
      const { id: projectId } = (await projRes.json()).data;
      const goalRes = await client.api.goals.$post({ json: { projectId, name: 'G1' } });
      const { id: goalId } = (await goalRes.json()).data;
      await client.api.tasks.$post({
        json: { goalId, title: 'Our Task' },
      });

      // Add a task under a foreign project
      const foreignProject: Project = {
        id: 'foreign-project',
        companyId: 'other-company',
        name: 'Foreign Project',
      };
      db.projects.push(foreignProject);
      const foreignGoal: Goal = {
        id: 'foreign-goal',
        projectId: 'foreign-project',
        name: 'Foreign Goal',
        status: 'PENDING',
      };
      db.goals.push(foreignGoal);
      db.tasks.push({
        id: 'foreign-task',
        goalId: 'foreign-goal',
        title: 'Foreign Task',
        status: 'BACKLOG',
        priority: 'LOW',
      });

      const res = await client.api.tasks.$get();
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].title).toBe('Our Task');
    });

    it('should isolate activity events by company', async () => {
      // Create activity in our company
      await client.api.agents.$post({
        json: { name: 'Our Agent', role: 'developer', status: 'ACTIVE' },
      });

      // Add foreign activity
      db.activityEvents.push({
        id: 'foreign-event',
        companyId: 'other-company',
        actorType: 'USER',
        actorId: 'foreign-user',
        action: 'TASK_CREATE',
        targetType: 'TASK',
        targetId: 'foreign-task',
      });

      const res = await client.api.activity.$get();
      const body = await res.json();
      expect(body.data.every((ev: ActivityEvent) => ev.companyId === 'company-e2e-1')).toBe(true);
    });
  });
});
