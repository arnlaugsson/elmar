import type { VaultAdapter } from "../adapters/adapter.js";
import { getInlineField } from "../core/markdown-utils.js";

export interface ProjectInfo {
  readonly name: string;
  readonly area: string;
  readonly status: string;
  readonly openTasks: number;
  readonly path: string;
}

export async function listProjects(
  adapter: VaultAdapter,
  opts: { status?: string; area?: string }
): Promise<readonly ProjectInfo[]> {
  const files = await adapter.listFiles("1-Projects");
  const projects: ProjectInfo[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const content = await adapter.readNote(file);
    const status = getInlineField(content, "Status") ?? "unknown";
    const area = getInlineField(content, "Area") ?? "unknown";
    const name = file.replace("1-Projects/", "").replace(".md", "");
    const openTasks = content.split("\n").filter((l) => l.trimStart().startsWith("- [ ]")).length;

    if (opts.status && status !== opts.status) continue;
    if (opts.area && area !== opts.area) continue;

    projects.push({ name, area, status, openTasks, path: file });
  }

  return projects;
}
