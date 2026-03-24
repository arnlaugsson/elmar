# Elmar Migrate Design

## Goal

Add an `elmar migrate` command that upgrades existing vaults to the latest version — adding new template files automatically and offering optional content fixes interactively.

## Architecture

Version-based migrations. A version file in the vault tracks what version it was last migrated to. A migration registry in the CLI defines what changed per version. `elmar migrate` runs all migrations newer than the vault's version in two phases: auto-add new files, then offer optional fixes.

## Files

- **Create:** `src/core/migrations.ts` — migration registry and runner logic
- **Create:** `src/commands/migrate.ts` — CLI command handler
- **Modify:** `src/commands/init.ts` — write version file on init
- **Modify:** `src/index.ts` — wire up migrate command
- **Create:** `vault-template/_System/elmar-version.json` — placeholder (overwritten by init)

## Version Tracking

### Version file

`_System/elmar-version.json` in the vault:

```json
{
  "version": "0.1.0",
  "migratedAt": "2026-03-24"
}
```

- `elmar init` writes this file with the current CLI version when creating a new vault
- `elmar migrate` reads this file to determine what migrations to run
- Vaults without this file are treated as version `0.0.0` (pre-versioning)
- Updated to the current CLI version after a successful migration

### CLI version

Read from `package.json` at runtime using `readFileSync` and `JSON.parse` (resolving relative to `import.meta.url`). This is the target version for migrations. Also update `src/index.ts` to use the same mechanism instead of the hardcoded `.version("0.1.0")` string.

## Migration Registry

`src/core/migrations.ts` exports an array of migration definitions, ordered by version:

```typescript
interface MigrationFix {
  readonly description: string;
  readonly glob: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

interface Migration {
  readonly version: string;
  readonly newFiles: readonly string[];
  readonly fixes: readonly MigrationFix[];
}
```

Each migration defines:
- `version` — the version this migration brings the vault to
- `newFiles` — paths relative to vault root, copied from vault-template if they don't exist in the vault
- `fixes` — content patches applied to matching files (only if user approves)

### Initial migration (0.1.0)

```typescript
{
  version: "0.1.0",
  newFiles: ["Home.md"],
  fixes: [
    {
      description: "Update Status: to Status:: for Dataview compatibility",
      glob: "1-Projects/**/*.md",
      pattern: /^(Status|Area|Outcome|Deadline): /gm,
      replacement: "$1:: ",
    },
  ],
}
```

## Command: `elmar migrate`

### Options

- `--dry-run` — preview what would change without modifying the vault. Skips the interactive prompt entirely.
- `--yes` — apply all fixes without prompting (for scripting/CI)

### Flow

1. Load config, resolve vault path
2. Read `_System/elmar-version.json` (default to `0.0.0` if missing)
3. Read CLI version from package.json
4. If vault version >= CLI version: print "Already up to date" and exit
5. Collect all migrations where `migration.version > vaultVersion`
6. **Phase 1 — Auto (new files):**
   - For each migration, for each file in `newFiles`:
     - If file does not exist in vault: copy from vault-template, report as added
     - If file exists: skip silently
7. **Phase 2 — Interactive (fixes):**
   - Collect all fixes from applicable migrations
   - For each fix: scan matching files, count how many would be affected
   - Display numbered list with descriptions and file counts
   - Prompt: "Apply fixes? [1,2, all, none]"
   - Apply selected fixes (read file, replace, write back)
8. Write updated `_System/elmar-version.json` with CLI version and current date
9. Print summary

### Output format

```
Elmar Migrate (0.0.0 → 0.2.0)

Added:
  ✓ Home.md

Available fixes:
  1. Update Status: to Status:: for Dataview compatibility (3 files)

Apply fixes? [1, all, none]: all

  ✓ Applied fix 1 to 3 files

Updated vault to v0.2.0.
```

### Dry run output

```
Elmar Migrate — dry run (0.0.0 → 0.2.0)

Would add:
  - Home.md

Available fixes:
  1. Update Status: to Status:: for Dataview compatibility (3 files)

No changes made.
```

## Changes to `elmar init`

After copying the vault template, also write `_System/elmar-version.json` with:
```json
{
  "version": "<current CLI version>",
  "migratedAt": "<today's date>"
}
```

The vault-template includes a placeholder `_System/elmar-version.json` with `"version": "0.0.0"`. `elmar init` overwrites it with the actual CLI version after copying. This keeps `init` as the single source of truth for the version.

## Edge Cases

- **No config** — same error as other commands: "Config not found"
- **Vault doesn't exist** — error: "Vault not found at <path>. Run `elmar init` first."
- **No version file** — treat as `0.0.0`, proceed with all migrations
- **Already up to date** — "Vault is already at v<version>. Nothing to do."
- **Partial failure** — Phase 1 file copy errors are reported but non-fatal (skip the file, warn, continue). Phase 2 fix errors report which files failed and continue with remaining files. The version file is still updated after partial completion because re-running migrate is safe (new files skip if present, regex fixes are idempotent).
- **Fix pattern matches nothing** — skip silently, don't count as affected
- **Old 0.1.0 vaults** — Existing vaults created before version tracking was added are treated as `0.0.0` regardless of when they were created. All migrations are designed to be safe to run on already-conforming vaults (new files skip if present, regex fixes are idempotent).
- **Invalid prompt input** — re-prompt on invalid input (e.g., number out of range, unrecognized text)

## Version Comparison

Use semver comparison. Versions MUST be plain `MAJOR.MINOR.PATCH` format only — no pre-release or build metadata suffixes. Compare using a simple split-and-compare function — no need for a semver library.

For file matching in `MigrationFix.glob`, use `node:fs` `readdirSync` with simple path matching (the initial patterns are straightforward like `1-Projects/**/*.md`). No glob library needed for now.

## Testing

- **Unit tests for migration runner:**
  - Applies new files when missing
  - Skips new files when they exist
  - Applies content fixes correctly
  - Skips fixes when pattern doesn't match
  - Updates version file after migration
  - Reports "already up to date" when version matches
- **Unit tests for version comparison:**
  - Basic semver ordering (0.1.0 < 0.2.0 < 1.0.0)
- **Integration test:**
  - Create a vault at 0.0.0, run migrate, verify files added and version updated

## Out of Scope

- No rollback/undo mechanism
- No migration for config file changes (only vault content)
- No automatic migration on other commands (user must run `elmar migrate` explicitly)
