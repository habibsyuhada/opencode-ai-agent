import chalk from "chalk";
import { findMonorepoRoot, validateMonorepoStructure } from "../utils/project.js";
import { runConcurrently } from "../utils/runner.js";

export interface DevOptions {
  serverOnly?: boolean;
  uiOnly?: boolean;
}

/**
 * Implements the `armiai dev` command.
 * Starts the UI and Server dev servers concurrently.
 */
export async function devCommand(options: DevOptions = {}): Promise<void> {
  const monorepoRoot = findMonorepoRoot();

  console.log(chalk.bold("\n🚀 ArmiAI Dev Server\n"));
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

  const commands: Array<{ command: string; name: string }> = [];

  if (!options.uiOnly) {
    commands.push({
      command: "pnpm --filter @armiai/server dev",
      name: "server",
    });
  }

  if (!options.serverOnly) {
    commands.push({
      command: "pnpm --filter @armiai/ui dev",
      name: "ui",
    });
  }

  if (commands.length === 0) {
    console.error(chalk.red("✗ Cannot use both --server-only and --ui-only together. Please choose one."));
    process.exit(1);
  }

  console.log(chalk.green(`\nStarting ${commands.map((c) => c.name).join(" and ")}...\n`));

  const result = await runConcurrently(commands, { cwd: monorepoRoot });

  if (result.exitCode !== 0) {
    console.error(chalk.red("\n✗ Dev server exited with an error."));
    process.exit(result.exitCode);
  }
}
