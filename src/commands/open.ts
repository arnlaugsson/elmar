import type { VaultAdapter } from "../adapters/adapter.js";
import type { ElmarConfig } from "../core/types.js";
import { listProjects } from "./projects.js";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { select } from "@inquirer/prompts";
import chalk from "chalk";

export async function runOpen(
  adapter: VaultAdapter,
  config: ElmarConfig,
  query: string | undefined,
  opts: { obsidian?: boolean }
): Promise<void> {
  const projects = await listProjects(adapter, {});
  if (projects.length === 0) {
    console.log(chalk.dim("No projects found."));
    return;
  }

  let match: string | undefined;

  if (query) {
    const lower = query.toLowerCase();
    const found = projects.filter((p) => p.name.toLowerCase().includes(lower));
    if (found.length === 0) {
      console.log(chalk.red(`No project matching "${query}".`));
      return;
    }
    if (found.length === 1) {
      match = found[0].path;
    } else {
      match = await select({
        message: "Multiple matches:",
        choices: found.map((p) => ({ value: p.path, name: `[${p.area}] ${p.name}` })),
      });
    }
  } else {
    match = await select({
      message: "Open project:",
      choices: projects.map((p) => ({ value: p.path, name: `[${p.area}] ${p.name}` })),
    });
  }

  const fullPath = join(config.vaultPath, match);

  if (opts.obsidian) {
    const vaultName = config.vaultPath.split("/").pop() ?? "vault";
    const encodedPath = encodeURIComponent(match);
    const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodedPath}`;
    execSync(`open "${uri}"`);
    console.log(chalk.green(`Opened in Obsidian: ${match}`));
  } else {
    const editor = process.env.EDITOR ?? "vim";
    execSync(`${editor} "${fullPath}"`, { stdio: "inherit" });
  }
}
