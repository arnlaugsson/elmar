import type { VaultAdapter } from "../adapters/adapter.js";
import { collectTasks, filterTasks } from "./tasks.js";
import { select, input, CancelPromptError } from "../core/prompt.js";
import chalk from "chalk";

export async function runDone(
  adapter: VaultAdapter,
  vaultPath: string,
  searchText: string
): Promise<{ file: string; task: string }> {
  const scanFolders = ["1-Projects", "2-Areas"];
  const normalizedSearch = searchText.toLowerCase();

  for (const folder of scanFolders) {
    const files = await adapter.listFiles(folder);
    for (const file of files) {
      const content = await adapter.readNote(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.match(/^- \[ \]/) &&
          line.toLowerCase().includes(normalizedSearch)
        ) {
          const updated = [...lines];
          updated[i] = line.replace("- [ ]", "- [x]");
          await adapter.writeNote(file, updated.join("\n"));
          return { file, task: line.trim() };
        }
      }
    }
  }

  throw new Error(
    `No matching task found for "${searchText}"`
  );
}

export async function runDoneInteractive(
  adapter: VaultAdapter,
  vaultPath: string
): Promise<void> {
  const allTasks = await collectTasks(adapter, vaultPath);
  const openTasks = filterTasks(allTasks, {});

  if (openTasks.length === 0) {
    console.log(chalk.dim("No open tasks."));
    return;
  }

  // Sort by due date (due first, then no-date at end)
  const sorted = [...openTasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return 0;
  });

  try {
    const chosen = await select({
      message: "Complete which task?",
      choices: sorted.map((t, i) => {
        const due = t.dueDate ? chalk.yellow(` 📅 ${t.dueDate}`) : "";
        const area = chalk.cyan(`[${t.sourceArea}]`);
        return { value: i, name: `${area} ${t.text}${due}` };
      }),
    });

    const task = sorted[chosen];
    const content = await adapter.readNote(task.sourcePath);
    const lines = content.split("\n");
    lines[task.line] = lines[task.line].replace("- [ ]", "- [x]");

    const note = await input({ message: "Note (blank to skip):" });

    if (note.trim()) {
      lines.splice(task.line + 1, 0, `  ${note.trim()}`);
    }

    await adapter.writeNote(task.sourcePath, lines.join("\n"));
    console.log(chalk.green(`✓ Completed: ${task.text}`));
    console.log(chalk.dim(`  in ${task.sourcePath}`));
  } catch (err) {
    if (err instanceof CancelPromptError) {
      console.log(chalk.dim("Cancelled."));
      return;
    }
    throw err;
  }
}
