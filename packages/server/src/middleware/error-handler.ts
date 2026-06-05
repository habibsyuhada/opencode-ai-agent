/**
 * Global error handler middleware for Hono.
 *
 * Catches all unhandled exceptions and returns a standard JSON error response.
 * Maps known error types (e.g., Zod validation, Prisma) to appropriate HTTP status codes.
 */

import type { Context, Next } from 'hono';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Standard error response shape returned by the API.
 */
export interface ErrorResponse {
  error: string;
  code: number;
  details?: unknown;
}

/**
 * Hono middleware that wraps the handler in a try/catch.
 * Any unhandled error is caught, logged, and returned as a JSON response.
 */
export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (err: unknown) {
    // Zod validation errors → 400
    if (err instanceof ZodError) {
      logger.warn('Validation error', { issues: err.issues });
      return c.json<ErrorResponse>(
        { error: 'Validation failed', code: 400, details: err.issues },
        400
      );
    }

    // Known HTTP errors (objects with a `status` property)
    if (isHttpError(err)) {
      logger.warn('HTTP error', { status: err.status, message: err.message });
      return c.json<ErrorResponse>(
        { error: err.message, code: err.status },
        err.status as 400 | 401 | 403 | 404 | 409 | 500
      );
    }

    // Prisma known request errors (unique constraint, etc.)
    if (isPrismaError(err)) {
      const mapped = mapPrismaError(err);
      logger.warn('Prisma error', { code: err.code, message: err.message });
      return c.json<ErrorResponse>(
        { error: mapped.message, code: mapped.status },
        mapped.status as 400 | 401 | 403 | 404 | 409 | 500
      );
    }

    // Unhandled / unknown errors → 500
    logger.error('Unhandled error', {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return c.json<ErrorResponse>(
      { error: 'Internal server error', code: 500 },
      500
    );
  }
}

// ── Type guards & helpers ────────────────────────────────────────

interface HttpError extends Error {
  status: number;
}

function isHttpError(err: unknown): err is HttpError {
  return (
    err instanceof Error &&
    'status' in err &&
    typeof (err as Record<string, unknown>).status === 'number'
  );
}

interface PrismaKnownError extends Error {
  code: string;
  meta?: Record<string, unknown>;
}

function isPrismaError(err: unknown): err is PrismaKnownError {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  );
}

function mapPrismaError(err: PrismaKnownError): { message: string; status: number } {
  switch (err.code) {
    case 'P2002': // Unique constraint violation
      return { message: 'A record with this value already exists', status: 409 };
    case 'P2025': // Record not found
      return { message: 'Record not found', status: 404 };
    case 'P2003': // Foreign key constraint failure
      return { message: 'Related record not found', status: 400 };
    default:
      return { message: 'Database error', status: 500 };
  }
}

export default errorHandler;
