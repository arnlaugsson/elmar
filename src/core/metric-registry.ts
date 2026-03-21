import { readFileSync } from "node:fs";
import type { MetricDef, MetricRegistry } from "./types.js";

export function loadRegistry(path: string): MetricRegistry {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return { metrics: raw.metrics };
}

export function getMetric(
  registry: MetricRegistry,
  key: string
): MetricDef | undefined {
  return registry.metrics.find((m) => m.key === key);
}

export function validateMetricValue(
  metric: MetricDef,
  value: string
): void {
  if (metric.type === "number") {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(
        `${metric.key} must be a number, got "${value}"`
      );
    }
    if (metric.range) {
      const [min, max] = metric.range;
      if (num < min || num > max) {
        throw new Error(
          `${metric.key} must be between ${min}-${max}, got ${num}`
        );
      }
    }
  }
}
