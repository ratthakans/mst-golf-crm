import { NextResponse } from "next/server";
import { requireApi } from "../../../../lib/auth";
import { fail } from "../../../../lib/api";
import { PublicImagesNotConfigured, storePublicImage } from "../../../../lib/public-images";

// Reward pictures — shown to members in the catalogue, so they are public images.
export async function POST(req: Request) {
  const user = await requireApi("rewards.manage");
  if (user instanceof NextResponse) return user;
  try {
    const file = (await req.formData()).get("image");
    if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "ไม่พบไฟล์รูป" }, { status: 400 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "รองรับ JPG, PNG, WebP" }, { status: 415 });
    if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 3 MB" }, { status: 413 });
    return NextResponse.json({ url: await storePublicImage("rewards", file) });
  } catch (e) {
    if (e instanceof PublicImagesNotConfigured) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าที่เก็บรูป (PUBLIC_BLOB_READ_WRITE_TOKEN) — ใส่ลิงก์รูปแทนได้" }, { status: 503 });
    }
    return fail(e);
  }
}
