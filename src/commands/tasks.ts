import type { VaultAdapter } from "../adapters/adapter.js";
import type { TaskItem } from "../core/types.js";
import { parseTasks } from "../core/task-parser.js";
import { getFrontmatterField } from "../core/markdown-utils.js";

interface TaskFilter {
  readonly area?: string;
  readonly due?: string;
  readonly waiting?: boolean;
  readonly all?: boolean;
}

export async function collectTasks(
  adapter: VaultAdapter,
  vaultPath: string
): Promise<readonly TaskItem[]> {
  const scanFolders = ["1-Projects", "2-Areas"];
  const allTasks: TaskItem[] = [];

  for (const folder of scanFolders) {
    const files = await adapter.listFiles(folder);
    for (const file of files) {
      const content = await adapter.readNote(file);

      if (folder === "1-Projects" && getFrontmatterField(content, "status") === "someday") {
        continue;
      }

      const tasks = parseTasks(content, file);
      allTasks.push(...tasks);
    }
  }

  return allTasks;
}

export function filterTasks(
  tasks: readonly TaskItem[],
  filter: TaskFilter
): readonly TaskItem[] {
  let result = [...tasks];

  if (!filter.all) {
    result = result.filter((t) => !t.completed);
  }

  if (filter.area) {
    result = result.filter((t) => t.sourceArea === filter.area);
  }

  if (filter.due) {
    result = result.filter(
      (t) => t.dueDate !== null && t.dueDate <= filter.due!
    );
  }

  if (filter.waiting !== undefined) {
    result = result.filter((t) => t.waiting === filter.waiting);
  }

  return result;
}
