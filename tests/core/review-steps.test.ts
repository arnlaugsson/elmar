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
      "---\nsleep: 80\nreading: 30\n---\n# 2026-03-20\n");
    writeFileSync(join(vaultPath, "Journal", "2026-03-21.md"),
      "---\nsleep: 90\nreading: 45\n---\n# 2026-03-21\n");
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
