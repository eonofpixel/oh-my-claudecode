import { executeCodex, isCodexAvailable, type CodexExecResult } from '../agents/codex-executor.js';

export type ModelType = 'opus' | 'sonnet' | 'haiku';

export class CodexNotAvailableError extends Error {
  constructor(message: string = 'Codex is not available') {
    super(message);
    this.name = 'CodexNotAvailableError';
  }
}

export interface CodexRouteResult {
  success: boolean;
  output: string;
  error?: string;
}

export async function routeToCodex(
  agentType: string,
  prompt: string,
  model: ModelType
): Promise<CodexRouteResult> {
  if (!isCodexAvailable()) {
    throw new CodexNotAvailableError(
      `Codex CLI not available. Cannot run agent "${agentType}" with executionType='codex'. Install Codex CLI or use Claude agents instead.`
    );
  }

  // All codex agents use SOTA model - no tiers
  const mappedModel = 'gpt-5.2';

  const result = await executeCodex({
    prompt,
    model: mappedModel,
  });

  return result;
}
