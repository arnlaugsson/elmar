import type { VaultAdapter } from "../adapters/adapter.js";
import { collectTasks } from "./tasks.js";
import { loadRegistry } from "../core/metric-registry.js";
import { parseFrontmatter } from "../core/markdown-utils.js";
import { join } from "node:path";

export interface StatusSummary {
  readonly inboxCount: number;
  readonly openTaskCount: number;
  readonly overdueCount: number;
  readonly todayTrackingGaps: readonly string[];
}

export async function runStatus(
  adapter: VaultAdapter,
  vaultPath: string,
  inboxPath: string,
  systemFolder: string,
  date: string
): Promise<StatusSummary> {
  let inboxCount = 0;
  if (await adapter.noteExists(inboxPath)) {
    const inboxContent = await adapter.readNote(inboxPath);
    const lines = inboxContent.split("\n");
    inboxCount = lines.filter(
      (l) => l.trim().startsWith("- ") && l.trim().length > 2
    ).length;
  }

  // Count inbox files (excluding inbox.md itself)
  const inboxFolder = inboxPath.replace(/\/[^/]+$/, "");
  const inboxFiles = await adapter.listFiles(inboxFolder);
  inboxCount += inboxFiles.filter(
    (f) => f.endsWith(".md") && f !== inboxPath
  ).length;

  const allTasks = await collectTasks(adapter, vaultPath);
  const tasks = allTasks.filter((t) => !t.completed);
  const openTaskCount = tasks.length;
  const overdueCount = tasks.filter(
    (t) => t.dueDate !== null && t.dueDate < date
  ).length;

  const registry = loadRegistry(join(vaultPath, systemFolder, "metrics.json"));
  let trackingGaps: string[];

  const dailyNotePath = `Journal/${date}.md`;
  if (await adapter.noteExists(dailyNotePath)) {
    const content = await adapter.readNote(dailyNotePath);
    const { fields } = parseFrontmatter(content);
    trackingGaps = registry.metrics
      .filter((m) => {
        const val = fields[m.key];
        return val === undefined || val === "" || val === '""';
      })
      .map((m) => m.key);
  } else {
    trackingGaps = registry.metrics.map((m) => m.key);
  }

  return { inboxCount, openTaskCount, overdueCount, todayTrackingGaps: trackingGaps };
}
