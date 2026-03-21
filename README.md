# Elmar 🐘

A personal knowledge management and productivity system — named after Elmer the Patchwork Elephant. Like Elmer, this system is a patchwork of methodologies (GTD, PARA, Zettelkasten, daily tracking, journaling) stitched into one cohesive system.

**Elmar = Obsidian vault template + CLI tool.** Your vault is the brain, the CLI is your fast terminal interface, and Claude Code/Cowork is the AI layer.

## Quick Start

```bash
# Install
npm install -g elmar

# Create your vault
elmar init ~/SecondBrain

# Start using it
elmar capture "Read about distributed systems"
elmar log sleep 85
elmar tasks
```

## What You Get

### Vault Template (PARA + GTD)

```
~/SecondBrain/
├── 0-Inbox/          # Quick capture, process during review
├── 1-Projects/       # Active projects with defined outcomes
├── 2-Areas/          # Ongoing responsibilities
├── 3-Resources/      # Research, references, notes
├── 4-Archive/        # Completed/inactive items
├── Journal/          # Daily notes + weekly reviews
├── Templates/        # Note templates (Templater-compatible)
└── _System/          # Metrics registry, dashboard
```

### CLI Commands

| Command | What it does |
|---------|-------------|
| `elmar init <path>` | Create a new vault from the template |
| `elmar capture "text"` | Quick capture to inbox (fast, no questions) |
| `elmar tasks` | Flat list of all tasks across projects |
| `elmar tasks --area work` | Filter by area |
| `elmar tasks --due today` | Due today or overdue |
| `elmar log sleep 85` | Log a metric to today's daily note |
| `elmar log grateful "sunshine"` | Add to gratitude list |
| `elmar journal "free text"` | Append to today's journal |
| `elmar done "task text"` | Mark a matching task as complete |
| `elmar new project "name"` | Create a new project (guided prompts) |
| `elmar status` | Overview: inbox count, overdue tasks, tracking gaps |
| `elmar review` | Interactive weekly review *(coming soon)* |
| `elmar metrics` | Metric trends *(coming soon)* |

### Daily Tracking

Track anything with a flexible metric registry. Default metrics:

| Metric | Type | Input |
|--------|------|-------|
| Sleep | Number (1-100) | Your sleep score |
| Reading | Number (minutes) | Reading time |
| Family | Number (1-10) | Family engagement score |
| Partner | Number (1-10) | Self-assessment as partner |
| Growth | Text | Learning/growth notes |
| Gratitude | List | Things you're grateful for |
| Journal | Text | Free-form journaling |

**Add your own:** Edit `_System/metrics.json` and add a new entry. It automatically appears in daily notes and the CLI.

```json
{ "key": "exercise", "label": "Exercise", "type": "number", "unit": "minutes" }
```

## Obsidian Setup

Open your vault in Obsidian and install these community plugins:

| Plugin | Purpose |
|--------|---------|
| **Templater** | Dynamic daily note templates from metric registry |
| **Tracker** | Charts/graphs for daily metrics (see `_System/dashboard.md`) |
| **Calendar** | Visual navigation for daily notes |
| **Dataview** | Query engine for task views and dashboards |
| **Periodic Notes** | Weekly/monthly note generation |

The vault uses Dataview inline fields (`key:: value`) for all tracking data — no YAML frontmatter needed.

## How It Works

### Capture vs. New Project

**Capture is instant.** `elmar capture "thing"` drops it in the inbox. No questions, no friction. Process it later during your weekly review.

**New project is deliberate.** `elmar new project "Garage renovation"` walks you through: outcome, area, first action, deadline, context. Starting a project should be a thinking process.

### Task Management

Tasks live inside project files as `- [ ]` checkboxes with inline tags:

```markdown
## Next Actions
- [ ] Draft API spec #work
- [ ] Book flights #family 📅 2026-04-15
- [ ] Waiting for Sara's feedback #work/waiting
```

`elmar tasks` gives you a flat view across all projects, filterable by area, due date, or waiting status.

### The Adapter Pattern

The CLI uses the Obsidian CLI when Obsidian is running (link-safe operations), and falls back to direct markdown file I/O when it's not. You never have to think about which mode is active.

## Using with Claude Code

Elmar is designed to be AI-friendly. Your vault is markdown files on disk — Claude can read and write them directly, and invoke `elmar` commands.

**Example workflows:**

```
"What's on my plate this week?"
→ Claude runs `elmar tasks` and `elmar status`, summarizes

"Research Kubernetes networking and create a resource note"
→ Claude researches, writes to 3-Resources/kubernetes-networking.md

"Help me process my inbox"
→ Claude reads inbox, suggests where each item should go, you confirm

"How's my sleep been this month?"
→ Claude reads daily notes, gives you a summary and trend

"Create a new project for the Reykjalundur integration"
→ Claude asks you about the outcome, area, first action, then creates the project
```

## Customization

- **Metrics:** Edit `_System/metrics.json` to add/remove/modify metrics
- **Areas:** Update the `areas` field in `~/.elmar.config.json`
- **Folder names:** Update paths in `~/.elmar.config.json`
- **Templates:** Modify files in `Templates/` to change daily note format
- **Dashboard:** Edit `_System/dashboard.md` to change Tracker charts

## Configuration

Config lives at `~/.elmar.config.json` (created by `elmar init`):

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

Override with `ELMAR_CONFIG` environment variable to point to a different config file.

## Philosophy

Elmar combines three systems:

- **PARA** (Projects, Areas, Resources, Archive) — organizes *where* things live
- **GTD** (Getting Things Done) — provides the *workflow* (capture, clarify, organize, review)
- **Zettelkasten** — inspires *how* you build knowledge in Resources (atomic notes, connections)

The daily tracking layer adds personal awareness — sleep, relationships, growth, gratitude — because productivity without wellbeing is just busy work.

## License

MIT
