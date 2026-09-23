import { NextResponse } from "next/server";
import { audit, requireApi } from "../../../../../lib/auth";
import { getRepo } from "../../../../../lib/repo";
import {
  deleteMemberPhoto,
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  PhotoStorageNotConfigured,
  readMemberPhoto,
  storeMemberPhoto,
} from "../../../../../lib/photo-store";

type Ctx = { params: { id: string } };

// Serves the member's photo. Private storage is never exposed by URL, so every
// image — uploaded or from LINE — goes through here.
export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireApi("members.view");
  if (user instanceof NextResponse) return user;
  const member = await (await getRepo()).getMember(params.id);
  if (!member) return new NextResponse(null, { status: 404 });

  const photo = await readMemberPhoto(member.pictureUrl);
  if (photo.kind === "none") return new NextResponse(null, { status: 404 });
  if (photo.kind === "redirect") return NextResponse.redirect(photo.url);
  return new NextResponse(photo.body, {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "private, max-age=300" },
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await requireApi("members.edit");
  if (user instanceof NextResponse) return user;
  const repo = await getRepo();
  const member = await repo.getMember(params.id);
  if (!member) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("photo");
  } catch {
    return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 400 });
  }
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP" }, { status: 415 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 2 MB" }, { status: 413 });
  }

  try {
    const previous = member.pictureUrl;
    const pictureUrl = await storeMemberPhoto(member.id, file, repo.source);
    await repo.setMemberPicture(member.id, pictureUrl);
    await deleteMemberPhoto(previous);
    await audit(user, { action: "member.photo_set", entity: "member", entityId: member.id });
    return NextResponse.json({ ok: true, version: Date.now() });
  } catch (e) {
    if (e instanceof PhotoStorageNotConfigured) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้งค่าที่เก็บรูป (BLOB_READ_WRITE_TOKEN) — ติดต่อผู้ดูแลระบบ" },
        { status: 503 },
      );
    }
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireApi("members.edit");
  if (user instanceof NextResponse) return user;
  const repo = await getRepo();
  const member = await repo.getMember(params.id);
  if (!member) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
  await repo.setMemberPicture(member.id, null);
  await deleteMemberPhoto(member.pictureUrl);
  await audit(user, { action: "member.photo_remove", entity: "member", entityId: member.id });
  return NextResponse.json({ ok: true });
}
