#!/usr/bin/env node

/**
 * Codex MCP Server
 * Exposes execute_codex tool for Claude Code to call Codex CLI
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";

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
    description: "Execute a prompt via OpenAI Codex CLI (gpt-5.2). Use this for -codex agent tasks like architect-codex, planner-codex, critic-codex.",
    inputSchema: {
      prompt: z.string().describe("The prompt to send to Codex"),
      model: z.string().optional().describe("Model override (default: gpt-5.2)")
    }
  },
  async ({ prompt, model }) => {
    console.error(`[codex-mcp] Executing prompt (${prompt.slice(0, 50)}...)`);

    const result = await executeCodex({ prompt, model });

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
