#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./core/config.js";
import { resolveAdapter } from "./adapters/resolve.js";
import { runInit } from "./commands/init.js";
import { runCapture } from "./commands/capture.js";
import { collectTasks, filterTasks } from "./commands/tasks.js";
import { runLog } from "./commands/log.js";
import { runJournal } from "./commands/journal.js";
import { runDone } from "./commands/done.js";
import { runStatus } from "./commands/status.js";
import { runNewProject } from "./commands/new.js";
import { runMigrate } from "./commands/migrate.js";
import { runReview } from "./commands/review.js";
import { getCliVersion } from "./core/migrations.js";
import chalk from "chalk";
import { homedir } from "node:os";
import { join } from "node:path";

const program = new Command();

program
  .name("elmar")
  .description(
    "Personal knowledge & productivity system — Obsidian vault + CLI"
  )
  .version(getCliVersion());

program
  .command("init")
  .description("Set up a new Elmar vault")
  .argument("<path>", "Path for the new vault")
  .action(async (path: string) => {
    const configPath = join(homedir(), ".elmar.config.json");
    try {
      await runInit(path, configPath);
      console.log(chalk.green(`Vault created at ${path}`));
      console.log(chalk.green(`Config saved to ${configPath}`));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("capture")
  .description("Quick capture to inbox")
  .argument("<text>", "Text to capture")
  .action(async (text: string) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      await runCapture(adapter, config.inboxFile, text);
      console.log(chalk.green("Captured to inbox."));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("tasks")
  .description("List tasks across all projects")
  .option("--area <area>", "Filter by area")
  .option("--due <date>", "Show tasks due on or before date (or 'today')")
  .option("--waiting", "Show only waiting-for tasks")
  .option("--all", "Include completed tasks")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const tasks = await collectTasks(adapter, config.vaultPath);

      const dueDate =
        opts.due === "today"
          ? new Date().toISOString().slice(0, 10)
          : opts.due;

      const filtered = filterTasks(tasks, {
        area: opts.area,
        due: dueDate,
        waiting: opts.waiting ? true : undefined,
        all: opts.all,
      });

      if (filtered.length === 0) {
        console.log(chalk.dim("No tasks found."));
        return;
      }

      for (const task of filtered) {
        const area = chalk.cyan(`[${task.sourceArea}]`);
        const due = task.dueDate
          ? chalk.yellow(` 📅 ${task.dueDate}`)
          : "";
        const waiting = task.waiting ? chalk.magenta(" [waiting]") : "";
        const check = task.completed ? chalk.green("[x]") : "[ ]";
        console.log(`${check} ${area} ${task.text}${due}${waiting}`);
      }
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("log")
  .description("Log a metric to today's daily note")
  .argument("<key>", "Metric key (e.g., sleep, reading, grateful)")
  .argument("<value>", "Metric value")
  .action(async (key: string, value: string) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const today = new Date().toISOString().slice(0, 10);
      await runLog(adapter, config.vaultPath, config.systemFolder, key, value, today);
      console.log(chalk.green(`Logged ${key}: ${value}`));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("journal")
  .description("Append to today's journal")
  .argument("<text>", "Journal text")
  .action(async (text: string) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const today = new Date().toISOString().slice(0, 10);
      await runJournal(adapter, text, today);
      console.log(chalk.green("Added to journal."));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("done")
  .description("Mark a task as complete")
  .argument("<text>", "Task text to match")
  .action(async (text: string) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const result = await runDone(adapter, config.vaultPath, text);
      console.log(chalk.green(`Completed: ${result.task}`));
      console.log(chalk.dim(`  in ${result.file}`));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("new")
  .description("Create a new project")
  .argument("<type>", "What to create (project)")
  .argument("<name>", "Name of the project")
  .option("--area <area>", "Area (work, personal, family, finance)")
  .action(async (type: string, name: string, opts) => {
    if (type !== "project") {
      console.error(chalk.red(`Unknown type: ${type}. Only 'project' is supported.`));
      process.exit(1);
    }
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const filepath = await runNewProject(adapter, config, name, opts);
      console.log(chalk.green(`Project created: ${filepath}`));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show overview of inbox, tasks, and tracking")
  .action(async () => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const today = new Date().toISOString().slice(0, 10);
      const summary = await runStatus(
        adapter,
        config.vaultPath,
        config.inboxFile,
        config.systemFolder,
        today
      );

      console.log(chalk.bold("Elmar Status\n"));
      console.log(`Inbox items:    ${summary.inboxCount}`);
      console.log(`Open tasks:     ${summary.openTaskCount}`);
      console.log(
        `Overdue tasks:  ${summary.overdueCount > 0 ? chalk.red(String(summary.overdueCount)) : "0"}`
      );

      if (summary.todayTrackingGaps.length > 0) {
        console.log(
          `\nTracking gaps:  ${chalk.yellow(summary.todayTrackingGaps.join(", "))}`
        );
      } else {
        console.log(`\nTracking:       ${chalk.green("All logged for today")}`);
      }
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("migrate")
  .description("Upgrade vault to the latest version")
  .option("--dry-run", "Preview changes without modifying the vault")
  .option("--yes", "Apply all fixes without prompting")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      await runMigrate(config, { dryRun: opts.dryRun, yes: opts.yes });
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("review")
  .description("Interactive review (daily/weekly/monthly)")
  .option("--fresh", "Reset daily state and start fresh")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      await runReview(adapter, config, { fresh: opts.fresh });
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("metrics")
  .description("Show metric trends")
  .option("--days <n>", "Number of days to show", "7")
  .action(async () => {
    console.log(
      chalk.yellow(
        "Metric trend display is not yet implemented.\n" +
        "View trends in Obsidian using the _System/dashboard.md note."
      )
    );
  });

program
  .command("update")
  .description("Pull latest code, rebuild, and relink the CLI")
  .action(async () => {
    const { execSync } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const { dirname } = await import("node:path");
    const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

    const run = (cmd: string) => {
      console.log(chalk.dim(`$ ${cmd}`));
      execSync(cmd, { cwd: projectRoot, stdio: "inherit" });
    };

    try {
      run("git pull");
      run("npm install");
      run("npm run build");
      run("npm link");
      console.log(chalk.green("\n✓ Elmar updated to latest version."));
    } catch {
      console.error(chalk.red("Update failed. Check the output above."));
      process.exit(1);
    }
  });

program.parse();
