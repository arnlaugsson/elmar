import type { VaultAdapter } from "../adapters/adapter.js";
import { setFrontmatterField } from "../core/markdown-utils.js";
import { countSectionChars } from "../core/daily-note.js";

export async function runJournal(
  adapter: VaultAdapter,
  text: string,
  date: string
): Promise<void> {
  const notePath = await adapter.ensureDailyNote(date);

  await adapter.appendToSection(notePath, "## Journal", text);

  const content = await adapter.readNote(notePath);
  const charCount = countSectionChars(content, "## Journal");
  const updated = setFrontmatterField(content, "journal", String(charCount));
  await adapter.writeNote(notePath, updated);
}
