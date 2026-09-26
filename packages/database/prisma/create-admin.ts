import { PrismaClient } from "@prisma/client";
import { hashPassword, temporaryPassword } from "@mstgolf/shared/password";
import { databaseUrl } from "../src/index";

// Creates a Super Admin, or resets an existing account to Super Admin with a new
// temporary password. The recovery path when nobody can sign in.
//
//   pnpm --filter @mstgolf/database admin:create <email> [name] [orgSlug]
//
// Prints the temporary password once; it must be changed at first sign-in.

const prisma = new PrismaClient({ datasourceUrl: databaseUrl() });

async function main() {
  const [emailArg, name = "ผู้ดูแลระบบ", orgSlug = "mst-golf"] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("usage: admin:create <email> [name] [orgSlug]");
    process.exit(1);
  }
  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new Error(`Organization '${orgSlug}' not found — run db:seed first`);

  const temp = temporaryPassword();
  const passwordHash = await hashPassword(temp);
  await prisma.user.upsert({
    where: { orgId_email: { orgId: org.id, email } },
    update: { role: "SUPER_ADMIN", isActive: true, passwordHash, mustChangePassword: true },
    create: { orgId: org.id, email, name, role: "SUPER_ADMIN", passwordHash, mustChangePassword: true },
  });
  await prisma.auditLog.create({
    data: { orgId: org.id, action: "user.admin_cli", entity: "user", after: { email }, reason: "admin:create script" },
  });
  console.log(`Super Admin ready: ${email}`);
  console.log(`Temporary password (shown once): ${temp}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
