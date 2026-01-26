/**
 * Codex CLI Executor
 *
 * Handles spawning the Codex CLI for agent execution.
 * Provides CLI detection, process spawning, and JSONL output parsing.
 */

import { execSync, spawn, type ChildProcess } from 'child_process';

// CLI availability cache
let codexAvailable: boolean | null = null;
let codexVersion: string | null = null;

/**
 * Check if codex CLI is available (cached)
 */
export function isCodexAvailable(): boolean {
  if (codexAvailable !== null) {
    return codexAvailable;
  }

  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${whichCmd} codex`, { stdio: 'ignore' });
    codexAvailable = true;
  } catch {
    codexAvailable = false;
  }

  return codexAvailable;
}

/**
 * Get codex CLI version (for diagnostics)
 */
export function getCodexVersion(): string | null {
  if (!isCodexAvailable()) return null;

  if (codexVersion !== null) {
    return codexVersion;
  }

  try {
    codexVersion = execSync('codex --version', { encoding: 'utf-8' }).trim();
    return codexVersion;
  } catch {
    return null;
  }
}

/**
 * Clear CLI detection cache (for testing)
 */
export function clearCodexCache(): void {
  codexAvailable = null;
  codexVersion = null;
}

/**
 * Codex execution options
 */
export interface CodexExecOptions {
  /** The prompt to send to Codex */
  prompt: string;
  /** Model to use (default: gpt-4o) */
  model?: string;
  /** Working directory for the agent */
  workingDirectory?: string;
  /** Timeout in milliseconds (default: 300000 = 5 min) */
  timeout?: number;
}

/**
 * Codex execution result
 */
export interface CodexExecResult {
  /** Whether execution succeeded */
  success: boolean;
  /** The final response text from Codex */
  output: string;
  /** Error message if failed */
  error?: string;
  /** Raw JSONL events for debugging */
  rawEvents?: string[];
}

/**
 * Parse JSONL output from Codex CLI
 *
 * Codex CLI with --json outputs events as JSONL (one JSON object per line).
 * We extract the final response text from the stream.
 */
function parseCodexJsonlOutput(stdout: string): { output: string; events: string[] } {
  const lines = stdout.split('\n').filter(line => line.trim());
  const events: string[] = [];
  let finalOutput = '';

  for (const line of lines) {
    events.push(line);
    try {
      const event = JSON.parse(line);
      // Look for message events with assistant content
      // Codex CLI event format may vary; handle common patterns
      if (event.type === 'message' && event.content) {
        finalOutput = event.content;
      } else if (event.type === 'response' && event.text) {
        finalOutput = event.text;
      } else if (event.type === 'item.completed' && event.item?.text) {
        // Handle Codex CLI item.completed events
        finalOutput = event.item.text;
      } else if (event.message?.content) {
        // Handle nested message format
        if (Array.isArray(event.message.content)) {
          const textParts = event.message.content
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('\n');
          if (textParts) finalOutput = textParts;
        } else if (typeof event.message.content === 'string') {
          finalOutput = event.message.content;
        }
      } else if (event.text) {
        // Simple text event
        finalOutput = event.text;
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return { output: finalOutput, events };
}

/**
 * Execute a prompt via Codex CLI
 */
export async function executeCodex(options: CodexExecOptions): Promise<CodexExecResult> {
  const { prompt, model = 'gpt-4o', workingDirectory, timeout = 300000 } = options;

  if (!isCodexAvailable()) {
    return {
      success: false,
      output: '',
      error: 'Codex CLI not found. Install it with: npm install -g @openai/codex\nThen authenticate with: codex auth'
    };
  }

  return new Promise<CodexExecResult>((resolve) => {
    const args = ['exec', '-m', model, '--json', prompt];

    const proc = spawn('codex', args, {
      cwd: workingDirectory ?? process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Set timeout
    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);

      if (killed) {
        resolve({
          success: false,
          output: '',
          error: `Codex execution timed out after ${timeout}ms`
        });
        return;
      }

      if (code !== 0) {
        resolve({
          success: false,
          output: '',
          error: `Codex exited with code ${code}: ${stderr || 'No error output'}`
        });
        return;
      }

      const { output, events } = parseCodexJsonlOutput(stdout);
      resolve({
        success: true,
        output: output || '(No output from Codex)',
        rawEvents: events
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        output: '',
        error: `Failed to spawn codex: ${err.message}`
      });
    });
  });
}

/**
 * Check Codex CLI status (for diagnostics)
 */
export function getCodexStatus(): { available: boolean; version: string | null } {
  return {
    available: isCodexAvailable(),
    version: getCodexVersion()
  };
}
