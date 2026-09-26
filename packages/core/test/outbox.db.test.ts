import { beforeAll, describe, expect, it } from "vitest";
import { db, processOutbox, saveLineChannel, signUp } from "../src";
import { makeOrg } from "./fixtures";

let t: Awaited<ReturnType<typeof makeOrg>>;

beforeAll(async () => {
  process.env.ENCRYPTION_KEY ??= "0".repeat(64);
  t = await makeOrg("outbox");
});

describe("LINE outbox", () => {
  it("skips everything while the Messaging API is not configured", async () => {
    await signUp(t.orgId, { lineUserId: "U-o-1", channel: "LINE", fullName: "Out Box", phone: "0891119999", acceptTerms: true, marketing: false });
    await processOutbox({ fetchImpl: async () => new Response("{}") });
    const n = await db(t.orgId).notification.findFirst({ where: { kind: "WELCOME" } });
    expect(n?.status).toBe("SKIPPED");
  });

  it("sends with a retry key, retries 5xx, and marks blocked users unreachable", async () => {
    await saveLineChannel(t.orgId, t.actor, { channelId: "2000000001", channelSecret: "secret", accessToken: "token", liffId: "2000000002-AbCd", loginChannelId: "2000000002" });
    const a = await signUp(t.orgId, { lineUserId: "U-o-2", channel: "LINE", fullName: "Sent Ok", phone: "0891118888", acceptTerms: true, marketing: false });
    const b = await signUp(t.orgId, { lineUserId: "U-o-3", channel: "LINE", fullName: "Blocked", phone: "0891117777", acceptTerms: true, marketing: false });
    const calls: Array<{ to: string; retryKey: string | null }> = [];
    let first = true;
    const fake: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const retryKey = new Headers(init?.headers).get("X-Line-Retry-Key");
      calls.push({ to: body.to, retryKey });
      if (body.to === "U-o-3") return new Response(JSON.stringify({ message: "The user hasn't added the LINE Official Account as a friend" }), { status: 400 });
      if (first) {
        first = false;
        return new Response("oops", { status: 500 });
      }
      return new Response("{}", { status: 200 });
    };
    const r1 = await processOutbox({ fetchImpl: fake });
    expect(r1.retrying).toBe(1);
    const r2 = await processOutbox({ fetchImpl: fake });
    expect(r2.sent).toBe(1);
    const sentTo = calls.filter((c) => c.to === "U-o-2");
    expect(sentTo).toHaveLength(2);
    expect(sentTo[0]!.retryKey).toBe(sentTo[1]!.retryKey); // the same message keeps its retry key
    const blocked = await db(t.orgId).member.findFirst({ where: { id: b.member.id } });
    expect(blocked?.lineReachable).toBe(false);
    const ok = await db(t.orgId).notification.findFirst({ where: { memberId: a.member.id } });
    expect(ok?.status).toBe("SENT");
  });
});
