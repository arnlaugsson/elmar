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
    const task = parseTaskLine("- [ ] Draft spec #work", "test.md", 0);
    expect(task?.tags).toEqual(["work"]);
  });

  it("extracts multiple tags", () => {
    const task = parseTaskLine("- [ ] Coordinate #work #family", "test.md", 0);
    expect(task?.tags).toEqual(["work", "family"]);
  });

  it("extracts due date", () => {
    const task = parseTaskLine("- [ ] Submit report 📅 2026-03-25", "test.md", 0);
    expect(task?.dueDate).toBe("2026-03-25");
  });

  it("detects waiting-for tag", () => {
    const task = parseTaskLine("- [ ] Feedback from Sara #work/waiting", "test.md", 0);
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
    const tasks = parseTasks("- [ ] Something", "1-Projects/work--api.md");
    expect(tasks[0].sourceArea).toBe("work");
  });

  it("uses 'unknown' area when no prefix", () => {
    const tasks = parseTasks("- [ ] Something", "1-Projects/misc.md");
    expect(tasks[0].sourceArea).toBe("unknown");
  });
});
