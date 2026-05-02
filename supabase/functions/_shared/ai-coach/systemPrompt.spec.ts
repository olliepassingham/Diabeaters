/**
 * Drift-guard test (#SP-1).
 *
 * Asserts the AI_COACH_SYSTEM_PROMPT constant is byte-for-byte equal to the
 * fenced ```text``` block under §2 of docs/regulatory/ai_coach_system_prompt.md.
 *
 * Either side updated alone makes this test fail — which is exactly what we
 * want, since the markdown is the canonical clinical-relevance spec.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { AI_COACH_SYSTEM_PROMPT } from "./systemPrompt.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
// supabase/functions/_shared/ai-coach -> repo root is 4 levels up.
const SPEC_PATH = path.resolve(
  here,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "regulatory",
  "ai_coach_system_prompt.md",
);

function extractSection2TextBlock(markdown: string): string {
  const sectionStart = markdown.indexOf("## 2. System prompt");
  if (sectionStart < 0) {
    throw new Error("Could not locate '## 2. System prompt' heading in markdown");
  }
  const after = markdown.slice(sectionStart);
  const fenceOpen = after.indexOf("```text\n");
  if (fenceOpen < 0) {
    throw new Error("Could not locate opening ```text fence under §2");
  }
  const bodyStart = fenceOpen + "```text\n".length;
  const fenceClose = after.indexOf("\n```", bodyStart);
  if (fenceClose < 0) {
    throw new Error("Could not locate closing ``` fence for §2 text block");
  }
  return after.slice(bodyStart, fenceClose);
}

describe("AI_COACH_SYSTEM_PROMPT (#SP-1 drift guard)", () => {
  it("matches the §2 ```text``` block in the canonical spec markdown", () => {
    const markdown = readFileSync(SPEC_PATH, "utf-8");
    const fromMarkdown = extractSection2TextBlock(markdown);
    expect(AI_COACH_SYSTEM_PROMPT).toBe(fromMarkdown);
  });
});
