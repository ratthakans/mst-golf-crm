// Dev-only: ensures one user per role exists in the dev schema (password from
// ROLE_CHECK_PASSWORD) so permission checks can be exercised locally.
import { prisma } from "@mstgolf/database";
import { hashPassword } from "@mstgolf/shared/password";
import { getOrgBySlug } from "../src";

if (!process.env.DATABASE_SCHEMA || process.env.DATABASE_SCHEMA === "public") process.exit(1);
const pw = process.env.ROLE_CHECK_PASSWORD;
if (!pw) process.exit(1);
const roles = ["MARKETING", "STORE_MANAGER", "STORE_STAFF", "CUSTOMER_SERVICE"] as const;
(async () => {
  const org = await getOrgBySlug();
  const passwordHash = await hashPassword(pw);
  for (const role of roles) {
    const email = `${role.toLowerCase()}@dev.local`;
    await prisma.user.upsert({ where: { orgId_email: { orgId: org.id, email } }, update: { passwordHash, isActive: true, role }, create: { orgId: org.id, email, role, name: role, passwordHash } });
  }
  await prisma.$disconnect();
})();
