import { NextResponse } from "next/server";
import { getCrmData, formatCurrency, formatNumber } from "../../../../lib/data";
import { generateText, isAiConfigured } from "../../../../lib/ai";

const BRIEFING_SYSTEM = `You are the analyst for MST Golf's membership CRM (Bangkok, Thailand). Write a short "morning briefing" for the shop manager, in natural Thai.

Rules:
- 3–4 sentences, warm and practical. Currency is ฿ (Thai Baht).
- Lead with what matters most today (risks and opportunities), then one clear recommended action.
- Output ONLY the briefing text — no markdown, headings, bullet points, or preamble.`;

export async function POST() {
  if (!isAiConfigured()) {
    return NextResponse.json({ configured: false });
  }

  const { org, stats, segments, churn, clv, members } = await getCrmData();
  const highRisk = churn.filter((c) => c.probability >= 0.7).length;
  const topClv = [...clv].sort((a, b) => b.predictedLifetime - a.predictedLifetime)[0];
  const topName = members.find((m) => m.id === topClv?.memberId)?.displayName ?? "-";

  const facts = [
    `สมาชิกทั้งหมด ${formatNumber(stats.totalMembers)} คน, ใช้งานใน 30 วัน ${stats.activeMembers30d} คน`,
    `เสี่ยงหลุด (เกิน ${org.churnDays} วัน) ${stats.atRiskMembers} คน, churn สูง (p≥0.7) ${highRisk} คน`,
    `รายได้สะสม ${formatCurrency(stats.revenue, org.currency)}`,
    `กลุ่ม RFM: แชมเปียน ${segments.Champion}, ภักดี ${segments.Loyal}, เสี่ยงหลุด ${segments["At-Risk"]}, เงียบหาย ${segments.Dormant}, ใหม่ ${segments.New}`,
    `ลูกค้า CLV สูงสุด: ${topName} (~${formatCurrency(Math.round(topClv?.predictedLifetime ?? 0), org.currency)})`,
  ].join("\n");

  const user = `ข้อมูล CRM วันนี้:\n${facts}\n\nเขียนบรีฟประจำวันให้ผู้จัดการร้าน`;

  try {
    const text = await generateText(BRIEFING_SYSTEM, user, 500);
    return NextResponse.json({ configured: true, text });
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : "AI error" },
      { status: 502 },
    );
  }
}
