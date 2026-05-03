import { describe, expect, it } from "vitest";
import {
  extractRefusalFromMessage,
  normalizeAssistantContent,
  parseCoachLlmJson,
  pickSystemPromptForAudience,
  stripMarkdownJsonFence,
} from "./llmClient.ts";
import {
  AI_COACH_SUPPORTER_SYSTEM_PROMPT,
  AI_COACH_SYSTEM_PROMPT,
} from "./systemPrompt.ts";

describe("normalizeAssistantContent", () => {
  it("passes through strings", () => {
    expect(normalizeAssistantContent("hello")).toBe("hello");
  });

  it("joins text parts array", () => {
    expect(
      normalizeAssistantContent([
        { type: "text", text: '{"reply":"' },
        { type: "text", text: 'ok","suggestedQuestions":[],"suggestedNextActions":[],"deferToTeam":false}' },
      ]),
    ).toBe('{"reply":"ok","suggestedQuestions":[],"suggestedNextActions":[],"deferToTeam":false}');
  });

  it("returns empty for unknown shapes", () => {
    expect(normalizeAssistantContent(null)).toBe("");
    expect(normalizeAssistantContent(1)).toBe("");
  });
});

describe("extractRefusalFromMessage", () => {
  it("reads top-level refusal", () => {
    expect(extractRefusalFromMessage({ refusal: "  nope  ", role: "assistant" })).toBe("nope");
  });

  it("reads refusal content part when top-level empty", () => {
    expect(
      extractRefusalFromMessage({
        role: "assistant",
        content: [{ type: "refusal", refusal: "Cannot help with that." }],
      }),
    ).toBe("Cannot help with that.");
  });

  it("prefers top-level refusal over parts", () => {
    expect(
      extractRefusalFromMessage({
        refusal: "primary",
        content: [{ type: "refusal", refusal: "secondary" }],
      }),
    ).toBe("primary");
  });
});

describe("stripMarkdownJsonFence", () => {
  it("leaves plain JSON unchanged", () => {
    const j = '{"reply":"x","suggestedQuestions":[],"suggestedNextActions":[],"deferToTeam":false}';
    expect(stripMarkdownJsonFence(j)).toBe(j);
  });

  it("strips json fence", () => {
    const inner = '{"reply":"hi","suggestedQuestions":[],"suggestedNextActions":[],"deferToTeam":false}';
    const wrapped = "```json\n" + inner + "\n```";
    expect(stripMarkdownJsonFence(wrapped)).toBe(inner);
  });
});

describe("parseCoachLlmJson", () => {
  const minimal = (reply: string) =>
    JSON.stringify({
      reply,
      suggestedQuestions: [],
      suggestedNextActions: [],
      deferToTeam: false,
    });

  it("parses minimal valid payload", () => {
    const r = parseCoachLlmJson(minimal("Hello"));
    expect(r?.reply).toBe("Hello");
  });

  it("parses fenced JSON", () => {
    const inner = minimal("Fenced");
    const r = parseCoachLlmJson("```json\n" + inner + "\n```");
    expect(r?.reply).toBe("Fenced");
  });

  it("parses JSON after leading prose by slicing braces", () => {
    const inner = minimal("After prose");
    const r = parseCoachLlmJson('Here you go:\n\n' + inner + '\n\nThanks.');
    expect(r?.reply).toBe("After prose");
  });

  it("rejects empty reply", () => {
    expect(parseCoachLlmJson(minimal(""))).toBeNull();
  });

  it("rejects whitespace-only reply after trim", () => {
    expect(parseCoachLlmJson(minimal("   \n\t  "))).toBeNull();
  });

  it("rejects missing reply", () => {
    expect(parseCoachLlmJson('{"suggestedQuestions":[]}')).toBeNull();
  });
});

describe("pickSystemPromptForAudience", () => {
  it("returns the patient prompt by default", () => {
    expect(pickSystemPromptForAudience("patient")).toBe(AI_COACH_SYSTEM_PROMPT);
  });

  it("returns the supporter prompt when audience is supporter", () => {
    expect(pickSystemPromptForAudience("supporter")).toBe(AI_COACH_SUPPORTER_SYSTEM_PROMPT);
  });

  it("supporter and patient prompts differ", () => {
    expect(AI_COACH_SUPPORTER_SYSTEM_PROMPT).not.toBe(AI_COACH_SYSTEM_PROMPT);
  });
});
