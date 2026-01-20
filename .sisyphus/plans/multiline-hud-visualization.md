# Multi-Line HUD Agent Visualization Enhancement Plan

## Overview

Enhance the Sisyphus HUD to support **multi-line agent visualization** for richer, more readable display of running agents. Users will be able to clearly identify what each agent is doing at a glance.

## Current State

The HUD currently outputs a single line with various agent formats:
```
[SISYPHUS] ralph:3/10 | ultrawork | ctx:67% | agents:Oes | bg:3/5 | todos:2/5
```

**Limitation**: Agents are compressed (e.g., `Oes` = Oracle/explore/sisyphus-junior), and descriptions are truncated to 20-25 characters.

## Proposed Enhancement

Add a new multi-line display option:

```
[SISYPHUS] ralph:3/10 | ultrawork | ctx:67% | todos:2/5
├─ O oracle     2m   analyzing architecture patterns...
├─ e explore    45s  searching for test files
└─ s sj-junior  1m   implementing validation logic
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| New format name | `multiline` | Clear, descriptive |
| Tree characters | `├─`, `└─` | Visual hierarchy |
| Agent line format | `CODE TYPE DURATION DESC` | Consistent columns |
| Max lines | Configurable (default: 5) | Prevent terminal overflow |
| Truncation style | End with ellipsis | Simpler implementation |

## Implementation Plan

### Phase 1: Type System Updates

**File: `src/hud/types.ts`**

1. Add new `AgentsFormat` value:
```typescript
export type AgentsFormat =
  | 'count'
  | 'codes'
  | 'codes-duration'
  | 'detailed'
  | 'descriptions'
  | 'tasks'
  | 'multiline';  // NEW
```

2. Add multi-line config options to `HudElementConfig`:
```typescript
export interface HudElementConfig {
  // ... existing fields ...
  agentsMultiline: boolean;        // Enable multi-line mode
  agentsMaxLines: number;          // Max agent detail lines (default: 5)
}
```

3. Update `DEFAULT_HUD_CONFIG`:
```typescript
export const DEFAULT_HUD_CONFIG: HudConfig = {
  // ...
  elements: {
    // ...
    agentsMultiline: false,  // Off by default for backward compatibility
    agentsMaxLines: 5,
  },
};
```

### Phase 2: Multi-Line Render Function

**File: `src/hud/elements/agents.ts`**

Add new function `renderAgentsMultiLine`:

```typescript
/**
 * Render agents as multi-line display for maximum clarity.
 * Returns array of strings - one header addition + multiple detail lines.
 */
export function renderAgentsMultiLine(
  agents: ActiveAgent[],
  maxLines: number = 5
): { headerPart: string | null; detailLines: string[] } {
  const running = agents.filter((a) => a.status === 'running');

  if (running.length === 0) {
    return { headerPart: null, detailLines: [] };
  }

  // Header part shows count for awareness
  const headerPart = `agents:${CYAN}${running.length}${RESET}`;

  // Build detail lines
  const now = Date.now();
  const detailLines: string[] = [];

  running.slice(0, maxLines).forEach((a, index) => {
    const isLast = index === Math.min(running.length - 1, maxLines - 1);
    const prefix = isLast ? '└─' : '├─';

    const code = getAgentCode(a.type, a.model);
    const color = getModelTierColor(a.model);
    const shortName = getShortAgentName(a.type).padEnd(10);

    const durationMs = now - a.startTime.getTime();
    const duration = formatDurationPadded(durationMs);

    const desc = a.description || '...';
    const truncatedDesc = desc.length > 40 ? desc.slice(0, 37) + '...' : desc;

    detailLines.push(
      `${dim(prefix)} ${color}${code}${RESET} ${dim(shortName)} ${dim(duration)} ${truncatedDesc}`
    );
  });

  // Add overflow indicator if needed
  if (running.length > maxLines) {
    detailLines.push(`${dim('   +' + (running.length - maxLines) + ' more agents...')}`);
  }

  return { headerPart, detailLines };
}
```

### Phase 3: Modify Main Renderer

**File: `src/hud/render.ts`**

Update `render()` to support multi-line output:

```typescript
export function render(context: HudRenderContext, config: HudConfig): string {
  const elements: string[] = [];
  const detailLines: string[] = [];
  const { elements: enabledElements } = config;

  // ... existing element rendering ...

  // Active agents - handle multi-line mode
  if (enabledElements.agents) {
    if (enabledElements.agentsMultiline) {
      const result = renderAgentsMultiLine(
        context.activeAgents,
        enabledElements.agentsMaxLines || 5
      );
      if (result.headerPart) elements.push(result.headerPart);
      detailLines.push(...result.detailLines);
    } else {
      const agents = renderAgentsByFormat(
        context.activeAgents,
        enabledElements.agentsFormat || 'codes'
      );
      if (agents) elements.push(agents);
    }
  }

  // ... rest of element rendering ...

  // Compose output
  const headerLine = elements.join(dim(' | '));

  if (detailLines.length > 0) {
    return [headerLine, ...detailLines].join('\n');
  }

  return headerLine;
}
```

### Phase 4: Update Presets

**File: `src/hud/types.ts`**

Update preset configurations:

```typescript
export const PRESET_CONFIGS: Record<HudPreset, Partial<HudElementConfig>> = {
  minimal: {
    // ... existing ...
    agentsMultiline: false,
    agentsMaxLines: 0,
  },
  focused: {
    // ... existing ...
    agentsMultiline: true,   // Enable by default in focused mode
    agentsMaxLines: 3,       // Show up to 3 agents
  },
  full: {
    // ... existing ...
    agentsMultiline: true,
    agentsMaxLines: 10,      // Show many agents in full mode
  },
};
```

### Phase 5: Update /hud Command

**File: `commands/hud.md`**

Add documentation for multi-line mode:

```markdown
### Multi-Line Agent Display

When agents are running, the HUD can show detailed information on separate lines:

```
[SISYPHUS] ralph:3/10 | ultrawork | ctx:67% | todos:2/5
├─ O oracle     2m   analyzing architecture patterns...
├─ e explore    45s  searching for test files
└─ s sj-junior  1m   implementing validation logic
```

Enable/disable via configuration:
- `/hud multiline on` - Enable multi-line display
- `/hud multiline off` - Disable (single-line mode)
```

### Phase 6: Testing

**File: `src/__tests__/hud-agents.test.ts`**

Add tests for multi-line rendering:

```typescript
describe('renderAgentsMultiLine', () => {
  it('should return empty for no running agents', () => {
    const result = renderAgentsMultiLine([]);
    expect(result.headerPart).toBeNull();
    expect(result.detailLines).toHaveLength(0);
  });

  it('should render single agent with tree character', () => {
    const agents = [createAgent('oh-my-claude-sisyphus:oracle', 'opus')];
    const result = renderAgentsMultiLine(agents);
    expect(result.headerPart).toContain('agents:');
    expect(result.detailLines).toHaveLength(1);
    expect(result.detailLines[0]).toContain('└─');
    expect(result.detailLines[0]).toContain('O');
  });

  it('should limit to maxLines and show overflow', () => {
    const agents = [
      createAgent('oh-my-claude-sisyphus:oracle', 'opus'),
      createAgent('oh-my-claude-sisyphus:explore', 'haiku'),
      createAgent('oh-my-claude-sisyphus:sisyphus-junior', 'sonnet'),
      createAgent('oh-my-claude-sisyphus:librarian', 'haiku'),
    ];
    const result = renderAgentsMultiLine(agents, 2);
    expect(result.detailLines).toHaveLength(3); // 2 agents + overflow indicator
    expect(result.detailLines[2]).toContain('+2 more');
  });
});
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/hud/types.ts` | Add `multiline` format, new config options |
| `src/hud/elements/agents.ts` | Add `renderAgentsMultiLine()` function |
| `src/hud/render.ts` | Support multi-line output composition |
| `commands/hud.md` | Document new multi-line feature |
| `src/__tests__/hud-agents.test.ts` | Add tests for multi-line rendering |

## Verification Steps

1. Build: `bun run build`
2. Test: `bun test hud-agents`
3. Manual test with mock stdin:
```bash
echo '{"transcript_path":"test.jsonl","cwd":"/tmp","model":{"id":"opus","display_name":"Opus"},"context_window":{"used_percentage":67}}' | node dist/hud/index.js
```

## Backward Compatibility

- Multi-line is **opt-in** via `agentsMultiline: true`
- Default behavior unchanged (single-line)
- Existing presets maintain current behavior until explicitly updated
- No breaking changes to existing config files

## Success Criteria

- [ ] Multi-line renders correctly with tree characters
- [ ] Agent type codes display with correct model tier colors
- [ ] Descriptions show without aggressive truncation
- [ ] Duration displays in human-readable format
- [ ] Overflow indicator shows when agents exceed maxLines
- [ ] All existing tests continue to pass
- [ ] New multi-line tests pass
