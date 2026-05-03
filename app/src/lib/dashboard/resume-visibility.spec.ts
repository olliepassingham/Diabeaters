import { describe, expect, it } from "vitest";
import { shouldHideResumeForTodayRail } from "./resume-visibility";
import type { TodayRailItem } from "./today-rail";
import type { LastInteractionRecord } from "@/lib/last-interaction";

function last(kind: LastInteractionRecord["kind"]): LastInteractionRecord {
  return { kind, at: new Date().toISOString() };
}

describe("shouldHideResumeForTodayRail", () => {
  it("hides sick-day resume when today rail shows sick day", () => {
    const items: TodayRailItem[] = [
      {
        id: "scenario-sick",
        priority: 2,
        title: "Sick day mode",
        primary: { label: "Resume", href: "/sick-day" },
      },
    ];
    expect(shouldHideResumeForTodayRail(last("scenario:sick-day"), items)).toBe(true);
  });

  it("does not hide coach resume", () => {
    const items: TodayRailItem[] = [{ id: "inapp-unread", priority: 5, title: "x", primary: { label: "y", href: "/n" } }];
    expect(shouldHideResumeForTodayRail(last("coach"), items)).toBe(false);
  });
});
