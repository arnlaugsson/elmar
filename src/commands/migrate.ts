import type { ElmarConfig } from "../core/types.js";
import {
  collectPendingMigrations,
  applyNewFiles,
  applyFix,
  writeVaultVersion,
  getCliVersion,
  compareSemver,
  readVaultVersion,
} from "../core/migrations.js";
import { existsSync } from "node:fs";
import chalk from "chalk";
import inquirer from "inquirer";

export async function runMigrate(
  config: ElmarConfig,
  opts: { dryRun?: boolean; yes?: boolean }
): Promise<void> {
  const { vaultPath, systemFolder } = config;

  if (!existsSync(vaultPath)) {
    throw new Error(`Vault not found at ${vaultPath}. Run 'elmar init' first.`);
  }

  const cliVersion = getCliVersion();
  const vaultVersion = readVaultVersion(vaultPath, systemFolder);

  if (compareSemver(vaultVersion.version, cliVersion) >= 0) {
    console.log(chalk.green(`Vault is already at v${vaultVersion.version}. Nothing to do.`));
    return;
  }

  const pending = collectPendingMigrations(vaultPath, systemFolder, cliVersion);

  const prefix = opts.dryRun ? "Elmar Migrate — dry run" : "Elmar Migrate";
  console.log(chalk.bold(`${prefix} (${pending.fromVersion} → ${pending.toVersion})\n`));

  // Phase 1: New files
  const filesToAdd = pending.newFiles.filter((f) => !f.exists).map((f) => f.path);

  if (opts.dryRun) {
    if (filesToAdd.length > 0) {
      console.log("Would add:");
      for (const file of filesToAdd) {
        console.log(`  - ${file}`);
      }
    } else {
      console.log(chalk.dim("No new files to add."));
    }

    if (pending.fixes.length > 0) {
      console.log("\nAvailable fixes:");
      for (let i = 0; i < pending.fixes.length; i++) {
        const fix = pending.fixes[i];
        console.log(`  ${i + 1}. ${fix.description} (${fix.files.length} files)`);
      }
    }

    console.log(chalk.dim("\nNo changes made."));
    return;
  }

  // Apply new files
  if (filesToAdd.length > 0) {
    const added = applyNewFiles(vaultPath, filesToAdd);
    console.log("Added:");
    for (const file of added) {
      console.log(chalk.green(`  ✓ ${file}`));
    }
  } else {
    console.log(chalk.dim("No new files to add."));
  }

  // Phase 2: Fixes
  if (pending.fixes.length > 0) {
    console.log("\nAvailable fixes:");
    for (let i = 0; i < pending.fixes.length; i++) {
      const fix = pending.fixes[i];
      console.log(`  ${i + 1}. ${fix.description} (${fix.files.length} files)`);
    }

    let selectedIndices: number[] = [];

    if (opts.yes) {
      selectedIndices = pending.fixes.map((_, i) => i);
    } else {
      const { choice } = await inquirer.prompt([
        {
          type: "input",
          name: "choice",
          message: "Apply fixes? [1,2,..., all, none]:",
          default: "all",
        },
      ]);

      const trimmed = choice.trim().toLowerCase();
      if (trimmed === "all") {
        selectedIndices = pending.fixes.map((_, i) => i);
      } else if (trimmed === "none" || trimmed === "") {
        selectedIndices = [];
      } else {
        selectedIndices = trimmed
          .split(",")
          .map((s: string) => parseInt(s.trim(), 10) - 1)
          .filter((n: number) => !isNaN(n) && n >= 0 && n < pending.fixes.length);
      }
    }

    for (const idx of selectedIndices) {
      const fix = pending.fixes[idx];
      const count = applyFix(fix);
      console.log(chalk.green(`  ✓ Applied fix ${idx + 1} to ${count} files`));
    }
  }

  // Update version
  writeVaultVersion(vaultPath, systemFolder, cliVersion);
  console.log(chalk.green(`\nUpdated vault to v${cliVersion}.`));
}
