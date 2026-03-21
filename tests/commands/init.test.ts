import { describe, it, expect, afterEach } from "vitest";
import { runInit } from "../../src/commands/init.js";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("runInit", () => {
  const testVaultPath = join(tmpdir(), "elmar-test-init-vault-" + Date.now());
  const configPath = join(tmpdir(), "elmar-test-init-config-" + Date.now() + ".json");

  afterEach(() => {
    rmSync(testVaultPath, { recursive: true, force: true });
    rmSync(configPath, { force: true });
  });

  it("copies vault template to target path", async () => {
    await runInit(testVaultPath, configPath);
    expect(existsSync(join(testVaultPath, "0-Inbox", "inbox.md"))).toBe(true);
    expect(existsSync(join(testVaultPath, "_System", "metrics.json"))).toBe(true);
    expect(existsSync(join(testVaultPath, "Templates", "daily-note.md"))).toBe(true);
  });

  it("creates config file pointing to vault", async () => {
    await runInit(testVaultPath, configPath);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.vaultPath).toBe(testVaultPath);
  });

  it("does not overwrite existing vault", async () => {
    await runInit(testVaultPath, configPath);
    await expect(runInit(testVaultPath, configPath)).rejects.toThrow("already exists");
  });
});
