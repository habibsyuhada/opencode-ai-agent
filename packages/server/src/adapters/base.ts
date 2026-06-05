/**
 * AgentAdapter — Base interface for all agent execution adapters.
 *
 * Defines the contract that every adapter must implement to integrate
 * with the ArmiAI Heartbeat Engine. The adapter is responsible for:
 * - Spawning the agent execution environment (e.g., OpenCode CLI)
 * - Sending the task prompt and capturing structured output
 * - Tracking token usage and cost
 * - Reporting execution status
 *
 * Architecture reference: docs/architecture/architecture.md §4, §6
 * "OpenCode CLI: The system must interface directly with the local or
 * cloud OpenCode CLI as the sole agent execution engine."
 */

/**
 * Status of a single adapter execution run.
 */
export type AdapterStatus = 'idle' | 'running' | 'completed' | 'failed' | 'timeout';

/**
 * Structured result returned after an adapter execution completes.
 *
 * Contains the agent's output, token/cost metadata, and any produced artifacts.
 */
export interface AdapterResult {
  /** Whether the execution completed successfully */
  success: boolean;

  /** The agent's textual output (raw or structured JSON) */
  output: string;

  /** Total tokens consumed (input + output) */
  tokensUsed: number;

  /** Tokens consumed in the input/prompt phase */
  tokensIn: number;

  /** Tokens consumed in the output/completion phase */
  tokensOut: number;

  /** Estimated cost in USD for this execution */
  cost: number;

  /** LLM provider used (e.g., 'anthropic', 'openai') */
  provider: string;

  /** Model identifier used (e.g., 'claude-sonnet-4-5') */
  model: string;

  /** Paths to any artifacts produced by the agent */
  artifacts: string[];

  /** Error message if execution failed */
  error?: string;

  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Configuration for an adapter execution run.
 */
export interface AdapterRunConfig {
  /** The task prompt to send to the agent */
  prompt: string;

  /** The agent role used to map to the adapter's agent name (e.g., 'developer') */
  agentRole: string;

  /** The agent name in the adapter's configuration (e.g., 'developer' in opencode.json) */
  agentName: string;

  /** Working directory for the execution */
  workingDirectory: string;

  /** Maximum execution time in milliseconds before timeout */
  timeoutMs: number;

  /** Optional environment variables to inject (e.g., secrets) */
  env?: Record<string, string>;

  /** Optional additional context files to include */
  contextFiles?: string[];

  /**
   * Optional callback for real-time log streaming (STORY-019).
   *
   * Called for each stdout/stderr chunk during execution.
   * Used by the HeartbeatLogEmitter to stream logs to SSE clients.
   */
  onLogChunk?: (stream: 'stdout' | 'stderr', data: string) => void;
}

/**
 * AgentAdapter interface — contract for all execution adapters.
 *
 * Each adapter wraps a specific agent engine (e.g., OpenCode CLI)
 * and provides a uniform interface for the Heartbeat Engine to use.
 */
export interface AgentAdapter {
  /**
   * Unique identifier for this adapter type (e.g., 'opencode', 'cursor').
   */
  readonly name: string;

  /**
   * Start a new execution run.
   *
   * Spawns the agent process, sends the prompt, and waits for completion.
   * Returns a structured result with output, tokens, cost, and artifacts.
   *
   * @param config - Execution configuration including prompt, agent, and workspace
   * @returns Promise resolving to the execution result
   * @throws If the adapter is already running (only one execution at a time)
   */
  start(config: AdapterRunConfig): Promise<AdapterResult>;

  /**
   * Stop the currently running execution.
   *
   * Gracefully terminates the agent process. If force is true, sends SIGKILL.
   *
   * @param force - Whether to force-kill the process (default: false)
   * @returns Promise resolving when the process has been stopped
   */
  stop(force?: boolean): Promise<void>;

  /**
   * Get the current status of the adapter.
   *
   * @returns The current execution status
   */
  getStatus(): AdapterStatus;

  /**
   * Check if the adapter's underlying engine is available.
   *
   * For CLI-based adapters, this checks if the binary exists and is executable.
   *
   * @returns Promise resolving to true if the engine is available
   */
  isAvailable(): Promise<boolean>;
}
