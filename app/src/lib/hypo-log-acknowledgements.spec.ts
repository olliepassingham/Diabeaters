import { describe, expect, it } from "vitest";
import {
  formatHypoAcknowledgementSummary,
  groupHypoAcknowledgementsByLogId,
  hypoIdFromNotificationData,
} from "./hypo-log-acknowledgements";

describe("hypo-log-acknowledgements", () => {
  it("extracts hypo_id from notification payload", () => {
    expect(hypoIdFromNotificationData({ kind: "hypo_logged", hypo_id: "abc-123" })).toBe("abc-123");
    expect(hypoIdFromNotificationData({ kind: "other" })).toBeNull();
  });

  it("groups acknowledgements by hypo log id", () => {
    const grouped = groupHypoAcknowledgementsByLogId([
      {
        hypo_log_id: "h1",
        carer_id: "c1",
        carer_name: "Alex",
        acknowledged_at: "2025-01-01T00:00:00.000Z",
      },
      {
        hypo_log_id: "h1",
        carer_id: "c2",
        carer_name: "Sam",
        acknowledged_at: "2025-01-01T00:01:00.000Z",
      },
    ]);
    expect(grouped.get("h1")).toHaveLength(2);
  });

  it("formats single and multi supporter summaries", () => {
    const one = [
      {
        hypo_log_id: "h1",
        carer_id: "c1",
        carer_name: "Sarah",
        acknowledged_at: "2025-01-01T00:00:00.000Z",
      },
    ];
    expect(formatHypoAcknowledgementSummary(one)).toBe("Sarah acknowledged");
    expect(formatHypoAcknowledgementSummary(one, { relativeWhen: "2m ago" })).toBe(
      "Sarah acknowledged · 2m ago",
    );
    expect(
      formatHypoAcknowledgementSummary([
        ...one,
        {
          hypo_log_id: "h1",
          carer_id: "c2",
          carer_name: "Tom",
          acknowledged_at: "2025-01-01T00:01:00.000Z",
        },
      ]),
    ).toBe("2 supporters acknowledged");
  });
});
