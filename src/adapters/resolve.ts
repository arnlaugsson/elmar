import { MarkdownAdapter } from "./markdown.js";
import type { VaultAdapter } from "./adapter.js";
import type { ElmarConfig } from "../core/types.js";

export function resolveAdapter(config: ElmarConfig): VaultAdapter {
  return new MarkdownAdapter(config.vaultPath, {
    dailyNotesFolder: config.dailyNotesFolder,
    templatesFolder: config.templatesFolder,
    systemFolder: config.systemFolder,
    monthlyNotesFolder: config.monthlyNotesFolder,
  });
}
