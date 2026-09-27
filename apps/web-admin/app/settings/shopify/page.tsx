import Link from "next/link";
import { SKIP_TEXT, shopifyStatus, type SkipReason } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { formatBaht, formatDateTime, num } from "../../ui/format";
import { ShopifyForm, SyncNow } from "./ShopifyForm";

export const dynamic = "force-dynamic";

// Online shop (docs/th-commerce/INTEGRATION.md): orders on the MST Golf Group's
// Shopify store for Thailand are pulled nightly once their return window closes.
export default async function ShopifySettingsPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const org = await currentOrg();
  const s = await shopifyStatus(org.id);
  const r = s?.lastResult;
  const skipped = Object.entries(r?.skipped ?? {}) as Array<[SkipReason, number]>;
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>ร้านออนไลน์ (Shopify)</h1>
        <p>
          คำสั่งซื้อบนร้านออนไลน์เข้าระบบทุกคืนหลังพ้นระยะคืนสินค้า — ได้แต้ม นับยอดขึ้นระดับ และส่งข้อความ LINE เหมือนบิลหน้าร้าน ·
          จับคู่สมาชิกจากเบอร์มือถือหรืออีเมลในคำสั่งซื้อ และไม่สร้างสมาชิกใหม่ให้ผู้ที่ยังไม่ได้สมัคร
        </p>
      </div>

      <div className="card">
        <h3>สถานะ</h3>
        {s ? (
          <dl className="kv">
            <dt>ร้าน</dt>
            <dd className="mono">{s.shopDomain}</dd>
            <dt>การดึงข้อมูล</dt>
            <dd>{s.isActive ? "เปิด — ทุกคืนพร้อมงานกลางคืน" : <span className="danger-text">ปิดอยู่</span>}</dd>
            <dt>ระยะคืนสินค้า</dt>
            <dd>{s.windowDays} วัน — คำสั่งซื้อได้แต้มหลังจากนี้</dd>
            <dt>บันทึกยอดเป็นสาขา</dt>
            <dd>{s.storeName}</dd>
            <dt>ดึงล่าสุด</dt>
            <dd>{s.lastSyncAt ? formatDateTime(s.lastSyncAt) : "ยังไม่เคย"}</dd>
            <dt>ข้อมูลถึง</dt>
            <dd>{s.syncedTo ? `คำสั่งซื้อก่อน ${formatDateTime(s.syncedTo)}` : "–"}</dd>
            {s.lastError && (
              <>
                <dt>ผิดพลาดครั้งล่าสุด</dt>
                <dd className="danger-text">{s.lastError}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="muted">ยังไม่ได้เชื่อม — รอทีม MST Golf Group สร้างแอปในร้าน Shopify ของไทยและส่ง Admin API token</p>
        )}
      </div>

      {r && r.orders !== undefined && (
        <div className="card">
          <h3>รอบล่าสุด</h3>
          <dl className="kv">
            <dt>คำสั่งซื้อที่อ่าน</dt>
            <dd>{num(r.orders)}</dd>
            <dt>บันทึกเป็นยอดขาย</dt>
            <dd>{num(r.booked ?? 0)} · เป็นสมาชิก {num(r.matched ?? 0)}</dd>
            <dt>คืนสินค้าหลังพ้นระยะ</dt>
            <dd>{num(r.returns ?? 0)}</dd>
            {r.counts && (
              <>
                <dt>ยอดขาย</dt>
                <dd>{formatBaht(r.counts.salesSatang)}</dd>
                <dt>แต้ม</dt>
                <dd>+{num(r.counts.pointsAwarded ?? 0)} / −{num(r.counts.pointsReversed ?? 0)}</dd>
              </>
            )}
            {skipped.length > 0 && (
              <>
                <dt>ข้าม</dt>
                <dd>{skipped.map(([k, v]) => `${SKIP_TEXT[k]} ${num(v)}`).join(" · ")}</dd>
              </>
            )}
          </dl>
          {r.batchId && (
            <p className="muted small" style={{ marginTop: 8 }}>
              ดูรายละเอียดและยกเลิกได้ใน <Link href="/import">นำเข้ายอดขาย</Link> เหมือนไฟล์ POS
            </p>
          )}
        </div>
      )}

      {s?.isActive && <SyncNow />}

      <ShopifyForm status={s ? { shopDomain: s.shopDomain, windowDays: s.windowDays, isActive: s.isActive } : null} />

      <div className="card">
        <h3>สิ่งที่ต้องได้จากทีม MST Golf Group</h3>
        <p className="secret-note">
          ในร้าน Shopify ของไทย: Settings › Apps and sales channels › Develop apps › สร้างแอป “MST Golf Platform” ·
          เปิดสิทธิ์ Admin API <b>read_orders</b> และขอ <b>protected customer data</b> ระดับ email และ phone (ใช้จับคู่สมาชิกเท่านั้น) ·
          ติดตั้งแอปแล้วส่ง Admin API access token (ขึ้นต้น shpat_) ให้ผู้ดูแลระบบใส่ที่นี่ — ระบบอ่านอย่างเดียว ไม่แก้ข้อมูลในร้าน
        </p>
      </div>
    </div>
  );
}
