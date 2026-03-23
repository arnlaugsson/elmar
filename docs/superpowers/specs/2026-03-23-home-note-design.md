# Home Note Design

## Goal

Add a `Home.md` to the Elmar vault template that serves as the user's "front door" — a grounding note that surfaces personal anchors (motto, priority, roles, values, goals) alongside live operational widgets (inbox, today's tasks, active projects).

## Architecture

A single static markdown file at `vault-template/Home.md`, included in every new vault via `elmar init`. The top half is hand-edited personal content with placeholder text. The bottom half uses Dataview queries for live data.

Home.md lives at the vault root (not under `_System/`) because it is the entry point, not a system file. The existing `_System/dashboard.md` remains separate — it focuses on metric trends via Tracker charts, while Home.md is about grounding and operational awareness.

## Files

- **Create:** `vault-template/Home.md`
- **Modify:** `vault-template/Templates/project.md` — change `Status: active` to `Status:: active` (double colon) so Dataview can query it. Also update `Area:` to `Area::` for consistency.

## Structure

### Top Half — Personal Anchors (static)

All sections use placeholder text that prompts the user to customize.

1. **Motto** — blockquote with the user's guiding statement
2. **Top Priority** — the single most important focus right now
3. **Roles** — bullet list of key roles (father, partner, engineer, etc.)
4. **Core Values** — 3-5 guiding values as a bullet list
5. **Goals** — quarterly/yearly goals, 2-4 items as a bullet list

### Bottom Half — Live Widgets (Dataview)

Requires the Dataview plugin (already a recommended plugin in README).

1. **Inbox** — `dataview` query counting bullet items in `0-Inbox/inbox.md`
2. **Today's Tasks** — `dataview` TASK query finding uncompleted tasks with due dates on or before today from `1-Projects/`
3. **Active Projects** — `dataview` LIST query filtering files in `1-Projects/` where `Status = active`

## Dataview Queries

### Inbox Count

```dataviewjs
const inbox = dv.page("0-Inbox/inbox");
if (inbox) {
  const content = await dv.io.load(inbox.file.path);
  const count = content.split("\n").filter(l => l.startsWith("- ") && l.trim().length > 2).length;
  dv.paragraph(`**${count}** items in inbox`);
} else {
  dv.paragraph("Inbox is empty");
}
```

### Today's Tasks

```dataviewjs
const today = dv.date("today");
const tasks = dv.pages('"1-Projects"').file.tasks
  .where(t => !t.completed)
  .where(t => {
    if (!t.text.includes("📅")) return false;
    const match = t.text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    return match && dv.date(match[1]) <= today;
  });
if (tasks.length > 0) {
  dv.taskList(tasks, false);
} else {
  dv.paragraph("No tasks due today");
}
```

### Active Projects

```dataview
LIST
FROM "1-Projects"
WHERE Status = "active"
SORT file.name ASC
```

## Exact Template Content

The Home.md file should contain this markdown:

```markdown
# Home

> "Your motto here — what guides you?"

## Top Priority

What is the one thing that matters most right now?

## Roles

- Father
- Partner
- Engineer
- *(add yours)*

## Core Values

- Curiosity
- Presence
- *(add yours)*

## Goals

- Goal 1
- Goal 2

---

## Inbox

< dataviewjs inbox query here >

## Today

< dataviewjs today's tasks query here >

## Active Projects

< dataview active projects query here >
```

The `< query here >` placeholders above represent the actual Dataview code blocks from the Dataview Queries section.

## Obsidian Setup

The README should mention: set Home.md as the startup note via Settings > Files & Links > Default note for new tabs.

## Testing

- Verify `elmar init` copies Home.md to the new vault
- Verify Dataview queries render correctly in Obsidian with sample data
- No unit tests needed (this is a static template file)

## Out of Scope

- No CLI command for editing the home note (users edit in Obsidian or any editor)
- No Templater integration (static file, Dataview handles the dynamic parts)
- No changes to existing CLI commands or adapter layer
