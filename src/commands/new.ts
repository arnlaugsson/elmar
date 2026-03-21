import type { VaultAdapter } from "../adapters/adapter.js";
import type { ElmarConfig } from "../core/types.js";
import inquirer from "inquirer";

export async function runNewProject(
  adapter: VaultAdapter,
  config: ElmarConfig,
  name: string,
  options: { area?: string }
): Promise<string> {
  const area =
    options.area ??
    (
      await inquirer.prompt([
        {
          type: "list",
          name: "area",
          message: "Which area does this project belong to?",
          choices: [...config.areas],
        },
      ])
    ).area;

  const { outcome } = await inquirer.prompt([
    {
      type: "input",
      name: "outcome",
      message: "What's the desired outcome?",
    },
  ]);

  const { firstAction } = await inquirer.prompt([
    {
      type: "input",
      name: "firstAction",
      message: "What's the first next action?",
      default: `Define scope for ${name}`,
    },
  ]);

  const { deadline } = await inquirer.prompt([
    {
      type: "input",
      name: "deadline",
      message: "Deadline? (YYYY-MM-DD or leave empty)",
      default: "",
    },
  ]);

  const { context } = await inquirer.prompt([
    {
      type: "input",
      name: "context",
      message: "Any initial notes or context?",
      default: "",
    },
  ]);

  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const filename = `${area}--${slug}.md`;
  const filepath = `1-Projects/${filename}`;
  const today = new Date().toISOString().slice(0, 10);

  const deadlineLine = deadline ? `Deadline: ${deadline}\n` : "";

  const content = `# ${name}

Status: active
Area: ${area}
Outcome: ${outcome}
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
