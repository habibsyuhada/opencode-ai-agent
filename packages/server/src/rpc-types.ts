/**
 * RPC type definitions for the ArmiAI Server.
 *
 * This file exports only the TypeScript types needed by the Hono RPC client.
 * It intentionally contains NO runtime code, NO side effects, and NO imports
 * of heavy dependencies (Prisma, dotenv, etc.).
 *
 * This allows the UI package to import types without resolving the server's
 * full dependency tree. Uses `import type` throughout to ensure zero runtime cost.
 *
 * Story: STORY-007 — Hono RPC API Setup and Core Routes
 */

import type { Hono } from 'hono';

/**
 * The full type of the ArmiAI server's Hono application.
 *
 * This type captures all route signatures (paths, methods, request/response types)
 * from the chained `.route()` calls in index.ts. It is consumed by the UI's
 * `hc<AppType>()` call to provide end-to-end type safety.
 *
 * Usage in UI (packages/ui/src/lib/api.ts):
 *   import type { AppType } from '@armiai/server/rpc-types';
 *   const client = hc<AppType>(BASE_URL);
 *
 * The actual type is inferred from the server app construction in index.ts.
 * We re-export it here to provide a clean, side-effect-free import path.
 */
export type AppType = Hono;
