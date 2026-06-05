/**
 * Authentication middleware for the ArmiAI Server.
 *
 * Sets up the authenticated user context including multi-company support.
 * Currently a stub that looks up the default admin user's companies from the DB.
 * Will be replaced with real token/session-based authentication later.
 */

import type { Context, Next } from 'hono';
import { logger } from '../utils/logger.js';
import prisma from '../db/client.js';

export interface AuthUser {
  id: string;
  companyId: string;
  companyIds: string[];
  role: 'ADMIN' | 'USER' | 'AGENT';
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

/**
 * Stub auth middleware — looks up the stub user's companies from the database.
 * In production, this will validate JWT tokens and load user memberships.
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    logger.debug('No Authorization header — using stub user');
  }

  // Look up stub user's company memberships from the database
  const stubUserId = 'stub-user-001';
  let companyId = 'stub-company-001'; // fallback
  let companyIds = ['stub-company-001'];

  try {
    const memberships = await prisma.userCompany.findMany({
      where: { userId: stubUserId },
      select: { companyId: true },
    });

    if (memberships.length > 0) {
      companyIds = memberships.map((m) => m.companyId);
      companyId = companyIds[0]; // Use first company as default
    }
  } catch (err) {
    // DB not ready or UserCompany table doesn't exist yet — use fallback
    logger.debug('Could not load user companies, using fallback');
  }

  const stubUser: AuthUser = {
    id: stubUserId,
    companyId,
    companyIds,
    role: 'ADMIN',
  };

  c.set('user', stubUser);

  await next();
}

export default authMiddleware;
