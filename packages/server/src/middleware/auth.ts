/**
 * Authentication middleware for the ArmiAI Server.
 *
 * Sets up the authenticated user context including multi-company support.
 * Currently a stub that sets a default admin user with access to all companies.
 * Will be replaced with real token/session-based authentication later.
 *
 * Architecture notes (from docs/architecture/architecture.md §9):
 * - Multi-tenant architecture requires every request to identify the companyId.
 * - Initially, simple token-based or session-based auth for users.
 * - RBAC ensuring only authorized users can approve governance requests or view billing.
 *
 * Story: STORY-016 — Multi-Company Support
 *   Enhanced to include companyIds array for multi-company access.
 */

import type { Context, Next } from 'hono';
import { logger } from '../utils/logger.js';

/**
 * Authenticated user context attached to the request.
 *
 * Extends the base user with a `companyIds` array to support
 * multi-company switching. The `companyId` field remains the
 * primary/default company.
 */
export interface AuthUser {
  id: string;
  companyId: string;
  companyIds: string[]; // All companies the user has access to
  role: 'ADMIN' | 'USER' | 'AGENT';
}

/**
 * Extend Hono's context variables to include the authenticated user.
 */
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

/**
 * Hono middleware that validates authentication and attaches user context.
 *
 * Stub implementation: always sets a default admin user with multi-company access.
 * In production, this will validate JWT tokens or session cookies and load
 * the user's company memberships from the UserCompany junction table.
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  // Stub: extract from header (real implementation will verify JWT / session)
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    // For now, set a default stub user so the rest of the pipeline works.
    // In production, this would return 401.
    logger.debug('No Authorization header — using stub user');
  }

  // Stub user — will be replaced by real auth lookup
  // Includes companyIds for multi-company support
  const stubUser: AuthUser = {
    id: 'stub-user-001',
    companyId: 'stub-company-001',
    companyIds: ['stub-company-001'], // Stub user has access to primary company
    role: 'ADMIN',
  };

  c.set('user', stubUser);

  await next();
}

export default authMiddleware;
