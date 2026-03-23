import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runDone } from "../../src/commands/done.js";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runDone", () => {
  const vaultPath = join(tmpdir(), "elmar-test-done-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(join(vaultPath, "1-Projects"), { recursive: true });
    mkdirSync(join(vaultPath, "2-Areas"), { recursive: true });
    writeFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      `# API
Status:: active

## Next Actions
- [ ] Draft spec #work
- [ ] Review code #work
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

  it("marks matching task as complete", async () => {
    await runDone(adapter, vaultPath, "Draft spec");
    const content = readFileSync(join(vaultPath, "1-Projects", "work--api.md"), "utf-8");
    expect(content).toContain("- [x] Draft spec #work");
    expect(content).toContain("- [ ] Review code #work");
  });

  it("throws when no matching task found", async () => {
    await expect(runDone(adapter, vaultPath, "Nonexistent task")).rejects.toThrow(
      "No matching task found"
    );
  });
});
