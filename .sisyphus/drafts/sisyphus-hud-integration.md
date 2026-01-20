# Sisyphus HUD Integration Plan (Revised v2)

## Overview

Build a standalone HUD (Heads-Up Display) for oh-my-claude-sisyphus that visualizes multi-agent orchestration state in the Claude Code statusline.

**Goal**: Show users what their AI swarm is doing, how much parallel capacity is used, and when tasks will complete.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Integration | Standalone (bundled with oh-my-claude-sisyphus) | No external dependencies |
| Priority Visualizations | Agent Orchestration, Background Tasks, Ralph Loop | Core Sisyphus differentiators |
| Display Density | Focused (configurable) | Balance info vs terminal space |
| Update Mechanism | Hybrid (hooks + polling) | Event-driven accuracy with fallback |

---

## Critical Research Findings: Statusline API

### How Claude Code Statusline Works

**Configuration** (from `~/.claude/settings.json`):
```json
{
  "statusLine": {
    "type": "command",
    "command": "node /path/to/hud/index.js"
  }
}
```

**Data Flow**:
1. Claude Code pipes JSON to the statusline command via **stdin**
2. The command renders output to **stdout** (multiple lines supported)
3. Claude Code displays the output in the terminal statusline area
4. This happens approximately every 300ms during active sessions

**Stdin JSON Schema** (from `~/.claude/plugins/cache/claude-hud/claude-hud/0.0.6/dist/stdin.js`):
```typescript
interface StatuslineStdin {
  // Transcript path for parsing conversation history
  transcript_path: string;

  // Current working directory
  cwd: string;

  // Model information
  model: {
    id: string;
    display_name: string;  // "Opus", "Sonnet", etc.
  };

  // Context window metrics (v2.1.6+)
  context_window: {
    context_window_size: number;      // Total tokens available
    used_percentage?: number;         // Native percentage (preferred)
    current_usage?: {
      input_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
  };
}
```

**Transcript Format** (JSONL - one JSON object per line):
```jsonl
{"timestamp":"2025-01-19T...","message":{"content":[{"type":"tool_use","id":"toolu_123","name":"Task","input":{...}}]}}
{"timestamp":"2025-01-19T...","message":{"content":[{"type":"tool_result","tool_use_id":"toolu_123",...}]}}
```

**Output Format**:
- Multiple lines to stdout
- ANSI escape codes supported for colors
- Spaces replaced with non-breaking spaces (`\u00A0`) for alignment
- Each line printed via `console.log()`

---

## Reference Implementation: claude-hud

The claude-hud plugin is installed locally at:
```
~/.claude/plugins/cache/claude-hud/claude-hud/0.0.6/dist/
```

**Key files to reference:**
| File | Purpose | Location |
|------|---------|----------|
| `stdin.js` | Parse stdin JSON, extract context % | `dist/stdin.js` lines 2-21 |
| `transcript.js` | Parse JSONL for tools/agents/todos | `dist/transcript.js` lines 3-40 |
| `render/index.js` | Compose statusline output | `dist/render/index.js` lines 70-87 |
| `render/colors.js` | ANSI color utilities | `dist/render/colors.js` |

**Stdin parsing pattern** (from `dist/stdin.js` lines 2-21):
```javascript
export async function readStdin() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = chunks.join('');
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}
```

**Context percentage extraction** (from `dist/stdin.js` lines 39-52):
```javascript
export function getContextPercent(stdin) {
  // Prefer native percentage (v2.1.6+)
  const native = stdin.context_window?.used_percentage;
  if (typeof native === 'number' && !Number.isNaN(native)) {
    return Math.min(100, Math.max(0, Math.round(native)));
  }
  // Fallback: manual calculation
  const size = stdin.context_window?.context_window_size;
  if (!size || size <= 0) return 0;
  const totalTokens = getTotalTokens(stdin);
  return Math.min(100, Math.round((totalTokens / size) * 100));
}
```

---

## State File Location Decision

**Decision**: Use **both** local `.sisyphus/` AND global `~/.claude/` (following existing pattern)

**Rationale** (from `src/hooks/ultrawork-state/index.ts` lines 105-121):
- Local `.sisyphus/hud-state.json` for project-specific state
- Global `~/.claude/hud-state.json` for cross-session persistence
- This matches the established pattern for ultrawork-state and ralph-state

**HUD State File Paths**:
- Primary: `{cwd}/.sisyphus/hud-state.json`
- Fallback: `~/.claude/hud-state.json`

---

## Display Format

### Focused Mode (Default)
```
[SISYPHUS] ralph:3/10 | US-002 | ultrawork | ctx:67% | agents:2 | bg:3/5 | todos:2/5
```

### Element Breakdown
| Element | Source | Description |
|---------|--------|-------------|
| `[SISYPHUS]` | Static | Mode identifier |
| `ralph:3/10` | `.sisyphus/ralph-state.json` | Ralph iteration/max |
| `US-002` | `.sisyphus/prd.json` | Current PRD story |
| `ultrawork` | `.sisyphus/ultrawork-state.json` | Active skill |
| `ctx:67%` | stdin.context_window | Context window usage |
| `agents:2` | Transcript parsing | Active subagents count |
| `bg:3/5` | HUD state | Background task slots |
| `todos:2/5` | Transcript parsing | Todo completion |

### Presets
- **Minimal**: `[SISYPHUS] ralph | ultrawork | todos:2/5`
- **Focused**: Full display above
- **Full**: Add model, git ahead/behind, duration, quota

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Claude Code                                   │
│   Pipes stdin JSON every ~300ms with transcript_path, cwd, model     │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ stdin (JSON)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     sisyphus-hud/index.ts                            │
│  1. Parse stdin JSON                                                  │
│  2. Parse transcript JSONL for tools/agents/todos                    │
│  3. Read .sisyphus/*.json for ralph/ultrawork state                  │
│  4. Compose statusline elements                                       │
│  5. Output to stdout                                                  │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ stdout (ANSI lines)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Terminal Statusline                               │
│  [SISYPHUS] ralph:3/10 | US-002 | ultrawork | ctx:67% | todos:2/5   │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Sources

| Data | Source | Method |
|------|--------|--------|
| Context % | `stdin.context_window.used_percentage` | Direct from stdin |
| Model name | `stdin.model.display_name` | Direct from stdin |
| Active agents | `stdin.transcript_path` → JSONL parsing | Count `tool_use` where `name=Task` without matching `tool_result` |
| Todos | `stdin.transcript_path` → JSONL parsing | Latest `TodoWrite` input |
| Ralph state | `.sisyphus/ralph-state.json` | File read |
| Ultrawork state | `.sisyphus/ultrawork-state.json` | File read |
| PRD story | `.sisyphus/prd.json` | File read |
| Background tasks | `.sisyphus/hud-state.json` | File read (populated by hooks) |

---

## HUD State Schema

```typescript
// src/hud/types.ts

export interface SisyphusHudState {
  timestamp: string;

  // Background tasks (populated by PreToolUse/PostToolUse hooks)
  backgroundTasks: {
    id: string;
    description: string;
    agentType?: string;
    startedAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'failed';
  }[];
}

// Note: Ralph/Ultrawork state is read directly from existing files
// Note: Agents/Todos are parsed from transcript (like claude-hud does)
```

---

## Implementation Phases

### Phase 1: Core Infrastructure

**Files to create:**
- `src/hud/index.ts` - Main entry point (statusline command)
- `src/hud/types.ts` - TypeScript interfaces
- `src/hud/state.ts` - HUD state read/write functions
- `src/hud/stdin.ts` - Parse stdin JSON from Claude Code

**Tasks:**
1. Create `src/hud/types.ts` with `SisyphusHudState` interface
2. Create `src/hud/state.ts` with `readHudState()`, `writeHudState()` following pattern from `src/hooks/ultrawork-state/index.ts` lines 76-121
3. Create `src/hud/stdin.ts` to parse stdin JSON (copy pattern from `~/.claude/plugins/cache/claude-hud/claude-hud/0.0.6/dist/stdin.js` lines 2-21)
4. Create `src/hud/index.ts` main entry point that reads stdin and outputs placeholder

**Done When:**
- [ ] `bun run src/hud/index.ts` accepts stdin JSON and outputs `[SISYPHUS] initializing...`
- [ ] `readHudState()` returns null when no state file exists
- [ ] `writeHudState()` creates `.sisyphus/hud-state.json` successfully
- [ ] Unit tests pass for stdin parsing with mock data

---

### Phase 2: Transcript Parsing

**Files to create:**
- `src/hud/transcript.ts` - Parse transcript JSONL for agents/todos

**Tasks:**
1. Implement `parseTranscript(path: string)` following pattern from `~/.claude/plugins/cache/claude-hud/claude-hud/0.0.6/dist/transcript.js` lines 3-40
2. Track active agents: `tool_use` with `name=Task` without matching `tool_result`
3. Track todos: Extract latest `TodoWrite` input
4. Return `{ agents: Agent[], todos: Todo[], sessionStart: Date }`

**Done When:**
- [ ] `parseTranscript()` correctly counts running agents from sample JSONL
- [ ] `parseTranscript()` extracts todo list from latest `TodoWrite` entry
- [ ] Handles empty/missing transcript gracefully (returns empty arrays)
- [ ] Unit tests pass with mock JSONL data

---

### Phase 3: Sisyphus State Reading

**Files to create:**
- `src/hud/sisyphus-state.ts` - Read ralph/ultrawork/prd state

**Tasks:**
1. Create `readRalphStateForHud()` - reads `.sisyphus/ralph-state.json`
2. Create `readUltraworkStateForHud()` - reads `.sisyphus/ultrawork-state.json`
3. Create `readPrdStateForHud()` - reads `.sisyphus/prd.json`
4. Each function returns typed state or null

**Integration Points** (existing files to reference, NOT modify):
- Ralph state schema: `src/hooks/ralph-loop/index.ts` lines 47-66 (`RalphLoopState` interface)
- Ultrawork state schema: `src/hooks/ultrawork-state/index.ts` lines 13-26 (`UltraworkState` interface)
- PRD schema: `src/hooks/ralph-prd/index.ts` lines 22-37 (`UserStory` interface) and lines 39-48 (`PRD` interface)

**Done When:**
- [ ] `readRalphStateForHud()` returns `{ active, iteration, maxIterations }` or null
- [ ] `readUltraworkStateForHud()` returns `{ active, reinforcementCount }` or null
- [ ] `readPrdStateForHud()` returns `{ currentStoryId, completed, total }` or null
- [ ] All functions handle missing/corrupt files gracefully

---

### Phase 4: Statusline Rendering

**Files to create:**
- `src/hud/render.ts` - Main render function
- `src/hud/elements/index.ts` - Element exports
- `src/hud/elements/ralph.ts` - Ralph loop display
- `src/hud/elements/agents.ts` - Agent count
- `src/hud/elements/todos.ts` - Todo progress
- `src/hud/elements/skills.ts` - Active skills badge
- `src/hud/elements/context.ts` - Context window bar
- `src/hud/colors.ts` - ANSI color utilities

**Tasks:**
1. Create color utilities with `green()`, `yellow()`, `red()`, `dim()`, `reset()` (reference `~/.claude/plugins/cache/claude-hud/claude-hud/0.0.6/dist/render/colors.js`)
2. Implement element renderers that return string or null
3. Implement `render()` that composes elements with `|` separator
4. Replace spaces with `\u00A0` and output via `console.log()` (see claude-hud `dist/render/index.js` line 84)

**Display Logic:**
```typescript
// ralph.ts
export function renderRalph(state: RalphState | null): string | null {
  if (!state?.active) return null;
  const color = state.iteration >= 7 ? red : state.iteration >= 4 ? yellow : green;
  return `ralph:${color(`${state.iteration}/${state.maxIterations}`)}`;
}
```

**Done When:**
- [ ] `render()` outputs single line with all elements joined by `|`
- [ ] Elements return null when inactive (omitted from output)
- [ ] Colors change based on thresholds (green→yellow→red)
- [ ] Output looks like: `[SISYPHUS] ralph:3/10 | ultrawork | ctx:67% | todos:2/5`

---

### Phase 5: Main Entry Point Integration

**Files to modify:**
- `src/hud/index.ts` - Wire everything together

**Tasks:**
1. Read stdin JSON
2. Parse transcript for agents/todos
3. Read Sisyphus state files
4. Compose render context
5. Call render and output

**Done When:**
- [ ] `echo '{"transcript_path":"/tmp/test.jsonl","cwd":"/tmp"}' | bun run src/hud/index.ts` outputs formatted statusline
- [ ] Works with real Claude Code session (manual test)
- [ ] Handles all error cases gracefully (missing transcript, corrupt state)

---

### Phase 6: Hook Integration for Background Tasks

**Files to modify:**
- `src/hooks/bridge.ts` - Add HUD state updates for Task tool

**Integration Point** (specific location):
- File: `src/hooks/bridge.ts`
- Location: Lines 381-387 (the `pre-tool-use` and `post-tool-use` case handlers)
- Current state: These handlers are stubs that return `{ continue: true }`

**Hook Data Flow:**
```
Claude Code → shell hook script → hook-bridge.mjs → bridge.ts processHook()
```

The `HookInput` interface (lines 38-60) includes:
- `toolName?: string` - Name of the tool being invoked (e.g., "Task")
- `toolInput?: unknown` - Tool input parameters (for Task: `{ description, subagent_type, ... }`)
- `toolOutput?: unknown` - Tool output (for post-tool hooks)
- `directory?: string` - Working directory

**Example hook input for Task tool:**
```json
{
  "sessionId": "abc123",
  "toolName": "Task",
  "toolInput": {
    "description": "Search codebase",
    "subagent_type": "oh-my-claude-sisyphus:explore",
    "prompt": "Find all TypeScript files"
  },
  "directory": "/home/user/project"
}
```

**Tasks:**
1. In `bridge.ts` line 381-383: Replace stub with logic to check if `toolName === 'Task'`, then call `addBackgroundTask(input.toolInput.id, input.toolInput.description)`
2. In `bridge.ts` line 385-387: Replace stub with logic to check if `toolName === 'Task'`, then call `completeBackgroundTask(input.toolInput.id)`
3. Create `src/hud/background-tasks.ts` with:
   - `addBackgroundTask(id: string, description: string, agentType?: string): void`
   - `completeBackgroundTask(id: string): void`
   - Both functions read/write to `.sisyphus/hud-state.json`

**Done When:**
- [ ] Starting a Task adds entry to `.sisyphus/hud-state.json`
- [ ] Completing a Task marks entry as completed
- [ ] Background task count shows in HUD: `bg:3/5`

---

### Phase 7: Configuration System

**Files to create:**
- `src/hud/config.ts` - Configuration management
- `commands/hud.md` - /hud command

**Tasks:**
1. Create config schema with presets (minimal/focused/full)
2. Store config in `~/.claude/.sisyphus/hud-config.json`
3. Create `/hud` command for status/configure

**Config Schema:**
```typescript
interface HudConfig {
  preset: 'minimal' | 'focused' | 'full';
  elements: {
    sisyphusLabel: boolean;
    ralph: boolean;
    prdStory: boolean;
    activeSkills: boolean;
    contextBar: boolean;
    agents: boolean;
    backgroundTasks: boolean;
    todos: boolean;
  };
  thresholds: {
    contextWarning: number;  // default: 70
    contextCritical: number; // default: 85
    ralphWarning: number;    // default: 7
  };
}
```

**Done When:**
- [ ] `/hud` shows current HUD status
- [ ] `/hud minimal` switches to minimal preset
- [ ] `/hud focused` switches to focused preset
- [ ] Config persists across sessions

---

### Phase 8: Installation Integration

**Files to modify:**
- `src/installer/index.ts` - Add HUD setup

**Integration Point:**
- File: `src/installer/index.ts`
- Function: `install()` at line 2609
- Location: After hooks are installed (lines 2741-2779 handle settings.json)
- Action: Add statusLine config alongside existing hooks configuration

**Tasks:**
1. Add `installHud()` function that:
   - Checks if `existingSettings.statusLine` is already configured (line 2746-2750)
   - If not, adds our HUD command to settings.json
   - If yes (another HUD), warns user and skips
2. Call `installHud()` after hooks configuration (around line 2779)

**Settings.json Update:**
```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/hud/sisyphus-hud.js"
  }
}
```

**Done When:**
- [ ] Fresh install adds statusLine config to settings.json
- [ ] Existing statusLine config is NOT overwritten (warns instead)
- [ ] `~/.claude/hud/sisyphus-hud.js` is copied during install
- [ ] Uninstall removes HUD config

---

## File Structure

```
src/hud/
├── index.ts              # Main entry point (statusline command)
├── types.ts              # TypeScript interfaces
├── state.ts              # HUD state management
├── stdin.ts              # Parse stdin JSON from Claude Code
├── transcript.ts         # Parse transcript JSONL
├── sisyphus-state.ts     # Read ralph/ultrawork/prd state
├── config.ts             # Configuration system
├── render.ts             # Main render function
├── colors.ts             # ANSI color utilities
├── background-tasks.ts   # Background task tracking
└── elements/
    ├── index.ts          # Element exports
    ├── ralph.ts          # Ralph loop display
    ├── agents.ts         # Agent orchestration
    ├── background.ts     # Background tasks
    ├── skills.ts         # Active skills
    ├── context.ts        # Context window
    └── todos.ts          # Todo progress

commands/
└── hud.md                # /hud command
```

---

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| Statusline API changes | Version check in installer; graceful fallback |
| Hook failures break HUD | HUD reads state files directly; hooks only update bg tasks |
| Performance impact | Single-pass transcript parsing; cache state file reads |
| Terminal width overflow | Calculate total width; hide lower-priority elements |
| State file corruption | JSON.parse in try/catch; return null on error |

---

## Success Criteria

1. **Accurate State Display**
   - [ ] Ralph iteration matches `.sisyphus/ralph-state.json`
   - [ ] Ultrawork badge shows when ultrawork-state.json has `active: true`
   - [ ] Agent count matches running Task tools in transcript
   - [ ] Todo count matches latest TodoWrite in transcript

2. **Performance**
   - [ ] HUD renders in <50ms
   - [ ] No visible lag in Claude Code

3. **Cross-Platform**
   - [ ] Works on Linux (primary)
   - [ ] Works on macOS
   - [ ] Works on Windows (with Node.js)

4. **Reliability**
   - [ ] Missing files don't crash HUD
   - [ ] Corrupt JSON doesn't crash HUD
   - [ ] Empty transcript shows reasonable defaults

5. **Installation**
   - [ ] Auto-installs with oh-my-claude-sisyphus
   - [ ] Doesn't overwrite existing statusLine config
   - [ ] Clean uninstall removes HUD

---

## Dependencies

- Node.js 18+ (bundled with Claude Code)
- No external npm dependencies (uses Node.js built-ins only)
- Reuses existing oh-my-claude-sisyphus state file patterns

---

## Next Steps

1. Approve this revised plan
2. Start Phase 1: Core Infrastructure
3. Implement incrementally with testing at each phase
