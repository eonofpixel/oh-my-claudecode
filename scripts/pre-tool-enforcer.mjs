#!/usr/bin/env node

/**
 * PreToolUse Hook: Sisyphus Reminder Enforcer (Node.js)
 * Injects contextual reminders before every tool execution
 * Also handles Codex CLI routing for -codex agents
 * Cross-platform: Windows, macOS, Linux
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

// Dynamic import for codex routing (may not exist in all installations)
const __dirname = dirname(fileURLToPath(import.meta.url));
let routeToCodex = null;
let CodexNotAvailableError = null;
let getAgentDefinitions = null;

try {
  const codexRouterPath = join(__dirname, '..', 'dist', 'features', 'codex-router.js');
  const agentDefsPath = join(__dirname, '..', 'dist', 'agents', 'definitions.js');
  const codexRouter = await import('file://' + codexRouterPath);
  const agentDefs = await import('file://' + agentDefsPath);
  routeToCodex = codexRouter.routeToCodex;
  CodexNotAvailableError = codexRouter.CodexNotAvailableError;
  getAgentDefinitions = agentDefs.getAgentDefinitions;
} catch (e) {
  // Codex routing not available - continue without it
  // console.error('Codex import failed:', e.message);
}

// Read all stdin
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Simple JSON field extraction
function extractJsonField(input, field, defaultValue = '') {
  try {
    const data = JSON.parse(input);
    return data[field] ?? defaultValue;
  } catch {
    // Fallback regex extraction
    const match = input.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, 'i'));
    return match ? match[1] : defaultValue;
  }
}

// Get todo status from project and global todos
function getTodoStatus(directory) {
  let pending = 0;
  let inProgress = 0;

  // Check project-local todos
  const localPaths = [
    join(directory, '.omc', 'todos.json'),
    join(directory, '.claude', 'todos.json')
  ];

  for (const todoFile of localPaths) {
    if (existsSync(todoFile)) {
      try {
        const content = readFileSync(todoFile, 'utf-8');
        const data = JSON.parse(content);
        const todos = data.todos || data;
        if (Array.isArray(todos)) {
          pending += todos.filter(t => t.status === 'pending').length;
          inProgress += todos.filter(t => t.status === 'in_progress').length;
        }
      } catch {
        // Ignore errors
      }
    }
  }

  // Check global Claude Code todos directory
  const globalTodosDir = join(homedir(), '.claude', 'todos');
  if (existsSync(globalTodosDir)) {
    try {
      const files = readdirSync(globalTodosDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = readFileSync(join(globalTodosDir, file), 'utf-8');
          const todos = JSON.parse(content);
          if (Array.isArray(todos)) {
            pending += todos.filter(t => t.status === 'pending').length;
            inProgress += todos.filter(t => t.status === 'in_progress').length;
          }
        } catch {
          // Ignore individual file errors
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  if (pending + inProgress > 0) {
    return `[${inProgress} active, ${pending} pending] `;
  }

  return '';
}

// Generate contextual message based on tool type
function generateMessage(toolName, todoStatus) {
  const messages = {
    TodoWrite: `${todoStatus}Mark todos in_progress BEFORE starting, completed IMMEDIATELY after finishing.`,
    Bash: `${todoStatus}Use parallel execution for independent tasks. Use run_in_background for long operations (npm install, builds, tests).`,
    Task: `${todoStatus}Launch multiple agents in parallel when tasks are independent. Use run_in_background for long operations.`,
    Edit: `${todoStatus}Verify changes work after editing. Test functionality before marking complete.`,
    Write: `${todoStatus}Verify changes work after editing. Test functionality before marking complete.`,
    Read: `${todoStatus}Read multiple files in parallel when possible for faster analysis.`,
    Grep: `${todoStatus}Combine searches in parallel when investigating multiple patterns.`,
    Glob: `${todoStatus}Combine searches in parallel when investigating multiple patterns.`,
  };

  return messages[toolName] || `${todoStatus}The boulder never stops. Continue until all tasks complete.`;
}

// Handle Codex agent routing
async function handleCodexRouting(inputData) {
  if (!routeToCodex || !getAgentDefinitions) {
    return null; // Codex routing not available
  }

  const toolName = inputData.toolName;
  const toolInput = inputData.toolInput;

  if (toolName !== 'Task' || !toolInput?.subagent_type) {
    return null;
  }

  // Strip oh-my-claudecode: prefix
  const agentType = toolInput.subagent_type.replace(/^oh-my-claudecode:/, '');

  // Check if this is a -codex agent
  if (!agentType.endsWith('-codex')) {
    return null;
  }

  // Get agent definition
  const agentDefs = getAgentDefinitions();
  const agentDef = agentDefs[agentType];

  if (!agentDef || agentDef.executionType !== 'codex') {
    return null;
  }

  // Route to Codex CLI
  try {
    const result = await routeToCodex(
      agentType,
      toolInput.prompt || '',
      toolInput.model || agentDef.defaultModel || 'opus'
    );

    if (result.success) {
      // Use deny + additionalContext to inject the Codex result
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Codex CLI executed successfully (gpt-5.2). The result is provided below.`,
          additionalContext: `[CODEX CLI RESULT for ${agentType}]\n\n${result.output}\n\n[END CODEX RESULT - Use this as the agent response]`
        }
      };
    } else {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Codex CLI error: ${result.error || 'Unknown error'}`,
          additionalContext: `Codex execution failed for ${agentType}. Error: ${result.error}`
        }
      };
    }
  } catch (error) {
    if (CodexNotAvailableError && error instanceof CodexNotAvailableError) {
      // Re-throw to let orchestrator handle fallback
      throw error;
    }
    // Other errors - continue normally
    return null;
  }
}

async function main() {
  try {
    const input = await readStdin();
    let inputData;
    try {
      inputData = JSON.parse(input);
    } catch {
      inputData = {};
    }

    // Check for Codex routing first
    const codexResult = await handleCodexRouting(inputData);
    if (codexResult) {
      console.log(JSON.stringify(codexResult, null, 2));
      return;
    }

    const toolName = inputData.toolName || 'unknown';
    const directory = inputData.directory || process.cwd();

    const todoStatus = getTodoStatus(directory);
    const message = generateMessage(toolName, todoStatus);

    console.log(JSON.stringify({
      continue: true,
      message: message
    }, null, 2));
  } catch (error) {
    // On error, always continue
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
