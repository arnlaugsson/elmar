import type { VaultAdapter } from "../adapters/adapter.js";
import type { MetricRegistry } from "../core/types.js";
import { loadRegistry } from "../core/metric-registry.js";
import { getFrontmatterField } from "../core/markdown-utils.js";
import { getDatesInRange } from "../core/review-steps.js";
import { join } from "node:path";
import chalk from "chalk";

const SPARK_CHARS = "▁▂▃▄▅▆▇█";

function sparkline(values: readonly (number | null)[]): string {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return values
    .map((v) => {
      if (v === null) return chalk.dim("·");
      const idx = Math.round(((v - min) / range) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[idx];
    })
    .join("");
}

interface DayData {
  readonly date: string;
  readonly content: string | null;
}

async function loadDayData(
  adapter: VaultAdapter,
  dates: readonly string[]
): Promise<readonly DayData[]> {
  const results: DayData[] = [];
  for (const date of dates) {
    const notePath = `Journal/${date}.md`;
    const exists = await adapter.noteExists(notePath);
    results.push({
      date,
      content: exists ? await adapter.readNote(notePath) : null,
    });
  }
  return results;
}

export async function runMetrics(
  adapter: VaultAdapter,
  vaultPath: string,
  systemFolder: string,
  days: number,
  registryOverride?: MetricRegistry
): Promise<void> {
  const registry =
    registryOverride ?? loadRegistry(join(vaultPath, systemFolder, "metrics.json"));
  const today = new Date().toISOString().slice(0, 10);
  const dates = getDatesInRange(today, days);
  const dayData = await loadDayData(adapter, dates);

  const daysWithNotes = dayData.filter((d) => d.content !== null).length;
  if (daysWithNotes === 0) {
    console.log(chalk.dim(`No daily notes found in the last ${days} days.`));
    return;
  }

  const labelWidth = Math.max(...registry.metrics.map((m) => m.label.length)) + 2;

  console.log(
    chalk.bold(`Metrics — last ${days} days`) +
      chalk.dim(` (${dates[0]} → ${dates[dates.length - 1]})`)
  );
  console.log();

  for (const metric of registry.metrics) {
    const label = chalk.cyan(metric.label.padEnd(labelWidth));

    if (metric.type === "number") {
      const values = dayData.map((d) => {
        if (d.content === null) return null;
        const raw = getFrontmatterField(d.content, metric.key);
        if (raw === null) return null;
        const num = Number(raw);
        return isNaN(num) ? null : num;
      });

      const filled = values.filter((v): v is number => v !== null);
      if (filled.length === 0) {
        console.log(`  ${label} ${chalk.dim("no data")}`);
        continue;
      }

      const avg = Math.round(filled.reduce((a, b) => a + b, 0) / filled.length);
      const min = Math.min(...filled);
      const max = Math.max(...filled);
      const unit = metric.unit ? ` ${metric.unit}` : "";
      const spark = sparkline(values);

      console.log(
        `  ${label} ${spark}  ` +
          `avg ${chalk.bold(String(avg))}${unit}  ` +
          chalk.dim(`${min}–${max}`) +
          chalk.dim(`  (${filled.length}/${days}d)`)
      );
    } else {
      const filledDays = dayData.filter((d) => {
        if (d.content === null) return false;
        return getFrontmatterField(d.content, metric.key) !== null;
      }).length;

      const bar = dayData
        .map((d) => {
          if (d.content === null) return chalk.dim("·");
          const val = getFrontmatterField(d.content, metric.key);
          return val !== null ? chalk.green("■") : chalk.dim("·");
        })
        .join("");

      console.log(
        `  ${label} ${bar}  ` + chalk.dim(`${filledDays}/${days} days`)
      );
    }
  }
}
