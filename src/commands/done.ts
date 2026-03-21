import type { VaultAdapter } from "../adapters/adapter.js";

export async function runDone(
  adapter: VaultAdapter,
  vaultPath: string,
  searchText: string
): Promise<{ file: string; task: string }> {
  const scanFolders = ["1-Projects", "2-Areas"];
  const normalizedSearch = searchText.toLowerCase();

  for (const folder of scanFolders) {
    const files = await adapter.listFiles(folder);
    for (const file of files) {
      const content = await adapter.readNote(file);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.match(/^- \[ \]/) &&
          line.toLowerCase().includes(normalizedSearch)
        ) {
          const updated = [...lines];
          updated[i] = line.replace("- [ ]", "- [x]");
          await adapter.writeNote(file, updated.join("\n"));
          return { file, task: line.trim() };
        }
      }
    }
  }

  throw new Error(
    `No matching task found for "${searchText}"`
  );
}
