import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodexNotAvailableError, routeToCodex, type ModelType } from '../features/codex-router.js';
import * as codexExecutor from '../agents/codex-executor.js';

// Mock the codex-executor module
vi.mock('../agents/codex-executor.js', () => ({
  isCodexAvailable: vi.fn(),
  executeCodex: vi.fn(),
}));

describe('CodexNotAvailableError', () => {
  it('should be throwable and have correct message', () => {
    expect(() => {
      throw new CodexNotAvailableError();
    }).toThrow('Codex is not available');
  });

  it('should have correct name property', () => {
    const error = new CodexNotAvailableError();
    expect(error.name).toBe('CodexNotAvailableError');
  });

  it('should accept custom message', () => {
    const error = new CodexNotAvailableError('Custom error message');
    expect(error.message).toBe('Custom error message');
  });
});

describe('routeToCodex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw CodexNotAvailableError when Codex not available', async () => {
    vi.mocked(codexExecutor.isCodexAvailable).mockReturnValue(false);

    await expect(
      routeToCodex('test-agent', 'test prompt', 'sonnet')
    ).rejects.toThrow(CodexNotAvailableError);

    expect(codexExecutor.isCodexAvailable).toHaveBeenCalled();
    expect(codexExecutor.executeCodex).not.toHaveBeenCalled();
  });

  it('should always use gpt-5.2 (SOTA) regardless of input tier', async () => {
    vi.mocked(codexExecutor.isCodexAvailable).mockReturnValue(true);
    vi.mocked(codexExecutor.executeCodex).mockResolvedValue({
      success: true,
      output: 'test output',
    });

    // Test all tiers map to gpt-5.2
    for (const tier of ['opus', 'sonnet', 'haiku'] as const) {
      await routeToCodex('test-agent', 'test prompt', tier);
      expect(codexExecutor.executeCodex).toHaveBeenLastCalledWith({
        prompt: 'test prompt',
        model: 'gpt-5.2',
      });
    }
  });

  it('should call executeCodex with gpt-5.2 when Codex is available', async () => {
    vi.mocked(codexExecutor.isCodexAvailable).mockReturnValue(true);
    const mockResult = {
      success: true,
      output: 'expected output',
    };
    vi.mocked(codexExecutor.executeCodex).mockResolvedValue(mockResult);

    const result = await routeToCodex('architect', 'analyze this code', 'opus');

    expect(codexExecutor.isCodexAvailable).toHaveBeenCalled();
    expect(codexExecutor.executeCodex).toHaveBeenCalledWith({
      prompt: 'analyze this code',
      model: 'gpt-5.2',
    });
    expect(result).toEqual(mockResult);
  });
});
