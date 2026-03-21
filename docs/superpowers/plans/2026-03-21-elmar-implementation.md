# Elmar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal knowledge & productivity CLI (`elmar`) backed by an Obsidian vault template, combining PARA structure, GTD workflow, and daily metric tracking.

**Architecture:** TypeScript CLI using Commander.js for command parsing. Adapter pattern separates vault I/O (markdown-first, Obsidian CLI optional). Core business logic (task parsing, metric registry, daily notes) sits between commands and adapters. Vault template ships alongside the CLI and is copied on `elmar init`.

**Tech Stack:** TypeScript, Node.js, Commander.js (CLI framework), Inquirer (interactive prompts), Vitest (testing), tsx (dev runner)

**Spec:** `docs/superpowers/specs/2026-03-21-elmar-design.md`

---

## File Map

### CLI Entry & Config

| File | Responsibility |
|------|---------------|
| `src/index.ts` | CLI entry point, registers all commands with Commander |
| `src/core/config.ts` | Load config from precedence chain, resolve vault path |
| `src/core/types.ts` | Shared TypeScript types (VaultAdapter, SearchResult, MetricDef, TaskItem, Config) |

### Adapter Layer

| File | Responsibility |
|------|---------------|
| `src/adapters/adapter.ts` | VaultAdapter interface definition |
| `src/adapters/markdown.ts` | Direct file I/O implementation of VaultAdapter |
| `src/adapters/obsidian-cli.ts` | Obsidian CLI wrapper (delegates to markdown.ts for unsupported ops) |
| `src/adapters/resolve.ts` | Auto-detect which adapter to use, return the active one |

### Core Business Logic

| File | Responsibility |
|------|---------------|
| `src/core/metric-registry.ts` | Load metrics.json, validate values against type/range |
| `src/core/task-parser.ts` | Parse `- [ ]` tasks from markdown, extract tags/dates/status |
| `src/core/daily-note.ts` | Generate daily note from template + registry, read/update sections |
| ~~`src/core/project.ts`~~ | *(Inlined into `src/commands/new.ts` — not a separate module)* |
| `src/core/markdown-utils.ts` | Shared markdown helpers: find section, append to section, update inline field |

### Commands

| File | Responsibility |
|------|---------------|
| `src/commands/init.ts` | Copy vault template, create config file |
| `src/commands/capture.ts` | Append text to inbox |
| `src/commands/tasks.ts` | List/filter tasks across projects and areas |
| `src/commands/log.ts` | Write metric to daily note |
| `src/commands/journal.ts` | Append to journal section of daily note |
| `src/commands/done.ts` | Mark a task as complete |
| `src/commands/new.ts` | Create new project with guided prompts |
| `src/commands/status.ts` | Overview dashboard in terminal |
| `src/commands/metrics.ts` | Show metric trends |
| `src/commands/review.ts` | Interactive weekly review |

### Vault Template

| File | Responsibility |
|------|---------------|
| `vault-template/0-Inbox/inbox.md` | Empty inbox |
| `vault-template/1-Projects/.gitkeep` | Placeholder |
| `vault-template/2-Areas/.gitkeep` | Placeholder |
| `vault-template/3-Resources/.gitkeep` | Placeholder |
| `vault-template/4-Archive/.gitkeep` | Placeholder |
| `vault-template/Journal/weekly/.gitkeep` | Placeholder |
| `vault-template/Templates/daily-note.md` | Templater-compatible daily note template |
| `vault-template/Templates/project.md` | Project file template |
| `vault-template/Templates/weekly-review.md` | Weekly review template |
| `vault-template/_System/metrics.json` | Default metric registry |
| `vault-template/_System/dashboard.md` | Tracker/Bases dashboard |

### Tests

| File | Tests |
|------|-------|
| `tests/core/config.test.ts` | Config loading, precedence, missing config |
| `tests/core/markdown-utils.test.ts` | Section finding, appending, inline field updates |
| `tests/core/metric-registry.test.ts` | Loading, validation, range checking |
| `tests/core/task-parser.test.ts` | Task extraction, tag parsing, due date parsing |
| `tests/core/daily-note.test.ts` | Template generation, section updates |
| ~~`tests/core/project.test.ts`~~ | *(Inlined into new.ts — no separate test needed)* |
| `tests/adapters/markdown.test.ts` | Full adapter contract tests against temp files |
| `tests/commands/capture.test.ts` | Capture command integration |
| `tests/commands/tasks.test.ts` | Tasks command with filtering |
| `tests/commands/log.test.ts` | Log command with metric validation |
| `tests/commands/done.test.ts` | Done command task matching |
| `tests/commands/init.test.ts` | Init command vault copy |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/core/types.ts`

- [ ] **Step 1: Initialize npm project**

```bash
cd ~/Projects/elmar
npm init -y
```

Update `package.json`:

```json
{
  "name": "elmar",
  "version": "0.1.0",
  "description": "Personal knowledge & productivity system — Obsidian vault + CLI",
  "type": "module",
  "bin": {
    "elmar": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["gtd", "para", "zettelkasten", "obsidian", "productivity", "pkm"],
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install commander inquirer chalk
npm install -D typescript tsx vitest @types/node @types/inquirer
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Create shared types**

Create `src/core/types.ts`:

```typescript
export interface SearchResult {
  readonly path: string;
  readonly line: number;
  readonly text: string;
  readonly context: string;
}

export interface MetricDef {
  readonly key: string;
  readonly label: string;
  readonly type: "number" | "text" | "list";
  readonly range?: readonly [number, number];
  readonly unit?: string;
  readonly comment?: boolean;
}

export interface MetricRegistry {
  readonly metrics: readonly MetricDef[];
}

export interface TaskItem {
  readonly text: string;
  readonly completed: boolean;
  readonly tags: readonly string[];
  readonly dueDate: string | null;
  readonly waiting: boolean;
  readonly sourcePath: string;
  readonly sourceArea: string;
  readonly line: number;
}

export interface ElmarConfig {
  readonly vaultPath: string;
  readonly inboxFile: string;
  readonly dailyNotesFolder: string;
  readonly weeklyNotesFolder: string;
  readonly templatesFolder: string;
  readonly systemFolder: string;
  readonly areas: readonly string[];
}

export interface ProjectMeta {
  readonly title: string;
  readonly status: string;
  readonly area: string;
  readonly outcome: string;
  readonly created: string;
}
```

- [ ] **Step 6: Create CLI entry point stub**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("elmar")
  .description("Personal knowledge & productivity system")
  .version("0.1.0");

program.parse();
```

- [ ] **Step 7: Verify build works**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/
git commit -m "chore: scaffold elmar project with TypeScript, Commander, Vitest"
```

---

## Task 2: Vault Template

**Files:**
- Create: all files under `vault-template/`

- [ ] **Step 1: Create vault folder structure**

```bash
cd ~/Projects/elmar
mkdir -p vault-template/{0-Inbox,1-Projects,2-Areas,3-Resources,4-Archive,Journal/weekly,Templates,_System}
```

- [ ] **Step 2: Create inbox.md**

Create `vault-template/0-Inbox/inbox.md`:

```markdown
# Inbox

Capture everything here. Process during weekly review.

```

- [ ] **Step 3: Create .gitkeep placeholders**

```bash
touch vault-template/{1-Projects,2-Areas,3-Resources,4-Archive,Journal/weekly}/.gitkeep
```

- [ ] **Step 4: Create metrics.json**

Create `vault-template/_System/metrics.json`:

```json
{
  "metrics": [
    { "key": "sleep", "label": "Sleep Score", "type": "number", "range": [1, 100] },
    { "key": "reading", "label": "Reading", "type": "number", "unit": "minutes" },
    { "key": "family", "label": "Family Engagement", "type": "number", "range": [1, 10] },
    { "key": "partner", "label": "Partner Score", "type": "number", "range": [1, 10], "comment": true },
    { "key": "growth", "label": "Growth", "type": "text" },
    { "key": "grateful", "label": "Gratitude", "type": "list" },
    { "key": "journal", "label": "Journal", "type": "text" }
  ]
}
```

- [ ] **Step 5: Create daily note templates**

The vault ships with two daily note templates:
1. **Templater version** — used by Obsidian when Templater is installed (dynamic metric fields)
2. **CLI version** — used by `ensureDailyNote` in the markdown adapter (static `{{date}}` placeholders)

Create `vault-template/Templates/daily-note.md` (Templater version for Obsidian):

```markdown
# <% tp.date.now("YYYY-MM-DD") %>

## Journal
<!-- Free writing -->

## Gratitude
-

## Tracking
<%*
const metricsFile = app.vault.getAbstractFileByPath("_System/metrics.json");
if (metricsFile) {
  const content = await app.vault.read(metricsFile);
  const registry = JSON.parse(content);
  for (const metric of registry.metrics) {
    tR += metric.key + "::\n";
  }
}
%>

## Tasks
- [ ]

## Notes
<!-- Anything captured during the day -->
```

Create `vault-template/Templates/daily-note-cli.md` (CLI version — no Templater syntax):

```markdown
# {{date}}

## Journal
<!-- Free writing -->

## Gratitude
-

## Tracking
{{tracking_fields}}

## Tasks
- [ ]

## Notes
<!-- Anything captured during the day -->
```

- [ ] **Step 6: Create project template**

Create `vault-template/Templates/project.md`:

```markdown
# {{title}}

Status: active
Area: {{area}}
Outcome: {{outcome}}
Created: <% tp.date.now("YYYY-MM-DD") %>

## Next Actions
- [ ] {{first_action}} #{{area}}

## Waiting For

## Notes
{{initial_context}}
```

- [ ] **Step 7: Create weekly review template**

Create `vault-template/Templates/weekly-review.md`:

```markdown
# Weekly Review — <% tp.date.now("YYYY-[W]ww") %>

## Inbox Processed
- [ ] All inbox items processed

## Projects Reviewed
<!-- Auto-filled during review -->

## Metrics Summary
<!-- Auto-filled during review -->

## Reflections
<!-- What went well? What needs attention? -->

## Next Week Focus
-
```

- [ ] **Step 8: Create dashboard.md**

Create `vault-template/_System/dashboard.md`:

```markdown
# Dashboard

## Sleep (30 days)
```tracker
searchType: dvField
searchTarget: sleep
folder: Journal
datasetName: Sleep
line:
  title: Sleep Score
  yAxisLabel: Score
  yMin: 0
  yMax: 100
```

## Reading (30 days)
```tracker
searchType: dvField
searchTarget: reading
folder: Journal
datasetName: Reading
line:
  title: Reading (minutes)
  yAxisLabel: Minutes
  yMin: 0
```

## Family Engagement (30 days)
```tracker
searchType: dvField
searchTarget: family
folder: Journal
datasetName: Family
line:
  title: Family Engagement
  yAxisLabel: Score
  yMin: 0
  yMax: 10
```

## Partner (30 days)
```tracker
searchType: dvField
searchTarget: partner
folder: Journal
datasetName: Partner
line:
  title: Partner Score
  yAxisLabel: Score
  yMin: 0
  yMax: 10
```

## Gratitude Count (30 days)
```tracker
searchType: dvField
searchTarget: grateful
folder: Journal
datasetName: Grateful
line:
  title: Gratitude Items
  yAxisLabel: Count
  yMin: 0
```

## Journal Consistency
```tracker
searchType: dvField
searchTarget: journal
folder: Journal
datasetName: Journal
line:
  title: Journal (character count)
  yAxisLabel: Characters
  yMin: 0
```
```

- [ ] **Step 9: Commit**

```bash
git add vault-template/
git commit -m "feat: add vault template with PARA structure, templates, metrics, dashboard"
```

---

## Task 3: Config Loading

**Files:**
- Create: `src/core/config.ts`, `tests/core/config.test.ts`

- [ ] **Step 1: Write failing tests for config loading**

Create `tests/core/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/core/config.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadConfig", () => {
  const testDir = join(tmpdir(), "elmar-test-config-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    // Clear env
    delete process.env.ELMAR_CONFIG;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.ELMAR_CONFIG;
  });

  it("loads config from ELMAR_CONFIG env var", () => {
    const configPath = join(testDir, "custom.json");
    writeFileSync(configPath, JSON.stringify({ vaultPath: "/test/vault" }));
    process.env.ELMAR_CONFIG = configPath;

    const config = loadConfig();
    expect(config.vaultPath).toBe("/test/vault");
  });

  it("applies defaults for missing fields", () => {
    const configPath = join(testDir, "minimal.json");
    writeFileSync(configPath, JSON.stringify({ vaultPath: "/test/vault" }));
    process.env.ELMAR_CONFIG = configPath;

    const config = loadConfig();
    expect(config.inboxFile).toBe("0-Inbox/inbox.md");
    expect(config.dailyNotesFolder).toBe("Journal");
    expect(config.areas).toEqual(["work", "personal", "family", "finance"]);
  });

  it("throws when no config found", () => {
    // Point to nonexistent paths
    process.env.ELMAR_CONFIG = join(testDir, "nonexistent.json");
    expect(() => loadConfig()).toThrow("No config found");
  });

  it("expands ~ in vaultPath", () => {
    const configPath = join(testDir, "tilde.json");
    writeFileSync(configPath, JSON.stringify({ vaultPath: "~/MyVault" }));
    process.env.ELMAR_CONFIG = configPath;

    const config = loadConfig();
    expect(config.vaultPath).not.toContain("~");
    expect(config.vaultPath).toContain("MyVault");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/config.test.ts
```

Expected: FAIL — `loadConfig` not found.

- [ ] **Step 3: Implement config.ts**

Create `src/core/config.ts`:

```typescript
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ElmarConfig } from "./types.js";

export const CONFIG_DEFAULTS: Omit<ElmarConfig, "vaultPath"> = {
  inboxFile: "0-Inbox/inbox.md",
  dailyNotesFolder: "Journal",
  weeklyNotesFolder: "Journal/weekly",
  templatesFolder: "Templates",
  systemFolder: "_System",
  areas: ["work", "personal", "family", "finance"],
};

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return join(homedir(), filepath.slice(1));
  }
  return filepath;
}

function findConfigPath(): string | null {
  // 1. Environment variable
  const envPath = process.env.ELMAR_CONFIG;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }
  if (envPath) {
    return null; // Env var set but file doesn't exist
  }

  // 2. Home directory
  const homePath = join(homedir(), ".elmar.config.json");
  if (existsSync(homePath)) {
    return homePath;
  }

  // 3. Current directory
  const localPath = resolve(".elmar.config.json");
  if (existsSync(localPath)) {
    return localPath;
  }

  return null;
}

export function loadConfig(): ElmarConfig {
  const configPath = findConfigPath();
  if (!configPath) {
    throw new Error(
      "No config found. Run `elmar init` to set up Elmar."
    );
  }

  const raw = JSON.parse(readFileSync(configPath, "utf-8"));

  if (!raw.vaultPath) {
    throw new Error(
      "Config is missing vaultPath. Update your config file."
    );
  }

  return {
    ...CONFIG_DEFAULTS,
    ...raw,
    vaultPath: expandHome(raw.vaultPath),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/core/config.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts tests/core/config.test.ts
git commit -m "feat: add config loading with precedence chain and defaults"
```

---

## Task 4: Markdown Utilities

**Files:**
- Create: `src/core/markdown-utils.ts`, `tests/core/markdown-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/markdown-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  findSectionRange,
  appendToSection,
  getInlineField,
  setInlineField,
} from "../../src/core/markdown-utils.js";

describe("findSectionRange", () => {
  // Line indices: 0:"# Title", 1:"", 2:"## Journal", 3:"Some journal text.",
  // 4:"", 5:"## Tracking", 6:"sleep:: 85", 7:"", 8:"## Notes", 9:"Some notes."
  const doc = `# Title

## Journal
Some journal text.

## Tracking
sleep:: 85

## Notes
Some notes.`;

  it("finds section start and end (end = index of next heading)", () => {
    const range = findSectionRange(doc, "## Journal");
    expect(range).toEqual({ start: 2, end: 5 });
  });

  it("finds last section extending to end of file", () => {
    const range = findSectionRange(doc, "## Notes");
    expect(range).toEqual({ start: 8, end: 10 });
  });

  it("returns null for missing section", () => {
    const range = findSectionRange(doc, "## Missing");
    expect(range).toBeNull();
  });
});

describe("appendToSection", () => {
  it("appends content before next heading", () => {
    const doc = `## Journal
Text here.

## Notes
`;
    const result = appendToSection(doc, "## Journal", "New line.");
    expect(result).toContain("Text here.");
    expect(result).toContain("New line.");
    expect(result).toContain("## Notes");
    // New line should appear before ## Notes
    const newLineIdx = result.indexOf("New line.");
    const notesIdx = result.indexOf("## Notes");
    expect(newLineIdx).toBeLessThan(notesIdx);
  });

  it("appends at end of file for last section", () => {
    const doc = `## Notes
Existing.`;
    const result = appendToSection(doc, "## Notes", "Appended.");
    expect(result).toContain("Existing.");
    expect(result).toContain("Appended.");
  });
});

describe("getInlineField", () => {
  it("reads existing field value", () => {
    const doc = "sleep:: 85\nreading:: 30";
    expect(getInlineField(doc, "sleep")).toBe("85");
  });

  it("returns null for empty field", () => {
    const doc = "sleep::\nreading:: 30";
    expect(getInlineField(doc, "sleep")).toBeNull();
  });

  it("returns null for missing field", () => {
    const doc = "reading:: 30";
    expect(getInlineField(doc, "sleep")).toBeNull();
  });
});

describe("setInlineField", () => {
  it("sets value on existing field", () => {
    const doc = "sleep::\nreading:: 30";
    const result = setInlineField(doc, "sleep", "85");
    expect(result).toContain("sleep:: 85");
    expect(result).toContain("reading:: 30");
  });

  it("overwrites existing value", () => {
    const doc = "sleep:: 50\nreading:: 30";
    const result = setInlineField(doc, "sleep", "85");
    expect(result).toContain("sleep:: 85");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/markdown-utils.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement markdown-utils.ts**

Create `src/core/markdown-utils.ts`:

```typescript
export interface SectionRange {
  readonly start: number; // line index of heading
  readonly end: number;   // line index of last content line (exclusive of next heading)
}

export function findSectionRange(
  content: string,
  heading: string
): SectionRange | null {
  const lines = content.split("\n");
  const headingLevel = heading.match(/^(#+)/)?.[1].length ?? 0;
  let startIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) return null;

  // Find the next heading of equal or higher level
  for (let i = startIdx + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s/);
    if (match && match[1].length <= headingLevel) {
      return { start: startIdx, end: i };
    }
  }

  // Section extends to end of file
  return { start: startIdx, end: lines.length };
}

export function appendToSection(
  content: string,
  heading: string,
  text: string
): string {
  const lines = content.split("\n");
  const range = findSectionRange(content, heading);

  if (!range) {
    throw new Error(`Section "${heading}" not found`);
  }

  // Find last non-empty line in section for insertion point
  let insertAt = range.end;

  // Insert before the next heading (with a blank line preserved)
  lines.splice(insertAt, 0, text);
  return lines.join("\n");
}

export function getInlineField(
  content: string,
  key: string
): string | null {
  const regex = new RegExp(`^${escapeRegex(key)}::(.*)$`, "m");
  const match = content.match(regex);
  if (!match) return null;
  const value = match[1].trim();
  return value === "" ? null : value;
}

export function setInlineField(
  content: string,
  key: string,
  value: string
): string {
  const regex = new RegExp(`^${escapeRegex(key)}::.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `${key}:: ${value}`);
  }
  return content + `\n${key}:: ${value}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/core/markdown-utils.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/markdown-utils.ts tests/core/markdown-utils.test.ts
git commit -m "feat: add markdown utilities for section parsing and inline fields"
```

---

## Task 5: Metric Registry

**Files:**
- Create: `src/core/metric-registry.ts`, `tests/core/metric-registry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/metric-registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadRegistry,
  validateMetricValue,
  getMetric,
} from "../../src/core/metric-registry.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("metric-registry", () => {
  const testDir = join(tmpdir(), "elmar-test-metrics-" + Date.now());
  const metricsPath = join(testDir, "metrics.json");

  const sampleRegistry = {
    metrics: [
      { key: "sleep", label: "Sleep", type: "number", range: [1, 100] },
      { key: "growth", label: "Growth", type: "text" },
      { key: "grateful", label: "Gratitude", type: "list" },
    ],
  };

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(metricsPath, JSON.stringify(sampleRegistry));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("loadRegistry", () => {
    it("loads metrics from file", () => {
      const registry = loadRegistry(metricsPath);
      expect(registry.metrics).toHaveLength(3);
      expect(registry.metrics[0].key).toBe("sleep");
    });
  });

  describe("getMetric", () => {
    it("finds metric by key", () => {
      const registry = loadRegistry(metricsPath);
      const metric = getMetric(registry, "sleep");
      expect(metric?.label).toBe("Sleep");
    });

    it("returns undefined for unknown key", () => {
      const registry = loadRegistry(metricsPath);
      expect(getMetric(registry, "unknown")).toBeUndefined();
    });
  });

  describe("validateMetricValue", () => {
    it("accepts number in range", () => {
      const metric = sampleRegistry.metrics[0];
      expect(() => validateMetricValue(metric, "85")).not.toThrow();
    });

    it("rejects number out of range", () => {
      const metric = sampleRegistry.metrics[0];
      expect(() => validateMetricValue(metric, "150")).toThrow(
        "sleep must be between 1-100"
      );
    });

    it("rejects non-numeric for number type", () => {
      const metric = sampleRegistry.metrics[0];
      expect(() => validateMetricValue(metric, "abc")).toThrow();
    });

    it("accepts any string for text type", () => {
      const metric = sampleRegistry.metrics[1];
      expect(() =>
        validateMetricValue(metric, "Some text")
      ).not.toThrow();
    });

    it("accepts any string for list type", () => {
      const metric = sampleRegistry.metrics[2];
      expect(() =>
        validateMetricValue(metric, "An item")
      ).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/metric-registry.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement metric-registry.ts**

Create `src/core/metric-registry.ts`:

```typescript
import { readFileSync } from "node:fs";
import type { MetricDef, MetricRegistry } from "./types.js";

export function loadRegistry(path: string): MetricRegistry {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return { metrics: raw.metrics };
}

export function getMetric(
  registry: MetricRegistry,
  key: string
): MetricDef | undefined {
  return registry.metrics.find((m) => m.key === key);
}

export function validateMetricValue(
  metric: MetricDef,
  value: string
): void {
  if (metric.type === "number") {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(
        `${metric.key} must be a number, got "${value}"`
      );
    }
    if (metric.range) {
      const [min, max] = metric.range;
      if (num < min || num > max) {
        throw new Error(
          `${metric.key} must be between ${min}-${max}, got ${num}`
        );
      }
    }
  }
  // text and list types accept any string value
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/core/metric-registry.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/metric-registry.ts tests/core/metric-registry.test.ts
git commit -m "feat: add metric registry with loading and validation"
```

---

## Task 6: Task Parser

**Files:**
- Create: `src/core/task-parser.ts`, `tests/core/task-parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/task-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseTasks, parseTaskLine } from "../../src/core/task-parser.js";

describe("parseTaskLine", () => {
  it("parses simple open task", () => {
    const task = parseTaskLine("- [ ] Buy groceries", "test.md", 0);
    expect(task?.text).toBe("Buy groceries");
    expect(task?.completed).toBe(false);
    expect(task?.tags).toEqual([]);
  });

  it("parses completed task", () => {
    const task = parseTaskLine("- [x] Buy groceries", "test.md", 0);
    expect(task?.completed).toBe(true);
  });

  it("extracts tags", () => {
    const task = parseTaskLine(
      "- [ ] Draft spec #work",
      "test.md",
      0
    );
    expect(task?.tags).toEqual(["work"]);
  });

  it("extracts multiple tags", () => {
    const task = parseTaskLine(
      "- [ ] Coordinate #work #family",
      "test.md",
      0
    );
    expect(task?.tags).toEqual(["work", "family"]);
  });

  it("extracts due date", () => {
    const task = parseTaskLine(
      "- [ ] Submit report 📅 2026-03-25",
      "test.md",
      0
    );
    expect(task?.dueDate).toBe("2026-03-25");
  });

  it("detects waiting-for tag", () => {
    const task = parseTaskLine(
      "- [ ] Feedback from Sara #work/waiting",
      "test.md",
      0
    );
    expect(task?.waiting).toBe(true);
  });

  it("returns null for non-task lines", () => {
    expect(parseTaskLine("Just some text", "test.md", 0)).toBeNull();
    expect(parseTaskLine("- Item without checkbox", "test.md", 0)).toBeNull();
  });
});

describe("parseTasks", () => {
  it("extracts all tasks from markdown content", () => {
    const content = `# Project

## Next Actions
- [ ] Task one #work
- [x] Done task
- [ ] Task two 📅 2026-03-25

## Notes
Some text.`;

    const tasks = parseTasks(content, "1-Projects/work--api.md");
    expect(tasks).toHaveLength(3);
    expect(tasks[0].text).toBe("Task one");
    expect(tasks[1].completed).toBe(true);
    expect(tasks[2].dueDate).toBe("2026-03-25");
  });

  it("extracts area from filename prefix", () => {
    const tasks = parseTasks(
      "- [ ] Something",
      "1-Projects/work--api.md"
    );
    expect(tasks[0].sourceArea).toBe("work");
  });

  it("uses 'unknown' area when no prefix", () => {
    const tasks = parseTasks("- [ ] Something", "1-Projects/misc.md");
    expect(tasks[0].sourceArea).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/task-parser.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement task-parser.ts**

Create `src/core/task-parser.ts`:

```typescript
import { basename } from "node:path";
import type { TaskItem } from "./types.js";

const TASK_REGEX = /^- \[([ xX])\] (.+)$/;
const TAG_REGEX = /#([\w/.-]+)/g;
const DUE_DATE_REGEX = /📅\s*(\d{4}-\d{2}-\d{2})/;

export function parseTaskLine(
  line: string,
  sourcePath: string,
  lineNumber: number
): TaskItem | null {
  const match = line.trim().match(TASK_REGEX);
  if (!match) return null;

  const completed = match[1] !== " ";
  const rawText = match[2];

  // Extract tags
  const tags: string[] = [];
  let tagMatch: RegExpExecArray | null;
  const tagRegex = new RegExp(TAG_REGEX.source, "g");
  while ((tagMatch = tagRegex.exec(rawText)) !== null) {
    tags.push(tagMatch[1]);
  }

  // Extract due date
  const dueDateMatch = rawText.match(DUE_DATE_REGEX);
  const dueDate = dueDateMatch ? dueDateMatch[1] : null;

  // Check for waiting-for
  const waiting = tags.some((t) => t.endsWith("/waiting"));

  // Clean text: remove tags and due date for display
  const text = rawText
    .replace(TAG_REGEX, "")
    .replace(DUE_DATE_REGEX, "")
    .trim();

  const sourceArea = extractArea(sourcePath);

  return {
    text,
    completed,
    tags,
    dueDate,
    waiting,
    sourcePath,
    sourceArea,
    line: lineNumber,
  };
}

export function parseTasks(
  content: string,
  sourcePath: string
): readonly TaskItem[] {
  const lines = content.split("\n");
  const tasks: TaskItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i], sourcePath, i);
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
}

function extractArea(sourcePath: string): string {
  const filename = basename(sourcePath, ".md");
  const dashIndex = filename.indexOf("--");
  if (dashIndex > 0) {
    return filename.substring(0, dashIndex);
  }
  return "unknown";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/core/task-parser.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/task-parser.ts tests/core/task-parser.test.ts
git commit -m "feat: add task parser with tag, due date, and waiting-for extraction"
```

---

## Task 7: Markdown Adapter

**Files:**
- Create: `src/adapters/adapter.ts`, `src/adapters/markdown.ts`, `src/adapters/resolve.ts`, `tests/adapters/markdown.test.ts`

- [ ] **Step 1: Write the adapter interface**

Create `src/adapters/adapter.ts`:

```typescript
import type { SearchResult } from "../core/types.js";

export interface VaultAdapter {
  readNote(path: string): Promise<string>;
  writeNote(path: string, content: string): Promise<void>;
  appendToSection(
    path: string,
    section: string,
    content: string
  ): Promise<void>;
  createNote(path: string, content: string): Promise<void>;
  moveNote(from: string, to: string): Promise<void>;
  deleteNote(path: string): Promise<void>;
  noteExists(path: string): Promise<boolean>;
  listFiles(folder: string, pattern?: string): Promise<string[]>;
  searchContent(query: string): Promise<SearchResult[]>;
  ensureDailyNote(date: string): Promise<string>;
}
```

- [ ] **Step 2: Write failing tests for markdown adapter**

Create `tests/adapters/markdown.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("MarkdownAdapter", () => {
  const vaultPath = join(tmpdir(), "elmar-test-vault-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(vaultPath, { recursive: true });
    mkdirSync(join(vaultPath, "Journal"), { recursive: true });
    mkdirSync(join(vaultPath, "Templates"), { recursive: true });
    mkdirSync(join(vaultPath, "_System"), { recursive: true });

    // Write a CLI daily note template for ensureDailyNote
    writeFileSync(
      join(vaultPath, "Templates", "daily-note-cli.md"),
      "# {{date}}\n\n## Journal\n\n## Tracking\n{{tracking_fields}}\n"
    );

    // Write metrics registry
    writeFileSync(
      join(vaultPath, "_System", "metrics.json"),
      JSON.stringify({
        metrics: [
          { key: "sleep", label: "Sleep", type: "number", range: [1, 100] },
        ],
      })
    );

    adapter = new MarkdownAdapter(vaultPath, {
      dailyNotesFolder: "Journal",
      templatesFolder: "Templates",
      systemFolder: "_System",
    });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  describe("readNote / writeNote / createNote", () => {
    it("creates and reads a note", async () => {
      await adapter.createNote("test.md", "Hello world");
      const content = await adapter.readNote("test.md");
      expect(content).toBe("Hello world");
    });

    it("overwrites with writeNote", async () => {
      await adapter.createNote("test.md", "First");
      await adapter.writeNote("test.md", "Second");
      const content = await adapter.readNote("test.md");
      expect(content).toBe("Second");
    });
  });

  describe("noteExists", () => {
    it("returns false for missing note", async () => {
      expect(await adapter.noteExists("nope.md")).toBe(false);
    });

    it("returns true for existing note", async () => {
      await adapter.createNote("yes.md", "");
      expect(await adapter.noteExists("yes.md")).toBe(true);
    });
  });

  describe("appendToSection", () => {
    it("appends content to a section", async () => {
      await adapter.createNote(
        "note.md",
        "# Title\n\n## Section\nExisting.\n\n## Other\n"
      );
      await adapter.appendToSection("note.md", "## Section", "New line.");
      const content = await adapter.readNote("note.md");
      expect(content).toContain("Existing.\nNew line.");
      expect(content).toContain("## Other");
    });
  });

  describe("deleteNote / moveNote", () => {
    it("deletes a note", async () => {
      await adapter.createNote("del.md", "bye");
      await adapter.deleteNote("del.md");
      expect(await adapter.noteExists("del.md")).toBe(false);
    });

    it("moves a note", async () => {
      await adapter.createNote("a.md", "content");
      await adapter.moveNote("a.md", "b.md");
      expect(await adapter.noteExists("a.md")).toBe(false);
      expect(await adapter.readNote("b.md")).toBe("content");
    });
  });

  describe("listFiles", () => {
    it("lists markdown files in folder", async () => {
      mkdirSync(join(vaultPath, "1-Projects"), { recursive: true });
      writeFileSync(join(vaultPath, "1-Projects", "a.md"), "");
      writeFileSync(join(vaultPath, "1-Projects", "b.md"), "");

      const files = await adapter.listFiles("1-Projects");
      expect(files).toHaveLength(2);
      expect(files).toContain("1-Projects/a.md");
      expect(files).toContain("1-Projects/b.md");
    });
  });

  describe("ensureDailyNote", () => {
    it("creates daily note from template if missing", async () => {
      const path = await adapter.ensureDailyNote("2026-03-21");
      expect(path).toBe("Journal/2026-03-21.md");
      const content = await adapter.readNote(path);
      expect(content).toContain("2026-03-21");
      expect(content).toContain("## Journal");
    });

    it("returns existing daily note path without overwriting", async () => {
      await adapter.createNote(
        "Journal/2026-03-21.md",
        "Existing content"
      );
      const path = await adapter.ensureDailyNote("2026-03-21");
      const content = await adapter.readNote(path);
      expect(content).toBe("Existing content");
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/adapters/markdown.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement markdown adapter**

Create `src/adapters/markdown.ts`:

```typescript
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  renameSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";
import type { VaultAdapter } from "./adapter.js";
import type { SearchResult } from "../core/types.js";
import {
  appendToSection as appendToSectionUtil,
} from "../core/markdown-utils.js";

interface MarkdownAdapterOptions {
  readonly dailyNotesFolder: string;
  readonly templatesFolder: string;
  readonly systemFolder: string;
}

export class MarkdownAdapter implements VaultAdapter {
  constructor(
    private readonly vaultPath: string,
    private readonly options: MarkdownAdapterOptions
  ) {}

  private resolve(path: string): string {
    return join(this.vaultPath, path);
  }

  async readNote(path: string): Promise<string> {
    return readFileSync(this.resolve(path), "utf-8");
  }

  async writeNote(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  async appendToSection(
    path: string,
    section: string,
    content: string
  ): Promise<void> {
    const current = await this.readNote(path);
    const updated = appendToSectionUtil(current, section, content);
    await this.writeNote(path, updated);
  }

  async createNote(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  async moveNote(from: string, to: string): Promise<void> {
    const toFull = this.resolve(to);
    mkdirSync(dirname(toFull), { recursive: true });
    renameSync(this.resolve(from), toFull);
  }

  async deleteNote(path: string): Promise<void> {
    unlinkSync(this.resolve(path));
  }

  async noteExists(path: string): Promise<boolean> {
    return existsSync(this.resolve(path));
  }

  async listFiles(
    folder: string,
    pattern?: string
  ): Promise<string[]> {
    const fullPath = this.resolve(folder);
    if (!existsSync(fullPath)) return [];

    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          walk(entryPath);
        } else if (entry.endsWith(".md")) {
          const relPath = relative(this.vaultPath, entryPath);
          if (!pattern || relPath.includes(pattern)) {
            files.push(relPath);
          }
        }
      }
    };
    walk(fullPath);
    return files;
  }

  async searchContent(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          walk(entryPath);
        } else if (entry.endsWith(".md")) {
          const content = readFileSync(entryPath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              results.push({
                path: relative(this.vaultPath, entryPath),
                line: i,
                text: lines[i],
                context: lines.slice(Math.max(0, i - 1), i + 2).join("\n"),
              });
            }
          }
        }
      }
    };
    walk(this.vaultPath);
    return results;
  }

  async ensureDailyNote(date: string): Promise<string> {
    const notePath = `${this.options.dailyNotesFolder}/${date}.md`;
    if (await this.noteExists(notePath)) {
      return notePath;
    }

    // Use the CLI-specific template (no Templater syntax)
    const templatePath = this.resolve(
      join(this.options.templatesFolder, "daily-note-cli.md")
    );
    let template = readFileSync(templatePath, "utf-8");
    template = template.replace(/\{\{date\}\}/g, date);

    // Generate tracking fields from the metric registry
    const registryPath = this.resolve(
      join(this.options.systemFolder, "metrics.json")
    );
    if (existsSync(registryPath)) {
      const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
      const trackingFields = registry.metrics
        .map((m: { key: string }) => `${m.key}::`)
        .join("\n");
      template = template.replace("{{tracking_fields}}", trackingFields);
    }

    await this.createNote(notePath, template);
    return notePath;
  }
}
```

- [ ] **Step 5: Create adapter resolver**

Create `src/adapters/resolve.ts`:

```typescript
import { execSync } from "node:child_process";
import { MarkdownAdapter } from "./markdown.js";
import type { VaultAdapter } from "./adapter.js";
import type { ElmarConfig } from "../core/types.js";

export function resolveAdapter(config: ElmarConfig): VaultAdapter {
  // For now, always use the markdown adapter.
  // Obsidian CLI adapter will be added as a future enhancement.
  return new MarkdownAdapter(config.vaultPath, {
    dailyNotesFolder: config.dailyNotesFolder,
    templatesFolder: config.templatesFolder,
    systemFolder: config.systemFolder,
  });
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/adapters/markdown.test.ts
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/adapters/ tests/adapters/
git commit -m "feat: add VaultAdapter interface and markdown adapter implementation"
```

---

## Task 8: Daily Note Core

**Files:**
- Create: `src/core/daily-note.ts`, `tests/core/daily-note.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/daily-note.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  countBullets,
  countSectionChars,
} from "../../src/core/daily-note.js";

describe("countBullets", () => {
  it("counts bullet items in section", () => {
    const content = `## Gratitude
- sunshine
- family
- good coffee

## Tracking`;
    expect(countBullets(content, "## Gratitude")).toBe(3);
  });

  it("returns 0 for empty section", () => {
    const content = `## Gratitude
-

## Tracking`;
    expect(countBullets(content, "## Gratitude")).toBe(0);
  });
});

describe("countSectionChars", () => {
  it("counts non-heading characters", () => {
    const content = `## Journal
Hello world this is my journal.

## Tracking`;
    const count = countSectionChars(content, "## Journal");
    expect(count).toBe("Hello world this is my journal.".length);
  });

  it("returns 0 for empty section", () => {
    const content = `## Journal
<!-- Free writing -->

## Tracking`;
    // Comments don't count as content
    expect(countSectionChars(content, "## Journal")).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/core/daily-note.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement daily-note.ts**

Create `src/core/daily-note.ts`:

```typescript
import { findSectionRange } from "./markdown-utils.js";

export function countBullets(content: string, heading: string): number {
  const range = findSectionRange(content, heading);
  if (!range) return 0;

  const lines = content.split("\n");
  let count = 0;
  for (let i = range.start + 1; i < range.end; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("- ") && trimmed.length > 2) {
      count++;
    }
  }
  return count;
}

export function countSectionChars(
  content: string,
  heading: string
): number {
  const range = findSectionRange(content, heading);
  if (!range) return 0;

  const lines = content.split("\n");
  let chars = 0;
  for (let i = range.start + 1; i < range.end; i++) {
    const trimmed = lines[i].trim();
    // Skip empty lines and HTML comments
    if (trimmed === "" || trimmed.startsWith("<!--")) continue;
    chars += trimmed.length;
  }
  return chars;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/core/daily-note.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/daily-note.ts tests/core/daily-note.test.ts
git commit -m "feat: add daily note helpers for bullet counting and section char counting"
```

---

## Task 9: `elmar init` Command

**Files:**
- Create: `src/commands/init.ts`, `tests/commands/init.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/init.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { runInit } from "../../src/commands/init.js";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { homedir } from "node:os";

describe("runInit", () => {
  const testVaultPath = join(
    tmpdir(),
    "elmar-test-init-vault-" + Date.now()
  );
  const configPath = join(
    tmpdir(),
    "elmar-test-init-config-" + Date.now() + ".json"
  );

  afterEach(() => {
    rmSync(testVaultPath, { recursive: true, force: true });
    rmSync(configPath, { force: true });
  });

  it("copies vault template to target path", async () => {
    await runInit(testVaultPath, configPath);
    expect(existsSync(join(testVaultPath, "0-Inbox", "inbox.md"))).toBe(
      true
    );
    expect(
      existsSync(join(testVaultPath, "_System", "metrics.json"))
    ).toBe(true);
    expect(
      existsSync(join(testVaultPath, "Templates", "daily-note.md"))
    ).toBe(true);
  });

  it("creates config file pointing to vault", async () => {
    await runInit(testVaultPath, configPath);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.vaultPath).toBe(testVaultPath);
  });

  it("does not overwrite existing vault", async () => {
    await runInit(testVaultPath, configPath);
    await expect(runInit(testVaultPath, configPath)).rejects.toThrow(
      "already exists"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/commands/init.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement init command**

Create `src/commands/init.ts`:

```typescript
import { cpSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ElmarConfig } from "../core/types.js";
import { CONFIG_DEFAULTS } from "../core/config.js";

function getVaultTemplatePath(): string {
  // Navigate from src/commands/init.ts to vault-template/
  const thisFile = fileURLToPath(import.meta.url);
  return resolve(dirname(thisFile), "..", "..", "vault-template");
}

export async function runInit(
  vaultPath: string,
  configPath: string
): Promise<void> {
  if (existsSync(vaultPath)) {
    throw new Error(
      `Vault path "${vaultPath}" already exists. Choose a different location or delete it first.`
    );
  }

  const templatePath = getVaultTemplatePath();

  // Copy vault template
  cpSync(templatePath, vaultPath, { recursive: true });

  // Write config
  const config: ElmarConfig = {
    ...CONFIG_DEFAULTS,
    vaultPath,
  };

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/commands/init.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.ts tests/commands/init.test.ts
git commit -m "feat: add elmar init command to scaffold vault from template"
```

---

## Task 10: `elmar capture` Command

**Files:**
- Create: `src/commands/capture.ts`, `tests/commands/capture.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/capture.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCapture } from "../../src/commands/capture.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runCapture", () => {
  const vaultPath = join(tmpdir(), "elmar-test-capture-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(join(vaultPath, "0-Inbox"), { recursive: true });
    writeFileSync(
      join(vaultPath, "0-Inbox", "inbox.md"),
      "# Inbox\n\n"
    );
    adapter = new MarkdownAdapter(vaultPath, {
      dailyNotesFolder: "Journal",
      templatesFolder: "Templates",
      systemFolder: "_System",
    });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("appends text to inbox", async () => {
    await runCapture(adapter, "0-Inbox/inbox.md", "Buy groceries");
    const content = readFileSync(
      join(vaultPath, "0-Inbox", "inbox.md"),
      "utf-8"
    );
    expect(content).toContain("- Buy groceries");
  });

  it("appends multiple captures", async () => {
    await runCapture(adapter, "0-Inbox/inbox.md", "First item");
    await runCapture(adapter, "0-Inbox/inbox.md", "Second item");
    const content = readFileSync(
      join(vaultPath, "0-Inbox", "inbox.md"),
      "utf-8"
    );
    expect(content).toContain("- First item");
    expect(content).toContain("- Second item");
  });

  it("adds timestamp to capture", async () => {
    await runCapture(adapter, "0-Inbox/inbox.md", "Timed item");
    const content = readFileSync(
      join(vaultPath, "0-Inbox", "inbox.md"),
      "utf-8"
    );
    // Should contain a date-like prefix
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/commands/capture.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement capture command**

Create `src/commands/capture.ts`:

```typescript
import type { VaultAdapter } from "../adapters/adapter.js";

export async function runCapture(
  adapter: VaultAdapter,
  inboxPath: string,
  text: string
): Promise<void> {
  // Ensure inbox exists
  if (!(await adapter.noteExists(inboxPath))) {
    await adapter.createNote(inboxPath, "# Inbox\n\n");
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const entry = `- ${text} *(${timestamp})*`;

  const content = await adapter.readNote(inboxPath);
  await adapter.writeNote(inboxPath, content.trimEnd() + "\n" + entry + "\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/commands/capture.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/capture.ts tests/commands/capture.test.ts
git commit -m "feat: add elmar capture command for fast inbox appending"
```

---

## Task 11: `elmar log` Command

**Files:**
- Create: `src/commands/log.ts`, `tests/commands/log.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/log.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runLog } from "../../src/commands/log.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runLog", () => {
  const vaultPath = join(tmpdir(), "elmar-test-log-" + Date.now());
  let adapter: MarkdownAdapter;

  const dailyNote = `# 2026-03-21

## Journal
<!-- Free writing -->

## Gratitude
-

## Tracking
sleep::
reading::
grateful::

## Tasks

## Notes
`;

  const registry = {
    metrics: [
      { key: "sleep", label: "Sleep", type: "number", range: [1, 100] },
      { key: "reading", label: "Reading", type: "number", unit: "minutes" },
      { key: "grateful", label: "Gratitude", type: "list" },
    ],
  };

  beforeEach(() => {
    mkdirSync(join(vaultPath, "Journal"), { recursive: true });
    mkdirSync(join(vaultPath, "Templates"), { recursive: true });
    mkdirSync(join(vaultPath, "_System"), { recursive: true });
    writeFileSync(join(vaultPath, "Journal", "2026-03-21.md"), dailyNote);
    writeFileSync(
      join(vaultPath, "_System", "metrics.json"),
      JSON.stringify(registry)
    );
    writeFileSync(
      join(vaultPath, "Templates", "daily-note.md"),
      "# {{date}}\n\n## Tracking\nsleep::\n"
    );
    adapter = new MarkdownAdapter(vaultPath, {
      dailyNotesFolder: "Journal",
      templatesFolder: "Templates",
      systemFolder: "_System",
    });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("logs a number metric", async () => {
    await runLog(adapter, vaultPath, "_System", "sleep", "85", "2026-03-21");
    const content = readFileSync(
      join(vaultPath, "Journal", "2026-03-21.md"),
      "utf-8"
    );
    expect(content).toContain("sleep:: 85");
  });

  it("rejects out of range value", async () => {
    await expect(
      runLog(adapter, vaultPath, "_System", "sleep", "150", "2026-03-21")
    ).rejects.toThrow("must be between 1-100");
  });

  it("rejects unknown metric", async () => {
    await expect(
      runLog(adapter, vaultPath, "_System", "unknown", "5", "2026-03-21")
    ).rejects.toThrow("Unknown metric");
  });

  it("logs a list metric by appending bullet to Gratitude", async () => {
    await runLog(adapter, vaultPath, "_System", "grateful", "sunshine", "2026-03-21");
    const content = readFileSync(
      join(vaultPath, "Journal", "2026-03-21.md"),
      "utf-8"
    );
    expect(content).toContain("- sunshine");
    expect(content).toContain("grateful:: 1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/commands/log.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement log command**

Create `src/commands/log.ts`:

```typescript
import { join } from "node:path";
import type { VaultAdapter } from "../adapters/adapter.js";
import {
  loadRegistry,
  getMetric,
  validateMetricValue,
} from "../core/metric-registry.js";
import { setInlineField } from "../core/markdown-utils.js";
import { countBullets } from "../core/daily-note.js";

export async function runLog(
  adapter: VaultAdapter,
  vaultPath: string,
  systemFolder: string,
  key: string,
  value: string,
  date: string
): Promise<void> {
  const registryPath = join(vaultPath, systemFolder, "metrics.json");
  const registry = loadRegistry(registryPath);
  const metric = getMetric(registry, key);

  if (!metric) {
    const available = registry.metrics.map((m) => m.key).join(", ");
    throw new Error(
      `Unknown metric '${key}'. Available: ${available}`
    );
  }

  validateMetricValue(metric, value);

  // Ensure daily note exists
  const notePath = await adapter.ensureDailyNote(date);
  let content = await adapter.readNote(notePath);

  if (metric.type === "list") {
    // Append bullet to the corresponding section (e.g., ## Gratitude)
    const sectionHeading = `## ${metric.label}`;
    const lines = content.split("\n");
    const headingIdx = lines.findIndex(
      (l) => l.trim() === sectionHeading
    );

    if (headingIdx >= 0) {
      // Find insertion point: after last bullet or after heading
      let insertAt = headingIdx + 1;
      for (let i = headingIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("#")) break;
        if (lines[i].trim().startsWith("- ") && lines[i].trim().length > 2) {
          insertAt = i + 1;
        } else if (lines[i].trim() === "-") {
          // Empty placeholder bullet — replace it
          insertAt = i;
          lines.splice(i, 1);
          break;
        }
      }
      lines.splice(insertAt, 0, `- ${value}`);
      content = lines.join("\n");
    }

    // Update the count field
    const bulletCount = countBullets(content, sectionHeading);
    content = setInlineField(content, key, String(bulletCount));
  } else {
    // Number or text — set inline field directly
    content = setInlineField(content, key, value);
  }

  await adapter.writeNote(notePath, content);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/commands/log.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/log.ts tests/commands/log.test.ts
git commit -m "feat: add elmar log command for daily metric tracking"
```

---

## Task 12: `elmar tasks` Command

**Files:**
- Create: `src/commands/tasks.ts`, `tests/commands/tasks.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/tasks.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { collectTasks, filterTasks } from "../../src/commands/tasks.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("collectTasks", () => {
  const vaultPath = join(tmpdir(), "elmar-test-tasks-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(join(vaultPath, "1-Projects"), { recursive: true });
    mkdirSync(join(vaultPath, "2-Areas"), { recursive: true });
    mkdirSync(join(vaultPath, "_System"), { recursive: true });

    writeFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      `# API Redesign
Status: active

## Next Actions
- [ ] Draft spec #work
- [x] Review old code #work
- [ ] Submit report #work 📅 2026-03-20
`
    );

    writeFileSync(
      join(vaultPath, "1-Projects", "family--trip.md"),
      `# Summer Trip
Status: active

## Next Actions
- [ ] Book flights #family
`
    );

    writeFileSync(
      join(vaultPath, "1-Projects", "personal--someday.md"),
      `# Learn Piano
Status: someday

## Next Actions
- [ ] Find teacher #personal
`
    );

    adapter = new MarkdownAdapter(vaultPath, {
      dailyNotesFolder: "Journal",
      templatesFolder: "Templates",
      systemFolder: "_System",
    });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("collects open tasks from projects and areas", async () => {
    const tasks = await collectTasks(adapter, vaultPath);
    // Should exclude completed and someday projects
    const openTasks = tasks.filter((t) => !t.completed);
    expect(openTasks.length).toBeGreaterThanOrEqual(3);
  });

  it("excludes someday projects by default", async () => {
    const tasks = await collectTasks(adapter, vaultPath);
    const somedayTasks = tasks.filter((t) =>
      t.sourcePath.includes("someday")
    );
    expect(somedayTasks).toHaveLength(0);
  });
});

describe("filterTasks", () => {
  const tasks = [
    {
      text: "Draft spec",
      completed: false,
      tags: ["work"],
      dueDate: "2026-03-20",
      waiting: false,
      sourcePath: "1-Projects/work--api.md",
      sourceArea: "work",
      line: 5,
    },
    {
      text: "Book flights",
      completed: false,
      tags: ["family"],
      dueDate: null,
      waiting: false,
      sourcePath: "1-Projects/family--trip.md",
      sourceArea: "family",
      line: 5,
    },
  ];

  it("filters by area", () => {
    const filtered = filterTasks(tasks, { area: "work" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe("Draft spec");
  });

  it("filters by due date (includes overdue)", () => {
    const filtered = filterTasks(tasks, { due: "2026-03-21" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].text).toBe("Draft spec");
  });

  it("excludes tasks without due date from due filter", () => {
    const filtered = filterTasks(tasks, { due: "2026-03-25" });
    expect(filtered).toHaveLength(1); // Only the one with a due date
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/commands/tasks.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement tasks command**

Create `src/commands/tasks.ts`:

```typescript
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { VaultAdapter } from "../adapters/adapter.js";
import type { TaskItem } from "../core/types.js";
import { parseTasks } from "../core/task-parser.js";

interface TaskFilter {
  readonly area?: string;
  readonly due?: string; // YYYY-MM-DD — includes tasks due on or before this date
  readonly waiting?: boolean;
  readonly all?: boolean; // include completed tasks
}

export async function collectTasks(
  adapter: VaultAdapter,
  vaultPath: string
): Promise<readonly TaskItem[]> {
  const scanFolders = ["1-Projects", "2-Areas"];
  const allTasks: TaskItem[] = [];

  for (const folder of scanFolders) {
    const files = await adapter.listFiles(folder);
    for (const file of files) {
      const content = await adapter.readNote(file);

      // Skip someday projects
      if (folder === "1-Projects" && content.includes("Status: someday")) {
        continue;
      }

      const tasks = parseTasks(content, file);
      allTasks.push(...tasks);
    }
  }

  // Return all tasks — filtering (including completed) is done by filterTasks
  return allTasks;
}

export function filterTasks(
  tasks: readonly TaskItem[],
  filter: TaskFilter
): readonly TaskItem[] {
  let result = [...tasks];

  if (filter.area) {
    result = result.filter((t) => t.sourceArea === filter.area);
  }

  if (filter.due) {
    result = result.filter(
      (t) => t.dueDate !== null && t.dueDate <= filter.due!
    );
  }

  if (filter.waiting !== undefined) {
    result = result.filter((t) => t.waiting === filter.waiting);
  }

  if (!filter.all) {
    result = result.filter((t) => !t.completed);
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/commands/tasks.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/tasks.ts tests/commands/tasks.test.ts
git commit -m "feat: add elmar tasks command with area and due date filtering"
```

---

## Task 13: `elmar done` Command

**Files:**
- Create: `src/commands/done.ts`, `tests/commands/done.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/commands/done.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runDone } from "../../src/commands/done.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runDone", () => {
  const vaultPath = join(tmpdir(), "elmar-test-done-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(join(vaultPath, "1-Projects"), { recursive: true });
    writeFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      `# API
Status: active

## Next Actions
- [ ] Draft spec #work
- [ ] Review code #work
`
    );
    adapter = new MarkdownAdapter(vaultPath, {
      dailyNotesFolder: "Journal",
      templatesFolder: "Templates",
      systemFolder: "_System",
    });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("marks matching task as complete", async () => {
    await runDone(adapter, vaultPath, "Draft spec");
    const content = readFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      "utf-8"
    );
    expect(content).toContain("- [x] Draft spec #work");
    expect(content).toContain("- [ ] Review code #work");
  });

  it("throws when no matching task found", async () => {
    await expect(
      runDone(adapter, vaultPath, "Nonexistent task")
    ).rejects.toThrow("No matching task found");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/commands/done.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement done command**

Create `src/commands/done.ts`:

```typescript
import type { VaultAdapter } from "../adapters/adapter.js";
import { parseTasks } from "../core/task-parser.js";

export async function runDone(
  adapter: VaultAdapter,
  vaultPath: string,
  searchText: string
): Promise<{ file: string; task: string }> {
  const scanFolders = ["1-Projects", "2-Areas"];
  const normalizedSearch = searchText.toLowerCase();

  for (const folder of scanFolders) {
    const files = await adapter.listFiles(folder);
    for (const file of files) {
      const content = await adapter.readNote(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.match(/^- \[ \]/) &&
          line.toLowerCase().includes(normalizedSearch)
        ) {
          const updated = [...lines];
          updated[i] = line.replace("- [ ]", "- [x]");
          await adapter.writeNote(file, updated.join("\n"));
          return { file, task: line.trim() };
        }
      }
    }
  }

  throw new Error(
    `No matching task found for "${searchText}"`
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/commands/done.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/done.ts tests/commands/done.test.ts
git commit -m "feat: add elmar done command to mark tasks complete from terminal"
```

---

## Task 14: `elmar journal` and `elmar status` Commands

**Files:**
- Create: `src/commands/journal.ts`, `src/commands/status.ts`

- [ ] **Step 1: Write failing tests for journal and status**

Create `tests/commands/journal.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runJournal } from "../../src/commands/journal.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runJournal", () => {
  const vaultPath = join(tmpdir(), "elmar-test-journal-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(join(vaultPath, "Journal"), { recursive: true });
    mkdirSync(join(vaultPath, "Templates"), { recursive: true });
    mkdirSync(join(vaultPath, "_System"), { recursive: true });
    writeFileSync(
      join(vaultPath, "Journal", "2026-03-21.md"),
      "# 2026-03-21\n\n## Journal\n<!-- Free writing -->\n\n## Tracking\njournal::\n"
    );
    writeFileSync(
      join(vaultPath, "_System", "metrics.json"),
      JSON.stringify({ metrics: [{ key: "journal", label: "Journal", type: "text" }] })
    );
    writeFileSync(
      join(vaultPath, "Templates", "daily-note-cli.md"),
      "# {{date}}\n\n## Journal\n\n## Tracking\n{{tracking_fields}}\n"
    );
    adapter = new MarkdownAdapter(vaultPath, {
      dailyNotesFolder: "Journal",
      templatesFolder: "Templates",
      systemFolder: "_System",
    });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("appends text to journal section", async () => {
    await runJournal(adapter, "Had a great day.", "2026-03-21");
    const content = readFileSync(join(vaultPath, "Journal", "2026-03-21.md"), "utf-8");
    expect(content).toContain("Had a great day.");
  });

  it("updates journal:: character count", async () => {
    await runJournal(adapter, "Short entry.", "2026-03-21");
    const content = readFileSync(join(vaultPath, "Journal", "2026-03-21.md"), "utf-8");
    expect(content).toMatch(/journal:: \d+/);
  });
});
```

Create `tests/commands/status.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runStatus } from "../../src/commands/status.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runStatus", () => {
  const vaultPath = join(tmpdir(), "elmar-test-status-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(join(vaultPath, "0-Inbox"), { recursive: true });
    mkdirSync(join(vaultPath, "1-Projects"), { recursive: true });
    mkdirSync(join(vaultPath, "2-Areas"), { recursive: true });
    mkdirSync(join(vaultPath, "Journal"), { recursive: true });
    mkdirSync(join(vaultPath, "_System"), { recursive: true });

    writeFileSync(join(vaultPath, "0-Inbox", "inbox.md"), "# Inbox\n\n- Item one\n- Item two\n");
    writeFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      "# API\nStatus: active\n\n## Next Actions\n- [ ] Task one 📅 2026-03-10\n- [ ] Task two\n"
    );
    writeFileSync(
      join(vaultPath, "Journal", "2026-03-21.md"),
      "# 2026-03-21\n\n## Tracking\nsleep::\nreading:: 30\n"
    );
    adapter = new MarkdownAdapter(vaultPath, {
      dailyNotesFolder: "Journal",
      templatesFolder: "Templates",
      systemFolder: "_System",
    });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("counts inbox items", async () => {
    const status = await runStatus(adapter, vaultPath, "0-Inbox/inbox.md", "2026-03-21");
    expect(status.inboxCount).toBe(2);
  });

  it("counts open tasks", async () => {
    const status = await runStatus(adapter, vaultPath, "0-Inbox/inbox.md", "2026-03-21");
    expect(status.openTaskCount).toBe(2);
  });

  it("counts overdue tasks", async () => {
    const status = await runStatus(adapter, vaultPath, "0-Inbox/inbox.md", "2026-03-21");
    expect(status.overdueCount).toBe(1); // Task one due 2026-03-10
  });

  it("detects tracking gaps", async () => {
    const status = await runStatus(adapter, vaultPath, "0-Inbox/inbox.md", "2026-03-21");
    expect(status.todayTrackingGaps).toContain("sleep");
    expect(status.todayTrackingGaps).not.toContain("reading"); // reading has a value
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/commands/journal.test.ts tests/commands/status.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement journal command**

Create `src/commands/journal.ts`:

```typescript
import type { VaultAdapter } from "../adapters/adapter.js";
import { setInlineField } from "../core/markdown-utils.js";
import { countSectionChars } from "../core/daily-note.js";

export async function runJournal(
  adapter: VaultAdapter,
  text: string,
  date: string
): Promise<void> {
  const notePath = await adapter.ensureDailyNote(date);
  let content = await adapter.readNote(notePath);

  // Append to ## Journal section
  await adapter.appendToSection(notePath, "## Journal", text);

  // Update journal:: character count
  content = await adapter.readNote(notePath);
  const charCount = countSectionChars(content, "## Journal");
  content = setInlineField(content, "journal", String(charCount));
  await adapter.writeNote(notePath, content);
}
```

- [ ] **Step 4: Implement status command**

Create `src/commands/status.ts`:

```typescript
import type { VaultAdapter } from "../adapters/adapter.js";
import { collectTasks } from "./tasks.js";

export interface StatusSummary {
  readonly inboxCount: number;
  readonly openTaskCount: number;
  readonly overdueCount: number;
  readonly todayTrackingGaps: readonly string[];
}

export async function runStatus(
  adapter: VaultAdapter,
  vaultPath: string,
  inboxPath: string,
  date: string
): Promise<StatusSummary> {
  // Count inbox items
  let inboxCount = 0;
  if (await adapter.noteExists(inboxPath)) {
    const inboxContent = await adapter.readNote(inboxPath);
    const lines = inboxContent.split("\n");
    inboxCount = lines.filter(
      (l) => l.trim().startsWith("- ") && l.trim().length > 2
    ).length;
  }

  // Count open and overdue tasks
  const allTasks = await collectTasks(adapter, vaultPath);
  const tasks = allTasks.filter((t) => !t.completed);
  const openTaskCount = tasks.length;
  const overdueCount = tasks.filter(
    (t) => t.dueDate !== null && t.dueDate < date
  ).length;

  // Check today's tracking gaps
  const trackingGaps: string[] = [];
  const dailyNotePath = `Journal/${date}.md`;
  if (await adapter.noteExists(dailyNotePath)) {
    const content = await adapter.readNote(dailyNotePath);
    // Find empty inline fields in Tracking section
    const lines = content.split("\n");
    let inTracking = false;
    for (const line of lines) {
      if (line.trim() === "## Tracking") {
        inTracking = true;
        continue;
      }
      if (line.startsWith("##") && inTracking) break;
      if (inTracking) {
        const match = line.match(/^(\w+)::$/);
        if (match) {
          trackingGaps.push(match[1]);
        }
      }
    }
  }

  return { inboxCount, openTaskCount, overdueCount, todayTrackingGaps: trackingGaps };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/commands/journal.test.ts tests/commands/status.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/journal.ts src/commands/status.ts tests/commands/journal.test.ts tests/commands/status.test.ts
git commit -m "feat: add elmar journal and status commands with tests"
```

---

## Task 15: Wire Up CLI Entry Point

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Wire all commands into Commander**

Update `src/index.ts`:

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./core/config.js";
import { resolveAdapter } from "./adapters/resolve.js";
import { runInit } from "./commands/init.js";
import { runCapture } from "./commands/capture.js";
import { collectTasks, filterTasks } from "./commands/tasks.js";
import { runLog } from "./commands/log.js";
import { runJournal } from "./commands/journal.js";
import { runDone } from "./commands/done.js";
import { runStatus } from "./commands/status.js";
import chalk from "chalk";
import { homedir } from "node:os";
import { join } from "node:path";

const program = new Command();

program
  .name("elmar")
  .description(
    "Personal knowledge & productivity system — Obsidian vault + CLI"
  )
  .version("0.1.0");

program
  .command("init")
  .description("Set up a new Elmar vault")
  .argument("<path>", "Path for the new vault")
  .action(async (path: string) => {
    const configPath = join(homedir(), ".elmar.config.json");
    try {
      await runInit(path, configPath);
      console.log(chalk.green(`Vault created at ${path}`));
      console.log(chalk.green(`Config saved to ${configPath}`));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("capture")
  .description("Quick capture to inbox")
  .argument("<text>", "Text to capture")
  .action(async (text: string) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      await runCapture(adapter, config.inboxFile, text);
      console.log(chalk.green("Captured to inbox."));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("tasks")
  .description("List tasks across all projects")
  .option("--area <area>", "Filter by area")
  .option("--due <date>", "Show tasks due on or before date (or 'today')")
  .option("--waiting", "Show only waiting-for tasks")
  .option("--all", "Include completed tasks")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const tasks = await collectTasks(adapter, config.vaultPath);

      const dueDate =
        opts.due === "today"
          ? new Date().toISOString().slice(0, 10)
          : opts.due;

      const filtered = filterTasks(tasks, {
        area: opts.area,
        due: dueDate,
        waiting: opts.waiting ? true : undefined,
        all: opts.all,
      });

      if (filtered.length === 0) {
        console.log(chalk.dim("No tasks found."));
        return;
      }

      for (const task of filtered) {
        const area = chalk.cyan(`[${task.sourceArea}]`);
        const due = task.dueDate
          ? chalk.yellow(` 📅 ${task.dueDate}`)
          : "";
        const waiting = task.waiting ? chalk.magenta(" [waiting]") : "";
        const check = task.completed ? chalk.green("[x]") : "[ ]";
        console.log(`${check} ${area} ${task.text}${due}${waiting}`);
      }
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("log")
  .description("Log a metric to today's daily note")
  .argument("<key>", "Metric key (e.g., sleep, reading, grateful)")
  .argument("<value>", "Metric value")
  .action(async (key: string, value: string) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const today = new Date().toISOString().slice(0, 10);
      await runLog(adapter, config.vaultPath, config.systemFolder, key, value, today);
      console.log(chalk.green(`Logged ${key}: ${value}`));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("journal")
  .description("Append to today's journal")
  .argument("<text>", "Journal text")
  .action(async (text: string) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const today = new Date().toISOString().slice(0, 10);
      await runJournal(adapter, text, today);
      console.log(chalk.green("Added to journal."));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("done")
  .description("Mark a task as complete")
  .argument("<text>", "Task text to match")
  .action(async (text: string) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const result = await runDone(adapter, config.vaultPath, text);
      console.log(chalk.green(`Completed: ${result.task}`));
      console.log(chalk.dim(`  in ${result.file}`));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show overview of inbox, tasks, and tracking")
  .action(async () => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const today = new Date().toISOString().slice(0, 10);
      const summary = await runStatus(
        adapter,
        config.vaultPath,
        config.inboxFile,
        today
      );

      console.log(chalk.bold("Elmar Status\n"));
      console.log(`Inbox items:    ${summary.inboxCount}`);
      console.log(`Open tasks:     ${summary.openTaskCount}`);
      console.log(
        `Overdue tasks:  ${summary.overdueCount > 0 ? chalk.red(String(summary.overdueCount)) : "0"}`
      );

      if (summary.todayTrackingGaps.length > 0) {
        console.log(
          `\nTracking gaps:  ${chalk.yellow(summary.todayTrackingGaps.join(", "))}`
        );
      } else {
        console.log(`\nTracking:       ${chalk.green("All logged for today")}`);
      }
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("review")
  .description("Interactive weekly review")
  .option("--resume", "Resume a previously interrupted review")
  .action(async () => {
    console.log(
      chalk.yellow(
        "The interactive weekly review is not yet implemented.\n" +
        "For now, use Obsidian to review your projects and inbox manually."
      )
    );
  });

program
  .command("metrics")
  .description("Show metric trends")
  .option("--days <n>", "Number of days to show", "7")
  .action(async () => {
    console.log(
      chalk.yellow(
        "Metric trend display is not yet implemented.\n" +
        "View trends in Obsidian using the _System/dashboard.md note."
      )
    );
  });

program.parse();
```

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire all commands into CLI entry point"
```

---

## Task 16: `elmar new project` Command

**Files:**
- Create: `src/commands/new.ts`

- [ ] **Step 1: Implement new project command**

Create `src/commands/new.ts`:

```typescript
import type { VaultAdapter } from "../adapters/adapter.js";
import type { ElmarConfig } from "../core/types.js";
import inquirer from "inquirer";

export async function runNewProject(
  adapter: VaultAdapter,
  config: ElmarConfig,
  name: string,
  options: { area?: string }
): Promise<string> {
  const area =
    options.area ??
    (
      await inquirer.prompt([
        {
          type: "list",
          name: "area",
          message: "Which area does this project belong to?",
          choices: config.areas,
        },
      ])
    ).area;

  const { outcome } = await inquirer.prompt([
    {
      type: "input",
      name: "outcome",
      message: "What's the desired outcome?",
    },
  ]);

  const { firstAction } = await inquirer.prompt([
    {
      type: "input",
      name: "firstAction",
      message: "What's the first next action?",
      default: `Define scope for ${name}`,
    },
  ]);

  const { deadline } = await inquirer.prompt([
    {
      type: "input",
      name: "deadline",
      message: "Deadline? (YYYY-MM-DD or leave empty)",
      default: "",
    },
  ]);

  const { context } = await inquirer.prompt([
    {
      type: "input",
      name: "context",
      message: "Any initial notes or context?",
      default: "",
    },
  ]);

  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const filename = `${area}--${slug}.md`;
  const filepath = `1-Projects/${filename}`;
  const today = new Date().toISOString().slice(0, 10);

  const deadlineLine = deadline ? `Deadline: ${deadline}\n` : "";

  const content = `# ${name}

Status: active
Area: ${area}
Outcome: ${outcome}
Created: ${today}
${deadlineLine}
## Next Actions
- [ ] ${firstAction} #${area}${deadline ? ` 📅 ${deadline}` : ""}

## Waiting For

## Notes
${context}
`;

  await adapter.createNote(filepath, content);
  return filepath;
}
```

- [ ] **Step 2: Add to CLI entry point**

Add to `src/index.ts` — import `runNewProject` and add the command:

```typescript
// Add import at top:
import { runNewProject } from "./commands/new.js";

// Add command:
program
  .command("new")
  .description("Create a new project")
  .argument("<type>", "What to create (project)")
  .argument("<name>", "Name of the project")
  .option("--area <area>", "Area (work, personal, family, finance)")
  .action(async (type: string, name: string, opts) => {
    if (type !== "project") {
      console.error(chalk.red(`Unknown type: ${type}. Only 'project' is supported.`));
      process.exit(1);
    }
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const filepath = await runNewProject(adapter, config, name, opts);
      console.log(chalk.green(`Project created: ${filepath}`));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });
```

- [ ] **Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/commands/new.ts src/index.ts
git commit -m "feat: add elmar new project command with guided prompts"
```

---

## Task 17: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md` — comprehensive guide covering:
- What Elmar is (the patchwork elephant metaphor)
- Quick start: `npm install -g elmar && elmar init ~/SecondBrain`
- Command reference (all commands with examples)
- Vault structure explanation (PARA + GTD)
- Metric registry: how to add custom metrics
- Obsidian plugin setup guide
- "Using with Claude Code" section with example workflows
- Customization guide
- Philosophy section (GTD + PARA + Zettelkasten principles)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README with setup guide and Claude Code integration"
```

---

## Task 18: Integration Test & Final Verification

**Files:** None new — run existing tests and manual verification.

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 2: Build the project**

```bash
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 3: Manual smoke test**

```bash
# Test init (writes config to ~/.elmar.config.json by default)
# Use a temp config path to avoid clobbering real config
ELMAR_SMOKE_CONFIG=/tmp/elmar-smoke-config.json
node dist/index.js init /tmp/elmar-smoke-test --config $ELMAR_SMOKE_CONFIG

# If --config flag is not yet implemented, manually create config:
echo '{"vaultPath":"/tmp/elmar-smoke-test"}' > $ELMAR_SMOKE_CONFIG

# Test capture
ELMAR_CONFIG=$ELMAR_SMOKE_CONFIG node dist/index.js capture "Test capture"

# Test status
ELMAR_CONFIG=$ELMAR_SMOKE_CONFIG node dist/index.js status

# Cleanup
rm -rf /tmp/elmar-smoke-test $ELMAR_SMOKE_CONFIG
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during integration testing"
```

(Skip this step if no fixes needed.)

---

## Deferred Tasks (Explicitly Out of Scope for This Plan)

These features are defined in the spec but intentionally deferred. Stub commands print "not yet implemented" messages directing users to Obsidian equivalents.

- **`elmar review`** — interactive weekly review with inquirer prompts, resume state, 6-step walkthrough. Stub command registered. Requires significant UX design for the interactive flow.
- **`elmar metrics`** — terminal trend display for tracked metrics. Stub command registered. Requires terminal charting (e.g., `asciichart` or `cli-chart`).
- **Obsidian CLI adapter** (`src/adapters/obsidian-cli.ts`) — wraps Obsidian CLI for link-safe operations. The markdown adapter is fully functional standalone; this is an enhancement.
- **Obsidian plugin configuration** — set up `.obsidian/` config in vault template with pre-configured Tracker, Templater, Calendar, Dataview, Periodic Notes plugins. Spec says "ships pre-configured" but this requires testing against specific Obsidian versions.
- **npm publish** — prepare `package.json` for distribution, add `files` field, test global install.
