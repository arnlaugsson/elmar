import { join } from "node:path";
import type { VaultAdapter } from "../adapters/adapter.js";
import {
  loadRegistry,
  getMetric,
  validateMetricValue,
} from "../core/metric-registry.js";
import { setInlineField } from "../core/markdown-utils.js";
import { countBullets } from "../core/daily-note.js";

export async function runLog(
  adapter: VaultAdapter,
  vaultPath: string,
  systemFolder: string,
  key: string,
  value: string,
  date: string
): Promise<void> {
  const registryPath = join(vaultPath, systemFolder, "metrics.json");
  const registry = loadRegistry(registryPath);
  const metric = getMetric(registry, key);

  if (!metric) {
    const available = registry.metrics.map((m) => m.key).join(", ");
    throw new Error(
      `Unknown metric '${key}'. Available: ${available}`
    );
  }

  validateMetricValue(metric, value);

  const notePath = await adapter.ensureDailyNote(date);
  let content = await adapter.readNote(notePath);

  if (metric.type === "list") {
    const sectionHeading = `## ${metric.label}`;
    const lines = content.split("\n");
    const headingIdx = lines.findIndex(
      (l) => l.trim() === sectionHeading
    );

    if (headingIdx >= 0) {
      let insertAt = headingIdx + 1;
      for (let i = headingIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("#")) break;
        if (lines[i].trim().startsWith("- ") && lines[i].trim().length > 2) {
          insertAt = i + 1;
        } else if (lines[i].trim() === "-") {
          insertAt = i;
          lines.splice(i, 1);
          break;
        }
      }
      lines.splice(insertAt, 0, `- ${value}`);
      content = lines.join("\n");
    }

    const bulletCount = countBullets(content, sectionHeading);
    content = setInlineField(content, key, String(bulletCount));
  } else {
    content = setInlineField(content, key, value);
  }

  await adapter.writeNote(notePath, content);
}
