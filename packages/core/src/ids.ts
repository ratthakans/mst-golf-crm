import { randomBytes } from "node:crypto";

// Ids generated in code for bulk inserts (createMany cannot return them).
// 25 lowercase chars like Prisma's cuid(), prefixed "c" so they sort alongside.
export function newId(): string {
  return `c${Date.now().toString(36)}${randomBytes(9).toString("hex")}`.slice(0, 25);
}
