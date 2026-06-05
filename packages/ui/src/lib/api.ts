/**
 * Hono RPC Client — Type-safe API client for the ArmiAI Server.
 *
 * Uses Hono's `hc` (Hono Client) to provide end-to-end type safety
 * between the server routes and the UI's API calls.
 *
 * Architecture reference: docs/architecture/architecture.md §7
 * Story: STORY-007 — Hono RPC API Setup and Core Routes
 *
 * ## Type Safety
 *
 * The `hc<AppType>()` call provides compile-time type checking:
 * - Route paths are validated (e.g., `api.api.agents.$get()` is valid)
 * - HTTP methods are inferred from the server's route definitions
 * - Request/response types flow through from Zod schemas
 *
 * Currently, `AppType` is defined as `Hono` (the base type). Once the
 * server package is built (generating `.d.ts` files), import the full
 * `AppType` from `@armiai/server` for complete route-level inference:
 *
 * ```ts
 * import type { AppType } from '@armiai/server';
 * export const api = hc<AppType>(BASE_URL);
 * ```
 *
 * The client works at runtime regardless — the type parameter only
 * affects compile-time checking.
 *
 * ## Usage Examples
 *
 * ```ts
 * import { api } from '@/lib/api';
 *
 * // GET /api/agents — list all agents
 * const res = await api.api.agents.$get();
 * const { data } = await res.json();
 *
 * // POST /api/agents — create a new agent
 * const res = await api.api.agents.$post({
 *   json: { name: 'DevBot', role: 'DEVELOPER' },
 * });
 *
 * // GET /api/tasks?status=TODO — filter tasks
 * const res = await api.api.tasks.$get({
 *   query: { status: 'TODO' },
 * });
 *
 * // GET /api/agents/:id — get single agent
 * const res = await api.api.agents[':id'].$get({
 *   param: { id: 'agent-123' },
 * });
 * ```
 *
 * Note: The double `api.api` access pattern is because:
 * - First `api` = the exported client variable name
 * - Second `api` = the `/api` route prefix mounted in the server
 *
 * So `api.api.agents.$get()` maps to `GET /api/agents`.
 */

import { hc } from 'hono/client';
import type { Hono } from 'hono';

/**
 * Base URL for the API server.
 * Uses VITE_API_URL env variable in development, falls back to localhost:3000.
 */
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Server application type.
 *
 * When the server package is built, replace this with the actual
 * inferred type for full route-level type safety:
 *
 *   import type { AppType } from '@armiai/server';
 *
 * Until then, `Hono` provides the base client interface.
 */
type AppType = Hono;

/**
 * Type-safe Hono RPC client.
 *
 * The generic `AppType` parameter tells the client about the server's
 * route structure, enabling compile-time validation of API calls.
 */
export const api = hc<AppType>(BASE_URL);
