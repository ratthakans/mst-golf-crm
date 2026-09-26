import "server-only";

// Member profile photos. Photos are personal data (PDPA), so in production they
// live in a *private* Vercel Blob store and are only ever served through
// /api/members/[id]/photo — never by a public URL.
//
// What Member.pictureUrl can hold:
//   https://….blob.vercel-storage.com/…   our private Blob store
//   any other https URL                   an external picture (e.g. LINE profile)

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const BLOB_HOST = ".blob.vercel-storage.com";

export class PhotoStorageNotConfigured extends Error {
  constructor() {
    super("Photo storage is not configured (BLOB_READ_WRITE_TOKEN)");
  }
}

const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST);
  } catch {
    return false;
  }
}

/** Stores a photo and returns the value to keep in Member.pictureUrl. */
export async function storeMemberPhoto(memberId: string, file: Blob): Promise<string> {
  if (!blobConfigured()) throw new PhotoStorageNotConfigured();
  const { put } = await import("@vercel/blob");
  const blob = await put(`members/${memberId}/photo`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type,
  });
  return blob.url;
}

/** Deletes a stored photo we own. External pictures are left alone. */
export async function deleteMemberPhoto(pictureUrl: string | null | undefined): Promise<void> {
  if (!pictureUrl || !isBlobUrl(pictureUrl) || !blobConfigured()) return;
  const { del } = await import("@vercel/blob");
  await del(pictureUrl);
}

export type PhotoResponse =
  | { kind: "bytes"; body: ReadableStream<Uint8Array> | ArrayBuffer; contentType: string }
  | { kind: "redirect"; url: string }
  | { kind: "none" };

/** Resolves a stored photo into something the photo route can send. */
export async function readMemberPhoto(pictureUrl: string | null | undefined): Promise<PhotoResponse> {
  if (!pictureUrl) return { kind: "none" };

  const inline = /^data:([^;]+);base64,(.*)$/.exec(pictureUrl);
  if (inline) {
    const buf = Buffer.from(inline[2]!, "base64");
    const body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    return { kind: "bytes", body, contentType: inline[1]! };
  }

  if (isBlobUrl(pictureUrl)) {
    if (!blobConfigured()) return { kind: "none" };
    const { get } = await import("@vercel/blob");
    const res = await get(pictureUrl, { access: "private" });
    if (!res || res.statusCode !== 200) return { kind: "none" };
    return { kind: "bytes", body: res.stream, contentType: res.blob.contentType };
  }

  if (pictureUrl.startsWith("https://")) return { kind: "redirect", url: pictureUrl };
  return { kind: "none" };
}
