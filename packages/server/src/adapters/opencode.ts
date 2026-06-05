/**
 * OpenCodeAdapter — Executes agent tasks via the OpenCode CLI.
 *
 * Spawns the `opencode` binary as a child process, maps agent roles to
 * opencode agent names from the configuration, sends the task prompt,
 * captures structured output, and parses token usage for cost tracking.
 *
 * Architecture reference: docs/architecture/architecture.md §4, §6
 * - "OpenCode CLI: The system must interface directly with the local or
 *   cloud OpenCode CLI as the sole agent execution engine."
 * - "The Hono Server spawns OpenCode as a child process to perform the AI work."
 *
 * Reference config: old_version/v2/template/.opencode/opencode.json
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type AgentAdapter,
  type AdapterStatus,
  type AdapterResult,
  type AdapterRunConfig,
} from './base.js';
import { logger } from '../utils/logger.js';

/**
 * Mapping from database Agent.role to opencode agent names.
 *
 * This maps the role strings stored in the Prisma Agent model
 * to the agent keys defined in opencode.json's `agent` section.
 *
 * Reference: old_version/v2/template/.opencode/opencode.json
 */
const ROLE_TO_AGENT_MAP: Record<string, string> = {
  // Primary orchestrator
  'ceo': 'armi',
  'cto': 'armi',

  // Development roles
  'developer': 'developer',
  'frontend-developer': 'frontend-developer',
  'backend-developer': 'backend-developer',
  'full-stack-developer': 'developer',

  // Quality & Testing
  'qa': 'qa-engineer',
  'qa-engineer': 'qa-engineer',
  'tdd-engineer': 'tdd-engineer',
  'e2e-runner': 'e2e-runner',

  // Management & Planning
  'scrum-master': 'scrum-master',
  'product-owner': 'product-owner',
  'product-manager': 'product-owner',
  'solution-architect': 'solution-architect',
  'planner': 'planner',

  // Review & Security
  'code-reviewer': 'code-reviewer',
  'frontend-reviewer': 'frontend-reviewer',
  'security-reviewer': 'security-reviewer',
  'database-reviewer': 'database-reviewer',

  // Operations
  'bugfix-developer': 'bugfix-developer',
  'build-error-resolver': 'build-error-resolver',
  'docs-updater': 'docs-updater',
  'refactor-cleaner': 'refactor-cleaner',
  'devops-release-engineer': 'devops-release-engineer',
  'story-sharding-agent': 'story-sharding-agent',
};

/**
 * Default cost rates per 1K tokens (USD).
 * These are estimates; actual costs depend on the provider/model.
 */
const DEFAULT_COST_RATES: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'anthropic/claude-sonnet-4-5': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'anthropic/claude-haiku-4-5': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'default': { inputPer1k: 0.003, outputPer1k: 0.015 },
};

/**
 * Structured output format that OpenCode CLI may emit.
 * When using `--output json`, the CLI returns this structure.
 */
interface OpenCodeStructuredOutput {
  output?: string;
  tokens?: {
    input: number;
    output: number;
  };
  model?: string;
  provider?: string;
  artifacts?: string[];
  error?: string;
  duration_ms?: number;
}

/**
 * OpenCodeAdapter — spawns the `opencode` CLI to execute agent tasks.
 *
 * Implements the AgentAdapter interface for integration with the
 * Heartbeat Engine. Each adapter instance manages a single execution
 * at a time (one child process).
 */
export class OpenCodeAdapter implements AgentAdapter {
  readonly name = 'opencode';

  private status: AdapterStatus = 'idle';
  private currentProcess: ChildProcess | null = null;
  private readonly opencodePath: string;

  /**
   * @param opencodePath - Path to the opencode binary (default: 'opencode' in PATH)
   */
  constructor(opencodePath: string = 'opencode') {
    this.opencodePath = opencodePath;
  }

  /**
   * Start a new execution run.
   *
   * Spawns the opencode CLI with the appropriate agent and prompt.
   * Captures stdout/stderr and parses the structured output for
   * token usage, cost, and artifacts.
   *
   * @param config - Execution configuration
   * @returns Structured execution result
   * @throws If the adapter is already running
   */
  async start(config: AdapterRunConfig): Promise<AdapterResult> {
    if (this.status === 'running') {
      throw new Error('OpenCodeAdapter is already running. Stop the current execution first.');
    }

    this.status = 'running';
    const startTime = Date.now();

    logger.info('OpenCode adapter starting', {
      agentRole: config.agentRole,
      agentName: config.agentName,
      workingDirectory: config.workingDirectory,
      timeoutMs: config.timeoutMs,
    });

    try {
      const result = await this.executeOpenCode(config, startTime);
      this.status = result.success ? 'completed' : 'failed';
      return result;
    } catch (err) {
      this.status = 'failed';
      const durationMs = Date.now() - startTime;

      logger.error('OpenCode adapter execution failed', {
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      });

      return {
        success: false,
        output: '',
        tokensUsed: 0,
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
        provider: 'unknown',
        model: 'unknown',
        artifacts: [],
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      };
    } finally {
      this.currentProcess = null;
    }
  }

  /**
   * Stop the currently running execution.
   *
   * Sends SIGTERM for graceful shutdown. If force is true, sends SIGKILL
   * after a short grace period.
   *
   * @param force - Whether to force-kill the process
   */
  async stop(force: boolean = false): Promise<void> {
    if (!this.currentProcess || this.status !== 'running') {
      logger.warn('OpenCodeAdapter stop called but no process is running');
      return;
    }

    const pid = this.currentProcess.pid;
    logger.info('OpenCode adapter stopping', { pid, force });

    return new Promise<void>((resolve, reject) => {
      if (!this.currentProcess) {
        resolve();
        return;
      }

      const proc = this.currentProcess;

      proc.on('exit', () => {
        this.status = 'idle';
        this.currentProcess = null;
        logger.info('OpenCode adapter process exited', { pid });
        resolve();
      });

      proc.on('error', (err) => {
        this.status = 'failed';
        this.currentProcess = null;
        logger.error('OpenCode adapter process error on stop', { pid, error: err.message });
        reject(err);
      });

      if (force) {
        proc.kill('SIGKILL');
      } else {
        proc.kill('SIGTERM');

        // Force kill after 5 seconds if graceful shutdown fails
        setTimeout(() => {
          if (this.currentProcess && !this.currentProcess.killed) {
            logger.warn('Graceful shutdown timed out, force killing', { pid });
            proc.kill('SIGKILL');
          }
        }, 5000);
      }
    });
  }

  /**
   * Get the current status of the adapter.
   */
  getStatus(): AdapterStatus {
    return this.status;
  }

  /**
   * Check if the opencode binary is available.
   *
   * Attempts to run `opencode --version` and checks for a successful exit.
   */
  async isAvailable(): Promise<boolean> {
    try {
      // First check if the binary exists at the specified path
      if (this.opencodePath !== 'opencode') {
        await access(this.opencodePath, constants.X_OK);
      }

      return new Promise<boolean>((resolve) => {
        const proc = spawn(this.opencodePath, ['--version'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        });

        proc.on('exit', (code) => {
          resolve(code === 0);
        });

        proc.on('error', () => {
          resolve(false);
        });

        // Timeout fallback
        setTimeout(() => {
          proc.kill('SIGKILL');
          resolve(false);
        }, 10000);
      });
    } catch {
      return false;
    }
  }

  // ── Private Methods ──────────────────────────────────────────────

  /**
   * Execute the opencode CLI process with the given configuration.
   *
   * Builds the command-line arguments, spawns the process, and
   * collects output until completion or timeout.
   */
  private async executeOpenCode(
    config: AdapterRunConfig,
    startTime: number
  ): Promise<AdapterResult> {
    const args = this.buildArgs(config);
    const env = this.buildEnv(config);

    logger.debug('Spawning opencode process', {
      binary: this.opencodePath,
      args: args.map((a) => (a.startsWith('--prompt') ? '--prompt [REDACTED]' : a)),
    });

    return new Promise<AdapterResult>((resolve, reject) => {
      const proc = spawn(this.opencodePath, args, {
        cwd: config.workingDirectory,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        // Windows-specific: use shell for command resolution
        shell: process.platform === 'win32',
      });

      this.currentProcess = proc;

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        // Emit log chunk for real-time streaming (STORY-019)
        if (config.onLogChunk) {
          config.onLogChunk('stdout', chunk);
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        // Emit log chunk for real-time streaming (STORY-019)
        if (config.onLogChunk) {
          config.onLogChunk('stderr', chunk);
        }
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        logger.warn('OpenCode execution timed out, killing process', {
          timeoutMs: config.timeoutMs,
          pid: proc.pid,
        });
        this.status = 'timeout';
        proc.kill('SIGKILL');
      }, config.timeoutMs);

      proc.on('exit', (code, signal) => {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        logger.info('OpenCode process exited', {
          code,
          signal,
          durationMs,
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
        });

        // Try to parse structured output
        const parsed = this.parseOutput(stdout, stderr);

        resolve({
          success: code === 0 && !parsed.error,
          output: parsed.output || stdout,
          tokensUsed: (parsed.tokens?.input || 0) + (parsed.tokens?.output || 0),
          tokensIn: parsed.tokens?.input || 0,
          tokensOut: parsed.tokens?.output || 0,
          cost: this.calculateCost(
            parsed.model || 'default',
            parsed.tokens?.input || 0,
            parsed.tokens?.output || 0
          ),
          provider: parsed.provider || 'anthropic',
          model: parsed.model || 'unknown',
          artifacts: parsed.artifacts || [],
          error: parsed.error || (code !== 0 ? stderr : undefined),
          durationMs,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        logger.error('OpenCode process spawn error', {
          error: err.message,
          durationMs,
        });

        resolve({
          success: false,
          output: '',
          tokensUsed: 0,
          tokensIn: 0,
          tokensOut: 0,
          cost: 0,
          provider: 'unknown',
          model: 'unknown',
          artifacts: [],
          error: `Process spawn error: ${err.message}`,
          durationMs,
        });
      });

      // Send the prompt via stdin and close
      if (proc.stdin) {
        proc.stdin.write(config.prompt);
        proc.stdin.end();
      }
    });
  }

  /**
   * Build command-line arguments for the opencode process.
   *
   * Maps the agent role to an opencode agent name and constructs
   * the appropriate CLI flags.
   */
  private buildArgs(config: AdapterRunConfig): string[] {
    const args: string[] = ['run'];

    // Map agent role to opencode agent name
    const agentName = this.resolveAgentName(config.agentRole, config.agentName);
    args.push('--agent', agentName);

    // Request structured JSON output for parsing
    args.push('--output', 'json');

    // Set working context directory
    args.push('--cwd', config.workingDirectory);

    // Add context files if provided
    if (config.contextFiles && config.contextFiles.length > 0) {
      for (const file of config.contextFiles) {
        args.push('--context', file);
      }
    }

    return args;
  }

  /**
   * Build environment variables for the opencode process.
   *
   * Injects secrets and configuration that the agent may need.
   * Secrets are only injected during active executions (NFR-004).
   */
  private buildEnv(config: AdapterRunConfig): Record<string, string> {
    const env: Record<string, string> = {
      // Tell opencode to read prompt from stdin
      OPENCODE_READ_STDIN: '1',
    };

    // Inject secrets from config (only during active execution)
    if (config.env) {
      Object.assign(env, config.env);
    }

    return env;
  }

  /**
   * Resolve the opencode agent name from the agent role.
   *
   * Uses the ROLE_TO_AGENT_MAP to translate database role strings
   * to opencode agent names. Falls back to the provided agentName
   * or 'developer' if no mapping exists.
   */
  private resolveAgentName(role: string, fallbackName: string): string {
    const normalizedRole = role.toLowerCase().trim();
    const mapped = ROLE_TO_AGENT_MAP[normalizedRole];

    if (mapped) {
      return mapped;
    }

    // Fallback: try the provided agent name, then default to 'developer'
    if (fallbackName && ROLE_TO_AGENT_MAP[fallbackName.toLowerCase()]) {
      return ROLE_TO_AGENT_MAP[fallbackName.toLowerCase()];
    }

    logger.warn('No agent mapping found for role, using fallback', {
      role,
      fallbackName,
      default: 'developer',
    });

    return 'developer';
  }

  /**
   * Parse the opencode CLI output.
   *
   * Attempts to parse as JSON (structured output).
   * Falls back to raw text parsing for token extraction.
   */
  private parseOutput(stdout: string, stderr: string): OpenCodeStructuredOutput {
    // Try JSON parsing first
    try {
      const trimmed = stdout.trim();
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed) as OpenCodeStructuredOutput;
        return parsed;
      }
    } catch {
      // Not valid JSON, fall through to text parsing
    }

    // Fallback: try to extract token usage from stderr/output text
    return this.parseTextOutput(stdout, stderr);
  }

  /**
   * Parse token usage from plain text output.
   *
   * Looks for patterns like:
   * - "Tokens: 1234 in, 5678 out"
   * - "token_usage: { input: 1234, output: 5678 }"
   * - "Cost: $0.15"
   */
  private parseTextOutput(stdout: string, stderr: string): OpenCodeStructuredOutput {
    const combined = stdout + '\n' + stderr;
    const result: OpenCodeStructuredOutput = {
      output: stdout.trim(),
    };

    // Try to extract token counts
    const tokenMatch = combined.match(
      /tokens?[:\s]+(\d+)\s*(?:in|input)[,\s]+(\d+)\s*(?:out|output)/i
    );
    if (tokenMatch) {
      result.tokens = {
        input: parseInt(tokenMatch[1], 10),
        output: parseInt(tokenMatch[2], 10),
      };
    }

    // Try to extract model name
    const modelMatch = combined.match(/model[:\s]+([\w/.-]+)/i);
    if (modelMatch) {
      result.model = modelMatch[1];
    }

    // Try to extract cost
    const costMatch = combined.match(/cost[:\s]+\$(\d+\.?\d*)/i);
    if (costMatch) {
      // If cost is found in text, we can use it directly
      result.tokens = result.tokens || { input: 0, output: 0 };
    }

    // Try to extract artifact paths
    const artifactMatches = combined.matchAll(
      /(?:artifacts?|files?|created|modified)[:\s]+(.+\.(?:ts|js|md|json|yaml|yml|tsx|jsx))/gi
    );
    if (artifactMatches) {
      result.artifacts = [];
      for (const match of artifactMatches) {
        result.artifacts.push(match[1].trim());
      }
    }

    // Check for error indicators
    if (
      combined.toLowerCase().includes('error:') ||
      combined.toLowerCase().includes('failed') ||
      combined.toLowerCase().includes('fatal:')
    ) {
      const errorMatch = combined.match(/(?:error|failed|fatal)[:\s]+(.+)/i);
      if (errorMatch) {
        result.error = errorMatch[1].trim();
      }
    }

    return result;
  }

  /**
   * Calculate the cost in USD for the given token usage.
   *
   * Uses the DEFAULT_COST_RATES lookup table. Falls back to 'default'
   * rates if the model is not found.
   */
  private calculateCost(model: string, tokensIn: number, tokensOut: number): number {
    const rates = DEFAULT_COST_RATES[model] || DEFAULT_COST_RATES['default'];
    const inputCost = (tokensIn / 1000) * rates.inputPer1k;
    const outputCost = (tokensOut / 1000) * rates.outputPer1k;
    return Math.round((inputCost + outputCost) * 1000000) / 1000000; // Round to 6 decimal places
  }
}

/**
 * Create a default OpenCodeAdapter instance.
 *
 * Uses the `opencode` binary from PATH. Can be overridden via the
 * OPENCODE_BINARY environment variable.
 */
export function createOpenCodeAdapter(): OpenCodeAdapter {
  const binaryPath = process.env.OPENCODE_BINARY || 'opencode';
  return new OpenCodeAdapter(binaryPath);
}

export default OpenCodeAdapter;
