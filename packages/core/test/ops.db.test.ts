import { beforeAll, describe, expect, it } from "vitest";
import { confirmReadiness, getOrg, readiness, recordJobRun, saveSite, saveSiteContent, systemStatus } from "../src";
import { makeOrg } from "./fixtures";

let t: Awaited<ReturnType<typeof makeOrg>>;
beforeAll(async () => {
  t = await makeOrg("ops");
});

describe("website content", () => {
  it("saves photos and copy, and contact settings keep them", async () => {
    await saveSiteContent(t.orgId, t.actor, {
      photos: { hero: "https://x.public.blob.vercel-storage.com/site/a.jpg", store: "/mock/store.jpg", nope: "https://evil.example/x.jpg" },
      copy: { heroTitle: "  หัวข้อใหม่  ", services: { academy: { points: "ข้อ 1\nข้อ 2" }, "pro-shop": { short: "" } } },
    });
    await saveSite(t.orgId, t.actor, { phone: "02-000-0000" });
    const { settings } = await getOrg(t.orgId);
    expect(settings.site.photos).toEqual({ hero: "https://x.public.blob.vercel-storage.com/site/a.jpg", store: "/mock/store.jpg" });
    expect(settings.site.copy?.heroTitle).toBe("หัวข้อใหม่");
    expect(settings.site.copy?.services).toEqual({ academy: { points: "ข้อ 1\nข้อ 2" } });
    expect(settings.site.phone).toBe("02-000-0000");
  });

  it("refuses links that are not https or a website path", async () => {
    await expect(saveSiteContent(t.orgId, t.actor, { photos: { hero: "javascript:alert(1)" } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(saveSiteContent(t.orgId, t.actor, { photos: { hero: "http://insecure.example/a.jpg" } })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("readiness", () => {
  it("lists what is missing and lets MST confirm values", async () => {
    const before = await readiness(t.orgId);
    const hours = before.find((i) => i.key === "store.hours")!;
    expect(hours.state).toBe("confirm");
    expect(hours.detail).toContain("10:00–22:00");
    expect(before.find((i) => i.key === "site.photos")).toMatchObject({ state: "waiting", detail: expect.stringContaining("2 จาก 7") });
    await confirmReadiness(t.orgId, t.actor, "store.hours", true);
    const after = await readiness(t.orgId);
    expect(after.find((i) => i.key === "store.hours")).toMatchObject({ state: "ok", confirmed: { by: expect.any(String) } });
    await expect(confirmReadiness(t.orgId, t.actor, "site.domain", true)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await confirmReadiness(t.orgId, t.actor, "store.hours", false);
    expect((await readiness(t.orgId)).find((i) => i.key === "store.hours")?.state).toBe("confirm");
  });
});

describe("job runs", () => {
  it("shows never / ok / failed / late per job", async () => {
    const now = new Date("2026-10-01T05:00:00Z");
    expect((await systemStatus(t.orgId, now)).jobs.map((j) => j.state)).toEqual(["never", "never", "never"]);
    await recordJobRun("frequent", { startedAt: new Date("2026-10-01T04:50:00Z"), ok: true, detail: { reminders: 2 }, orgIds: [t.orgId] });
    await recordJobRun("backup", { startedAt: new Date("2026-09-27T20:00:00Z"), ok: true, orgIds: [t.orgId] });
    await recordJobRun("nightly", { startedAt: new Date("2026-09-30T19:00:00Z"), ok: false, error: "boom", orgIds: [t.orgId] });
    const s = await systemStatus(t.orgId, now);
    expect(Object.fromEntries(s.jobs.map((j) => [j.kind, j.state]))).toEqual({ nightly: "failed", frequent: "ok", backup: "late" });
    expect(s.jobs.find((j) => j.kind === "nightly")?.last?.error).toBe("boom");
  });
});
