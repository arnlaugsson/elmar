import { basename } from "node:path";
import type { TaskItem } from "./types.js";

const TASK_REGEX = /^- \[([ xX])\] (.+)$/;
const TAG_REGEX = /#([\w/.-]+)/g;
const DUE_DATE_REGEX = /📅\s*(\d{4}-\d{2}-\d{2})/;

export function parseTaskLine(
  line: string,
  sourcePath: string,
  lineNumber: number
): TaskItem | null {
  const match = line.trim().match(TASK_REGEX);
  if (!match) return null;

  const completed = match[1] !== " ";
  const rawText = match[2];

  const tags: string[] = [];
  let tagMatch: RegExpExecArray | null;
  const tagRegex = new RegExp(TAG_REGEX.source, "g");
  while ((tagMatch = tagRegex.exec(rawText)) !== null) {
    tags.push(tagMatch[1]);
  }

  const dueDateMatch = rawText.match(DUE_DATE_REGEX);
  const dueDate = dueDateMatch ? dueDateMatch[1] : null;

  const waiting = tags.some((t) => t.endsWith("/waiting"));

  const text = rawText
    .replace(TAG_REGEX, "")
    .replace(DUE_DATE_REGEX, "")
    .trim();

  const sourceArea = extractArea(sourcePath);

  return {
    text,
    completed,
    tags,
    dueDate,
    waiting,
    sourcePath,
    sourceArea,
    line: lineNumber,
  };
}

export function parseTasks(
  content: string,
  sourcePath: string
): readonly TaskItem[] {
  const lines = content.split("\n");
  const tasks: TaskItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i], sourcePath, i);
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
}

function extractArea(sourcePath: string): string {
  const filename = basename(sourcePath, ".md");
  const dashIndex = filename.indexOf("--");
  if (dashIndex > 0) {
    return filename.substring(0, dashIndex);
  }
  return "unknown";
}
