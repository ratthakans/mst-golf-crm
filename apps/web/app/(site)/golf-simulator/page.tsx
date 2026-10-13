import type { Metadata } from "next";
import Link from "next/link";
import { formatThaiDate, priceFor } from "@mstgolf/core";
import { SheetHead } from "@/components/SheetHead";
import { SimScorecard } from "@/components/SimScorecard";
import { lanesToShow } from "@/lib/lanes";
import { Photo } from "@/components/Photo";
import { sitePhotos } from "@/lib/images";
import { tierClass } from "@/components/TierCards";
import { formatBaht, hoursLines } from "@/lib/format";
import { getLanes, getOrg, getStore } from "@/lib/org";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Golf Simulator — ราคา ส่วนลดสมาชิก และกติกาการจอง",
  description: "Golf Simulator 3 lane ที่ MST Golf ชาญอิสสระ ทาวเวอร์ 1 จองรายชั่วโมงบนเว็บไซต์ ส่วนลดตามระดับสมาชิก ชำระเงินที่ร้าน",
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
  const now = new Date();
  const day = lanes.length ? await lanesToShow(org.id, now) : null;
  const prices = Array.from(new Set(lanes.map((l) => l.hourlyPriceSatang))).sort((x, y) => x - y);

  const rules: Array<[string, string]> = [
    ["ช่องเวลา", `ครั้งละ ${b.slotMinutes} นาที ตรงชั่วโมง ตามเวลาเปิดร้าน จองติดกันได้`],
    ["จองได้ต่อวัน", `ไม่เกิน ${b.maxSlotsPerDay} ช่องต่อคนต่อวัน`],
    ["การจองค้าง", `มีการจองที่ยังไม่ถึงเวลาได้สูงสุด ${b.maxUpcoming} รายการ`],
    ["ถือช่องระหว่างยืนยัน", `ระบบกันช่องไว้ให้ ${b.holdMinutes} นาที ระหว่างกดยืนยัน`],
    ["ยกเลิกเอง", `ก่อนเวลาจอง ${hoursText(b.cancelHoursBefore)} หลังจากนั้นติดต่อร้าน`],
    ["ไม่มาตามนัด", `เกิน ${b.noShowGraceMinutes} นาทีโดยไม่เช็กอิน ร้านบันทึกเป็น no-show`],
    ["แจ้งเตือน", `ยืนยันการจองในหน้าการแจ้งเตือน (และอีเมลถ้าใส่ไว้) เตือนก่อนเวลา ${hoursText(b.reminderHoursBefore)}`],
    ["ชำระเงิน", "ที่ร้านตอนเช็กอิน ไม่ต้องจ่ายออนไลน์"],
  ];

  return (
    <>
      <SheetHead
        title="Golf Simulator"
        lede={`ซ้อมหรือเล่นสนามจำลองได้ทุกวัน${hours[0] ? ` (${hours[0]})` : ""} จองบนเว็บไซต์ด้วยตารางเดียวกับที่ร้านใช้ ช่องว่างจองได้ทันที`}
        actions={
          <>
            <Link href="/app/booking" className="btn btn-on-dark">
              จองซิม
            </Link>
            <a href="#rules-h" className="text-link">
              กติกาการจอง
            </a>
          </>
        }
        full
        media={<Photo photo={sitePhotos(s.site).simBays} ratio="16 / 9" priority sizes="100vw" />}
      />

      {day && (
        <section className="section section-rule" aria-labelledby="today-h">
          <div className="wrap two-col">
            <div>
              <h2 id="today-h">ช่องว่าง{day.word}</h2>
              <p className="muted">ตารางเดียวกับหน้าจอง · กดช่องว่างที่หน้าจองแล้วยืนยันได้ทันที</p>
            </div>
            <SimScorecard avail={day.avail} dateLabel={`${day.word} · ${formatThaiDate(day.at, { weekday: true, year: false })}`} />
          </div>
        </section>
      )}

      <section className="section section-rule" aria-labelledby="lanes-h">
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
        <section className="section section-rule" aria-labelledby="disc-h">
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

      <section className="section section-rule" aria-labelledby="rules-h">
        <div className="wrap two-col">
          <div>
            <h2 id="rules-h">กติกาการจอง</h2>
            <p className="muted">ลูกค้าจองเองต้องเป็นสมาชิก (สมัครฟรีด้วยเบอร์มือถือ) walk-in และโทรจองติดต่อที่ร้าน</p>
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

      <section className="closing">
        <div className="wrap">
          <div className="closing-row">
            <p>ดูช่องว่างและจองได้เลย — ชำระที่ร้านตอนเช็กอิน</p>
            <div className="cta-row">
              <Link href="/app/booking" className="btn btn-primary">
                จองซิม
              </Link>
              <Link href="/app/member" className="text-link">
                ยังไม่เป็นสมาชิก? สมัครฟรี
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
