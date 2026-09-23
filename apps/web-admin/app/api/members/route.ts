import { NextResponse } from "next/server";
import { normalizeThaiMobile } from "@mstgolf/shared/phone";
import { audit, getSessionUser, requireApi } from "../../../lib/auth";
import { can } from "../../../lib/permissions";
import { DuplicateMemberError, getRepo } from "../../../lib/repo";
import type { CreateMemberInput } from "../../../lib/repo";

// Compact search index for the ⌘K command palette (id + name + tier + points).
export async function GET() {
  const user = await requireApi("members.view");
  if (user instanceof NextResponse) return user;
  const repo = await getRepo();
  const members = await repo.listMembers();
  const index = members.map((m) => ({
    id: m.id,
    name: m.displayName ?? m.id,
    tier: m.tier,
    points: m.points,
  }));
  return NextResponse.json({ members: index });
}

export async function POST(req: Request) {
  let body: Partial<CreateMemberInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const displayName = (body.displayName ?? "").trim();
  const attributes = (body.attributes ?? {}) as Record<string, unknown>;
  const consent = body.consent === true;
  // Staff who may create members get admin semantics; anyone else — including
  // a staff session without that right — is treated as the public sign-up form.
  const staff = await getSessionUser();
  const source = staff && can(staff.role, "members.create") && body.source === "admin" ? "admin" : "signup";
  const rawPhone = body.phone?.toString().trim() ?? "";
  const phone = rawPhone ? normalizeThaiMobile(rawPhone) : null;

  if (!displayName) {
    return NextResponse.json({ error: "กรุณากรอกชื่อ-นามสกุล" }, { status: 400 });
  }
  if (rawPhone && !phone) {
    return NextResponse.json(
      { error: "เบอร์มือถือไม่ถูกต้อง — ใช้เบอร์ 10 หลักที่ขึ้นต้นด้วย 06, 08 หรือ 09" },
      { status: 400 },
    );
  }
  // The public link needs a phone: it is how the store finds the member at the till.
  if (source === "signup" && !phone) {
    return NextResponse.json({ error: "กรุณากรอกเบอร์มือถือ" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: "ต้องยินยอมตามนโยบายความเป็นส่วนตัว (PDPA) ก่อนสมัครสมาชิก" },
      { status: 400 },
    );
  }

  const repo = await getRepo();

  // Validate dynamic required fields against the org's FieldDefinition config.
  const fields = await repo.getFieldDefinitions();
  for (const f of fields) {
    if (!f.required) continue;
    const v = attributes[f.key];
    const missing =
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (missing) {
      return NextResponse.json(
        { error: `กรุณากรอก${f.label}` },
        { status: 400 },
      );
    }
  }

  let result;
  try {
    result = await repo.createMember({
      displayName,
      phone: phone ?? undefined,
      email: body.email?.toString().trim() || undefined,
      attributes,
      consent,
      source,
    });
  } catch (e) {
    if (e instanceof DuplicateMemberError) {
      // Staff get the existing record; the public form must not reveal it.
      return NextResponse.json(
        source === "admin"
          ? { error: "เบอร์นี้เป็นสมาชิกอยู่แล้ว", memberId: e.memberId }
          : { error: "เบอร์นี้เป็นสมาชิกอยู่แล้ว — สอบถามพนักงานที่ร้านได้เลย" },
        { status: 409 },
      );
    }
    throw e;
  }

  if (source === "admin") {
    await audit(staff, { action: "member.create", entity: "member", entityId: result.member.id, after: { displayName, phone } });
  }

  return NextResponse.json(
    {
      memberId: result.member.id,
      displayName: result.member.displayName,
      tier: result.tier,
      pointsAwarded: result.pointsAwarded,
      source: repo.source,
    },
    { status: 201 },
  );
}
