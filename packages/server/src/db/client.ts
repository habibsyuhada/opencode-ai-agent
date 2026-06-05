import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client Singleton
 *
 * Prevents multiple instances of Prisma Client in development
 * by caching the client on the global object.
 *
 * IMPORTANT: When using embedded PostgreSQL, DATABASE_URL may not be set
 * at module import time (it's set later in main() after PG starts).
 * To handle this, we compute the default embedded PG URL and pass it
 * via PrismaClient's `datasourceUrl` option. This avoids mutating
 * process.env (which would confuse shouldUseEmbeddedPg()).
 *
 * PrismaClient connects lazily on first query, so by then the
 * embedded PG is ready.
 *
 * Usage:
 *   import { prisma } from "./db/client";
 *   const agents = await prisma.agent.findMany();
 *
 * Database modes:
 * - External: If DATABASE_URL is set, connects to external PostgreSQL
 * - Embedded: If no DATABASE_URL, uses embedded PostgreSQL (auto-started)
 *
 * See: src/db/embedded-pg.ts for embedded PostgreSQL configuration
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Resolve the database URL for PrismaClient.
 * If DATABASE_URL is set (and not a placeholder), use it.
 * Otherwise, compute the default embedded PostgreSQL URL.
 */
function resolveDatabaseUrl(): string | undefined {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.includes("user:password@localhost")) {
    return envUrl;
  }
  // Compute default embedded PG URL without mutating process.env
  const port = process.env.EMBEDDED_PG_PORT || "54322";
  const database = process.env.EMBEDDED_PG_DATABASE || "armiai";
  return `postgresql://armiai:armiai-local-dev@localhost:${port}/${database}?schema=public`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
