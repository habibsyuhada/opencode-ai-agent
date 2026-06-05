import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Finds the monorepo root by walking up from the current directory
 * looking for the pnpm-workspace.yaml file.
 */
export function findMonorepoRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);
  const root = resolve("/");

  while (dir !== root) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    dir = resolve(dir, "..");
  }

  // Fallback: assume 2 levels up from cli package
  return resolve(startDir, "..", "..");
}

/**
 * Returns the absolute path to the server package directory.
 */
export function getServerDir(monorepoRoot: string): string {
  return join(monorepoRoot, "packages", "server");
}

/**
 * Returns the absolute path to the UI package directory.
 */
export function getUiDir(monorepoRoot: string): string {
  return join(monorepoRoot, "packages", "ui");
}

/**
 * Returns the absolute path to the Prisma directory inside server.
 */
export function getPrismaDir(monorepoRoot: string): string {
  return join(getServerDir(monorepoRoot), "prisma");
}

/**
 * Validates that the monorepo structure is intact.
 * Returns an array of missing paths (empty if all good).
 */
export function validateMonorepoStructure(monorepoRoot: string): string[] {
  const required = [
    join(monorepoRoot, "package.json"),
    join(monorepoRoot, "pnpm-workspace.yaml"),
    getServerDir(monorepoRoot),
    getUiDir(monorepoRoot),
    join(getPrismaDir(monorepoRoot), "schema.prisma"),
  ];

  return required.filter((p) => !existsSync(p));
}
