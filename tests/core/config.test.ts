import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/core/config.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadConfig", () => {
  const testDir = join(tmpdir(), "elmar-test-config-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    delete process.env.ELMAR_CONFIG;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    delete process.env.ELMAR_CONFIG;
  });

  it("loads config from ELMAR_CONFIG env var", () => {
    const configPath = join(testDir, "custom.json");
    writeFileSync(configPath, JSON.stringify({ vaultPath: "/test/vault" }));
    process.env.ELMAR_CONFIG = configPath;

    const config = loadConfig();
    expect(config.vaultPath).toBe("/test/vault");
  });

  it("applies defaults for missing fields", () => {
    const configPath = join(testDir, "minimal.json");
    writeFileSync(configPath, JSON.stringify({ vaultPath: "/test/vault" }));
    process.env.ELMAR_CONFIG = configPath;

    const config = loadConfig();
    expect(config.inboxFile).toBe("0-Inbox/inbox.md");
    expect(config.dailyNotesFolder).toBe("Journal");
    expect(config.areas).toEqual(["work", "personal", "family", "finance"]);
  });

  it("throws when no config found", () => {
    process.env.ELMAR_CONFIG = join(testDir, "nonexistent.json");
    expect(() => loadConfig()).toThrow("No config found");
  });

  it("expands ~ in vaultPath", () => {
    const configPath = join(testDir, "tilde.json");
    writeFileSync(configPath, JSON.stringify({ vaultPath: "~/MyVault" }));
    process.env.ELMAR_CONFIG = configPath;

    const config = loadConfig();
    expect(config.vaultPath).not.toContain("~");
    expect(config.vaultPath).toContain("MyVault");
  });
});
