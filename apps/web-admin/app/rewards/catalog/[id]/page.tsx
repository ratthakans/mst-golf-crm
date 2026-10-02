import Link from "next/link";
import { notFound } from "next/navigation";
import { db, localDateKey } from "@mstgolf/core";
import { allowPage } from "../../../../lib/auth";
import { currentOrg } from "../../../../lib/org";
import { Forbidden } from "../../../Forbidden";
import { RewardForm, StockForm, type RewardFormValues } from "./RewardForm";

export const dynamic = "force-dynamic";

export default async function RewardEditPage({ params }: { params: { id: string } }) {
  const user = await allowPage("rewards.manage");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const isNew = params.id === "new";
  const r = isNew ? null : await db(org.id).reward.findFirst({ where: { id: params.id } });
  if (!isNew && !r) notFound();
  const used = r ? await db(org.id).redemption.count({ where: { rewardId: r.id } }) : 0;
  const values: RewardFormValues = r
    ? {
        kind: r.kind,
        name: r.name,
        description: r.description,
        terms: r.terms,
        imageUrl: r.imageUrl ?? "",
        costPoints: String(r.costPoints),
        valueBaht: r.valueSatang ? String(r.valueSatang / 100) : "",
        minSpendBaht: r.minSpendSatang ? String(r.minSpendSatang / 100) : "",
        validDays: r.validDays ? String(r.validDays) : "",
        fulfilment: r.fulfilment ?? "",
        stock: r.stock === null ? "" : String(r.stock),
        perMemberLimit: r.perMemberLimit ? String(r.perMemberLimit) : "",
        minTier: r.minTier ?? "",
        startsAt: r.startsAt ? localDateKey(r.startsAt) : "",
        endsAt: r.endsAt ? localDateKey(r.endsAt) : "",
        isActive: r.isActive,
        sortOrder: String(r.sortOrder),
      }
    : {
        kind: "COUPON",
        name: "",
        description: "",
        terms: "ใช้ได้ 1 ครั้งต่อ 1 บิล · ใช้ร่วมกับโปรโมชันอื่นไม่ได้ · ไม่สามารถแลกเป็นเงินสด",
        imageUrl: "",
        costPoints: "",
        valueBaht: "",
        minSpendBaht: "",
        validDays: "30",
        fulfilment: "7–14 วัน ขึ้นกับสต็อก",
        stock: "",
        perMemberLimit: "",
        minTier: "",
        startsAt: "",
        endsAt: "",
        isActive: true,
        sortOrder: "0",
      };

  return (
    <div className="stack">
      <Link href="/rewards/catalog" className="back-link">← แคตตาล็อก</Link>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>{isNew ? "เพิ่มรางวัล" : r!.name}</h1>
        {!isNew && <p>แลกไปแล้ว {used.toLocaleString("en-US")} ครั้ง · แก้ชื่อ/แต้มได้ตลอด รายการที่แลกไปแล้วเก็บค่าตอนแลกไว้</p>}
      </div>
      <RewardForm id={isNew ? null : r!.id} values={values} tiers={org.settings.tiers.map((t) => ({ key: t.key, name: t.name }))} kindLocked={used > 0} />
      {r && r.stock !== null && <StockForm id={r.id} stock={r.stock} />}
    </div>
  );
}
