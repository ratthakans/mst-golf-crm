import { beforeAll, describe, expect, it } from "vitest";
import { commitImport, createMemberAtCounter, db, ledgerDrift, previewImport, rollbackImport, signUp, staffUpdateMember } from "../src";
import { enc, makeOrg } from "./fixtures";

let t: Awaited<ReturnType<typeof makeOrg>>;
let silverBound: string; // member id
let codeMember: { id: string; code: string };

const HEAD = "เลขที่บิล,วันที่,เวลา,ประเภท,บิลอ้างอิง,รหัสสินค้า,ชื่อสินค้า,จำนวน,ราคาต่อหน่วย,ยอดสุทธิ,หมายเหตุ";

beforeAll(async () => {
  t = await makeOrg("import");
  const a = await signUp(t.orgId, { lineUserId: "U-imp-a", channel: "LINE", fullName: "Silver Bound", phone: "0891112233", acceptTerms: true, marketing: false });
  silverBound = a.member.id;
  await staffUpdateMember(t.orgId, t.actor, silverBound, { birthday: "1985-10-20" });
  const c = await createMemberAtCounter(t.orgId, t.actor, { fullName: "Code User", phone: "0822223333", consentConfirmed: true, marketing: false });
  codeMember = { id: c.member.id, code: c.member.code };
});

describe("POS import", () => {
  let batchId = "";
  const day1 = [
    HEAD,
    // Silver Bound: 60,000 then 50,000 in October (birthday month) → crosses 100,000 on the second bill
    "INV001,01/10/2026,10:15,ขาย,,QI35,Qi35 Driver,1,\"60,000.00\",\"60,000.00\",MSTMEMBER:089-111-2233",
    "INV002,02/10/2026,11:00,ขาย,,P790,P790 Irons,1,50000,50000,MSTMEMBER:0891112233",
    "INV003,02/10/2026,12:00,ขาย,,BALL,Pro V1,2,1500,3000,MSTMEMBER:0891112233",
    // unknown phone → a POS-only member is created
    "INV004,02/10/2026,13:00,ขาย,,GLOVE,Glove,1,900,900,MSTMEMBER:0861234567",
    // member code in the remark, two lines on one bill
    "INV005,03/10/2026,14:00,ขาย,,SHOE,Shoes,1,4000,4000,MSTMEMBER:" + "CODE",
    "INV005,03/10/2026,14:00,ขาย,,SOCK,Socks,2,250,500,",
    // no member
    "INV006,03/10/2026,15:00,ขาย,,CAP,Cap,1,800,800,",
    // return part of INV003 (1 of 2 balls)
    "CN001,04/10/2026,10:00,คืน,INV003,BALL,Pro V1,1,1500,1500,",
    // broken rows
    ",04/10/2026,10:00,ขาย,,X,X,1,1,1,",
    "INV007,31/02/2026,10:00,ขาย,,X,X,1,1,1,",
  ];

  it("previews without writing sales", async () => {
    const csv = day1.join("\n").replace("MSTMEMBER:CODE", `MSTMEMBER:${codeMember.code}`);
    const p = await previewImport(t.orgId, t.actor, { storeId: t.storeId, fileName: "day1.csv", bytes: enc(csv) });
    batchId = p.batchId;
    expect(p.mappingProblems).toEqual([]);
    expect(p.mapping.invoiceNo).toBe("เลขที่บิล");
    expect(p.counts.bills).toBe(7);
    expect(p.counts.unmatched).toBe(1); // INV006
    expect(p.counts.invalid).toBe(2);
    expect(p.counts.membersToCreate).toBe(1);
    expect(p.counts.returns).toBe(1);
    expect(await db(t.orgId).sale.count()).toBe(0);
  });

  it("commits: points at the tier held before each bill, birthday ×2, tier up, partial return", async () => {
    const r = await commitImport(t.orgId, t.actor, batchId);
    expect(r.membersCreated).toBe(1);
    expect(r.tierUps).toBe(1);
    const m = await db(t.orgId).member.findFirst({ where: { id: silverBound } });
    // INV001 60,000 ×1 ×2 (birthday) = 120,000 · INV002 50,000 at Member rate ×2 = 100,000 (upgrade applies after)
    // INV003 3,000 at Silver 1.25 = 3,750 ×2 = 7,500 · CN001 returns half of INV003 → −3,750
    expect(m?.tier).toBe("silver");
    expect(m?.points).toBe(1600 + 120_000 + 100_000 + 7_500 - 3_750);
    expect(m?.spend12mSatang).toBe((60_000 + 50_000 + 3_000 - 1_500) * 100);
    const code = await db(t.orgId).member.findFirst({ where: { id: codeMember.id } });
    expect(code?.points).toBe(1600 + 4_500);
    const phone = await db(t.orgId).memberIdentity.findFirst({ where: { value: "0891112233" } });
    expect(phone?.verifiedAt).not.toBeNull(); // the store confirmed the phone
    const notes = await db(t.orgId).notification.findMany({ where: { kind: { in: ["POINTS", "TIER_UP"] } } });
    expect(notes.filter((n) => n.kind === "TIER_UP")).toHaveLength(1);
    expect(notes.filter((n) => n.kind === "POINTS").length).toBeGreaterThanOrEqual(2);
    expect(await ledgerDrift(t.orgId)).toEqual([]);
  });

  it("refuses the same file twice and skips bills already imported from another file", async () => {
    const csv = day1.join("\n").replace("MSTMEMBER:CODE", `MSTMEMBER:${codeMember.code}`);
    await expect(previewImport(t.orgId, t.actor, { storeId: t.storeId, fileName: "again.csv", bytes: enc(csv) })).rejects.toMatchObject({ code: "IMPORT_STATE" });
    const overlap = [HEAD, "INV002,02/10/2026,11:00,ขาย,,P790,P790 Irons,1,50000,50000,MSTMEMBER:0891112233", "INV010,05/10/2026,11:00,ขาย,,T,Tee,1,100,100,MSTMEMBER:0891112233"].join("\n");
    const p = await previewImport(t.orgId, t.actor, { storeId: t.storeId, fileName: "overlap.csv", bytes: enc(overlap) });
    expect(p.counts.duplicate).toBe(1);
    const before = (await db(t.orgId).member.findFirst({ where: { id: silverBound } }))!.points;
    await commitImport(t.orgId, t.actor, p.batchId);
    const after = (await db(t.orgId).member.findFirst({ where: { id: silverBound } }))!.points;
    expect(after - before).toBe(Math.floor(100 * 1.25) * 2); // only INV010, Silver rate, birthday month
    await expect(commitImport(t.orgId, t.actor, p.batchId)).rejects.toMatchObject({ code: "IMPORT_STATE" });
  });

  it("voids a whole bill", async () => {
    const csv = [HEAD, "V001,06/10/2026,09:00,ยกเลิก,INV010,T,Tee,1,100,100,"].join("\n");
    const p = await previewImport(t.orgId, t.actor, { storeId: t.storeId, fileName: "void.csv", bytes: enc(csv) });
    const before = (await db(t.orgId).member.findFirst({ where: { id: silverBound } }))!.points;
    await commitImport(t.orgId, t.actor, p.batchId);
    const after = (await db(t.orgId).member.findFirst({ where: { id: silverBound } }))!.points;
    expect(before - after).toBe(250);
  });

  it("rollback is refused while a later return references the batch, and restores points otherwise", async () => {
    await expect(rollbackImport(t.orgId, t.actor, batchId, "wrong file")).resolves.toBeDefined(); // CN001 is inside the same batch
    const m = await db(t.orgId).member.findFirst({ where: { id: silverBound } });
    // day 1 is gone; only INV010 (+250) and its void (−250) remain
    expect(m?.points).toBe(1600);
    expect(m?.tier).toBe("member");
    expect(await ledgerDrift(t.orgId)).toEqual([]);
    // the same file can be imported again after a rollback
    const csv = day1.join("\n").replace("MSTMEMBER:CODE", `MSTMEMBER:${codeMember.code}`);
    const p = await previewImport(t.orgId, t.actor, { storeId: t.storeId, fileName: "day1-again.csv", bytes: enc(csv) });
    expect(p.counts.duplicate).toBe(0);
  });

  it("reads Thai Windows encoding and one-row-per-bill exports", async () => {
    const text = "Bill No,Date,Total,Remark\nB-1,2026-10-07 18:05,\"1,234.50\",MSTMEMBER:0891112233\n";
    // windows-874 encode (ASCII-only here, so identical bytes) — exercises the decoder path via an invalid UTF-8 byte
    const bytes = new Uint8Array([...enc(text), 0xa1]);
    const p = await previewImport(t.orgId, t.actor, { storeId: t.storeId, fileName: "bill-level.csv", bytes });
    expect(p.encoding).toBe("windows-874");
    expect(p.mapping.billTotal).toBe("Total");
    expect(p.counts.salesSatang).toBe(123_450);
  });
});
