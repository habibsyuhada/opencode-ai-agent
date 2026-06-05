import { execa, type Options as ExecaOptions } from "execa";
import chalk from "chalk";

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdio?: "inherit" | "pipe" | "ignore";
  silent?: boolean;
}

/**
 * Runs a command using execa with cross-platform shell support.
 * Uses stdio: "inherit" by default to pipe child output to the terminal.
 */
export async function run(
  command: string,
  args: string[],
  options: RunOptions = {}
): Promise<{ exitCode: number; stdout?: string; stderr?: string }> {
  const { cwd, env, stdio = "inherit", silent = false } = options;

  if (!silent) {
    console.log(chalk.cyan(`▸ Running: ${command} ${args.join(" ")}`));
  }

  const execaOptions: ExecaOptions = {
    cwd,
    env: { ...process.env, ...env },
    stdio,
    shell: true,
  };

  try {
    const result = await execa(command, args, execaOptions);
    return {
      exitCode: result.exitCode ?? 0,
      stdout: typeof result.stdout === "string" ? result.stdout : undefined,
      stderr: typeof result.stderr === "string" ? result.stderr : undefined,
    };
  } catch (error: unknown) {
    const err = error as {
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (!silent) {
      console.error(chalk.red(`✗ Command failed: ${command} ${args.join(" ")}`));
      if (err.stderr) console.error(chalk.red(err.stderr));
    }
    return {
      exitCode: err.exitCode ?? 1,
      stdout: err.stdout,
      stderr: err.stderr,
    };
  }
}

/**
 * Runs multiple pnpm scripts concurrently using the concurrently package.
 */
export async function runConcurrently(
  commands: Array<{ command: string; name: string }>,
  options: RunOptions = {}
): Promise<{ exitCode: number }> {
  const { cwd, env } = options;

  // Build comma-separated names and collect command strings
  const names = commands.map((c) => c.name).join(",");
  const cmdStrings = commands.map((c) => `"${c.command}"`);
  const concurrentlyArgs = ["--names", names, "--prefix-colors", "cyan,yellow", ...cmdStrings];

  const result = await run("npx", ["concurrently", ...concurrentlyArgs], {
    cwd,
    env,
    stdio: "inherit",
  });

  return { exitCode: result.exitCode };
}
