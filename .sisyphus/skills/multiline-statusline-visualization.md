---
id: multiline-statusline-visualization
name: Multi-Line Statusline Visualization Pattern
description: Pattern for enhancing single-line CLI status displays to support multi-line rich visualization with tree characters
source: extracted
triggers:
  - multiline
  - statusline
  - hud visualization
  - tree characters
  - agent display
quality: 0.9
scope: project
created: 2026-01-19
---

# Multi-Line Statusline Visualization Pattern

## Problem

CLI status displays (like Claude Code's statusline) are often constrained to single-line output, forcing aggressive truncation of useful information. When multiple items need display (like running agents), this becomes unreadable.

## Solution

**Architecture Pattern**: Return structured result with header + detail lines

```typescript
interface MultiLineRenderResult {
  headerPart: string | null;   // Goes on main status line
  detailLines: string[];        // Additional lines below header
}
```

**Key Implementation Steps**:

1. **Create multi-line render function** that returns `{headerPart, detailLines}`
2. **Use tree characters** (`├─`, `└─`) for visual hierarchy
3. **Add config option** for max lines to prevent overflow
4. **Modify main renderer** to compose header + join detail lines with `\n`

**Visual Format**:
```
[HEADER] element1 | element2 | count:3 | element3
├─ Item 1 details...
├─ Item 2 details...
└─ Item 3 details...
```

**Overflow Handling**:
```
├─ Item 1
├─ Item 2
└─ +3 more items...
```

## Files Changed (oh-my-claude-sisyphus)

| File | Change |
|------|--------|
| `src/hud/types.ts` | Add format type, config option for maxLines |
| `src/hud/elements/agents.ts` | Add `renderMultiLine()` function |
| `src/hud/render.ts` | Support multi-line output composition |

## Key Code Pattern

```typescript
export function renderItemsMultiLine(
  items: Item[],
  maxLines: number = 5
): MultiLineRenderResult {
  const running = items.filter((i) => i.status === 'active');

  if (running.length === 0) {
    return { headerPart: null, detailLines: [] };
  }

  const headerPart = `items:${running.length}`;
  const detailLines: string[] = [];
  const displayCount = Math.min(running.length, maxLines);

  running.slice(0, maxLines).forEach((item, index) => {
    const isLast = index === displayCount - 1 && running.length <= maxLines;
    const prefix = isLast ? '└─' : '├─';
    detailLines.push(`${prefix} ${item.name} ${item.description}`);
  });

  if (running.length > maxLines) {
    const remaining = running.length - maxLines;
    detailLines.push(`└─ +${remaining} more...`);
  }

  return { headerPart, detailLines };
}
```

## When to Apply

- Enhancing any single-line CLI status display
- Showing multiple parallel operations with detail
- Any "swarm" or multi-agent visualization
- Progress displays with per-item status
