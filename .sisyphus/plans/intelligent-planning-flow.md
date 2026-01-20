# Work Plan: Intelligent Planning Flow Enhancement

## Context

### Original Request
User identified issues with plan-related agents:
1. **Orchestrator should auto-trigger planning for broad requests**: When a user's request is really broad, the orchestrator should automatically invoke Prometheus to create a plan first, rather than diving directly into implementation.
2. **Prometheus should NOT ask user for codebase-answerable questions**: When Prometheus needs to ask questions that can be answered by exploring the codebase, it should NOT burden the user. Instead, the orchestrator should intercept these and answer them by invoking `explore` and `oracle` agents.
3. **Metis/Momus should work as-is**: The pre-planning (Metis) and review (Momus) agents are fine.

### Research Findings

**Current Architecture:**
- CLAUDE.md skill detection is keyword-based only ("plan this", "strategic discussion")
- No automatic complexity/scope detection for broad requests
- Prometheus currently asks ALL questions to user, including codebase-answerable ones
- Prometheus has guidance to use explore/librarian, but does NOT pre-filter questions

**Key Files:**
| File | Purpose |
|------|---------|
| `/docs/CLAUDE.md` | Orchestration instructions with skill detection table |
| `/agents/prometheus.md` | Agent definition with interview phases |
| `/src/agents/prometheus.ts` | TypeScript agent definition |
| `/src/agents/definitions.ts` | Master agent registry |

### Architecture Insight
This is fundamentally an **orchestration flow problem**, not just a Prometheus problem. The solution is to make the orchestrator a **context broker** that:
1. Detects broad requests requiring planning
2. Pre-gathers codebase context via explore/oracle
3. Passes context TO Prometheus so it only asks user-preference questions

## Work Objectives

### Core Objective
Implement intelligent planning flow where:
1. Orchestrator auto-detects broad requests and triggers planning
2. Orchestrator pre-gathers codebase context before invoking Prometheus
3. Prometheus only asks user-only questions (preferences, requirements, constraints)

### Deliverables
1. Updated `/docs/CLAUDE.md` with broad request detection heuristic
2. Updated `/docs/CLAUDE.md` with context brokering section
3. Updated `/agents/prometheus.md` with question pre-filtering logic
4. Updated `/src/agents/prometheus.ts` with question classification
5. Tests or verification that flow works correctly

### Definition of Done
- [ ] Broad request triggers planning automatically
- [ ] Prometheus receives pre-gathered codebase context
- [ ] Prometheus only asks user-only questions (not codebase questions)
- [ ] Metis/Momus workflows remain unchanged
- [ ] All existing tests pass
- [ ] New behavior documented

## Must Have / Must NOT Have

### Must Have
- Broad request detection heuristic in CLAUDE.md
- Context brokering flow documented
- Question classification in Prometheus prompt
- Backward compatibility with explicit /plan and /prometheus commands

### Must NOT Have
- Breaking changes to Metis/Momus agents
- Changes to hook system
- New dependencies
- Changes to installer

## Task Flow and Dependencies

```
┌─────────────────────────────────────────────────────┐
│ Task 1: Add Broad Request Detection to CLAUDE.md   │
│ (No dependencies)                                   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│ Task 2: Add Context Brokering Section to CLAUDE.md │
│ (Depends on Task 1)                                 │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│ Task 3: Update Prometheus Agent with Question      │
│         Pre-Filtering (Depends on Task 2)          │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│ Task 4: Build and Verify                           │
│ (Depends on Task 3)                                 │
└─────────────────────────────────────────────────────┘
```

## Detailed TODOs

### TODO 1: Add Broad Request Detection Heuristic to CLAUDE.md
**Location:** `/home/bellman/Workspace/oh-my-claude-sisyphus/docs/CLAUDE.md`
**Target:** After line 62, in the Skill Detection section

**Changes:**
Add to the Skill Detection table:
```markdown
| **BROAD REQUEST**: unbounded scope, vague verbs, no specific files, 3+ areas touched | **prometheus (with context brokering)** |
```

Add new section after the table:
```markdown
### Broad Request Detection Heuristic

A request is BROAD and needs planning if ANY of:
- Uses scope-less verbs: "improve", "enhance", "fix", "refactor", "add", "implement" without specific targets
- No specific file or function mentioned
- Touches multiple unrelated areas (3+ components)
- Single sentence without clear deliverable
- You cannot immediately identify which files to modify

When BROAD REQUEST detected:
1. First invoke `explore` to understand relevant codebase areas
2. Optionally invoke `oracle` for architectural guidance
3. THEN invoke `prometheus` with gathered context
4. Prometheus asks ONLY user-preference questions (not codebase questions)
```

**Acceptance Criteria:**
- [ ] New signal row added to Skill Detection table
- [ ] Heuristic section clearly defines "broad"
- [ ] Flow describes context brokering steps

---

### TODO 2: Add Context Brokering Section to CLAUDE.md
**Location:** `/home/bellman/Workspace/oh-my-claude-sisyphus/docs/CLAUDE.md`
**Target:** After the "Planning Workflow" section (around line 180)

**Changes:**
Add new section:
```markdown
## Prometheus Context Brokering

When invoking Prometheus for planning (whether auto-triggered or via /plan), ALWAYS follow this protocol:

### Pre-Gathering Phase

1. **Invoke explore agent** to gather codebase context:
   ```
   Task(subagent_type="oh-my-claude-sisyphus:explore", prompt="Find all files and patterns related to: {user request}")
   ```

2. **Optionally invoke oracle** for architectural overview (if complex):
   ```
   Task(subagent_type="oh-my-claude-sisyphus:oracle", prompt="Analyze architecture for: {user request}")
   ```

### Invoking Prometheus With Context

Pass pre-gathered context TO Prometheus:
```
Task(subagent_type="oh-my-claude-sisyphus:prometheus", prompt="""
## Pre-Gathered Context

### Codebase Analysis (from explore):
{explore results}

### Architecture Notes (from oracle):
{oracle analysis if gathered}

## User Request
{original request}

## Instructions
- DO NOT ask questions about codebase structure (already answered above)
- ONLY ask questions about user preferences, requirements, constraints
""")
```

### Why This Matters

Without context brokering:
- Prometheus asks: "What patterns exist in the codebase?" (user shouldn't need to know)
- Prometheus asks: "Where is authentication implemented?" (explore knows this)

With context brokering:
- Prometheus receives: "Auth is in src/auth/ using JWT pattern"
- Prometheus asks: "What's your timeline for this feature?" (only user knows)
```

**Acceptance Criteria:**
- [ ] Context brokering section explains the flow
- [ ] Example prompts show exact format
- [ ] Rationale explains why this improves UX

---

### TODO 3: Update Prometheus Agent with Question Pre-Filtering
**Location:**
- `/home/bellman/Workspace/oh-my-claude-sisyphus/agents/prometheus.md`
- `/home/bellman/Workspace/oh-my-claude-sisyphus/src/agents/prometheus.ts`

**Changes to agents/prometheus.md:**
Add after "When to Use Research Agents" section (around line 107):
```markdown
## Context-Aware Interview Mode

If you receive PRE-GATHERED CONTEXT from the orchestrator:

1. **DO NOT** ask questions that the context already answers
2. **DO** use the context to inform your interview
3. **ONLY** ask questions about:
   - User preferences and priorities
   - Business requirements and constraints
   - Scope decisions (what to include/exclude)
   - Timeline and quality trade-offs

### Question Classification (CRITICAL)

Before asking ANY question, classify it:

| Type | Example | Ask User? |
|------|---------|-----------|
| **Codebase fact** | "What patterns exist?" | NO - use provided context |
| **Codebase fact** | "Where is X implemented?" | NO - use provided context |
| **Codebase fact** | "What's the architecture?" | NO - use provided context |
| **Preference** | "Should we prioritize speed or quality?" | YES |
| **Requirement** | "What's the deadline?" | YES |
| **Scope** | "Should this include feature Y?" | YES |
| **Constraint** | "Are there performance requirements?" | YES |
| **Ownership** | "Who will maintain this?" | YES |

### If Context Not Provided

If the orchestrator did NOT provide pre-gathered context:
1. Use explore agent yourself to gather codebase context
2. THEN ask only user-preference questions
3. Never burden the user with questions the codebase can answer
```

**Changes to src/agents/prometheus.ts:**
Add the same section to the prompt string in the agent definition.

**Acceptance Criteria:**
- [ ] Question classification table added
- [ ] Clear guidance on when to ask user vs use context
- [ ] Both .md and .ts files updated identically

---

### TODO 4: Build and Verify
**Commands:**
```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Verify lint
npm run lint
```

**Acceptance Criteria:**
- [ ] `npm run build` completes without errors
- [ ] `npm test` passes all tests
- [ ] `npm run lint` shows no new errors

---

## Commit Strategy

### Commit 1: Add broad request detection to CLAUDE.md
```
feat: Add broad request detection heuristic for auto-planning

- Add new signal to Skill Detection table
- Define heuristic for identifying broad/vague requests
- Document flow for context brokering
```

### Commit 2: Add context brokering section
```
feat: Add Prometheus context brokering protocol

- Document pre-gathering phase with explore/oracle
- Provide example prompts for context-enriched Prometheus invocation
- Explain rationale for improved UX
```

### Commit 3: Update Prometheus with question pre-filtering
```
feat: Add question classification to Prometheus agent

- Add question classification table (codebase fact vs user-only)
- Update both .md and .ts agent definitions
- Ensure context-aware interview mode guidance
```

### Commit 4: PR with full documentation
```
docs: Update README and CHANGELOG for intelligent planning flow
```

## Success Criteria

1. **Functional Test:** When user says "add authentication", orchestrator:
   - Detects this as broad request
   - Gathers context via explore
   - Invokes Prometheus WITH context
   - Prometheus asks only: "What auth method do you prefer?" (not "where is auth?")

2. **Backward Compatibility:** `/plan` and `/prometheus` commands still work

3. **No Regression:** Metis and Momus workflows unchanged

4. **Build Health:** All tests pass, lint clean

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| CLAUDE.md changes may not be picked up by user | Documented in README, /sisyphus-default refreshes |
| Context may be too long for Prometheus | Use summarization in explore results |
| User may want to answer codebase questions | Prometheus can still ask if context unclear |

---

*Generated by Sisyphus Orchestrator in ULTRAWORK mode*
*Ready for implementation*
