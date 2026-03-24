import type { VaultAdapter } from "../adapters/adapter.js";
import type { ElmarConfig } from "../core/types.js";
import {
  readReviewState,
  writeReviewState,
  detectDueTiers,
  type ReviewState,
  type ReviewTier,
} from "../core/review-state.js";
import {
  parseInboxItems,
  aggregateMetrics,
  formatMetricsSummary,
  generateWeeklyNote,
  generateMonthlyNote,
  getDatesInRange,
  getWeekLabel,
  parseSectionItems,
  type WeeklyNoteData,
  type ProjectDecision,
  type GoalStatus,
  type RoleScore,
  type AreaHealthScore,
} from "../core/review-steps.js";
import { collectTasks, filterTasks } from "./tasks.js";
import { runLog } from "./log.js";
import { snoozeDueDate } from "../core/task-date-utils.js";
import { loadRegistry } from "../core/metric-registry.js";
import { getInlineField } from "../core/markdown-utils.js";
import { runNewProject } from "./new.js";
import { join } from "node:path";
import chalk from "chalk";
import { select, confirm, input, number as numberPrompt, editor } from "@inquirer/prompts";

function getStatePath(vaultPath: string, systemFolder: string): string {
  return join(vaultPath, systemFolder, ".elmar-review-state.json");
}

export async function runReview(
  adapter: VaultAdapter,
  config: ElmarConfig,
  opts: { fresh?: boolean }
): Promise<void> {
  const statePath = getStatePath(config.vaultPath, config.systemFolder);
  let state = readReviewState(statePath);
  const today = new Date().toISOString().slice(0, 10);

  if (opts.fresh) {
    state = { lastDaily: "", lastWeekly: state.lastWeekly, lastMonthly: state.lastMonthly, interrupted: null };
  }

  if (state.interrupted) {
    console.log(chalk.yellow(`Resuming ${state.interrupted.tier} review from step ${state.interrupted.step + 1}...\n`));
  }

  const tiers = detectDueTiers(state, today);

  if (tiers.length === 0) {
    console.log(chalk.green("All reviews up to date. Nothing to do."));
    return;
  }

  const tierLabels = tiers.map((t) => t === "daily" ? "Daily check-in" : t === "weekly" ? "Weekly review" : "Monthly review");
  console.log(chalk.bold(`${tierLabels.join(" + ")} due\n`));

  let weeklyData: WeeklyNoteData | null = null;

  // Set up SIGINT handler for interrupt/resume
  let currentTier: ReviewTier = tiers[0];
  let currentStep = 0;

  const saveInterrupted = () => {
    writeReviewState(statePath, {
      ...state,
      interrupted: { tier: currentTier, step: currentStep, data: {} },
    });
    console.log(chalk.yellow("\nReview paused. Run `elmar review` to resume."));
    process.exit(0);
  };

  process.on("SIGINT", saveInterrupted);

  try {
    for (const tier of tiers) {
      currentTier = tier;

      if (tier === "daily") {
        console.log(chalk.bold.cyan("── Daily Check-in ──\n"));
        await runDailySteps(adapter, config, today, (step) => { currentStep = step; });
        state = { ...state, lastDaily: today, interrupted: null };
        writeReviewState(statePath, state);
      }

      if (tier === "weekly") {
        console.log(chalk.bold.cyan("── Weekly Review ──\n"));
        weeklyData = await runWeeklySteps(adapter, config, today, (step) => { currentStep = step; });
        state = { ...state, lastDaily: today, lastWeekly: today, interrupted: null };
        writeReviewState(statePath, state);
      }

      if (tier === "monthly") {
        console.log(chalk.bold.cyan("── Monthly Review ──\n"));
        await runMonthlySteps(adapter, config, today, weeklyData, (step) => { currentStep = step; });
        state = { ...state, lastDaily: today, lastWeekly: today, lastMonthly: today, interrupted: null };
        writeReviewState(statePath, state);
      }
    }
  } finally {
    process.removeListener("SIGINT", saveInterrupted);
  }

  console.log(chalk.green("\n✓ Review complete"));
}

async function runDailySteps(
  adapter: VaultAdapter,
  config: ElmarConfig,
  today: string,
  onStep: (step: number) => void
): Promise<void> {
  // Step 1: Inbox scan
  onStep(0);
  if (await adapter.noteExists(config.inboxFile)) {
    const inboxContent = await adapter.readNote(config.inboxFile);
    const items = parseInboxItems(inboxContent);
    if (items.length > 0) {
      console.log(`Inbox: ${items.length} items`);
      const shouldProcess = await confirm({ message: "Process inbox now?", default: true });
      if (shouldProcess) {
        await processInboxItems(adapter, config, items, false);
      }
    } else {
      console.log(chalk.green("Inbox is clear!"));
    }
  }

  // Step 2: Today's tasks
  onStep(1);
  const allTasks = await collectTasks(adapter, config.vaultPath);
  const dueTasks = filterTasks(allTasks, { due: today });
  if (dueTasks.length > 0) {
    console.log(`\nToday's tasks: ${dueTasks.length} due/overdue`);
    for (const task of dueTasks) {
      const action = await select({
        message: `${task.text} (${task.sourceArea})`,
        choices: [
          { value: "done", name: "Done" },
          { value: "snooze", name: "Snooze" },
          { value: "skip", name: "Skip" },
        ],
      });
      if (action === "done") {
        const content = await adapter.readNote(task.sourcePath);
        const lines = content.split("\n");
        lines[task.line] = lines[task.line].replace("- [ ]", "- [x]");
        await adapter.writeNote(task.sourcePath, lines.join("\n"));
        console.log(chalk.green(`  ✓ Completed`));
      } else if (action === "snooze") {
        const newDate = await input({ message: "New due date (YYYY-MM-DD):" });
        const content = await adapter.readNote(task.sourcePath);
        const lines = content.split("\n");
        lines[task.line] = snoozeDueDate(lines[task.line], newDate);
        await adapter.writeNote(task.sourcePath, lines.join("\n"));
        console.log(chalk.yellow(`  → Snoozed to ${newDate}`));
      }
    }
  } else {
    console.log(chalk.green("\nNo tasks due today."));
  }

  // Step 3: Tracking
  onStep(2);
  const registry = loadRegistry(join(config.vaultPath, config.systemFolder, "metrics.json"));
  const notePath = await adapter.ensureDailyNote(today);
  const noteContent = await adapter.readNote(notePath);

  const gaps: string[] = [];
  const filled: { key: string; value: string }[] = [];
  for (const metric of registry.metrics) {
    const val = getInlineField(noteContent, metric.key);
    if (val === null) {
      gaps.push(metric.key);
    } else {
      filled.push({ key: metric.key, value: val });
    }
  }

  if (gaps.length > 0) {
    console.log(`\nTracking gaps: ${gaps.join(", ")}`);
    const fillGaps = await confirm({ message: "Log missing metrics now?", default: true });
    if (fillGaps) {
      for (const key of gaps) {
        const metric = registry.metrics.find((m) => m.key === key);
        if (!metric) continue;
        const label = metric.range ? `${metric.label} (${metric.range[0]}-${metric.range[1]})` : metric.label;
        const useEditor = metric.type === "text";
        const value = useEditor
          ? await editor({ message: `${label}:` })
          : await input({ message: `${label}:` });
        if (value.trim()) {
          await runLog(adapter, config.vaultPath, config.systemFolder, key, value.trim(), today);
          console.log(chalk.green(`  ✓ Logged ${key}: ${value.trim()}`));
        }
      }
    }
  } else {
    console.log(chalk.green("\nAll metrics logged for today."));
  }

  if (filled.length > 0) {
    console.log(chalk.dim(`\nAlready logged: ${filled.map((f) => `${f.key}=${f.value}`).join(", ")}`));
    const updateExisting = await confirm({ message: "Update any logged metrics?", default: false });
    if (updateExisting) {
      const keyToUpdate = await select({
        message: "Which metric?",
        choices: filled.map((f) => ({ value: f.key, name: `${f.key} (current: ${f.value})` })),
      });
      const metric = registry.metrics.find((m) => m.key === keyToUpdate);
      if (metric) {
        const label = metric.range ? `${metric.label} (${metric.range[0]}-${metric.range[1]})` : metric.label;
        const useEditor = metric.type === "text";
        const value = useEditor
          ? await editor({ message: `${label}:` })
          : await input({ message: `${label}:` });
        if (value.trim()) {
          await runLog(adapter, config.vaultPath, config.systemFolder, keyToUpdate, value.trim(), today);
          console.log(chalk.green(`  ✓ Updated ${keyToUpdate}: ${value.trim()}`));
        }
      }
    }
  }
}

async function processInboxItems(
  adapter: VaultAdapter,
  config: ElmarConfig,
  items: readonly { text: string; line: number }[],
  mandatory: boolean
): Promise<void> {
  const choices = mandatory
    ? [
        { value: "move", name: "Move" },
        { value: "task", name: "Task" },
        { value: "project", name: "New project" },
        { value: "archive", name: "Archive" },
        { value: "delete", name: "Delete" },
      ]
    : [
        { value: "skip", name: "Skip" },
        { value: "move", name: "Move" },
        { value: "task", name: "Task" },
        { value: "project", name: "New project" },
      ];

  const inboxContent = await adapter.readNote(config.inboxFile);
  const linesToRemove: number[] = [];

  for (const item of items) {
    const action = await select({ message: item.text, choices });

    if (action === "move" || action === "task") {
      const projects = await adapter.listFiles("1-Projects");
      const project = await select({
        message: "Which project?",
        choices: projects.map((p) => {
          const name = p.replace("1-Projects/", "");
          return { value: name, name };
        }),
      });
      const projectPath = `1-Projects/${project}`;

      if (action === "move") {
        await adapter.appendToSection(projectPath, "## Notes", `- ${item.text}`);
        console.log(chalk.green(`  → Moved to ${project}`));
      } else {
        await adapter.appendToSection(projectPath, "## Next Actions", `- [ ] ${item.text}`);
        console.log(chalk.green(`  → Task added to ${project}`));
      }
      linesToRemove.push(item.line);
    } else if (action === "project") {
      const name = await input({ message: "Project name:" });
      if (name.trim()) {
        const filepath = await runNewProject(adapter, config, name.trim(), {});
        console.log(chalk.green(`  → Project created: ${filepath}`));
      }
      linesToRemove.push(item.line);
    } else if (action === "archive" || action === "delete") {
      linesToRemove.push(item.line);
      console.log(chalk.dim(`  → Removed`));
    }
    // "skip" does nothing
  }

  // Remove processed lines (reverse order to keep indices valid)
  if (linesToRemove.length > 0) {
    const lines = inboxContent.split("\n");
    for (const lineNum of linesToRemove.sort((a, b) => b - a)) {
      lines.splice(lineNum, 1);
    }
    await adapter.writeNote(config.inboxFile, lines.join("\n"));
  }
}

async function runWeeklySteps(
  adapter: VaultAdapter,
  config: ElmarConfig,
  today: string,
  onStep: (step: number) => void
): Promise<WeeklyNoteData> {
  const projectDecisions: ProjectDecision[] = [];

  // Step 1: Inbox (mandatory)
  onStep(0);
  if (await adapter.noteExists(config.inboxFile)) {
    const inboxContent = await adapter.readNote(config.inboxFile);
    const items = parseInboxItems(inboxContent);
    if (items.length > 0) {
      console.log(`Inbox: ${items.length} items to process`);
      await processInboxItems(adapter, config, items, true);
    } else {
      console.log(chalk.green("Inbox is clear!"));
    }
  }

  // Step 2: Project scan
  onStep(1);
  const projectFiles = await adapter.listFiles("1-Projects");
  console.log(`\nReviewing ${projectFiles.length} projects...`);
  for (const file of projectFiles) {
    const content = await adapter.readNote(file);
    if (!content.includes("Status:: active")) continue;

    const name = file.replace("1-Projects/", "").replace(".md", "");
    const openTasks = content.split("\n").filter((l) => l.match(/^- \[ \]/)).length;

    const action = await select({
      message: `${name} (${openTasks} open tasks)`,
      choices: [
        { value: "active", name: "Still active" },
        { value: "someday", name: "Move to someday" },
        { value: "archive", name: "Archive" },
      ],
    });

    if (action === "someday") {
      const updated = content.replace(/^Status:: active$/m, "Status:: someday");
      await adapter.writeNote(file, updated);
      projectDecisions.push({ name, decision: "→ Someday" });
    } else if (action === "archive") {
      await adapter.moveNote(file, file.replace("1-Projects/", "4-Archive/"));
      projectDecisions.push({ name, decision: "→ Archived" });
    } else {
      projectDecisions.push({ name, decision: "Active" });

      const newTask = await input({ message: "New task? (blank to skip):" });
      if (newTask.trim()) {
        const area = name.split("--")[0] || "personal";
        await adapter.appendToSection(file, "## Next Actions", `- [ ] ${newTask.trim()} #${area}`);
        console.log(chalk.green(`  ✓ Task added`));
      }
    }
  }

  // Step 3: Someday/Maybe
  onStep(2);
  const somedayFiles = [];
  for (const file of projectFiles) {
    if (!(await adapter.noteExists(file))) continue;
    const content = await adapter.readNote(file);
    if (content.includes("Status:: someday")) somedayFiles.push(file);
  }
  if (somedayFiles.length > 0) {
    console.log(`\nSomeday/Maybe: ${somedayFiles.length} projects`);
    for (const file of somedayFiles) {
      const name = file.replace("1-Projects/", "").replace(".md", "");
      const action = await select({
        message: name,
        choices: [
          { value: "activate", name: "Activate" },
          { value: "keep", name: "Keep as someday" },
          { value: "drop", name: "Drop" },
        ],
      });
      if (action === "activate") {
        const content = await adapter.readNote(file);
        await adapter.writeNote(file, content.replace(/^Status:: someday$/m, "Status:: active"));
      } else if (action === "drop") {
        await adapter.moveNote(file, file.replace("1-Projects/", "4-Archive/"));
      }
    }
  }

  // Step 4: Area check
  onStep(3);
  console.log("\nArea check:");
  const allTasks = await collectTasks(adapter, config.vaultPath);
  const areaNotes: string[] = [];
  for (const area of config.areas) {
    const areaTasks = filterTasks(allTasks, { area });
    console.log(`  ${area}: ${areaTasks.length} open tasks`);
    const needsAttention = await confirm({ message: `${area} needs attention?`, default: false });
    if (needsAttention) {
      const note = await input({ message: "Note:" });
      if (note.trim()) areaNotes.push(`${area}: ${note.trim()}`);
    }
  }

  // Step 5: Metrics summary
  onStep(4);
  const dates = getDatesInRange(today, 7);
  const metrics = await aggregateMetrics(adapter, config.vaultPath, config.systemFolder, dates);
  const metricsSummary = formatMetricsSummary(metrics);
  console.log("\nMetrics this week:");
  console.log(metricsSummary);

  // Step 6: Reflections
  onStep(5);
  const wentWell = await editor({ message: "\nWhat went well this week?" });
  const needsAttention = await editor({ message: "What needs attention?" });
  const nextFocus = await input({ message: "Next week's top focus?" });

  // Step 7: Generate weekly note
  onStep(6);
  const weekLabel = getWeekLabel(today);
  const weeklyData: WeeklyNoteData = {
    weekLabel,
    projectDecisions,
    metricsSummary,
    reflections: { wentWell, needsAttention, nextFocus },
  };

  const weeklyNote = generateWeeklyNote(weeklyData);
  const weeklyPath = `${config.weeklyNotesFolder}/${weekLabel}.md`;
  await adapter.createNote(weeklyPath, weeklyNote);
  console.log(chalk.green(`\n✓ Weekly note saved to ${weeklyPath}`));

  return weeklyData;
}

async function runMonthlySteps(
  adapter: VaultAdapter,
  config: ElmarConfig,
  today: string,
  weeklyData: WeeklyNoteData | null,
  onStep: (step: number) => void
): Promise<void> {
  // If weekly wasn't run in this session, run it now
  if (!weeklyData) {
    weeklyData = await runWeeklySteps(adapter, config, today, onStep);
  }

  const monthLabel = today.slice(0, 7);

  // Step 8: Goals review
  onStep(7);
  const goals: GoalStatus[] = [];
  if (await adapter.noteExists("Home.md")) {
    const homeContent = await adapter.readNote("Home.md");
    const goalItems = parseSectionItems(homeContent, "## Goals");
    if (goalItems.length > 0) {
      console.log("\nGoals review:");
      for (const goal of goalItems) {
        if (goal.startsWith("*")) continue; // skip placeholder hints
        const status = await select({
          message: goal,
          choices: [
            { value: "On track", name: "On track" },
            { value: "Needs attention", name: "Needs attention" },
            { value: "Achieved", name: "Achieved" },
            { value: "Drop", name: "Drop" },
          ],
        });
        const note = await input({ message: "Note (blank to skip):" });
        goals.push({ text: goal, status, note: note.trim() });
      }
    }
  } else {
    console.log(chalk.dim("\nNo Home.md found — skipping goals review. Set up Home.md to track goals."));
  }

  // Step 9: Roles check
  onStep(8);
  const roles: RoleScore[] = [];
  if (await adapter.noteExists("Home.md")) {
    const homeContent = await adapter.readNote("Home.md");
    const roleItems = parseSectionItems(homeContent, "## Roles");
    if (roleItems.length > 0) {
      console.log("\nRoles check:");
      for (const role of roleItems) {
        if (role.startsWith("*")) continue;
        const score = await numberPrompt({ message: `${role} presence (1-10):`, default: 5 });
        const note = await input({ message: "Note (blank to skip):" });
        roles.push({ text: role, score: score ?? 5, note: note.trim() });
      }
    }
  }

  // Step 10: Area health
  onStep(9);
  const areaHealth: AreaHealthScore[] = [];
  console.log("\nArea health:");
  for (const area of config.areas) {
    const score = await numberPrompt({ message: `${area} health (1-10):`, default: 5 });
    areaHealth.push({ area, score: score ?? 5 });
  }

  // Step 11: Archive sweep
  onStep(10);
  const archived: string[] = [];
  const projectFiles = await adapter.listFiles("1-Projects");
  const completeCandidates: string[] = [];
  for (const file of projectFiles) {
    const content = await adapter.readNote(file);
    if (!content.includes("Status:: active")) continue;
    const hasOpenTasks = content.split("\n").some((l) => l.match(/^- \[ \]/));
    if (!hasOpenTasks) completeCandidates.push(file);
  }

  if (completeCandidates.length > 0) {
    console.log(`\nArchive sweep: ${completeCandidates.length} projects with no open tasks`);
    for (const file of completeCandidates) {
      const name = file.replace("1-Projects/", "").replace(".md", "");
      const action = await select({
        message: name,
        choices: [
          { value: "archive", name: "Archive" },
          { value: "keep", name: "Keep active" },
          { value: "add", name: "Add new tasks" },
        ],
      });
      if (action === "archive") {
        await adapter.moveNote(file, file.replace("1-Projects/", "4-Archive/"));
        archived.push(name);
        console.log(chalk.green(`  → Archived`));
      } else if (action === "add") {
        const task = await input({ message: "New task:" });
        if (task.trim()) {
          const area = name.split("--")[0] || "personal";
          await adapter.appendToSection(file, "## Next Actions", `- [ ] ${task.trim()} #${area}`);
        }
      }
    }
  }

  // Step 12: Generate monthly note
  onStep(11);
  const monthlyNote = generateMonthlyNote({
    monthLabel,
    weeklyData,
    goals,
    roles,
    areaHealth,
    archived,
  });

  const monthlyPath = `${config.monthlyNotesFolder}/${monthLabel}.md`;
  await adapter.createNote(monthlyPath, monthlyNote);
  console.log(chalk.green(`✓ Monthly note saved to ${monthlyPath}`));
}
