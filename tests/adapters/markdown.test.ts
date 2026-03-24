import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MarkdownAdapter } from "../../src/adapters/markdown.js";
import {
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("MarkdownAdapter", () => {
  const vaultPath = join(tmpdir(), "elmar-test-vault-" + Date.now());
  let adapter: MarkdownAdapter;

  beforeEach(() => {
    mkdirSync(vaultPath, { recursive: true });
    mkdirSync(join(vaultPath, "Journal"), { recursive: true });
    mkdirSync(join(vaultPath, "Templates"), { recursive: true });
    mkdirSync(join(vaultPath, "_System"), { recursive: true });

    writeFileSync(
      join(vaultPath, "Templates", "daily-note-cli.md"),
      "---\n{{tracking_fields}}\n---\n# {{date}}\n\n## Journal\n"
    );

    writeFileSync(
      join(vaultPath, "_System", "metrics.json"),
      JSON.stringify({
        metrics: [
          { key: "sleep", label: "Sleep", type: "number", range: [1, 100] },
        ],
      })
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

  describe("readNote / writeNote / createNote", () => {
    it("creates and reads a note", async () => {
      await adapter.createNote("test.md", "Hello world");
      const content = await adapter.readNote("test.md");
      expect(content).toBe("Hello world");
    });

    it("overwrites with writeNote", async () => {
      await adapter.createNote("test.md", "First");
      await adapter.writeNote("test.md", "Second");
      const content = await adapter.readNote("test.md");
      expect(content).toBe("Second");
    });
  });

  describe("noteExists", () => {
    it("returns false for missing note", async () => {
      expect(await adapter.noteExists("nope.md")).toBe(false);
    });

    it("returns true for existing note", async () => {
      await adapter.createNote("yes.md", "");
      expect(await adapter.noteExists("yes.md")).toBe(true);
    });
  });

  describe("appendToSection", () => {
    it("appends content to a section", async () => {
      await adapter.createNote(
        "note.md",
        "# Title\n\n## Section\nExisting.\n\n## Other\n"
      );
      await adapter.appendToSection("note.md", "## Section", "New line.");
      const content = await adapter.readNote("note.md");
      expect(content).toContain("Existing.");
      expect(content).toContain("New line.");
      expect(content).toContain("## Other");
    });
  });

  describe("deleteNote / moveNote", () => {
    it("deletes a note", async () => {
      await adapter.createNote("del.md", "bye");
      await adapter.deleteNote("del.md");
      expect(await adapter.noteExists("del.md")).toBe(false);
    });

    it("moves a note", async () => {
      await adapter.createNote("a.md", "content");
      await adapter.moveNote("a.md", "b.md");
      expect(await adapter.noteExists("a.md")).toBe(false);
      expect(await adapter.readNote("b.md")).toBe("content");
    });
  });

  describe("listFiles", () => {
    it("lists markdown files in folder", async () => {
      mkdirSync(join(vaultPath, "1-Projects"), { recursive: true });
      writeFileSync(join(vaultPath, "1-Projects", "a.md"), "");
      writeFileSync(join(vaultPath, "1-Projects", "b.md"), "");

      const files = await adapter.listFiles("1-Projects");
      expect(files).toHaveLength(2);
      expect(files).toContain("1-Projects/a.md");
      expect(files).toContain("1-Projects/b.md");
    });
  });

  describe("ensureDailyNote", () => {
    it("creates daily note from template if missing", async () => {
      const path = await adapter.ensureDailyNote("2026-03-21");
      expect(path).toBe("Journal/2026-03-21.md");
      const content = await adapter.readNote(path);
      expect(content).toContain("2026-03-21");
      expect(content).toContain("## Journal");
      expect(content).toContain("sleep:");
    });

    it("returns existing daily note path without overwriting", async () => {
      await adapter.createNote("Journal/2026-03-21.md", "Existing content");
      const path = await adapter.ensureDailyNote("2026-03-21");
      const content = await adapter.readNote(path);
      expect(content).toBe("Existing content");
    });
  });
});
