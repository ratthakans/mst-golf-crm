import { prisma } from "@mstgolf/database";
import { DEFAULT_TIERS } from "@mstgolf/shared/tiers";
import type { Actor } from "../src/context";

// A fresh org per test file, with one store and three lanes open 10:00–22:00.
export async function makeOrg(label: string) {
  const slug = `t-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const org = await prisma.organization.create({
    data: {
      name: `Test ${label}`,
      slug,
      settings: { points: { perBaht: 1, signupBonus: 1600, birthdayBonus: 0, expiryMonths: 12 }, tiers: DEFAULT_TIERS, features: { booking: true } },
    },
  });
  const hours: [string, string] = ["10:00", "22:00"];
  const store = await prisma.store.create({
    data: {
      orgId: org.id,
      code: "CIT1",
      name: "MST Test Store",
      openHours: { mon: hours, tue: hours, wed: hours, thu: hours, fri: hours, sat: hours, sun: hours },
    },
  });
  const lanes = [];
  for (const n of [1, 2, 3]) {
    lanes.push(await prisma.lane.create({ data: { orgId: org.id, storeId: store.id, name: `Lane ${n}`, capacity: 3, hourlyPriceSatang: 100_000, sortOrder: n } }));
  }
  const admin = await prisma.user.create({ data: { orgId: org.id, email: `admin@${slug}.test`, role: "SUPER_ADMIN" } });
  const manager = await prisma.user.create({ data: { orgId: org.id, email: `manager@${slug}.test`, role: "STORE_MANAGER" } });
  const actor: Actor = { kind: "staff", userId: admin.id, role: "SUPER_ADMIN" };
  const managerActor: Actor = { kind: "staff", userId: manager.id, role: "STORE_MANAGER" };
  return { orgId: org.id, storeId: store.id, lanes, actor, managerActor };
}


export const enc = (s: string) => new TextEncoder().encode(s);
