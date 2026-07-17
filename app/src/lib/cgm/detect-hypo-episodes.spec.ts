import { describe, expect, it } from "vitest";
import type { CgmChartPoint } from "@/lib/cgm/cgm-chart";
import { detectHypoEpisodes, episodeMatchesLoggedHypo } from "@/lib/cgm/detect-hypo-episodes";

function pt(minsAgo: number, value: number): CgmChartPoint {
  const timeMs = Date.UTC(2026, 6, 14, 12, 0, 0) - minsAgo * 60_000;
  return {
    recordedAt: new Date(timeMs).toISOString(),
    timeMs,
    timeLabel: "",
    value,
    trend: null,
  };
}

describe("detectHypoEpisodes", () => {
  it("clusters contiguous lows below threshold", () => {
    const points = [
      pt(60, 6),
      pt(55, 3.5),
      pt(50, 3.2),
      pt(45, 3.4),
      pt(40, 5.5),
    ];
    const episodes = detectHypoEpisodes(points, 4);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]!.nadirValue).toBe(3.2);
    expect(episodes[0]!.readingCount).toBe(3);
  });

  it("ignores single-point blips", () => {
    const points = [pt(30, 6), pt(25, 3.0), pt(20, 6)];
    expect(detectHypoEpisodes(points, 4)).toHaveLength(0);
  });

  it("splits episodes across a long gap", () => {
    const points = [
      pt(120, 3.5),
      pt(115, 3.3),
      pt(110, 3.4),
      pt(40, 3.6),
      pt(35, 3.2),
      pt(30, 3.5),
    ];
    const episodes = detectHypoEpisodes(points, 4);
    expect(episodes.length).toBe(2);
  });
});

describe("episodeMatchesLoggedHypo", () => {
  const episode = {
    id: "cgm-hypo-1",
    startAt: new Date(Date.UTC(2026, 6, 14, 13, 50, 0)).toISOString(),
    endAt: new Date(Date.UTC(2026, 6, 14, 14, 10, 0)).toISOString(),
    nadirAt: new Date(Date.UTC(2026, 6, 14, 14, 5, 0)).toISOString(),
    nadirValue: 3.1,
    readingCount: 5,
    durationMinutes: 20,
  };

  it("matches a log inside the episode window", () => {
    const inside = new Date(Date.UTC(2026, 6, 14, 14, 0, 0)).toISOString();
    expect(episodeMatchesLoggedHypo(episode, [inside])).toBe(true);
  });

  it("matches a treatment logged shortly before the episode starts", () => {
    // 30 min before start — within the 45 min buffer
    const before = new Date(Date.UTC(2026, 6, 14, 13, 20, 0)).toISOString();
    expect(episodeMatchesLoggedHypo(episode, [before])).toBe(true);
  });

  it("matches a log shortly after the episode ends", () => {
    const after = new Date(Date.UTC(2026, 6, 14, 14, 40, 0)).toISOString();
    expect(episodeMatchesLoggedHypo(episode, [after])).toBe(true);
  });

  it("does not match a log hours away", () => {
    const far = new Date(Date.UTC(2026, 6, 14, 8, 0, 0)).toISOString();
    expect(episodeMatchesLoggedHypo(episode, [far])).toBe(false);
  });
});
