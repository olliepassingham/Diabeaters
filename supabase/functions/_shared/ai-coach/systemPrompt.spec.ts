/**
 * Drift-guard tests (#SP-1, #SP-2).
 *
 * Assert that:
 *  - AI_COACH_SYSTEM_PROMPT is byte-for-byte equal to the fenced ```text```
 *    block under §2 of docs/regulatory/ai_coach_system_prompt.md.
 *  - AI_COACH_SUPPORTER_SYSTEM_PROMPT is byte-for-byte equal to the fenced
 *    ```text``` block under §2b of the same file.
 *
 * Either side updated alone makes these tests fail — which is exactly what we
 * want, since the markdown is the canonical clinical-relevance spec.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import {
  AI_COACH_SUPPORTER_SYSTEM_PROMPT,
  AI_COACH_SYSTEM_PROMPT,
} from "./systemPrompt.ts";

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

function extractTextBlockUnderHeading(markdown: string, heading: string): string {
  const sectionStart = markdown.indexOf(heading);
  if (sectionStart < 0) {
    throw new Error(`Could not locate '${heading}' heading in markdown`);
  }
  const after = markdown.slice(sectionStart);
  const fenceOpen = after.indexOf("```text\n");
  if (fenceOpen < 0) {
    throw new Error(`Could not locate opening \`\`\`text fence under '${heading}'`);
  }
  const bodyStart = fenceOpen + "```text\n".length;
  const fenceClose = after.indexOf("\n```", bodyStart);
  if (fenceClose < 0) {
    throw new Error(`Could not locate closing \`\`\` fence for '${heading}' text block`);
  }
  return after.slice(bodyStart, fenceClose);
}

describe("AI_COACH_SYSTEM_PROMPT (#SP-1 drift guard)", () => {
  it("matches the §2 ```text``` block in the canonical spec markdown", () => {
    const markdown = readFileSync(SPEC_PATH, "utf-8");
    const fromMarkdown = extractTextBlockUnderHeading(markdown, "## 2. System prompt");
    expect(AI_COACH_SYSTEM_PROMPT).toBe(fromMarkdown);
  });
});

describe("AI_COACH_SUPPORTER_SYSTEM_PROMPT (#SP-2 drift guard)", () => {
  it("matches the §2b ```text``` block in the canonical spec markdown", () => {
    const markdown = readFileSync(SPEC_PATH, "utf-8");
    const fromMarkdown = extractTextBlockUnderHeading(
      markdown,
      "## 2b. System prompt — Supporter Mode",
    );
    expect(AI_COACH_SUPPORTER_SYSTEM_PROMPT).toBe(fromMarkdown);
  });

  it("addresses the supporter, not the person with diabetes", () => {
    expect(AI_COACH_SUPPORTER_SYSTEM_PROMPT).toContain("Supporter");
    expect(AI_COACH_SUPPORTER_SYSTEM_PROMPT).toContain("their team");
    expect(AI_COACH_SUPPORTER_SYSTEM_PROMPT).not.toContain('to their team as "your team"');
  });
});
