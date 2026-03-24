import { describe, it, expect } from "vitest";
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
