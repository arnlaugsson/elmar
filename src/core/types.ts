export interface SearchResult {
  readonly path: string;
  readonly line: number;
  readonly text: string;
  readonly context: string;
}

export interface MetricDef {
  readonly key: string;
  readonly label: string;
  readonly type: "number" | "text" | "list";
  readonly range?: readonly [number, number];
  readonly unit?: string;
  readonly comment?: boolean;
}

export interface MetricRegistry {
  readonly metrics: readonly MetricDef[];
}

export interface TaskItem {
  readonly text: string;
  readonly completed: boolean;
  readonly tags: readonly string[];
  readonly dueDate: string | null;
  readonly waiting: boolean;
  readonly sourcePath: string;
  readonly sourceArea: string;
  readonly line: number;
}

export interface ElmarConfig {
  readonly vaultPath: string;
  readonly inboxFile: string;
  readonly dailyNotesFolder: string;
  readonly weeklyNotesFolder: string;
  readonly templatesFolder: string;
  readonly systemFolder: string;
  readonly areas: readonly string[];
}

export interface ProjectMeta {
  readonly title: string;
  readonly status: string;
  readonly area: string;
  readonly outcome: string;
  readonly created: string;
}
