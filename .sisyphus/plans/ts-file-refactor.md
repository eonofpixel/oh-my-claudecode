# Work Plan: TypeScript File Refactor - Remove Duplication and Enable Dynamic Loading

## Context

### Original Request
Full refactor of large TypeScript files to reduce duplication and enable dynamic loading:
1. `src/agents/definitions.ts` (1594 lines) - Contains duplicate agent definitions
2. `src/installer/index.ts` (3324 lines) - Contains inline markdown strings for agents/commands
3. `src/installer/hooks.ts` (1679 lines) - Contains hook scripts as inline strings

### Current State Analysis

**Discovered Pattern**: The codebase already has the target structure partially in place:
- `/agents/*.md` - 19 agent definition files exist (oracle.md, explore.md, AND tiered variants like oracle-medium.md)
- `/commands/*.md` - 23 command definition files exist
- `/skills/*/SKILL.md` - 12 skill files exist (recently refactored)

**Source of Truth Clarification** (CRITICAL):
| Location | Role | Content |
|----------|------|---------|
| `/agents/*.md` | **SOURCE OF TRUTH** | Agent prompts with YAML frontmatter (name, description, tools, model) |
| `src/agents/definitions.ts` | **Runtime TypeScript** | Exports `AgentConfig` objects for SDK; loads from `/agents/*.md` |
| `src/agents/*.ts` (individual files) | **DEPRECATED** | Legacy individual agent files - will be REMOVED |

The `/agents/*.md` files are the canonical source. TypeScript code should load and parse these files at runtime.

**Tiered Variant Reality** (CRITICAL):
Tiered agents (oracle-medium, oracle-low, etc.) have **COMPLETELY DIFFERENT prompts** from their base agents. They are NOT simple overrides of name/model. Each tiered variant `.md` file contains:
- Tier-specific identity section
- Complexity boundaries (what they handle vs escalate)
- Tier-appropriate constraints
- Escalation protocols

Example: `oracle-medium.md` (109 lines) is NOT just `oracle.md` with a different model - it has unique sections like `<Tier_Identity>`, `<Complexity_Boundary>`, `<Escalation_Protocol>`.

**Duplication Analysis**:

| File | Lines | Issue |
|------|-------|-------|
| `src/agents/definitions.ts` | 1594 | Contains inline prompts that duplicate `/agents/*.md` files |
| `src/installer/index.ts` | 3324 | `AGENT_DEFINITIONS` (1319 lines) duplicates `/agents/*.md`; `COMMAND_DEFINITIONS` (1194 lines) duplicates `/commands/*.md`; `CLAUDE_MD_CONTENT` duplicates `docs/CLAUDE.md` |
| `src/installer/hooks.ts` | 1679 | Hook scripts as inline strings should be in template files |

**Reference Files**:
- `/agents/oracle.md` - Base agent prompt with YAML frontmatter (SOURCE OF TRUTH)
- `/agents/oracle-medium.md` - Tiered variant with DIFFERENT prompt (SOURCE OF TRUTH)
- `src/agents/types.ts` - Defines `AgentConfig`, `AgentPromptMetadata`
- `/skills/ultrawork/SKILL.md` - Example of dynamically loaded skill file

## Work Objectives

### Core Objective
Eliminate ~4500 lines of duplicate content across three files by implementing dynamic loading from existing markdown files.

### Deliverables
1. Refactored `src/agents/definitions.ts` (~300 lines target)
2. Refactored `src/installer/index.ts` (~600 lines target)
3. Refactored `src/installer/hooks.ts` (~150 lines target + external template files)
4. New utility functions for dynamic file loading (`parseAgentMd()`, `getPackageDir()`, loaders)
5. Template files for hook scripts in `/templates/hooks/`
6. Updated `package.json` `files` field to include `templates/hooks`
7. Content verification tests

### Definition of Done
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Total line count reduced by ~5000 lines
- [ ] No inline markdown content strings >100 lines remain
- [ ] Installer correctly reads from files at runtime

## Guardrails

### Must Have
- Preserve all existing functionality
- Maintain backward compatibility with plugin system (`isRunningAsPlugin()` check)
- Keep TypeScript type safety for `AgentConfig`
- Ensure installer still works during `npm postinstall`

### Must NOT Have
- No breaking changes to agent/command names
- No changes to installed file locations (`~/.claude/agents/`, etc.)
- No removal of any agent/command functionality
- No new npm dependencies

## Technical Approach

### File 1: `src/agents/definitions.ts` Refactor

**Current Structure** (1594 lines):
```typescript
// Lines 17-128: oracleAgent (inline prompt duplicating /agents/oracle.md)
// Lines 134-203: librarianAgent (inline prompt duplicating /agents/librarian.md)
// Lines 209-277: exploreAgent (inline prompt duplicating /agents/explore.md)
// ... (all agents with inline prompts)
// Lines 924-1046: Tiered variants with DIFFERENT prompts (NOT simple overrides)
// Lines 1456-1501: getAgentDefinitions() - KEEP
// Lines 1507-1594: sisyphusSystemPrompt - KEEP
```

**Target Structure** (~300 lines):
```typescript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AgentConfig, ModelType } from '../shared/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, '../../agents');

/**
 * Parse an agent .md file with YAML frontmatter into AgentConfig
 */
function parseAgentMd(filename: string): AgentConfig {
  const content = readFileSync(join(AGENTS_DIR, filename), 'utf-8');
  // Parse YAML frontmatter (between --- delimiters)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) throw new Error(`Invalid agent file: ${filename}`);

  const frontmatter = frontmatterMatch[1];
  const prompt = frontmatterMatch[2].trim();

  // Parse YAML (simple key: value extraction)
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1] ?? '';
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1] ?? '';
  const tools = frontmatter.match(/^tools:\s*(.+)$/m)?.[1]?.split(',').map(t => t.trim()) ?? [];
  const model = frontmatter.match(/^model:\s*(.+)$/m)?.[1] as ModelType ?? 'sonnet';

  return { name, description, prompt, tools, model };
}

// Load ALL agents from /agents/*.md - each file is its own complete agent
// INCLUDING tiered variants (oracle-medium.md has its OWN complete prompt)
export const oracleAgent = parseAgentMd('oracle.md');
export const oracleMediumAgent = parseAgentMd('oracle-medium.md');  // NOT a spread override!
export const oracleLowAgent = parseAgentMd('oracle-low.md');        // NOT a spread override!
// ... etc for all 19 agents

// Keep getAgentDefinitions() and sisyphusSystemPrompt
export function getAgentDefinitions(...) { ... }
export const sisyphusSystemPrompt = `...`;
```

**CRITICAL: Tiered Variants Are NOT Spread Overrides**:
Each tiered agent `.md` file (e.g., `oracle-medium.md`) contains a COMPLETE, DIFFERENT prompt:
- `oracle.md` - Full Opus-tier prompt with deep analysis workflow
- `oracle-medium.md` - Different prompt with tier identity, complexity boundaries, escalation protocols
- `oracle-low.md` - Different prompt optimized for quick lookups

DO NOT use spread operator to create tiered variants. Load each from its own `.md` file.

**Implementation Steps**:
1. Create `parseAgentMd()` utility to parse YAML frontmatter + prompt from `.md` files
2. Replace ALL inline `AgentConfig` objects with `parseAgentMd('filename.md')` calls
3. Load tiered variants from their OWN files (NOT spread from base agents)
4. Refactor `getAgentDefinitions()` to use dynamically loaded agents
5. Keep `sisyphusSystemPrompt` constant (or move to its own `.md` file)

### File 2: `src/installer/index.ts` Refactor

**Current Structure** (3324 lines):
```typescript
// Lines 116-1430: AGENT_DEFINITIONS (1319 lines of markdown)
// Lines 1435-2619: COMMAND_DEFINITIONS (1184 lines of markdown)
// Lines 2629-2972: CLAUDE_MD_CONTENT (343 lines)
// Lines 2974-3297: install() function and utilities
```

**Target Structure** (~600 lines):
```typescript
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve path relative to package root (handles both dev and installed contexts)
function getPackageDir(): string {
  // From dist/installer/index.js -> package root is ../../
  return join(__dirname, '../..');
}

// Dynamic loading at install time with existence validation
function loadAgentDefinitions(): Record<string, string> {
  const agentsDir = join(getPackageDir(), 'agents');
  if (!existsSync(agentsDir)) {
    throw new Error(`FATAL: agents/ directory not found at ${agentsDir}. Package may be corrupted.`);
  }
  const agents: Record<string, string> = {};
  for (const file of readdirSync(agentsDir).filter(f => f.endsWith('.md'))) {
    agents[file.replace('.md', '')] = readFileSync(join(agentsDir, file), 'utf-8');
  }
  return agents;
}

function loadCommandDefinitions(): Record<string, string> {
  const commandsDir = join(getPackageDir(), 'commands');
  if (!existsSync(commandsDir)) {
    throw new Error(`FATAL: commands/ directory not found at ${commandsDir}. Package may be corrupted.`);
  }
  // ... similar pattern
}

function loadClaudeMdContent(): string {
  const docsPath = join(getPackageDir(), 'docs/CLAUDE.md');
  if (!existsSync(docsPath)) {
    throw new Error(`FATAL: docs/CLAUDE.md not found at ${docsPath}. Package may be corrupted.`);
  }
  return readFileSync(docsPath, 'utf-8');
}

// install() function remains, but uses loaded content
export function install(options: InstallOptions = {}): InstallResult {
  const AGENT_DEFINITIONS = loadAgentDefinitions();
  const COMMAND_DEFINITIONS = loadCommandDefinitions();
  const CLAUDE_MD_CONTENT = loadClaudeMdContent();
  // ... rest of install logic
}
```

**Fallback Strategy** (CRITICAL):
- **NO silent fallbacks** - if files don't exist, the package is corrupted
- Throw clear error with the expected path for debugging
- This is a HARD REQUIREMENT because the content is essential for functionality
- The package.json `files` field ensures these directories are published

**Implementation Steps**:
1. Create `getPackageDir()` to resolve package root from `dist/installer/index.js`
2. Create `loadAgentDefinitions()` that reads from `/agents/*.md` files with existence check
3. Create `loadCommandDefinitions()` that reads from `/commands/*.md` files with existence check
4. Create `loadClaudeMdContent()` that reads from `/docs/CLAUDE.md` with existence check
5. Add clear FATAL error messages (no silent fallbacks)
6. Modify `install()` to call these loaders
7. Remove all inline `AGENT_DEFINITIONS`, `COMMAND_DEFINITIONS`, `CLAUDE_MD_CONTENT`

### File 3: `src/installer/hooks.ts` Refactor

**Current Structure** (1679 lines):
```typescript
// Lines 63-154: ULTRAWORK_MESSAGE
// Lines 160-176: ULTRATHINK_MESSAGE
// Lines 182-192: SEARCH_MESSAGE
// Lines 198-214: ANALYZE_MESSAGE
// Lines 220-226: TODO_CONTINUATION_PROMPT
// Lines 232-334: KEYWORD_DETECTOR_SCRIPT (bash)
// Lines 341-381: STOP_CONTINUATION_SCRIPT (bash)
// Lines 392-590: KEYWORD_DETECTOR_SCRIPT_NODE
// Lines 597-677: STOP_CONTINUATION_SCRIPT_NODE
// Lines 687-859: PERSISTENT_MODE_SCRIPT (bash)
// Lines 865-927: SESSION_START_SCRIPT (bash)
// Lines 932-1171: PERSISTENT_MODE_SCRIPT_NODE
// Lines 1176-1276: SESSION_START_SCRIPT_NODE
// Lines 1286-1376: POST_TOOL_USE_SCRIPT (bash)
// Lines 1382-1515: POST_TOOL_USE_SCRIPT_NODE
// Lines 1520-1680: Settings config exports
```

**Target Structure** (~100 lines + template files):
```typescript
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function loadTemplate(name: string): string {
  const templatesDir = join(dirname(fileURLToPath(import.meta.url)), '../../templates/hooks');
  return readFileSync(join(templatesDir, name), 'utf-8');
}

// Export functions that load from templates
export function getKeywordDetectorScript(): string {
  return shouldUseNodeHooks()
    ? loadTemplate('keyword-detector.mjs')
    : loadTemplate('keyword-detector.sh');
}

// ... similar for other scripts

// Keep utility functions and settings config
export function isWindows(): boolean { ... }
export function shouldUseNodeHooks(): boolean { ... }
export function getHooksSettingsConfig() { ... }
```

**New Template Files** (create in `/templates/hooks/`):
- `keyword-detector.sh`
- `keyword-detector.mjs`
- `stop-continuation.sh`
- `stop-continuation.mjs`
- `persistent-mode.sh`
- `persistent-mode.mjs`
- `session-start.sh`
- `session-start.mjs`
- `post-tool-use.sh`
- `post-tool-use.mjs`

**Implementation Steps**:
1. Create `/templates/hooks/` directory
2. Extract each hook script to its own file
3. Create `loadTemplate()` utility function
4. Refactor exports to load from templates
5. Remove inline script strings

## Task Breakdown

### Phase 1: Setup and Verification (Prerequisites)

**TODO 1.1**: Verify all prerequisite files exist
- Acceptance: All 19 agent .md files in `/agents/` confirmed
- Acceptance: All 23 command .md files in `/commands/` confirmed
- Acceptance: `docs/CLAUDE.md` exists
- Files: `/agents/*.md`, `/commands/*.md`, `/docs/CLAUDE.md`

**TODO 1.2**: Create templates directory structure
- Acceptance: `/templates/hooks/` directory created
- Files: `/templates/hooks/`

### Phase 1.5: Agent Frontmatter Migration (CRITICAL BLOCKER)

**Context**: The `parseAgentMd()` function in Phase 4 requires all agent .md files to have a `tools:` field in their YAML frontmatter. Currently:
- 8 tiered variants HAVE `tools:` field (oracle-medium.md, oracle-low.md, explore-medium.md, etc.)
- 11 base agents LACK `tools:` field (oracle.md, explore.md, librarian.md, etc.)

Without this migration, `parseAgentMd()` will produce `AgentConfig` objects with empty `tools` arrays.

**Current Field Mapping** (from `definitions.ts` to `.md` frontmatter):

| Agent File | Tools Array (from definitions.ts) |
|------------|-----------------------------------|
| oracle.md | Read, Grep, Glob, Bash, WebSearch |
| librarian.md | WebSearch, WebFetch |
| explore.md | Read, Glob, Grep, Bash |
| frontend-engineer.md | Read, Edit, Write, Glob, Grep, Bash |
| sisyphus-junior.md | Read, Edit, Write, Glob, Grep, Bash, WebSearch, WebFetch |
| document-writer.md | Read, Edit, Write, Glob, Grep |
| momus.md | Read, Glob, Grep |
| metis.md | Read, Glob, Grep |
| prometheus.md | Read, Glob, Grep, WebSearch, WebFetch, Bash |
| qa-tester.md | Read, Edit, Write, Glob, Grep, Bash |
| multimodal-looker.md | Read |

**TODO 1.5.1**: Add `tools:` field to all base agent .md files
- Action: For each of the 11 base agent files, add `tools:` line to YAML frontmatter
- Acceptance: All 19 agent .md files have `tools:` field in frontmatter
- Files: `/agents/oracle.md`, `/agents/librarian.md`, `/agents/explore.md`, `/agents/frontend-engineer.md`, `/agents/sisyphus-junior.md`, `/agents/document-writer.md`, `/agents/momus.md`, `/agents/metis.md`, `/agents/prometheus.md`, `/agents/qa-tester.md`, `/agents/multimodal-looker.md`
- Reference: Use tools arrays from `src/agents/definitions.ts` lines 126, 198, 271, etc.

**TODO 1.5.2**: Verify frontmatter schema compliance
- Action: Run `grep -l "^tools:" agents/*.md | wc -l` - must return 19
- Action: Validate each .md file has ALL required fields: `name:`, `description:`, `tools:`, `model:`
- Acceptance: All 19 files have complete frontmatter
- Acceptance: No file missing any of the 4 required fields
- Command: `for f in agents/*.md; do echo "$f:"; head -6 "$f" | grep -E "^(name|description|tools|model):"; echo "---"; done`

**TODO 1.5.3**: Cross-validate tools arrays match definitions.ts
- Action: For each agent, compare tools array in .md file to tools array in definitions.ts
- Acceptance: No discrepancies between .md frontmatter and definitions.ts
- Acceptance: Test loads one agent with `parseAgentMd()` and verifies tools array is non-empty
- Note: After Phase 4, definitions.ts will load FROM .md files, making .md the single source of truth

### Phase 2: Extract Hook Templates (hooks.ts)

**TODO 2.1**: Extract bash hook scripts to template files
- Acceptance: 5 bash scripts in `/templates/hooks/*.sh`
- Acceptance: Scripts identical to current inline content
- Files: `keyword-detector.sh`, `stop-continuation.sh`, `persistent-mode.sh`, `session-start.sh`, `post-tool-use.sh`

**TODO 2.2**: Extract Node.js hook scripts to template files
- Acceptance: 5 Node.js scripts in `/templates/hooks/*.mjs`
- Acceptance: Scripts identical to current inline content
- Files: `keyword-detector.mjs`, `stop-continuation.mjs`, `persistent-mode.mjs`, `session-start.mjs`, `post-tool-use.mjs`

**TODO 2.3**: Refactor hooks.ts to use template loading
- Acceptance: hooks.ts reduced from 1679 to ~150 lines
- Acceptance: All exports still work identically
- Acceptance: `npm test` passes for hook-related tests
- Files: `src/installer/hooks.ts`

### Phase 3: Refactor installer/index.ts

**TODO 3.1**: Create file loading utility functions
- Acceptance: `loadAgentDefinitions()` reads all `/agents/*.md` files
- Acceptance: `loadCommandDefinitions()` reads all `/commands/*.md` files
- Acceptance: `loadClaudeMdContent()` reads `/docs/CLAUDE.md`
- Files: `src/installer/index.ts`

**TODO 3.2**: Remove AGENT_DEFINITIONS inline constant
- Acceptance: No `AGENT_DEFINITIONS` constant with inline markdown
- Acceptance: `install()` uses `loadAgentDefinitions()` instead
- Files: `src/installer/index.ts`

**TODO 3.3**: Remove COMMAND_DEFINITIONS inline constant
- Acceptance: No `COMMAND_DEFINITIONS` constant with inline markdown
- Acceptance: `install()` uses `loadCommandDefinitions()` instead
- Files: `src/installer/index.ts`

**TODO 3.4**: Remove CLAUDE_MD_CONTENT inline constant
- Acceptance: No `CLAUDE_MD_CONTENT` constant with inline markdown
- Acceptance: `install()` uses `loadClaudeMdContent()` instead
- Files: `src/installer/index.ts`

**TODO 3.5**: Verify installer/index.ts refactor
- Acceptance: `src/installer/index.ts` reduced from 3324 to ~600 lines
- Acceptance: `npm run build` succeeds
- Acceptance: `npm test` passes for installer tests
- Files: `src/installer/index.ts`

### Phase 4: Refactor agents/definitions.ts

**DEPENDENCY**: Phase 1.5 MUST be complete before this phase. All 19 agent .md files must have `tools:` in frontmatter.

**TODO 4.0**: Pre-flight verification (GATE CHECK)
- Action: Verify all 19 agent .md files have `tools:` field: `grep -L "^tools:" agents/*.md` should return NOTHING
- Action: If any files missing `tools:`, STOP and complete Phase 1.5 first
- Acceptance: Zero files missing `tools:` field
- Acceptance: All 4 required fields present in every .md file

**TODO 4.1**: Create `parseAgentMd()` utility function
- Acceptance: Function parses YAML frontmatter (name, description, tools, model) from `.md` files
- Acceptance: Function extracts prompt content (everything after frontmatter)
- Acceptance: Function throws clear error if `tools:` field is missing or empty
- Acceptance: Returns valid `AgentConfig` object with non-empty tools array
- Files: `src/agents/definitions.ts`

**TODO 4.2**: Load ALL agents from `/agents/*.md` files (INCLUDING tiered variants)
- Acceptance: Each of the 19 agent `.md` files is loaded via `parseAgentMd()`
- Acceptance: Tiered variants (oracle-medium.md, oracle-low.md, etc.) load their OWN complete prompts
- Acceptance: NO spread operator for tiered variants - each loads from its own file
- Acceptance: No duplicate prompt strings in definitions.ts
- Files: `src/agents/definitions.ts`
- Reference: `/agents/oracle-medium.md` has 109 lines of UNIQUE prompt content

**TODO 4.3**: Verify definitions.ts refactor
- Acceptance: `src/agents/definitions.ts` reduced from 1594 to ~300 lines
- Acceptance: `getAgentDefinitions()` still returns correct data
- Acceptance: All agent tests pass
- Files: `src/agents/definitions.ts`

### Phase 5: Package Configuration and Content Verification

**TODO 5.1**: Verify package.json `files` field includes all required directories
- Acceptance: `package.json` `files` array includes: `agents`, `commands`, `templates/hooks` (if not already)
- Acceptance: Verify with `npm pack --dry-run` that all files would be included
- Note: Current package.json already has `agents`, `commands`. May need to add `templates/hooks`.
- Files: `package.json`
- Command: `npm pack --dry-run 2>&1 | grep -E "(agents|commands|templates)"`

**TODO 5.2**: Content verification - compare dynamically loaded vs inline content
- Acceptance: Create test that loads agents via `parseAgentMd()` and compares to expected structure
- Acceptance: Verify that each of the 19 agent files produces valid `AgentConfig` objects
- Acceptance: Run installer in test mode and verify installed files match source files byte-for-byte
- Files: `src/__tests__/installer.test.ts` (add new tests)
- Command: `npm test -- --grep "dynamic loading"`

### Phase 6: Final Verification

**TODO 6.1**: Run full test suite
- Acceptance: `npm test` passes with 0 failures
- Command: `npm test`

**TODO 6.2**: Run build
- Acceptance: `npm run build` succeeds
- Command: `npm run build`

**TODO 6.3**: Verify line count reduction
- Acceptance: `definitions.ts` < 400 lines (was 1594)
- Acceptance: `installer/index.ts` < 800 lines (was 3324)
- Acceptance: `hooks.ts` < 200 lines (was 1679)
- Acceptance: Total reduction > 5000 lines
- Command: `wc -l src/agents/definitions.ts src/installer/index.ts src/installer/hooks.ts`

**TODO 6.4**: End-to-end npm pack test
- Acceptance: `npm pack` creates valid tarball
- Acceptance: Extract tarball and verify all `/agents/*.md`, `/commands/*.md`, `/templates/hooks/*` files present
- Acceptance: Install from tarball in temp directory and run installer - verify no FATAL errors
- Command: `npm pack && tar -tzf oh-my-claude-sisyphus-*.tgz | grep -E "(agents|commands|templates)"`

## Risk Identification

### Risk 0: Incomplete Agent Frontmatter (RESOLVED by Phase 1.5)
**Problem**: 11 of 19 agent .md files lack `tools:` field in YAML frontmatter
**Impact**: `parseAgentMd()` would produce `AgentConfig` objects with empty tools arrays, breaking agent functionality
**Resolution**: Phase 1.5 adds `tools:` field to all 11 base agent files BEFORE Phase 4 begins
**Verification**: `grep -L "^tools:" agents/*.md` must return no results before Phase 4
**Affected Files**: oracle.md, librarian.md, explore.md, frontend-engineer.md, sisyphus-junior.md, document-writer.md, momus.md, metis.md, prometheus.md, qa-tester.md, multimodal-looker.md

### Risk 1: File path resolution in ESM
**Problem**: `__dirname` doesn't exist in ESM, need `import.meta.url`
**Mitigation**: Use `fileURLToPath(import.meta.url)` pattern consistently
**Reference**: Already used in `src/hud/index.ts`

### Risk 2: Runtime file reading during postinstall
**Problem**: Files must exist at install time, package layout matters
**Mitigation**:
- Verify files exist before reading with `existsSync()`
- Throw FATAL error with clear path if files missing (NO silent fallbacks)
- Test with `npm pack && npm install` flow
- Package.json `files` field ensures directories are published

### Risk 3: Plugin context behavior
**Problem**: `isRunningAsPlugin()` check affects file installation
**Mitigation**: Keep existing plugin detection logic unchanged, only modify content sources

### Risk 4: Tiered agent variants have DIFFERENT prompts (RESOLVED)
**Problem**: Original plan assumed tiered variants could use spread operator from base agents
**Reality**: Tiered variants (oracle-medium.md, oracle-low.md, etc.) have COMPLETELY DIFFERENT prompts
**Resolution**: Load each tiered variant from its own `.md` file - NO spread operator
**Reference**: `/agents/oracle-medium.md` has 109 lines of unique content including `<Tier_Identity>`, `<Complexity_Boundary>`, `<Escalation_Protocol>` sections

### Risk 5: Missing files in npm package
**Problem**: If `/agents/`, `/commands/`, `/templates/hooks/` not in package, installer fails
**Mitigation**:
- Verify package.json `files` field includes all required directories
- Current status: `agents` and `commands` already in `files` array
- Action needed: Add `templates/hooks` when created
- Test with `npm pack --dry-run` before publish

## Commit Strategy

1. **Commit 1**: "refactor(hooks): extract hook scripts to template files"
   - Create `/templates/hooks/` with all script files
   - Refactor `src/installer/hooks.ts` to use template loading
   - Update `package.json` `files` to include `templates/hooks`

2. **Commit 2**: "refactor(installer): implement dynamic loading for agents/commands"
   - Add `getPackageDir()` and file loading utilities with existence validation
   - Remove inline `AGENT_DEFINITIONS`, `COMMAND_DEFINITIONS`, `CLAUDE_MD_CONTENT`
   - Add FATAL error handling (no silent fallbacks)

3. **Commit 3**: "chore(agents): add tools field to agent frontmatter"
   - Add `tools:` field to 11 base agent .md files (oracle.md, librarian.md, etc.)
   - Verify all 19 agent files have complete frontmatter (name, description, tools, model)
   - Cross-validate tools arrays match current definitions.ts

4. **Commit 4**: "refactor(agents): load all agents from /agents/*.md files"
   - Create `parseAgentMd()` utility function with frontmatter validation
   - Load ALL 19 agents from their `.md` files (including tiered variants)
   - Tiered variants load from their OWN files (NOT spread from base)
   - Remove inline prompt strings

5. **Commit 5**: "test: add content verification tests"
   - Add tests that verify dynamically loaded content matches expected structure
   - Add tests that verify installed files match source files
   - Verify npm pack includes all required directories

6. **Commit 6**: "chore: final verification and cleanup"
   - Ensure all tests pass
   - Verify line count reduction targets met
   - Run end-to-end npm pack test

## Success Criteria

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| `definitions.ts` | 1594 lines | < 400 lines | 75% reduction |
| `installer/index.ts` | 3324 lines | < 800 lines | 75% reduction |
| `hooks.ts` | 1679 lines | < 200 lines | 88% reduction |
| Total | 6597 lines | < 1400 lines | 79% reduction |
| Tests | Pass | Pass | No regressions |
| Build | Success | Success | No errors |

## References

### Source of Truth (Canonical Files)
- `/agents/oracle.md` - Base agent prompt with YAML frontmatter (77 lines)
- `/agents/oracle-medium.md` - Tiered variant with DIFFERENT prompt (109 lines)
- `/agents/oracle-low.md` - Tiered variant with DIFFERENT prompt
- `/commands/*.md` - Command definitions (23 files)
- `/docs/CLAUDE.md` - Main documentation

### TypeScript Files to Modify
- `src/agents/definitions.ts` - Will load from `/agents/*.md` instead of inline prompts
- `src/agents/types.ts` - AgentConfig type definition (keep as-is)
- `src/installer/index.ts:3037-3163` - Current install() logic to preserve
- `src/installer/hooks.ts:1520-1634` - Settings config exports to preserve

### Package Configuration
- `package.json:17-28` - `files` field (already has `agents`, `commands`, needs `templates/hooks`)

### Example Patterns
- `/skills/ultrawork/SKILL.md` - Example of dynamically loaded skill file
- `src/hud/index.ts` - Example of `fileURLToPath(import.meta.url)` usage
