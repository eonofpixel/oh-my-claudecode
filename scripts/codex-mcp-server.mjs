#!/usr/bin/env node

/**
 * Codex MCP Server
 * Exposes execute_codex tool for Claude Code to call Codex CLI
 * Requires agent_type parameter to inject appropriate system prompt
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load agent prompt from agents/*.md file
function loadAgentPrompt(agentType) {
  const agentFile = join(__dirname, "..", "agents", `${agentType}.md`);
  try {
    const content = readFileSync(agentFile, "utf-8");
    // Strip YAML frontmatter
    const match = content.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
    return match ? match[1].trim() : content.trim();
  } catch (err) {
    console.error(`[codex-mcp] Failed to load prompt for ${agentType}:`, err.message);
    return null;
  }
}

// Simple Codex CLI executor (self-contained)
async function executeCodex({ prompt, model = "gpt-5.2" }) {
  return new Promise((resolve) => {
    const args = ["exec", "-m", model, "--json", prompt];
    const proc = spawn("codex", args, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data; });
    proc.stderr.on("data", (data) => { stderr += data; });

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderr || `Exit code ${code}` });
        return;
      }

      // Parse JSONL output - extract text content
      try {
        const lines = stdout.trim().split("\n").filter(Boolean);
        let output = "";
        for (const line of lines) {
          const obj = JSON.parse(line);
          // Handle message events
          if (obj.type === "message" && obj.message?.content) {
            for (const block of obj.message.content) {
              if (block.type === "text") {
                output += block.text;
              }
            }
          }
          // Handle item.completed events (Codex CLI format)
          if (obj.type === "item.completed" && obj.item?.text) {
            output = obj.item.text;
          }
        }
        resolve({ success: true, output: output || stdout });
      } catch {
        resolve({ success: true, output: stdout });
      }
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: `Failed to spawn codex: ${err.message}` });
    });
  });
}

// Create MCP server
const server = new McpServer({
  name: "codex-server",
  version: "1.0.0",
});

// Register execute_codex tool
server.registerTool(
  "execute_codex",
  {
    description: "Execute a prompt via OpenAI Codex CLI (gpt-5.2). Requires agent_type to inject the appropriate system prompt.",
    inputSchema: {
      agent_type: z.enum(["architect", "planner", "critic"]).describe("Agent type - determines system prompt (architect, planner, or critic)"),
      prompt: z.string().describe("The prompt to send to Codex"),
      model: z.string().optional().describe("Model override (default: gpt-5.2)")
    }
  },
  async ({ prompt, agent_type, model }) => {
    console.error(`[codex-mcp] Executing ${agent_type} prompt (${prompt.slice(0, 50)}...)`);

    // Load and prepend agent system prompt
    const systemPrompt = loadAgentPrompt(agent_type);
    if (!systemPrompt) {
      return {
        content: [{ type: "text", text: `Error: Failed to load prompt for agent_type="${agent_type}"` }],
        isError: true
      };
    }

    const fullPrompt = `${systemPrompt}\n\n---\n\nUser Request:\n${prompt}`;
    const result = await executeCodex({ prompt: fullPrompt, model });

    console.error(`[codex-mcp] Result: success=${result.success}, length=${result.output?.length || 0}`);

    return {
      content: [{
        type: "text",
        text: result.success ? result.output : `Error: ${result.error}`
      }],
      isError: !result.success
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[codex-mcp] Server running on stdio");
}

main().catch((err) => {
  console.error("[codex-mcp] Fatal error:", err);
  process.exit(1);
});
