import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runCapture } from "../../src/commands/capture.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runCapture", () => {
  const vaultPath = join(tmpdir(), "elmar-test-capture-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(join(vaultPath, "0-Inbox"), { recursive: true });
    writeFileSync(join(vaultPath, "0-Inbox", "inbox.md"), "# Inbox\n\n");
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
    const content = readFileSync(join(vaultPath, "0-Inbox", "inbox.md"), "utf-8");
    expect(content).toContain("- Buy groceries");
  });

  it("appends multiple captures", async () => {
    await runCapture(adapter, "0-Inbox/inbox.md", "First item");
    await runCapture(adapter, "0-Inbox/inbox.md", "Second item");
    const content = readFileSync(join(vaultPath, "0-Inbox", "inbox.md"), "utf-8");
    expect(content).toContain("- First item");
    expect(content).toContain("- Second item");
  });

  it("adds timestamp to capture", async () => {
    await runCapture(adapter, "0-Inbox/inbox.md", "Timed item");
    const content = readFileSync(join(vaultPath, "0-Inbox", "inbox.md"), "utf-8");
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
