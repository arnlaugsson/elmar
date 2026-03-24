# Elmar Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `elmar review` — a tiered, interactive review command (daily/weekly/monthly) with auto-detection, stacking, and interrupt/resume.

**Architecture:** Three modules: `review-state.ts` (state file I/O, tier detection), `review-steps.ts` (data gathering and note generation), `review.ts` (interactive command handler using inquirer). A `task-date-utils.ts` utility handles due date snoozing. Config extended with `monthlyNotesFolder`. New migration for monthly folder.

**Tech Stack:** TypeScript, Commander.js, Inquirer, Vitest

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/core/review-state.ts` | Read/write review state file, detect due tiers |
| `src/core/review-steps.ts` | Inbox parsing, metrics aggregation, note generation |
| `src/core/task-date-utils.ts` | Parse/replace due dates in task lines (snooze) |
| `src/commands/review.ts` | Interactive command: orchestrates tiers, inquirer prompts |
| `src/core/types.ts` | Add `monthlyNotesFolder` to ElmarConfig |
| `src/core/config.ts` | Add `monthlyNotesFolder` default |
| `src/core/migrations.ts` | Add migration for monthly folder + template |
| `src/index.ts` | Replace review stub with real command |
| `vault-template/Templates/monthly-review.md` | Monthly review note template |
| `vault-template/Journal/monthly/.gitkeep` | Monthly notes folder |
| `tests/core/review-state.test.ts` | State file and tier detection tests |
| `tests/core/review-steps.test.ts` | Data gathering and note generation tests |
| `tests/core/task-date-utils.test.ts` | Due date parsing/replacement tests |
| `tests/commands/review.test.ts` | Integration test with mocked prompts |

---

### Task 1: Config + Types + Migration for Monthly Notes

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/config.ts`
- Modify: `src/core/migrations.ts`
- Create: `vault-template/Templates/monthly-review.md`
- Create: `vault-template/Journal/monthly/.gitkeep`
- Test: `tests/core/migrations.test.ts` (add test)

- [ ] **Step 1: Add `monthlyNotesFolder` to ElmarConfig**

In `src/core/types.ts`, add to `ElmarConfig`:
```typescript
readonly monthlyNotesFolder: string;
```

In `src/core/config.ts`, add to `CONFIG_DEFAULTS`:
```typescript
monthlyNotesFolder: "Journal/monthly",
```

- [ ] **Step 2: Create monthly review template**

Create `vault-template/Templates/monthly-review.md`:
```markdown
# Monthly Review — {{month}}

## Goals Status
<!-- Auto-filled during review -->

## Role Presence
<!-- Auto-filled during review -->

## Area Health
<!-- Auto-filled during review -->

## Projects Archived
<!-- Auto-filled during review -->

## Reflections
<!-- What went well? What needs attention? -->

## Next Month Focus
-
```

- [ ] **Step 3: Create monthly folder**

Create `vault-template/Journal/monthly/.gitkeep` (empty file).

- [ ] **Step 4: Add migration for monthly folder + template**

In `src/core/migrations.ts`, add a new migration entry after the existing 0.2.0 one:

```typescript
{
  version: "0.3.0",
  newFiles: ["Templates/monthly-review.md", "Journal/monthly/.gitkeep"],
  fixes: [],
},
```

- [ ] **Step 5: Bump package.json version to 0.3.0**

- [ ] **Step 6: Run tests, verify, commit**

Run: `npm test`
Expected: All tests pass

```bash
git add src/core/types.ts src/core/config.ts src/core/migrations.ts vault-template/Templates/monthly-review.md vault-template/Journal/monthly/.gitkeep package.json
git commit -m "feat: add monthlyNotesFolder config and migration for review feature"
```

---

### Task 2: Task Date Utilities (Snooze)

**Files:**
- Create: `src/core/task-date-utils.ts`
- Test: `tests/core/task-date-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/task-date-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { snoozeDueDate, parseDueDate } from "../../src/core/task-date-utils.js";

describe("parseDueDate", () => {
  it("extracts date from task line with emoji", () => {
    expect(parseDueDate("- [ ] Draft spec #work 📅 2026-03-20")).toBe("2026-03-20");
  });

  it("returns null when no date", () => {
    expect(parseDueDate("- [ ] Draft spec #work")).toBeNull();
  });
});

describe("snoozeDueDate", () => {
  it("replaces existing date", () => {
    const result = snoozeDueDate("- [ ] Draft spec #work 📅 2026-03-20", "2026-03-27");
    expect(result).toBe("- [ ] Draft spec #work 📅 2026-03-27");
  });

  it("appends date when none exists", () => {
    const result = snoozeDueDate("- [ ] Draft spec #work", "2026-03-27");
    expect(result).toBe("- [ ] Draft spec #work 📅 2026-03-27");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/task-date-utils.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Create `src/core/task-date-utils.ts`:

```typescript
const DUE_DATE_REGEX = /📅\s*(\d{4}-\d{2}-\d{2})/;

export function parseDueDate(line: string): string | null {
  const match = line.match(DUE_DATE_REGEX);
  return match ? match[1] : null;
}

export function snoozeDueDate(line: string, newDate: string): string {
  if (DUE_DATE_REGEX.test(line)) {
    return line.replace(DUE_DATE_REGEX, `📅 ${newDate}`);
  }
  return `${line} 📅 ${newDate}`;
}
```

- [ ] **Step 4: Run tests, verify pass, commit**

Run: `npx vitest run tests/core/task-date-utils.test.ts`
Expected: PASS

```bash
git add src/core/task-date-utils.ts tests/core/task-date-utils.test.ts
git commit -m "feat: add task date utilities for snooze support"
```

---

### Task 3: Review State Module

**Files:**
- Create: `src/core/review-state.ts`
- Test: `tests/core/review-state.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/review-state.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readReviewState, writeReviewState, detectDueTiers } from "../../src/core/review-state.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("readReviewState", () => {
  const dir = join(tmpdir(), "elmar-test-revstate-" + Date.now());

  beforeEach(() => mkdirSync(dir, { recursive: true }));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns defaults when file missing", () => {
    const state = readReviewState(join(dir, "nope.json"));
    expect(state.lastDaily).toBe("");
    expect(state.lastWeekly).toBe("");
    expect(state.lastMonthly).toBe("");
    expect(state.interrupted).toBeNull();
  });

  it("reads existing state", () => {
    const path = join(dir, "state.json");
    writeFileSync(path, JSON.stringify({
      lastDaily: "2026-03-24",
      lastWeekly: "2026-03-21",
      lastMonthly: "2026-03-01",
      interrupted: null,
    }));
    const state = readReviewState(path);
    expect(state.lastDaily).toBe("2026-03-24");
  });
});

describe("writeReviewState", () => {
  const dir = join(tmpdir(), "elmar-test-revwrite-" + Date.now());

  beforeEach(() => mkdirSync(dir, { recursive: true }));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes and reads back state", () => {
    const path = join(dir, "state.json");
    const state = { lastDaily: "2026-03-24", lastWeekly: "2026-03-21", lastMonthly: "2026-03-01", interrupted: null };
    writeReviewState(path, state);
    const loaded = readReviewState(path);
    expect(loaded.lastDaily).toBe("2026-03-24");
  });
});

describe("detectDueTiers", () => {
  it("all tiers due when state is empty", () => {
    const tiers = detectDueTiers({ lastDaily: "", lastWeekly: "", lastMonthly: "", interrupted: null }, "2026-03-24");
    expect(tiers).toEqual(["weekly", "monthly"]);
  });

  it("only daily due when reviewed yesterday", () => {
    const tiers = detectDueTiers({
      lastDaily: "2026-03-23",
      lastWeekly: "2026-03-21",
      lastMonthly: "2026-03-01",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toEqual(["daily"]);
  });

  it("weekly supersedes daily", () => {
    const tiers = detectDueTiers({
      lastDaily: "2026-03-10",
      lastWeekly: "2026-03-10",
      lastMonthly: "2026-03-01",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toEqual(["weekly"]);
  });

  it("monthly stacks with weekly", () => {
    const tiers = detectDueTiers({
      lastDaily: "2026-01-01",
      lastWeekly: "2026-01-01",
      lastMonthly: "2026-01-01",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toEqual(["weekly", "monthly"]);
  });

  it("returns empty when all up to date", () => {
    const tiers = detectDueTiers({
      lastDaily: "2026-03-24",
      lastWeekly: "2026-03-24",
      lastMonthly: "2026-03-24",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/review-state.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Create `src/core/review-state.ts`:

```typescript
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface InterruptedState {
  readonly tier: "daily" | "weekly" | "monthly";
  readonly step: number;
  readonly data: Record<string, unknown>;
}

export interface ReviewState {
  readonly lastDaily: string;
  readonly lastWeekly: string;
  readonly lastMonthly: string;
  readonly interrupted: InterruptedState | null;
}

const DEFAULT_STATE: ReviewState = {
  lastDaily: "",
  lastWeekly: "",
  lastMonthly: "",
  interrupted: null,
};

export function readReviewState(path: string): ReviewState {
  if (!existsSync(path)) return DEFAULT_STATE;
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return {
    lastDaily: raw.lastDaily ?? "",
    lastWeekly: raw.lastWeekly ?? "",
    lastMonthly: raw.lastMonthly ?? "",
    interrupted: raw.interrupted ?? null,
  };
}

export function writeReviewState(path: string, state: ReviewState): void {
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

function daysDiff(dateA: string, dateB: string): number {
  if (!dateA || !dateB) return Infinity;
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export type ReviewTier = "daily" | "weekly" | "monthly";

export function detectDueTiers(state: ReviewState, today: string): ReviewTier[] {
  const tiers: ReviewTier[] = [];

  const dailyDue = state.lastDaily !== today;
  const weeklyDue = daysDiff(state.lastWeekly, today) >= 7;
  const monthlyDue = daysDiff(state.lastMonthly, today) >= 30;

  // Weekly supersedes daily
  if (weeklyDue) {
    tiers.push("weekly");
  } else if (dailyDue) {
    tiers.push("daily");
  }

  if (monthlyDue) {
    tiers.push("monthly");
  }

  return tiers;
}
```

- [ ] **Step 4: Run tests, verify pass, commit**

Run: `npx vitest run tests/core/review-state.test.ts`
Expected: PASS

```bash
git add src/core/review-state.ts tests/core/review-state.test.ts
git commit -m "feat: add review state module with tier detection"
```

---

### Task 4: Review Steps Module (Data Gathering + Note Generation)

**Files:**
- Create: `src/core/review-steps.ts`
- Test: `tests/core/review-steps.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/review-steps.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseInboxItems, aggregateMetrics, generateWeeklyNote, generateMonthlyNote } from "../../src/core/review-steps.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("parseInboxItems", () => {
  it("parses bullet items from inbox content", () => {
    const content = "# Inbox\n\n- Item one *(2026-03-20)*\n- Item two *(2026-03-21)*\n";
    const items = parseInboxItems(content);
    expect(items).toHaveLength(2);
    expect(items[0].text).toBe("Item one *(2026-03-20)*");
    expect(items[0].line).toBe(2);
  });

  it("ignores empty bullets", () => {
    const content = "# Inbox\n\n- \n- Real item\n";
    const items = parseInboxItems(content);
    expect(items).toHaveLength(1);
  });
});

describe("aggregateMetrics", () => {
  const vaultPath = join(tmpdir(), "elmar-test-metrics-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(join(vaultPath, "Journal"), { recursive: true });
    mkdirSync(join(vaultPath, "Templates"), { recursive: true });
    mkdirSync(join(vaultPath, "_System"), { recursive: true });
    writeFileSync(join(vaultPath, "_System", "metrics.json"), JSON.stringify({
      metrics: [
        { key: "sleep", label: "Sleep", type: "number", range: [1, 100] },
        { key: "reading", label: "Reading", type: "number", unit: "minutes" },
      ],
    }));
    writeFileSync(join(vaultPath, "Journal", "2026-03-20.md"),
      "# 2026-03-20\n\n## Tracking\nsleep:: 80\nreading:: 30\n");
    writeFileSync(join(vaultPath, "Journal", "2026-03-21.md"),
      "# 2026-03-21\n\n## Tracking\nsleep:: 90\nreading:: 45\n");
    adapter = new MarkdownAdapter(vaultPath, {
      dailyNotesFolder: "Journal",
      templatesFolder: "Templates",
      systemFolder: "_System",
    });
  });

  afterEach(() => rmSync(vaultPath, { recursive: true, force: true }));

  it("computes averages for number metrics", async () => {
    const result = await aggregateMetrics(adapter, vaultPath, "_System", ["2026-03-20", "2026-03-21"]);
    const sleep = result.find((m) => m.key === "sleep");
    expect(sleep?.avg).toBe(85);
    expect(sleep?.min).toBe(80);
    expect(sleep?.max).toBe(90);
  });
});

describe("generateWeeklyNote", () => {
  it("produces markdown with sections", () => {
    const note = generateWeeklyNote({
      weekLabel: "2026-W13",
      projectDecisions: [{ name: "API", decision: "Still active" }],
      metricsSummary: "Sleep: avg 85",
      reflections: { wentWell: "Good focus", needsAttention: "Sleep", nextFocus: "Ship API" },
    });
    expect(note).toContain("# Weekly Review — 2026-W13");
    expect(note).toContain("API");
    expect(note).toContain("Sleep: avg 85");
    expect(note).toContain("Good focus");
    expect(note).toContain("Ship API");
  });
});

describe("generateMonthlyNote", () => {
  it("produces markdown with monthly sections", () => {
    const note = generateMonthlyNote({
      monthLabel: "2026-03",
      weeklyData: {
        weekLabel: "2026-W13",
        projectDecisions: [],
        metricsSummary: "",
        reflections: { wentWell: "", needsAttention: "", nextFocus: "" },
      },
      goals: [{ text: "Ship v1", status: "On track", note: "" }],
      roles: [{ text: "Engineer", score: 8, note: "" }],
      areaHealth: [{ area: "work", score: 8 }],
      archived: ["old--project"],
    });
    expect(note).toContain("# Monthly Review — 2026-03");
    expect(note).toContain("Ship v1");
    expect(note).toContain("Engineer");
    expect(note).toContain("old--project");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/review-steps.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement review-steps.ts**

Create `src/core/review-steps.ts`:

```typescript
import type { VaultAdapter } from "../adapters/adapter.js";
import { loadRegistry } from "./metric-registry.js";
import { getInlineField } from "./markdown-utils.js";
import { join } from "node:path";

export interface InboxItem {
  readonly text: string;
  readonly line: number;
}

export function parseInboxItems(content: string): InboxItem[] {
  const lines = content.split("\n");
  const items: InboxItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("- ") && line.trim().length > 2) {
      items.push({ text: line.trim().slice(2), line: i });
    }
  }
  return items;
}

export interface MetricAgg {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly avg?: number;
  readonly min?: number;
  readonly max?: number;
  readonly total?: number;
  readonly daysWithEntries?: number;
  readonly totalDays: number;
}

export async function aggregateMetrics(
  adapter: VaultAdapter,
  vaultPath: string,
  systemFolder: string,
  dates: string[]
): Promise<MetricAgg[]> {
  const registry = loadRegistry(join(vaultPath, systemFolder, "metrics.json"));
  const results: MetricAgg[] = [];

  for (const metric of registry.metrics) {
    const values: number[] = [];
    let daysWithEntries = 0;

    for (const date of dates) {
      const notePath = `Journal/${date}.md`;
      if (!(await adapter.noteExists(notePath))) continue;

      const content = await adapter.readNote(notePath);
      const val = getInlineField(content, metric.key);

      if (val !== null) {
        if (metric.type === "number") {
          const num = Number(val);
          if (!isNaN(num)) values.push(num);
        } else {
          daysWithEntries++;
        }
      }
    }

    if (metric.type === "number" && values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      results.push({
        key: metric.key,
        label: metric.label,
        type: metric.type,
        avg: Math.round(sum / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        total: sum,
        totalDays: dates.length,
      });
    } else if (metric.type === "list") {
      const total = values.length > 0 ? values.reduce((a, b) => a + b, 0) : 0;
      // For list metrics, count from inline field values
      let listTotal = 0;
      for (const date of dates) {
        const notePath = `Journal/${date}.md`;
        if (!(await adapter.noteExists(notePath))) continue;
        const content = await adapter.readNote(notePath);
        const val = getInlineField(content, metric.key);
        if (val !== null) listTotal += Number(val) || 0;
      }
      results.push({
        key: metric.key,
        label: metric.label,
        type: metric.type,
        total: listTotal,
        totalDays: dates.length,
      });
    } else {
      results.push({
        key: metric.key,
        label: metric.label,
        type: metric.type,
        daysWithEntries,
        totalDays: dates.length,
      });
    }
  }

  return results;
}

export function formatMetricsSummary(metrics: MetricAgg[]): string {
  const lines: string[] = [];
  for (const m of metrics) {
    if (m.type === "number" && m.avg !== undefined) {
      lines.push(`| ${m.label} | avg ${m.avg} | ${m.min}-${m.max} |`);
    } else if (m.type === "list" && m.total !== undefined) {
      lines.push(`| ${m.label} | ${m.total} items total | |`);
    } else if (m.daysWithEntries !== undefined) {
      lines.push(`| ${m.label} | ${m.daysWithEntries}/${m.totalDays} days | |`);
    }
  }
  return `| Metric | Value | Range |\n|--------|-------|-------|\n${lines.join("\n")}`;
}

export interface ProjectDecision {
  readonly name: string;
  readonly decision: string;
}

export interface ReviewReflections {
  readonly wentWell: string;
  readonly needsAttention: string;
  readonly nextFocus: string;
}

export interface WeeklyNoteData {
  readonly weekLabel: string;
  readonly projectDecisions: readonly ProjectDecision[];
  readonly metricsSummary: string;
  readonly reflections: ReviewReflections;
}

export function generateWeeklyNote(data: WeeklyNoteData): string {
  const projects = data.projectDecisions.length > 0
    ? data.projectDecisions.map((p) => `- **${p.name}**: ${p.decision}`).join("\n")
    : "No projects reviewed";

  return `# Weekly Review — ${data.weekLabel}

## Inbox Processed
- [x] All inbox items processed

## Projects Reviewed
${projects}

## Metrics Summary
${data.metricsSummary}

## Reflections
**What went well:** ${data.reflections.wentWell}

**Needs attention:** ${data.reflections.needsAttention}

## Next Week Focus
${data.reflections.nextFocus}
`;
}

export interface GoalStatus {
  readonly text: string;
  readonly status: string;
  readonly note: string;
}

export interface RoleScore {
  readonly text: string;
  readonly score: number;
  readonly note: string;
}

export interface AreaHealthScore {
  readonly area: string;
  readonly score: number;
}

export interface MonthlyNoteData {
  readonly monthLabel: string;
  readonly weeklyData: WeeklyNoteData;
  readonly goals: readonly GoalStatus[];
  readonly roles: readonly RoleScore[];
  readonly areaHealth: readonly AreaHealthScore[];
  readonly archived: readonly string[];
}

export function generateMonthlyNote(data: MonthlyNoteData): string {
  const goals = data.goals.length > 0
    ? data.goals.map((g) => `- **${g.text}**: ${g.status}${g.note ? ` — ${g.note}` : ""}`).join("\n")
    : "No goals defined";

  const roles = data.roles.length > 0
    ? data.roles.map((r) => `- **${r.text}**: ${r.score}/10${r.note ? ` — ${r.note}` : ""}`).join("\n")
    : "No roles defined";

  const areas = data.areaHealth.length > 0
    ? data.areaHealth.map((a) => `${a.area}:: ${a.score}`).join("\n")
    : "No areas scored";

  const archived = data.archived.length > 0
    ? data.archived.map((a) => `- ${a}`).join("\n")
    : "None";

  return `# Monthly Review — ${data.monthLabel}

## Goals Status
${goals}

## Role Presence
${roles}

## Area Health
${areas}

## Projects Archived
${archived}

## Reflections
**What went well:** ${data.weeklyData.reflections.wentWell}

**Needs attention:** ${data.weeklyData.reflections.needsAttention}

## Next Month Focus
${data.weeklyData.reflections.nextFocus}
`;
}

export function getDatesInRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function getWeekLabel(date: string): string {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.ceil((d.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function parseSectionItems(content: string, heading: string): string[] {
  const lines = content.split("\n");
  const items: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.trim() === heading) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("##")) break;
    if (inSection && line.trim().startsWith("- ") && line.trim().length > 2) {
      items.push(line.trim().slice(2));
    }
  }

  return items;
}
```

- [ ] **Step 4: Run tests, verify pass, commit**

Run: `npx vitest run tests/core/review-steps.test.ts`
Expected: PASS

```bash
git add src/core/review-steps.ts tests/core/review-steps.test.ts
git commit -m "feat: add review steps module for data gathering and note generation"
```

---

### Task 5: Review Command (Interactive Orchestrator)

**Files:**
- Create: `src/commands/review.ts`
- Modify: `src/index.ts`

This is the largest task. It wires together all the modules with inquirer prompts.

- [ ] **Step 1: Create src/commands/review.ts**

```typescript
import type { VaultAdapter } from "../adapters/adapter.js";
import type { ElmarConfig } from "../core/types.js";
import {
  readReviewState,
  writeReviewState,
  detectDueTiers,
  type ReviewState,
  type ReviewTier,
} from "../core/review-state.js";
import {
  parseInboxItems,
  aggregateMetrics,
  formatMetricsSummary,
  generateWeeklyNote,
  generateMonthlyNote,
  getDatesInRange,
  getWeekLabel,
  parseSectionItems,
  type WeeklyNoteData,
  type ProjectDecision,
  type GoalStatus,
  type RoleScore,
  type AreaHealthScore,
} from "../core/review-steps.js";
import { collectTasks, filterTasks } from "./tasks.js";
import { runLog } from "./log.js";
import { snoozeDueDate } from "../core/task-date-utils.js";
import { loadRegistry } from "../core/metric-registry.js";
import { join } from "node:path";
import chalk from "chalk";
import inquirer from "inquirer";

function getStatePath(vaultPath: string, systemFolder: string): string {
  return join(vaultPath, systemFolder, ".elmar-review-state.json");
}

export async function runReview(
  adapter: VaultAdapter,
  config: ElmarConfig,
  opts: { fresh?: boolean }
): Promise<void> {
  const statePath = getStatePath(config.vaultPath, config.systemFolder);
  let state = readReviewState(statePath);
  const today = new Date().toISOString().slice(0, 10);

  if (opts.fresh) {
    state = { ...state, interrupted: null };
  }

  if (state.interrupted) {
    console.log(chalk.yellow(`Resuming ${state.interrupted.tier} review from step ${state.interrupted.step + 1}...\n`));
  }

  const tiers = detectDueTiers(state, today);

  if (tiers.length === 0) {
    console.log(chalk.green("All reviews up to date. Nothing to do."));
    return;
  }

  const tierLabels = tiers.map((t) => t === "daily" ? "Daily check-in" : t === "weekly" ? "Weekly review" : "Monthly review");
  console.log(chalk.bold(`${tierLabels.join(" + ")} due\n`));

  let weeklyData: WeeklyNoteData | null = null;

  // Set up SIGINT handler for interrupt/resume
  let currentTier: ReviewTier = tiers[0];
  let currentStep = 0;

  const saveInterrupted = () => {
    writeReviewState(statePath, {
      ...state,
      interrupted: { tier: currentTier, step: currentStep, data: {} },
    });
    console.log(chalk.yellow("\nReview paused. Run `elmar review` to resume."));
    process.exit(0);
  };

  process.on("SIGINT", saveInterrupted);

  try {
    for (const tier of tiers) {
      currentTier = tier;

      if (tier === "daily") {
        console.log(chalk.bold.cyan("── Daily Check-in ──\n"));
        await runDailySteps(adapter, config, today, (step) => { currentStep = step; });
        state = { ...state, lastDaily: today, interrupted: null };
        writeReviewState(statePath, state);
      }

      if (tier === "weekly") {
        console.log(chalk.bold.cyan("── Weekly Review ──\n"));
        weeklyData = await runWeeklySteps(adapter, config, today, (step) => { currentStep = step; });
        state = { ...state, lastDaily: today, lastWeekly: today, interrupted: null };
        writeReviewState(statePath, state);
      }

      if (tier === "monthly") {
        console.log(chalk.bold.cyan("── Monthly Review ──\n"));
        await runMonthlySteps(adapter, config, today, weeklyData, (step) => { currentStep = step; });
        state = { ...state, lastDaily: today, lastWeekly: today, lastMonthly: today, interrupted: null };
        writeReviewState(statePath, state);
      }
    }
  } finally {
    process.removeListener("SIGINT", saveInterrupted);
  }

  console.log(chalk.green("\n✓ Review complete"));
}

async function runDailySteps(
  adapter: VaultAdapter,
  config: ElmarConfig,
  today: string,
  onStep: (step: number) => void
): Promise<void> {
  // Step 1: Inbox scan
  onStep(0);
  if (await adapter.noteExists(config.inboxFile)) {
    const inboxContent = await adapter.readNote(config.inboxFile);
    const items = parseInboxItems(inboxContent);
    if (items.length > 0) {
      console.log(`Inbox: ${items.length} items`);
      const { process: shouldProcess } = await inquirer.prompt([
        { type: "confirm", name: "process", message: "Process inbox now?", default: true },
      ]);
      if (shouldProcess) {
        await processInboxItems(adapter, config, items, false);
      }
    } else {
      console.log(chalk.green("Inbox is clear!"));
    }
  }

  // Step 2: Today's tasks
  onStep(1);
  const allTasks = await collectTasks(adapter, config.vaultPath);
  const dueTasks = filterTasks(allTasks, { due: today });
  if (dueTasks.length > 0) {
    console.log(`\nToday's tasks: ${dueTasks.length} due/overdue`);
    for (const task of dueTasks) {
      const { action } = await inquirer.prompt([{
        type: "list",
        name: "action",
        message: `${task.text} (${task.sourceArea})`,
        choices: ["Done", "Snooze", "Skip"],
      }]);
      if (action === "Done") {
        const content = await adapter.readNote(task.sourcePath);
        const lines = content.split("\n");
        lines[task.line] = lines[task.line].replace("- [ ]", "- [x]");
        await adapter.writeNote(task.sourcePath, lines.join("\n"));
        console.log(chalk.green(`  ✓ Completed`));
      } else if (action === "Snooze") {
        const { newDate } = await inquirer.prompt([
          { type: "input", name: "newDate", message: "New due date (YYYY-MM-DD):" },
        ]);
        const content = await adapter.readNote(task.sourcePath);
        const lines = content.split("\n");
        lines[task.line] = snoozeDueDate(lines[task.line], newDate);
        await adapter.writeNote(task.sourcePath, lines.join("\n"));
        console.log(chalk.yellow(`  → Snoozed to ${newDate}`));
      }
    }
  } else {
    console.log(chalk.green("\nNo tasks due today."));
  }

  // Step 3: Tracking gaps
  onStep(2);
  const registry = loadRegistry(join(config.vaultPath, config.systemFolder, "metrics.json"));
  const notePath = await adapter.ensureDailyNote(today);
  const noteContent = await adapter.readNote(notePath);
  const gaps: string[] = [];
  for (const metric of registry.metrics) {
    const lines = noteContent.split("\n");
    const fieldLine = lines.find((l) => l.match(new RegExp(`^${metric.key}::$`)));
    if (fieldLine) gaps.push(metric.key);
  }

  if (gaps.length > 0) {
    console.log(`\nTracking gaps: ${gaps.join(", ")}`);
    const { fillGaps } = await inquirer.prompt([
      { type: "confirm", name: "fillGaps", message: "Log missing metrics now?", default: true },
    ]);
    if (fillGaps) {
      for (const key of gaps) {
        const metric = registry.metrics.find((m) => m.key === key);
        if (!metric) continue;
        const label = metric.range ? `${metric.label} (${metric.range[0]}-${metric.range[1]})` : metric.label;
        const { value } = await inquirer.prompt([
          { type: "input", name: "value", message: `${label}:` },
        ]);
        if (value.trim()) {
          await runLog(adapter, config.vaultPath, config.systemFolder, key, value.trim(), today);
          console.log(chalk.green(`  ✓ Logged ${key}: ${value.trim()}`));
        }
      }
    }
  } else {
    console.log(chalk.green("\nAll metrics logged for today."));
  }
}

async function processInboxItems(
  adapter: VaultAdapter,
  config: ElmarConfig,
  items: readonly { text: string; line: number }[],
  mandatory: boolean
): Promise<void> {
  const choices = mandatory
    ? ["Move to project", "Create task", "Archive", "Delete"]
    : ["Move to project", "Create task", "Skip"];

  let inboxContent = await adapter.readNote(config.inboxFile);
  const linesToRemove: number[] = [];

  for (const item of items) {
    const { action } = await inquirer.prompt([{
      type: "list",
      name: "action",
      message: item.text,
      choices,
    }]);

    if (action === "Move to project" || action === "Create task") {
      const projects = await adapter.listFiles("1-Projects");
      const { project } = await inquirer.prompt([{
        type: "list",
        name: "project",
        message: "Which project?",
        choices: projects.map((p) => p.replace("1-Projects/", "")),
      }]);
      const projectPath = `1-Projects/${project}`;

      if (action === "Move to project") {
        await adapter.appendToSection(projectPath, "## Notes", `- ${item.text}`);
        console.log(chalk.green(`  → Moved to ${project}`));
      } else {
        await adapter.appendToSection(projectPath, "## Next Actions", `- [ ] ${item.text}`);
        console.log(chalk.green(`  → Task created in ${project}`));
      }
      linesToRemove.push(item.line);
    } else if (action === "Archive" || action === "Delete") {
      linesToRemove.push(item.line);
      console.log(chalk.dim(`  → Removed`));
    }
    // "Skip" does nothing
  }

  // Remove processed lines (reverse order to keep indices valid)
  if (linesToRemove.length > 0) {
    const lines = inboxContent.split("\n");
    for (const lineNum of linesToRemove.sort((a, b) => b - a)) {
      lines.splice(lineNum, 1);
    }
    await adapter.writeNote(config.inboxFile, lines.join("\n"));
  }
}

async function runWeeklySteps(
  adapter: VaultAdapter,
  config: ElmarConfig,
  today: string,
  onStep: (step: number) => void
): Promise<WeeklyNoteData> {
  const projectDecisions: ProjectDecision[] = [];

  // Step 1: Inbox (mandatory)
  onStep(0);
  if (await adapter.noteExists(config.inboxFile)) {
    const inboxContent = await adapter.readNote(config.inboxFile);
    const items = parseInboxItems(inboxContent);
    if (items.length > 0) {
      console.log(`Inbox: ${items.length} items to process`);
      await processInboxItems(adapter, config, items, true);
    } else {
      console.log(chalk.green("Inbox is clear!"));
    }
  }

  // Step 2: Project scan
  onStep(1);
  const projectFiles = await adapter.listFiles("1-Projects");
  console.log(`\nReviewing ${projectFiles.length} projects...`);
  for (const file of projectFiles) {
    const content = await adapter.readNote(file);
    if (!content.includes("Status:: active")) continue;

    const name = file.replace("1-Projects/", "").replace(".md", "");
    const openTasks = content.split("\n").filter((l) => l.match(/^- \[ \]/)).length;

    const { action } = await inquirer.prompt([{
      type: "list",
      name: "action",
      message: `${name} (${openTasks} open tasks)`,
      choices: ["Still active", "Move to someday", "Archive"],
    }]);

    if (action === "Move to someday") {
      const updated = content.replace(/^Status:: active$/m, "Status:: someday");
      await adapter.writeNote(file, updated);
      projectDecisions.push({ name, decision: "→ Someday" });
    } else if (action === "Archive") {
      await adapter.moveNote(file, file.replace("1-Projects/", "4-Archive/"));
      projectDecisions.push({ name, decision: "→ Archived" });
    } else {
      projectDecisions.push({ name, decision: "Active" });

      const { newTask } = await inquirer.prompt([
        { type: "input", name: "newTask", message: "New task? (blank to skip):" },
      ]);
      if (newTask.trim()) {
        const area = name.split("--")[0] || "personal";
        await adapter.appendToSection(file, "## Next Actions", `- [ ] ${newTask.trim()} #${area}`);
        console.log(chalk.green(`  ✓ Task added`));
      }
    }
  }

  // Step 3: Someday/Maybe
  onStep(2);
  const somedayFiles = [];
  for (const file of projectFiles) {
    if (!(await adapter.noteExists(file))) continue;
    const content = await adapter.readNote(file);
    if (content.includes("Status:: someday")) somedayFiles.push(file);
  }
  if (somedayFiles.length > 0) {
    console.log(`\nSomeday/Maybe: ${somedayFiles.length} projects`);
    for (const file of somedayFiles) {
      const name = file.replace("1-Projects/", "").replace(".md", "");
      const { action } = await inquirer.prompt([{
        type: "list",
        name: "action",
        message: name,
        choices: ["Activate", "Keep as someday", "Drop"],
      }]);
      if (action === "Activate") {
        const content = await adapter.readNote(file);
        await adapter.writeNote(file, content.replace(/^Status:: someday$/m, "Status:: active"));
      } else if (action === "Drop") {
        await adapter.moveNote(file, file.replace("1-Projects/", "4-Archive/"));
      }
    }
  }

  // Step 4: Area check
  onStep(3);
  console.log("\nArea check:");
  const allTasks = await collectTasks(adapter, config.vaultPath);
  const areaNotes: string[] = [];
  for (const area of config.areas) {
    const areaTasks = filterTasks(allTasks, { area });
    console.log(`  ${area}: ${areaTasks.length} open tasks`);
    const { needsAttention } = await inquirer.prompt([
      { type: "confirm", name: "needsAttention", message: `${area} needs attention?`, default: false },
    ]);
    if (needsAttention) {
      const { note } = await inquirer.prompt([
        { type: "input", name: "note", message: "Note:" },
      ]);
      if (note.trim()) areaNotes.push(`${area}: ${note.trim()}`);
    }
  }

  // Step 5: Metrics summary
  onStep(4);
  const dates = getDatesInRange(today, 7);
  const metrics = await aggregateMetrics(adapter, config.vaultPath, config.systemFolder, dates);
  const metricsSummary = formatMetricsSummary(metrics);
  console.log("\nMetrics this week:");
  console.log(metricsSummary);

  // Step 6: Reflections
  onStep(5);
  const { wentWell } = await inquirer.prompt([
    { type: "input", name: "wentWell", message: "\nWhat went well this week?" },
  ]);
  const { needsAttention } = await inquirer.prompt([
    { type: "input", name: "needsAttention", message: "What needs attention?" },
  ]);
  const { nextFocus } = await inquirer.prompt([
    { type: "input", name: "nextFocus", message: "Next week's top focus?" },
  ]);

  // Step 7: Generate weekly note
  onStep(6);
  const weekLabel = getWeekLabel(today);
  const weeklyData: WeeklyNoteData = {
    weekLabel,
    projectDecisions,
    metricsSummary,
    reflections: { wentWell, needsAttention, nextFocus },
  };

  const weeklyNote = generateWeeklyNote(weeklyData);
  const weeklyPath = `${config.weeklyNotesFolder}/${weekLabel}.md`;
  await adapter.createNote(weeklyPath, weeklyNote);
  console.log(chalk.green(`\n✓ Weekly note saved to ${weeklyPath}`));

  return weeklyData;
}

async function runMonthlySteps(
  adapter: VaultAdapter,
  config: ElmarConfig,
  today: string,
  weeklyData: WeeklyNoteData | null,
  onStep: (step: number) => void
): Promise<void> {
  // If weekly wasn't run in this session, run it now
  if (!weeklyData) {
    weeklyData = await runWeeklySteps(adapter, config, today, onStep);
  }

  const monthLabel = today.slice(0, 7);

  // Step 8: Goals review
  onStep(7);
  const goals: GoalStatus[] = [];
  if (await adapter.noteExists("Home.md")) {
    const homeContent = await adapter.readNote("Home.md");
    const goalItems = parseSectionItems(homeContent, "## Goals");
    if (goalItems.length > 0) {
      console.log("\nGoals review:");
      for (const goal of goalItems) {
        if (goal.startsWith("*")) continue; // skip placeholder hints
        const { status } = await inquirer.prompt([{
          type: "list",
          name: "status",
          message: goal,
          choices: ["On track", "Needs attention", "Achieved", "Drop"],
        }]);
        const { note } = await inquirer.prompt([
          { type: "input", name: "note", message: "Note (blank to skip):" },
        ]);
        goals.push({ text: goal, status, note: note.trim() });
      }
    }
  } else {
    console.log(chalk.dim("\nNo Home.md found — skipping goals review. Set up Home.md to track goals."));
  }

  // Step 9: Roles check
  onStep(8);
  const roles: RoleScore[] = [];
  if (await adapter.noteExists("Home.md")) {
    const homeContent = await adapter.readNote("Home.md");
    const roleItems = parseSectionItems(homeContent, "## Roles");
    if (roleItems.length > 0) {
      console.log("\nRoles check:");
      for (const role of roleItems) {
        if (role.startsWith("*")) continue;
        const { score } = await inquirer.prompt([
          { type: "number", name: "score", message: `${role} presence (1-10):`, default: 5 },
        ]);
        const { note } = await inquirer.prompt([
          { type: "input", name: "note", message: "Note (blank to skip):" },
        ]);
        roles.push({ text: role, score, note: note.trim() });
      }
    }
  }

  // Step 10: Area health
  onStep(9);
  const areaHealth: AreaHealthScore[] = [];
  console.log("\nArea health:");
  for (const area of config.areas) {
    const { score } = await inquirer.prompt([
      { type: "number", name: "score", message: `${area} health (1-10):`, default: 5 },
    ]);
    areaHealth.push({ area, score });
  }

  // Step 11: Archive sweep
  onStep(10);
  const archived: string[] = [];
  const projectFiles = await adapter.listFiles("1-Projects");
  const completeCandidates: string[] = [];
  for (const file of projectFiles) {
    const content = await adapter.readNote(file);
    if (!content.includes("Status:: active")) continue;
    const hasOpenTasks = content.split("\n").some((l) => l.match(/^- \[ \]/));
    if (!hasOpenTasks) completeCandidates.push(file);
  }

  if (completeCandidates.length > 0) {
    console.log(`\nArchive sweep: ${completeCandidates.length} projects with no open tasks`);
    for (const file of completeCandidates) {
      const name = file.replace("1-Projects/", "").replace(".md", "");
      const { action } = await inquirer.prompt([{
        type: "list",
        name: "action",
        message: name,
        choices: ["Archive", "Keep active", "Add new tasks"],
      }]);
      if (action === "Archive") {
        await adapter.moveNote(file, file.replace("1-Projects/", "4-Archive/"));
        archived.push(name);
        console.log(chalk.green(`  → Archived`));
      } else if (action === "Add new tasks") {
        const { task } = await inquirer.prompt([
          { type: "input", name: "task", message: "New task:" },
        ]);
        if (task.trim()) {
          const area = name.split("--")[0] || "personal";
          await adapter.appendToSection(file, "## Next Actions", `- [ ] ${task.trim()} #${area}`);
        }
      }
    }
  }

  // Step 12: Generate monthly note
  onStep(11);
  const monthlyNote = generateMonthlyNote({
    monthLabel,
    weeklyData,
    goals,
    roles,
    areaHealth,
    archived,
  });

  const monthlyPath = `${config.monthlyNotesFolder}/${monthLabel}.md`;
  await adapter.createNote(monthlyPath, monthlyNote);
  console.log(chalk.green(`✓ Monthly note saved to ${monthlyPath}`));
}
```

- [ ] **Step 2: Update src/index.ts — replace review stub**

Replace the existing review command (lines 215-226) with:

```typescript
import { runReview } from "./commands/review.js";

// ... in the command definitions:

program
  .command("review")
  .description("Interactive review (daily/weekly/monthly)")
  .option("--fresh", "Ignore interrupted state, start fresh")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      await runReview(adapter, config, { fresh: opts.fresh });
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All existing tests pass (review.ts has no unit tests yet — those are in task 6)

- [ ] **Step 4: Commit**

```bash
git add src/commands/review.ts src/index.ts
git commit -m "feat: implement interactive review command with daily/weekly/monthly tiers"
```

---

### Task 6: Integration Test for Review

**Files:**
- Create: `tests/commands/review.test.ts`

Note: Full interactive testing of inquirer is complex. Focus on testing the non-interactive parts and verifying the command doesn't crash with mocked data.

- [ ] **Step 1: Write integration test**

Create `tests/commands/review.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectDueTiers } from "../../src/core/review-state.js";
import { parseInboxItems, generateWeeklyNote, generateMonthlyNote, getDatesInRange, getWeekLabel, parseSectionItems } from "../../src/core/review-steps.js";

describe("review integration", () => {
  it("getDatesInRange returns correct number of dates", () => {
    const dates = getDatesInRange("2026-03-24", 7);
    expect(dates).toHaveLength(7);
    expect(dates[6]).toBe("2026-03-24");
    expect(dates[0]).toBe("2026-03-18");
  });

  it("getWeekLabel returns correct format", () => {
    const label = getWeekLabel("2026-03-24");
    expect(label).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("parseSectionItems extracts bullet items from a section", () => {
    const content = "# Home\n\n## Goals\n- Ship v1\n- Learn Rust\n\n## Roles\n- Engineer\n- Father\n";
    expect(parseSectionItems(content, "## Goals")).toEqual(["Ship v1", "Learn Rust"]);
    expect(parseSectionItems(content, "## Roles")).toEqual(["Engineer", "Father"]);
  });

  it("parseSectionItems returns empty for missing section", () => {
    expect(parseSectionItems("# Home\n", "## Goals")).toEqual([]);
  });

  it("full tier stacking scenario", () => {
    // All reviews are very old — should get weekly + monthly
    const tiers = detectDueTiers({
      lastDaily: "2026-01-01",
      lastWeekly: "2026-01-01",
      lastMonthly: "2026-01-01",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toContain("weekly");
    expect(tiers).toContain("monthly");
    expect(tiers).not.toContain("daily"); // weekly supersedes
  });
});
```

- [ ] **Step 2: Run tests, verify pass, commit**

Run: `npm test`
Expected: All tests pass

```bash
git add tests/commands/review.test.ts
git commit -m "test: add review integration tests"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Smoke test**

```bash
cd ~/Projects/elmar
npm link
# Create a temp vault and test
TMPVAULT=$(mktemp -d)
ELMAR_CONFIG="$TMPVAULT/config.json"
elmar init "$TMPVAULT/vault"
# Verify review command exists
elmar review --help
```

- [ ] **Step 4: Push**

```bash
git push
```
