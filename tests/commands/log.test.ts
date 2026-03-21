import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runLog } from "../../src/commands/log.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
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
    writeFileSync(join(vaultPath, "_System", "metrics.json"), JSON.stringify(registry));
    writeFileSync(
      join(vaultPath, "Templates", "daily-note-cli.md"),
      "# {{date}}\n\n## Tracking\n{{tracking_fields}}\n"
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
    const content = readFileSync(join(vaultPath, "Journal", "2026-03-21.md"), "utf-8");
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
    const content = readFileSync(join(vaultPath, "Journal", "2026-03-21.md"), "utf-8");
    expect(content).toContain("- sunshine");
    expect(content).toContain("grateful:: 1");
  });
});
