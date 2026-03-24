import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface InterruptedState {
  readonly tier: "daily" | "weekly" | "monthly";
  readonly step: number;
  readonly data: Record<string, unknown>;
}

export interface ReviewState {
  readonly lastDaily: string;
  readonly lastWeekly: string;
  readonly lastMonthly: string;
  readonly interrupted: InterruptedState | null;
}

const DEFAULT_STATE: ReviewState = {
  lastDaily: "",
  lastWeekly: "",
  lastMonthly: "",
  interrupted: null,
};

export function readReviewState(path: string): ReviewState {
  if (!existsSync(path)) return DEFAULT_STATE;
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return {
    lastDaily: raw.lastDaily ?? "",
    lastWeekly: raw.lastWeekly ?? "",
    lastMonthly: raw.lastMonthly ?? "",
    interrupted: raw.interrupted ?? null,
  };
}

export function writeReviewState(path: string, state: ReviewState): void {
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

function daysDiff(dateA: string, dateB: string): number {
  if (!dateA || !dateB) return Infinity;
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export type ReviewTier = "daily" | "weekly" | "monthly";

export function detectDueTiers(state: ReviewState, today: string): ReviewTier[] {
  const tiers: ReviewTier[] = [];

  const dailyDue = state.lastDaily !== today;
  const weeklyDue = daysDiff(state.lastWeekly, today) >= 7;
  const monthlyDue = daysDiff(state.lastMonthly, today) >= 30;

  // Weekly supersedes daily
  if (weeklyDue) {
    tiers.push("weekly");
  } else if (dailyDue) {
    tiers.push("daily");
  }

  if (monthlyDue) {
    tiers.push("monthly");
  }

  return tiers;
}
