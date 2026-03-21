import { cpSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ElmarConfig } from "../core/types.js";
import { CONFIG_DEFAULTS } from "../core/config.js";

function getVaultTemplatePath(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return resolve(dirname(thisFile), "..", "..", "vault-template");
}

export async function runInit(
  vaultPath: string,
  configPath: string
): Promise<void> {
  if (existsSync(vaultPath)) {
    throw new Error(
      `Vault path "${vaultPath}" already exists. Choose a different location or delete it first.`
    );
  }

  const templatePath = getVaultTemplatePath();

  cpSync(templatePath, vaultPath, { recursive: true });

  const config: ElmarConfig = {
    ...CONFIG_DEFAULTS,
    vaultPath,
  };

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
