#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./core/config.js";
import { resolveAdapter } from "./adapters/resolve.js";
import { runInit } from "./commands/init.js";
import { runCapture } from "./commands/capture.js";
import { collectTasks, filterTasks } from "./commands/tasks.js";
import { runLog } from "./commands/log.js";
import { runJournal } from "./commands/journal.js";
import { runDone, runDoneInteractive } from "./commands/done.js";
import { runStatus } from "./commands/status.js";
import { runNewProject } from "./commands/new.js";
import { runMigrate } from "./commands/migrate.js";
import { runReview } from "./commands/review.js";
import { listProjects } from "./commands/projects.js";
import { runOpen } from "./commands/open.js";
import { runMetrics } from "./commands/metrics.js";
import { getCliVersion, collectPendingMigrations } from "./core/migrations.js";
import chalk from "chalk";
import { homedir } from "node:os";
import { join } from "node:path";

const program = new Command();

program
  .name("elmar")
  .description(
    "Personal knowledge & productivity system — Obsidian vault + CLI"
  )
  .version(getCliVersion())
  .addHelpText("after", `
Meta flags (use instead of subcommands):
  --update          Pull latest code, rebuild, and relink the CLI
  --migrate         Upgrade vault to the latest version
  --migrate-dry-run Preview migration changes without modifying
  --migrate-yes     Apply all migration fixes without prompting
  --completion      Output zsh completion script
  --backfill-nav    Add navigation bars to all existing daily notes
  --backfill-frontmatter  Migrate inline fields to YAML frontmatter`);

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
  .argument("[text]", "Task text to match (omit to pick from list)")
  .action(async (text: string | undefined) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      if (text) {
        const result = await runDone(adapter, config.vaultPath, text);
        console.log(chalk.green(`Completed: ${result.task}`));
        console.log(chalk.dim(`  in ${result.file}`));
      } else {
        await runDoneInteractive(adapter, config.vaultPath);
      }
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
  .command("projects")
  .description("List projects")
  .option("--status <status>", "Filter by status (active, someday)")
  .option("--area <area>", "Filter by area")
  .option("--all", "Show all statuses (default: active only)")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      const statusFilter = opts.all ? undefined : (opts.status ?? "active");
      const projects = await listProjects(adapter, { status: statusFilter, area: opts.area });

      if (projects.length === 0) {
        console.log(chalk.dim("No projects found."));
        return;
      }

      for (const p of projects) {
        const area = chalk.cyan(`[${p.area}]`);
        const tasks = p.openTasks > 0 ? chalk.dim(` (${p.openTasks} tasks)`) : chalk.dim(" (no tasks)");
        const status = p.status !== "active" ? chalk.yellow(` [${p.status}]`) : "";
        console.log(`${area} ${p.name}${tasks}${status}`);
      }
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("open")
  .description("Open a project in your editor or Obsidian")
  .argument("[query]", "Project name to search for")
  .option("--obsidian", "Open in Obsidian instead of editor")
  .action(async (query: string | undefined, opts) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      await runOpen(adapter, config, query, { obsidian: opts.obsidian });
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program
  .command("metrics")
  .description("Show metric trends")
  .option("--days <n>", "Number of days to show", "7")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      const adapter = resolveAdapter(config);
      await runMetrics(adapter, config.vaultPath, config.systemFolder, Number(opts.days));
    } catch (err: unknown) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

// Handle meta flags before Commander processes subcommands
const argv = process.argv.slice(2);

if (argv.includes("--completion")) {
  console.log(`#compdef elmar

_elmar() {
  local -a commands
  commands=(
    'init:Set up a new Elmar vault'
    'capture:Quick capture to inbox'
    'tasks:List tasks across all projects'
    'log:Log a metric to todays daily note'
    'journal:Append to todays journal'
    'done:Mark a task as complete'
    'new:Create a new project'
    'status:Show overview of inbox, tasks, and tracking'
    'review:Interactive review (daily/weekly/monthly)'
    'projects:List projects'
    'open:Open a project in your editor or Obsidian'
    'metrics:Show metric trends'
  )

  _arguments -C \\
    '--update[Pull latest code, rebuild, and relink]' \\
    '--migrate[Upgrade vault to the latest version]' \\
    '--completion[Output zsh completion script]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'elmar command' commands
      ;;
    args)
      case $words[1] in
        tasks)
          _arguments \\
            '--area[Filter by area]:area:' \\
            '--due[Show tasks due on or before date]:date:' \\
            '--waiting[Show only waiting-for tasks]' \\
            '--all[Include completed tasks]'
          ;;
        review)
          _arguments '--fresh[Reset daily state and start fresh]'
          ;;
        projects)
          _arguments \\
            '--status[Filter by status]:status:(active someday)' \\
            '--area[Filter by area]:area:' \\
            '--all[Show all statuses]'
          ;;
        open)
          _arguments '--obsidian[Open in Obsidian instead of editor]'
          ;;
        new)
          _arguments \\
            '1:type:(project)' \\
            '2:name:' \\
            '--area[Area]:area:(work personal family finance)'
          ;;
        metrics)
          _arguments '--days[Number of days to show]:days:'
          ;;
      esac
      ;;
  esac
}

compdef _elmar elmar`);
  process.exit(0);
} else if (argv.includes("--update")) {
  const { execSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { dirname } = await import("node:path");
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

  const run = (cmd: string) => {
    console.log(chalk.dim(`$ ${cmd}`));
    execSync(cmd, { cwd: projectRoot, stdio: "inherit" });
  };

  try {
    const headBefore = execSync("git rev-parse HEAD", { cwd: projectRoot }).toString().trim();
    run("git pull");
    const headAfter = execSync("git rev-parse HEAD", { cwd: projectRoot }).toString().trim();

    if (headBefore === headAfter) {
      console.log(chalk.green("Already up to date."));
      process.exit(0);
    }

    run("npm install");
    run("npm run build");
    run("npm link");
    console.log(chalk.green("\n✓ Elmar updated to latest version."));

    try {
      const config = loadConfig();
      const pending = collectPendingMigrations(
        config.vaultPath,
        config.systemFolder,
        getCliVersion()
      );
      if (pending.newFiles.length > 0 || pending.fixes.length > 0) {
        console.log(
          chalk.yellow(
            `\nVault migration available (${pending.fromVersion} → ${pending.toVersion}).` +
            `\nRun ${chalk.bold("elmar --migrate")} to upgrade your vault.`
          )
        );
      }
    } catch {
      // Config may not exist yet (fresh install) — skip migration check
    }
  } catch {
    console.error(chalk.red("Update failed. Check the output above."));
    process.exit(1);
  }
  process.exit(0);
} else if (argv.includes("--migrate") || argv.includes("--migrate-dry-run") || argv.includes("--migrate-yes")) {
  try {
    const config = loadConfig();
    await runMigrate(config, {
      dryRun: argv.includes("--migrate-dry-run"),
      yes: argv.includes("--migrate-yes"),
    });
  } catch (err: unknown) {
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }
  process.exit(0);
} else if (argv.includes("--backfill-nav")) {
  const { backfillDailyNav } = await import("./core/daily-note.js");
  try {
    const config = loadConfig();
    const adapter = resolveAdapter(config);
    const count = await backfillDailyNav(
      adapter,
      config.dailyNotesFolder,
      config.monthlyNotesFolder,
      (date) => console.log(chalk.dim(`  Updated ${date}`))
    );
    console.log(chalk.green(`\nNavigation added to ${count} daily notes.`));
  } catch (err: unknown) {
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }
  process.exit(0);
} else if (argv.includes("--backfill-frontmatter")) {
  const { inlineFieldsToFrontmatter } = await import("./core/markdown-utils.js");
  try {
    const config = loadConfig();
    const adapter = resolveAdapter(config);
    let count = 0;

    // Migrate daily notes
    const dailyFiles = await adapter.listFiles(config.dailyNotesFolder);
    for (const file of dailyFiles) {
      if (!file.endsWith(".md")) continue;
      const content = await adapter.readNote(file);
      const updated = inlineFieldsToFrontmatter(content);
      if (updated !== content) {
        await adapter.writeNote(file, updated);
        console.log(chalk.dim(`  ${file}`));
        count++;
      }
    }

    // Migrate project notes
    const projectFiles = await adapter.listFiles("1-Projects");
    for (const file of projectFiles) {
      if (!file.endsWith(".md")) continue;
      const content = await adapter.readNote(file);
      const updated = inlineFieldsToFrontmatter(content);
      if (updated !== content) {
        await adapter.writeNote(file, updated);
        console.log(chalk.dim(`  ${file}`));
        count++;
      }
    }

    // Migrate area notes
    const areaFiles = await adapter.listFiles("2-Areas");
    for (const file of areaFiles) {
      if (!file.endsWith(".md")) continue;
      const content = await adapter.readNote(file);
      const updated = inlineFieldsToFrontmatter(content);
      if (updated !== content) {
        await adapter.writeNote(file, updated);
        console.log(chalk.dim(`  ${file}`));
        count++;
      }
    }

    console.log(chalk.green(`\nMigrated ${count} files to frontmatter.`));
  } catch (err: unknown) {
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }
  process.exit(0);
} else {
  program.parse();
}
