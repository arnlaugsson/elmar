import { describe, it, expect, vi, beforeEach } from "vitest";
import { runMetrics } from "../../src/commands/metrics.js";
import type { VaultAdapter } from "../../src/adapters/adapter.js";

function makeAdapter(notes: Record<string, string>): VaultAdapter {
  return {
    readNote: vi.fn(async (path: string) => {
      if (!(path in notes)) throw new Error(`Not found: ${path}`);
      return notes[path];
    }),
    writeNote: vi.fn(),
    createNote: vi.fn(),
    noteExists: vi.fn(async (path: string) => path in notes),
    listFiles: vi.fn(async () => []),
    deleteNote: vi.fn(),
  };
}

const REGISTRY = {
  metrics: [
    { key: "sleep", label: "Sleep Score", type: "number" as const, range: [1, 100] as const },
    { key: "reading", label: "Reading", type: "number" as const, unit: "minutes" },
    { key: "grateful", label: "Gratitude", type: "list" as const },
    { key: "journal", label: "Journal", type: "text" as const },
  ],
};

function dailyNote(fields: Record<string, string>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n# Test`;
}

describe("runMetrics", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-07T12:00:00Z"));
  });

  it("shows 'no daily notes' when none exist", async () => {
    const adapter = makeAdapter({
    });

    await runMetrics(adapter, "/vault", "_System", 7, REGISTRY);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("No daily notes found")
    );
  });

  it("displays number metrics with avg, min, max", async () => {
    const adapter = makeAdapter({
      "_System/metrics.json": REGISTRY,
      "Journal/2025-01-05.md": dailyNote({ sleep: "80", reading: "30" }),
      "Journal/2025-01-06.md": dailyNote({ sleep: "90", reading: "60" }),
      "Journal/2025-01-07.md": dailyNote({ sleep: "70" }),
    });

    await runMetrics(adapter, "/vault", "_System", 3, REGISTRY);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Sleep Score");
    expect(output).toContain("80"); // avg
    expect(output).toContain("70"); // min
    expect(output).toContain("90"); // max
    expect(output).toContain("3/3d");
  });

  it("displays text/list metrics with day counts", async () => {
    const adapter = makeAdapter({
      "_System/metrics.json": REGISTRY,
      "Journal/2025-01-06.md": dailyNote({ grateful: "2", journal: "wrote stuff" }),
      "Journal/2025-01-07.md": dailyNote({ grateful: "3" }),
    });

    await runMetrics(adapter, "/vault", "_System", 3, REGISTRY);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Gratitude");
    expect(output).toContain("2/3 days");
    expect(output).toContain("Journal");
    expect(output).toContain("1/3 days");
  });

  it("shows 'no data' for metrics with no entries", async () => {
    const adapter = makeAdapter({
      "_System/metrics.json": REGISTRY,
      "Journal/2025-01-07.md": dailyNote({ sleep: "80" }),
    });

    await runMetrics(adapter, "/vault", "_System", 1, REGISTRY);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Reading");
    expect(output).toContain("no data");
  });

  it("respects custom day count", async () => {
    const adapter = makeAdapter({
      "_System/metrics.json": REGISTRY,
      "Journal/2025-01-07.md": dailyNote({ sleep: "85" }),
    });

    await runMetrics(adapter, "/vault", "_System", 14, REGISTRY);

    const noteExistsCalls = (adapter.noteExists as ReturnType<typeof vi.fn>).mock.calls;
    expect(noteExistsCalls.length).toBe(14);
  });
});
