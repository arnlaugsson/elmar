import type { VaultAdapter } from "../adapters/adapter.js";
import { findSectionRange } from "./markdown-utils.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NAV_PATTERN = /^\[\[.*?←.*?\]\] \| \[\[.*?\]\] \| .*$/m;

function monthName(date: string): string {
  const month = parseInt(date.slice(5, 7), 10) - 1;
  return MONTH_NAMES[month];
}

function monthSlug(date: string): string {
  return date.slice(0, 7);
}

function buildNavBar(
  date: string,
  monthlyNotesFolder: string,
  dailyNotesFolder: string,
  prev: string | null,
  next: string | null
): string {
  const prevLink = prev
    ? `[[${dailyNotesFolder}/${prev}|← Previous]]`
    : "← Previous";
  const month = monthName(date);
  const monthLink = `[[${monthlyNotesFolder}/${monthSlug(date)}|${month}]]`;
  const nextLink = next
    ? `[[${dailyNotesFolder}/${next}|Next →]]`
    : "Next →";
  return `${prevLink} | ${monthLink} | ${nextLink}`;
}

function replaceOrInsertNav(content: string, navBar: string): string {
  if (NAV_PATTERN.test(content)) {
    return content.replace(NAV_PATTERN, navBar);
  }
  // Insert after the first heading line
  const lines = content.split("\n");
  const headingIdx = lines.findIndex((l) => l.startsWith("# "));
  if (headingIdx === -1) return `${navBar}\n\n${content}`;
  const result = [...lines];
  result.splice(headingIdx + 1, 0, "", navBar);
  return result.join("\n");
}

export async function findPreviousDailyNote(
  adapter: VaultAdapter,
  dailyNotesFolder: string,
  date: string
): Promise<string | null> {
  const files = await adapter.listFiles(dailyNotesFolder);
  const dateFiles = files
    .map((f) => f.replace(`${dailyNotesFolder}/`, "").replace(".md", ""))
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
    .filter((f) => f < date)
    .sort();
  return dateFiles.length > 0 ? dateFiles[dateFiles.length - 1] : null;
}

export async function linkDailyNote(
  adapter: VaultAdapter,
  dailyNotesFolder: string,
  monthlyNotesFolder: string,
  date: string
): Promise<void> {
  const prev = await findPreviousDailyNote(adapter, dailyNotesFolder, date);

  // Update the new note with nav bar
  const notePath = `${dailyNotesFolder}/${date}.md`;
  const content = await adapter.readNote(notePath);
  const navBar = buildNavBar(date, monthlyNotesFolder, dailyNotesFolder, prev, null);
  const updated = replaceOrInsertNav(content, navBar);
  await adapter.writeNote(notePath, updated);

  // Update the previous note to link forward
  if (prev) {
    const prevPath = `${dailyNotesFolder}/${prev}.md`;
    const prevContent = await adapter.readNote(prevPath);
    const prevPrev = await findPreviousDailyNote(adapter, dailyNotesFolder, prev);
    const prevNavBar = buildNavBar(prev, monthlyNotesFolder, dailyNotesFolder, prevPrev, date);
    const prevUpdated = replaceOrInsertNav(prevContent, prevNavBar);
    await adapter.writeNote(prevPath, prevUpdated);
  }
}

export async function backfillDailyNav(
  adapter: VaultAdapter,
  dailyNotesFolder: string,
  monthlyNotesFolder: string,
  onUpdate?: (date: string) => void
): Promise<number> {
  const files = await adapter.listFiles(dailyNotesFolder);
  const dates = files
    .map((f) => f.replace(`${dailyNotesFolder}/`, "").replace(".md", ""))
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
    .sort();

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const prev = i > 0 ? dates[i - 1] : null;
    const next = i < dates.length - 1 ? dates[i + 1] : null;

    const notePath = `${dailyNotesFolder}/${date}.md`;
    const content = await adapter.readNote(notePath);
    const navBar = buildNavBar(date, monthlyNotesFolder, dailyNotesFolder, prev, next);
    const updated = replaceOrInsertNav(content, navBar);
    await adapter.writeNote(notePath, updated);
    onUpdate?.(date);
  }

  return dates.length;
}

export { buildNavBar, replaceOrInsertNav };

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
