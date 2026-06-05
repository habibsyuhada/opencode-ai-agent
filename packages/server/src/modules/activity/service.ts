/**
 * Activity service — business logic for ActivityEvent recording and querying.
 *
 * Provides a dedicated API endpoint for the activity feed (audit log).
 * The core `recordActivity` utility in utils/activity.ts handles fire-and-forget
 * recording from other modules. This service adds querying capabilities.
 *
 * Architecture reference: docs/architecture/architecture.md §5
 *   "ActivityEvent model, Global audit middleware"
 *
 * PRD reference: docs/prd/prd.md §11
 *   "ActivityEvent: Audit log entry."
 */

import prisma from '../../db/client.js';
import type {
  CreateActivityEventInput,
  ListActivityEventsQuery,
} from './schema.js';
import type { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';

// ── Activity Event Management ────────────────────────────────────

/**
 * List activity events for a company with optional filters.
 *
 * Supports filtering by actorType, actorId, action, targetType, targetId.
 * Results are ordered by createdAt descending (most recent first).
 */
export async function listActivityEvents(
  companyId: string,
  filters?: ListActivityEventsQuery
) {
  return prisma.activityEvent.findMany({
    where: {
      companyId,
      ...(filters?.actorType && { actorType: filters.actorType }),
      ...(filters?.actorId && { actorId: filters.actorId }),
      ...(filters?.action && { action: filters.action }),
      ...(filters?.targetType && { targetType: filters.targetType }),
      ...(filters?.targetId && { targetId: filters.targetId }),
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 20,
    skip: filters?.offset ?? 0,
  });
}

/**
 * Get a single activity event by ID, scoped to company.
 */
export async function getActivityEventById(id: string, companyId: string) {
  return prisma.activityEvent.findFirst({
    where: { id, companyId },
  });
}

/**
 * Create a new activity event.
 *
 * This is an alternative to the fire-and-forget `recordActivity` utility.
 * Use this when you need the created event returned or want to handle errors.
 */
export async function createActivityEvent(
  data: CreateActivityEventInput,
  companyId: string
) {
  const event = await prisma.activityEvent.create({
    data: {
      companyId,
      actorType: data.actorType,
      actorId: data.actorId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  logger.debug('Activity event created', {
    eventId: event.id,
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId,
  });

  return event;
}

/**
 * Get activity feed — recent activity across the company.
 *
 * Returns the most recent activity events for the dashboard feed.
 * Can be filtered to show only specific types of activities.
 */
export async function getActivityFeed(
  companyId: string,
  options?: {
    limit?: number;
    actions?: string[];
    actorTypes?: string[];
  }
) {
  return prisma.activityEvent.findMany({
    where: {
      companyId,
      ...(options?.actions && { action: { in: options.actions } }),
      ...(options?.actorTypes && { actorType: { in: options.actorTypes as Array<'USER' | 'AGENT' | 'SYSTEM'> } }),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
  });
}

/**
 * Get activity statistics for a company.
 *
 * Returns counts by action type and actor type for the activity dashboard.
 */
export async function getActivityStats(companyId: string) {
  const [total, byAction, byActorType] = await Promise.all([
    prisma.activityEvent.count({ where: { companyId } }),
    prisma.activityEvent.groupBy({
      by: ['action'],
      where: { companyId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    prisma.activityEvent.groupBy({
      by: ['actorType'],
      where: { companyId },
      _count: { id: true },
    }),
  ]);

  return {
    total,
    byAction: byAction.map((row) => ({
      action: row.action,
      count: row._count.id,
    })),
    byActorType: byActorType.map((row) => ({
      actorType: row.actorType,
      count: row._count.id,
    })),
  };
}
