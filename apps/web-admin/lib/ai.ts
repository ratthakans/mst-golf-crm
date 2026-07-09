import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Thin wrapper around the Anthropic SDK for the AI features (campaign copy +
// daily briefing). Uses Claude Opus 4.8 per Anthropic's default-model guidance.
// Credentials come from ANTHROPIC_API_KEY (never hardcode).

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Generate plain text from a system + user prompt. Returns the trimmed text. */
export async function generateText(
  system: string,
  user: string,
  maxTokens = 500,
): Promise<string> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Shared brand voice so every generation sounds like MST Golf.
export const MST_BRAND_SYSTEM = `You write for MST Golf, a premium golf retailer in Bangkok, Thailand (pro shop + academy + club fitting + indoor arena). Members are Thai golfers.

Rules:
- Write in natural, warm Thai (ภาษาไทยที่เป็นธรรมชาติ). Use polite particles (ครับ/ค่ะ) appropriately.
- Currency is Thai Baht, written as ฿ (e.g. ฿640).
- Keep brand/product names in English (Titleist, TaylorMade, Pro V1, MST Golf).
- Output ONLY the message text — no markdown, no quotes, no preamble, no explanation.
- Keep it concise enough for a LINE message (2–4 sentences). Use at most one or two tasteful emoji.`;
