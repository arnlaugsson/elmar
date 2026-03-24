import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readReviewState, writeReviewState, detectDueTiers } from "../../src/core/review-state.js";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("readReviewState", () => {
  const dir = join(tmpdir(), "elmar-test-revstate-" + Date.now());

  beforeEach(() => mkdirSync(dir, { recursive: true }));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns defaults when file missing", () => {
    const state = readReviewState(join(dir, "nope.json"));
    expect(state.lastDaily).toBe("");
    expect(state.lastWeekly).toBe("");
    expect(state.lastMonthly).toBe("");
    expect(state.interrupted).toBeNull();
  });

  it("reads existing state", () => {
    const path = join(dir, "state.json");
    writeFileSync(path, JSON.stringify({
      lastDaily: "2026-03-24",
      lastWeekly: "2026-03-21",
      lastMonthly: "2026-03-01",
      interrupted: null,
    }));
    const state = readReviewState(path);
    expect(state.lastDaily).toBe("2026-03-24");
  });
});

describe("writeReviewState", () => {
  const dir = join(tmpdir(), "elmar-test-revwrite-" + Date.now());

  beforeEach(() => mkdirSync(dir, { recursive: true }));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes and reads back state", () => {
    const path = join(dir, "state.json");
    const state = { lastDaily: "2026-03-24", lastWeekly: "2026-03-21", lastMonthly: "2026-03-01", interrupted: null };
    writeReviewState(path, state);
    const loaded = readReviewState(path);
    expect(loaded.lastDaily).toBe("2026-03-24");
  });
});

describe("detectDueTiers", () => {
  it("all tiers due when state is empty", () => {
    const tiers = detectDueTiers({ lastDaily: "", lastWeekly: "", lastMonthly: "", interrupted: null }, "2026-03-24");
    expect(tiers).toEqual(["weekly", "monthly"]);
  });

  it("only daily due when reviewed yesterday", () => {
    const tiers = detectDueTiers({
      lastDaily: "2026-03-23",
      lastWeekly: "2026-03-21",
      lastMonthly: "2026-03-01",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toEqual(["daily"]);
  });

  it("weekly supersedes daily", () => {
    const tiers = detectDueTiers({
      lastDaily: "2026-03-10",
      lastWeekly: "2026-03-10",
      lastMonthly: "2026-03-01",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toEqual(["weekly"]);
  });

  it("monthly stacks with weekly", () => {
    const tiers = detectDueTiers({
      lastDaily: "2026-01-01",
      lastWeekly: "2026-01-01",
      lastMonthly: "2026-01-01",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toEqual(["weekly", "monthly"]);
  });

  it("returns empty when all up to date", () => {
    const tiers = detectDueTiers({
      lastDaily: "2026-03-24",
      lastWeekly: "2026-03-24",
      lastMonthly: "2026-03-24",
      interrupted: null,
    }, "2026-03-24");
    expect(tiers).toEqual([]);
  });
});
