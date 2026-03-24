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
