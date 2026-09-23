// Browser-only: shrink a picked photo to a square JPEG before upload, so a 12 MB
// phone photo becomes ~50 KB and every avatar has the same crop.

export async function resizeToSquareJpeg(file: File, size = 512, quality = 0.85): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("เปิดไฟล์รูปนี้ไม่ได้ — ลองใช้ไฟล์ JPG หรือ PNG");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const out = Math.min(size, side);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้ย่อรูปไม่ได้");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("ย่อรูปไม่สำเร็จ"))), "image/jpeg", quality),
  );
}
