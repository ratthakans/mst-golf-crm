import { NextResponse } from "next/server";
import { generateText, isAiConfigured, MST_BRAND_SYSTEM } from "../../../../lib/ai";

const TONE_TH: Record<string, string> = {
  formal: "โทนสุภาพ เป็นทางการ ให้เกียรติลูกค้า",
  friendly: "โทนเป็นกันเอง อบอุ่น เหมือนเพื่อนคุยกัน",
  playful: "โทนสนุก มีชีวิตชีวา เล่นคำได้บ้าง แต่ยังดูดี",
};

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json({ configured: false });
  }

  let body: { audience?: string; signal?: string; offer?: string; tone?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const audience = (body.audience ?? "").trim();
  const tone = TONE_TH[body.tone ?? "friendly"] ?? TONE_TH.friendly;
  const who = body.kind === "personal" ? `ลูกค้าชื่อ ${audience}` : `กลุ่มลูกค้า "${audience}"`;

  const user = `เขียนข้อความ LINE ${body.kind === "personal" ? "ถึงลูกค้ารายบุคคล" : "สำหรับแคมเปญกลุ่ม"} 1 ข้อความ

เป้าหมาย: ${who}
สถานการณ์/เหตุผล: ${body.signal ?? "-"}
ข้อเสนอที่มี: ${body.offer ?? "-"}
โทนที่ต้องการ: ${tone}

เขียนให้ชวนให้ลูกค้าตอบกลับหรือแวะร้าน`;

  try {
    const text = await generateText(MST_BRAND_SYSTEM, user, 400);
    return NextResponse.json({ configured: true, text });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : "AI error" },
      { status: 502 },
    );
  }
}
