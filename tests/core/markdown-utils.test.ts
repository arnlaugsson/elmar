import { describe, it, expect } from "vitest";
import {
  findSectionRange,
  appendToSection,
  getInlineField,
  setInlineField,
} from "../../src/core/markdown-utils.js";

describe("findSectionRange", () => {
  // Line indices: 0:"# Title", 1:"", 2:"## Journal", 3:"Some journal text.",
  // 4:"", 5:"## Tracking", 6:"sleep:: 85", 7:"", 8:"## Notes", 9:"Some notes."
  const doc = `# Title

## Journal
Some journal text.

## Tracking
sleep:: 85

## Notes
Some notes.`;

  it("finds section start and end (end = index of next heading)", () => {
    const range = findSectionRange(doc, "## Journal");
    expect(range).toEqual({ start: 2, end: 5 });
  });

  it("finds last section extending to end of file", () => {
    const range = findSectionRange(doc, "## Notes");
    expect(range).toEqual({ start: 8, end: 10 });
  });

  it("returns null for missing section", () => {
    const range = findSectionRange(doc, "## Missing");
    expect(range).toBeNull();
  });
});

describe("appendToSection", () => {
  it("appends content before next heading", () => {
    const doc = `## Journal
Text here.

## Notes
`;
    const result = appendToSection(doc, "## Journal", "New line.");
    expect(result).toContain("Text here.");
    expect(result).toContain("New line.");
    expect(result).toContain("## Notes");
    const newLineIdx = result.indexOf("New line.");
    const notesIdx = result.indexOf("## Notes");
    expect(newLineIdx).toBeLessThan(notesIdx);
  });

  it("appends at end of file for last section", () => {
    const doc = `## Notes
Existing.`;
    const result = appendToSection(doc, "## Notes", "Appended.");
    expect(result).toContain("Existing.");
    expect(result).toContain("Appended.");
  });
});

describe("getInlineField", () => {
  it("reads existing field value", () => {
    const doc = "sleep:: 85\nreading:: 30";
    expect(getInlineField(doc, "sleep")).toBe("85");
  });

  it("returns null for empty field", () => {
    const doc = "sleep::\nreading:: 30";
    expect(getInlineField(doc, "sleep")).toBeNull();
  });

  it("returns null for missing field", () => {
    const doc = "reading:: 30";
    expect(getInlineField(doc, "sleep")).toBeNull();
  });
});

describe("setInlineField", () => {
  it("sets value on existing field", () => {
    const doc = "sleep::\nreading:: 30";
    const result = setInlineField(doc, "sleep", "85");
    expect(result).toContain("sleep:: 85");
    expect(result).toContain("reading:: 30");
  });

  it("overwrites existing value", () => {
    const doc = "sleep:: 50\nreading:: 30";
    const result = setInlineField(doc, "sleep", "85");
    expect(result).toContain("sleep:: 85");
  });
});
