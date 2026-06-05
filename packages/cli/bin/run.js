#!/usr/bin/env node

/**
 * ArmiAI CLI — Entry point
 *
 * This script bootstraps the Commander program from the compiled
 * (or tsx-transpiled) src/index.ts and runs it.
 */

// Register tsx for TypeScript transpilation at runtime
import("tsx/esm").then(async () => {
  const { createProgram } = await import("../src/index.ts");
  const program = createProgram();
  return program.parseAsync(process.argv);
}).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
