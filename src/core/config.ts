import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ElmarConfig } from "./types.js";

export const CONFIG_DEFAULTS: Omit<ElmarConfig, "vaultPath"> = {
  inboxFile: "0-Inbox/inbox.md",
  dailyNotesFolder: "Journal",
  weeklyNotesFolder: "Journal/weekly",
  templatesFolder: "Templates",
  systemFolder: "_System",
  areas: ["work", "personal", "family", "finance"],
};

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return join(homedir(), filepath.slice(1));
  }
  return filepath;
}

function findConfigPath(): string | null {
  // 1. Environment variable
  const envPath = process.env.ELMAR_CONFIG;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }
  if (envPath) {
    return null; // Env var set but file doesn't exist
  }

  // 2. Home directory
  const homePath = join(homedir(), ".elmar.config.json");
  if (existsSync(homePath)) {
    return homePath;
  }

  // 3. Current directory
  const localPath = resolve(".elmar.config.json");
  if (existsSync(localPath)) {
    return localPath;
  }

  return null;
}

export function loadConfig(): ElmarConfig {
  const configPath = findConfigPath();
  if (!configPath) {
    throw new Error(
      "No config found. Run `elmar init` to set up Elmar."
    );
  }

  const raw = JSON.parse(readFileSync(configPath, "utf-8"));

  if (!raw.vaultPath) {
    throw new Error(
      "Config is missing vaultPath. Update your config file."
    );
  }

  return {
    ...CONFIG_DEFAULTS,
    ...raw,
    vaultPath: expandHome(raw.vaultPath),
  };
}
