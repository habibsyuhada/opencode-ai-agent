/**
 * ArmiAI Server — Hono Entry Point
 *
 * Main server file that initializes the Hono application with:
 * - Global error handling middleware
 * - Authentication middleware (stub)
 * - Company scope middleware for multi-tenant isolation
 * - Health check endpoint
 * - Core API route groups
 *
 * Architecture reference: docs/architecture/architecture.md
 *
 * NOTE: Routes are built using method chaining (not imperative calls)
 * so that Hono's type system can infer the full route schema.
 * This enables end-to-end type safety with the Hono RPC client (hc).
 * See: STORY-007
 */

import 'dotenv/config';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger as appLogger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { companyScopeMiddleware } from './middleware/company-scope.js';
import { shouldUseEmbeddedPg, startEmbeddedPostgres } from './db/embedded-pg.js';

// ── Route modules ──────────────────────────────────────────────
import companiesRoutes from './modules/companies/routes.js';
import agentsRoutes from './modules/agents/routes.js';
import projectsRoutes from './modules/projects/routes.js';
import goalsRoutes from './modules/goals/routes.js';
import tasksRoutes from './modules/tasks/routes.js';
import heartbeatsRoutes, { agentHeartbeats } from './modules/heartbeat/routes.js';
import budgetRoutes from './modules/budget/routes.js';
import approvalsRoutes from './modules/governance/routes.js';
import activityRoutes from './modules/activity/routes.js';
import routinesRoutes from './modules/routines/routes.js';
import secretsRoutes from './modules/secrets/routes.js';

// ── Build API Sub-Application (chained for RPC type inference) ──
//
// Method chaining is essential for Hono RPC: each .route() call
// returns a new Hono type with the merged schema. Imperative calls
// (api.route(...) as a statement) do NOT update the TypeScript type,
// so hc<AppType>() would see no routes.

const api = new Hono()
  // Auth + company scope middleware applied to all /api routes
  .use('*', authMiddleware)
  .use('*', companyScopeMiddleware)
  // API root — returns available endpoints
  .get('/', (c) => {
    return c.json({
      message: 'ArmiAI Platform API',
      version: '1.0.0',
      endpoints: {
        agents: '/api/agents',
        tasks: '/api/tasks',
        projects: '/api/projects',
        goals: '/api/goals',
        companies: '/api/companies',
        heartbeats: '/api/heartbeats',
        budgets: '/api/budgets',
        approvals: '/api/approvals',
        activity: '/api/activity',
        routines: '/api/routines',
        secrets: '/api/secrets',
      },
    });
  })
  // Core resource routes
  .route('/companies', companiesRoutes)
  .route('/agents', agentsRoutes)
  .route('/projects', projectsRoutes)
  .route('/goals', goalsRoutes)
  .route('/tasks', tasksRoutes)
  .route('/heartbeats', heartbeatsRoutes)
  // Agent-specific heartbeat trigger endpoint: POST /api/agents/:agentId/heartbeat
  .route('/agents/:agentId/heartbeat', agentHeartbeats)
  // Budget & cost tracking routes
  .route('/budgets', budgetRoutes)
  // Governance / approval workflow routes
  .route('/approvals', approvalsRoutes)
  // Activity feed / audit log routes
  .route('/activity', activityRoutes)
  // Routines / scheduled jobs routes
  .route('/routines', routinesRoutes)
  // Secrets management routes (encrypted at rest, masked in responses)
  .route('/secrets', secretsRoutes);

// ── Build Main Application (chained for RPC type inference) ──────

const app = new Hono()
  // Global middleware
  .use('*', cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Company-Id'],
  }))
  .use('*', errorHandler)
  // Public routes (no auth required)
  .get('/health', (c) => {
    return c.json({
      status: 'ok',
      service: '@armiai/server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  })
  // Mount the API sub-application under /api
  .route('/api', api)
  // 404 handler — must be last
  .notFound((c) => {
    return c.json({ error: 'Not found', code: 404 }, 404);
  });

// ── Export AppType for Hono RPC client ───────────────────────────
//
// This type is consumed by the UI's hc<AppType>() call to provide
// end-to-end type safety between server routes and client calls.
// See: packages/ui/src/lib/api.ts

export type AppType = typeof app;
export { app };

// ── Start Server ─────────────────────────────────────────────────

async function main() {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  // Start embedded PostgreSQL if no external database is configured
  if (shouldUseEmbeddedPg()) {
    appLogger.info('No external DATABASE_URL configured — starting embedded PostgreSQL...');
    const dbUrl = await startEmbeddedPostgres();
    process.env.DATABASE_URL = dbUrl;
    appLogger.info('Embedded PostgreSQL ready', { url: dbUrl.replace(/:[^:@]+@/, ':****@') });

    // Auto-sync Prisma schema to the embedded database
    // This ensures tables exist on every startup (idempotent — uses `prisma db push`)
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const serverRoot = path.resolve(__dirname, '..');
      appLogger.info('Syncing database schema...');
      execSync('pnpm exec prisma db push --skip-generate', {
        cwd: serverRoot,
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: dbUrl },
      });
      appLogger.info('Database schema synced successfully');
    } catch (err) {
      appLogger.error('Failed to sync database schema', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't crash — tables might already exist
    }
  }

  serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  }, (info) => {
    appLogger.info(`ArmiAI Server started`, {
      host: HOST,
      port: info.port,
      url: `http://${HOST}:${info.port}`,
    });
  });
}

main().catch((err) => {
  appLogger.error('Failed to start server', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
