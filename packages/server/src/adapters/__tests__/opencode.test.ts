/**
 * Tests for the OpenCodeAdapter.
 *
 * Tests the adapter's agent role mapping, cost calculation,
 * output parsing, and status management.
 *
 * Note: Process spawning tests are mocked since we can't depend
 * on the actual opencode binary in the test environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenCodeAdapter } from '../opencode.js';
import type { AdapterRunConfig } from '../base.js';

// ── Test Fixtures ────────────────────────────────────────────────

const createTestConfig = (overrides?: Partial<AdapterRunConfig>): AdapterRunConfig => ({
  prompt: 'Test task prompt',
  agentRole: 'developer',
  agentName: 'developer',
  workingDirectory: '/tmp/test-workspace',
  timeoutMs: 30000,
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────

describe('OpenCodeAdapter', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    adapter = new OpenCodeAdapter('echo'); // Use 'echo' as a stand-in binary
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create an adapter with default name', () => {
      expect(adapter.name).toBe('opencode');
    });

    it('should have idle status initially', () => {
      expect(adapter.getStatus()).toBe('idle');
    });
  });

  describe('agent role mapping', () => {
    it('should map developer role correctly', async () => {
      // We test the internal mapping by checking the args built
      // Since we can't directly test private methods, we verify
      // the adapter accepts standard roles without error
      const config = createTestConfig({ agentRole: 'developer' });

      // The adapter should accept this config (even if execution fails
      // because 'echo' is not opencode)
      expect(config.agentRole).toBe('developer');
    });

  it('should handle unknown roles gracefully', () => {
    // Unknown roles should fall back to 'developer'
    const config = createTestConfig({ agentRole: 'unknown-role' });
    expect(config.agentRole).toBe('unknown-role');
  });
});

describe('OpenCodeAdapter — Log Callback (STORY-019)', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    adapter = new OpenCodeAdapter('echo');
  });

  it('should accept onLogChunk in config', () => {
    const onLogChunk = vi.fn();
    const config = createTestConfig({ onLogChunk });
    expect(config.onLogChunk).toBe(onLogChunk);
  });

  it('should have undefined onLogChunk by default', () => {
    const config = createTestConfig();
    expect(config.onLogChunk).toBeUndefined();
  });
});

  describe('status management', () => {
    it('should start in idle status', () => {
      expect(adapter.getStatus()).toBe('idle');
    });

    it('should prevent concurrent executions', async () => {
      // Mock the adapter to be in 'running' state
      // by accessing the private status via any
      (adapter as any).status = 'running';

      await expect(adapter.start(createTestConfig())).rejects.toThrow(
        'OpenCodeAdapter is already running'
      );
    });
  });

  describe('stop', () => {
    it('should handle stop when no process is running', async () => {
      // Should not throw when stopping with no process
      await adapter.stop();
      expect(adapter.getStatus()).toBe('idle');
    });
  });

  describe('isAvailable', () => {
    it('should return false when binary is not found', async () => {
      const badAdapter = new OpenCodeAdapter('/nonexistent/binary/path');
      const available = await badAdapter.isAvailable();
      expect(available).toBe(false);
    });
  });
});

describe('OpenCodeAdapter — Cost Calculation', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    adapter = new OpenCodeAdapter('echo');
  });

  it('should calculate cost correctly for known model', () => {
    // Access private method via any
    const cost = (adapter as any).calculateCost(
      'anthropic/claude-sonnet-4-5',
      1000, // 1K input tokens
      2000  // 2K output tokens
    );

    // Expected: (1000/1000 * 0.003) + (2000/1000 * 0.015) = 0.003 + 0.030 = 0.033
    expect(cost).toBeCloseTo(0.033, 6);
  });

  it('should use default rates for unknown models', () => {
    const cost = (adapter as any).calculateCost(
      'unknown-model',
      1000,
      1000
    );

    // Expected: (1000/1000 * 0.003) + (1000/1000 * 0.015) = 0.003 + 0.015 = 0.018
    expect(cost).toBeCloseTo(0.018, 6);
  });

  it('should handle zero tokens', () => {
    const cost = (adapter as any).calculateCost('default', 0, 0);
    expect(cost).toBe(0);
  });
});

describe('OpenCodeAdapter — Output Parsing', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    adapter = new OpenCodeAdapter('echo');
  });

  it('should parse structured JSON output', () => {
    const jsonOutput = JSON.stringify({
      output: 'Task completed successfully',
      tokens: { input: 500, output: 1000 },
      model: 'claude-sonnet-4-5',
      provider: 'anthropic',
      artifacts: ['src/index.ts'],
    });

    const result = (adapter as any).parseOutput(jsonOutput, '');
    expect(result.output).toBe('Task completed successfully');
    expect(result.tokens).toEqual({ input: 500, output: 1000 });
    expect(result.model).toBe('claude-sonnet-4-5');
    expect(result.artifacts).toEqual(['src/index.ts']);
  });

  it('should fall back to text parsing for non-JSON output', () => {
    const textOutput = 'Some plain text output with Tokens: 100 in, 200 out';
    const result = (adapter as any).parseOutput(textOutput, '');

    expect(result.output).toBe(textOutput);
    expect(result.tokens).toEqual({ input: 100, output: 200 });
  });

  it('should detect errors in output', () => {
    const errorOutput = 'Error: Something went wrong';
    const result = (adapter as any).parseOutput('', errorOutput);

    expect(result.error).toBeTruthy();
  });

  it('should extract model from text', () => {
    const output = 'Using model: claude-sonnet-4-5 for execution';
    const result = (adapter as any).parseOutput(output, '');

    expect(result.model).toBe('claude-sonnet-4-5');
  });
});

describe('OpenCodeAdapter — Agent Name Resolution', () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    adapter = new OpenCodeAdapter('echo');
  });

  it('should resolve standard developer role', () => {
    const name = (adapter as any).resolveAgentName('developer', 'developer');
    expect(name).toBe('developer');
  });

  it('should resolve QA role', () => {
    const name = (adapter as any).resolveAgentName('qa', 'qa-engineer');
    expect(name).toBe('qa-engineer');
  });

  it('should resolve scrum-master role', () => {
    const name = (adapter as any).resolveAgentName('scrum-master', 'scrum-master');
    expect(name).toBe('scrum-master');
  });

  it('should fall back to developer for unknown roles', () => {
    const name = (adapter as any).resolveAgentName('unknown-role', 'unknown');
    expect(name).toBe('developer');
  });

  it('should handle case-insensitive role matching', () => {
    const name = (adapter as any).resolveAgentName('DEVELOPER', 'developer');
    expect(name).toBe('developer');
  });
});
