import type { Metadata } from "next";
import Link from "next/link";
import { priceFor } from "@mstgolf/core";
import { LanePlan } from "@/components/Illustrations";
import { tierClass } from "@/components/TierCards";
import { formatBaht, hoursLines } from "@/lib/format";
import { getLanes, getOrg, getStore } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Golf Simulator — ราคา ส่วนลดสมาชิก และกติกาการจอง",
  description: "Golf Simulator 3 lane ที่ MST Golf ชาญอิสสระ ทาวเวอร์ 1 จองรายชั่วโมงผ่าน LINE หรือเว็บไซต์ ส่วนลดตามระดับสมาชิก ชำระเงินที่ร้าน",
  alternates: { canonical: "/golf-simulator" },
  openGraph: { title: "Golf Simulator | MST Golf", url: "/golf-simulator" },
};

const hoursText = (h: number) => (Number.isInteger(h) ? `${h} ชั่วโมง` : `${h * 60} นาที`);

export default async function SimulatorPage() {
  const [org, lanes, store] = await Promise.all([getOrg(), getLanes(), getStore()]);
  const s = org.settings;
  const b = s.booking;
  const base = lanes[0]?.hourlyPriceSatang ?? null;
  const samePrice = lanes.every((l) => l.hourlyPriceSatang === base);
  const hours = store ? hoursLines(store.openHours) : [];

  const rules: Array<[string, string]> = [
    ["ช่องเวลา", `ครั้งละ ${b.slotMinutes} นาที ตรงชั่วโมง ตามเวลาเปิดร้าน จองติดกันได้`],
    ["จองได้ต่อวัน", `ไม่เกิน ${b.maxSlotsPerDay} ช่องต่อคนต่อวัน`],
    ["การจองค้าง", `มีการจองที่ยังไม่ถึงเวลาได้สูงสุด ${b.maxUpcoming} รายการ`],
    ["ถือช่องระหว่างยืนยัน", `ระบบกันช่องไว้ให้ ${b.holdMinutes} นาที ระหว่างกดยืนยัน`],
    ["ยกเลิกเอง", `ก่อนเวลาจอง ${hoursText(b.cancelHoursBefore)} หลังจากนั้นติดต่อร้าน`],
    ["ไม่มาตามนัด", `เกิน ${b.noShowGraceMinutes} นาทีโดยไม่เช็กอิน ร้านบันทึกเป็น no-show`],
    ["แจ้งเตือน", `ข้อความยืนยันทาง LINE และเตือนก่อนเวลา ${hoursText(b.reminderHoursBefore)}`],
    ["ชำระเงิน", "ที่ร้านตอนเช็กอิน ไม่ต้องจ่ายออนไลน์"],
  ];

  return (
    <>
      <section className="page-head sim-head">
        <div className="wrap sim-head-grid">
          <div>
            <h1>Golf Simulator</h1>
            <p className="lede">
              {lanes.length || 3} lane ในร้าน ซ้อมหรือเล่นสนามจำลองได้ทุกวัน {hours[0] ? `(${hours[0]})` : ""} จองผ่าน LINE หรือเว็บไซต์ด้วยตารางเดียวกัน
            </p>
            <div className="cta-row">
              <Link href="/app/booking" className="btn btn-primary">
                จองซิม
              </Link>
            </div>
          </div>
          <div className="sim-head-visual">
            <LanePlan lanes={lanes.length ? lanes : [1, 2, 3].map((n) => ({ id: String(n), name: `Lane ${n}` }))} />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="lanes-h">
        <div className="wrap two-col">
          <div>
            <h2 id="lanes-h">Lane และราคา</h2>
            <p className="muted">ราคาต่อชั่วโมงต่อ lane ไม่ว่าจะมากี่คน</p>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Lane</th>
                <th scope="col">จำนวนคน</th>
                <th scope="col" className="r">
                  ราคา / ชม.
                </th>
              </tr>
            </thead>
            <tbody>
              {lanes.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td className="num">สูงสุด {l.capacity} คน</td>
                  <td className="r num">{formatBaht(l.hourlyPriceSatang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {base !== null && (
        <section className="section section-tint" aria-labelledby="disc-h">
          <div className="wrap two-col">
            <div>
              <h2 id="disc-h">ส่วนลดตามระดับสมาชิก</h2>
              <p className="muted">ระบบคิดส่วนลดให้อัตโนมัติและแสดงราคาก่อนยืนยันทุกครั้ง{samePrice ? "" : " (ตัวอย่างคิดจากราคา lane แรก)"}</p>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">ระดับ</th>
                  <th scope="col">ส่วนลด</th>
                  <th scope="col">จองล่วงหน้า</th>
                  <th scope="col" className="r">
                    ราคา / ชม.
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.tiers.map((t) => (
                  <tr key={t.key}>
                    <td>
                      <span className={`tier-dot tier-${tierClass(t.key)}`} aria-hidden="true" />
                      {t.name}
                    </td>
                    <td className="num">{t.benefits.simDiscountPct ? `${t.benefits.simDiscountPct}%` : "—"}</td>
                    <td className="num">{t.benefits.simBookingDaysAhead} วัน</td>
                    <td className="r num">
                      <b>{formatBaht(priceFor(base, b.slotMinutes, t.benefits.simDiscountPct))}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="rules-h">
        <div className="wrap two-col">
          <div>
            <h2 id="rules-h">กติกาการจอง</h2>
            <p className="muted">ลูกค้าจองเองต้องเป็นสมาชิก (สมัครฟรีผ่าน LINE) walk-in และโทรจองติดต่อที่ร้าน</p>
          </div>
          <dl className="rules">
            {rules.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="cta-band">
        <div className="wrap cta-band-inner">
          <h2>ดูช่องว่างและจองได้เลย</h2>
          <div className="cta-row">
            <Link href="/app/booking" className="btn btn-on-dark">
              จองซิม
            </Link>
            <Link href="/app/member" className="btn btn-quiet-dark">
              ยังไม่เป็นสมาชิก? สมัครฟรี
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
