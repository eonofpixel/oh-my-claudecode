# Work Plan: OpenCode UX Integration

**Created:** 2026-01-20
**Revised:** 2026-01-20 (Momus Round 3 - All 5 issues addressed with complete code)
**Status:** Ready for Implementation
**Source:** Research of OpenCode (sst/opencode) terminal UI patterns

---

## Executive Summary

Integrate proven UX patterns from OpenCode into the oh-my-claude-sisyphus HUD system. Focus on patterns that enhance information density, provide better status feedback, and improve the overall developer experience within Claude Code's statusline constraints.

---

## Research Findings

### OpenCode UX Strengths

| Pattern | OpenCode Implementation | Value Proposition |
|---------|------------------------|-------------------|
| **Agent Mode Indicator** | Tab to switch between `build` and `plan` modes, visual indicator in corner | Clear context about current operational mode |
| **Permission Indicators** | Shows when agent needs approval for actions | Transparency about what AI can/cannot do |
| **Session Management** | `/sessions` command, session sharing, `/compact` | Context awareness and collaboration |
| **File Reference Syntax** | `@filename` fuzzy search with autocomplete | Quick file context inclusion |
| **Command Shorthand** | `!` prefix for bash, `/` for commands, `@` for files | Efficient terminal interaction |
| **Details Toggle** | `/details` to show/hide tool execution details | Information density control |
| **Thinking Display** | `/thinking` to toggle reasoning blocks | Transparency into AI reasoning |
| **Keybinding System** | `ctrl+x` leader key with discoverable commands | Power-user efficiency |
| **Stats Display** | Token usage and cost metrics via `stats` command | Resource awareness |

### OpenCode Agent System

| Agent | Purpose | Permission Level |
|-------|---------|------------------|
| **build** | Full development capability | Full tool access |
| **plan** | Analysis and exploration | Read-only, asks before edits |
| **general** | Complex searches, multi-step tasks | Subagent via `@general` |
| **explore** | File/code exploration | Limited tool access |

### Current Sisyphus HUD Elements

| Element | Current Display | Location |
|---------|-----------------|----------|
| Mode Label | `[SISYPHUS]` | Prefix |
| Rate Limits | `5h:45% wk:12%` | After label |
| Ralph Loop | `ralph:3/10` | Status section |
| PRD Progress | `US-002` | Status section |
| Active Skills | `ultrawork` or `skill:prometheus` | Status section |
| Context Usage | `ctx:67%` | Metrics section |
| Active Agents | Multi-line with codes/descriptions | Detail section |
| Background Tasks | `bg:3/5` | Metrics section |
| Todos | `todos:2/5` | Progress section |

---

## Gap Analysis

### What OpenCode Has That We Could Adopt

| OpenCode Feature | Our Equivalent | Gap | Priority |
|------------------|----------------|-----|----------|
| Mode indicator (build/plan) | Active skills badge | Have similar - could enhance | LOW |
| Token/cost stats | Rate limits display | Already implemented | DONE |
| Session management UI | None | Outside HUD scope | OUT OF SCOPE |
| Compact indicator | Context % | Could add visual warning | MEDIUM |
| Details toggle | Agent format presets | Already configurable | DONE |
| Thinking toggle | None | Could show extended thinking | MEDIUM |
| Keybinding discoverability | `/hud help` exists | Could enhance | LOW |
| Progress bars | Context bar exists | Could add more bars | LOW |
| Permission status | None | Would require heuristic-based detection | HIGH |

### Highest-Value Integrations

1. **Permission Status Indicator** - Show when tool approval is likely pending (heuristic-based)
2. **Extended Thinking Indicator** - Show when AI is using extended thinking mode
3. **Session Duration/Health** - Show session age and health metrics
4. **Compact Warning** - More prominent context pressure warning
5. **Agent Mode Labels** - Clearer mode descriptions (building/planning/analyzing)

---

## Guardrails

### Must Have

- All new elements must be configurable (on/off in HUD config)
- No breaking changes to existing HUD config schema
- Performance: HUD must render in <100ms
- All new elements follow existing color conventions
- Backward compatibility with existing presets

### Must NOT Have

- Full TUI implementation (out of scope - we only have statusline)
- Session management features (outside HUD responsibility)
- Interactive elements (statusline is display-only)
- Features requiring changes to Claude Code core
- External dependencies

### Explicit Scope Boundaries

| In Scope | Out of Scope |
|----------|--------------|
| Statusline elements | Full TUI panels |
| Display patterns | Interactive commands |
| Color/visual hierarchy | Keybinding systems |
| Information density options | Session management |
| Configurable presets | File reference syntax |

---

## Prerequisite: Type and Interface Updates

**CRITICAL**: Before implementing any TODO, these type updates MUST be applied first.

### types.ts Interface Additions

#### 1. Add `PendingPermission` interface (after `SkillInvocation` interface, line 78):

```typescript
export interface PendingPermission {
  toolName: string;       // "Edit", "Bash", etc. (proxy_ prefix stripped)
  targetSummary: string;  // "src/main.ts" or "npm install"
  timestamp: Date;
}
```

#### 2. Add `ThinkingState` interface (after `PendingPermission`):

```typescript
export interface ThinkingState {
  active: boolean;
  lastSeen?: Date;
}
```

#### 3. Add `SessionHealth` interface (after `ThinkingState`):

```typescript
export interface SessionHealth {
  durationMinutes: number;
  messageCount: number;
  health: 'healthy' | 'warning' | 'critical';
}
```

#### 4. Update `TranscriptData` interface (line 80-85, add three new fields):

```typescript
export interface TranscriptData {
  agents: ActiveAgent[];
  todos: TodoItem[];
  sessionStart?: Date;
  lastActivatedSkill?: SkillInvocation;
  pendingPermission?: PendingPermission;  // NEW
  thinkingState?: ThinkingState;          // NEW
}
```

#### 5. Update `HudRenderContext` interface (line 121-154, add three fields after `rateLimits`):

```typescript
export interface HudRenderContext {
  /** Context window percentage (0-100) */
  contextPercent: number;

  /** Model display name */
  modelName: string;

  /** Ralph loop state */
  ralph: RalphStateForHud | null;

  /** Ultrawork state */
  ultrawork: UltraworkStateForHud | null;

  /** PRD state */
  prd: PrdStateForHud | null;

  /** Active subagents from transcript */
  activeAgents: ActiveAgent[];

  /** Todo list from transcript */
  todos: TodoItem[];

  /** Background tasks from HUD state */
  backgroundTasks: BackgroundTask[];

  /** Working directory */
  cwd: string;

  /** Last activated skill from transcript */
  lastSkill: SkillInvocation | null;

  /** Rate limits (5h and weekly) */
  rateLimits: RateLimits | null;

  /** Pending permission state (heuristic-based) */
  pendingPermission: PendingPermission | null;  // NEW

  /** Extended thinking state */
  thinkingState: ThinkingState | null;  // NEW

  /** Session health metrics */
  sessionHealth: SessionHealth | null;  // NEW
}
```

#### 6. Update `HudElementConfig` interface (line 174-187, add three fields after `todos`):

```typescript
export interface HudElementConfig {
  sisyphusLabel: boolean;
  rateLimits: boolean;  // Show 5h and weekly rate limits
  ralph: boolean;
  prdStory: boolean;
  activeSkills: boolean;
  lastSkill: boolean;
  contextBar: boolean;
  agents: boolean;
  agentsFormat: AgentsFormat;
  agentsMaxLines: number;  // Max agent detail lines for multiline format (default: 5)
  backgroundTasks: boolean;
  todos: boolean;
  permissionStatus: boolean;  // NEW - Show pending permission indicator
  thinking: boolean;          // NEW - Show extended thinking indicator
  sessionHealth: boolean;     // NEW - Show session health/duration
}
```

#### 7. Update `HudThresholds` interface (line 189-196, add `contextCompactSuggestion`):

```typescript
export interface HudThresholds {
  /** Context percentage that triggers warning color (default: 70) */
  contextWarning: number;
  /** Context percentage that triggers compact suggestion (default: 80) */
  contextCompactSuggestion: number;  // NEW
  /** Context percentage that triggers critical color (default: 85) */
  contextCritical: number;
  /** Ralph iteration that triggers warning color (default: 7) */
  ralphWarning: number;
}
```

#### 8. Update `DEFAULT_HUD_CONFIG` (line 204-225):

```typescript
export const DEFAULT_HUD_CONFIG: HudConfig = {
  preset: 'focused',
  elements: {
    sisyphusLabel: true,
    rateLimits: true,
    ralph: true,
    prdStory: true,
    activeSkills: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'multiline',
    agentsMaxLines: 5,
    backgroundTasks: true,
    todos: true,
    lastSkill: true,
    permissionStatus: true,   // NEW - enabled by default
    thinking: true,           // NEW - enabled by default
    sessionHealth: true,      // NEW - enabled by default
  },
  thresholds: {
    contextWarning: 70,
    contextCompactSuggestion: 80,  // NEW
    contextCritical: 85,
    ralphWarning: 7,
  },
};
```

#### 9. Update `PRESET_CONFIGS` (line 227-270, add new fields to all presets):

```typescript
export const PRESET_CONFIGS: Record<HudPreset, Partial<HudElementConfig>> = {
  minimal: {
    sisyphusLabel: true,
    rateLimits: true,
    ralph: true,
    prdStory: false,
    activeSkills: true,
    lastSkill: true,
    contextBar: false,
    agents: true,
    agentsFormat: 'count',
    agentsMaxLines: 0,
    backgroundTasks: false,
    todos: true,
    permissionStatus: false,  // NEW - off in minimal
    thinking: false,          // NEW - off in minimal
    sessionHealth: false,     // NEW - off in minimal
  },
  focused: {
    sisyphusLabel: true,
    rateLimits: true,
    ralph: true,
    prdStory: true,
    activeSkills: true,
    lastSkill: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'multiline',
    agentsMaxLines: 3,
    backgroundTasks: true,
    todos: true,
    permissionStatus: true,   // NEW
    thinking: true,           // NEW
    sessionHealth: true,      // NEW
  },
  full: {
    sisyphusLabel: true,
    rateLimits: true,
    ralph: true,
    prdStory: true,
    activeSkills: true,
    lastSkill: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'multiline',
    agentsMaxLines: 10,
    backgroundTasks: true,
    todos: true,
    permissionStatus: true,   // NEW
    thinking: true,           // NEW
    sessionHealth: true,      // NEW
  },
};
```

---

## Implementation TODOs

### TODO 1: Permission Status Indicator (HIGH PRIORITY)

**Objective:** Show when Claude Code is likely waiting for user approval to execute a tool.

**IMPORTANT LIMITATION:** Claude Code's transcript JSONL does NOT expose a dedicated "permission pending" state. This implementation uses a **best-effort heuristic** based on:
1. Tool type filtering - only certain tools require permission
2. Recency threshold - tool_use without tool_result within N milliseconds

**Files to modify:**
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/types.ts` - Add interfaces and config (see Prerequisite section)
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/transcript.ts` - Detect likely permission-pending tools
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/permission.ts` - NEW: Render permission status
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/index.ts` - Export new renderer
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/render.ts` - Integrate permission element
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/index.ts` - Populate context field

**Display format:**
```
[SISYPHUS] ... | APPROVE? edit:src/main.ts | ...
```

**Implementation:**

#### Step 1a: Add imports and constants to transcript.ts (lines 1-21)

Replace the current import line (line 15) and add constants after line 21:

```typescript
// Line 15: Update import to include PendingPermission
import type { TranscriptData, ActiveAgent, TodoItem, SkillInvocation, PendingPermission } from './types.js';

// After line 21, add these constants:

/**
 * Tools known to require permission approval in Claude Code.
 * Only these tools will trigger the "APPROVE?" indicator.
 */
const PERMISSION_TOOLS = [
  'Edit', 'Write', 'Bash',
  'proxy_Edit', 'proxy_Write', 'proxy_Bash'
] as const;

/**
 * Time threshold for considering a tool "pending approval".
 * If tool_use exists without tool_result within this window, show indicator.
 */
const PERMISSION_THRESHOLD_MS = 3000; // 3 seconds

/**
 * Module-level map tracking pending permission-requiring tools.
 * Key: tool_use block id, Value: PendingPermission info
 * Cleared when tool_result is received for the corresponding tool_use.
 */
const pendingPermissionMap = new Map<string, PendingPermission>();
```

#### Step 1b: Add helper function to transcript.ts (after line 169, before processEntry)

```typescript
/**
 * Extract a human-readable target summary from tool input.
 */
function extractTargetSummary(input: unknown, toolName: string): string {
  if (!input || typeof input !== 'object') return '...';
  const inp = input as Record<string, unknown>;

  // Edit/Write: show file path
  if (toolName.includes('Edit') || toolName.includes('Write')) {
    const filePath = inp.file_path as string | undefined;
    if (filePath) {
      // Return just the filename or last path segment
      const segments = filePath.split('/');
      return segments[segments.length - 1] || filePath;
    }
  }

  // Bash: show first 20 chars of command
  if (toolName.includes('Bash')) {
    const cmd = inp.command as string | undefined;
    if (cmd) {
      const trimmed = cmd.trim().substring(0, 20);
      return trimmed.length < cmd.trim().length ? `${trimmed}...` : trimmed;
    }
  }

  return '...';
}
```

#### Step 1c: Track permission-requiring tools in processEntry (lines 192-250)

Inside the `for (const block of content)` loop, after the existing `if (block.name === 'Skill' || block.name === 'proxy_Skill')` block (around line 249), add:

```typescript
      // Track tool_use for permission-requiring tools
      if (PERMISSION_TOOLS.includes(block.name as typeof PERMISSION_TOOLS[number])) {
        pendingPermissionMap.set(block.id, {
          toolName: block.name.replace('proxy_', ''),
          targetSummary: extractTargetSummary(block.input, block.name),
          timestamp: timestamp
        });
      }
```

#### Step 1d: Clear pending permission on tool_result (lines 252-298)

Inside the `if (block.type === 'tool_result' && block.tool_use_id)` block (line 253), add at the very beginning (line 254):

```typescript
      // Clear from pending permissions when tool_result arrives
      pendingPermissionMap.delete(block.tool_use_id);
```

#### Step 1e: Add post-processing in parseTranscript (before line 104 `result.todos = latestTodos;`)

```typescript
  // Check for pending permissions within threshold
  const now = Date.now();
  for (const [id, permission] of pendingPermissionMap) {
    const age = now - permission.timestamp.getTime();
    if (age <= PERMISSION_THRESHOLD_MS) {
      result.pendingPermission = permission;
      break; // Only show most recent
    }
  }
```

#### Step 1f: Create permission.ts element

Create `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/permission.ts`:

```typescript
/**
 * Sisyphus HUD - Permission Status Element
 *
 * Renders heuristic-based permission pending indicator.
 */

import type { PendingPermission } from '../types.js';
import { RESET } from '../colors.js';

// Local color constants (following context.ts pattern)
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

/**
 * Render permission pending indicator.
 *
 * Format: APPROVE? edit:filename.ts
 */
export function renderPermission(pending: PendingPermission | null): string | null {
  if (!pending) return null;
  return `${YELLOW}APPROVE?${RESET} ${DIM}${pending.toolName.toLowerCase()}${RESET}:${pending.targetSummary}`;
}
```

#### Step 1g: Update elements/index.ts exports (line 14)

Add after line 14:

```typescript
export { renderPermission } from './permission.js';
```

#### Step 1h: Update render.ts imports and integration

**Import addition (line 16):**

```typescript
import { renderPermission } from './elements/permission.js';
```

**Integration in render function (after line 35, after rateLimits rendering):**

```typescript
  // Permission status indicator (heuristic-based)
  if (enabledElements.permissionStatus && context.pendingPermission) {
    const permission = renderPermission(context.pendingPermission);
    if (permission) elements.push(permission);
  }
```

#### Step 1i: Update index.ts context building (lines 58-70)

Add after line 69 (`rateLimits,`):

```typescript
      pendingPermission: transcriptData.pendingPermission || null,
```

**Known Limitations:**
- False positives: May briefly show "APPROVE?" for auto-approved tools
- False negatives: Cannot detect permission state if tool_result arrives very quickly
- This is a best-effort heuristic, not a reliable state indicator

**Acceptance Criteria:**
- [ ] Shows "APPROVE?" when Edit/Write/Bash tool pending for >3 seconds
- [ ] Disappears when tool_result is received
- [ ] Shows tool name and target summary
- [ ] Yellow color for visibility
- [ ] Only triggers for PERMISSION_TOOLS, not all tools

---

### TODO 2: Extended Thinking Indicator (MEDIUM PRIORITY)

**Objective:** Show when Claude is using extended thinking mode.

**Files to modify:**
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/types.ts` - Add interface (see Prerequisite section)
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/transcript.ts` - Detect thinking blocks in response
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/thinking.ts` - NEW: Render thinking indicator
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/index.ts` - Export new renderer
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/render.ts` - Integrate thinking element
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/index.ts` - Populate context field

**Display format:**
```
[SISYPHUS] ... | thinking | ...
```

**Implementation:**

#### Step 2a: Add THINKING_PART_TYPES constant to transcript.ts (after PERMISSION constants)

```typescript
/**
 * Content block types that indicate extended thinking mode.
 * These are the `type` field values in transcript content blocks.
 */
const THINKING_PART_TYPES = ['thinking', 'reasoning'] as const;

/**
 * Time threshold for considering thinking "active".
 * Thinking seen within this window is displayed.
 */
const THINKING_RECENCY_MS = 30_000; // 30 seconds
```

#### Step 2b: Detect thinking blocks in processEntry (inside `for (const block of content)` loop, line 192)

Add at the beginning of the loop (after line 192):

```typescript
    // Check if this is a thinking block
    if (THINKING_PART_TYPES.includes(block.type as typeof THINKING_PART_TYPES[number])) {
      result.thinkingState = {
        active: true,
        lastSeen: timestamp
      };
    }
```

#### Step 2c: Add recency check in parseTranscript (before the final return, around line 106)

```typescript
  // Determine if thinking is currently active based on recency
  if (result.thinkingState?.lastSeen) {
    const age = Date.now() - result.thinkingState.lastSeen.getTime();
    result.thinkingState.active = age <= THINKING_RECENCY_MS;
  }
```

#### Step 2d: Create thinking.ts element

Create `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/thinking.ts`:

```typescript
/**
 * Sisyphus HUD - Thinking Indicator Element
 *
 * Renders extended thinking mode indicator.
 */

import type { ThinkingState } from '../types.js';
import { RESET } from '../colors.js';

// Local color constants (following context.ts pattern)
const CYAN = '\x1b[36m';

/**
 * Render thinking indicator.
 *
 * Format: thinking
 */
export function renderThinking(state: ThinkingState | null): string | null {
  if (!state?.active) return null;
  return `${CYAN}thinking${RESET}`;
}
```

#### Step 2e: Update elements/index.ts exports

Add after permission export:

```typescript
export { renderThinking } from './thinking.js';
```

#### Step 2f: Update render.ts imports and integration

**Import addition:**

```typescript
import { renderThinking } from './elements/thinking.js';
```

**Integration in render function (after permission status, around line 40):**

```typescript
  // Extended thinking indicator
  if (enabledElements.thinking && context.thinkingState) {
    const thinking = renderThinking(context.thinkingState);
    if (thinking) elements.push(thinking);
  }
```

#### Step 2g: Update index.ts context building

Add after `pendingPermission`:

```typescript
      thinkingState: transcriptData.thinkingState || null,
```

**Acceptance Criteria:**
- [ ] Shows "thinking" when thinking/reasoning block detected recently
- [ ] Uses `type: "thinking"` or `type: "reasoning"` detection (NOT XML tags)
- [ ] Cyan color to distinguish from other states
- [ ] Configurable via HUD config

---

### TODO 3: Session Health Indicator (MEDIUM PRIORITY)

**Objective:** Show session duration and health metrics (like OpenCode's stats).

**Files to modify:**
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/types.ts` - Add interface (see Prerequisite section)
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/session.ts` - NEW: Render session health
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/index.ts` - Export new renderer
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/render.ts` - Integrate session element and calculate health
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/index.ts` - Populate context field

**Display format:**
```
[SISYPHUS] ... | session:45m | ...
```

**Implementation:**

#### Step 3a: **USE EXISTING `sessionStart` FIELD**

The `TranscriptData` interface already has `sessionStart` (line 83 in types.ts):
```typescript
export interface TranscriptData {
  agents: ActiveAgent[];
  todos: TodoItem[];
  sessionStart?: Date;  // <-- ALREADY EXISTS (line 83)
  lastActivatedSkill?: SkillInvocation;
}
```

The field is already populated in transcript.ts (lines 184-187):
```typescript
// Set session start time from first entry
if (!result.sessionStart && entry.timestamp) {
  result.sessionStart = timestamp;
}
```

**No changes needed to transcript.ts for session health.**

#### Step 3b: Add helper function to render.ts (after imports, before render function)

```typescript
import type { SessionHealth } from './types.js';

/**
 * Calculate session health from session start time and context usage.
 */
function calculateSessionHealth(
  sessionStart: Date | undefined,
  contextPercent: number
): SessionHealth | null {
  if (!sessionStart) return null;

  const durationMs = Date.now() - sessionStart.getTime();
  const durationMinutes = Math.floor(durationMs / 60_000);

  let health: SessionHealth['health'] = 'healthy';
  if (durationMinutes > 120 || contextPercent > 85) {
    health = 'critical';
  } else if (durationMinutes > 60 || contextPercent > 70) {
    health = 'warning';
  }

  return { durationMinutes, messageCount: 0, health };
}
```

#### Step 3c: Create session.ts element

Create `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/session.ts`:

```typescript
/**
 * Sisyphus HUD - Session Health Element
 *
 * Renders session duration and health indicator.
 */

import type { SessionHealth } from '../types.js';
import { RESET } from '../colors.js';

// Local color constants (following context.ts pattern)
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

/**
 * Render session health indicator.
 *
 * Format: session:45m or session:45m (healthy)
 */
export function renderSession(session: SessionHealth | null): string | null {
  if (!session) return null;

  const color = session.health === 'critical' ? RED
    : session.health === 'warning' ? YELLOW
    : GREEN;

  return `session:${color}${session.durationMinutes}m${RESET}`;
}
```

#### Step 3d: Update elements/index.ts exports

Add after thinking export:

```typescript
export { renderSession } from './session.js';
```

#### Step 3e: Update render.ts imports and integration

**Import addition:**

```typescript
import { renderSession } from './elements/session.js';
```

**Integration in render function (after thinking indicator):**

```typescript
  // Session health indicator
  if (enabledElements.sessionHealth && context.sessionHealth) {
    const session = renderSession(context.sessionHealth);
    if (session) elements.push(session);
  }
```

#### Step 3f: Update index.ts context building

The sessionHealth needs to be calculated from the existing `transcriptData.sessionStart`. Update index.ts as follows.

**Add import at top:**
```typescript
import type { HudRenderContext, SessionHealth } from './types.js';
```

**Add helper function before main():**
```typescript
/**
 * Calculate session health from session start time and context usage.
 */
function calculateSessionHealth(
  sessionStart: Date | undefined,
  contextPercent: number
): SessionHealth | null {
  if (!sessionStart) return null;

  const durationMs = Date.now() - sessionStart.getTime();
  const durationMinutes = Math.floor(durationMs / 60_000);

  let health: SessionHealth['health'] = 'healthy';
  if (durationMinutes > 120 || contextPercent > 85) {
    health = 'critical';
  } else if (durationMinutes > 60 || contextPercent > 70) {
    health = 'warning';
  }

  return { durationMinutes, messageCount: 0, health };
}
```

**Add to context building (lines 58-70), after `thinkingState`:**

```typescript
      sessionHealth: calculateSessionHealth(transcriptData.sessionStart, getContextPercent(stdin)),
```

**Acceptance Criteria:**
- [ ] Shows session duration in minutes using existing `sessionStart` field
- [ ] Color-coded by health status
- [ ] Configurable via HUD config

---

### TODO 4: Context Pressure Warning (MEDIUM PRIORITY)

**Objective:** More prominent warning when context is filling up (like OpenCode's compact prompt).

**Files to modify:**
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/context.ts` - Enhance with warning messages
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/types.ts` - Add `contextCompactSuggestion` threshold (see Prerequisite section)

**Display format:**
At 70%: `ctx:70%` (yellow, uses existing `contextWarning` threshold)
At 80%: `ctx:80% COMPRESS?` (yellow, uses new `contextCompactSuggestion` threshold)
At 85%: `ctx:85% CRITICAL` (red, uses existing `contextCritical` threshold)

**Implementation:**

#### Step 4a: Update `renderContext` in context.ts

Replace the entire content of `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/context.ts`:

```typescript
/**
 * Sisyphus HUD - Context Element
 *
 * Renders context window usage display with pressure warnings.
 */

import type { HudThresholds } from '../types.js';
import { RESET } from '../colors.js';

// Local color constants (following existing pattern in this file)
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

/**
 * Render context window percentage with pressure warnings.
 *
 * Format: ctx:67% or ctx:80% COMPRESS? or ctx:85% CRITICAL
 */
export function renderContext(
  percent: number,
  thresholds: HudThresholds
): string | null {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
  let color: string;
  let suffix = '';

  if (safePercent >= thresholds.contextCritical) {
    color = RED;
    suffix = ' CRITICAL';
  } else if (safePercent >= thresholds.contextCompactSuggestion) {
    color = YELLOW;
    suffix = ' COMPRESS?';
  } else if (safePercent >= thresholds.contextWarning) {
    color = YELLOW;
  } else {
    color = GREEN;
  }

  return `ctx:${color}${safePercent}%${suffix}${RESET}`;
}
```

**Acceptance Criteria:**
- [ ] Shows "COMPRESS?" at configurable `contextCompactSuggestion` threshold (default: 80%)
- [ ] Shows "CRITICAL" at existing `contextCritical` threshold (default: 85%)
- [ ] Uses appropriate colors (yellow for COMPRESS?, red for CRITICAL)
- [ ] Threshold is configurable separate from `contextWarning`

---

### Complete render.ts After All Changes

Here is the complete render.ts file after integrating TODOs 1, 2, and 3:

```typescript
/**
 * Sisyphus HUD - Main Renderer
 *
 * Composes statusline output from render context.
 */

import type { HudRenderContext, HudConfig } from './types.js';
import { bold, dim } from './colors.js';
import { renderRalph } from './elements/ralph.js';
import { renderAgentsByFormat, renderAgentsMultiLine } from './elements/agents.js';
import { renderTodos } from './elements/todos.js';
import { renderSkills, renderLastSkill } from './elements/skills.js';
import { renderContext } from './elements/context.js';
import { renderBackground } from './elements/background.js';
import { renderPrd } from './elements/prd.js';
import { renderRateLimits } from './elements/limits.js';
import { renderPermission } from './elements/permission.js';
import { renderThinking } from './elements/thinking.js';
import { renderSession } from './elements/session.js';

/**
 * Render the complete statusline (single or multi-line)
 */
export function render(context: HudRenderContext, config: HudConfig): string {
  const elements: string[] = [];
  const detailLines: string[] = [];
  const { elements: enabledElements } = config;

  // [SISYPHUS] label
  if (enabledElements.sisyphusLabel) {
    elements.push(bold('[SISYPHUS]'));
  }

  // Rate limits (5h and weekly)
  if (enabledElements.rateLimits && context.rateLimits) {
    const limits = renderRateLimits(context.rateLimits);
    if (limits) elements.push(limits);
  }

  // Permission status indicator (heuristic-based)
  if (enabledElements.permissionStatus && context.pendingPermission) {
    const permission = renderPermission(context.pendingPermission);
    if (permission) elements.push(permission);
  }

  // Extended thinking indicator
  if (enabledElements.thinking && context.thinkingState) {
    const thinking = renderThinking(context.thinkingState);
    if (thinking) elements.push(thinking);
  }

  // Session health indicator
  if (enabledElements.sessionHealth && context.sessionHealth) {
    const session = renderSession(context.sessionHealth);
    if (session) elements.push(session);
  }

  // Ralph loop state
  if (enabledElements.ralph && context.ralph) {
    const ralph = renderRalph(context.ralph, config.thresholds);
    if (ralph) elements.push(ralph);
  }

  // PRD story
  if (enabledElements.prdStory && context.prd) {
    const prd = renderPrd(context.prd);
    if (prd) elements.push(prd);
  }

  // Active skills (ultrawork, etc.) + last skill
  if (enabledElements.activeSkills) {
    const skills = renderSkills(
      context.ultrawork,
      context.ralph,
      (enabledElements.lastSkill ?? true) ? context.lastSkill : null
    );
    if (skills) elements.push(skills);
  }

  // Standalone last skill element (if activeSkills disabled but lastSkill enabled)
  if ((enabledElements.lastSkill ?? true) && !enabledElements.activeSkills) {
    const lastSkillElement = renderLastSkill(context.lastSkill);
    if (lastSkillElement) elements.push(lastSkillElement);
  }

  // Context window
  if (enabledElements.contextBar) {
    const ctx = renderContext(context.contextPercent, config.thresholds);
    if (ctx) elements.push(ctx);
  }

  // Active agents - handle multi-line format specially
  if (enabledElements.agents) {
    const format = enabledElements.agentsFormat || 'codes';

    if (format === 'multiline') {
      // Multi-line mode: get header part and detail lines
      const maxLines = enabledElements.agentsMaxLines || 5;
      const result = renderAgentsMultiLine(context.activeAgents, maxLines);
      if (result.headerPart) elements.push(result.headerPart);
      detailLines.push(...result.detailLines);
    } else {
      // Single-line mode: standard format
      const agents = renderAgentsByFormat(context.activeAgents, format);
      if (agents) elements.push(agents);
    }
  }

  // Background tasks
  if (enabledElements.backgroundTasks) {
    const bg = renderBackground(context.backgroundTasks);
    if (bg) elements.push(bg);
  }

  // Todos
  if (enabledElements.todos) {
    const todos = renderTodos(context.todos);
    if (todos) elements.push(todos);
  }

  // Compose output
  const headerLine = elements.join(dim(' | '));

  // If we have detail lines, output multi-line
  if (detailLines.length > 0) {
    return [headerLine, ...detailLines].join('\n');
  }

  return headerLine;
}
```

---

### Complete index.ts After All Changes

Here is the complete index.ts file after integrating TODOs 1, 2, and 3:

```typescript
#!/usr/bin/env node
/**
 * Sisyphus HUD - Main Entry Point
 *
 * Statusline command that visualizes oh-my-claude-sisyphus state.
 * Receives stdin JSON from Claude Code and outputs formatted statusline.
 */

import { readStdin, getContextPercent, getModelName } from './stdin.js';
import { parseTranscript } from './transcript.js';
import { readHudState, readHudConfig, getRunningTasks } from './state.js';
import {
  readRalphStateForHud,
  readUltraworkStateForHud,
  readPrdStateForHud,
} from './sisyphus-state.js';
import { getUsage } from './usage-api.js';
import { render } from './render.js';
import type { HudRenderContext, SessionHealth } from './types.js';

/**
 * Calculate session health from session start time and context usage.
 */
function calculateSessionHealth(
  sessionStart: Date | undefined,
  contextPercent: number
): SessionHealth | null {
  if (!sessionStart) return null;

  const durationMs = Date.now() - sessionStart.getTime();
  const durationMinutes = Math.floor(durationMs / 60_000);

  let health: SessionHealth['health'] = 'healthy';
  if (durationMinutes > 120 || contextPercent > 85) {
    health = 'critical';
  } else if (durationMinutes > 60 || contextPercent > 70) {
    health = 'warning';
  }

  return { durationMinutes, messageCount: 0, health };
}

/**
 * Main HUD entry point
 */
async function main(): Promise<void> {
  try {
    // Read stdin from Claude Code
    const stdin = await readStdin();

    if (!stdin) {
      // No stdin - output placeholder
      console.log('[SISYPHUS] waiting...');
      return;
    }

    const cwd = stdin.cwd || process.cwd();

    // Parse transcript for agents and todos
    const transcriptData = await parseTranscript(stdin.transcript_path);

    // Read Sisyphus state files
    const ralph = readRalphStateForHud(cwd);
    const ultrawork = readUltraworkStateForHud(cwd);
    const prd = readPrdStateForHud(cwd);

    // Read HUD state for background tasks
    const hudState = readHudState(cwd);
    const backgroundTasks = hudState?.backgroundTasks || [];

    // Read configuration
    const config = readHudConfig();

    // Fetch rate limits from OAuth API (if available)
    const rateLimits = config.elements.rateLimits !== false
      ? await getUsage()
      : null;

    // Get context percent for reuse
    const contextPercent = getContextPercent(stdin);

    // Build render context
    const context: HudRenderContext = {
      contextPercent,
      modelName: getModelName(stdin),
      ralph,
      ultrawork,
      prd,
      activeAgents: transcriptData.agents.filter((a) => a.status === 'running'),
      todos: transcriptData.todos,
      backgroundTasks: getRunningTasks(hudState),
      cwd,
      lastSkill: transcriptData.lastActivatedSkill || null,
      rateLimits,
      pendingPermission: transcriptData.pendingPermission || null,
      thinkingState: transcriptData.thinkingState || null,
      sessionHealth: calculateSessionHealth(transcriptData.sessionStart, contextPercent),
    };

    // Render and output
    const output = render(context, config);

    // Replace spaces with non-breaking spaces for terminal alignment
    const formattedOutput = output.replace(/ /g, '\u00A0');
    console.log(formattedOutput);
  } catch (error) {
    // On any error, show minimal fallback
    console.log('[SISYPHUS] error');
  }
}

// Run main
main();
```

---

### Complete elements/index.ts After All Changes

```typescript
/**
 * Sisyphus HUD - Element Exports
 *
 * Re-export all element renderers for convenient imports.
 */

export { renderRalph } from './ralph.js';
export { renderAgents } from './agents.js';
export { renderTodos } from './todos.js';
export { renderSkills, renderLastSkill } from './skills.js';
export { renderContext } from './context.js';
export { renderBackground } from './background.js';
export { renderPrd } from './prd.js';
export { renderRateLimits, renderRateLimitsCompact } from './limits.js';
export { renderPermission } from './permission.js';
export { renderThinking } from './thinking.js';
export { renderSession } from './session.js';
```

---

### TODO 5: Agent Mode Labels (LOW PRIORITY)

**Objective:** More descriptive agent mode labels (inspired by OpenCode's build/plan modes).

**Current:** `ultrawork` / `ralph`
**Enhanced:** `building` / `planning` / `analyzing` / `executing`

**Files to modify:**
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/skills.ts` - Add mode label mapping

**Display format:**
```
[SISYPHUS] building | ... | todos:2/5
```

**Implementation:**
1. Add skill-to-mode mapping:
   ```typescript
   const SKILL_MODE_LABELS: Record<string, string> = {
     'ultrawork': 'building',
     'ralph-loop': 'executing',
     'prometheus': 'planning',
     'analyze': 'analyzing',
     'deepsearch': 'searching',
     'review': 'reviewing',
   };
   ```

2. Option to use friendly labels instead of skill names

**Acceptance Criteria:**
- [ ] Optional friendly mode labels
- [ ] Configurable via `useFriendlyModeLabels` in config
- [ ] Fallback to skill name if no mapping

---

### TODO 6: Agent Detail Enhancements (LOW PRIORITY)

**Objective:** Improve agent detail display with OpenCode-inspired patterns.

**Current multi-line format:**
```
agents:3
  O oracle     2m   analyzing architecture patterns...
  e explore    45s  searching for test files
  s sj-junior  1m   implementing validation logic
```

**Enhanced format (inspired by OpenCode's agent display):**
```
agents:3
  O oracle     [analyzing]    2m   architecture patterns
  e explore    [searching]    45s  test files
  s sj-junior  [building]     1m   validation logic
```

**Changes:**
1. Add semantic action labels in brackets
2. Better alignment for readability
3. Truncate descriptions more intelligently

**Files to modify:**
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/agents.ts` - Enhance renderAgentsMultiLine

**Acceptance Criteria:**
- [ ] Action labels in brackets
- [ ] Better alignment
- [ ] Configurable verbosity levels

---

### TODO 7: HUD Config Presets Expansion

**Objective:** Add OpenCode-inspired preset configurations.

**New presets:**

```typescript
export const PRESET_CONFIGS: Record<HudPreset, Partial<HudElementConfig>> = {
  // ... existing presets (already updated in Prerequisite section) ...

  'opencode': {
    // Inspired by OpenCode's information density
    sisyphusLabel: true,
    rateLimits: false,  // OpenCode doesn't show rate limits prominently
    ralph: true,
    prdStory: false,
    activeSkills: true,
    lastSkill: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'codes',  // Compact like OpenCode
    agentsMaxLines: 0,
    backgroundTasks: false,
    todos: true,
    permissionStatus: true,   // OpenCode-inspired
    sessionHealth: true,      // OpenCode-inspired
    thinking: true,           // OpenCode-inspired
  },

  'dense': {
    // Maximum information density
    sisyphusLabel: true,
    rateLimits: true,
    ralph: true,
    prdStory: true,
    activeSkills: true,
    lastSkill: true,
    contextBar: true,
    agents: true,
    agentsFormat: 'multiline',
    agentsMaxLines: 5,
    backgroundTasks: true,
    todos: true,
    permissionStatus: true,
    sessionHealth: true,
    thinking: true,
  },
};
```

**Note:** Adding new presets requires updating `HudPreset` type:
```typescript
export type HudPreset = 'minimal' | 'focused' | 'full' | 'opencode' | 'dense';
```

**Acceptance Criteria:**
- [ ] `opencode` preset available
- [ ] `dense` preset available
- [ ] Presets selectable via `/hud opencode`

---

## Implementation Order

| Phase | TODOs | Rationale |
|-------|-------|-----------|
| 0 | Prerequisite type updates | Required foundation for all other changes |
| 1 | TODO 4 (Context Warning) | Low complexity, high visibility improvement |
| 2 | TODO 1 (Permission Status) | High value, moderate complexity (heuristic-based) |
| 3 | TODO 2 (Thinking Indicator) | Medium value, low complexity |
| 4 | TODO 3 (Session Health) | Medium value, low complexity (uses existing sessionStart) |
| 5 | TODO 5 (Mode Labels) | Low priority enhancement |
| 6 | TODO 6 (Agent Details) | Low priority polish |
| 7 | TODO 7 (Presets) | Consolidation after other features |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Permission detection false positives | Medium | Low | Document as heuristic, tune PERMISSION_THRESHOLD_MS |
| Performance regression | Medium | High | Profile HUD render time, add timing logs |
| Visual clutter | Medium | Medium | Make everything configurable, test presets |
| Transcript parsing complexity | Low | Medium | Reuse existing patterns, add error handling |
| Breaking existing configs | Low | High | Only add new fields, use defaults for missing |
| Feature scope creep | Medium | Medium | Stick to statusline-only features |

---

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Build passes | `npm run build` exits 0 |
| TypeScript clean | `npx tsc --noEmit` exits 0 |
| Performance maintained | HUD renders in <100ms |
| All features configurable | Each new element has config flag |
| Presets work | `/hud opencode` activates new preset |
| No regressions | Existing functionality unchanged |

---

## Verification Steps

1. **Build verification:**
   ```bash
   cd /home/bellman/Workspace/oh-my-claude-sisyphus
   npm run build
   npx tsc --noEmit
   ```

2. **Manual testing:**
   - Run Claude Code with HUD enabled
   - Verify context warning appears at 80%+ (COMPRESS?)
   - Verify permission indicator shows during tool approval (for Edit/Write/Bash only)
   - Verify session duration displays correctly
   - Verify thinking indicator shows when extended thinking active
   - Test all preset configurations

3. **Performance verification:**
   - Add timing log to HUD main()
   - Verify render time <100ms

---

## Commit Strategy

| Commit | Content |
|--------|---------|
| 0 | `feat(hud): add types for permission, thinking, and session health indicators` |
| 1 | `feat(hud): add context pressure warnings with configurable contextCompactSuggestion threshold` |
| 2 | `feat(hud): add permission status indicator for Edit/Write/Bash tools (heuristic-based)` |
| 3 | `feat(hud): add extended thinking indicator using THINKING_PART_TYPES` |
| 4 | `feat(hud): add session health display using existing sessionStart field` |
| 5 | `feat(hud): add friendly mode labels option` |
| 6 | `feat(hud): enhance agent detail display alignment` |
| 7 | `feat(hud): add opencode and dense preset configurations` |

---

## Files Summary

### New Files
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/permission.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/thinking.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/session.ts`

### Modified Files
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/types.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/transcript.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/context.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/skills.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/agents.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/index.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/render.ts`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/index.ts`

### Referenced Files (read-only)
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hooks/thinking-block-validator/constants.ts` - Reference for THINKING_PART_TYPES pattern

---

## References

- [OpenCode GitHub](https://github.com/sst/opencode)
- [OpenCode Documentation](https://opencode.ai/docs)
- [OpenCode TUI Docs](https://opencode.ai/docs/tui)
- [OpenCode Agent Docs](https://opencode.ai/docs/agents)
- [Existing HUD Plan](/home/bellman/Workspace/oh-my-claude-sisyphus/.sisyphus/plans/sisyphus-hud-integration.md)
- [HUD Enhanced Visibility Plan](/home/bellman/Workspace/oh-my-claude-sisyphus/.sisyphus/plans/hud-enhanced-visibility.md)
