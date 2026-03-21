import { describe, it, expect } from "vitest";
import { countBullets, countSectionChars } from "../../src/core/daily-note.js";

describe("countBullets", () => {
  it("counts bullet items in section", () => {
    const content = `## Gratitude
- sunshine
- family
- good coffee

## Tracking`;
    expect(countBullets(content, "## Gratitude")).toBe(3);
  });

  it("returns 0 for empty section", () => {
    const content = `## Gratitude
-

## Tracking`;
    expect(countBullets(content, "## Gratitude")).toBe(0);
  });
});

describe("countSectionChars", () => {
  it("counts non-heading characters", () => {
    const content = `## Journal
Hello world this is my journal.

## Tracking`;
    const count = countSectionChars(content, "## Journal");
    expect(count).toBe("Hello world this is my journal.".length);
  });

  it("returns 0 for empty section", () => {
    const content = `## Journal
<!-- Free writing -->

## Tracking`;
    expect(countSectionChars(content, "## Journal")).toBe(0);
  });
});
