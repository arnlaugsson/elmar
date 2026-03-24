const DUE_DATE_REGEX = /📅\s*(\d{4}-\d{2}-\d{2})/;

export function parseDueDate(line: string): string | null {
  const match = line.match(DUE_DATE_REGEX);
  return match ? match[1] : null;
}

export function snoozeDueDate(line: string, newDate: string): string {
  if (DUE_DATE_REGEX.test(line)) {
    return line.replace(DUE_DATE_REGEX, `📅 ${newDate}`);
  }
  return `${line} 📅 ${newDate}`;
}
