// Uploads one backup file to the private backup Blob store and deletes backups
// older than 30 days. Used by .github/workflows/backup.yml.
import { readFile } from "node:fs/promises";
import { del, list, put } from "@vercel/blob";

const token = process.env.BACKUP_BLOB_TOKEN;
const file = process.argv[2];
if (!token || !file) {
  console.error("usage: BACKUP_BLOB_TOKEN=… node scripts/backup-upload.mjs <file>");
  process.exit(1);
}
const body = await readFile(file);
const blob = await put(`backups/${file}`, body, { access: "private", token, addRandomSuffix: false, contentType: "application/octet-stream" });
console.log("uploaded", blob.pathname, `${(body.length / 1024 / 1024).toFixed(2)} MB`);

const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
let cursor;
const old = [];
do {
  const page = await list({ prefix: "backups/", cursor, token });
  for (const b of page.blobs) if (new Date(b.uploadedAt).getTime() < cutoff) old.push(b.url);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);
if (old.length) {
  await del(old, { token });
  console.log("pruned", old.length, "old backup(s)");
}
