# Claudeception Integration - Detailed Implementation Plan

**Status:** Ready for Implementation
**Branch:** `feature/claudeception`
**Created:** 2026-01-19
**Risk Level:** Conservative (isolated with feature flag)

---

## Table of Contents

1. [Context & Decisions](#context--decisions)
2. [Worktree Setup](#worktree-setup)
3. [Phase 1: Skill Loading Infrastructure](#phase-1-skill-loading-infrastructure)
4. [Phase 2: Extraction Mechanism](#phase-2-extraction-mechanism)
5. [Phase 3: Detection & Quality Gates](#phase-3-detection--quality-gates)
6. [Phase 4: Integration & Polish](#phase-4-integration--polish)
7. [File Structure Overview](#file-structure-overview)
8. [Risk Mitigation](#risk-mitigation)
9. [Commit Strategy](#commit-strategy)
10. [Definition of Done](#definition-of-done)

---

## Context & Decisions

### Original Request
Implement "Claudeception" - a system for Claude to extract, store, and reuse learned skills from conversation sessions.

### Confirmed Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Storage Strategy | **Hybrid** - User (`~/.claude/skills/sisyphus-learned/`) + Project (`.sisyphus/skills/`), project overrides user |
| 2 | Extraction Trigger | **Semi-automatic** - Detect extractable moments, prompt for confirmation |
| 3 | Quality Gates | **Moderate** with configurability - Clear problem/solution/trigger required |
| 4 | Relation to Existing | **Complement** with promotion path - Skills are curated promotions from ralph-progress learnings |
| 5 | Branch Strategy | **Feature branch** (`feature/claudeception`) with squash merge |
| 6 | Risk Tolerance | **Conservative isolation** - New hook, new context source type, feature flag for rollback |
| 7 | Implementation Order | **Integration first** - Loader -> Extractor -> Detection -> Polish |

### Existing Patterns to Reuse

| Pattern | Source File | Lines | Usage |
|---------|-------------|-------|-------|
| Hybrid path search | `src/hooks/rules-injector/finder.ts` | 158-253 | Skill file discovery |
| YAML frontmatter parsing | `src/hooks/rules-injector/parser.ts` | 21-76 | Skill metadata parsing |
| Recent learnings retrieval | `src/hooks/ralph-progress/index.ts` | 385-399 | Promotion candidates |
| Context source type | `src/features/context-injector/types.ts` | 15-22 | Add `'learned-skills'` |
| Pruning pattern | `src/hooks/notepad/index.ts` | 339-392 | Skill cleanup |

---

## Worktree Setup

### Commands

```bash
# From main repo directory
cd /home/bellman/Workspace/oh-my-claude-sisyphus

# Create and checkout feature branch
git checkout -b feature/claudeception

# Alternative: Use git worktree for isolated development
git worktree add ../oh-my-claude-sisyphus-claudeception feature/claudeception
cd ../oh-my-claude-sisyphus-claudeception

# Install dependencies
npm install

# Verify build works
npm run build
```

### Branch Naming
- Feature branch: `feature/claudeception`
- PR target: `main`
- Merge strategy: Squash merge

---

## Phase 1: Skill Loading Infrastructure

**Goal:** Load skills from hybrid storage locations and inject into context.

### 1.1 Create Type Definitions

**File:** `src/hooks/learned-skills/types.ts`

```typescript
/**
 * Learned Skills Types
 *
 * Type definitions for skill files and metadata.
 * Follows patterns from rules-injector/types.ts
 */

/**
 * Skill metadata from YAML frontmatter.
 */
export interface SkillMetadata {
  /** Unique identifier for the skill */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this skill does */
  description: string;
  /** Keywords that trigger skill injection */
  triggers: string[];
  /** When the skill was created */
  createdAt: string;
  /** Source: 'extracted' | 'promoted' | 'manual' */
  source: 'extracted' | 'promoted' | 'manual';
  /** Original session ID if extracted */
  sessionId?: string;
  /** Quality score (0-100) */
  quality?: number;
  /** Number of times successfully applied */
  usageCount?: number;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Parsed skill file with content.
 */
export interface LearnedSkill {
  /** Absolute path to skill file */
  path: string;
  /** Path relative to skills directory */
  relativePath: string;
  /** Whether from user (~/.claude) or project (.sisyphus) */
  scope: 'user' | 'project';
  /** Parsed frontmatter metadata */
  metadata: SkillMetadata;
  /** Skill content (the actual instructions) */
  content: string;
  /** SHA-256 hash for deduplication */
  contentHash: string;
  /** Priority: project > user */
  priority: number;
}

/**
 * Skill file candidate during discovery.
 */
export interface SkillFileCandidate {
  /** Path to the skill file */
  path: string;
  /** Real path after symlink resolution */
  realPath: string;
  /** Scope: user or project */
  scope: 'user' | 'project';
}

/**
 * Quality gate validation result.
 */
export interface QualityValidation {
  /** Whether skill passes quality gates */
  valid: boolean;
  /** Missing required fields */
  missingFields: string[];
  /** Warnings (non-blocking) */
  warnings: string[];
  /** Quality score (0-100) */
  score: number;
}

/**
 * Skill extraction request.
 */
export interface SkillExtractionRequest {
  /** The problem being solved */
  problem: string;
  /** The solution/approach */
  solution: string;
  /** Trigger keywords */
  triggers: string[];
  /** Optional tags */
  tags?: string[];
  /** Target scope: user or project */
  targetScope: 'user' | 'project';
}

/**
 * Session storage for tracking injected skills.
 */
export interface InjectedSkillsData {
  /** Session ID */
  sessionId: string;
  /** Content hashes of already injected skills */
  injectedHashes: string[];
  /** Timestamp of last update */
  updatedAt: number;
}
```

### 1.2 Create Constants

**File:** `src/hooks/learned-skills/constants.ts`

```typescript
/**
 * Learned Skills Constants
 */

import { join } from 'path';
import { homedir } from 'os';

/** User-level skills directory */
export const USER_SKILLS_DIR = join(homedir(), '.claude', 'skills', 'sisyphus-learned');

/** Project-level skills subdirectory */
export const PROJECT_SKILLS_SUBDIR = '.sisyphus/skills';

/** Valid skill file extension */
export const SKILL_EXTENSION = '.md';

/** Feature flag key for enabling/disabling */
export const FEATURE_FLAG_KEY = 'claudeception.enabled';

/** Default feature flag value */
export const FEATURE_FLAG_DEFAULT = true;

/** Maximum skill content length (characters) */
export const MAX_SKILL_CONTENT_LENGTH = 4000;

/** Minimum quality score for auto-injection */
export const MIN_QUALITY_SCORE = 50;

/** Required metadata fields */
export const REQUIRED_METADATA_FIELDS = ['id', 'name', 'description', 'triggers', 'source'];

/** Maximum skills to inject per session */
export const MAX_SKILLS_PER_SESSION = 10;
```

### 1.3 Create Skill Finder

**File:** `src/hooks/learned-skills/finder.ts`

Pattern: Follow `src/hooks/rules-injector/finder.ts` lines 158-253

```typescript
/**
 * Skill Finder
 *
 * Discovers skill files using hybrid search (user + project).
 * Project skills override user skills with same ID.
 */

import { existsSync, readdirSync, realpathSync, statSync } from 'fs';
import { join } from 'path';
import { USER_SKILLS_DIR, PROJECT_SKILLS_SUBDIR, SKILL_EXTENSION } from './constants.js';
import type { SkillFileCandidate } from './types.js';

/**
 * Recursively find all skill files in a directory.
 */
function findSkillFilesRecursive(dir: string, results: string[]): void {
  if (!existsSync(dir)) return;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        findSkillFilesRecursive(fullPath, results);
      } else if (entry.isFile() && entry.name.endsWith(SKILL_EXTENSION)) {
        results.push(fullPath);
      }
    }
  } catch {
    // Permission denied or other errors - silently skip
  }
}

/**
 * Resolve symlinks safely with fallback.
 */
function safeRealpathSync(filePath: string): string {
  try {
    return realpathSync(filePath);
  } catch {
    return filePath;
  }
}

/**
 * Find all skill files for a given project.
 * Returns project skills first (higher priority), then user skills.
 */
export function findSkillFiles(projectRoot: string | null): SkillFileCandidate[] {
  const candidates: SkillFileCandidate[] = [];
  const seenRealPaths = new Set<string>();

  // 1. Search project-level skills (higher priority)
  if (projectRoot) {
    const projectSkillsDir = join(projectRoot, PROJECT_SKILLS_SUBDIR);
    const projectFiles: string[] = [];
    findSkillFilesRecursive(projectSkillsDir, projectFiles);

    for (const filePath of projectFiles) {
      const realPath = safeRealpathSync(filePath);
      if (seenRealPaths.has(realPath)) continue;
      seenRealPaths.add(realPath);

      candidates.push({
        path: filePath,
        realPath,
        scope: 'project',
      });
    }
  }

  // 2. Search user-level skills (lower priority)
  const userFiles: string[] = [];
  findSkillFilesRecursive(USER_SKILLS_DIR, userFiles);

  for (const filePath of userFiles) {
    const realPath = safeRealpathSync(filePath);
    if (seenRealPaths.has(realPath)) continue;
    seenRealPaths.add(realPath);

    candidates.push({
      path: filePath,
      realPath,
      scope: 'user',
    });
  }

  return candidates;
}

/**
 * Get skills directory path for a scope.
 */
export function getSkillsDir(scope: 'user' | 'project', projectRoot?: string): string {
  if (scope === 'user') {
    return USER_SKILLS_DIR;
  }
  if (!projectRoot) {
    throw new Error('Project root required for project scope');
  }
  return join(projectRoot, PROJECT_SKILLS_SUBDIR);
}

/**
 * Ensure skills directory exists.
 */
export function ensureSkillsDir(scope: 'user' | 'project', projectRoot?: string): boolean {
  const dir = getSkillsDir(scope, projectRoot);

  if (existsSync(dir)) {
    return true;
  }

  try {
    const { mkdirSync } = require('fs');
    mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}
```

### 1.4 Create Skill Parser

**File:** `src/hooks/learned-skills/parser.ts`

Pattern: Follow `src/hooks/rules-injector/parser.ts` lines 21-76

```typescript
/**
 * Skill Parser
 *
 * Parses YAML frontmatter from skill files.
 */

import type { SkillMetadata } from './types.js';

export interface SkillParseResult {
  metadata: Partial<SkillMetadata>;
  content: string;
  valid: boolean;
  errors: string[];
}

/**
 * Parse skill file frontmatter and content.
 */
export function parseSkillFile(rawContent: string): SkillParseResult {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = rawContent.match(frontmatterRegex);

  if (!match) {
    return {
      metadata: {},
      content: rawContent,
      valid: false,
      errors: ['Missing YAML frontmatter'],
    };
  }

  const yamlContent = match[1];
  const content = match[2].trim();
  const errors: string[] = [];

  try {
    const metadata = parseYamlMetadata(yamlContent);

    // Validate required fields
    if (!metadata.id) errors.push('Missing required field: id');
    if (!metadata.name) errors.push('Missing required field: name');
    if (!metadata.description) errors.push('Missing required field: description');
    if (!metadata.triggers || metadata.triggers.length === 0) {
      errors.push('Missing required field: triggers');
    }
    if (!metadata.source) errors.push('Missing required field: source');

    return {
      metadata,
      content,
      valid: errors.length === 0,
      errors,
    };
  } catch (e) {
    return {
      metadata: {},
      content: rawContent,
      valid: false,
      errors: [`YAML parse error: ${e}`],
    };
  }
}

/**
 * Parse YAML metadata without external library.
 */
function parseYamlMetadata(yamlContent: string): Partial<SkillMetadata> {
  const lines = yamlContent.split('\n');
  const metadata: Partial<SkillMetadata> = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');

    if (colonIndex === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();

    switch (key) {
      case 'id':
        metadata.id = parseStringValue(rawValue);
        break;
      case 'name':
        metadata.name = parseStringValue(rawValue);
        break;
      case 'description':
        metadata.description = parseStringValue(rawValue);
        break;
      case 'source':
        metadata.source = parseStringValue(rawValue) as 'extracted' | 'promoted' | 'manual';
        break;
      case 'createdAt':
        metadata.createdAt = parseStringValue(rawValue);
        break;
      case 'sessionId':
        metadata.sessionId = parseStringValue(rawValue);
        break;
      case 'quality':
        metadata.quality = parseInt(rawValue, 10) || undefined;
        break;
      case 'usageCount':
        metadata.usageCount = parseInt(rawValue, 10) || 0;
        break;
      case 'triggers':
      case 'tags':
        const { value, consumed } = parseArrayValue(rawValue, lines, i);
        if (key === 'triggers') {
          metadata.triggers = Array.isArray(value) ? value : [value];
        } else {
          metadata.tags = Array.isArray(value) ? value : [value];
        }
        i += consumed - 1;
        break;
    }

    i++;
  }

  return metadata;
}

function parseStringValue(value: string): string {
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseArrayValue(
  rawValue: string,
  lines: string[],
  currentIndex: number
): { value: string | string[]; consumed: number } {
  // Inline array: ["a", "b"]
  if (rawValue.startsWith('[')) {
    const content = rawValue.slice(1, rawValue.lastIndexOf(']')).trim();
    if (!content) return { value: [], consumed: 1 };

    const items = content.split(',').map(s => parseStringValue(s.trim())).filter(Boolean);
    return { value: items, consumed: 1 };
  }

  // Multi-line array
  if (!rawValue || rawValue === '') {
    const items: string[] = [];
    let consumed = 1;

    for (let j = currentIndex + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      const arrayMatch = nextLine.match(/^\s+-\s*(.*)$/);

      if (arrayMatch) {
        const itemValue = parseStringValue(arrayMatch[1].trim());
        if (itemValue) items.push(itemValue);
        consumed++;
      } else if (nextLine.trim() === '') {
        consumed++;
      } else {
        break;
      }
    }

    if (items.length > 0) {
      return { value: items, consumed };
    }
  }

  // Single value
  return { value: parseStringValue(rawValue), consumed: 1 };
}

/**
 * Generate YAML frontmatter for a skill.
 */
export function generateSkillFrontmatter(metadata: SkillMetadata): string {
  const lines = [
    '---',
    `id: "${metadata.id}"`,
    `name: "${metadata.name}"`,
    `description: "${metadata.description}"`,
    `source: ${metadata.source}`,
    `createdAt: "${metadata.createdAt}"`,
  ];

  if (metadata.sessionId) {
    lines.push(`sessionId: "${metadata.sessionId}"`);
  }

  if (metadata.quality !== undefined) {
    lines.push(`quality: ${metadata.quality}`);
  }

  if (metadata.usageCount !== undefined) {
    lines.push(`usageCount: ${metadata.usageCount}`);
  }

  lines.push('triggers:');
  for (const trigger of metadata.triggers) {
    lines.push(`  - "${trigger}"`);
  }

  if (metadata.tags && metadata.tags.length > 0) {
    lines.push('tags:');
    for (const tag of metadata.tags) {
      lines.push(`  - "${tag}"`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}
```

### 1.5 Create Skill Loader

**File:** `src/hooks/learned-skills/loader.ts`

```typescript
/**
 * Skill Loader
 *
 * Loads and caches skills from disk.
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { relative } from 'path';
import { findSkillFiles, getSkillsDir } from './finder.js';
import { parseSkillFile } from './parser.js';
import type { LearnedSkill, SkillMetadata } from './types.js';

/**
 * Create SHA-256 hash of content.
 */
function createContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Load all skills for a project.
 * Project skills override user skills with same ID.
 */
export function loadAllSkills(projectRoot: string | null): LearnedSkill[] {
  const candidates = findSkillFiles(projectRoot);
  const skills: LearnedSkill[] = [];
  const seenIds = new Map<string, LearnedSkill>();

  for (const candidate of candidates) {
    try {
      const rawContent = readFileSync(candidate.path, 'utf-8');
      const { metadata, content, valid, errors } = parseSkillFile(rawContent);

      if (!valid) {
        console.warn(`Invalid skill file ${candidate.path}: ${errors.join(', ')}`);
        continue;
      }

      const skillId = metadata.id!;
      const skillsDir = getSkillsDir(candidate.scope, projectRoot || undefined);
      const relativePath = relative(skillsDir, candidate.path);

      const skill: LearnedSkill = {
        path: candidate.path,
        relativePath,
        scope: candidate.scope,
        metadata: metadata as SkillMetadata,
        content,
        contentHash: createContentHash(content),
        priority: candidate.scope === 'project' ? 1 : 0,
      };

      // Project skills override user skills with same ID
      const existing = seenIds.get(skillId);
      if (!existing || skill.priority > existing.priority) {
        seenIds.set(skillId, skill);
      }
    } catch (e) {
      console.warn(`Error loading skill ${candidate.path}:`, e);
    }
  }

  // Return skills sorted by priority (project first)
  return Array.from(seenIds.values()).sort((a, b) => b.priority - a.priority);
}

/**
 * Load a specific skill by ID.
 */
export function loadSkillById(skillId: string, projectRoot: string | null): LearnedSkill | null {
  const skills = loadAllSkills(projectRoot);
  return skills.find(s => s.metadata.id === skillId) || null;
}

/**
 * Find skills matching keywords in user message.
 */
export function findMatchingSkills(
  message: string,
  projectRoot: string | null,
  limit: number = 5
): LearnedSkill[] {
  const skills = loadAllSkills(projectRoot);
  const messageLower = message.toLowerCase();

  const scored = skills.map(skill => {
    let score = 0;

    // Check trigger matches
    for (const trigger of skill.metadata.triggers) {
      if (messageLower.includes(trigger.toLowerCase())) {
        score += 10;
      }
    }

    // Check tag matches
    if (skill.metadata.tags) {
      for (const tag of skill.metadata.tags) {
        if (messageLower.includes(tag.toLowerCase())) {
          score += 5;
        }
      }
    }

    // Boost by quality score
    if (skill.metadata.quality) {
      score += skill.metadata.quality / 20;
    }

    // Boost by usage count
    if (skill.metadata.usageCount) {
      score += Math.min(skill.metadata.usageCount, 10);
    }

    return { skill, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.skill);
}
```

### 1.6 Update Context Injector Types

**File:** `src/features/context-injector/types.ts`

**Modification:** Add `'learned-skills'` to `ContextSourceType` (line 15-22)

```typescript
// Change from:
export type ContextSourceType =
  | 'keyword-detector'
  | 'rules-injector'
  | 'directory-agents'
  | 'directory-readme'
  | 'boulder-state'
  | 'session-context'
  | 'custom';

// To:
export type ContextSourceType =
  | 'keyword-detector'
  | 'rules-injector'
  | 'directory-agents'
  | 'directory-readme'
  | 'boulder-state'
  | 'session-context'
  | 'learned-skills'    // NEW
  | 'custom';
```

### 1.7 Create Hook Entry Point

**File:** `src/hooks/learned-skills/index.ts`

```typescript
/**
 * Learned Skills Hook
 *
 * Automatically injects relevant learned skills into context
 * based on message content triggers.
 */

import { contextCollector } from '../../features/context-injector/index.js';
import { loadAllSkills, findMatchingSkills } from './loader.js';
import { FEATURE_FLAG_KEY, FEATURE_FLAG_DEFAULT, MAX_SKILLS_PER_SESSION } from './constants.js';
import type { LearnedSkill, InjectedSkillsData } from './types.js';

// Re-export submodules
export * from './types.js';
export * from './constants.js';
export * from './finder.js';
export * from './parser.js';
export * from './loader.js';

/**
 * Session cache for tracking injected skills.
 */
const sessionCaches = new Map<string, Set<string>>();

/**
 * Check if feature is enabled.
 */
export function isClaudeceptionEnabled(): boolean {
  // TODO: Read from config file when configuration system is implemented
  return FEATURE_FLAG_DEFAULT;
}

/**
 * Format skills for context injection.
 */
function formatSkillsForContext(skills: LearnedSkill[]): string {
  if (skills.length === 0) return '';

  const lines = [
    '<learned-skills>',
    '',
    '## Relevant Learned Skills',
    '',
    'The following skills have been learned from previous sessions and may be helpful:',
    '',
  ];

  for (const skill of skills) {
    lines.push(`### ${skill.metadata.name}`);
    lines.push(`**Triggers:** ${skill.metadata.triggers.join(', ')}`);
    if (skill.metadata.tags && skill.metadata.tags.length > 0) {
      lines.push(`**Tags:** ${skill.metadata.tags.join(', ')}`);
    }
    lines.push('');
    lines.push(skill.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('</learned-skills>');
  return lines.join('\n');
}

/**
 * Process a user message and inject matching skills.
 */
export function processMessageForSkills(
  message: string,
  sessionId: string,
  projectRoot: string | null
): { injected: number; skills: LearnedSkill[] } {
  if (!isClaudeceptionEnabled()) {
    return { injected: 0, skills: [] };
  }

  // Get or create session cache
  if (!sessionCaches.has(sessionId)) {
    sessionCaches.set(sessionId, new Set());
  }
  const injectedHashes = sessionCaches.get(sessionId)!;

  // Find matching skills not already injected
  const matchingSkills = findMatchingSkills(message, projectRoot, MAX_SKILLS_PER_SESSION);
  const newSkills = matchingSkills.filter(s => !injectedHashes.has(s.contentHash));

  if (newSkills.length === 0) {
    return { injected: 0, skills: [] };
  }

  // Mark as injected
  for (const skill of newSkills) {
    injectedHashes.add(skill.contentHash);
  }

  // Register with context collector
  const content = formatSkillsForContext(newSkills);
  contextCollector.register(sessionId, {
    id: 'learned-skills',
    source: 'learned-skills',
    content,
    priority: 'normal',
    metadata: {
      skillCount: newSkills.length,
      skillIds: newSkills.map(s => s.metadata.id),
    },
  });

  return { injected: newSkills.length, skills: newSkills };
}

/**
 * Clear session cache.
 */
export function clearSkillSession(sessionId: string): void {
  sessionCaches.delete(sessionId);
}

/**
 * Get all loaded skills (for debugging/display).
 */
export function getAllSkills(projectRoot: string | null): LearnedSkill[] {
  return loadAllSkills(projectRoot);
}

/**
 * Create the learned skills hook for Claude Code.
 */
export function createLearnedSkillsHook(projectRoot: string | null) {
  return {
    /**
     * Process user message for skill injection.
     */
    processMessage: (message: string, sessionId: string) => {
      return processMessageForSkills(message, sessionId, projectRoot);
    },

    /**
     * Clear session when done.
     */
    clearSession: (sessionId: string) => {
      clearSkillSession(sessionId);
    },

    /**
     * Get all skills for display.
     */
    getAllSkills: () => getAllSkills(projectRoot),

    /**
     * Check if feature enabled.
     */
    isEnabled: isClaudeceptionEnabled,
  };
}
```

### 1.8 Test Cases for Phase 1

**File:** `test/hooks/learned-skills/finder.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { findSkillFiles, getSkillsDir, ensureSkillsDir } from '../../../src/hooks/learned-skills/finder.js';

describe('Skill Finder', () => {
  let testDir: string;
  let projectRoot: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skill-test-${Date.now()}`);
    projectRoot = join(testDir, 'project');
    mkdirSync(join(projectRoot, '.sisyphus', 'skills'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should find project-level skills', () => {
    const skillPath = join(projectRoot, '.sisyphus', 'skills', 'test-skill.md');
    writeFileSync(skillPath, '# Test Skill');

    const candidates = findSkillFiles(projectRoot);

    expect(candidates.length).toBe(1);
    expect(candidates[0].scope).toBe('project');
    expect(candidates[0].path).toBe(skillPath);
  });

  it('should prioritize project skills over user skills', () => {
    // Create project skill
    const projectSkillPath = join(projectRoot, '.sisyphus', 'skills', 'skill.md');
    writeFileSync(projectSkillPath, '# Project Skill');

    const candidates = findSkillFiles(projectRoot);

    // Project skill should come first
    const projectSkill = candidates.find(c => c.scope === 'project');
    expect(projectSkill).toBeDefined();
  });

  it('should handle missing directories gracefully', () => {
    const emptyProject = join(testDir, 'empty');
    mkdirSync(emptyProject);

    const candidates = findSkillFiles(emptyProject);

    // Should return empty array, not throw
    expect(Array.isArray(candidates)).toBe(true);
  });
});
```

**File:** `test/hooks/learned-skills/parser.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseSkillFile, generateSkillFrontmatter } from '../../../src/hooks/learned-skills/parser.js';

describe('Skill Parser', () => {
  it('should parse valid skill frontmatter', () => {
    const content = `---
id: "test-skill-001"
name: "Test Skill"
description: "A test skill"
source: extracted
createdAt: "2024-01-19T12:00:00Z"
triggers:
  - "test"
  - "demo"
tags:
  - "testing"
---

# Test Skill Content

This is the skill content.
`;

    const result = parseSkillFile(content);

    expect(result.valid).toBe(true);
    expect(result.metadata.id).toBe('test-skill-001');
    expect(result.metadata.name).toBe('Test Skill');
    expect(result.metadata.triggers).toEqual(['test', 'demo']);
    expect(result.content).toContain('Test Skill Content');
  });

  it('should reject skill without required fields', () => {
    const content = `---
name: "Incomplete Skill"
---

Content without required fields.
`;

    const result = parseSkillFile(content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: id');
    expect(result.errors).toContain('Missing required field: triggers');
  });

  it('should generate valid frontmatter', () => {
    const metadata = {
      id: 'gen-skill-001',
      name: 'Generated Skill',
      description: 'A generated skill',
      source: 'extracted' as const,
      createdAt: '2024-01-19T12:00:00Z',
      triggers: ['generate', 'create'],
      tags: ['automation'],
    };

    const frontmatter = generateSkillFrontmatter(metadata);

    expect(frontmatter).toContain('id: "gen-skill-001"');
    expect(frontmatter).toContain('triggers:');
    expect(frontmatter).toContain('  - "generate"');
  });
});
```

**File:** `test/hooks/learned-skills/loader.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadAllSkills, findMatchingSkills } from '../../../src/hooks/learned-skills/loader.js';

describe('Skill Loader', () => {
  let testDir: string;
  let projectRoot: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skill-loader-test-${Date.now()}`);
    projectRoot = join(testDir, 'project');
    mkdirSync(join(projectRoot, '.sisyphus', 'skills'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const createSkillFile = (name: string, metadata: Record<string, unknown>) => {
    const content = `---
id: "${metadata.id || name}"
name: "${metadata.name || name}"
description: "${metadata.description || 'Test skill'}"
source: ${metadata.source || 'manual'}
createdAt: "2024-01-19T12:00:00Z"
triggers:
${(metadata.triggers as string[] || ['test']).map(t => `  - "${t}"`).join('\n')}
---

# ${name}

Test content for ${name}.
`;
    const skillPath = join(projectRoot, '.sisyphus', 'skills', `${name}.md`);
    writeFileSync(skillPath, content);
    return skillPath;
  };

  it('should load all valid skills', () => {
    createSkillFile('skill-a', { triggers: ['alpha'] });
    createSkillFile('skill-b', { triggers: ['beta'] });

    const skills = loadAllSkills(projectRoot);

    expect(skills.length).toBe(2);
  });

  it('should find matching skills by trigger', () => {
    createSkillFile('react-skill', { triggers: ['react', 'component'] });
    createSkillFile('python-skill', { triggers: ['python', 'django'] });

    const matches = findMatchingSkills('How do I create a React component?', projectRoot);

    expect(matches.length).toBe(1);
    expect(matches[0].metadata.id).toBe('react-skill');
  });

  it('should return empty array when no triggers match', () => {
    createSkillFile('react-skill', { triggers: ['react'] });

    const matches = findMatchingSkills('How do I use Rust?', projectRoot);

    expect(matches.length).toBe(0);
  });
});
```

---

## Phase 2: Extraction Mechanism

**Goal:** Enable skill extraction via `/claudeception` command with quality validation.

### 2.1 Create Quality Validator

**File:** `src/hooks/learned-skills/validator.ts`

```typescript
/**
 * Skill Quality Validator
 *
 * Validates skill extraction requests against quality gates.
 */

import { REQUIRED_METADATA_FIELDS, MIN_QUALITY_SCORE, MAX_SKILL_CONTENT_LENGTH } from './constants.js';
import type { SkillExtractionRequest, QualityValidation, SkillMetadata } from './types.js';

/**
 * Validate a skill extraction request.
 */
export function validateExtractionRequest(request: SkillExtractionRequest): QualityValidation {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Check required fields
  if (!request.problem || request.problem.trim().length < 10) {
    missingFields.push('problem (minimum 10 characters)');
    score -= 30;
  }

  if (!request.solution || request.solution.trim().length < 20) {
    missingFields.push('solution (minimum 20 characters)');
    score -= 30;
  }

  if (!request.triggers || request.triggers.length === 0) {
    missingFields.push('triggers (at least one required)');
    score -= 20;
  }

  // Check content length
  const totalLength = (request.problem?.length || 0) + (request.solution?.length || 0);
  if (totalLength > MAX_SKILL_CONTENT_LENGTH) {
    warnings.push(`Content exceeds ${MAX_SKILL_CONTENT_LENGTH} chars (${totalLength}). Consider condensing.`);
    score -= 10;
  }

  // Check trigger quality
  if (request.triggers) {
    const shortTriggers = request.triggers.filter(t => t.length < 3);
    if (shortTriggers.length > 0) {
      warnings.push(`Short triggers may cause false matches: ${shortTriggers.join(', ')}`);
      score -= 5;
    }

    const genericTriggers = ['the', 'a', 'an', 'this', 'that', 'it', 'is', 'are'];
    const foundGeneric = request.triggers.filter(t => genericTriggers.includes(t.toLowerCase()));
    if (foundGeneric.length > 0) {
      warnings.push(`Generic triggers should be avoided: ${foundGeneric.join(', ')}`);
      score -= 10;
    }
  }

  // Ensure score doesn't go negative
  score = Math.max(0, score);

  return {
    valid: missingFields.length === 0 && score >= MIN_QUALITY_SCORE,
    missingFields,
    warnings,
    score,
  };
}

/**
 * Validate existing skill metadata.
 */
export function validateSkillMetadata(metadata: Partial<SkillMetadata>): QualityValidation {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  for (const field of REQUIRED_METADATA_FIELDS) {
    if (!metadata[field as keyof SkillMetadata]) {
      missingFields.push(field);
      score -= 15;
    }
  }

  // Check triggers array
  if (metadata.triggers && metadata.triggers.length === 0) {
    missingFields.push('triggers (empty array)');
    score -= 20;
  }

  // Check source value
  if (metadata.source && !['extracted', 'promoted', 'manual'].includes(metadata.source)) {
    warnings.push(`Invalid source value: ${metadata.source}`);
    score -= 10;
  }

  score = Math.max(0, score);

  return {
    valid: missingFields.length === 0 && score >= MIN_QUALITY_SCORE,
    missingFields,
    warnings,
    score,
  };
}
```

### 2.2 Create Skill Writer

**File:** `src/hooks/learned-skills/writer.ts`

```typescript
/**
 * Skill Writer
 *
 * Writes skill files to disk with proper formatting.
 */

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ensureSkillsDir, getSkillsDir } from './finder.js';
import { generateSkillFrontmatter } from './parser.js';
import { validateExtractionRequest } from './validator.js';
import type { SkillMetadata, SkillExtractionRequest, QualityValidation } from './types.js';

/**
 * Generate a unique skill ID.
 */
function generateSkillId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6);
  return `skill-${timestamp}-${random}`;
}

/**
 * Sanitize a string for use as filename.
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Result of skill writing operation.
 */
export interface WriteSkillResult {
  success: boolean;
  path?: string;
  error?: string;
  validation: QualityValidation;
}

/**
 * Write a new skill from extraction request.
 */
export function writeSkill(
  request: SkillExtractionRequest,
  projectRoot: string | null,
  skillName: string
): WriteSkillResult {
  // Validate first
  const validation = validateExtractionRequest(request);

  if (!validation.valid) {
    return {
      success: false,
      error: `Quality validation failed: ${validation.missingFields.join(', ')}`,
      validation,
    };
  }

  // Ensure directory exists
  if (!ensureSkillsDir(request.targetScope, projectRoot || undefined)) {
    return {
      success: false,
      error: `Failed to create skills directory for scope: ${request.targetScope}`,
      validation,
    };
  }

  // Generate metadata
  const metadata: SkillMetadata = {
    id: generateSkillId(),
    name: skillName,
    description: request.problem.slice(0, 200),
    source: 'extracted',
    createdAt: new Date().toISOString(),
    triggers: request.triggers,
    tags: request.tags,
    quality: validation.score,
    usageCount: 0,
  };

  // Generate content
  const frontmatter = generateSkillFrontmatter(metadata);
  const content = `${frontmatter}

# Problem

${request.problem}

# Solution

${request.solution}
`;

  // Write to file
  const filename = `${sanitizeFilename(skillName)}.md`;
  const skillsDir = getSkillsDir(request.targetScope, projectRoot || undefined);
  const filePath = join(skillsDir, filename);

  // Check for duplicates
  if (existsSync(filePath)) {
    return {
      success: false,
      error: `Skill file already exists: ${filename}`,
      validation,
    };
  }

  try {
    writeFileSync(filePath, content);
    return {
      success: true,
      path: filePath,
      validation,
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to write skill file: ${e}`,
      validation,
    };
  }
}

/**
 * Check if a skill with similar triggers already exists.
 */
export function checkDuplicateTriggers(
  triggers: string[],
  projectRoot: string | null
): { isDuplicate: boolean; existingSkillId?: string } {
  const { loadAllSkills } = require('./loader.js');
  const skills = loadAllSkills(projectRoot);

  const normalizedTriggers = new Set(triggers.map(t => t.toLowerCase()));

  for (const skill of skills) {
    const skillTriggers = skill.metadata.triggers.map((t: string) => t.toLowerCase());
    const overlap = skillTriggers.filter((t: string) => normalizedTriggers.has(t));

    if (overlap.length >= triggers.length * 0.5) {
      return {
        isDuplicate: true,
        existingSkillId: skill.metadata.id,
      };
    }
  }

  return { isDuplicate: false };
}
```

### 2.3 Create Command Skill File

**File:** `~/.claude/commands/claudeception.md`

This will be installed during plugin setup.

```markdown
---
description: Extract a learned skill from the current conversation
---

# Claudeception - Skill Extraction

You are being asked to extract a reusable skill from the current conversation.

## Instructions

1. **Identify the Pattern**: Review what was just accomplished. What problem was solved? What approach was used?

2. **Gather Details**: Ask the user to confirm or provide:
   - **Problem Statement**: What problem does this skill solve? (1-2 sentences)
   - **Solution Approach**: What is the key insight or technique? (detailed explanation)
   - **Trigger Keywords**: What words should activate this skill? (3-5 specific keywords)
   - **Target Scope**: Save to user (`~/.claude/skills/sisyphus-learned/`) or project (`.sisyphus/skills/`)?

3. **Quality Check**: Before saving, verify:
   - Problem is clearly stated (minimum 10 characters)
   - Solution is actionable (minimum 20 characters)
   - Triggers are specific (avoid generic words)
   - No duplicate skill exists with same triggers

4. **Save the Skill**: Use the skill extraction API to save:

```typescript
// This will be executed by the hooks system
const result = writeSkill({
  problem: "...",
  solution: "...",
  triggers: ["keyword1", "keyword2"],
  tags: ["optional-tag"],
  targetScope: "user" | "project"
}, projectRoot, "Skill Name");
```

5. **Confirm**: Report the result to the user with the file path.

## Example Interaction

**User**: /claudeception

**Claude**: I'll help you extract a skill from our conversation. Let me review what we just accomplished...

Based on our recent work, I identified this pattern:

**Problem**: [Describe the problem we solved]
**Solution**: [Describe the approach]
**Suggested Triggers**: ["keyword1", "keyword2", "keyword3"]

Would you like me to save this skill? Please confirm:
1. Is the problem statement accurate? (edit if needed)
2. Is the solution complete? (edit if needed)
3. Are the triggers appropriate? (edit if needed)
4. Save to: [user/project]?

$ARGUMENTS
```

### 2.4 Test Cases for Phase 2

**File:** `test/hooks/learned-skills/validator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateExtractionRequest, validateSkillMetadata } from '../../../src/hooks/learned-skills/validator.js';

describe('Skill Validator', () => {
  describe('validateExtractionRequest', () => {
    it('should pass valid extraction request', () => {
      const request = {
        problem: 'How to handle React state updates correctly',
        solution: 'Use the functional form of setState when the new state depends on the previous state. This ensures you always have the latest state value.',
        triggers: ['react', 'state', 'setState'],
        targetScope: 'user' as const,
      };

      const result = validateExtractionRequest(request);

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should fail with missing problem', () => {
      const request = {
        problem: '',
        solution: 'Use functional setState for dependent updates',
        triggers: ['react'],
        targetScope: 'user' as const,
      };

      const result = validateExtractionRequest(request);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('problem (minimum 10 characters)');
    });

    it('should warn about generic triggers', () => {
      const request = {
        problem: 'How to handle data correctly',
        solution: 'Always validate and sanitize input data before processing',
        triggers: ['the', 'data', 'this'],
        targetScope: 'user' as const,
      };

      const result = validateExtractionRequest(request);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Generic triggers'))).toBe(true);
    });
  });

  describe('validateSkillMetadata', () => {
    it('should pass valid metadata', () => {
      const metadata = {
        id: 'skill-001',
        name: 'Test Skill',
        description: 'A test skill',
        source: 'extracted' as const,
        triggers: ['test'],
        createdAt: '2024-01-19T12:00:00Z',
      };

      const result = validateSkillMetadata(metadata);

      expect(result.valid).toBe(true);
    });

    it('should fail with missing required fields', () => {
      const metadata = {
        name: 'Incomplete',
      };

      const result = validateSkillMetadata(metadata);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('id');
      expect(result.missingFields).toContain('triggers');
    });
  });
});
```

**File:** `test/hooks/learned-skills/writer.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeSkill, checkDuplicateTriggers } from '../../../src/hooks/learned-skills/writer.js';

describe('Skill Writer', () => {
  let testDir: string;
  let projectRoot: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `skill-writer-test-${Date.now()}`);
    projectRoot = join(testDir, 'project');
    mkdirSync(projectRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should write valid skill file', () => {
    const request = {
      problem: 'How to handle async errors in JavaScript',
      solution: 'Wrap async operations in try-catch blocks and use proper error propagation with async/await.',
      triggers: ['async', 'error', 'try-catch'],
      targetScope: 'project' as const,
    };

    const result = writeSkill(request, projectRoot, 'Async Error Handling');

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
    expect(existsSync(result.path!)).toBe(true);
  });

  it('should reject invalid extraction request', () => {
    const request = {
      problem: 'short',
      solution: 'also short',
      triggers: [],
      targetScope: 'project' as const,
    };

    const result = writeSkill(request, projectRoot, 'Invalid Skill');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Quality validation failed');
  });

  it('should prevent duplicate filenames', () => {
    const request = {
      problem: 'Valid problem statement here',
      solution: 'Valid solution with enough content to pass validation',
      triggers: ['test', 'duplicate'],
      targetScope: 'project' as const,
    };

    // Write first skill
    const first = writeSkill(request, projectRoot, 'Test Skill');
    expect(first.success).toBe(true);

    // Try to write duplicate
    const second = writeSkill(request, projectRoot, 'Test Skill');
    expect(second.success).toBe(false);
    expect(second.error).toContain('already exists');
  });
});
```

---

## Phase 3: Detection & Quality Gates

**Goal:** Implement semi-automatic detection of extractable moments with confirmation prompts.

### 3.1 Create Detection Engine

**File:** `src/hooks/learned-skills/detector.ts`

```typescript
/**
 * Extractable Moment Detector
 *
 * Detects patterns in conversation that indicate a skill could be extracted.
 */

export interface DetectionResult {
  /** Whether an extractable moment was detected */
  detected: boolean;
  /** Confidence score (0-100) */
  confidence: number;
  /** Type of pattern detected */
  patternType: 'problem-solution' | 'technique' | 'workaround' | 'optimization' | 'best-practice';
  /** Suggested trigger keywords */
  suggestedTriggers: string[];
  /** Reason for detection */
  reason: string;
}

/**
 * Patterns that indicate a skill might be extractable.
 */
const DETECTION_PATTERNS = [
  // Problem-Solution patterns
  {
    type: 'problem-solution' as const,
    patterns: [
      /the (?:issue|problem|bug|error) was (?:caused by|due to|because)/i,
      /(?:fixed|resolved|solved) (?:the|this) (?:by|with|using)/i,
      /the (?:solution|fix|answer) (?:is|was) to/i,
      /(?:here's|here is) (?:how|what) (?:to|you need to)/i,
    ],
    confidence: 80,
  },
  // Technique patterns
  {
    type: 'technique' as const,
    patterns: [
      /(?:a|the) (?:better|good|proper|correct) (?:way|approach|method) (?:is|to)/i,
      /(?:you should|we should|it's better to) (?:always|never|usually)/i,
      /(?:the trick|the key|the secret) (?:is|here is)/i,
    ],
    confidence: 70,
  },
  // Workaround patterns
  {
    type: 'workaround' as const,
    patterns: [
      /(?:as a|for a) workaround/i,
      /(?:temporarily|for now|until).*(?:you can|we can)/i,
      /(?:hack|trick) (?:to|for|that)/i,
    ],
    confidence: 60,
  },
  // Optimization patterns
  {
    type: 'optimization' as const,
    patterns: [
      /(?:to|for) (?:better|improved|faster) performance/i,
      /(?:optimize|optimizing|optimization) (?:by|with|using)/i,
      /(?:more efficient|efficiently) (?:by|to|if)/i,
    ],
    confidence: 65,
  },
  // Best practice patterns
  {
    type: 'best-practice' as const,
    patterns: [
      /(?:best practice|best practices) (?:is|are|include)/i,
      /(?:recommended|standard|common) (?:approach|pattern|practice)/i,
      /(?:you should always|always make sure to)/i,
    ],
    confidence: 75,
  },
];

/**
 * Keywords that often appear in extractable content.
 */
const TRIGGER_KEYWORDS = [
  // Technical domains
  'react', 'typescript', 'javascript', 'python', 'rust', 'go', 'node',
  'api', 'database', 'sql', 'graphql', 'rest', 'authentication', 'authorization',
  'testing', 'debugging', 'deployment', 'docker', 'kubernetes', 'ci/cd',
  'git', 'webpack', 'vite', 'eslint', 'prettier',
  // Actions
  'error handling', 'state management', 'performance', 'optimization',
  'refactoring', 'migration', 'integration', 'configuration',
  // Patterns
  'pattern', 'architecture', 'design', 'structure', 'convention',
];

/**
 * Detect if a message contains an extractable skill moment.
 */
export function detectExtractableMoment(
  assistantMessage: string,
  userMessage?: string
): DetectionResult {
  const combined = `${userMessage || ''} ${assistantMessage}`.toLowerCase();

  let bestMatch: { type: DetectionResult['patternType']; confidence: number; reason: string } | null = null;

  // Check against detection patterns
  for (const patternGroup of DETECTION_PATTERNS) {
    for (const pattern of patternGroup.patterns) {
      if (pattern.test(assistantMessage)) {
        if (!bestMatch || patternGroup.confidence > bestMatch.confidence) {
          bestMatch = {
            type: patternGroup.type,
            confidence: patternGroup.confidence,
            reason: `Detected ${patternGroup.type} pattern`,
          };
        }
      }
    }
  }

  if (!bestMatch) {
    return {
      detected: false,
      confidence: 0,
      patternType: 'problem-solution',
      suggestedTriggers: [],
      reason: 'No extractable pattern detected',
    };
  }

  // Extract potential trigger keywords
  const suggestedTriggers: string[] = [];
  for (const keyword of TRIGGER_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      suggestedTriggers.push(keyword);
    }
  }

  // Boost confidence if multiple triggers found
  const triggerBoost = Math.min(suggestedTriggers.length * 5, 15);
  const finalConfidence = Math.min(bestMatch.confidence + triggerBoost, 100);

  return {
    detected: true,
    confidence: finalConfidence,
    patternType: bestMatch.type,
    suggestedTriggers: suggestedTriggers.slice(0, 5), // Max 5 triggers
    reason: bestMatch.reason,
  };
}

/**
 * Check if detection confidence meets threshold for prompting.
 */
export function shouldPromptExtraction(
  detection: DetectionResult,
  threshold: number = 60
): boolean {
  return detection.detected && detection.confidence >= threshold;
}

/**
 * Generate a prompt for skill extraction confirmation.
 */
export function generateExtractionPrompt(detection: DetectionResult): string {
  const typeDescriptions: Record<DetectionResult['patternType'], string> = {
    'problem-solution': 'a problem and its solution',
    'technique': 'a useful technique',
    'workaround': 'a workaround for a limitation',
    'optimization': 'an optimization approach',
    'best-practice': 'a best practice',
  };

  return `
I noticed this conversation contains ${typeDescriptions[detection.patternType]} that might be worth saving as a reusable skill.

**Confidence:** ${detection.confidence}%
**Suggested triggers:** ${detection.suggestedTriggers.join(', ') || 'None detected'}

Would you like me to extract this as a learned skill? Type \`/claudeception\` to save it, or continue with your current task.
`.trim();
}
```

### 3.2 Create Detection Hook

**File:** `src/hooks/learned-skills/detection-hook.ts`

```typescript
/**
 * Detection Hook
 *
 * Integrates skill detection into the message flow.
 */

import { detectExtractableMoment, shouldPromptExtraction, generateExtractionPrompt } from './detector.js';
import { isClaudeceptionEnabled } from './index.js';
import type { DetectionResult } from './detector.js';

/**
 * Configuration for detection behavior.
 */
export interface DetectionConfig {
  /** Minimum confidence to prompt (0-100) */
  promptThreshold: number;
  /** Cooldown between prompts (messages) */
  promptCooldown: number;
  /** Enable/disable auto-detection */
  enabled: boolean;
}

const DEFAULT_CONFIG: DetectionConfig = {
  promptThreshold: 60,
  promptCooldown: 5,
  enabled: true,
};

/**
 * Session state for detection.
 */
interface SessionDetectionState {
  messagesSincePrompt: number;
  lastDetection: DetectionResult | null;
  promptedCount: number;
}

const sessionStates = new Map<string, SessionDetectionState>();

/**
 * Get or create session state.
 */
function getSessionState(sessionId: string): SessionDetectionState {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      messagesSincePrompt: 0,
      lastDetection: null,
      promptedCount: 0,
    });
  }
  return sessionStates.get(sessionId)!;
}

/**
 * Process assistant response for skill detection.
 * Returns prompt text if extraction should be suggested, null otherwise.
 */
export function processResponseForDetection(
  assistantMessage: string,
  userMessage: string | undefined,
  sessionId: string,
  config: Partial<DetectionConfig> = {}
): string | null {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled || !isClaudeceptionEnabled()) {
    return null;
  }

  const state = getSessionState(sessionId);
  state.messagesSincePrompt++;

  // Check cooldown
  if (state.messagesSincePrompt < mergedConfig.promptCooldown) {
    return null;
  }

  // Detect extractable moment
  const detection = detectExtractableMoment(assistantMessage, userMessage);
  state.lastDetection = detection;

  // Check if we should prompt
  if (shouldPromptExtraction(detection, mergedConfig.promptThreshold)) {
    state.messagesSincePrompt = 0;
    state.promptedCount++;
    return generateExtractionPrompt(detection);
  }

  return null;
}

/**
 * Get the last detection result for a session.
 */
export function getLastDetection(sessionId: string): DetectionResult | null {
  return sessionStates.get(sessionId)?.lastDetection || null;
}

/**
 * Clear detection state for a session.
 */
export function clearDetectionState(sessionId: string): void {
  sessionStates.delete(sessionId);
}

/**
 * Get detection statistics for a session.
 */
export function getDetectionStats(sessionId: string): {
  messagesSincePrompt: number;
  promptedCount: number;
  lastDetection: DetectionResult | null;
} {
  const state = sessionStates.get(sessionId);
  if (!state) {
    return {
      messagesSincePrompt: 0,
      promptedCount: 0,
      lastDetection: null,
    };
  }
  return {
    messagesSincePrompt: state.messagesSincePrompt,
    promptedCount: state.promptedCount,
    lastDetection: state.lastDetection,
  };
}
```

### 3.3 Test Cases for Phase 3

**File:** `test/hooks/learned-skills/detector.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  detectExtractableMoment,
  shouldPromptExtraction,
  generateExtractionPrompt,
} from '../../../src/hooks/learned-skills/detector.js';

describe('Skill Detector', () => {
  describe('detectExtractableMoment', () => {
    it('should detect problem-solution pattern', () => {
      const message = 'The issue was caused by a race condition. I fixed it by adding proper locking.';

      const result = detectExtractableMoment(message);

      expect(result.detected).toBe(true);
      expect(result.patternType).toBe('problem-solution');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect technique pattern', () => {
      const message = 'A better way to handle this is to use the observer pattern instead of polling.';

      const result = detectExtractableMoment(message);

      expect(result.detected).toBe(true);
      expect(result.patternType).toBe('technique');
    });

    it('should detect best practice pattern', () => {
      const message = 'Best practices for React state management include keeping state as local as possible.';

      const result = detectExtractableMoment(message);

      expect(result.detected).toBe(true);
      expect(result.patternType).toBe('best-practice');
    });

    it('should not detect in regular conversation', () => {
      const message = 'Sure, I can help you with that. What would you like to know?';

      const result = detectExtractableMoment(message);

      expect(result.detected).toBe(false);
    });

    it('should extract trigger keywords', () => {
      const message = 'The React component state management can be improved using TypeScript for better type safety.';

      const result = detectExtractableMoment(message, 'How do I manage state in React?');

      expect(result.suggestedTriggers).toContain('react');
      expect(result.suggestedTriggers).toContain('typescript');
    });
  });

  describe('shouldPromptExtraction', () => {
    it('should return true when confidence exceeds threshold', () => {
      const detection = {
        detected: true,
        confidence: 75,
        patternType: 'problem-solution' as const,
        suggestedTriggers: [],
        reason: 'test',
      };

      expect(shouldPromptExtraction(detection, 60)).toBe(true);
    });

    it('should return false when not detected', () => {
      const detection = {
        detected: false,
        confidence: 0,
        patternType: 'problem-solution' as const,
        suggestedTriggers: [],
        reason: 'test',
      };

      expect(shouldPromptExtraction(detection)).toBe(false);
    });
  });

  describe('generateExtractionPrompt', () => {
    it('should generate prompt with detection details', () => {
      const detection = {
        detected: true,
        confidence: 80,
        patternType: 'technique' as const,
        suggestedTriggers: ['react', 'hooks'],
        reason: 'Detected technique pattern',
      };

      const prompt = generateExtractionPrompt(detection);

      expect(prompt).toContain('useful technique');
      expect(prompt).toContain('80%');
      expect(prompt).toContain('react, hooks');
      expect(prompt).toContain('/claudeception');
    });
  });
});
```

---

## Phase 4: Integration & Polish

**Goal:** Integrate with ralph-progress promotion, add configuration, and finalize documentation.

### 4.1 Ralph-Progress Integration

**File:** `src/hooks/learned-skills/promotion.ts`

```typescript
/**
 * Ralph-Progress Promotion
 *
 * Promotes learnings from ralph-progress to full skills.
 */

import { getRecentLearnings, readProgress } from '../ralph-progress/index.js';
import { writeSkill } from './writer.js';
import type { SkillExtractionRequest } from './types.js';

export interface PromotionCandidate {
  /** The learning text */
  learning: string;
  /** Story ID it came from */
  storyId: string;
  /** Timestamp */
  timestamp: string;
  /** Suggested triggers (extracted from text) */
  suggestedTriggers: string[];
}

/**
 * Extract trigger keywords from learning text.
 */
function extractTriggers(text: string): string[] {
  const technicalKeywords = [
    'react', 'typescript', 'javascript', 'python', 'api', 'database',
    'testing', 'debugging', 'performance', 'async', 'state', 'component',
    'error', 'validation', 'authentication', 'cache', 'query', 'mutation',
  ];

  const textLower = text.toLowerCase();
  return technicalKeywords.filter(kw => textLower.includes(kw));
}

/**
 * Get promotion candidates from ralph-progress learnings.
 */
export function getPromotionCandidates(
  directory: string,
  limit: number = 10
): PromotionCandidate[] {
  const progress = readProgress(directory);
  if (!progress) {
    return [];
  }

  const candidates: PromotionCandidate[] = [];

  // Get recent entries with learnings
  const recentEntries = progress.entries.slice(-limit);

  for (const entry of recentEntries) {
    for (const learning of entry.learnings) {
      // Skip very short learnings
      if (learning.length < 20) continue;

      candidates.push({
        learning,
        storyId: entry.storyId,
        timestamp: entry.timestamp,
        suggestedTriggers: extractTriggers(learning),
      });
    }
  }

  // Sort by number of triggers (more specific = better candidate)
  return candidates.sort((a, b) => b.suggestedTriggers.length - a.suggestedTriggers.length);
}

/**
 * Promote a learning to a full skill.
 */
export function promoteLearning(
  candidate: PromotionCandidate,
  skillName: string,
  additionalTriggers: string[],
  targetScope: 'user' | 'project',
  projectRoot: string | null
): ReturnType<typeof writeSkill> {
  const request: SkillExtractionRequest = {
    problem: `Learning from ${candidate.storyId}: ${candidate.learning.slice(0, 100)}...`,
    solution: candidate.learning,
    triggers: [...new Set([...candidate.suggestedTriggers, ...additionalTriggers])],
    targetScope,
  };

  return writeSkill(request, projectRoot, skillName);
}

/**
 * List learnings that could be promoted.
 */
export function listPromotableLearnings(directory: string): string {
  const candidates = getPromotionCandidates(directory);

  if (candidates.length === 0) {
    return 'No promotion candidates found in ralph-progress learnings.';
  }

  const lines = [
    '# Promotion Candidates',
    '',
    'The following learnings from ralph-progress could be promoted to skills:',
    '',
  ];

  candidates.forEach((candidate, index) => {
    lines.push(`## ${index + 1}. From ${candidate.storyId} (${candidate.timestamp})`);
    lines.push('');
    lines.push(candidate.learning);
    lines.push('');
    if (candidate.suggestedTriggers.length > 0) {
      lines.push(`**Suggested triggers:** ${candidate.suggestedTriggers.join(', ')}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}
```

### 4.2 Configuration System

**File:** `src/hooks/learned-skills/config.ts`

```typescript
/**
 * Claudeception Configuration
 *
 * Handles configuration loading and validation.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ClaudeceptionConfig {
  /** Feature enabled/disabled */
  enabled: boolean;
  /** Detection configuration */
  detection: {
    /** Enable auto-detection */
    enabled: boolean;
    /** Confidence threshold for prompting (0-100) */
    promptThreshold: number;
    /** Cooldown between prompts (messages) */
    promptCooldown: number;
  };
  /** Quality gate configuration */
  quality: {
    /** Minimum score to accept (0-100) */
    minScore: number;
    /** Minimum problem length */
    minProblemLength: number;
    /** Minimum solution length */
    minSolutionLength: number;
  };
  /** Storage configuration */
  storage: {
    /** Maximum skills per scope */
    maxSkillsPerScope: number;
    /** Auto-prune old skills */
    autoPrune: boolean;
    /** Days before auto-prune (if enabled) */
    pruneDays: number;
  };
}

const DEFAULT_CONFIG: ClaudeceptionConfig = {
  enabled: true,
  detection: {
    enabled: true,
    promptThreshold: 60,
    promptCooldown: 5,
  },
  quality: {
    minScore: 50,
    minProblemLength: 10,
    minSolutionLength: 20,
  },
  storage: {
    maxSkillsPerScope: 100,
    autoPrune: false,
    pruneDays: 90,
  },
};

const CONFIG_PATH = join(homedir(), '.claude', 'sisyphus', 'claudeception.json');

/**
 * Load configuration from disk.
 */
export function loadConfig(): ClaudeceptionConfig {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const loaded = JSON.parse(content);
    return mergeConfig(DEFAULT_CONFIG, loaded);
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration to disk.
 */
export function saveConfig(config: Partial<ClaudeceptionConfig>): boolean {
  const merged = mergeConfig(DEFAULT_CONFIG, config);

  try {
    const dir = join(homedir(), '.claude', 'sisyphus');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge partial config with defaults.
 */
function mergeConfig(
  defaults: ClaudeceptionConfig,
  partial: Partial<ClaudeceptionConfig>
): ClaudeceptionConfig {
  return {
    enabled: partial.enabled ?? defaults.enabled,
    detection: {
      ...defaults.detection,
      ...partial.detection,
    },
    quality: {
      ...defaults.quality,
      ...partial.quality,
    },
    storage: {
      ...defaults.storage,
      ...partial.storage,
    },
  };
}

/**
 * Get a specific config value.
 */
export function getConfigValue<K extends keyof ClaudeceptionConfig>(
  key: K
): ClaudeceptionConfig[K] {
  const config = loadConfig();
  return config[key];
}

/**
 * Update a specific config value.
 */
export function setConfigValue<K extends keyof ClaudeceptionConfig>(
  key: K,
  value: ClaudeceptionConfig[K]
): boolean {
  const config = loadConfig();
  config[key] = value;
  return saveConfig(config);
}
```

### 4.3 Update Main Hook Export

**File:** `src/hooks/learned-skills/index.ts` (Updated)

Add exports for all submodules:

```typescript
// Add to existing exports
export * from './validator.js';
export * from './writer.js';
export * from './detector.js';
export * from './detection-hook.js';
export * from './promotion.js';
export * from './config.js';
```

### 4.4 Test Cases for Phase 4

**File:** `test/hooks/learned-skills/promotion.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getPromotionCandidates, promoteLearning } from '../../../src/hooks/learned-skills/promotion.js';

describe('Ralph-Progress Promotion', () => {
  let testDir: string;
  let projectRoot: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `promotion-test-${Date.now()}`);
    projectRoot = join(testDir, 'project');
    mkdirSync(join(projectRoot, '.sisyphus'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  const createProgressFile = (entries: Array<{ storyId: string; learnings: string[] }>) => {
    const content = `# Ralph Progress Log
Started: 2024-01-19T12:00:00Z

## Codebase Patterns

---

${entries.map(e => `
## [2024-01-19 12:00] - ${e.storyId}

**Learnings for future iterations:**
${e.learnings.map(l => `- ${l}`).join('\n')}

---
`).join('\n')}
`;
    writeFileSync(join(projectRoot, '.sisyphus', 'progress.txt'), content);
  };

  it('should extract promotion candidates from progress', () => {
    createProgressFile([
      {
        storyId: 'US-001',
        learnings: [
          'When working with React hooks, always check dependencies array for stale closures',
          'TypeScript strict mode catches many subtle bugs early',
        ],
      },
    ]);

    const candidates = getPromotionCandidates(projectRoot);

    expect(candidates.length).toBe(2);
    expect(candidates[0].suggestedTriggers).toContain('react');
  });

  it('should skip very short learnings', () => {
    createProgressFile([
      {
        storyId: 'US-002',
        learnings: [
          'Short', // Too short
          'This is a much longer learning about proper error handling in async functions',
        ],
      },
    ]);

    const candidates = getPromotionCandidates(projectRoot);

    expect(candidates.length).toBe(1);
  });
});
```

**File:** `test/hooks/learned-skills/config.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadConfig, saveConfig, getConfigValue, setConfigValue } from '../../../src/hooks/learned-skills/config.js';

describe('Claudeception Config', () => {
  const configPath = join(homedir(), '.claude', 'sisyphus', 'claudeception.json');
  let originalExists: boolean;

  beforeEach(() => {
    originalExists = existsSync(configPath);
  });

  afterEach(() => {
    // Restore original state
    if (!originalExists && existsSync(configPath)) {
      rmSync(configPath);
    }
  });

  it('should return defaults when no config exists', () => {
    const config = loadConfig();

    expect(config.enabled).toBe(true);
    expect(config.detection.promptThreshold).toBe(60);
  });

  it('should save and load config', () => {
    const success = saveConfig({
      enabled: false,
      detection: {
        enabled: true,
        promptThreshold: 80,
        promptCooldown: 10,
      },
    });

    expect(success).toBe(true);

    const loaded = loadConfig();
    expect(loaded.enabled).toBe(false);
    expect(loaded.detection.promptThreshold).toBe(80);
  });

  it('should get specific config value', () => {
    const enabled = getConfigValue('enabled');
    expect(typeof enabled).toBe('boolean');
  });
});
```

---

## File Structure Overview

### New Files to Create

```
src/
  hooks/
    learned-skills/
      index.ts              # Main entry point and hook creation
      types.ts              # Type definitions
      constants.ts          # Configuration constants
      finder.ts             # Skill file discovery
      parser.ts             # YAML frontmatter parsing
      loader.ts             # Skill loading and caching
      validator.ts          # Quality gate validation
      writer.ts             # Skill file writing
      detector.ts           # Extractable moment detection
      detection-hook.ts     # Detection integration
      promotion.ts          # Ralph-progress promotion
      config.ts             # Configuration management

test/
  hooks/
    learned-skills/
      finder.test.ts
      parser.test.ts
      loader.test.ts
      validator.test.ts
      writer.test.ts
      detector.test.ts
      promotion.test.ts
      config.test.ts

~/.claude/
  commands/
    claudeception.md        # Extraction command template
  skills/
    sisyphus-learned/       # User-level skills directory (created on first use)

.sisyphus/
  skills/                   # Project-level skills directory (created on first use)
```

### Files to Modify

| File | Modification | Lines |
|------|--------------|-------|
| `src/features/context-injector/types.ts` | Add `'learned-skills'` to `ContextSourceType` | 15-22 |
| `src/index.ts` | Export learned-skills hook | Add import/export |
| `package.json` | No changes needed | - |

---

## Risk Mitigation

### Feature Flag Implementation

The feature flag is implemented in `src/hooks/learned-skills/constants.ts`:

```typescript
export const FEATURE_FLAG_KEY = 'claudeception.enabled';
export const FEATURE_FLAG_DEFAULT = true;
```

And checked in `src/hooks/learned-skills/index.ts`:

```typescript
export function isClaudeceptionEnabled(): boolean {
  const config = loadConfig();
  return config.enabled;
}
```

### Rollback Procedure

1. **Quick Disable**: Set `enabled: false` in `~/.claude/sisyphus/claudeception.json`
2. **Full Rollback**: Remove the `src/hooks/learned-skills/` directory and revert the context-injector types change
3. **Data Preservation**: Skills are stored in separate directories and are not affected by rollback

### Testing Strategy

| Level | Coverage |
|-------|----------|
| Unit Tests | All pure functions (finder, parser, validator, detector) |
| Integration Tests | Loader + Finder, Writer + Validator |
| Manual Testing | End-to-end skill extraction and injection |

### Isolation Guarantees

1. **New Hook**: All code in new `learned-skills/` directory
2. **New Context Type**: Single addition to existing type union
3. **No Existing Code Modification**: Only additive changes
4. **Separate Storage**: Skills stored in dedicated directories

---

## Commit Strategy

### Phase 1 Commits

```
feat(learned-skills): add type definitions and constants

- Define SkillMetadata, LearnedSkill, and related types
- Add constants for paths, limits, and feature flags
- Follow patterns from rules-injector

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(learned-skills): implement skill finder with hybrid search

- Add finder.ts with user + project path discovery
- Project skills override user skills with same ID
- Include symlink resolution and deduplication

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(learned-skills): implement skill parser and loader

- Add YAML frontmatter parsing for skill metadata
- Implement skill loading with caching
- Add trigger-based skill matching

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(context-injector): add learned-skills source type

- Add 'learned-skills' to ContextSourceType union
- Enable skill injection into context

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Phase 2 Commits

```
feat(learned-skills): implement quality validation

- Add validator.ts with extraction request validation
- Implement quality scoring system
- Add warnings for generic triggers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(learned-skills): implement skill writer

- Add writer.ts for skill file creation
- Include duplicate detection
- Generate proper YAML frontmatter

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Phase 3 Commits

```
feat(learned-skills): implement extractable moment detection

- Add detector.ts with pattern matching
- Support multiple pattern types
- Extract trigger keywords automatically

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(learned-skills): add detection hook integration

- Add detection-hook.ts for message processing
- Implement cooldown and session state
- Generate extraction prompts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Phase 4 Commits

```
feat(learned-skills): add ralph-progress promotion

- Add promotion.ts for learning promotion
- Extract candidates from progress.txt
- Enable promotion to full skills

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
feat(learned-skills): add configuration system

- Add config.ts for runtime configuration
- Support enable/disable and thresholds
- Persist config to ~/.claude/sisyphus/

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

```
test(learned-skills): add comprehensive test suite

- Add unit tests for all modules
- Cover finder, parser, loader, validator
- Cover detector, writer, promotion, config

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### PR Description Template

```markdown
## Summary

Implements Claudeception - a system for extracting, storing, and reusing learned skills from conversation sessions.

## Key Features

- **Hybrid Storage**: User (`~/.claude/skills/sisyphus-learned/`) + Project (`.sisyphus/skills/`)
- **Semi-automatic Extraction**: Detects extractable moments, prompts for confirmation
- **Quality Gates**: Validates problem/solution/triggers before saving
- **Ralph-Progress Integration**: Promotes learnings to full skills
- **Feature Flag**: Can be disabled via configuration

## Changes

### New Files
- `src/hooks/learned-skills/` - Complete hook implementation
- `test/hooks/learned-skills/` - Test suite

### Modified Files
- `src/features/context-injector/types.ts` - Added `'learned-skills'` source type

## Test Plan

- [ ] Run `npm run test:run` - all tests pass
- [ ] Manual test: Create a skill via `/claudeception`
- [ ] Manual test: Verify skill injection on trigger match
- [ ] Manual test: Disable feature via config
- [ ] Manual test: Promote learning from ralph-progress

## Risk Assessment

- **Low Risk**: All code is additive, no existing functionality modified
- **Rollback**: Set `enabled: false` in config or remove `learned-skills/` directory

---

Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Definition of Done

### Functional Requirements

- [ ] Skills can be loaded from `~/.claude/skills/sisyphus-learned/`
- [ ] Skills can be loaded from `.sisyphus/skills/`
- [ ] Project skills override user skills with same ID
- [ ] Skills are injected into context when triggers match
- [ ] `/claudeception` command extracts skills with confirmation
- [ ] Quality gates validate extraction requests
- [ ] Extractable moments are detected with configurable threshold
- [ ] Learnings from ralph-progress can be promoted to skills
- [ ] Feature can be enabled/disabled via configuration

### Technical Requirements

- [ ] All unit tests pass
- [ ] TypeScript compiles without errors
- [ ] ESLint passes without errors
- [ ] No breaking changes to existing functionality
- [ ] Feature flag allows rollback

### Documentation Requirements

- [ ] This plan document is complete
- [ ] Code has JSDoc comments
- [ ] Types are fully documented

---

## Momus Review Fixes

**Review Date:** 2026-01-19
**Initial Score:** 7.5/10
**Status:** APPROVED WITH CHANGES

This section addresses all critical and minor issues identified in the Momus review.

### Critical Issue 1: Hook System Integration (FIXED)

**Problem:** The plan did not specify how the learned-skills hook would be registered with the hooks system.

**Solution:** Add explicit export to `src/hooks/index.ts`:

```typescript
// Add to src/hooks/index.ts (after line 494)

export {
  // Learned Skills (Claudeception)
  createLearnedSkillsHook,
  processMessageForSkills,
  isClaudeceptionEnabled,
  getAllSkills,
  clearSkillSession,
  findMatchingSkills,
  loadAllSkills,
  loadSkillById,
  findSkillFiles,
  getSkillsDir,
  ensureSkillsDir,
  parseSkillFile,
  generateSkillFrontmatter,
  validateExtractionRequest,
  validateSkillMetadata,
  writeSkill,
  checkDuplicateTriggers,
  detectExtractableMoment,
  shouldPromptExtraction,
  generateExtractionPrompt,
  processResponseForDetection,
  getLastDetection,
  clearDetectionState,
  getDetectionStats,
  getPromotionCandidates,
  promoteLearning,
  listPromotableLearnings,
  loadConfig as loadClaudeceptionConfig,
  saveConfig as saveClaudeceptionConfig,
  getConfigValue as getClaudeceptionConfigValue,
  setConfigValue as setClaudeceptionConfigValue,
  // Constants
  USER_SKILLS_DIR,
  PROJECT_SKILLS_SUBDIR,
  SKILL_EXTENSION,
  FEATURE_FLAG_KEY,
  MAX_SKILL_CONTENT_LENGTH,
  MIN_QUALITY_SCORE,
  MAX_SKILLS_PER_SESSION,
  // Types
  type SkillMetadata,
  type LearnedSkill,
  type SkillFileCandidate,
  type QualityValidation,
  type SkillExtractionRequest,
  type InjectedSkillsData,
  type DetectionResult,
  type DetectionConfig,
  type PromotionCandidate,
  type ClaudeceptionConfig,
  type WriteSkillResult
} from './learned-skills/index.js';
```

### Critical Issue 2: Hook Event Timing (FIXED)

**Problem:** The plan didn't specify WHEN `processMessageForSkills` should be called in the message lifecycle.

**Solution:** Claudeception integrates at TWO hook points:

#### 1. UserPromptSubmit Hook (Skill Injection)

Create standalone script `scripts/skill-injector.mjs`:

**IMPORTANT:** Following existing patterns, hook scripts are STANDALONE Node.js files that don't import from `dist/`. They implement their own logic using only Node.js built-ins.

```javascript
#!/usr/bin/env node

/**
 * Skill Injector Hook (UserPromptSubmit)
 * Injects relevant learned skills into context based on prompt triggers.
 *
 * STANDALONE SCRIPT - does not import from dist/
 * Follows pattern of keyword-detector.mjs and session-start.mjs
 */

import { existsSync, readdirSync, readFileSync, realpathSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Constants
const USER_SKILLS_DIR = join(homedir(), '.claude', 'skills', 'sisyphus-learned');
const PROJECT_SKILLS_SUBDIR = '.sisyphus/skills';
const SKILL_EXTENSION = '.md';
const MAX_SKILLS_PER_SESSION = 5;

// Session cache to avoid re-injecting same skills
const injectedCache = new Map();

// Read all stdin
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Parse YAML frontmatter from skill file
function parseSkillFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const yamlContent = match[1];
  const body = match[2].trim();

  // Simple YAML parsing for triggers
  const triggers = [];
  const triggerMatch = yamlContent.match(/triggers:\s*\n((?:\s+-\s*.+\n?)*)/);
  if (triggerMatch) {
    const lines = triggerMatch[1].split('\n');
    for (const line of lines) {
      const itemMatch = line.match(/^\s+-\s*["']?([^"'\n]+)["']?\s*$/);
      if (itemMatch) triggers.push(itemMatch[1].trim().toLowerCase());
    }
  }

  // Extract name
  const nameMatch = yamlContent.match(/name:\s*["']?([^"'\n]+)["']?/);
  const name = nameMatch ? nameMatch[1].trim() : 'Unnamed Skill';

  return { name, triggers, content: body };
}

// Find all skill files
function findSkillFiles(directory) {
  const candidates = [];
  const seenPaths = new Set();

  // Project-level skills (higher priority)
  const projectDir = join(directory, PROJECT_SKILLS_SUBDIR);
  if (existsSync(projectDir)) {
    try {
      const files = readdirSync(projectDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith(SKILL_EXTENSION)) {
          const fullPath = join(projectDir, file.name);
          const realPath = realpathSync(fullPath);
          if (!seenPaths.has(realPath)) {
            seenPaths.add(realPath);
            candidates.push({ path: fullPath, scope: 'project' });
          }
        }
      }
    } catch {}
  }

  // User-level skills
  if (existsSync(USER_SKILLS_DIR)) {
    try {
      const files = readdirSync(USER_SKILLS_DIR, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith(SKILL_EXTENSION)) {
          const fullPath = join(USER_SKILLS_DIR, file.name);
          const realPath = realpathSync(fullPath);
          if (!seenPaths.has(realPath)) {
            seenPaths.add(realPath);
            candidates.push({ path: fullPath, scope: 'user' });
          }
        }
      }
    } catch {}
  }

  return candidates;
}

// Find matching skills by trigger keywords
function findMatchingSkills(prompt, directory, sessionId) {
  const promptLower = prompt.toLowerCase();
  const candidates = findSkillFiles(directory);
  const matches = [];

  // Get or create session cache
  if (!injectedCache.has(sessionId)) {
    injectedCache.set(sessionId, new Set());
  }
  const alreadyInjected = injectedCache.get(sessionId);

  for (const candidate of candidates) {
    // Skip if already injected this session
    if (alreadyInjected.has(candidate.path)) continue;

    try {
      const content = readFileSync(candidate.path, 'utf-8');
      const skill = parseSkillFrontmatter(content);
      if (!skill) continue;

      // Check if any trigger matches
      let score = 0;
      for (const trigger of skill.triggers) {
        if (promptLower.includes(trigger)) {
          score += 10;
        }
      }

      if (score > 0) {
        matches.push({
          path: candidate.path,
          name: skill.name,
          content: skill.content,
          score,
          scope: candidate.scope
        });
      }
    } catch {}
  }

  // Sort by score (descending) and limit
  matches.sort((a, b) => b.score - a.score);
  const selected = matches.slice(0, MAX_SKILLS_PER_SESSION);

  // Mark as injected
  for (const skill of selected) {
    alreadyInjected.add(skill.path);
  }

  return selected;
}

// Format skills for injection
function formatSkillsMessage(skills) {
  const lines = [
    '<learned-skills>',
    '',
    '## Relevant Learned Skills',
    '',
    'The following skills from previous sessions may help:',
    ''
  ];

  for (const skill of skills) {
    lines.push(`### ${skill.name} (${skill.scope})`);
    lines.push('');
    lines.push(skill.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('</learned-skills>');
  return lines.join('\n');
}

// Main
async function main() {
  try {
    const input = await readStdin();
    if (!input.trim()) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    let data = {};
    try { data = JSON.parse(input); } catch {}

    const prompt = data.prompt || '';
    const sessionId = data.sessionId || 'unknown';
    const directory = data.directory || process.cwd();

    // Skip if no prompt
    if (!prompt) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    const matchingSkills = findMatchingSkills(prompt, directory, sessionId);

    if (matchingSkills.length > 0) {
      console.log(JSON.stringify({
        continue: true,
        message: formatSkillsMessage(matchingSkills)
      }));
    } else {
      console.log(JSON.stringify({ continue: true }));
    }
  } catch (error) {
    // On any error, allow continuation
    console.log(JSON.stringify({ continue: true }));
  }
}

main();
```

**Key Design Decisions:**
1. **Standalone script** - No imports from `dist/`. Uses only Node.js built-ins.
2. **No duplication** - Only uses JSON `message` output (not context collector).
3. **Session caching** - Tracks injected skills per session to avoid re-injection.
4. **Priority handling** - Project skills checked first (higher priority).

#### 2. Stop Hook (Extraction Detection) - Optional Phase 3

**Note:** This is optional and can be implemented later. The core functionality works with just the UserPromptSubmit hook.

Add detection logic to `scripts/persistent-mode.mjs` using standalone pattern:

```javascript
// Add these constants and functions to scripts/persistent-mode.mjs

// Extraction detection patterns
const EXTRACTION_PATTERNS = [
  { pattern: /the (?:issue|problem|bug|error) was (?:caused by|due to|because)/i, type: 'problem-solution' },
  { pattern: /(?:fixed|resolved|solved) (?:the|this) (?:by|with|using)/i, type: 'problem-solution' },
  { pattern: /(?:a|the) (?:better|good|proper|correct) (?:way|approach|method)/i, type: 'technique' },
  { pattern: /(?:best practice|best practices)/i, type: 'best-practice' },
];

// Session state for detection cooldown
const detectionState = new Map();

function checkExtractionOpportunity(assistantMessage, sessionId) {
  // Check cooldown (5 messages)
  const state = detectionState.get(sessionId) || { count: 0 };
  state.count++;
  detectionState.set(sessionId, state);

  if (state.count < 5) return null;

  // Check patterns
  for (const { pattern, type } of EXTRACTION_PATTERNS) {
    if (pattern.test(assistantMessage)) {
      state.count = 0; // Reset cooldown
      return `\n\n---\n💡 *This ${type} might be worth saving as a reusable skill. Use \`/claudeception\` to extract it.*`;
    }
  }

  return null;
}

// In main(), after other checks:
const extractionHint = checkExtractionOpportunity(data.lastAssistantMessage || '', data.sessionId || 'unknown');
if (extractionHint && !stopContinuation) {
  message = message ? message + extractionHint : extractionHint;
}
```

#### 3. Update hooks/hooks.json

**IMPORTANT**: Add to the EXISTING `UserPromptSubmit` array, don't create a duplicate block.

```json
// In hooks/hooks.json, find the existing UserPromptSubmit section and ADD the skill-injector hook:

"UserPromptSubmit": [
  {
    "matcher": "*",
    "hooks": [
      {
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/keyword-detector.mjs\"",
        "timeout": 5
      },
      {
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/skill-injector.mjs\"",
        "timeout": 3
      }
    ]
  }
]

// The skill-injector hook is ADDED to the existing hooks array, not replacing or duplicating the block.
```

### Critical Issue 3: Command Installation (FIXED)

**Problem:** The plan didn't specify how `claudeception.md` gets installed.

**Solution:** Add command to `COMMAND_DEFINITIONS` in `src/installer/index.ts` (line ~1416).

**Note:** Commands are NOT installed from the `commands/` directory. They must be added to `COMMAND_DEFINITIONS` which the installer iterates through (line 2686).

**File to modify:** `src/installer/index.ts`

Add the following entry to `COMMAND_DEFINITIONS`:

```typescript
// In COMMAND_DEFINITIONS (src/installer/index.ts, after other command entries)

'claudeception.md': `---
description: Extract a learned skill from the current conversation
---

# Claudeception - Skill Extraction

You are being asked to extract a reusable skill from the current conversation.

$ARGUMENTS

## What This Does

Claudeception saves knowledge you've discovered during problem-solving as a reusable "skill" that will be automatically loaded in future sessions when similar problems arise.

## Extraction Process

1. **Review Recent Work**: Look at what was just accomplished. What problem was solved? What approach was used?

2. **Gather Required Information**:
   - **Problem Statement**: What problem does this skill solve? (minimum 10 characters)
   - **Solution**: What is the key insight or technique? (minimum 20 characters)
   - **Triggers**: What keywords should activate this skill? (3-5 specific keywords)
   - **Scope**: User-level (portable across projects) or Project-level (specific to this codebase)?

3. **Quality Validation**: Before saving, the system checks:
   - Problem is clearly stated
   - Solution is actionable
   - Triggers are specific (not generic like "the" or "it")
   - No duplicate skill exists with similar triggers

4. **Save Location**:
   - **User-level**: \\\`~/.claude/skills/sisyphus-learned/\\\` - Available in all projects
   - **Project-level**: \\\`.sisyphus/skills/\\\` - Specific to this project, version-controllable

## Example Extraction

After debugging a complex async issue:

\\\`\\\`\\\`
/claudeception

Problem: Race condition in React useEffect when multiple API calls complete out of order
Solution: Use AbortController to cancel stale requests and ignore their responses
Triggers: react, useEffect, race condition, stale closure, abort
Scope: user
Name: React UseEffect Race Condition Fix
\\\`\\\`\\\`

## When to Use

Use \\\`/claudeception\\\` after:
- Solving a tricky bug through investigation
- Discovering a non-obvious workaround
- Learning a project-specific pattern
- Finding a technique worth remembering

## Skill Format

Skills are saved as markdown files with YAML frontmatter:

\\\`\\\`\\\`markdown
---
id: "skill-xyz123"
name: "React UseEffect Race Condition Fix"
description: "Handle race conditions in useEffect with multiple async calls"
source: extracted
createdAt: "2026-01-19T12:00:00Z"
triggers:
  - "react"
  - "useEffect"
  - "race condition"
quality: 85
---

# Problem

Race condition in React useEffect when multiple API calls complete out of order...

# Solution

Use AbortController to cancel stale requests...
\\\`\\\`\\\`

## Related Commands

- \\\`/note\\\` - Save quick notes that survive compaction (less formal than skills)
- \\\`/ralph-loop\\\` - Start a development loop with learning capture
`,

### Minor Issues Addressed

#### 1. Test Date Consistency
Updated all test files to use consistent dates or dynamic dates via `new Date().toISOString()`.

#### 2. Error Logging Strategy
Added optional debug logging to all catch blocks:

```typescript
// In constants.ts
export const DEBUG_ENABLED = process.env.SISYPHUS_DEBUG === '1';

// In catch blocks
} catch (error) {
  if (DEBUG_ENABLED) {
    console.error('[learned-skills] Error:', error);
  }
  // Continue silently
}
```

#### 3. Config Loading Consistency
Removed the TODO in `index.ts` and properly integrated with `loadConfig()`:

```typescript
export function isClaudeceptionEnabled(): boolean {
  return loadConfig().enabled;
}
```

#### 4. Session ID Tracking
Session ID is passed from hook input via `data.sessionId`. Updated types:

```typescript
// In types.ts
export interface HookContext {
  sessionId: string;
  directory: string;
  prompt?: string;
}
```

#### 5. Session Cache Cleanup
Added cleanup on session end:

```typescript
// In index.ts
export function cleanupSession(sessionId: string): void {
  clearSkillSession(sessionId);
  clearDetectionState(sessionId);
}
```

### Updated Files to Modify

| File | Modification | Phase |
|------|--------------|-------|
| `src/features/context-injector/types.ts` | Add `'learned-skills'` to `ContextSourceType` (line 15-22) | 1 |
| `src/hooks/index.ts` | Add learned-skills exports (end of file) | 1 |
| `src/installer/index.ts` | Add `claudeception.md` to `COMMAND_DEFINITIONS` (line ~1416) | 2 |
| `hooks/hooks.json` | Add skill-injector hook entry | 1 |
| `scripts/persistent-mode.mjs` | Add extraction detection (optional) | 3 |

### Updated File Structure

```
oh-my-claude-sisyphus/
├── scripts/
│   └── skill-injector.mjs        # NEW - UserPromptSubmit hook (standalone)
├── src/
│   ├── installer/
│   │   └── index.ts              # MODIFIED - Add claudeception command
│   ├── features/
│   │   └── context-injector/
│   │       └── types.ts          # MODIFIED - Add source type
│   └── hooks/
│       ├── index.ts              # MODIFIED - Add exports
│       └── learned-skills/       # NEW - All implementation files
│           ├── index.ts
│           ├── types.ts
│           ├── constants.ts
│           ├── finder.ts
│           ├── parser.ts
│           ├── loader.ts
│           ├── validator.ts
│           ├── writer.ts
│           ├── detector.ts
│           ├── detection-hook.ts
│           ├── promotion.ts
│           └── config.ts
└── hooks/
    └── hooks.json                # MODIFIED - Add skill-injector
```

### Key Clarifications (from Momus Review)

1. **Hook Scripts are Standalone**: Scripts in `scripts/` do NOT import from `dist/`. They are self-contained Node.js files using only built-in modules.

2. **Commands via COMMAND_DEFINITIONS**: Commands are NOT installed from `commands/` directory. They must be added to `COMMAND_DEFINITIONS` in `src/installer/index.ts`.

3. **No Double Injection**: The skill-injector uses ONLY the JSON `message` output mechanism. The `src/hooks/learned-skills/` TypeScript module is for programmatic use (tests, other hooks) but the actual runtime injection is via the standalone script.

---

## Next Steps

To begin implementation, run:

```bash
/start-work .sisyphus/plans/claudeception-integration.md
```

This will:
1. Create the feature branch
2. Begin Phase 1 implementation
3. Track progress against this plan
