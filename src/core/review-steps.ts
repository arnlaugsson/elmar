import type { VaultAdapter } from "../adapters/adapter.js";
import { loadRegistry } from "./metric-registry.js";
import { getInlineField } from "./markdown-utils.js";
import { join } from "node:path";

export interface InboxItem {
  readonly text: string;
  readonly line: number;
}

export function parseInboxItems(content: string): InboxItem[] {
  const lines = content.split("\n");
  const items: InboxItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("- ") && line.trim().length > 2) {
      items.push({ text: line.trim().slice(2), line: i });
    }
  }
  return items;
}

export interface MetricAgg {
  readonly key: string;
  readonly label: string;
  readonly type: string;
  readonly avg?: number;
  readonly min?: number;
  readonly max?: number;
  readonly total?: number;
  readonly daysWithEntries?: number;
  readonly totalDays: number;
}

export async function aggregateMetrics(
  adapter: VaultAdapter,
  vaultPath: string,
  systemFolder: string,
  dates: string[]
): Promise<MetricAgg[]> {
  const registry = loadRegistry(join(vaultPath, systemFolder, "metrics.json"));
  const results: MetricAgg[] = [];

  for (const metric of registry.metrics) {
    const values: number[] = [];
    let daysWithEntries = 0;

    for (const date of dates) {
      const notePath = `Journal/${date}.md`;
      if (!(await adapter.noteExists(notePath))) continue;

      const content = await adapter.readNote(notePath);
      const val = getInlineField(content, metric.key);

      if (val !== null) {
        if (metric.type === "number") {
          const num = Number(val);
          if (!isNaN(num)) values.push(num);
        } else {
          daysWithEntries++;
        }
      }
    }

    if (metric.type === "number" && values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      results.push({
        key: metric.key,
        label: metric.label,
        type: metric.type,
        avg: Math.round(sum / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        total: sum,
        totalDays: dates.length,
      });
    } else {
      results.push({
        key: metric.key,
        label: metric.label,
        type: metric.type,
        daysWithEntries,
        totalDays: dates.length,
      });
    }
  }

  return results;
}

export function formatMetricsSummary(metrics: MetricAgg[]): string {
  const lines: string[] = [];
  for (const m of metrics) {
    if (m.type === "number" && m.avg !== undefined) {
      lines.push(`| ${m.label} | avg ${m.avg} | ${m.min}-${m.max} |`);
    } else if (m.type === "list" && m.total !== undefined) {
      lines.push(`| ${m.label} | ${m.total} items total | |`);
    } else if (m.daysWithEntries !== undefined) {
      lines.push(`| ${m.label} | ${m.daysWithEntries}/${m.totalDays} days | |`);
    }
  }
  return `| Metric | Value | Range |\n|--------|-------|-------|\n${lines.join("\n")}`;
}

export interface ProjectDecision {
  readonly name: string;
  readonly decision: string;
}

export interface ReviewReflections {
  readonly wentWell: string;
  readonly needsAttention: string;
  readonly nextFocus: string;
}

export interface WeeklyNoteData {
  readonly weekLabel: string;
  readonly projectDecisions: readonly ProjectDecision[];
  readonly metricsSummary: string;
  readonly reflections: ReviewReflections;
}

export function generateWeeklyNote(data: WeeklyNoteData): string {
  const projects = data.projectDecisions.length > 0
    ? data.projectDecisions.map((p) => `- **${p.name}**: ${p.decision}`).join("\n")
    : "No projects reviewed";

  return `# Weekly Review — ${data.weekLabel}

## Inbox Processed
- [x] All inbox items processed

## Projects Reviewed
${projects}

## Metrics Summary
${data.metricsSummary}

## Reflections
**What went well:** ${data.reflections.wentWell}

**Needs attention:** ${data.reflections.needsAttention}

## Next Week Focus
${data.reflections.nextFocus}
`;
}

export interface GoalStatus {
  readonly text: string;
  readonly status: string;
  readonly note: string;
}

export interface RoleScore {
  readonly text: string;
  readonly score: number;
  readonly note: string;
}

export interface AreaHealthScore {
  readonly area: string;
  readonly score: number;
}

export interface MonthlyNoteData {
  readonly monthLabel: string;
  readonly weeklyData: WeeklyNoteData;
  readonly goals: readonly GoalStatus[];
  readonly roles: readonly RoleScore[];
  readonly areaHealth: readonly AreaHealthScore[];
  readonly archived: readonly string[];
}

export function generateMonthlyNote(data: MonthlyNoteData): string {
  const goals = data.goals.length > 0
    ? data.goals.map((g) => `- **${g.text}**: ${g.status}${g.note ? ` — ${g.note}` : ""}`).join("\n")
    : "No goals defined";

  const roles = data.roles.length > 0
    ? data.roles.map((r) => `- **${r.text}**: ${r.score}/10${r.note ? ` — ${r.note}` : ""}`).join("\n")
    : "No roles defined";

  const areas = data.areaHealth.length > 0
    ? data.areaHealth.map((a) => `${a.area}:: ${a.score}`).join("\n")
    : "No areas scored";

  const archived = data.archived.length > 0
    ? data.archived.map((a) => `- ${a}`).join("\n")
    : "None";

  return `# Monthly Review — ${data.monthLabel}

## Goals Status
${goals}

## Role Presence
${roles}

## Area Health
${areas}

## Projects Archived
${archived}

## Reflections
**What went well:** ${data.weeklyData.reflections.wentWell}

**Needs attention:** ${data.weeklyData.reflections.needsAttention}

## Next Month Focus
${data.weeklyData.reflections.nextFocus}
`;
}

export function getDatesInRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function getWeekLabel(date: string): string {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.ceil((d.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function parseSectionItems(content: string, heading: string): string[] {
  const lines = content.split("\n");
  const items: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.trim() === heading) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("##")) break;
    if (inSection && line.trim().startsWith("- ") && line.trim().length > 2) {
      items.push(line.trim().slice(2));
    }
  }

  return items;
}
