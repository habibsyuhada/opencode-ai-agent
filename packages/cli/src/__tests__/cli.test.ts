import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgram } from "../index.js";
import { findMonorepoRoot, validateMonorepoStructure, getServerDir, getUiDir, getPrismaDir } from "../utils/project.js";
import { runConcurrently } from "../utils/runner.js";
import { resolve, join } from "node:path";

// Mock execa so that run() and runConcurrently() don't actually spawn processes.
// vi.hoisted ensures the mock function is available when the hoisted vi.mock factory runs.
const { mockExeca } = vi.hoisted(() => ({
  mockExeca: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
}));

vi.mock("execa", () => ({
  execa: mockExeca,
}));

describe("CLI Program", () => {
  let program: ReturnType<typeof createProgram>;

  beforeEach(() => {
    program = createProgram();
  });

  it("should create a program with correct name", () => {
    expect(program.name()).toBe("armiai");
  });

  it("should have a description", () => {
    expect(program.description()).toBe(
      "ArmiAI Platform CLI — manage dev servers, database, and more"
    );
  });

  it("should have dev command registered", () => {
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain("dev");
  });

  it("should have setup command registered", () => {
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain("setup");
  });

  it("should have migrate command registered", () => {
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain("migrate");
  });

  it("should have version set to 1.0.0", () => {
    expect(program.version()).toBe("1.0.0");
  });

  it("dev command should have --server-only option", () => {
    const devCmd = program.commands.find((c) => c.name() === "dev");
    expect(devCmd).toBeDefined();
    const opts = devCmd!.options.map((o) => o.long);
    expect(opts).toContain("--server-only");
  });

  it("dev command should have --ui-only option", () => {
    const devCmd = program.commands.find((c) => c.name() === "dev");
    expect(devCmd).toBeDefined();
    const opts = devCmd!.options.map((o) => o.long);
    expect(opts).toContain("--ui-only");
  });

  it("setup command should have --skip-seed option", () => {
    const setupCmd = program.commands.find((c) => c.name() === "setup");
    expect(setupCmd).toBeDefined();
    const opts = setupCmd!.options.map((o) => o.long);
    expect(opts).toContain("--skip-seed");
  });

  it("setup command should have --skip-generate option", () => {
    const setupCmd = program.commands.find((c) => c.name() === "setup");
    expect(setupCmd).toBeDefined();
    const opts = setupCmd!.options.map((o) => o.long);
    expect(opts).toContain("--skip-generate");
  });

  it("migrate command should have --name option", () => {
    const migrateCmd = program.commands.find((c) => c.name() === "migrate");
    expect(migrateCmd).toBeDefined();
    const opts = migrateCmd!.options.map((o) => o.long);
    expect(opts).toContain("--name");
  });
});

describe("Project Utilities", () => {
  describe("findMonorepoRoot", () => {
    it("should find the monorepo root from the cli package directory", () => {
      // The test runs from within the cli package, so going up should find root
      const cliDir = resolve(__dirname, "..", "..");
      const root = findMonorepoRoot(cliDir);
      // Should find a directory with pnpm-workspace.yaml
      const fs = require("node:fs");
      expect(fs.existsSync(join(root, "pnpm-workspace.yaml"))).toBe(true);
    });

    it("should find the monorepo root from any subdirectory", () => {
      const deepDir = resolve(__dirname, "..", "..", "src", "commands");
      const root = findMonorepoRoot(deepDir);
      const fs = require("node:fs");
      expect(fs.existsSync(join(root, "pnpm-workspace.yaml"))).toBe(true);
    });
  });

  describe("getServerDir", () => {
    it("should return the server package directory", () => {
      const root = findMonorepoRoot(resolve(__dirname, "..", ".."));
      const serverDir = getServerDir(root);
      expect(serverDir).toContain("packages");
      expect(serverDir).toContain("server");
    });
  });

  describe("getUiDir", () => {
    it("should return the UI package directory", () => {
      const root = findMonorepoRoot(resolve(__dirname, "..", ".."));
      const uiDir = getUiDir(root);
      expect(uiDir).toContain("packages");
      expect(uiDir).toContain("ui");
    });
  });

  describe("getPrismaDir", () => {
    it("should return the Prisma directory inside server", () => {
      const root = findMonorepoRoot(resolve(__dirname, "..", ".."));
      const prismaDir = getPrismaDir(root);
      expect(prismaDir).toContain("prisma");
      expect(prismaDir).toContain("server");
    });
  });

  describe("validateMonorepoStructure", () => {
    it("should return empty array for valid monorepo", () => {
      const root = findMonorepoRoot(resolve(__dirname, "..", ".."));
      const missing = validateMonorepoStructure(root);
      expect(missing).toEqual([]);
    });

    it("should return missing paths for invalid root", () => {
      const missing = validateMonorepoStructure("/nonexistent/path");
      expect(missing.length).toBeGreaterThan(0);
    });
  });
});

describe("Command Modules (exports)", () => {
  it("should export devCommand", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.devCommand).toBe("function");
  });

  it("should export setupCommand", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.setupCommand).toBe("function");
  });

  it("should export migrateCommand", async () => {
    const mod = await import("../index.js");
    expect(typeof mod.migrateCommand).toBe("function");
  });
});

describe("runConcurrently (BUG-018-001 regression)", () => {
  beforeEach(() => {
    mockExeca.mockClear();
  });

  it("should build comma-separated --names flag for multiple commands", async () => {
    await runConcurrently(
      [
        { command: "pnpm --filter @armiai/server dev", name: "server" },
        { command: "pnpm --filter @armiai/ui dev", name: "ui" },
      ],
      { cwd: "/test" }
    );

    // run() calls execa("npx", [...args], options)
    expect(mockExeca).toHaveBeenCalledOnce();
    const [command, args] = mockExeca.mock.calls[0];
    expect(command).toBe("npx");

    // --names should appear exactly once with comma-separated value
    const namesIndex = args.indexOf("--names");
    expect(namesIndex).toBeGreaterThanOrEqual(0);
    expect(args[namesIndex + 1]).toBe("server,ui");

    // --names should NOT appear more than once
    const allNamesIndices = args
      .map((arg: string, i: number) => (arg === "--names" ? i : -1))
      .filter((i: number) => i >= 0);
    expect(allNamesIndices).toHaveLength(1);

    // --prefix-colors should appear exactly once
    const prefixIndex = args.indexOf("--prefix-colors");
    expect(prefixIndex).toBeGreaterThanOrEqual(0);
    expect(args[prefixIndex + 1]).toBe("cyan,yellow");

    const allPrefixIndices = args
      .map((arg: string, i: number) => (arg === "--prefix-colors" ? i : -1))
      .filter((i: number) => i >= 0);
    expect(allPrefixIndices).toHaveLength(1);

    // Both commands should be present (quoted)
    expect(args).toContain('"pnpm --filter @armiai/server dev"');
    expect(args).toContain('"pnpm --filter @armiai/ui dev"');
  });

  it("should handle a single command correctly", async () => {
    await runConcurrently(
      [{ command: "pnpm --filter @armiai/server dev", name: "server" }],
      { cwd: "/test" }
    );

    const [, args] = mockExeca.mock.calls[0];
    const namesIndex = args.indexOf("--names");
    expect(args[namesIndex + 1]).toBe("server");
  });
});
