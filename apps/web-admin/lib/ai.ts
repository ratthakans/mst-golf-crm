import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Thin wrapper around the Anthropic SDK for the AI features (campaign copy +
// daily briefing). The model comes from AI_MODEL so it can change per
// environment without a deploy of new code. Credentials come from
// ANTHROPIC_API_KEY (never hardcode).
//
// Calls happen only when a person asks for text they will read — never per
// member, per event or per cron (CLAUDE.md, rule 1).

// Claude Opus 5.5 always thinks before it answers (adaptive thinking, effort
// "medium" by default), and the thinking counts toward max_tokens — so the
// budget is generous and the prompt, not max_tokens, keeps the text short.
const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16000;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Generate plain text from a system + user prompt. Returns the trimmed text. */
export async function generateText(system: string, user: string): Promise<string> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const res = await client.messages.create({
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: user }],
  });
  // A declined request comes back as HTTP 200 with no usable text.
  if (res.stop_reason === "refusal") throw new Error("AI ไม่สามารถเขียนข้อความนี้ได้ ลองปรับคำขอใหม่");
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Shared brand voice so every generation sounds like MST Golf.
export const MST_BRAND_SYSTEM = `You write for MST Golf, a premium golf retailer in Bangkok, Thailand (pro shop + club fitting + golf simulator). Members are Thai golfers.

Rules:
- Write in natural, warm Thai (ภาษาไทยที่เป็นธรรมชาติ). Use polite particles (ครับ/ค่ะ) appropriately.
- Currency is Thai Baht, written as ฿ (e.g. ฿640).
- Keep brand/product names in English (Titleist, TaylorMade, Pro V1, MST Golf).
- Output ONLY the message text — no markdown, no quotes, no preamble, no explanation.
- Keep it short enough to read on a phone (2–4 sentences). Use at most one or two tasteful emoji.`;
