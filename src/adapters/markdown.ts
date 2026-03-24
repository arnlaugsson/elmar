import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  renameSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";
import type { VaultAdapter } from "./adapter.js";
import type { SearchResult } from "../core/types.js";
import { appendToSection as appendToSectionUtil } from "../core/markdown-utils.js";
import { linkDailyNote } from "../core/daily-note.js";

interface MarkdownAdapterOptions {
  readonly dailyNotesFolder: string;
  readonly templatesFolder: string;
  readonly systemFolder: string;
  readonly monthlyNotesFolder: string;
}

export class MarkdownAdapter implements VaultAdapter {
  constructor(
    private readonly vaultPath: string,
    private readonly options: MarkdownAdapterOptions
  ) {}

  private resolve(path: string): string {
    return join(this.vaultPath, path);
  }

  async readNote(path: string): Promise<string> {
    return readFileSync(this.resolve(path), "utf-8");
  }

  async writeNote(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  async appendToSection(
    path: string,
    section: string,
    content: string
  ): Promise<void> {
    const current = await this.readNote(path);
    const updated = appendToSectionUtil(current, section, content);
    await this.writeNote(path, updated);
  }

  async createNote(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  async moveNote(from: string, to: string): Promise<void> {
    const toFull = this.resolve(to);
    mkdirSync(dirname(toFull), { recursive: true });
    renameSync(this.resolve(from), toFull);
  }

  async deleteNote(path: string): Promise<void> {
    unlinkSync(this.resolve(path));
  }

  async noteExists(path: string): Promise<boolean> {
    return existsSync(this.resolve(path));
  }

  async listFiles(folder: string, pattern?: string): Promise<string[]> {
    const fullPath = this.resolve(folder);
    if (!existsSync(fullPath)) return [];

    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          walk(entryPath);
        } else if (entry.endsWith(".md")) {
          const relPath = relative(this.vaultPath, entryPath);
          if (!pattern || relPath.includes(pattern)) {
            files.push(relPath);
          }
        }
      }
    };
    walk(fullPath);
    return files;
  }

  async searchContent(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const excludeFolders = new Set([".obsidian", "_System", "Templates"]);

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        if (excludeFolders.has(entry)) continue;
        const entryPath = join(dir, entry);
        const stat = statSync(entryPath);
        if (stat.isDirectory()) {
          walk(entryPath);
        } else if (entry.endsWith(".md")) {
          const content = readFileSync(entryPath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              results.push({
                path: relative(this.vaultPath, entryPath),
                line: i,
                text: lines[i],
                context: lines.slice(Math.max(0, i - 1), i + 2).join("\n"),
              });
            }
          }
        }
      }
    };
    walk(this.vaultPath);
    return results;
  }

  async ensureDailyNote(date: string): Promise<string> {
    const notePath = `${this.options.dailyNotesFolder}/${date}.md`;
    if (await this.noteExists(notePath)) {
      return notePath;
    }

    const templatePath = this.resolve(
      join(this.options.templatesFolder, "daily-note-cli.md")
    );
    let template = readFileSync(templatePath, "utf-8");
    template = template.replace(/\{\{date\}\}/g, date);

    const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dow = DOW_NAMES[new Date(date + "T12:00:00").getDay()];
    template = template.replace(/\{\{dow\}\}/g, dow);

    const registryPath = this.resolve(
      join(this.options.systemFolder, "metrics.json")
    );
    if (existsSync(registryPath)) {
      const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
      const trackingFields = registry.metrics
        .map((m: { key: string }) => `${m.key}::`)
        .join("\n");
      template = template.replace("{{tracking_fields}}", trackingFields);
    }

    await this.createNote(notePath, template);
    await linkDailyNote(
      this,
      this.options.dailyNotesFolder,
      this.options.monthlyNotesFolder,
      date
    );
    return notePath;
  }
}
