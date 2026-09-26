import { NextResponse } from "next/server";
import { getMember, setMemberPicture } from "@mstgolf/core";
import { actorOf, requireApi } from "../../../../../lib/auth";
import { fail } from "../../../../../lib/api";
import { currentOrg } from "../../../../../lib/org";
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
  const org = await currentOrg();
  const member = await getMember(org.id, params.id);
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
  const org = await currentOrg();
  const member = await getMember(org.id, params.id);
  if (!member || member.status !== "ACTIVE") return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("photo");
  } catch {
    return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 400 });
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP" }, { status: 415 });
  }
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 2 MB" }, { status: 413 });

  try {
    const previous = member.pictureUrl;
    const pictureUrl = await storeMemberPhoto(member.id, file);
    await setMemberPicture(org.id, actorOf(user), member.id, pictureUrl);
    await deleteMemberPhoto(previous);
    return NextResponse.json({ ok: true, version: Date.now() });
  } catch (e) {
    if (e instanceof PhotoStorageNotConfigured) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าที่เก็บรูป (BLOB_READ_WRITE_TOKEN) — ติดต่อผู้ดูแลระบบ" }, { status: 503 });
    }
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireApi("members.edit");
  if (user instanceof NextResponse) return user;
  try {
    const org = await currentOrg();
    const member = await getMember(org.id, params.id);
    if (!member) return NextResponse.json({ error: "ไม่พบสมาชิก" }, { status: 404 });
    await setMemberPicture(org.id, actorOf(user), member.id, null);
    await deleteMemberPhoto(member.pictureUrl);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
