import { existsSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface MigrationFix {
  readonly description: string;
  readonly glob: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

export interface Migration {
  readonly version: string;
  readonly newFiles: readonly string[];
  readonly fixes: readonly MigrationFix[];
}

export interface MigrationResult {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly addedFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly appliedFixes: readonly { readonly description: string; readonly fileCount: number }[];
}

export interface VaultVersion {
  readonly version: string;
  readonly migratedAt: string;
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function readVaultVersion(vaultPath: string, systemFolder: string): VaultVersion {
  const versionPath = join(vaultPath, systemFolder, "elmar-version.json");
  if (!existsSync(versionPath)) {
    return { version: "0.0.0", migratedAt: "" };
  }
  const raw = JSON.parse(readFileSync(versionPath, "utf-8"));
  return { version: raw.version ?? "0.0.0", migratedAt: raw.migratedAt ?? "" };
}

export function writeVaultVersion(vaultPath: string, systemFolder: string, version: string): void {
  const versionPath = join(vaultPath, systemFolder, "elmar-version.json");
  const data: VaultVersion = {
    version,
    migratedAt: new Date().toISOString().slice(0, 10),
  };
  writeFileSync(versionPath, JSON.stringify(data, null, 2) + "\n");
}

export function getCliVersion(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const pkgPath = resolve(dirname(thisFile), "..", "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

function getVaultTemplatePath(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return resolve(dirname(thisFile), "..", "..", "vault-template");
}

function collectMatchingFiles(basePath: string, globPattern: string): string[] {
  const parts = globPattern.split("/");
  const results: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth >= parts.length) return;

    const part = parts[depth];
    const isLast = depth === parts.length - 1;

    if (part === "**") {
      if (isLast) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subdir = join(dir, entry.name);
          walk(subdir, depth);
          walk(subdir, depth + 1);
        }
        if (entry.isFile() && isLast) {
          results.push(join(dir, entry.name));
        }
      }
      // Also try matching next part at current depth
      walk(dir, depth + 1);
      return;
    }

    if (isLast) {
      const regex = new RegExp("^" + part.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && regex.test(entry.name)) {
          results.push(join(dir, entry.name));
        }
      }
      return;
    }

    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const regex = new RegExp("^" + part.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
        if (regex.test(entry.name)) {
          walk(join(dir, entry.name), depth + 1);
        }
      }
    }
  }

  walk(basePath, 0);
  return [...new Set(results)];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: "0.2.0",
    newFiles: ["Home.md"],
    fixes: [
      {
        description: "Update Status: to Status:: for Dataview compatibility",
        glob: "1-Projects/**/*.md",
        pattern: /^(Status|Area|Outcome|Deadline): /gm,
        replacement: "$1:: ",
      },
    ],
  },
];

export interface PendingFix {
  readonly description: string;
  readonly files: readonly string[];
  readonly pattern: RegExp;
  readonly replacement: string;
}

export function collectPendingMigrations(
  vaultPath: string,
  systemFolder: string,
  cliVersion: string
): {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly newFiles: readonly { readonly path: string; readonly exists: boolean }[];
  readonly fixes: readonly PendingFix[];
} {
  const vaultVersion = readVaultVersion(vaultPath, systemFolder);
  const applicable = MIGRATIONS.filter((m) => compareSemver(m.version, vaultVersion.version) > 0);

  const newFiles: { path: string; exists: boolean }[] = [];
  for (const migration of applicable) {
    for (const file of migration.newFiles) {
      const fullPath = join(vaultPath, file);
      newFiles.push({ path: file, exists: existsSync(fullPath) });
    }
  }

  const fixes: PendingFix[] = [];
  for (const migration of applicable) {
    for (const fix of migration.fixes) {
      const matchingFiles = collectMatchingFiles(vaultPath, fix.glob);
      const affectedFiles: string[] = [];
      for (const filePath of matchingFiles) {
        const content = readFileSync(filePath, "utf-8");
        if (fix.pattern.test(content)) {
          affectedFiles.push(filePath);
        }
        fix.pattern.lastIndex = 0;
      }
      if (affectedFiles.length > 0) {
        fixes.push({
          description: fix.description,
          files: affectedFiles,
          pattern: fix.pattern,
          replacement: fix.replacement,
        });
      }
    }
  }

  return {
    fromVersion: vaultVersion.version,
    toVersion: cliVersion,
    newFiles,
    fixes,
  };
}

export function applyNewFiles(vaultPath: string, filesToAdd: readonly string[]): readonly string[] {
  const templatePath = getVaultTemplatePath();
  const added: string[] = [];

  for (const file of filesToAdd) {
    const src = join(templatePath, file);
    const dest = join(vaultPath, file);
    if (!existsSync(dest) && existsSync(src)) {
      cpSync(src, dest);
      added.push(file);
    }
  }

  return added;
}

export function applyFix(fix: PendingFix): number {
  let count = 0;
  for (const filePath of fix.files) {
    const content = readFileSync(filePath, "utf-8");
    fix.pattern.lastIndex = 0;
    const updated = content.replace(fix.pattern, fix.replacement);
    if (updated !== content) {
      writeFileSync(filePath, updated);
      count++;
    }
  }
  return count;
}
