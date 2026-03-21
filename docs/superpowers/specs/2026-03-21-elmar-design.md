# Elmar — Personal Knowledge & Productivity System

**Date:** 2026-03-21
**Status:** Approved

## Overview

Elmar is a personal knowledge management and productivity system built around an Obsidian vault, with a TypeScript CLI for terminal access. Named after Elmer the Patchwork Elephant — a patchwork of methodologies (GTD, PARA, Zettelkasten, daily tracking, journaling) stitched into one cohesive system.

The project ships as two things:
1. **An Obsidian vault template** — PARA folder structure, daily note templates, metric registry, curated plugin set, Bases/Tracker dashboards
2. **A CLI tool (`elmar`)** — npm-installable, wraps the Obsidian CLI when available, falls back to direct markdown I/O

Users set up their own vault from the template, point the CLI at it, and use Obsidian + terminal + Claude Code/Cowork as complementary interfaces into the same data.

## Architecture

### Project Structure

```
~/Projects/elmar/                    # The shareable project
├── src/                             # CLI source (TypeScript)
│   ├── commands/                    # CLI commands
│   │   ├── capture.ts
│   │   ├── tasks.ts
│   │   ├── log.ts
│   │   ├── journal.ts
│   │   ├── review.ts
│   │   ├── metrics.ts
│   │   ├── new.ts
│   │   ├── status.ts
│   │   └── init.ts
│   ├── core/                        # Business logic
│   │   ├── vault.ts                 # Vault path resolution, config
│   │   ├── task-parser.ts           # Parse tasks from markdown files
│   │   ├── metric-registry.ts       # Load/validate metric definitions
│   │   ├── daily-note.ts            # Daily note read/write/template
│   │   └── project.ts              # Project file creation/querying
│   ├── adapters/                    # I/O layer
│   │   ├── adapter.ts              # Adapter interface
│   │   ├── obsidian-cli.ts         # Obsidian CLI adapter (preferred)
│   │   └── markdown.ts             # Direct file I/O adapter (fallback)
│   └── index.ts                     # CLI entry point
├── vault-template/                  # Starter vault
│   ├── .obsidian/                   # Plugin config, Bases views, hotkeys
│   ├── 0-Inbox/
│   │   └── inbox.md
│   ├── 1-Projects/
│   ├── 2-Areas/
│   ├── 3-Resources/
│   ├── 4-Archive/
│   ├── Journal/
│   │   └── weekly/
│   ├── Templates/
│   │   ├── daily-note.md
│   │   ├── project.md
│   │   └── weekly-review.md
│   └── _System/
│       ├── metrics.json
│       └── dashboard.md
├── package.json
├── tsconfig.json
├── README.md
└── .elmar.config.json               # Points to vault location
```

### Adapter Layer

```
commands/  →  core/  →  adapters/
                        ├── obsidian-cli.ts    (preferred when Obsidian is running)
                        └── markdown.ts        (fallback, direct file I/O)
```

On each invocation, the CLI checks if the Obsidian CLI is reachable. If yes, routes through `obsidian-cli.ts` for link-safe, plugin-aware operations. If not, falls back to `markdown.ts` for direct read/write. The user never has to think about which mode is active.

**Implementation priority:** Build the markdown adapter first as the primary implementation. The Obsidian CLI adapter is an optional enhancement — its API surface may be limited for some operations, and it requires Obsidian to be running. The markdown adapter must be fully functional standalone.

### Adapter Interface

The adapter exposes these operations (both implementations fulfill the same contract):

```typescript
interface VaultAdapter {
  // File operations
  readNote(path: string): Promise<string>;
  writeNote(path: string, content: string): Promise<void>;
  appendToSection(path: string, section: string, content: string): Promise<void>;
  createNote(path: string, content: string): Promise<void>;
  moveNote(from: string, to: string): Promise<void>;
  deleteNote(path: string): Promise<void>;
  noteExists(path: string): Promise<boolean>;

  // Query operations
  listFiles(folder: string, pattern?: string): Promise<string[]>;
  searchContent(query: string): Promise<SearchResult[]>; // returns {path, line, text, context}

  // Daily note operations
  ensureDailyNote(date: string): Promise<string>; // creates from template if missing, returns path
}
```

The Obsidian CLI adapter delegates to `obsidian-cli` commands where supported (note CRUD, search, daily notes) and falls back to direct file I/O for anything the Obsidian CLI doesn't cover. The markdown adapter handles everything via `fs` operations and markdown parsing.

**`appendToSection` semantics:** Matches the first occurrence of the exact heading text (e.g., `## Journal`). Appends content before the next heading of equal or higher level, or at end of file if no subsequent heading exists.

## Vault Structure

### PARA Folders with GTD Workflow

```
0-Inbox/                           # Quick capture landing zone
  inbox.md                         # Single file, append-only, process during review

1-Projects/                        # Active projects with defined outcomes
  work--api-redesign.md            # Prefix convention for area tagging
  personal--kitchen-reno.md
  family--summer-trip.md

2-Areas/                           # Ongoing responsibilities
  health.md
  finances.md
  career.md
  parenting.md

3-Resources/                       # Research, references, notes
  (grows organically)

4-Archive/                         # Completed/inactive items moved here

Journal/
  2026-03-21.md                    # Daily notes
  weekly/
    2026-W12.md                    # Weekly review summaries

_System/
  metrics.json                     # Metric registry
  dashboard.md                     # Bases/Tracker charts and views
```

### Project File Format

```markdown
# {{title}}

Status: active
Area: {{area}}
Outcome: {{outcome}}
Created: {{date}}

## Next Actions
- [ ] {{first_action}} #{{area}}

## Waiting For

## Notes
{{initial_context}}
```

Tasks use `- [ ]` checkboxes with inline tags (`#work`, `#family`, `#personal`, `#finance`). Due dates use the `📅 YYYY-MM-DD` format. Waiting-for items use `#{{area}}/waiting` tags.

### Daily Note Template

The template below is **illustrative**. The actual tracking section and structured fields are generated dynamically by Templater from the metric registry. When a user adds a new metric to `metrics.json`, it appears in the next day's note automatically.

```markdown
# {{date}}

## Journal
<!-- Free writing -->

## Gratitude
-

## Tracking
sleep::
reading::
family::
partner::
growth::
grateful::
journal::

## Tasks
- [ ]

## Notes
<!-- Anything captured during the day -->
```

**All metrics use `key:: value` Dataview inline fields**, including `grateful` and `journal`. The `## Gratitude` heading is a visual section for free-form bullet lists; the `grateful::` field in Tracking holds the count (populated automatically by the CLI from the bullet count, or directly via `elmar log grateful "item"`). Similarly, `journal::` is auto-populated with the character count of the `## Journal` section content.

**How `elmar log grateful "item"` works:** Appends a bullet under `## Gratitude`, then updates `grateful::` with the new bullet count. This keeps both the human-readable list and the Dataview-queryable count in sync. Similarly, `journal::` is updated with the character count of `## Journal` content whenever the journal section changes.

The `key:: value` syntax is native to Dataview and Tracker — no YAML frontmatter needed.

## Metric Registry

### Definition (`_System/metrics.json`)

```json
{
  "metrics": [
    { "key": "sleep", "label": "Sleep Score", "type": "number", "range": [1, 100] },
    { "key": "reading", "label": "Reading", "type": "number", "unit": "minutes" },
    { "key": "family", "label": "Family Engagement", "type": "number", "range": [1, 10] },
    { "key": "partner", "label": "Partner Score", "type": "number", "range": [1, 10], "comment": true },
    { "key": "growth", "label": "Growth", "type": "text" },
    { "key": "grateful", "label": "Gratitude", "type": "list" },
    { "key": "journal", "label": "Journal", "type": "text" }
  ]
}
```

### Type-to-Graph Mapping

| Type | Graphable Value | Example |
|------|----------------|---------|
| `number` | The value itself | sleep: 85 → 85 |
| `text` | Character count (0 = no entry) | growth: "Read chapter on..." → 24 |
| `list` | Item count | grateful: 3 items → 3 |

### Adding New Metrics

Add one entry to `metrics.json` with key, label, type, and optional range/unit. The daily note template, CLI validation, and dashboard charts pick it up automatically. No code changes needed.

## CLI Commands

| Command | What it does |
|---------|-------------|
| `elmar init` | Copies vault template to chosen location, creates `.elmar.config.json` |
| `elmar capture "text"` | Appends to `0-Inbox/inbox.md` — fast, no questions |
| `elmar tasks` | Flat list of all tasks across projects, with area tags |
| `elmar tasks --area work` | Filtered by area |
| `elmar tasks --due today` | Due today or overdue |
| `elmar log sleep 85` | Writes metric to today's daily note |
| `elmar log grateful "my kids"` | Appends to today's gratitude list |
| `elmar journal "free text"` | Appends to today's journal section |
| `elmar review` | Interactive weekly review walkthrough |
| `elmar metrics` | Shows trends for tracked metrics (last 7/30 days) |
| `elmar new project "name" --area work` | Creates project file via guided questions |
| `elmar done "task text"` | Marks a matching task as complete (`- [ ]` → `- [x]`) |
| `elmar status` | Overview: inbox count, overdue tasks, tracking gaps |

### Capture vs. New Project

**Capture is fast and frictionless.** `elmar capture "Reykjalundur integration"` — straight to inbox, no questions.

**New project is deliberate.** `elmar new project "Reykjalundur integration"` prompts for:
- Desired outcome
- Area (work/personal/family/finance)
- First next action
- Deadline (optional)
- Initial context/notes

When used via Claude Code/Cowork, Claude asks these questions conversationally if it doesn't have enough context, then writes the project file.

## Weekly Review (`elmar review`)

Interactive CLI walkthrough using `inquirer` (or similar prompt library) for step-by-step interaction. The user can quit mid-review with Ctrl+C; progress is saved to `{vaultPath}/_System/.elmar-review-state.json` so they can resume with `elmar review --resume`.

Steps:

1. **Inbox processing** — shows items one by one: move to project, create task, archive, or delete
2. **Project scan** — for each active project: still active? new tasks? anything to delegate?
3. **Someday/Maybe check** — projects with `Status: someday` in their frontmatter. Anything to activate or drop?
4. **Area check** — any area neglected this week? (based on task activity)
5. **Metrics summary** — week's trends (averages, totals, streaks)
6. **Generate weekly note** — saves summary to `Journal/weekly/YYYY-WNN.md`

### Someday/Maybe

Not a separate folder. Projects with `Status: someday` in their project file live in `1-Projects/` alongside active ones. `elmar tasks` excludes them by default. `elmar review` surfaces them for re-evaluation.

## Dashboard (`_System/dashboard.md`)

An Obsidian note with:
- 30-day line charts for each numeric metric (Tracker plugin)
- Heatmap for journaling consistency
- Gratitude count trend
- Active projects table with task counts and last-touched date (Bases)
- Overdue tasks list (Bases)
- Inbox items waiting count

## Obsidian Plugin Stack

| Plugin | Purpose |
|--------|---------|
| Bases (core) | Flat task views, metric tables, project dashboards |
| Tracker | Charts/graphs for daily metrics over time |
| Templater | Dynamic daily note templates from metric registry |
| Calendar | Visual navigation for daily notes |
| Dataview | Query engine for complex views |
| Periodic Notes | Weekly/monthly note generation for reviews |

The template ships with these pre-configured. README documents each plugin's role.

## Claude Code / Cowork Integration

No special code — the system is AI-friendly by design:

- Vault is markdown files on disk — Claude reads/writes directly
- `elmar` CLI available as shell commands Claude can invoke
- Metric registry and project files are structured for Claude to understand

**Example workflows:**
- "What's on my plate this week?" → Claude runs `elmar tasks` and `elmar status`
- "Research X and create a resource note" → Claude writes to `3-Resources/`
- "Help me process my inbox" → Claude reads inbox, suggests routing, user confirms
- "How's my sleep been this month?" → Claude runs `elmar metrics` or reads daily notes
- "Create a new project for X" → Claude asks clarifying questions, then creates project file

The README includes a "Using with Claude Code" section documenting these patterns.

## Template Distribution

The project ships as:
1. **npm package** — `npm install -g elmar` installs the CLI
2. **Vault template** — `elmar init` copies the starter vault to the user's chosen location
3. **README** — documents the system philosophy, setup, CLI commands, plugin stack, and how to use Claude Code as a setup assistant

Users can customize: add/remove metrics, change PARA folder names, adjust the plugin set, modify templates. The README guides them through customization with Claude's help.

## Configuration (`.elmar.config.json`)

```json
{
  "vaultPath": "~/SecondBrain",
  "inboxFile": "0-Inbox/inbox.md",
  "dailyNotesFolder": "Journal",
  "weeklyNotesFolder": "Journal/weekly",
  "templatesFolder": "Templates",
  "systemFolder": "_System",
  "areas": ["work", "personal", "family", "finance"]
}
```

**Location precedence** (first found wins):
1. `$ELMAR_CONFIG` environment variable (explicit override)
2. `~/.elmar.config.json` (user-specific, created by `elmar init`)
3. `./.elmar.config.json` (local directory, for development/testing)

The config in the project repo (`~/Projects/elmar/.elmar.config.json`) is a template/example only — not used at runtime. `elmar init` creates the real config at `~/.elmar.config.json`.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Vault path in config does not exist | Error with message: "Vault not found at {path}. Run `elmar init` or update ~/.elmar.config.json" |
| No config file found | Error: "No config found. Run `elmar init` to set up Elmar." |
| Daily note missing when running `elmar log` | Auto-create from template, then write the metric |
| Metric key not in registry | Error: "Unknown metric '{key}'. Available: sleep, reading, ..." |
| Metric value out of range | Error: "sleep must be between 1-100, got {value}" |
| Inbox file missing | Auto-create empty inbox.md |
| Malformed task syntax in project files | Skip with warning to stderr, continue processing other tasks |
| Obsidian CLI not reachable | Silent fallback to markdown adapter (no error) |

## Task Parsing Rules

`elmar tasks` scans these locations for `- [ ]` checkboxes:
- `1-Projects/**/*.md` — primary source of tasks
- `2-Areas/**/*.md` — area-level tasks

**Not scanned:** `Journal/` (daily note tasks are ephemeral), `3-Resources/`, `4-Archive/`, `0-Inbox/`.

Task states:
- `- [ ]` — open (included in `elmar tasks`)
- `- [x]` — completed (excluded by default, shown with `--all`)
- `- [ ] ... #area/waiting` — waiting-for (shown in `elmar tasks`, filterable with `--waiting`)

Due date filter: `--due today` means "due on or before today" (includes overdue). Future: `--due this-week`, `--due next-week`.
