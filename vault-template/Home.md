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

## Today

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

## Active Projects

```dataview
LIST
FROM "1-Projects"
WHERE Status = "active"
SORT file.name ASC
```
