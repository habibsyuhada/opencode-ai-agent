import chalk from "chalk";
import { findMonorepoRoot, getServerDir, validateMonorepoStructure } from "../utils/project.js";
import { run } from "../utils/runner.js";

export interface SetupOptions {
  skipSeed?: boolean;
  skipGenerate?: boolean;
}

/**
 * Implements the `armiai setup` command.
 * Runs Prisma DB push and seeding to set up the database.
 */
export async function setupCommand(options: SetupOptions = {}): Promise<void> {
  const monorepoRoot = findMonorepoRoot();

  console.log(chalk.bold("\n🔧 ArmiAI Setup\n"));
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
  if (!options.skipGenerate) {
    console.log(chalk.yellow("\n[1/3] Generating Prisma client..."));
    const genResult = await run("pnpm", ["db:generate"], {
      cwd: serverDir,
    });
    if (genResult.exitCode !== 0) {
      console.error(chalk.red("✗ Prisma client generation failed."));
      process.exit(1);
    }
    console.log(chalk.green("✓ Prisma client generated."));
  }

  // Step 2: Push schema to database
  console.log(chalk.yellow("\n[2/3] Pushing schema to database..."));
  const pushResult = await run("pnpm", ["db:push"], {
    cwd: serverDir,
  });
  if (pushResult.exitCode !== 0) {
    console.error(chalk.red("✗ Prisma DB push failed."));
    console.error(chalk.red("  Ensure DATABASE_URL is set in your .env file."));
    process.exit(1);
  }
  console.log(chalk.green("✓ Schema pushed to database."));

  // Step 3: Seed the database
  if (!options.skipSeed) {
    console.log(chalk.yellow("\n[3/3] Seeding database..."));
    const seedResult = await run("pnpm", ["db:seed"], {
      cwd: serverDir,
    });
    if (seedResult.exitCode !== 0) {
      // Seed failure is non-fatal (seed file may not exist yet)
      console.log(
        chalk.yellow(
          "⚠ Database seeding skipped or failed. This is OK if no seed file exists yet."
        )
      );
    } else {
      console.log(chalk.green("✓ Database seeded."));
    }
  } else {
    console.log(chalk.gray("\n[3/3] Seeding skipped (--skip-seed)."));
  }

  console.log(chalk.bold.green("\n✓ Setup complete!\n"));
}
