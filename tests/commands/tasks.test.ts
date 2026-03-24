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

    writeFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      `---
status: active
---
# API Redesign

## Next Actions
- [ ] Draft spec #work
- [x] Review old code #work
- [ ] Submit report #work 📅 2026-03-20
`
    );

    writeFileSync(
      join(vaultPath, "1-Projects", "family--trip.md"),
      `---
status: active
---
# Summer Trip

## Next Actions
- [ ] Book flights #family
`
    );

    writeFileSync(
      join(vaultPath, "1-Projects", "personal--someday.md"),
      `---
status: someday
---
# Learn Piano

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

  it("collects tasks from projects and areas", async () => {
    const tasks = await collectTasks(adapter, vaultPath);
    // Should include active project tasks (including completed), exclude someday
    expect(tasks.length).toBeGreaterThanOrEqual(3);
  });

  it("excludes someday projects by default", async () => {
    const tasks = await collectTasks(adapter, vaultPath);
    const somedayTasks = tasks.filter((t) => t.sourcePath.includes("someday"));
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
    {
      text: "Done thing",
      completed: true,
      tags: ["work"],
      dueDate: null,
      waiting: false,
      sourcePath: "1-Projects/work--api.md",
      sourceArea: "work",
      line: 6,
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

  it("excludes completed by default", () => {
    const filtered = filterTasks(tasks, {});
    expect(filtered.every((t) => !t.completed)).toBe(true);
  });

  it("includes completed with --all", () => {
    const filtered = filterTasks(tasks, { all: true });
    expect(filtered).toHaveLength(3);
  });
});
