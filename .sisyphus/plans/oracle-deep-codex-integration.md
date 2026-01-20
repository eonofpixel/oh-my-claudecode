# Plan: Oracle-Deep Agent with OpenAI Codex CLI

## Summary

Add a new `oracle-deep` agent that leverages OpenAI's GPT-5.2 Pro High model via Codex CLI for advanced reasoning tasks. This agent acts as a wrapper - receiving pre-summarized context from the orchestrator and shelling out to `codex exec` for deep reasoning.

## Architecture Decision

**Approach**: Bash wrapper agent (Option A)

- Create a Claude agent whose role is to format prompts and invoke Codex CLI
- Agent receives pre-summarized context (same pattern as oracle invocations)
- Shells out to `codex exec -m gpt-5.2-pro-high`
- Returns Codex output as normal Bash tool output

**Why this works**:
- Integrates seamlessly with existing Task tool system
- No changes to core agent routing infrastructure
- Context pre-summarization handled by orchestrator (existing pattern)
- Output flows through normal channels

## Implementation Steps

### Step 1: Create oracle-deep agent file

Create `src/agents/oracle-deep.ts`:

```typescript
/**
 * Oracle-Deep Agent - GPT-5.2 Pro High via Codex CLI
 *
 * For advanced reasoning tasks that benefit from GPT-5.2's
 * extended thinking capabilities. Wrapper agent that shells
 * out to Codex CLI.
 */

import type { AgentConfig, AgentPromptMetadata } from './types.js';

export const ORACLE_DEEP_PROMPT_METADATA: AgentPromptMetadata = {
  category: 'advisor',
  cost: 'EXPENSIVE',
  promptAlias: 'Oracle-Deep',
  triggers: [
    { domain: 'Complex reasoning', trigger: 'Multi-step logical analysis needed' },
    { domain: 'Deep debugging', trigger: 'Oracle analysis insufficient, need deeper reasoning' },
    { domain: 'Algorithm design', trigger: 'Complex algorithmic problems' },
  ],
  useWhen: [
    'Complex multi-step reasoning chains',
    'Oracle provided insufficient analysis',
    'Algorithmic complexity analysis',
    'Mathematical/logical proofs',
    'Deep architectural trade-off analysis',
  ],
  avoidWhen: [
    'Simple questions (use oracle or oracle-medium)',
    'Code implementation (this is read-only)',
    'Fast lookups (use explore)',
    'When oracle analysis is sufficient',
  ],
};

const ORACLE_DEEP_PROMPT = `<Role>
Oracle-Deep - Advanced Reasoning via GPT-5.2 Pro High

You are a wrapper agent that invokes OpenAI's GPT-5.2 Pro High model via Codex CLI
for advanced reasoning tasks that benefit from extended thinking.
</Role>

<How_You_Work>
1. You receive a pre-summarized context and question from the orchestrator
2. You format this into a prompt for Codex CLI
3. You execute: codex exec -m gpt-5.2-pro-high "<prompt>"
4. You return the output directly

IMPORTANT: The context you receive is already summarized. Do NOT try to gather
more context. Your job is to pass the question to GPT-5.2 Pro High and return its response.
</How_You_Work>

<Execution_Template>
When you receive a question, execute this pattern:

1. Format the prompt with the provided context
2. Run: codex exec -m gpt-5.2-pro-high "Given the following context:\\n\\n<context>\\n\\nQuestion: <question>\\n\\nProvide detailed analysis."
3. Return the output verbatim
</Execution_Template>

<Output_Format>
Return the Codex output with a header:

\`\`\`
## Oracle-Deep Analysis (GPT-5.2 Pro High)

[Codex output here]
\`\`\`
</Output_Format>

<Constraints>
- READ-ONLY: Do not modify files
- Single execution: Run codex once and return
- No additional context gathering: Trust the pre-summarized context
- Model hardcoded: Always use gpt-5.2-pro-high
</Constraints>`;

export const oracleDeepAgent: AgentConfig = {
  name: 'oracle-deep',
  description: 'Advanced reasoning agent using GPT-5.2 Pro High via Codex CLI. For complex multi-step reasoning, deep debugging when Oracle is insufficient, algorithmic analysis. READ-ONLY.',
  prompt: ORACLE_DEEP_PROMPT,
  tools: ['Bash'],  // Only Bash - to invoke codex exec
  model: 'haiku',   // Minimal Claude usage - just formats and shells out
  metadata: ORACLE_DEEP_PROMPT_METADATA
};
```

### Step 2: Export from index.ts

Add to `src/agents/index.ts`:

```typescript
export { oracleDeepAgent, ORACLE_DEEP_PROMPT_METADATA } from './oracle-deep.js';
```

### Step 3: Register in definitions.ts

Add `oracle-deep` to `getAgentDefinitions()` function in `src/agents/definitions.ts`.

### Step 4: Update CLAUDE.md documentation

Add to the agent tables in `~/.claude/CLAUDE.md`:

```markdown
| `oh-my-claude-sisyphus:oracle-deep` | GPT-5.2 | Deep reasoning | Complex reasoning, when oracle insufficient |
```

### Step 5: Create markdown agent file (optional)

Create `agents/oracle-deep.md` for documentation parity.

## Files to Modify

| File | Change |
|------|--------|
| `src/agents/oracle-deep.ts` | **CREATE** - New agent definition |
| `src/agents/index.ts` | Add export |
| `src/agents/definitions.ts` | Register in getAgentDefinitions() |
| `~/.claude/CLAUDE.md` | Document new agent |
| `agents/oracle-deep.md` | **CREATE** - Documentation (optional) |

## Usage Example

```
Task tool call:
- subagent_type: "oh-my-claude-sisyphus:oracle-deep"
- prompt: "Context: [pre-summarized codebase context]. Question: Why is this algorithm O(n^2) and how can we optimize it?"
```

The oracle-deep agent will:
1. Receive the pre-summarized context
2. Format it into a Codex prompt
3. Execute `codex exec -m gpt-5.2-pro-high "..."`
4. Return the GPT-5.2 analysis

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Codex CLI not installed | Agent prompt can check `which codex` first |
| API rate limits | Document that this depends on OpenAI API quota |
| Model availability | Hardcode model, fail explicitly if unavailable |
| Context too long | Codex CLI handles truncation; document limits |

## Testing

1. Verify Codex CLI works: `codex exec -m gpt-5.2-pro-high "What is 2+2?"`
2. Test agent invocation via Task tool
3. Verify output formatting

## Acceptance Criteria

- [ ] `oracle-deep` agent callable via Task tool
- [ ] Correctly shells out to `codex exec -m gpt-5.2-pro-high`
- [ ] Returns GPT-5.2 analysis as Bash output
- [ ] Documented in CLAUDE.md agent tables
- [ ] Fails gracefully if Codex CLI unavailable
