import type { VaultAdapter } from "../adapters/adapter.js";

export async function runCapture(
  adapter: VaultAdapter,
  inboxPath: string,
  text: string
): Promise<void> {
  if (!(await adapter.noteExists(inboxPath))) {
    await adapter.createNote(inboxPath, "# Inbox\n\n");
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const entry = `- ${text} *(${timestamp})*`;

  const content = await adapter.readNote(inboxPath);
  await adapter.writeNote(inboxPath, content.trimEnd() + "\n" + entry + "\n");
}
