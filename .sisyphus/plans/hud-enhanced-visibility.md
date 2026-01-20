# Work Plan: Enhanced HUD Visibility

**Created:** 2026-01-19
**Status:** Ready for implementation

---

## Context

### Original Request
Enhance HUD visibility beyond just showing "ultrawork" and "PRD:done". The user wants:
1. Show the LAST activated skill/command (e.g., "ralph-loop", "ultraqa", "prometheus", etc.)
2. Show current session state more comprehensively
3. Make the statusline more informative about what's actually happening

### Current State Analysis

**Current HUD shows:**
- `[SISYPHUS]` label
- Ralph loop state (iteration/max)
- PRD progress (stories completed/total)
- Active skills (only "ultrawork" or "ralph" when state files have `active: true`)
- Context window percentage
- Active agents (from transcript)
- Background tasks
- Todos

**Gap identified:**
- Skills without state files (prometheus, analyze, deepsearch, ultraqa, etc.) never appear
- No visibility into which skill was last invoked
- Session state only reflects ultrawork/ralph, not broader skill usage

### Research Findings

1. **Transcript already parsed** for Task and TodoWrite tool_use blocks in `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/transcript.ts`
2. **HUD state** already has dual persistence (local `.sisyphus/hud-state.json` + global `~/.claude/hud-state.json`)
3. **Skill invocations** appear in transcript as tool_use blocks with `name: "Skill"` or `name: "proxy_Skill"` and `input.skill` containing the skill name
4. **23 trackable skills** exist in `/home/bellman/Workspace/oh-my-claude-sisyphus/commands/*.md`

### Transcript Evidence: Skill Tool Use Block Format

The Claude Code transcript (JSONL format) contains Skill invocations in this structure:

```jsonl
{"timestamp":"2026-01-19T10:30:45.123Z","message":{"content":[{"type":"tool_use","id":"toolu_01XYZ123abc","name":"Skill","input":{"skill":"prometheus","args":"some optional args"}}]}}
```

**Key fields confirmed:**
- `message.content[].type`: `"tool_use"`
- `message.content[].name`: `"Skill"` (or `"proxy_Skill"` when proxied)
- `message.content[].input.skill`: The skill name (e.g., `"prometheus"`, `"ultrawork"`, `"analyze"`)
- `message.content[].input.args`: Optional arguments string

This matches the existing transcript parsing pattern for `Task` and `TodoWrite` blocks in `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/transcript.ts` (lines 81-105).

---

## Work Objectives

### Core Objective
Enhance HUD to show the last activated skill and comprehensive session state, making it clear what Sisyphus is doing at any moment.

### Deliverables
1. **Last Skill Tracking** - Parse transcript for Skill tool invocations, display in HUD
2. **Enhanced Session State** - Show session-level information (duration, skill history)
3. **Updated Skills Element** - Render both active modes AND last invoked skill

### Definition of Done
- [ ] HUD shows last activated skill (e.g., `skill:prometheus`)
- [ ] Skills without state files (prometheus, analyze, deepsearch) appear when invoked
- [ ] Session state shows more than just ultrawork/ralph
- [ ] TypeScript compiles without errors
- [ ] Manual verification: invoke various skills and confirm HUD updates

---

## Guardrails

### Must Have
- Backward compatibility with existing HUD config
- No performance regression (transcript parsing is already done, extend it)
- Support for all 23+ skills in commands/
- Clear visual distinction between "active mode" (ultrawork) and "last skill" (prometheus)

### Must NOT Have
- Breaking changes to existing HudConfig schema
- New external dependencies
- Skills writing to state files on activation (keep detection transcript-based)
- Removal of any existing HUD elements

---

## Task Flow

```
[1. Type Definitions]
        |
        v
[2. Transcript Parser Extension]
        |
        v
[3. Skills Element Enhancement]
        |
        v
[4. Render Integration]
        |
        v
[5. Index.ts Integration]
        |
        v
[6. Verification]
```

---

## Implementation TODOs

### TODO 1: Extend Type Definitions
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/types.ts`

**Changes:**
1. Add `lastActivatedSkill` to `TranscriptData` interface:
   ```typescript
   export interface TranscriptData {
     agents: ActiveAgent[];
     todos: TodoItem[];
     sessionStart?: Date;
     lastActivatedSkill?: SkillInvocation;  // NEW
   }
   ```

2. Add new `SkillInvocation` interface:
   ```typescript
   export interface SkillInvocation {
     name: string;           // e.g., "prometheus", "ultrawork", "ralph-loop"
     args?: string;          // Optional arguments passed
     timestamp: Date;        // When it was invoked
   }
   ```

3. Add `lastSkill` to `HudRenderContext`:
   ```typescript
   export interface HudRenderContext {
     // ... existing fields ...
     lastSkill: SkillInvocation | null;  // NEW
   }
   ```

4. Add `lastSkill` to `HudElementConfig`:
   ```typescript
   export interface HudElementConfig {
     // ... existing fields ...
     lastSkill: boolean;  // NEW - default true
   }
   ```

**Acceptance Criteria:**
- [ ] TypeScript compiles without errors
- [ ] Types are exported and available to other modules

---

### TODO 2: Extend Transcript Parser
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/transcript.ts`

**Changes:**
1. Track Skill tool_use blocks in `processEntry()`:
   ```typescript
   // Add after TodoWrite handling (around line 105)
   else if (block.name === 'Skill' || block.name === 'proxy_Skill') {
     const input = block.input as SkillInput | undefined;
     if (input?.skill) {
       result.lastActivatedSkill = {
         name: input.skill,
         args: input.args,
         timestamp: timestamp,
       };
     }
   }
   ```

2. Add `SkillInput` interface:
   ```typescript
   interface SkillInput {
     skill: string;
     args?: string;
   }
   ```

3. Initialize `lastActivatedSkill` in `parseTranscript()`:
   ```typescript
   const result: TranscriptData = {
     agents: [],
     todos: [],
     lastActivatedSkill: undefined,  // NEW
   };
   ```

**Acceptance Criteria:**
- [ ] Skill invocations are detected in transcript
- [ ] Last skill is tracked (most recent wins)
- [ ] Both "Skill" and "proxy_Skill" tool names are handled

---

### TODO 3: Create Last Skill Renderer
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/skills.ts`

**Changes:**

1. **MODIFY existing type import on line 7** - Change from:
   ```typescript
   import type { UltraworkStateForHud, RalphStateForHud } from '../types.js';
   ```
   To:
   ```typescript
   import type { UltraworkStateForHud, RalphStateForHud, SkillInvocation } from '../types.js';
   ```

2. **MODIFY existing import on line 8** - Change from:
   ```typescript
   import { RESET } from '../colors.js';
   ```
   To:
   ```typescript
   import { RESET, cyan } from '../colors.js';
   ```
   **Rationale:** The colors.ts file already exports a `cyan()` helper function. Using it ensures consistency with other elements and avoids duplicate ANSI code definitions.

3. **REPLACE the entire existing `renderSkills()` function (lines 19-45)** with a new implementation that supports lastSkill.

   **IMPORTANT:** This REPLACES the entire existing `renderSkills()` function (lines 19-45). Do not attempt to augment the existing function - replace it completely with the new implementation.

   New implementation:
   ```typescript
   /**
    * Render active skill badges.
    * Returns null if no skills are active.
    *
    * Format: ultrawork or ultrawork-ralph, optionally with skill:name
    */
   export function renderSkills(
     ultrawork: UltraworkStateForHud | null,
     ralph: RalphStateForHud | null,
     lastSkill?: SkillInvocation | null
   ): string | null {
     const parts: string[] = [];

     // Active modes (existing logic)
     if (ultrawork?.active && ralph?.active) {
       parts.push(`${BRIGHT_MAGENTA}ultrawork-ralph${RESET}`);
     } else if (ultrawork?.active) {
       parts.push(`${MAGENTA}ultrawork${RESET}`);
     } else if (ralph?.active) {
       parts.push(`${MAGENTA}ralph${RESET}`);
     }

     // Last skill (if different from active mode)
     if (lastSkill && !isActiveMode(lastSkill.name, ultrawork, ralph)) {
       parts.push(cyan(`skill:${lastSkill.name}`));
     }

     return parts.length > 0 ? parts.join(' ') : null;
   }

   function isActiveMode(
     skillName: string,
     ultrawork: UltraworkStateForHud | null,
     ralph: RalphStateForHud | null
   ): boolean {
     if (skillName === 'ultrawork' && ultrawork?.active) return true;
     if (skillName === 'ralph-loop' && ralph?.active) return true;
     if (skillName === 'ultrawork-ralph' && ultrawork?.active && ralph?.active) return true;
     return false;
   }
   ```

4. **Add new `renderLastSkill()` function** (MUST be exported) - add after `renderSkills()`:
   ```typescript
   export function renderLastSkill(
     lastSkill: SkillInvocation | null
   ): string | null {
     if (!lastSkill) return null;

     // Format: skill:prometheus or skill:analyze(query)
     const skillName = lastSkill.name;
     const argsDisplay = lastSkill.args ? `(${truncate(lastSkill.args, 15)})` : '';

     return cyan(`skill:${skillName}${argsDisplay}`);
   }

   function truncate(str: string, max: number): string {
     return str.length > max ? str.slice(0, max) + '...' : str;
   }
   ```
   **Note:** The function MUST be exported so render.ts can import it.

**Acceptance Criteria:**
- [ ] Last skill renders in cyan to distinguish from active modes (magenta)
- [ ] Duplicate display avoided (don't show "skill:ultrawork" when ultrawork is already active)
- [ ] Long arguments are truncated

---

### TODO 4: Update Render Integration
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/render.ts`

**Changes:**

1. **MODIFY existing import on line 12** - Change from:
   ```typescript
   import { renderSkills } from './elements/skills.js';
   ```
   To:
   ```typescript
   import { renderSkills, renderLastSkill } from './elements/skills.js';
   ```

2. Update skills rendering section (around line 43-46) with config migration fallback:
   ```typescript
   // Active skills (ultrawork, etc.) + last skill
   if (enabledElements.activeSkills) {
     const skills = renderSkills(context.ultrawork, context.ralph, context.lastSkill);
     if (skills) elements.push(skills);
   }

   // Standalone last skill element (if activeSkills disabled but lastSkill enabled)
   // Use fallback for existing configs that lack lastSkill field
   const lastSkillEnabled = enabledElements.lastSkill ?? true;
   if (lastSkillEnabled && !enabledElements.activeSkills) {
     const lastSkillElement = renderLastSkill(context.lastSkill);
     if (lastSkillElement) elements.push(lastSkillElement);
   }
   ```

**Config Migration Handling:**
- Existing configs in `~/.claude/hud-config.json` may not have the `lastSkill` field
- Use nullish coalescing (`?? true`) to default to enabled for backward compatibility
- This ensures the feature works out-of-the-box without requiring config updates

**Acceptance Criteria:**
- [ ] Last skill integrates with existing skills display
- [ ] Configurable via `enabledElements.lastSkill`
- [ ] Existing configs without `lastSkill` field default to enabled

---

### TODO 5: Update Index.ts Integration
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/index.ts`

**Changes:**
1. Pass `lastSkill` to render context:
   ```typescript
   // Build render context
   const context: HudRenderContext = {
     contextPercent: getContextPercent(stdin),
     modelName: getModelName(stdin),
     ralph,
     ultrawork,
     prd,
     activeAgents: transcriptData.agents.filter((a) => a.status === 'running'),
     todos: transcriptData.todos,
     backgroundTasks: getRunningTasks(hudState),
     cwd,
     lastSkill: transcriptData.lastActivatedSkill || null,  // NEW
   };
   ```

**Acceptance Criteria:**
- [ ] Last skill from transcript flows to render context
- [ ] No runtime errors when lastActivatedSkill is undefined

---

### TODO 6: Update Default Config
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/types.ts`

**Changes:**

1. **Add `lastSkill: true` to `DEFAULT_HUD_CONFIG.elements`** - Insert after line 194 (`todos: true,`):
   ```typescript
   export const DEFAULT_HUD_CONFIG: HudConfig = {
     preset: 'focused',
     elements: {
       sisyphusLabel: true,
       ralph: true,
       prdStory: true,
       activeSkills: true,
       contextBar: true,
       agents: true,
       agentsFormat: 'multiline',
       agentsMaxLines: 5,
       backgroundTasks: true,
       todos: true,
       lastSkill: true,  // NEW - show last activated skill
     },
     thresholds: {
       contextWarning: 70,
       contextCritical: 85,
       ralphWarning: 7,
     },
   };
   ```

2. **Add `lastSkill: true` to `minimal` preset** (after line 214, `todos: true,`):
   ```typescript
   minimal: {
     sisyphusLabel: true,
     ralph: true,
     prdStory: false,
     activeSkills: true,
     contextBar: false,
     agents: true,
     agentsFormat: 'count',
     agentsMaxLines: 0,
     backgroundTasks: false,
     todos: true,
     lastSkill: true,  // NEW
   },
   ```

3. **Add `lastSkill: true` to `focused` preset** (after line 226, `todos: true,`):
   ```typescript
   focused: {
     sisyphusLabel: true,
     ralph: true,
     prdStory: true,
     activeSkills: true,
     contextBar: true,
     agents: true,
     agentsFormat: 'multiline',
     agentsMaxLines: 3,
     backgroundTasks: true,
     todos: true,
     lastSkill: true,  // NEW
   },
   ```

4. **Add `lastSkill: true` to `full` preset** (after line 238, `todos: true,`):
   ```typescript
   full: {
     sisyphusLabel: true,
     ralph: true,
     prdStory: true,
     activeSkills: true,
     contextBar: true,
     agents: true,
     agentsFormat: 'multiline',
     agentsMaxLines: 10,
     backgroundTasks: true,
     todos: true,
     lastSkill: true,  // NEW
   },
   ```

**Acceptance Criteria:**
- [ ] Last skill enabled by default in DEFAULT_HUD_CONFIG
- [ ] All three presets (minimal, focused, full) include `lastSkill: true`

---

### TODO 7: Verification
**Manual testing steps:**

1. Build the HUD:
   ```bash
   cd /home/bellman/Workspace/oh-my-claude-sisyphus
   npm run build
   ```

2. Verify TypeScript compiles:
   ```bash
   npx tsc --noEmit
   ```

3. Install updated HUD:
   ```bash
   npm run install-plugin
   ```

4. Test in Claude Code session:
   - Invoke `/prometheus` - verify HUD shows `skill:prometheus`
   - Invoke `/ultrawork` - verify HUD shows `ultrawork` (not duplicate `skill:ultrawork`)
   - Invoke `/analyze` - verify HUD shows `skill:analyze`
   - Invoke `/deepsearch query` - verify HUD shows `skill:deepsearch(query...)`

**Acceptance Criteria:**
- [ ] Build succeeds
- [ ] TypeScript compiles without errors
- [ ] Skills appear in HUD when invoked
- [ ] No duplicate displays for active modes

---

## Commit Strategy

### Commit 1: Type definitions
```
feat(hud): add SkillInvocation type and lastSkill to render context
```

### Commit 2: Transcript parser extension
```
feat(hud): parse Skill tool invocations from transcript
```

### Commit 3: Skills element enhancement
```
feat(hud): render last activated skill in statusline
```

### Commit 4: Integration and config
```
feat(hud): integrate lastSkill into HUD render pipeline
```

---

## Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Build passes | `npm run build` exits 0 |
| TypeScript clean | `npx tsc --noEmit` exits 0 |
| Skills visible | Invoking any skill shows it in HUD |
| No duplicates | Active modes don't double-display |
| Performance | HUD renders in <100ms (no regression) |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Transcript tool name mismatch | Medium | High | Check both "Skill" and "proxy_Skill" |
| Performance regression | Low | Medium | Extending existing parser, not adding new pass |
| Config schema breaking | Low | High | Only adding new fields, not modifying existing |
| Visual clutter | Low | Medium | Configurable via `enabledElements.lastSkill` |

---

## Files to Modify

1. `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/types.ts` - Type definitions
2. `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/transcript.ts` - Parser extension
3. `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/elements/skills.ts` - Renderer
4. `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/render.ts` - Integration
5. `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/index.ts` - Context building

---

## Notes

- The implementation extends the existing transcript parsing that already handles Task and TodoWrite
- Skill names map 1:1 with command files in `commands/*.md`
- Visual differentiation: active modes in magenta, last skill in cyan
- Future enhancement: could track skill history (last N skills) instead of just last one
