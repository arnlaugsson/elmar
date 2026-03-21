import type { SearchResult } from "../core/types.js";

export interface VaultAdapter {
  readNote(path: string): Promise<string>;
  writeNote(path: string, content: string): Promise<void>;
  appendToSection(path: string, section: string, content: string): Promise<void>;
  createNote(path: string, content: string): Promise<void>;
  moveNote(from: string, to: string): Promise<void>;
  deleteNote(path: string): Promise<void>;
  noteExists(path: string): Promise<boolean>;
  listFiles(folder: string, pattern?: string): Promise<string[]>;
  searchContent(query: string): Promise<SearchResult[]>;
  ensureDailyNote(date: string): Promise<string>;
}
