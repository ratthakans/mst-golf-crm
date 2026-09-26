import "server-only";

// Website images (article covers) live in a PUBLIC Blob store, separate from
// the private member-photo store: PUBLIC_BLOB_READ_WRITE_TOKEN.

export class PublicImagesNotConfigured extends Error {}

const token = () => process.env.PUBLIC_BLOB_READ_WRITE_TOKEN;

export async function storePublicImage(folder: string, file: Blob): Promise<string> {
  if (!token()) throw new PublicImagesNotConfigured("PUBLIC_BLOB_READ_WRITE_TOKEN is not set");
  const { put } = await import("@vercel/blob");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const blob = await put(`${folder}/cover.${ext}`, file, { access: "public", addRandomSuffix: true, contentType: file.type, token: token() });
  return blob.url;
}

export async function deletePublicImage(url: string | null | undefined): Promise<void> {
  if (!url || !token() || !/\.public\.blob\.vercel-storage\.com\//.test(url)) return;
  const { del } = await import("@vercel/blob");
  await del(url, { token: token() });
}
