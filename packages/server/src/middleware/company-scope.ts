/**
 * Company isolation middleware for the ArmiAI Server.
 *
 * Ensures every request is scoped to a valid company that the authenticated
 * user has access to. Supports two modes:
 *
 * 1. Default: Uses the user's primary companyId from auth context
 * 2. Explicit switch: Reads `X-Company-Id` header and validates that
 *    the user has access to the requested company
 *
 * Architecture notes (from docs/architecture/architecture.md §6, §12):
 * - Multi-Company Isolation: Strict application-level filtering ensuring companyId
 *   is always applied in Prisma queries.
 * - All endpoints are scoped to the authenticated user's company context.
 * - NFR-002: Strict multi-tenant data isolation must be enforced at the database level.
 *
 * Story: STORY-016 — Multi-Company Support
 */

import type { Context, Next } from 'hono';
import prisma from '../db/client.js';
import { logger } from '../utils/logger.js';

/**
 * Extend Hono's context variables to include the company scope.
 */
declare module 'hono' {
  interface ContextVariableMap {
    companyId: string;
  }
}

/**
 * Validate that a user has access to a specific company.
 *
 * Checks the UserCompany junction table for a valid membership.
 * In stub mode (no UserCompany records exist), falls back to
 * comparing against the user's primary companyId.
 *
 * Gracefully handles the case where the UserCompany model hasn't
 * been generated yet (Prisma client not regenerated after schema change).
 *
 * @param userId - The authenticated user's ID
 * @param companyId - The requested company ID
 * @returns true if the user has access, false otherwise
 */
export async function validateCompanyAccess(
  userId: string,
  companyId: string
): Promise<boolean> {
  try {
    // First, check the UserCompany junction table (if model is available)
    // The UserCompany model may not exist in the Prisma client yet
    // if `prisma generate` hasn't been run after the schema change.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userCompanyModel = (prisma as any).userCompany;
      if (userCompanyModel && typeof userCompanyModel.findFirst === 'function') {
        const membership = await userCompanyModel.findFirst({
          where: {
            userId,
            companyId,
          },
        });

        if (membership) {
          return true;
        }
      }
    } catch {
      // UserCompany model not available — fall through to stub fallback
      logger.debug('UserCompany model not available, using fallback access check');
    }

    // Fallback: If no UserCompany records exist (stub auth mode),
    // check if the company exists at all and the user is a stub user.
    // This allows the stub auth middleware to work with any valid company.
    if (userId.startsWith('stub-')) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });
      return !!company;
    }

    return false;
  } catch (err) {
    logger.error('Failed to validate company access', {
      userId,
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
    // On error, deny access (fail closed)
    return false;
  }
}

/**
 * Hono middleware that extracts and validates the company scope.
 *
 * Resolution order:
 * 1. Check for `X-Company-Id` header (explicit company switching)
 * 2. Fall back to user's primary companyId from auth context
 *
 * If `X-Company-Id` is provided, validates that the user has access
 * to the requested company before setting the scope.
 *
 * Exposes `c.get('companyId')` for all downstream handlers and Prisma queries.
 */
export async function companyScopeMiddleware(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user');

  if (!user || !user.companyId) {
    logger.error('Company scope middleware called without authenticated user');
    return c.json({ error: 'Unauthorized — no company context', code: 401 }, 401);
  }

  // Check for explicit company switch via header
  const headerCompanyId = c.req.header('X-Company-Id');

  if (headerCompanyId && headerCompanyId !== user.companyId) {
    // User is requesting a different company — validate access
    logger.debug('Company switch requested via X-Company-Id header', {
      userId: user.id,
      requestedCompanyId: headerCompanyId,
      defaultCompanyId: user.companyId,
    });

    const hasAccess = await validateCompanyAccess(user.id, headerCompanyId);

    if (!hasAccess) {
      logger.warn('Company access denied — user does not have access to requested company', {
        userId: user.id,
        requestedCompanyId: headerCompanyId,
      });
      return c.json(
        {
          error: 'Forbidden — you do not have access to this company',
          code: 403,
        },
        403
      );
    }

    // Switch to the requested company
    c.set('companyId', headerCompanyId);
    logger.debug('Request scoped to switched company', { companyId: headerCompanyId });
  } else {
    // Use default company from auth context
    c.set('companyId', user.companyId);
    logger.debug('Request scoped to default company', { companyId: user.companyId });
  }

  await next();
}

export default companyScopeMiddleware;
