import { findSectionRange } from "./markdown-utils.js";

export function countBullets(content: string, heading: string): number {
  const range = findSectionRange(content, heading);
  if (!range) return 0;

  const lines = content.split("\n");
  let count = 0;
  for (let i = range.start + 1; i < range.end; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("- ") && trimmed.length > 2) {
      count++;
    }
  }
  return count;
}

export function countSectionChars(
  content: string,
  heading: string
): number {
  const range = findSectionRange(content, heading);
  if (!range) return 0;

  const lines = content.split("\n");
  let chars = 0;
  for (let i = range.start + 1; i < range.end; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || trimmed.startsWith("<!--")) continue;
    chars += trimmed.length;
  }
  return chars;
}
