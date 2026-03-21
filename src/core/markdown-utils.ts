export interface SectionRange {
  readonly start: number;
  readonly end: number;
}

export function findSectionRange(
  content: string,
  heading: string
): SectionRange | null {
  const lines = content.split("\n");
  const headingLevel = heading.match(/^(#+)/)?.[1].length ?? 0;
  let startIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) return null;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#+)\s/);
    if (match && match[1].length <= headingLevel) {
      return { start: startIdx, end: i };
    }
  }

  return { start: startIdx, end: lines.length };
}

export function appendToSection(
  content: string,
  heading: string,
  text: string
): string {
  const lines = content.split("\n");
  const range = findSectionRange(content, heading);

  if (!range) {
    throw new Error(`Section "${heading}" not found`);
  }

  lines.splice(range.end, 0, text);
  return lines.join("\n");
}

export function getInlineField(
  content: string,
  key: string
): string | null {
  const regex = new RegExp(`^${escapeRegex(key)}::(.*)$`, "m");
  const match = content.match(regex);
  if (!match) return null;
  const value = match[1].trim();
  return value === "" ? null : value;
}

export function setInlineField(
  content: string,
  key: string,
  value: string
): string {
  const regex = new RegExp(`^${escapeRegex(key)}::.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `${key}:: ${value}`);
  }
  return content + `\n${key}:: ${value}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
