import chalk from "chalk";
import { findMonorepoRoot, getServerDir, validateMonorepoStructure } from "../utils/project.js";
import { run } from "../utils/runner.js";

export interface MigrateOptions {
  name?: string;
}

/**
 * Implements the `armiai migrate` command.
 * Runs Prisma migrations (create + apply) for development.
 */
export async function migrateCommand(options: MigrateOptions = {}): Promise<void> {
  const monorepoRoot = findMonorepoRoot();

  console.log(chalk.bold("\n📦 ArmiAI Migrate\n"));
  console.log(chalk.gray(`Monorepo root: ${monorepoRoot}`));

  // Validate structure
  const missing = validateMonorepoStructure(monorepoRoot);
  if (missing.length > 0) {
    console.error(chalk.red("\n✗ Monorepo structure is incomplete. Missing:"));
    for (const p of missing) {
      console.error(chalk.red(`  - ${p}`));
    }
    process.exit(1);
  }

  const serverDir = getServerDir(monorepoRoot);

  // Step 1: Generate Prisma client
  console.log(chalk.yellow("[1/2] Generating Prisma client..."));
  const genResult = await run("pnpm", ["db:generate"], {
    cwd: serverDir,
  });
  if (genResult.exitCode !== 0) {
    console.error(chalk.red("✗ Prisma client generation failed."));
    process.exit(1);
  }
  console.log(chalk.green("✓ Prisma client generated."));

  // Step 2: Run migration
  console.log(chalk.yellow("\n[2/2] Running migrations..."));
  const migrateArgs = ["db:migrate"];
  if (options.name) {
    migrateArgs.push("--name", options.name);
  }

  const migrateResult = await run("pnpm", migrateArgs, {
    cwd: serverDir,
  });
  if (migrateResult.exitCode !== 0) {
    console.error(chalk.red("✗ Migration failed."));
    console.error(chalk.red("  Ensure DATABASE_URL is set in your .env file."));
    process.exit(1);
  }
  console.log(chalk.green("✓ Migrations complete."));
  console.log(chalk.bold.green("\n✓ Migrate complete!\n"));
}
