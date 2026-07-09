import { NextResponse } from "next/server";
import { getRepo } from "../../../lib/repo";
import type { CreateMemberInput } from "../../../lib/repo";

// Compact search index for the ⌘K command palette (id + name + tier + points).
export async function GET() {
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

  if (!displayName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json(
      { error: "PDPA consent is required to create a membership" },
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
        { error: `${f.label} is required` },
        { status: 400 },
      );
    }
  }

  const result = await repo.createMember({
    displayName,
    phone: body.phone?.toString().trim() || undefined,
    email: body.email?.toString().trim() || undefined,
    attributes,
    consent,
  });

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
