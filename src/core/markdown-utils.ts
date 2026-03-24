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

// --- Frontmatter helpers ---

const FM_REGEX = /^---\n([\s\S]*?)\n---/;

export function parseFrontmatter(
  content: string
): { readonly fields: Record<string, string>; readonly body: string } {
  const match = content.match(FM_REGEX);
  if (!match) return { fields: {}, body: content };

  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) fields[key] = value;
  }

  const body = content.slice(match[0].length).replace(/^\n+/, "");
  return { fields, body };
}

export function getFrontmatterField(
  content: string,
  key: string
): string | null {
  const { fields } = parseFrontmatter(content);
  const val = fields[key];
  return val !== undefined && val !== "" ? val : null;
}

export function setFrontmatterField(
  content: string,
  key: string,
  value: string
): string {
  const match = content.match(FM_REGEX);
  if (!match) {
    return `---\n${key}: ${value}\n---\n${content}`;
  }

  const lines = match[1].split("\n");
  let found = false;
  const updated = lines.map((line) => {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return line;
    const lineKey = line.slice(0, colonIdx).trim();
    if (lineKey === key) {
      found = true;
      return `${key}: ${value}`;
    }
    return line;
  });

  if (!found) updated.push(`${key}: ${value}`);

  const newFm = `---\n${updated.join("\n")}\n---`;
  const body = content.slice(match[0].length);
  return newFm + body;
}

export function buildFrontmatter(fields: Record<string, string>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---`;
}

export function inlineFieldsToFrontmatter(content: string): string {
  const { fields: existingFm, body } = parseFrontmatter(content);
  const lines = body.split("\n");
  const fmFields: Record<string, string> = { ...existingFm };
  const bodyLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(\w[\w\s]*)::(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (value !== "") {
        fmFields[key] = value;
      } else {
        // Keep empty tracking fields in frontmatter too
        if (!(key in fmFields)) fmFields[key] = "";
      }
    } else {
      bodyLines.push(line);
    }
  }

  if (Object.keys(fmFields).length === 0) return content;

  const fm = buildFrontmatter(fmFields);
  // Clean up the body - remove the ## Tracking heading if it's now empty
  const cleanBody = bodyLines.join("\n");
  return `${fm}\n${cleanBody}`;
}
