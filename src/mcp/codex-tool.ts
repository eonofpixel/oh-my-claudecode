/**
 * MCP Tool for Codex CLI execution
 *
 * This provides a direct tool that Claude can call to execute prompts via Codex CLI.
 * Unlike hooks (which can only block), MCP tools can return custom results.
 */

import { executeCodex, isCodexAvailable } from '../agents/codex-executor.js';

export interface CodexToolInput {
  prompt: string;
  agent_type?: string;
  model?: string;
}

export interface CodexToolResult {
  success: boolean;
  output: string;
  error?: string;
  executed_via: string;
}

/**
 * Execute a prompt via Codex CLI
 */
export async function executeCodexTool(input: CodexToolInput): Promise<CodexToolResult> {
  if (!isCodexAvailable()) {
    return {
      success: false,
      output: '',
      error: 'Codex CLI is not available. Install it with: npm install -g @openai/codex',
      executed_via: 'none'
    };
  }

  const result = await executeCodex({
    prompt: input.prompt,
    model: 'gpt-5.2', // Always use SOTA model
  });

  return {
    success: result.success,
    output: result.output,
    error: result.error,
    executed_via: 'codex-cli:gpt-5.2'
  };
}

/**
 * MCP Tool definition for Codex execution
 */
export const codexToolDefinition = {
  name: 'execute_codex',
  description: 'Execute a prompt via OpenAI Codex CLI (gpt-5.2). Use this for -codex agent tasks.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'The prompt to send to Codex CLI'
      },
      agent_type: {
        type: 'string',
        description: 'Optional: The agent type (e.g., architect-codex, critic-codex)'
      }
    },
    required: ['prompt']
  }
};
