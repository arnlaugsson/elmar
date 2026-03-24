import type { VaultAdapter } from "../adapters/adapter.js";
import type { ElmarConfig } from "../core/types.js";
import { select, input } from "../core/prompt.js";

export async function runNewProject(
  adapter: VaultAdapter,
  config: ElmarConfig,
  name: string,
  options: { area?: string }
): Promise<string> {
  const area =
    options.area ??
    await select({
      message: "Which area does this project belong to?",
      choices: config.areas.map((a) => ({ value: a, name: a })),
    });

  const outcome = await input({ message: "What's the desired outcome?" });

  const firstAction = await input({
    message: "What's the first next action?",
    default: `Define scope for ${name}`,
  });

  const deadline = await input({
    message: "Deadline? (YYYY-MM-DD or leave empty)",
  });

  const context = await input({
    message: "Any initial notes or context?",
  });

  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const filename = `${area}--${slug}.md`;
  const filepath = `1-Projects/${filename}`;
  const today = new Date().toISOString().slice(0, 10);

  const deadlineLine = deadline ? `Deadline:: ${deadline}\n` : "";

  const content = `# ${name}

Status:: active
Area:: ${area}
Outcome:: ${outcome}
Created: ${today}
${deadlineLine}
## Next Actions
- [ ] ${firstAction} #${area}${deadline ? ` 📅 ${deadline}` : ""}

## Waiting For

## Notes
${context}
`;

  await adapter.createNote(filepath, content);
  return filepath;
}
