// Integration test — requires a running Postgres + `pnpm db:migrate`.
// Verifies that `forOrg(orgId)` cannot read or write another tenant's data.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, forOrg } from "./index";

let orgA = "";
let orgB = "";

beforeAll(async () => {
  const a = await prisma.organization.create({
    data: { name: "Test Org A", slug: `test-a-${Date.now()}` },
  });
  const b = await prisma.organization.create({
    data: { name: "Test Org B", slug: `test-b-${Date.now()}` },
  });
  orgA = a.id;
  orgB = b.id;

  // A member belonging to org B only
  await forOrg(orgB).member.create({
    data: { orgId: orgB, lineUserId: `U_b_${Date.now()}`, displayName: "B Member" },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await prisma.$disconnect();
});

describe("tenant isolation via forOrg()", () => {
  it("org A cannot see org B's members", async () => {
    const membersSeenByA = await forOrg(orgA).member.findMany();
    expect(membersSeenByA.every((m) => m.orgId === orgA)).toBe(true);
    expect(membersSeenByA.length).toBe(0);
  });

  it("org B sees its own members", async () => {
    const membersSeenByB = await forOrg(orgB).member.findMany();
    expect(membersSeenByB.length).toBeGreaterThan(0);
    expect(membersSeenByB.every((m) => m.orgId === orgB)).toBe(true);
  });

  it("create() overrides a wrong orgId with the caller's (safety net)", async () => {
    // Caller is forOrg(orgA) but maliciously/mistakenly passes orgB — the
    // extension must correct it to orgA.
    const created = await forOrg(orgA).member.create({
      data: { orgId: orgB, lineUserId: `U_a_${Date.now()}`, displayName: "A Member" },
    });
    expect(created.orgId).toBe(orgA);
  });

  it("count() is scoped to the tenant", async () => {
    const countA = await forOrg(orgA).member.count();
    const countB = await forOrg(orgB).member.count();
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });
});
