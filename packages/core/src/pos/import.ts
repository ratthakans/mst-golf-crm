import { createHash } from "node:crypto";
import type { ImportMode, ImportRowStatus, Prisma } from "@mstgolf/database";
import type { PosMapping } from "@mstgolf/shared";
import { findTier, lowestTier, reviewTier, tierProgress, tierRank } from "@mstgolf/shared/tiers";
import { writeAudit } from "../audit";
import type { Actor } from "../context";
import { createManyChunked, db, inTx, type Tx } from "../db";
import { CoreError } from "../errors";
import { newId } from "../ids";
import { findMemberIdByIdentity, insertMember, refreshMemberSpend } from "../members";
import { enqueue, type OutboxItem } from "../notify/outbox";
import { pointsForSatang } from "../points";
import { getOrg, updateSettings, type ResolvedSettings } from "../settings";
import { localParts } from "../time";
import { decodeFile, parseCsv, toCsv } from "./csv";
import { applyMapping, detectMapping, mappingProblems } from "./mapping";
import { parseBills, type ParsedBill, type RowError } from "./parse";

// POS import (docs/PRODUCT.md §6): upload → preview → commit → (rollback within 7
// days). Idempotent: the same file twice is refused, and a bill that is already
// in the database is skipped as DUPLICATE however it arrives.

const ROLLBACK_DAYS = 7;
const YEAR_MS = 365 * 24 * 60 * 60_000;

export interface ImportCounts {
  lines: number;
  bills: number;
  ok: number;
  unmatched: number;
  invalid: number;
  duplicate: number;
  membersMatched: number;
  membersToCreate: number;
  returns: number;
  salesSatang: number;
  identifiedSatang: number;
  pointsEstimate: number;
  from: string | null;
  to: string | null;
  // after commit
  pointsAwarded?: number;
  pointsReversed?: number;
  membersCreated?: number;
  tierUps?: number;
}

export interface PreviewResult {
  batchId: string;
  counts: ImportCounts;
  headers: string[];
  mapping: PosMapping;
  mappingProblems: string[];
  encoding: string;
  problems: Array<{ rowNumber: number; invoiceNo: string | null; status: ImportRowStatus; message: string }>;
}

interface StoredBill extends ParsedBill {
  note?: string; // why the bill is UNMATCHED / INVALID / DUPLICATE
}

const ROW_NOTE = {
  MEMBER_NOT_FOUND: "ไม่พบรหัสสมาชิกนี้ — นำเข้าเป็นบิลไม่มีเจ้าของ",
  BAD_MEMBER_REF: "อ่านเบอร์/รหัสสมาชิกในหมายเหตุไม่ได้ — นำเข้าเป็นบิลไม่มีเจ้าของ",
  NO_MEMBER_REF: "ไม่มีเบอร์สมาชิกในบิล",
  REF_NOT_FOUND: "ไม่พบบิลต้นทางของบิลคืน/ยกเลิก",
  DUPLICATE: "บิลนี้นำเข้าแล้ว",
  DUPLICATE_IN_FILE: "เลขบิลซ้ำในไฟล์",
} as const;

export function fileHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export async function previewImport(
  orgId: string,
  actor: Actor,
  input: { storeId: string; fileName: string; bytes: Uint8Array; mode?: ImportMode; mapping?: PosMapping },
): Promise<PreviewResult> {
  const { settings } = await getOrg(orgId);
  const client = db(orgId);
  const store = await client.store.findFirst({ where: { id: input.storeId, isActive: true } });
  if (!store) throw new CoreError("NOT_FOUND", "ไม่พบสาขา");
  if (input.bytes.byteLength === 0) throw new CoreError("IMPORT_FILE", "ไฟล์ว่าง");
  if (input.bytes.byteLength > 15 * 1024 * 1024) throw new CoreError("IMPORT_FILE", "ไฟล์ใหญ่เกิน 15 MB — แบ่งเป็นหลายไฟล์");

  const hash = fileHash(input.bytes);
  const previous = await client.importBatch.findFirst({ where: { fileHash: hash } });
  if (previous?.status === "COMMITTED") {
    throw new CoreError("IMPORT_STATE", `ไฟล์นี้นำเข้าแล้วเมื่อ ${previous.committedAt?.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`, {
      batchId: previous.id,
    });
  }

  const { text, encoding } = decodeFile(input.bytes);
  const table = parseCsv(text);
  const headers = table[0] ?? [];
  if (headers.length < 2 || table.length < 2) throw new CoreError("IMPORT_FILE", "อ่านไฟล์ไม่ได้ หรือไม่มีข้อมูล — ต้องเป็นไฟล์ CSV ที่มีหัวคอลัมน์");
  const mapping = input.mapping ?? applyMapping(settings.pos.mapping, headers) ?? detectMapping(headers);
  const problemsWithMapping = mappingProblems(mapping);

  const parsed = problemsWithMapping.length
    ? { bills: [], errors: [] as RowError[], lineCount: table.length - 1 }
    : parseBills(headers, table.slice(1), mapping, settings.pos);

  const classified = await classifyBills(client, store.id, parsed.bills);
  const counts = await summarize(client, settings, parsed.lineCount, classified, parsed.errors);

  const batchId = await inTx(orgId, async (tx) => {
    if (previous) await tx.importBatch.deleteMany({ where: { id: previous.id, status: "PREVIEW" } });
    // Abandoned previews of other files are cleared after a day.
    await tx.importBatch.deleteMany({ where: { status: "PREVIEW", createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
    const batch = await tx.importBatch.create({
      data: {
        orgId,
        storeId: store.id,
        fileName: input.fileName.slice(0, 200),
        fileHash: hash,
        mode: input.mode ?? "DAILY",
        uploadedBy: actor.kind === "staff" ? actor.userId : null,
        counts: { ...counts, mapping, encoding } as unknown as Prisma.InputJsonValue,
      },
    });
    const rows: Prisma.ImportRowCreateManyInput[] = [
      ...classified.map((c) => ({
        orgId,
        batchId: batch.id,
        rowNumber: c.bill.rowNumbers[0] ?? 0,
        invoiceNo: c.bill.invoiceNo,
        raw: { ...c.bill, note: c.note } as unknown as Prisma.InputJsonValue,
        status: c.status,
        errorCode: c.code ?? null,
      })),
      ...parsed.errors.map((e) => ({
        orgId,
        batchId: batch.id,
        rowNumber: e.rowNumber,
        invoiceNo: e.invoiceNo,
        raw: { ...e.raw, note: e.message } as Prisma.InputJsonValue,
        status: "INVALID" as const,
        errorCode: e.code,
      })),
    ];
    await createManyChunked(rows, 1000, (chunk) => tx.importRow.createMany({ data: chunk }));
    return batch.id;
  }, { timeout: 60_000 });

  const problems = [
    ...classified
      .filter((c) => c.status !== "OK")
      .map((c) => ({ rowNumber: c.bill.rowNumbers[0] ?? 0, invoiceNo: c.bill.invoiceNo, status: c.status, message: c.note ?? "" })),
    ...parsed.errors.map((e) => ({ rowNumber: e.rowNumber, invoiceNo: e.invoiceNo, status: "INVALID" as const, message: e.message })),
  ].sort((a, b) => a.rowNumber - b.rowNumber);

  return { batchId, counts, headers, mapping, mappingProblems: problemsWithMapping, encoding, problems: problems.slice(0, 500) };
}

interface Classified {
  bill: StoredBill;
  status: ImportRowStatus;
  code?: string;
  note?: string;
  memberId?: string | null; // existing member for preview counts
  createsMember?: boolean;
}

async function classifyBills(client: Tx, storeId: string, bills: ParsedBill[]): Promise<Classified[]> {
  const existing = await findExistingSales(client, storeId, bills);
  const seen = new Set<string>();
  const phones = [...new Set(bills.flatMap((b) => (b.memberRef?.kind === "phone" ? [b.memberRef.value] : [])))];
  const codes = [...new Set(bills.flatMap((b) => (b.memberRef?.kind === "code" ? [b.memberRef.value] : [])))];
  const [phoneIds, codeRows] = await Promise.all([
    phones.length ? client.memberIdentity.findMany({ where: { type: "PHONE", value: { in: phones } }, select: { value: true, memberId: true } }) : [],
    codes.length ? client.member.findMany({ where: { code: { in: codes }, status: "ACTIVE" }, select: { id: true, code: true } }) : [],
  ]);
  const byPhone = new Map(phoneIds.map((p) => [p.value, p.memberId]));
  const byCode = new Map(codeRows.map((m) => [m.code, m.id]));
  const saleInvoices = new Set(bills.filter((b) => b.type === "SALE").map((b) => b.invoiceNo));
  const refsInDb = await findOriginals(
    client,
    storeId,
    bills.filter((b) => b.type !== "SALE" && b.refInvoiceNo && !saleInvoices.has(b.refInvoiceNo)).map((b) => b.refInvoiceNo!),
  );

  return bills.map((bill): Classified => {
    const key = `${bill.invoiceNo}\u0000${bill.type}`;
    if (existing.has(key)) return { bill, status: "DUPLICATE", code: "DUPLICATE", note: ROW_NOTE.DUPLICATE };
    if (seen.has(key)) return { bill, status: "DUPLICATE", code: "DUPLICATE_IN_FILE", note: ROW_NOTE.DUPLICATE_IN_FILE };
    seen.add(key);
    if (bill.type !== "SALE") {
      const ref = bill.refInvoiceNo!;
      if (!saleInvoices.has(ref) && !refsInDb.has(ref)) return { bill, status: "INVALID", code: "REF_NOT_FOUND", note: ROW_NOTE.REF_NOT_FOUND };
      return { bill, status: "OK", memberId: refsInDb.get(ref)?.memberId ?? null };
    }
    const ref = bill.memberRef;
    if (!ref) return { bill, status: "UNMATCHED", code: "NO_MEMBER_REF", note: ROW_NOTE.NO_MEMBER_REF };
    if (ref.kind === "invalid") return { bill, status: "UNMATCHED", code: "BAD_MEMBER_REF", note: ROW_NOTE.BAD_MEMBER_REF };
    if (ref.kind === "code") {
      const id = byCode.get(ref.value);
      return id ? { bill, status: "OK", memberId: id } : { bill, status: "UNMATCHED", code: "MEMBER_NOT_FOUND", note: ROW_NOTE.MEMBER_NOT_FOUND };
    }
    const id = byPhone.get(ref.value);
    return id ? { bill, status: "OK", memberId: id } : { bill, status: "OK", createsMember: true };
  });
}

async function findExistingSales(client: Tx, storeId: string, bills: ParsedBill[]): Promise<Set<string>> {
  const invoices = [...new Set(bills.map((b) => b.invoiceNo))];
  const found = new Set<string>();
  for (let i = 0; i < invoices.length; i += 1000) {
    const rows = await client.sale.findMany({
      where: { storeId, invoiceNo: { in: invoices.slice(i, i + 1000) } },
      select: { invoiceNo: true, type: true },
    });
    for (const r of rows) found.add(`${r.invoiceNo}\u0000${r.type}`);
  }
  return found;
}

async function findOriginals(client: Tx, storeId: string, invoices: string[]) {
  const map = new Map<string, { id: string; memberId: string | null; netSatang: number; occurredAt: Date }>();
  if (invoices.length === 0) return map;
  const rows = await client.sale.findMany({
    where: { storeId, type: "SALE", status: "POSTED", invoiceNo: { in: [...new Set(invoices)] } },
    select: { id: true, invoiceNo: true, memberId: true, netSatang: true, occurredAt: true },
  });
  for (const r of rows) map.set(r.invoiceNo, r);
  return map;
}

async function summarize(
  client: Tx,
  settings: ResolvedSettings,
  lineCount: number,
  classified: Classified[],
  errors: RowError[],
): Promise<ImportCounts> {
  const live = classified.filter((c) => c.status === "OK" || c.status === "UNMATCHED");
  const memberIds = [...new Set(live.flatMap((c) => (c.memberId ? [c.memberId] : [])))];
  const tiers = memberIds.length
    ? await client.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, tier: true } })
    : [];
  const tierOf = new Map(tiers.map((t) => [t.id, t.tier]));
  let pointsEstimate = 0;
  let salesSatang = 0;
  let identifiedSatang = 0;
  for (const c of live) {
    salesSatang += c.bill.netSatang;
    if (c.memberId || c.createsMember) identifiedSatang += c.bill.netSatang;
    if (c.bill.type === "SALE" && (c.memberId || c.createsMember)) {
      const tier = findTier(c.memberId ? tierOf.get(c.memberId) : null, settings.tiers) ?? lowestTier(settings.tiers);
      pointsEstimate += pointsForSatang(c.bill.eligibleSatang, settings.pointsPerBaht, tier.pointRate);
    }
  }
  const dates = live.map((c) => c.bill.occurredAt).sort();
  const invalidBills = classified.filter((c) => c.status === "INVALID").length;
  const invalidRows = new Set(errors.map((e) => e.rowNumber)).size;
  return {
    lines: lineCount,
    bills: classified.length,
    ok: classified.filter((c) => c.status === "OK").length,
    unmatched: classified.filter((c) => c.status === "UNMATCHED").length,
    invalid: invalidBills + invalidRows,
    duplicate: classified.filter((c) => c.status === "DUPLICATE").length,
    membersMatched: memberIds.length,
    membersToCreate: new Set(live.flatMap((c) => (c.createsMember && c.bill.memberRef ? [c.bill.memberRef.value] : []))).size,
    returns: live.filter((c) => c.bill.type !== "SALE").length,
    salesSatang,
    identifiedSatang,
    pointsEstimate,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Commit
// ---------------------------------------------------------------------------

interface MemberState {
  id: string;
  tier: string;
  points: number;
  birthdayMonth: number | null;
  lifetimeSatang: number;
  lastPurchaseAt: Date | null;
  sales: Array<{ at: number; net: number }>; // posted sales in the window we care about
  earned: number; // points delta in this batch
  spentSatang: number; // SALE net in this batch
  bills: number;
  tierUp: string | null;
}

export async function commitImport(orgId: string, actor: Actor, batchId: string): Promise<ImportCounts> {
  const { settings } = await getOrg(orgId);
  const counts = await inTx(
    orgId,
    async (tx) => {
      const batch = await tx.importBatch.findFirst({ where: { id: batchId } });
      if (!batch) throw new CoreError("NOT_FOUND", "ไม่พบรอบนำเข้า");
      const claimed = await tx.importBatch.updateMany({
        where: { id: batch.id, status: "PREVIEW" },
        data: { status: "COMMITTED", committedAt: new Date() },
      });
      if (claimed.count !== 1) throw new CoreError("IMPORT_STATE", "รอบนี้นำเข้าไปแล้วหรือถูกยกเลิก");
      const history = batch.mode === "HISTORY";
      const now = new Date();

      const rows = await tx.importRow.findMany({ where: { batchId: batch.id, status: { in: ["OK", "UNMATCHED"] } } });
      let bills = rows.map((r) => ({ rowId: r.id, bill: r.raw as unknown as StoredBill, status: r.status }));

      // Anything that reached the database since the preview is a duplicate now.
      const existing = await findExistingSales(tx, batch.storeId, bills.map((b) => b.bill));
      const dupIds = bills.filter((b) => existing.has(`${b.bill.invoiceNo}\u0000${b.bill.type}`)).map((b) => b.rowId);
      if (dupIds.length) {
        await tx.importRow.updateMany({ where: { id: { in: dupIds } }, data: { status: "DUPLICATE", errorCode: "DUPLICATE" } });
        bills = bills.filter((b) => !dupIds.includes(b.rowId));
      }
      bills.sort((a, b) => a.bill.occurredAt.localeCompare(b.bill.occurredAt));

      // --- Resolve members (creating POS-only members for unknown phones) ---
      const memberFor = new Map<string, string>(); // memberRef value → memberId
      let membersCreated = 0;
      const refs = new Map<string, "phone" | "code">();
      for (const { bill } of bills) {
        if (bill.type === "SALE" && bill.memberRef && bill.memberRef.kind !== "invalid") refs.set(bill.memberRef.value, bill.memberRef.kind);
      }
      const phones = [...refs].filter(([, k]) => k === "phone").map(([v]) => v);
      const codes = [...refs].filter(([, k]) => k === "code").map(([v]) => v);
      if (phones.length) {
        const found = await tx.memberIdentity.findMany({ where: { type: "PHONE", value: { in: phones } }, select: { value: true, memberId: true, verifiedAt: true } });
        for (const f of found) memberFor.set(f.value, f.memberId);
        // A phone on a bill is the store confirming it: verify it.
        const unverified = found.filter((f) => !f.verifiedAt).map((f) => f.value);
        if (unverified.length && !history) {
          await tx.memberIdentity.updateMany({ where: { type: "PHONE", value: { in: unverified } }, data: { verifiedAt: now } });
        }
      }
      if (codes.length) {
        const found = await tx.member.findMany({ where: { code: { in: codes }, status: "ACTIVE" }, select: { id: true, code: true } });
        for (const f of found) memberFor.set(f.code, f.id);
      }
      for (const phone of phones) {
        if (memberFor.has(phone)) continue;
        const existingId = await findMemberIdByIdentity(tx, "PHONE", phone);
        const id =
          existingId ??
          (await insertMember(tx, orgId, settings, {
            source: "POS",
            displayName: `ลูกค้าหน้าร้าน ${phone.slice(0, 3)}-xxx-${phone.slice(-4)}`,
            phone,
            phoneVerified: true,
          }));
        if (!existingId) membersCreated++;
        memberFor.set(phone, id);
      }

      // --- Original sales for returns / voids ---
      const sales = new Map<string, { id: string; memberId: string | null; netSatang: number }>(); // SALE invoice → sale
      const refInvoices = bills.filter((b) => b.bill.type !== "SALE").map((b) => b.bill.refInvoiceNo!);
      for (const [inv, s] of await findOriginals(tx, batch.storeId, refInvoices)) sales.set(inv, s);

      // --- Member state ---
      const memberIds = new Set<string>(memberFor.values());
      for (const inv of refInvoices) {
        const m = sales.get(inv)?.memberId;
        if (m) memberIds.add(m);
      }
      const firstAt = bills.length ? new Date(bills[0]!.bill.occurredAt).getTime() : now.getTime();
      const windowFrom = new Date(Math.min(firstAt, now.getTime()) - YEAR_MS);
      const state = new Map<string, MemberState>();
      if (memberIds.size) {
        const ids = [...memberIds];
        const [members, prior] = await Promise.all([
          tx.member.findMany({ where: { id: { in: ids } }, select: { id: true, tier: true, points: true, birthday: true, lifetimeSatang: true, lastPurchaseAt: true } }),
          tx.sale.findMany({ where: { memberId: { in: ids }, status: "POSTED", occurredAt: { gt: windowFrom } }, select: { memberId: true, occurredAt: true, netSatang: true } }),
        ]);
        for (const m of members) {
          state.set(m.id, {
            id: m.id,
            tier: m.tier,
            points: m.points,
            birthdayMonth: m.birthday ? m.birthday.getUTCMonth() + 1 : null,
            lifetimeSatang: m.lifetimeSatang,
            lastPurchaseAt: m.lastPurchaseAt,
            sales: [],
            earned: 0,
            spentSatang: 0,
            bills: 0,
            tierUp: null,
          });
        }
        for (const p of prior) state.get(p.memberId!)?.sales.push({ at: p.occurredAt.getTime(), net: p.netSatang });
      }
      // Spend as of a bill counts what came before it; spend "now" also counts bills stamped later than the server clock.
      const spendAt = (s: MemberState, at: number) => s.sales.reduce((sum, x) => (x.at > at - YEAR_MS && x.at <= at ? sum + x.net : sum), 0);
      const spendNowOf = (s: MemberState) => s.sales.reduce((sum, x) => (x.at > now.getTime() - YEAR_MS ? sum + x.net : sum), 0);

      // Points already earned / reversed on originals (for partial returns).
      const originalIds = [...sales.values()].map((s) => s.id);
      const earnedOn = new Map<string, number>();
      const reversedOn = new Map<string, number>();
      if (originalIds.length) {
        const txs = await tx.pointTransaction.findMany({ where: { saleId: { in: originalIds } }, select: { saleId: true, delta: true } });
        for (const t of txs) earnedOn.set(t.saleId!, (earnedOn.get(t.saleId!) ?? 0) + t.delta);
        const priorReturns = await tx.sale.findMany({
          where: { storeId: batch.storeId, type: { in: ["RETURN", "VOID"] }, refInvoiceNo: { in: refInvoices }, status: "POSTED" },
          select: { refInvoiceNo: true, pointTransactions: { select: { delta: true } } },
        });
        for (const r of priorReturns) {
          const orig = sales.get(r.refInvoiceNo!);
          if (!orig) continue;
          const d = r.pointTransactions.reduce((s, t) => s + t.delta, 0);
          reversedOn.set(orig.id, (reversedOn.get(orig.id) ?? 0) + d);
        }
      }

      // --- Walk the bills in time order ---
      const saleRows: Prisma.SaleCreateManyInput[] = [];
      const lineRows: Prisma.SaleLineCreateManyInput[] = [];
      const pointRows: Prisma.PointTransactionCreateManyInput[] = [];
      const eventRows: Prisma.EventCreateManyInput[] = [];
      let pointsAwarded = 0;
      let pointsReversed = 0;
      const rowUpdates: Array<{ id: string; status: ImportRowStatus; code: string | null }> = [];

      for (const { rowId, bill } of bills) {
        const at = new Date(bill.occurredAt);
        const saleId = newId();
        let memberId: string | null = null;
        if (bill.type === "SALE") {
          memberId = bill.memberRef && bill.memberRef.kind !== "invalid" ? memberFor.get(bill.memberRef.value) ?? null : null;
        } else {
          const orig = sales.get(bill.refInvoiceNo!);
          if (!orig) {
            rowUpdates.push({ id: rowId, status: "INVALID", code: "REF_NOT_FOUND" });
            continue;
          }
          memberId = orig.memberId;
        }
        if (bill.type === "SALE" && bill.memberRef && !memberId && bill.memberRef.kind === "code") {
          rowUpdates.push({ id: rowId, status: "UNMATCHED", code: "MEMBER_NOT_FOUND" });
        }

        saleRows.push({
          id: saleId,
          orgId,
          storeId: batch.storeId,
          invoiceNo: bill.invoiceNo,
          type: bill.type,
          refInvoiceNo: bill.refInvoiceNo,
          occurredAt: at,
          memberId,
          memberRef: bill.memberRef?.raw ?? null,
          grossSatang: bill.grossSatang,
          discountSatang: bill.discountSatang,
          netSatang: bill.netSatang,
          pointEligibleSatang: bill.eligibleSatang,
          paymentMethod: bill.paymentMethod,
          batchId: batch.id,
          historyOnly: history,
        });
        for (const l of bill.lines) {
          lineRows.push({
            orgId,
            saleId,
            sku: l.sku,
            name: l.name.slice(0, 200),
            brand: l.brand,
            category: l.category,
            qty: l.qty,
            unitSatang: l.unitSatang,
            netSatang: bill.type === "SALE" ? l.netSatang : -l.netSatang,
            pointExcluded: l.pointExcluded,
          });
        }
        if (bill.type === "SALE") sales.set(bill.invoiceNo, { id: saleId, memberId, netSatang: bill.netSatang });

        const s = memberId ? state.get(memberId) : undefined;
        if (!s) continue;
        s.sales.push({ at: at.getTime(), net: bill.netSatang });
        s.lifetimeSatang += bill.netSatang;
        if (bill.type === "SALE") {
          s.bills++;
          s.spentSatang += bill.netSatang;
          if (!s.lastPurchaseAt || at > s.lastPurchaseAt) s.lastPurchaseAt = at;
          eventRows.push({ orgId, memberId: s.id, type: "PURCHASE", occurredAt: at, payload: { amount: bill.netSatang / 100, currency: "THB", saleId, invoiceNo: bill.invoiceNo, batchId: batch.id, items: bill.lines.map((l) => ({ sku: l.sku ?? undefined, name: l.name, qty: l.qty, unitPrice: l.unitSatang / 100, brand: l.brand ?? undefined, category: l.category ?? undefined })) } });
          if (!history) {
            // The bill earns at the tier held before it; an upgrade applies from the next bill.
            const tier = findTier(s.tier, settings.tiers) ?? lowestTier(settings.tiers);
            const base = pointsForSatang(bill.eligibleSatang, settings.pointsPerBaht, tier.pointRate);
            if (base > 0) {
              pointRows.push({ orgId, memberId: s.id, type: "EARN", delta: base, reason: "PURCHASE", saleId, batchId: batch.id, createdAt: at });
              s.points += base;
              s.earned += base;
              pointsAwarded += base;
              earnedOn.set(saleId, base);
              const mult = tier.benefits.birthdayPointMultiplier;
              if (s.birthdayMonth && mult > 1 && localParts(at).month === s.birthdayMonth) {
                const bonus = Math.floor(base * (mult - 1));
                pointRows.push({ orgId, memberId: s.id, type: "BONUS", delta: bonus, reason: "BIRTHDAY", saleId, batchId: batch.id, createdAt: at });
                s.points += bonus;
                s.earned += bonus;
                pointsAwarded += bonus;
                earnedOn.set(saleId, base + bonus);
              }
            }
          }
          const next = reviewTier(s.tier, spendAt(s, at.getTime()) / 100, settings.tiers, { allowDowngrade: false });
          if (tierRank(next.key, settings.tiers) > tierRank(s.tier, settings.tiers)) {
            s.tier = next.key;
            s.tierUp = next.key;
            eventRows.push({ orgId, memberId: s.id, type: "TIER_UP", occurredAt: at, payload: { tier: next.key, batchId: batch.id } });
          }
        } else {
          const orig = sales.get(bill.refInvoiceNo!)!;
          eventRows.push({ orgId, memberId: s.id, type: "RETURN", occurredAt: at, payload: { amount: bill.netSatang / 100, saleId, refInvoiceNo: bill.refInvoiceNo, batchId: batch.id } });
          const earned = earnedOn.get(orig.id) ?? 0;
          const alreadyBack = -(reversedOn.get(orig.id) ?? 0);
          const remaining = Math.max(0, earned - alreadyBack);
          const share = bill.type === "VOID" || orig.netSatang <= 0 ? 1 : Math.min(1, Math.abs(bill.netSatang) / orig.netSatang);
          const back = Math.min(remaining, Math.round(earned * share));
          if (back > 0) {
            pointRows.push({ orgId, memberId: s.id, type: "REVERSAL", delta: -back, reason: bill.type === "VOID" ? "VOID" : "RETURN", saleId, batchId: batch.id, createdAt: at });
            s.points -= back;
            s.earned -= back;
            pointsReversed += back;
            reversedOn.set(orig.id, (reversedOn.get(orig.id) ?? 0) - back);
          }
        }
      }

      await createManyChunked(saleRows, 1000, (c) => tx.sale.createMany({ data: c }));
      await createManyChunked(lineRows, 2000, (c) => tx.saleLine.createMany({ data: c }));
      await createManyChunked(pointRows, 2000, (c) => tx.pointTransaction.createMany({ data: c }));
      await createManyChunked(eventRows, 1000, (c) => tx.event.createMany({ data: c }));
      for (const u of rowUpdates) await tx.importRow.updateMany({ where: { id: u.id }, data: { status: u.status, errorCode: u.code } });

      // --- Member caches, tiers and messages ---
      const outbox: OutboxItem[] = [];
      let tierUps = 0;
      for (const s of state.values()) {
        const spendNow = Math.max(0, spendNowOf(s));
        const finalTier = reviewTier(s.tier, spendNow / 100, settings.tiers, { allowDowngrade: false });
        await tx.member.update({
          where: { id: s.id },
          data: {
            points: { increment: s.earned },
            tier: finalTier.key,
            spend12mSatang: spendNow,
            lifetimeSatang: Math.max(0, s.lifetimeSatang),
            lastPurchaseAt: s.lastPurchaseAt,
          },
        });
        if (history) continue;
        if (s.bills > 0 || s.earned !== 0) {
          const progress = tierProgress(spendNow / 100, settings.tiers);
          const held = settings.tiers.indexOf(finalTier);
          const next = settings.tiers[held + 1] ?? null;
          outbox.push({
            memberId: s.id,
            kind: "POINTS",
            dedupeKey: `POINTS:${batch.id}:${s.id}`,
            payload: {
              bills: s.bills,
              spentSatang: s.spentSatang,
              earned: s.earned,
              balance: s.points,
              tierName: finalTier.name,
              nextTierName: next?.name ?? null,
              remainingBaht: next ? Math.max(0, next.minSpend12m - spendNow / 100) : null,
              pct: progress.pct,
            },
          });
        }
        if (s.tierUp) {
          tierUps++;
          const t = findTier(s.tierUp, settings.tiers)!;
          outbox.push({
            memberId: s.id,
            kind: "TIER_UP",
            dedupeKey: `TIER_UP:${batch.id}:${s.id}`,
            payload: { tierName: t.name, pointRate: t.pointRate, discountPct: t.benefits.discountPct, simDiscountPct: t.benefits.simDiscountPct },
          });
        }
      }
      await enqueue(tx, orgId, outbox);

      const before = batch.counts as unknown as ImportCounts & Record<string, unknown>;
      const final: ImportCounts = {
        ...before,
        duplicate: (before.duplicate ?? 0) + dupIds.length,
        pointsAwarded,
        pointsReversed,
        membersCreated,
        tierUps,
      };
      await tx.importBatch.update({ where: { id: batch.id }, data: { counts: final as unknown as Prisma.InputJsonValue } });
      await writeAudit(tx, orgId, actor, {
        action: "import.commit",
        entity: "import",
        entityId: batch.id,
        after: { fileName: batch.fileName, sales: saleRows.length, pointsAwarded, pointsReversed, membersCreated, mode: batch.mode },
      });
      return final;
    },
    { timeout: 180_000 },
  );

  // Remember the column mapping that worked, for the next file.
  const batch = await db(orgId).importBatch.findFirst({ where: { id: batchId }, select: { counts: true } });
  const mapping = (batch?.counts as { mapping?: PosMapping } | null)?.mapping;
  if (mapping && JSON.stringify(mapping) !== JSON.stringify(settings.pos.mapping)) {
    await updateSettings(orgId, { pos: { ...settings.pos, mapping } });
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

export async function rollbackImport(orgId: string, actor: Actor, batchId: string, reason: string): Promise<{ sales: number; pointsReversed: number }> {
  if (!reason.trim()) throw new CoreError("INVALID_INPUT", "ต้องใส่เหตุผลการยกเลิก");
  const { settings } = await getOrg(orgId);
  return inTx(
    orgId,
    async (tx) => {
      const batch = await tx.importBatch.findFirst({ where: { id: batchId } });
      if (!batch || batch.status !== "COMMITTED") throw new CoreError("IMPORT_STATE", "ยกเลิกได้เฉพาะรอบที่นำเข้าแล้ว");
      if (!batch.committedAt || Date.now() - batch.committedAt.getTime() > ROLLBACK_DAYS * 24 * 3600_000) {
        throw new CoreError("IMPORT_STATE", `ยกเลิกได้ภายใน ${ROLLBACK_DAYS} วันหลังนำเข้า`);
      }
      const sales = await tx.sale.findMany({ where: { batchId: batch.id }, select: { id: true, invoiceNo: true, memberId: true, type: true } });
      const invoices = sales.filter((s) => s.type === "SALE").map((s) => s.invoiceNo);
      if (invoices.length) {
        const laterReturn = await tx.sale.findFirst({
          where: { storeId: batch.storeId, refInvoiceNo: { in: invoices }, batchId: { not: batch.id } },
          select: { invoiceNo: true },
        });
        if (laterReturn) {
          throw new CoreError("IMPORT_STATE", `บิลคืน ${laterReturn.invoiceNo} ในรอบหลังอ้างถึงบิลในรอบนี้ — ยกเลิกรอบนั้นก่อน`);
        }
      }
      const claimed = await tx.importBatch.updateMany({
        where: { id: batch.id, status: "COMMITTED" },
        data: { status: "ROLLED_BACK", rolledBackAt: new Date(), fileHash: `${batch.fileHash}#rolledback:${Date.now()}` },
      });
      if (claimed.count !== 1) throw new CoreError("IMPORT_STATE", "รอบนี้ถูกยกเลิกไปแล้ว");

      const saleIds = sales.map((s) => s.id);
      const txs = saleIds.length
        ? await tx.pointTransaction.groupBy({ by: ["memberId"], where: { saleId: { in: saleIds } }, _sum: { delta: true } })
        : [];
      let pointsReversed = 0;
      for (const t of txs) {
        const delta = -(t._sum.delta ?? 0);
        if (delta === 0) continue;
        await tx.pointTransaction.create({
          data: { orgId, memberId: t.memberId, type: "REVERSAL", delta, reason: "ROLLBACK", batchId: batch.id, note: reason, createdById: actor.kind === "staff" ? actor.userId : null },
        });
        await tx.member.update({ where: { id: t.memberId }, data: { points: { increment: delta } } });
        pointsReversed += -delta;
      }
      await tx.event.deleteMany({ where: { type: { in: ["PURCHASE", "RETURN", "TIER_UP"] }, payload: { path: ["batchId"], equals: batch.id } } });
      await tx.notification.updateMany({
        where: { status: "PENDING", OR: [{ dedupeKey: { startsWith: `POINTS:${batch.id}:` } }, { dedupeKey: { startsWith: `TIER_UP:${batch.id}:` } }] },
        data: { status: "SKIPPED", lastError: "ยกเลิกรอบนำเข้า" },
      });
      await tx.sale.deleteMany({ where: { batchId: batch.id } });
      const affected = [...new Set(sales.flatMap((s) => (s.memberId ? [s.memberId] : [])))];
      for (const memberId of affected) await refreshMemberSpend(tx, orgId, memberId, settings, { allowDowngrade: true });
      await writeAudit(tx, orgId, actor, {
        action: "import.rollback",
        entity: "import",
        entityId: batch.id,
        before: { fileName: batch.fileName, sales: sales.length },
        after: { pointsReversed },
        reason,
      });
      return { sales: sales.length, pointsReversed };
    },
    { timeout: 120_000 },
  );
}

// ---------------------------------------------------------------------------
// History and problem rows
// ---------------------------------------------------------------------------

export interface BatchListItem {
  id: string;
  fileName: string;
  storeName: string;
  mode: ImportMode;
  status: "PREVIEW" | "COMMITTED" | "ROLLED_BACK";
  counts: ImportCounts;
  uploadedBy: string | null;
  createdAt: Date;
  committedAt: Date | null;
  rolledBackAt: Date | null;
  canRollback: boolean;
}

export async function listImports(orgId: string, limit = 50): Promise<BatchListItem[]> {
  const client = db(orgId);
  const rows = await client.importBatch.findMany({
    where: { status: { not: "PREVIEW" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { store: { select: { name: true } } },
  });
  const userIds = [...new Set(rows.flatMap((r) => (r.uploadedBy ? [r.uploadedBy] : [])))];
  const users = userIds.length ? await client.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
  const name = new Map(users.map((u) => [u.id, u.name ?? u.email]));
  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    storeName: r.store.name,
    mode: r.mode,
    status: r.status,
    counts: r.counts as unknown as ImportCounts,
    uploadedBy: r.uploadedBy ? name.get(r.uploadedBy) ?? null : null,
    createdAt: r.createdAt,
    committedAt: r.committedAt,
    rolledBackAt: r.rolledBackAt,
    canRollback: r.status === "COMMITTED" && !!r.committedAt && Date.now() - r.committedAt.getTime() < ROLLBACK_DAYS * 24 * 3600_000,
  }));
}

const STATUS_TEXT: Record<ImportRowStatus, string> = {
  OK: "นำเข้า",
  UNMATCHED: "ไม่มีเจ้าของ",
  INVALID: "ผิดรูปแบบ",
  DUPLICATE: "ซ้ำ",
};

/** CSV of every row that was not a clean import — for staff to fix in the POS. */
export async function problemRowsCsv(orgId: string, batchId: string): Promise<{ fileName: string; csv: string }> {
  const client = db(orgId);
  const batch = await client.importBatch.findFirst({ where: { id: batchId } });
  if (!batch) throw new CoreError("NOT_FOUND", "ไม่พบรอบนำเข้า");
  const rows = await client.importRow.findMany({
    where: { batchId, status: { not: "OK" } },
    orderBy: { rowNumber: "asc" },
  });
  const table: Array<Array<string | number | null>> = [["แถวในไฟล์", "เลขที่บิล", "สถานะ", "เหตุผล", "หมายเหตุบิล/สมาชิก", "ยอด (บาท)"]];
  for (const r of rows) {
    const raw = r.raw as Record<string, unknown> & Partial<StoredBill>;
    table.push([
      r.rowNumber,
      r.invoiceNo,
      STATUS_TEXT[r.status],
      String(raw.note ?? r.errorCode ?? ""),
      raw.memberRef ? raw.memberRef.raw : "",
      typeof raw.netSatang === "number" ? raw.netSatang / 100 : "",
    ]);
  }
  return { fileName: `${batch.fileName.replace(/\.[^.]+$/, "")}-problems.csv`, csv: toCsv(table) };
}

export interface DataQuality {
  days: Array<{ date: string; bills: number; withMember: number; pct: number }>;
  badRefs: number;
  unknownCodes: number;
  noRef: number;
}

/** Share of bills carrying a member, per day, over the last `days` days. */
export async function dataQuality(orgId: string, days = 30): Promise<DataQuality> {
  const client = db(orgId);
  const from = new Date(Date.now() - days * 24 * 3600_000);
  const sales = await client.sale.findMany({
    where: { type: "SALE", status: "POSTED", occurredAt: { gte: from }, historyOnly: false },
    select: { occurredAt: true, memberId: true },
  });
  const byDay = new Map<string, { bills: number; withMember: number }>();
  for (const s of sales) {
    const p = localParts(s.occurredAt);
    const key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    const d = byDay.get(key) ?? { bills: 0, withMember: 0 };
    d.bills++;
    if (s.memberId) d.withMember++;
    byDay.set(key, d);
  }
  const recentBatches = await client.importBatch.findMany({ where: { status: "COMMITTED", committedAt: { gte: from } }, select: { id: true } });
  const ids = recentBatches.map((b) => b.id);
  const group = ids.length
    ? await client.importRow.groupBy({ by: ["errorCode"], where: { batchId: { in: ids }, status: "UNMATCHED" }, _count: { _all: true } })
    : [];
  const countOf = (code: string) => group.find((g) => g.errorCode === code)?._count._all ?? 0;
  return {
    days: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d, pct: d.bills ? d.withMember / d.bills : 0 })),
    badRefs: countOf("BAD_MEMBER_REF"),
    unknownCodes: countOf("MEMBER_NOT_FOUND"),
    noRef: countOf("NO_MEMBER_REF"),
  };
}
