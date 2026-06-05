/**
 * Embedded PostgreSQL — Zero-config local development database
 *
 * Automatically starts a PostgreSQL instance embedded within the application.
 * No external database installation required for local development.
 *
 * Inspired by Paperclip AI's approach:
 * - GitHub: https://github.com/paperclipai/paperclip
 * - Uses `embedded-postgres` package
 *
 * How it works:
 * 1. On first run, downloads PostgreSQL binaries (~30MB) to node_modules/.cache
 * 2. Starts a PostgreSQL server on the configured port (default: 54322)
 * 3. Creates the database if it doesn't exist
 * 4. Returns the connection URL for Prisma
 *
 * Environment variables:
 * - EMBEDDED_PG_PORT: Port for embedded PostgreSQL (default: 54322)
 * - EMBEDDED_PG_DATA_DIR: Data directory (default: ./data/embedded-pg)
 * - EMBEDDED_PG_DATABASE: Database name (default: armiai)
 * - DATABASE_URL: If set, skips embedded PostgreSQL entirely
 */

import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../utils/logger.js';

// ── Configuration ──────────────────────────────────────────────

const DEFAULT_PORT = 5432;
const DEFAULT_DATABASE = 'armiai';
const DEFAULT_USER = 'armiai';
const DEFAULT_PASSWORD = 'armiai-local-dev';

interface EmbeddedPgConfig {
  port: number;
  dataDir: string;
  database: string;
  user: string;
  password: string;
}

function getConfig(): EmbeddedPgConfig {
  const projectRoot = path.resolve(process.cwd());

  return {
    port: parseInt(process.env.EMBEDDED_PG_PORT || String(DEFAULT_PORT), 10),
    dataDir: process.env.EMBEDDED_PG_DATA_DIR || path.join(projectRoot, 'data', 'embedded-pg'),
    database: process.env.EMBEDDED_PG_DATABASE || DEFAULT_DATABASE,
    user: DEFAULT_USER,
    password: DEFAULT_PASSWORD,
  };
}

// ── Embedded PostgreSQL Manager ────────────────────────────────

let pgInstance: EmbeddedPostgres | null = null;
let isStarted = false;

/**
 * Start the embedded PostgreSQL server.
 *
 * Downloads binaries on first run, then starts the server.
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * @returns The DATABASE_URL for Prisma
 */
export async function startEmbeddedPostgres(): Promise<string> {
  if (isStarted && pgInstance) {
    const config = getConfig();
    return buildDatabaseUrl(config);
  }

  const config = getConfig();

  logger.info('Starting embedded PostgreSQL...', {
    port: config.port,
    dataDir: config.dataDir,
    database: config.database,
  });

  // Ensure data directory exists
  fs.mkdirSync(config.dataDir, { recursive: true });

  pgInstance = new EmbeddedPostgres({
    database_dir: config.dataDir,
    user: config.user,
    password: config.password,
    port: config.port,
    persistent: true,
  });

  try {
    // Check if database cluster is already initialized
    // PG_VERSION file exists in the data directory after successful init
    const pgVersionFile = path.join(config.dataDir, 'PG_VERSION');
    const isAlreadyInitialized = fs.existsSync(pgVersionFile);

    if (!isAlreadyInitialized) {
      // First run — initialize the database cluster
      logger.info('Initializing new PostgreSQL cluster...');
      await pgInstance.initialise();
    } else {
      logger.info('PostgreSQL cluster already initialized, skipping init...');
    }

    // Start the PostgreSQL server
    await pgInstance.start();

    // Create the database if it doesn't exist
    try {
      await pgInstance.createDatabase(config.database);
      logger.info(`Created database: ${config.database}`);
    } catch {
      // Database already exists — that's fine
    }

    isStarted = true;

    const url = buildDatabaseUrl(config);
    logger.info('Embedded PostgreSQL started successfully', {
      port: config.port,
      database: config.database,
      url: url.replace(/:[^:@]+@/, ':****@'), // Mask password in logs
    });

    return url;
  } catch (err) {
    logger.error('Failed to start embedded PostgreSQL', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Stop the embedded PostgreSQL server.
 *
 * Gracefully shuts down the server. Called on process exit.
 */
export async function stopEmbeddedPostgres(): Promise<void> {
  if (!pgInstance || !isStarted) {
    return;
  }

  logger.info('Stopping embedded PostgreSQL...');

  try {
    await pgInstance.stop();
    isStarted = false;
    pgInstance = null;
    logger.info('Embedded PostgreSQL stopped');
  } catch (err) {
    logger.error('Error stopping embedded PostgreSQL', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Check if embedded PostgreSQL should be used.
 *
 * Returns true if:
 * - DATABASE_URL is NOT set (no external database configured)
 * - OR EMBEDDED_PG_FORCE=true is set
 */
export function shouldUseEmbeddedPg(): boolean {
  // If DATABASE_URL is explicitly set and not the default placeholder, use external DB
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes('user:password@localhost')) {
    return process.env.EMBEDDED_PG_FORCE === 'true';
  }

  // No external DB configured — use embedded
  return true;
}

/**
 * Build the DATABASE_URL for Prisma from the config.
 */
function buildDatabaseUrl(config: EmbeddedPgConfig): string {
  return `postgresql://${config.user}:${config.password}@localhost:${config.port}/${config.database}?schema=public`;
}

/**
 * Get the DATABASE_URL for the embedded PostgreSQL instance.
 *
 * If the instance is started, returns the URL.
 * Otherwise, throws an error.
 */
export function getEmbeddedDatabaseUrl(): string {
  if (!isStarted) {
    throw new Error('Embedded PostgreSQL is not started. Call startEmbeddedPostgres() first.');
  }

  const config = getConfig();
  return buildDatabaseUrl(config);
}

// ── Process Cleanup ────────────────────────────────────────────

// Ensure PostgreSQL is stopped on process exit
process.on('SIGINT', async () => {
  await stopEmbeddedPostgres();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopEmbeddedPostgres();
  process.exit(0);
});

process.on('exit', () => {
  // Synchronous best-effort cleanup
  if (pgInstance && isStarted) {
    try {
      pgInstance.stop();
    } catch {
      // Ignore errors during exit cleanup
    }
  }
});
