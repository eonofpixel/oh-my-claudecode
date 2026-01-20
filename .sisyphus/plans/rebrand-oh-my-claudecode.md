# Work Plan: Rebrand oh-my-claude-sisyphus to oh-my-claudecode

**Plan ID:** rebrand-oh-my-claudecode
**Created:** 2026-01-20
**Status:** Ready for Execution

---

## 1. Context

### 1.1 Original Request
Rebrand the project from `oh-my-claude-sisyphus` to `oh-my-claudecode` with:
- Package name change
- Greek mythology agent names to intuitive names
- Directory structure changes (.sisyphus to .omc)
- Environment variable renames
- Documentation updates

### 1.2 Research Findings

**Affected Files Analysis:**
- Package identity files: 4
- Agent markdown files: 19 (agents/*.md)
- Agent TypeScript files: 14 (src/agents/*.ts)
- Command files: 23 (commands/*.md)
- Skill directories: 12
- Hook directories: 15+
- Script files: 17
- Template files: 10
- Documentation files: 5+
- Test files: 15+
- Source files with references: 74+

**Total Estimated Files: 147+**

### 1.3 Agent Name Mapping

| Current (Greek) | New (Intuitive) | File Renames |
|-----------------|-----------------|--------------|
| prometheus | planner | prometheus.md -> planner.md, prometheus.ts -> planner.ts |
| momus | critic | momus.md -> critic.md, momus.ts -> critic.ts |
| oracle | architect | oracle.md -> architect.md, oracle.ts -> architect.ts |
| metis | analyst | metis.md -> analyst.md, metis.ts -> analyst.ts |
| mnemosyne | learner | (hook only) mnemosyne/ -> learner/ |
| sisyphus-junior | executor | sisyphus-junior*.md -> executor*.md |
| orchestrator-sisyphus | coordinator | orchestrator-sisyphus.ts -> coordinator.ts |
| librarian | researcher | librarian.md -> researcher.md |
| explore | explore | (keep - already intuitive) |
| frontend-engineer | designer | frontend-engineer.md -> designer.md |
| document-writer | writer | document-writer.md -> writer.md |
| multimodal-looker | vision | multimodal-looker.md -> vision.md |
| qa-tester | qa-tester | (keep - already intuitive) |

---

## 2. Work Objectives

### 2.1 Core Objective
Complete rebrand from Greek mythology theme to professional, intuitive naming while maintaining all functionality.

### 2.2 Deliverables
1. All package identity files updated (package.json, plugin.json, etc.)
2. All agent files renamed and references updated
3. All runtime directories renamed (.sisyphus -> .omc)
4. All environment variables renamed (SISYPHUS_* -> OMC_*)
5. All documentation updated (README stripped of drama, AGENTS.md, CHANGELOG.md)
6. All tests passing
7. Build succeeds
8. Migration guide for existing users

### 2.3 Definition of Done
- [ ] `npm run build` succeeds with no errors
- [ ] `npm run test` passes all tests
- [ ] `npm run lint` reports no errors
- [ ] No references to old names in codebase (grep returns empty)
- [ ] README is professional without "The Saga" drama
- [ ] Migration guide exists for existing users

---

## 3. Must Have / Must NOT Have

### 3.1 MUST Have
- All Greek names replaced with intuitive names
- Package name is `oh-my-claudecode`
- npm bin is `oh-my-claudecode`
- Runtime directory is `.omc/`
- Environment prefix is `OMC_`
- All imports updated to new file names
- All internal references updated
- Backward compatibility notes for users

### 3.2 Must NOT Have
- Any remaining Greek mythology references (prometheus, momus, sisyphus, etc.)
- "The Saga" section in README
- Excessive badge decoration in README
- Old directory names in paths
- Broken imports or type errors

---

## 4. Task Flow and Dependencies

```
Phase 1: Critical - Package Identity (blocks everything)
    |
    v
Phase 2: File Renames (agents, commands, skills, hooks)
    |
    v
Phase 3: Code Updates (imports, references, prompts)
    |
    v
Phase 4: Documentation (README, AGENTS.md, CHANGELOG)
    |
    v
Phase 5: Verification (build, test, lint, grep check)
    |
    v
Phase 6: Migration Guide
```

---

## 5. Detailed TODOs

### Phase 1: Critical - Package Identity (Priority: CRITICAL)

#### TODO 1.1: Update package.json
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/package.json`
**Changes:**
- `"name": "oh-my-claude-sisyphus"` -> `"name": "oh-my-claudecode"`
- `"bin": { "oh-my-claude-sisyphus": ... }` -> `"bin": { "oh-my-claudecode": ... }`
- Update repository URL
- Update homepage URL
- Update bugs URL
- Remove "sisyphus" from keywords, add "omc", "claudecode"
- Update description

**Acceptance Criteria:**
- [ ] name field is "oh-my-claudecode"
- [ ] bin field has "oh-my-claudecode" key
- [ ] All URLs reference new repo name
- [ ] No "sisyphus" in keywords

#### TODO 1.2: Update plugin.json (root)
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/plugin.json`
**Changes:**
- `"name": "oh-my-claude-sisyphus"` -> `"name": "oh-my-claudecode"`
- Update description

**Acceptance Criteria:**
- [ ] name field is "oh-my-claudecode"

#### TODO 1.3: Update .claude-plugin/plugin.json
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/.claude-plugin/plugin.json`
**Changes:**
- All name references to new name
- Update description
- Remove "sisyphus" from keywords

**Acceptance Criteria:**
- [ ] name field is "oh-my-claudecode"
- [ ] No "sisyphus" in content

#### TODO 1.4: Update .claude-plugin/marketplace.json
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/.claude-plugin/marketplace.json`
**Changes:**
- All name references to new name
- Update homepage URL
- Remove "sisyphus" from tags

**Acceptance Criteria:**
- [ ] name field is "oh-my-claudecode"
- [ ] No "sisyphus" in content

---

### Phase 2: File Renames (Priority: HIGH)

#### TODO 2.1: Rename Agent Markdown Files
**Directory:** `/home/bellman/Workspace/oh-my-claude-sisyphus/agents/`
**Renames:**
```
prometheus.md -> planner.md
momus.md -> critic.md
oracle.md -> architect.md
oracle-low.md -> architect-low.md
oracle-medium.md -> architect-medium.md
metis.md -> analyst.md
sisyphus-junior.md -> executor.md
sisyphus-junior-low.md -> executor-low.md
sisyphus-junior-high.md -> executor-high.md
librarian.md -> researcher.md
librarian-low.md -> researcher-low.md
(explore.md - keep as-is)
(explore-medium.md - keep as-is)
frontend-engineer.md -> designer.md
frontend-engineer-low.md -> designer-low.md
frontend-engineer-high.md -> designer-high.md
document-writer.md -> writer.md
multimodal-looker.md -> vision.md
(qa-tester.md - keep as-is)
```

**Acceptance Criteria:**
- [ ] All old files no longer exist
- [ ] All new files exist with correct content
- [ ] Internal YAML frontmatter name field updated

#### TODO 2.2: Rename Agent TypeScript Files
**Directory:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/agents/`
**Renames:**
```
prometheus.ts -> planner.ts
momus.ts -> critic.ts
oracle.ts -> architect.ts
metis.ts -> analyst.ts
sisyphus-junior.ts -> executor.ts
orchestrator-sisyphus.ts -> coordinator.ts
librarian.ts -> researcher.ts
(explore.ts - keep as-is)
frontend-engineer.ts -> designer.ts
document-writer.ts -> writer.ts
multimodal-looker.ts -> vision.ts
(qa-tester.ts - keep as-is)
```

**Acceptance Criteria:**
- [ ] All old files no longer exist
- [ ] All new files exist
- [ ] Export names updated (prometheusAgent -> plannerAgent, etc.)

#### TODO 2.3: Rename Command Files
**Directory:** `/home/bellman/Workspace/oh-my-claude-sisyphus/commands/`
**Renames:**
```
sisyphus.md -> orchestrate.md (or omc.md)
sisyphus-default.md -> omc-default.md
sisyphus-default-global.md -> omc-default-global.md
prometheus.md -> planner.md
mnemosyne.md -> learner.md
```

**Acceptance Criteria:**
- [ ] All old command files no longer exist
- [ ] All new command files exist
- [ ] YAML frontmatter command names updated

#### TODO 2.3.1: Update Command Markdown Internal Content
**Files requiring internal content updates:**

**commands/mnemosyne.md -> commands/learner.md:**
| Line | Current | New |
|------|---------|-----|
| 5 | `# Mnemosyne - Skill Extraction` | `# Learner - Skill Extraction` |
| 13 | `Mnemosyne (named after the Greek goddess of memory)` | Remove Greek reference |
| 47 | `sisyphus-learned` in path | `omc-learned` |
| 48 | `.sisyphus/skills/` in path | `.omc/skills/` |
| 80 | `/mnemosyne` command reference | `/learner` |

**All renamed command files:**
- Update YAML frontmatter `name:` field
- Update internal references to other commands (e.g., `/sisyphus` -> `/omc`)
- Update internal references to agent names (e.g., `prometheus` -> `planner`)
- Update directory path references (`.sisyphus` -> `.omc`)
- Remove Greek mythology explanations/references

**Acceptance Criteria:**
- [ ] No `Mnemosyne` or `mnemosyne` in learner.md content
- [ ] No `sisyphus-learned` in any command file
- [ ] No `.sisyphus` path references in command files
- [ ] No Greek mythology explanations in command files
- [ ] All command cross-references use new names

#### TODO 2.4: Rename Skill Directories
**Directory:** `/home/bellman/Workspace/oh-my-claude-sisyphus/skills/`
**Renames:**
```
sisyphus/ -> orchestrate/
prometheus/ -> planner/
```

**Acceptance Criteria:**
- [ ] Old directories no longer exist
- [ ] New directories exist with SKILL.md files
- [ ] SKILL.md content updated with new names

#### TODO 2.5: Rename Hook Directories
**Directory:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hooks/`
**Renames:**
```
sisyphus-orchestrator/ -> omc-orchestrator/
mnemosyne/ -> learner/
```

**Acceptance Criteria:**
- [ ] Old directories no longer exist
- [ ] New directories exist
- [ ] All imports updated

#### TODO 2.5.1: Update Mnemosyne Hook Internal Content (CRITICAL)
**Directory:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hooks/mnemosyne/` (becomes `learner/`)
**Files with internal references (13 files):**

| File | Line | Content to Update |
|------|------|-------------------|
| constants.ts | 9 | `sisyphus-learned` in USER_SKILLS_DIR path -> `omc-learned` |
| constants.ts | 12 | `.sisyphus/skills` in PROJECT_SKILLS_DIR -> `.omc/skills` |
| constants.ts | 18 | `mnemosyne.enabled` feature flag -> `learner.enabled` |
| config.ts | 63 | CONFIG_PATH: `~/.claude/sisyphus/mnemosyne.json` -> `~/.claude/omc/learner.json` (BOTH directory AND filename) |
| config.ts | 92 | dir variable: `~/.claude/sisyphus` -> `~/.claude/omc` |
| index.ts | 46 | `<mnemosyne>` XML tag -> `<learner>` |
| index.ts | 67 | `<mnemosyne>` XML tag -> `<learner>` |
| index.ts | 105 | hook id `mnemosyne` -> `learner` |
| index.ts | 106 | hook source `mnemosyne` -> `learner` |
| detector.ts | 178 | `/mnemosyne` command reference -> `/learner` |
| *.ts | multiple | `console.error('[mnemosyne]'` log prefixes -> `[learner]` |

**config.ts Line 63 - Current:**
```typescript
const CONFIG_PATH = join(homedir(), '.claude', 'sisyphus', 'mnemosyne.json');
```
**config.ts Line 63 - New:**
```typescript
const CONFIG_PATH = join(homedir(), '.claude', 'omc', 'learner.json');
```

**config.ts Line 92 - Current:**
```typescript
const dir = join(homedir(), '.claude', 'sisyphus');
```
**config.ts Line 92 - New:**
```typescript
const dir = join(homedir(), '.claude', 'omc');
```

**Acceptance Criteria:**
- [ ] No `sisyphus-learned` references in hook
- [ ] No `.sisyphus/skills` references in hook
- [ ] No `mnemosyne` references in hook (XML tags, hook id, logs)
- [ ] Feature flag renamed to `learner.enabled`
- [ ] Config path renamed to `learner.json`
- [ ] Config directory renamed from `~/.claude/sisyphus` to `~/.claude/omc` (BOTH line 63 and line 92)

#### TODO 2.5.2: Rename User Skills Directory Reference
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hooks/mnemosyne/constants.ts`
**Current:** `export const USER_SKILLS_DIR = join(homedir(), '.claude', 'skills', 'sisyphus-learned');`
**New:** `export const USER_SKILLS_DIR = join(homedir(), '.claude', 'skills', 'omc-learned');`

**Decision:** Skills learned by this plugin will be stored in `~/.claude/skills/omc-learned/` instead of `~/.claude/skills/sisyphus-learned/`

**Acceptance Criteria:**
- [ ] USER_SKILLS_DIR uses `omc-learned` subdirectory
- [ ] Migration note added for existing users with `sisyphus-learned` directory

#### TODO 2.5.3: Update Hook Storage Directory Constants (Global vs Local)
**Files with SISYPHUS_STORAGE_DIR pointing to `~/.sisyphus`:**
- src/hooks/directory-readme-injector/constants.ts (line 13)
- src/hooks/rules-injector/constants.ts (line 13)
- src/hooks/agent-usage-reminder/constants.ts (line 13)

**Clarification:**
- `~/.sisyphus` (GLOBAL) -> `~/.omc` (user home directory cache)
- `.sisyphus` (LOCAL) -> `.omc` (project-local directory)

**Changes:**
| File | Current | New |
|------|---------|-----|
| directory-readme-injector/constants.ts | `~/.sisyphus` | `~/.omc` |
| rules-injector/constants.ts | `~/.sisyphus` | `~/.omc` |
| agent-usage-reminder/constants.ts | `~/.sisyphus` | `~/.omc` |

**Acceptance Criteria:**
- [ ] All global storage directories use `~/.omc`
- [ ] All project-local directories use `.omc`
- [ ] No confusion between global and local paths

#### TODO 2.6: Rename HUD State File
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/hud/sisyphus-state.ts`
**Rename to:** `omc-state.ts`

**Acceptance Criteria:**
- [ ] Old file no longer exists
- [ ] New file exists
- [ ] All imports updated

---

### Phase 3: Code Updates (Priority: HIGH)

#### TODO 3.1: Update src/agents/definitions.ts
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/agents/definitions.ts`
**Changes:**
- Update all imports to new file names
- Rename exported constants (sisyphusJuniorAgent -> executorAgent, etc.)
- Update agent name strings in configs
- Update sisyphusSystemPrompt -> omcSystemPrompt
- Update all agent descriptions and prompts

**Acceptance Criteria:**
- [ ] No import errors
- [ ] All agent names use new naming
- [ ] sisyphusSystemPrompt renamed to omcSystemPrompt

#### TODO 3.2: Update src/agents/index.ts
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/agents/index.ts`
**Changes:**
- Update all exports to new file names

**Acceptance Criteria:**
- [ ] All exports reference new file names

#### TODO 3.3: Update All Agent TypeScript Files (Internal Content)
**Files:** All renamed agent .ts files
**Changes:**
- Update exported const names
- Update internal references to other agents
- Update system prompts to remove Greek mythology references

**Acceptance Criteria:**
- [ ] No Greek names in any agent file content

#### TODO 3.4: Update Hook Index Files
**Files:**
- `src/hooks/index.ts`
- `src/hooks/bridge.ts`
- Individual hook index.ts files

**Changes:**
- Update imports for renamed hooks
- Update exports

**Acceptance Criteria:**
- [ ] No import errors
- [ ] All hook references use new names

#### TODO 3.5: Update .sisyphus Path References to .omc
**Files:** Multiple (74+ files)
**Pattern to replace:** `.sisyphus` -> `.omc`
**Files to update:**
- src/hud/sisyphus-state.ts (now omc-state.ts)
- src/hooks/sisyphus-orchestrator/ (now omc-orchestrator/)
- src/features/boulder-state/constants.ts
- src/features/boulder-state/storage.ts
- src/hooks/mnemosyne/constants.ts (now memory/)
- src/hooks/ralph-loop/index.ts
- src/hooks/ralph-prd/index.ts
- src/hooks/ralph-progress/index.ts
- src/installer/index.ts
- scripts/*.mjs, scripts/*.sh
- templates/hooks/*.mjs, *.sh
- commands/*.md (multiple)
- skills/*/SKILL.md (multiple)
- agents/*.md (internal content)

**Acceptance Criteria:**
- [ ] grep -r "\.sisyphus" returns no results (except plan files)

#### TODO 3.6: Update Environment Variable References (COMPLETE LIST)
**Pattern to replace:** `SISYPHUS_` -> `OMC_`

**Complete Environment Variable Inventory (9 variables):**
| Current | New | File Location |
|---------|-----|---------------|
| SISYPHUS_USE_NODE_HOOKS | OMC_USE_NODE_HOOKS | src/installer/hooks.ts |
| SISYPHUS_USE_BASH_HOOKS | OMC_USE_BASH_HOOKS | src/installer/hooks.ts |
| SISYPHUS_PARALLEL_EXECUTION | OMC_PARALLEL_EXECUTION | src/config/loader.ts |
| SISYPHUS_LSP_TOOLS | OMC_LSP_TOOLS | src/config/loader.ts |
| SISYPHUS_MAX_BACKGROUND_TASKS | OMC_MAX_BACKGROUND_TASKS | src/config/loader.ts |
| SISYPHUS_ROUTING_ENABLED | OMC_ROUTING_ENABLED | src/config/loader.ts |
| SISYPHUS_ROUTING_DEFAULT_TIER | OMC_ROUTING_DEFAULT_TIER | src/config/loader.ts |
| SISYPHUS_ESCALATION_ENABLED | OMC_ESCALATION_ENABLED | src/config/loader.ts |
| SISYPHUS_DEBUG | OMC_DEBUG | src/features/auto-update.ts, src/hooks/mnemosyne/constants.ts |

**Files to update:**
- src/installer/hooks.ts (SISYPHUS_USE_NODE_HOOKS, SISYPHUS_USE_BASH_HOOKS)
- src/config/loader.ts (6 env vars)
- src/features/auto-update.ts (SISYPHUS_DEBUG)
- src/hooks/mnemosyne/constants.ts (SISYPHUS_DEBUG)
- README.md (documentation)
- templates/hooks/post-tool-use.sh

**Acceptance Criteria:**
- [ ] grep -r "SISYPHUS_" returns no results
- [ ] All 9 environment variables renamed to OMC_ prefix
- [ ] All environment variables documented in README

#### TODO 3.7: Update Version File Reference
**Pattern:** `.sisyphus-version.json` -> `.omc-version.json`
**Files:**
- src/features/auto-update.ts

**Acceptance Criteria:**
- [ ] Version file path uses .omc-version.json

#### TODO 3.8: Update All TypeScript Imports
**Pattern:** Update all imports referencing renamed files
**Files:** All .ts files in src/

**Acceptance Criteria:**
- [ ] `npm run build` succeeds
- [ ] No import resolution errors

#### TODO 3.9: Update Test Files
**Directory:** `/home/bellman/Workspace/oh-my-claude-sisyphus/src/__tests__/`
**Changes:**
- Update imports
- Update test descriptions
- Update mock paths

**Acceptance Criteria:**
- [ ] `npm run test` passes

---

### Phase 4: Documentation Updates (Priority: MEDIUM)

#### TODO 4.1: Update README.md - Remove Drama, Update All References
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/README.md`
**Changes:**
- Remove "The Saga" section entirely (lines 89-99)
- Reduce badge count (keep essential: version, npm, license, node, typescript)
- Update all "oh-my-claude-sisyphus" -> "oh-my-claudecode"
- Update all agent name references (prometheus->planner, etc.)
- Update all command references (/sisyphus -> /omc, etc.)
- Update directory references (.sisyphus -> .omc)
- Update environment variable references
- Update install commands
- Update URL references
- Remove "Like Sisyphus" and similar Greek references
- Update ASCII art diagram with new names
- Update skill references
- Remove excessive emojis

**Acceptance Criteria:**
- [ ] No "Saga" section
- [ ] Maximum 6 badges
- [ ] No Greek mythology references
- [ ] All commands use new names
- [ ] Professional, clean tone

#### TODO 4.2: Update AGENTS.md
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/AGENTS.md`
**Changes:**
- Update project name references
- Update agent name table
- Update directory structure diagram
- Update all path references

**Acceptance Criteria:**
- [ ] All agent names are new names
- [ ] Directory structure shows .omc/

#### TODO 4.3: Update CHANGELOG.md
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/CHANGELOG.md`
**Changes:**
- Add entry for v3.0.0 rebrand
- Document migration steps
- Keep historical references (they were accurate at the time)

**Acceptance Criteria:**
- [ ] v3.0.0 entry documents rebrand

#### TODO 4.4: Update docs/ARCHITECTURE.md
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/docs/ARCHITECTURE.md`
**Changes:**
- Update all name references
- Update diagram if present

**Acceptance Criteria:**
- [ ] No old name references

#### TODO 4.5: Update docs/CLAUDE.md (if exists)
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/docs/CLAUDE.md`
**Changes:**
- Update all references

**Acceptance Criteria:**
- [ ] No old name references

---

### Phase 5: Verification (Priority: HIGH)

#### TODO 5.1: Build Verification
**Command:** `npm run build`

**Acceptance Criteria:**
- [ ] Exit code 0
- [ ] No TypeScript errors
- [ ] dist/ directory generated

#### TODO 5.2: Test Verification
**Command:** `npm run test:run`

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] No test failures

#### TODO 5.3: Lint Verification
**Command:** `npm run lint`

**Acceptance Criteria:**
- [ ] No lint errors

#### TODO 5.4: Grep Check - No Old Names
**Commands:**
```bash
# Package and project names
grep -r "oh-my-claude-sisyphus" --include="*.ts" --include="*.json" --include="*.md" | grep -v "CHANGELOG" | grep -v ".sisyphus/plans"

# Greek agent names
grep -r "prometheus" --include="*.ts" --include="*.md" | grep -v "CHANGELOG" | grep -v ".sisyphus/plans"
grep -r "sisyphus" --include="*.ts" --include="*.json" --include="*.md" | grep -v "CHANGELOG" | grep -v ".sisyphus/plans"
grep -r "momus" --include="*.ts" --include="*.md" | grep -v "CHANGELOG" | grep -v ".sisyphus/plans"
grep -r "mnemosyne" --include="*.ts" --include="*.md" | grep -v "CHANGELOG" | grep -v ".sisyphus/plans"
grep -r "metis" --include="*.ts" --include="*.md" | grep -v "CHANGELOG" | grep -v ".sisyphus/plans"
grep -r "oracle" --include="*.ts" --include="*.md" | grep -v "CHANGELOG" | grep -v ".sisyphus/plans"

# Directory references (local and global)
grep -r "\.sisyphus" --include="*.ts" --include="*.mjs" --include="*.sh" | grep -v ".sisyphus/plans"
grep -r "~/.sisyphus" --include="*.ts" | grep -v ".sisyphus/plans"

# Environment variables
grep -r "SISYPHUS_" --include="*.ts" --include="*.md" --include="*.sh"

# Skills directory
grep -r "sisyphus-learned" --include="*.ts" --include="*.md"

# XML tags and log prefixes
grep -r "<mnemosyne>" --include="*.ts"
grep -r "\[mnemosyne\]" --include="*.ts"
```

**Acceptance Criteria:**
- [ ] All grep commands return empty (excluding CHANGELOG and plan files)
- [ ] No SISYPHUS_ environment variable references
- [ ] No sisyphus-learned directory references
- [ ] No mnemosyne XML tags or log prefixes (now learner)

---

### Phase 6: Migration Guide (Priority: MEDIUM)

#### TODO 6.1: Create Migration Guide
**File:** `/home/bellman/Workspace/oh-my-claude-sisyphus/docs/MIGRATION-v3.md` (new file)
**Content:**
- Old name to new name mapping table (agents, commands, hooks)
- Directory migration steps:
  - Local: `.sisyphus` -> `.omc` (per-project)
  - Global: `~/.sisyphus` -> `~/.omc` (user home)
  - Skills: `~/.claude/skills/sisyphus-learned` -> `~/.claude/skills/omc-learned`
- Environment variable changes (all 9 variables):
  - SISYPHUS_USE_NODE_HOOKS -> OMC_USE_NODE_HOOKS
  - SISYPHUS_USE_BASH_HOOKS -> OMC_USE_BASH_HOOKS
  - SISYPHUS_PARALLEL_EXECUTION -> OMC_PARALLEL_EXECUTION
  - SISYPHUS_LSP_TOOLS -> OMC_LSP_TOOLS
  - SISYPHUS_MAX_BACKGROUND_TASKS -> OMC_MAX_BACKGROUND_TASKS
  - SISYPHUS_ROUTING_ENABLED -> OMC_ROUTING_ENABLED
  - SISYPHUS_ROUTING_DEFAULT_TIER -> OMC_ROUTING_DEFAULT_TIER
  - SISYPHUS_ESCALATION_ENABLED -> OMC_ESCALATION_ENABLED
  - SISYPHUS_DEBUG -> OMC_DEBUG
- Command changes (/sisyphus -> /omc, /mnemosyne -> /learner, etc.)
- Config file migration (mnemosyne.json -> learner.json)
- Feature flag changes (mnemosyne.enabled -> learner.enabled)
- Upgrade instructions for existing users

**Acceptance Criteria:**
- [ ] File exists
- [ ] Contains all name mappings
- [ ] Contains all 3 directory migration paths (local, global, skills)
- [ ] Contains all 9 environment variable changes
- [ ] Contains config and feature flag migration

---

## 6. Commit Strategy

### Commit 1: Package Identity
```
refactor: rename package from oh-my-claude-sisyphus to oh-my-claudecode

- Update package.json name, bin, and URLs
- Update plugin.json and marketplace.json
- Update .claude-plugin files
```

### Commit 2: Agent File Renames
```
refactor: rename agent files from Greek to intuitive names

- prometheus -> planner
- momus -> critic
- oracle -> architect
- metis -> analyst
- sisyphus-junior -> executor
- orchestrator-sisyphus -> coordinator
- librarian -> researcher
- explore (keep as-is)
- frontend-engineer -> designer
- document-writer -> writer
- multimodal-looker -> vision
- qa-tester (keep as-is)
```

### Commit 3: Command and Skill Renames
```
refactor: rename commands and skills to use new naming

- sisyphus commands -> omc commands
- prometheus skill -> planner skill
- mnemosyne command -> learner command
```

### Commit 4: Hook Renames
```
refactor: rename hook directories to use new naming

- sisyphus-orchestrator -> omc-orchestrator
- mnemosyne -> memory
```

### Commit 5: Code Updates
```
refactor: update all code references to new names

- Update imports across all TypeScript files
- Update agent definitions and exports
- Update system prompts
- Replace .sisyphus paths with .omc
- Replace SISYPHUS_ env vars with OMC_
```

### Commit 6: Documentation
```
docs: update documentation for rebrand

- Remove "The Saga" section from README
- Reduce badge count
- Update all name references
- Add migration guide for existing users
```

### Commit 7: Test and Build Verification
```
test: verify build and tests pass after rebrand

- All TypeScript compiles
- All tests pass
- No lint errors
```

---

## 7. Success Criteria

### Functional Criteria
- [ ] Package installs correctly as `oh-my-claudecode`
- [ ] All slash commands work with new names (/omc, /planner, etc.)
- [ ] All agents delegatable with new names (architect, planner, etc.)
- [ ] .omc/ directory created correctly at runtime
- [ ] OMC_USE_NODE_HOOKS environment variable works

### Code Quality Criteria
- [ ] Build succeeds with zero errors
- [ ] All tests pass
- [ ] Lint passes with zero errors
- [ ] No old name references in codebase (grep verified)

### Documentation Criteria
- [ ] README is professional without drama
- [ ] Migration guide exists and is complete
- [ ] CHANGELOG documents the rebrand

---

## 8. Risk Identification and Mitigations

### Risk 1: Broken Imports
**Likelihood:** High
**Impact:** Build fails
**Mitigation:** Run build after each file rename batch; use IDE rename refactoring

### Risk 2: Missing Reference Updates
**Likelihood:** Medium
**Impact:** Runtime errors
**Mitigation:** Comprehensive grep scan; test all commands manually

### Risk 3: User Confusion
**Likelihood:** Medium
**Impact:** Support burden
**Mitigation:** Clear migration guide; CHANGELOG entry; deprecation notices

### Risk 4: npm Package Name Conflict
**Likelihood:** Low
**Impact:** Cannot publish
**Mitigation:** Check npm registry for "oh-my-claudecode" availability first

### Risk 5: GitHub Repo Rename Issues
**Likelihood:** Low
**Impact:** Broken links
**Mitigation:** GitHub auto-redirects; update all documentation URLs

---

## 9. Execution Notes

### Order of Operations (CRITICAL)
1. **File renames BEFORE code updates** - Prevents import errors during transition
2. **Update definitions.ts AFTER renaming agent files** - All imports must resolve
3. **Run build AFTER each phase** - Catch issues early
4. **Update tests AFTER source updates** - Tests should test new names

### Tools to Use
- `git mv` for file renames (preserves history)
- `grep -r` for finding remaining references
- `npm run build` for TypeScript validation
- `npm run test:run` for test validation

### Parallel Execution Opportunities
- Agent markdown renames can parallel with agent TypeScript renames
- Documentation updates can parallel with code updates (after renames)

---

## Appendix A: Complete File Inventory

### Package Identity (4 files)
1. package.json
2. plugin.json
3. .claude-plugin/plugin.json
4. .claude-plugin/marketplace.json

### Agent Markdown Files (19 files)
1. agents/prometheus.md -> agents/planner.md
2. agents/momus.md -> agents/critic.md
3. agents/oracle.md -> agents/architect.md
4. agents/oracle-low.md -> agents/architect-low.md
5. agents/oracle-medium.md -> agents/architect-medium.md
6. agents/metis.md -> agents/analyst.md
7. agents/sisyphus-junior.md -> agents/executor.md
8. agents/sisyphus-junior-low.md -> agents/executor-low.md
9. agents/sisyphus-junior-high.md -> agents/executor-high.md
10. agents/librarian.md -> agents/researcher.md
11. agents/librarian-low.md -> agents/researcher-low.md
12. agents/explore.md (keep as-is)
13. agents/explore-medium.md (keep as-is)
14. agents/frontend-engineer.md -> agents/designer.md
15. agents/frontend-engineer-low.md -> agents/designer-low.md
16. agents/frontend-engineer-high.md -> agents/designer-high.md
17. agents/document-writer.md -> agents/writer.md
18. agents/multimodal-looker.md -> agents/vision.md
19. agents/qa-tester.md (keep as-is)

### Agent TypeScript Files (14 files)
1. src/agents/prometheus.ts -> src/agents/planner.ts
2. src/agents/momus.ts -> src/agents/critic.ts
3. src/agents/oracle.ts -> src/agents/architect.ts
4. src/agents/metis.ts -> src/agents/analyst.ts
5. src/agents/sisyphus-junior.ts -> src/agents/executor.ts
6. src/agents/orchestrator-sisyphus.ts -> src/agents/coordinator.ts
7. src/agents/librarian.ts -> src/agents/researcher.ts
8. src/agents/explore.ts (keep as-is)
9. src/agents/frontend-engineer.ts -> src/agents/designer.ts
10. src/agents/document-writer.ts -> src/agents/writer.ts
11. src/agents/multimodal-looker.ts -> src/agents/vision.ts
12. src/agents/qa-tester.ts (keep as-is)
13. src/agents/definitions.ts (update, no rename)
14. src/agents/index.ts (update, no rename)

### Command Files (5 renames + internal content updates)
1. commands/sisyphus.md -> commands/orchestrate.md
2. commands/sisyphus-default.md -> commands/omc-default.md
3. commands/sisyphus-default-global.md -> commands/omc-default-global.md
4. commands/prometheus.md -> commands/planner.md
5. commands/mnemosyne.md -> commands/memory.md
   - Line 5: Title update (`Mnemosyne` -> `Memory`)
   - Line 13: Remove Greek goddess reference
   - Line 47: Path update (`sisyphus-learned` -> `omc-learned`)
   - Line 48: Path update (`.sisyphus/skills/` -> `.omc/skills/`)
   - Line 80: Command reference (`/mnemosyne` -> `/memory`)
6-23. (other commands: content updates for agent names, paths, commands)

### Skill Directories (2 renames + updates)
1. skills/sisyphus/ -> skills/orchestrate/
2. skills/prometheus/ -> skills/planner/
3-12. (other skills: content updates only)

### Hook Directories (2 renames + internal updates)
1. src/hooks/sisyphus-orchestrator/ -> src/hooks/omc-orchestrator/
2. src/hooks/mnemosyne/ -> src/hooks/learner/
   - constants.ts: USER_SKILLS_DIR (`sisyphus-learned` -> `omc-learned`)
   - constants.ts: PROJECT_SKILLS_DIR (`.sisyphus/skills` -> `.omc/skills`)
   - constants.ts: feature flag (`mnemosyne.enabled` -> `learner.enabled`)
   - config.ts: config path (`mnemosyne.json` -> `learner.json`)
   - index.ts: XML tags (`<mnemosyne>` -> `<learner>`)
   - index.ts: hook id and source
   - detector.ts: command reference (`/mnemosyne` -> `/learner`)
   - All files: log prefixes (`[mnemosyne]` -> `[learner]`)
3. src/hooks/directory-readme-injector/constants.ts: SISYPHUS_STORAGE_DIR (`~/.sisyphus` -> `~/.omc`)
4. src/hooks/rules-injector/constants.ts: SISYPHUS_STORAGE_DIR (`~/.sisyphus` -> `~/.omc`)
5. src/hooks/agent-usage-reminder/constants.ts: SISYPHUS_STORAGE_DIR (`~/.sisyphus` -> `~/.omc`)

### HUD Files (1 rename)
1. src/hud/sisyphus-state.ts -> src/hud/omc-state.ts

### Scripts (content updates)
1-17. scripts/*.sh, scripts/*.mjs

### Templates (content updates)
1-10. templates/hooks/*.sh, templates/hooks/*.mjs

### Documentation (content updates)
1. README.md
2. AGENTS.md
3. CHANGELOG.md
4. docs/ARCHITECTURE.md
5. docs/CLAUDE.md

### Source Files with References (~74 files)
(See grep results for full list)

---

**END OF PLAN**

PLAN_READY: /home/bellman/Workspace/oh-my-claude-sisyphus/.sisyphus/plans/rebrand-oh-my-claudecode.md
