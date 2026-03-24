import { describe, it, expect, vi } from "vitest";
import {
  buildNavBar,
  replaceOrInsertNav,
  findPreviousDailyNote,
  linkDailyNote,
} from "../../src/core/daily-note.js";
import type { VaultAdapter } from "../../src/adapters/adapter.js";

function makeAdapter(notes: Record<string, string>): VaultAdapter {
  return {
    readNote: vi.fn(async (path: string) => {
      if (!(path in notes)) throw new Error(`Not found: ${path}`);
      return notes[path];
    }),
    writeNote: vi.fn(async (path: string, content: string) => {
      notes[path] = content;
    }),
    createNote: vi.fn(),
    noteExists: vi.fn(async (path: string) => path in notes),
    listFiles: vi.fn(async (folder: string) =>
      Object.keys(notes).filter((k) => k.startsWith(folder + "/"))
    ),
    deleteNote: vi.fn(),
    appendToSection: vi.fn(),
    moveNote: vi.fn(),
    searchContent: vi.fn(async () => []),
    ensureDailyNote: vi.fn(),
  };
}

describe("buildNavBar", () => {
  it("builds full nav with prev and next", () => {
    const nav = buildNavBar("2026-03-25", "Journal/monthly", "Journal", "2026-03-24", "2026-03-26");
    expect(nav).toBe(
      "[[Journal/2026-03-24|← Previous]] | [[Journal/monthly/2026-03|March]] | [[Journal/2026-03-26|Next →]]"
    );
  });

  it("shows plain text for missing prev", () => {
    const nav = buildNavBar("2026-01-01", "Journal/monthly", "Journal", null, null);
    expect(nav).toBe("← Previous | [[Journal/monthly/2026-01|January]] | Next →");
  });

  it("shows plain text for missing next", () => {
    const nav = buildNavBar("2026-12-15", "Journal/monthly", "Journal", "2026-12-14", null);
    expect(nav).toContain("[[Journal/2026-12-14|← Previous]]");
    expect(nav).toContain("[[Journal/monthly/2026-12|December]]");
    expect(nav.endsWith("Next →")).toBe(true);
  });
});

describe("replaceOrInsertNav", () => {
  it("inserts nav after heading when none exists", () => {
    const content = "# 2026-03-25\n\n## Journal";
    const result = replaceOrInsertNav(content, "NAV_BAR");
    expect(result).toBe("# 2026-03-25\n\nNAV_BAR\n\n## Journal");
  });

  it("replaces existing nav bar", () => {
    const content =
      "# 2026-03-25\n\n[[Journal/2026-03-24|← Previous]] | [[Journal/monthly/2026-03|March]] | Next →\n\n## Journal";
    const result = replaceOrInsertNav(content, "NEW_NAV");
    expect(result).toBe("# 2026-03-25\n\nNEW_NAV\n\n## Journal");
  });
});

describe("findPreviousDailyNote", () => {
  it("finds the most recent note before the given date", async () => {
    const adapter = makeAdapter({
      "Journal/2026-03-20.md": "",
      "Journal/2026-03-22.md": "",
      "Journal/2026-03-24.md": "",
    });

    const prev = await findPreviousDailyNote(adapter, "Journal", "2026-03-24");
    expect(prev).toBe("2026-03-22");
  });

  it("returns null when no previous notes exist", async () => {
    const adapter = makeAdapter({
      "Journal/2026-03-24.md": "",
    });

    const prev = await findPreviousDailyNote(adapter, "Journal", "2026-03-24");
    expect(prev).toBeNull();
  });

  it("skips non-date files", async () => {
    const adapter = makeAdapter({
      "Journal/notes.md": "",
      "Journal/2026-03-20.md": "",
    });

    const prev = await findPreviousDailyNote(adapter, "Journal", "2026-03-24");
    expect(prev).toBe("2026-03-20");
  });
});

describe("linkDailyNote", () => {
  it("adds nav to new note and updates previous note", async () => {
    const notes: Record<string, string> = {
      "Journal/2026-03-22.md": "# 2026-03-22\n\n## Journal\nHello",
      "Journal/2026-03-24.md": "# 2026-03-24\n\n## Tracking\nsleep::",
    };
    const adapter = makeAdapter(notes);

    await linkDailyNote(adapter, "Journal", "Journal/monthly", "2026-03-24");

    // New note should have nav with prev link
    expect(notes["Journal/2026-03-24.md"]).toContain("[[Journal/2026-03-22|← Previous]]");
    expect(notes["Journal/2026-03-24.md"]).toContain("[[Journal/monthly/2026-03|March]]");
    expect(notes["Journal/2026-03-24.md"]).toContain("Next →");

    // Previous note should have nav with next link
    expect(notes["Journal/2026-03-22.md"]).toContain("[[Journal/2026-03-24|Next →]]");
  });

  it("works when there is no previous note", async () => {
    const notes: Record<string, string> = {
      "Journal/2026-03-24.md": "# 2026-03-24\n\n## Tracking",
    };
    const adapter = makeAdapter(notes);

    await linkDailyNote(adapter, "Journal", "Journal/monthly", "2026-03-24");

    expect(notes["Journal/2026-03-24.md"]).toContain("← Previous |");
    // No prev link, but month link should exist
    expect(notes["Journal/2026-03-24.md"]).not.toContain("[[Journal/2026");
    expect(notes["Journal/2026-03-24.md"]).toContain("[[Journal/monthly/2026-03|March]]");
  });
});
