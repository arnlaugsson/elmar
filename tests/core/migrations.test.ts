import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  compareSemver,
  readVaultVersion,
  writeVaultVersion,
  collectPendingMigrations,
  applyNewFiles,
  applyFix,
} from "../../src/core/migrations.js";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("compareSemver", () => {
  it("returns 0 for equal versions", () => {
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
  });

  it("returns negative when a < b", () => {
    expect(compareSemver("0.1.0", "0.2.0")).toBeLessThan(0);
  });

  it("returns positive when a > b", () => {
    expect(compareSemver("1.0.0", "0.9.9")).toBeGreaterThan(0);
  });

  it("compares major > minor > patch", () => {
    expect(compareSemver("1.0.0", "0.99.99")).toBeGreaterThan(0);
    expect(compareSemver("0.2.0", "0.1.99")).toBeGreaterThan(0);
  });
});

describe("readVaultVersion", () => {
  const vaultPath = join(tmpdir(), "elmar-test-version-" + Date.now());

  beforeEach(() => {
    mkdirSync(join(vaultPath, "_System"), { recursive: true });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("returns 0.0.0 when version file missing", () => {
    const v = readVaultVersion(vaultPath, "_System");
    expect(v.version).toBe("0.0.0");
  });

  it("reads version from file", () => {
    writeFileSync(
      join(vaultPath, "_System", "elmar-version.json"),
      JSON.stringify({ version: "0.1.0", migratedAt: "2026-03-24" })
    );
    const v = readVaultVersion(vaultPath, "_System");
    expect(v.version).toBe("0.1.0");
  });
});

describe("writeVaultVersion", () => {
  const vaultPath = join(tmpdir(), "elmar-test-writeversion-" + Date.now());

  beforeEach(() => {
    mkdirSync(join(vaultPath, "_System"), { recursive: true });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("writes version file", () => {
    writeVaultVersion(vaultPath, "_System", "0.2.0");
    const raw = JSON.parse(readFileSync(join(vaultPath, "_System", "elmar-version.json"), "utf-8"));
    expect(raw.version).toBe("0.2.0");
    expect(raw.migratedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("migration runner", () => {
  const vaultPath = join(tmpdir(), "elmar-test-migrate-" + Date.now());

  beforeEach(() => {
    mkdirSync(join(vaultPath, "_System"), { recursive: true });
    mkdirSync(join(vaultPath, "1-Projects"), { recursive: true });
    writeFileSync(
      join(vaultPath, "_System", "metrics.json"),
      JSON.stringify({ metrics: [] })
    );
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it("detects new files that need adding", () => {
    const pending = collectPendingMigrations(vaultPath, "_System", "0.2.0");
    const missing = pending.newFiles.filter((f) => !f.exists);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].path).toBe("Home.md");
  });

  it("skips new files that already exist", () => {
    writeFileSync(join(vaultPath, "Home.md"), "# My Home");
    const pending = collectPendingMigrations(vaultPath, "_System", "0.2.0");
    const missing = pending.newFiles.filter((f) => !f.exists);
    expect(missing).toHaveLength(0);
  });

  it("detects content fixes needed", () => {
    writeFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      "# API\nStatus: active\nArea: work\n"
    );
    const pending = collectPendingMigrations(vaultPath, "_System", "0.2.0");
    expect(pending.fixes.length).toBeGreaterThan(0);
    expect(pending.fixes[0].files.length).toBe(1);
  });

  it("skips fixes when pattern doesn't match", () => {
    writeFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      "# API\nStatus:: active\nArea:: work\n"
    );
    const pending = collectPendingMigrations(vaultPath, "_System", "0.2.0");
    expect(pending.fixes).toHaveLength(0);
  });

  it("applies new files from vault-template", () => {
    const added = applyNewFiles(vaultPath, ["Home.md"]);
    expect(added).toContain("Home.md");
    expect(existsSync(join(vaultPath, "Home.md"))).toBe(true);
  });

  it("applies content fix correctly", () => {
    writeFileSync(
      join(vaultPath, "1-Projects", "work--api.md"),
      "# API\nStatus: active\nArea: work\n"
    );
    const pending = collectPendingMigrations(vaultPath, "_System", "0.2.0");
    const count = applyFix(pending.fixes[0]);
    expect(count).toBe(1);
    const content = readFileSync(join(vaultPath, "1-Projects", "work--api.md"), "utf-8");
    expect(content).toContain("Status:: active");
    expect(content).toContain("Area:: work");
  });

  it("reports already up to date when version matches", () => {
    writeVaultVersion(vaultPath, "_System", "0.2.0");
    const pending = collectPendingMigrations(vaultPath, "_System", "0.2.0");
    expect(pending.newFiles).toHaveLength(0);
    expect(pending.fixes).toHaveLength(0);
  });
});
