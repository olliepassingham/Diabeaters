import { describe, expect, it } from "vitest";
import { isStoryVideoPickerCancel, storyVideoFileMeta } from "./pick-story-video";

describe("story video library pick", () => {
  it("names common video formats", () => {
    expect(storyVideoFileMeta("quicktime")).toEqual({ ext: "mov", type: "video/quicktime" });
    expect(storyVideoFileMeta("video/webm")).toEqual({ ext: "webm", type: "video/webm" });
    expect(storyVideoFileMeta("mp4")).toEqual({ ext: "mp4", type: "video/mp4" });
    expect(storyVideoFileMeta(undefined)).toEqual({ ext: "mp4", type: "video/mp4" });
  });

  it("treats a dismissed library as cancel", () => {
    expect(isStoryVideoPickerCancel({ code: "OS-PLUG-CAMR-0020", message: "User cancelled" })).toBe(true);
    expect(isStoryVideoPickerCancel(new Error("User cancelled photos app"))).toBe(true);
    expect(isStoryVideoPickerCancel(new Error("Couldn't open your videos"))).toBe(false);
  });
});