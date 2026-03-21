import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadRegistry,
  validateMetricValue,
  getMetric,
} from "../../src/core/metric-registry.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("metric-registry", () => {
  const testDir = join(tmpdir(), "elmar-test-metrics-" + Date.now());
  const metricsPath = join(testDir, "metrics.json");

  const sampleRegistry = {
    metrics: [
      { key: "sleep", label: "Sleep", type: "number", range: [1, 100] },
      { key: "growth", label: "Growth", type: "text" },
      { key: "grateful", label: "Gratitude", type: "list" },
    ],
  };

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(metricsPath, JSON.stringify(sampleRegistry));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("loadRegistry", () => {
    it("loads metrics from file", () => {
      const registry = loadRegistry(metricsPath);
      expect(registry.metrics).toHaveLength(3);
      expect(registry.metrics[0].key).toBe("sleep");
    });
  });

  describe("getMetric", () => {
    it("finds metric by key", () => {
      const registry = loadRegistry(metricsPath);
      const metric = getMetric(registry, "sleep");
      expect(metric?.label).toBe("Sleep");
    });

    it("returns undefined for unknown key", () => {
      const registry = loadRegistry(metricsPath);
      expect(getMetric(registry, "unknown")).toBeUndefined();
    });
  });

  describe("validateMetricValue", () => {
    it("accepts number in range", () => {
      const metric = sampleRegistry.metrics[0];
      expect(() => validateMetricValue(metric as any, "85")).not.toThrow();
    });

    it("rejects number out of range", () => {
      const metric = sampleRegistry.metrics[0];
      expect(() => validateMetricValue(metric as any, "150")).toThrow(
        "sleep must be between 1-100"
      );
    });

    it("rejects non-numeric for number type", () => {
      const metric = sampleRegistry.metrics[0];
      expect(() => validateMetricValue(metric as any, "abc")).toThrow();
    });

    it("accepts any string for text type", () => {
      const metric = sampleRegistry.metrics[1];
      expect(() => validateMetricValue(metric as any, "Some text")).not.toThrow();
    });

    it("accepts any string for list type", () => {
      const metric = sampleRegistry.metrics[2];
      expect(() => validateMetricValue(metric as any, "An item")).not.toThrow();
    });
  });
});
