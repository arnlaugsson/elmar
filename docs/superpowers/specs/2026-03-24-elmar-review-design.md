# Elmar Review Design

## Goal

Implement `elmar review` — an interactive, tiered review command that auto-detects what's due (daily, weekly, monthly) and walks the user through each tier. Stacks tiers when overdue. Supports Ctrl+C resume.

## Architecture

Three review tiers with increasing depth. A state file tracks when each tier was last completed and saves progress for interrupted reviews. `elmar review` checks what's due, runs all due tiers in sequence, and generates review notes.

## Files

- **Create:** `src/commands/review.ts` — review command handler, tier logic, interactive prompts
- **Create:** `src/core/review-state.ts` — state file read/write, tier detection
- **Create:** `src/core/review-steps.ts` — individual review step implementations
- **Create:** `vault-template/Templates/monthly-review.md` — monthly note template
- **Create:** `vault-template/Journal/monthly/.gitkeep` — monthly notes folder
- **Create:** `src/core/task-date-utils.ts` — utility for parsing/replacing due dates in task text
- **Modify:** `src/index.ts` — replace review stub (remove `--resume`, add `--fresh`) with real implementation
- **Modify:** `src/core/types.ts` — add `monthlyNotesFolder` to `ElmarConfig`
- **Modify:** `src/core/config.ts` — add `monthlyNotesFolder` default (`"Journal/monthly"`)
- **Add migration:** `src/core/migrations.ts` — migration for `monthlyNotesFolder` and monthly/.gitkeep

## State Tracking

State file at `_System/.elmar-review-state.json`. Uses direct filesystem access (not VaultAdapter) — same pattern as `metric-registry.ts`. For testing, the state module accepts a file path parameter so tests can point to a temp directory.

```json
{
  "lastDaily": "2026-03-24",
  "lastWeekly": "2026-03-21",
  "lastMonthly": "2026-03-01",
  "interrupted": null
}
```

When `interrupted` is non-null:

```json
{
  "interrupted": {
    "tier": "weekly",
    "step": 3,
    "data": { "processedInbox": ["item1", "item2"], "reviewedProjects": ["work--api"] }
  }
}
```

Missing state file = all tiers due (first run). State file created on first completion.

## Tier Detection

| Tier | Due when | Supersedes |
|------|----------|------------|
| Daily | `lastDaily < today` | — |
| Weekly | `lastWeekly` is 7+ days ago | Daily (skip daily if weekly is due) |
| Monthly | `lastMonthly` is 30+ days ago | Nothing (runs after weekly) |

Run order: daily → weekly → monthly. If weekly is due, daily is skipped because weekly step 1 (inbox processing) is a thorough version of daily step 1.

## CLI Interface

```
$ elmar review          # auto-detect what's due, run it
$ elmar review --fresh  # ignore interrupted state, start fresh
```

No tier flags — it always figures out what's due automatically.

## Daily Check-in (~2 minutes)

### Step 1: Inbox scan

Show inbox item count. Ask "Process now?" (confirm prompt).

If yes, for each inbox item show:
- The item text
- Actions: `Move to project` | `Create task` | `Skip`
- "Move to project" prompts for which project file, appends item to project's Notes section, removes from inbox
- "Create task" prompts for project file, adds a `- [ ]` line to project, removes from inbox

If no, skip (items stay in inbox).

After each action, print confirmation (e.g., "Moved 'research API' to work--api.md").

### Step 2: Today's tasks

Show tasks due today or overdue (same data as `elmar tasks --due today`).

For each task:
- Actions: `Done` | `Snooze` (prompts for new date) | `Skip`
- "Done" marks `- [ ]` → `- [x]` (reuses `runDone` logic)
- "Snooze" updates the 📅 date — uses a new `snoozeDueDate(line, newDate)` utility in `src/core/task-date-utils.ts` that finds the `📅 YYYY-MM-DD` pattern in the task line and replaces the date. If no date exists, appends `📅 YYYY-MM-DD` to the line.

### Step 3: Tracking gaps

Load metric registry, check today's daily note for unfilled fields (same logic as `runStatus`).

For each gap, prompt inline:
- Number metrics: number input with validation
- Text metrics: text input
- List metrics (grateful): text input, can add multiple

Uses existing `runLog` logic to write values.

### Completion

Update `lastDaily` in state file.

## Weekly Review (GTD full)

### Step 1: Inbox processing

Same as daily step 1, but mandatory — every item must be processed. No "Skip" option, only `Move to project` | `Create task` | `Archive` (delete from inbox) | `Delete`.

### Step 2: Project scan

For each active project (`Status:: active` in `1-Projects/`):
- Show project name and open task count
- Prompt: `Still active` | `Move to someday` | `Archive`
- If still active: "Any new tasks to add?" (optional text input, adds `- [ ]` lines)

### Step 3: Someday/Maybe check

For each project with `Status:: someday`:
- Show project name
- Prompt: `Activate` | `Keep as someday` | `Drop` (archive)

### Step 4: Area check

For each configured area (from config `areas` array):
- Show count of open tasks in that area (via `collectTasks` + `filterTasks` with `area` filter)
- Note: completed-this-week counts are not tracked (tasks have no `completedDate`). Instead, show open task count as a proxy for area activity.
- Prompt: "Needs attention?" (confirm). If yes, free text note captured in the weekly note.

### Step 5: Metrics summary

Read daily notes from the past 7 days. For each metric:
- Number: show average and min/max
- List (grateful): show total count
- Text (journal): show days with entries vs. total days

Display as a formatted table.

### Step 6: Reflections + Focus

- "What went well this week?" — editor/input prompt
- "What needs attention?" — editor/input prompt
- "Next week's top focus?" — input prompt

### Step 7: Generate weekly note

Save to `Journal/weekly/YYYY-WNN.md` using the weekly-review template. Fill in:
- Projects reviewed (list with status decisions)
- Metrics summary (the table from step 5)
- Reflections (from step 6)
- Next week focus (from step 6)

Update `lastWeekly` in state file.

## Monthly Review

Runs all weekly steps (1-7) first, then adds:

### Step 8: Goals review

Read goals from `Home.md` (parse the `## Goals` section).

For each goal:
- Show the goal text
- Prompt: `On track` | `Needs attention` | `Drop` | `Achieved`
- Optional: note about progress (text input)

### Step 9: Roles check

Read roles from `Home.md` (parse the `## Roles` section).

For each role:
- Prompt: "How present were you in this role? (1-10)"
- Optional: note (text input)

### Step 10: Area health

For each configured area:
- Prompt: "Rate this area's health (1-10)"
- Saved as inline fields in the monthly note

### Step 11: Archive sweep

Find projects with `Status:: active` where all tasks are completed (no open `- [ ]` lines).

For each:
- Show project name
- Prompt: `Archive` | `Keep active` | `Add new tasks`
- "Archive" moves file to `4-Archive/` via adapter

### Step 12: Generate monthly note

Save to `Journal/monthly/YYYY-MM.md` using monthly-review template. Fill in:
- Everything from the weekly note
- Goals status and notes
- Role presence scores
- Area health scores
- Archive actions taken

Update `lastMonthly`, `lastWeekly`, and `lastDaily` in state file (completing a monthly review satisfies all three tiers).

## Monthly Review Template

`vault-template/Templates/monthly-review.md`:

```markdown
# Monthly Review — {{month}}

## Goals Status
<!-- Auto-filled during review -->

## Role Presence
<!-- Auto-filled during review -->

## Area Health
<!-- Auto-filled during review -->

## Projects Archived
<!-- Auto-filled during review -->

## Reflections
<!-- What went well? What needs attention? -->

## Next Month Focus
-
```

## Interrupt/Resume

On Ctrl+C (SIGINT):
1. Save current tier, step number, and accumulated data to `interrupted` in state file
2. Print "Review paused. Run `elmar review` to resume."
3. Exit cleanly

On resume:
1. Read `interrupted` from state file
2. Skip to the saved tier and step
3. Restore accumulated data (e.g., list of already-processed inbox item indices, reviewed project paths)
4. Continue from there

Computed data (like metrics aggregation) is recalculated on resume — only identifiers of processed items are saved, not derived results. This keeps the serialized state simple and robust.

`--fresh` flag clears `interrupted` and starts from scratch.

## Reusing Existing Code

- **Inbox reading**: reuse logic from `runStatus` (count inbox items, parse bullet lines)
- **Task listing/filtering**: reuse `collectTasks` and `filterTasks` from tasks.ts
- **Metric logging**: reuse `runLog` from log.ts for inline gap filling
- **Task completion**: reuse `runDone` logic from done.ts
- **Tracking gaps**: reuse gap detection from `runStatus`
- **Metric registry**: reuse `loadRegistry` from metric-registry.ts
- **Daily note reading**: reuse adapter `readNote` for parsing metrics from daily notes

## Error Handling

- **No config**: same as other commands
- **No vault**: "Vault not found. Run `elmar init` first."
- **Empty inbox/no projects**: skip the step with a message ("Inbox is clear!")
- **Daily note missing for metrics**: skip metrics summary for days without notes
- **Home.md missing goals/roles**: skip goals/roles steps with a hint to set up Home.md

## Testing

- **Unit tests for review-state.ts:**
  - Reads/writes state file correctly
  - Detects due tiers based on dates
  - Handles missing state file (all due)
  - Handles interrupted state

- **Unit tests for review-steps.ts:**
  - Inbox item parsing
  - Metrics aggregation (averages, counts)
  - Weekly note generation
  - Monthly note generation
  - Project status detection (all tasks complete)

- **Integration test:**
  - Full daily review with mocked prompts
  - Tier stacking (weekly + monthly)

Note: Interactive prompts (inquirer) should be injected/mockable for testing.

## Out of Scope

- No scheduled/automatic reviews (user runs manually)
- No notification/reminder system
- No Obsidian plugin integration for reviews (CLI only)
- No custom review steps (fixed tiers)
