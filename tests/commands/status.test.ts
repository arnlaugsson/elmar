import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runStatus } from "../../src/commands/status.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runStatus", () => {
  const vaultPath = join(tmpdir(), "elmar-test-status-" + Date.now());
  let adapter: MarkdownAdapter;

  const registry = {
    metrics: [
      { key: "sleep", label: "Sleep", type: "number", range: [1, 100] },
      { key: "reading", label: "Reading", type: "number", unit: "minutes" },
      { key: "grateful", label: "Gratitude", type: "list" },
    ],
  };

  beforeEach(() => {
    mkdirSync(join(vaultPath, "0-Inbox"), { recursive: true });
    mkdirSync(join(vaultPath, "1-Projects"), { recursive: true });
    mkdirSync(join(vaultPath, "2-Areas"), { recursive: true });
    mkdirSync(join(vaultPath, "Journal"), { recursive: true });
    mkdirSync(join(vaultPath, "_System"), { recursive: true });
    writeFileSync(
      join(vaultPath, "0-Inbox", "inbox.md"),
      "# Inbox\n\n- Item one\n- Item two\n"
    );
    writeFileSync(
      join(vaultPath, "_System", "metrics.json"),
      JSON.stringify(registry)
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

  it("reports all metrics as gaps when no daily note exists", async () => {
    const summary = await runStatus(adapter, vaultPath, "0-Inbox/inbox.md", "_System", "2026-03-23");
    expect(summary.todayTrackingGaps).toEqual(["sleep", "reading", "grateful"]);
  });

  it("reports only unfilled metrics as gaps when daily note exists", async () => {
    writeFileSync(
      join(vaultPath, "Journal", "2026-03-23.md"),
      `# 2026-03-23\n\n## Tracking\nsleep:: 85\nreading::\ngrateful::\n\n## Notes\n`
    );
    const summary = await runStatus(adapter, vaultPath, "0-Inbox/inbox.md", "_System", "2026-03-23");
    expect(summary.todayTrackingGaps).toEqual(["reading", "grateful"]);
  });

  it("counts inbox items", async () => {
    const summary = await runStatus(adapter, vaultPath, "0-Inbox/inbox.md", "_System", "2026-03-23");
    expect(summary.inboxCount).toBe(2);
  });
});
