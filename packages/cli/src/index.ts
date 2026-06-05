import { Command } from "commander";
import { devCommand } from "./commands/dev.js";
import { setupCommand } from "./commands/setup.js";
import { migrateCommand } from "./commands/migrate.js";

/**
 * Creates and configures the main CLI program.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("armiai")
    .description("ArmiAI Platform CLI — manage dev servers, database, and more")
    .version("1.0.0");

  // ── dev command ──────────────────────────────────────────────
  program
    .command("dev")
    .description("Start the UI and Server dev servers concurrently")
    .option("--server-only", "Start only the server dev server")
    .option("--ui-only", "Start only the UI dev server")
    .action(async (opts: { serverOnly?: boolean; uiOnly?: boolean }) => {
      await devCommand(opts);
    });

  // ── setup command ────────────────────────────────────────────
  program
    .command("setup")
    .description("Push the Prisma schema to the database and run seeds")
    .option("--skip-seed", "Skip database seeding")
    .option("--skip-generate", "Skip Prisma client generation")
    .action(async (opts: { skipSeed?: boolean; skipGenerate?: boolean }) => {
      await setupCommand(opts);
    });

  // ── migrate command ──────────────────────────────────────────
  program
    .command("migrate")
    .description("Run Prisma migrations")
    .option("-n, --name <name>", "Migration name")
    .action(async (opts: { name?: string }) => {
      await migrateCommand(opts);
    });

  return program;
}

// Re-export commands for programmatic use
export { devCommand } from "./commands/dev.js";
export { setupCommand } from "./commands/setup.js";
export { migrateCommand } from "./commands/migrate.js";
