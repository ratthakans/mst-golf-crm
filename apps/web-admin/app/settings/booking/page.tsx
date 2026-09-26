import Link from "next/link";
import { listStores } from "@mstgolf/core";
import { allowPage } from "../../../lib/auth";
import { currentOrg } from "../../../lib/org";
import { Forbidden } from "../../Forbidden";
import { BookingRulesForm, LanesForm, StoreForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function BookingSettingsPage() {
  if (!(await allowPage("settings.manage"))) return <Forbidden />;
  const org = await currentOrg();
  const stores = await listStores(org.id);
  const store = stores[0] ?? null;
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <Link href="/settings" className="back-link">← ตั้งค่า</Link>
        <h1 style={{ marginTop: 6 }}>การจองซิม</h1>
        <p>ครั้งละ 1 ชั่วโมงตรงชั่วโมงตามเวลาเปิดร้าน · ส่วนลดและจำนวนวันที่จองล่วงหน้าได้ตั้งตามระดับสมาชิก</p>
      </div>
      <BookingRulesForm values={org.settings.booking} />
      <StoreForm
        store={store ? { id: store.id, code: store.code, name: store.name, address: store.address ?? "", openHours: store.openHours as Record<string, [string, string] | null> } : null}
      />
      {store && (
        <LanesForm
          storeId={store.id}
          lanes={store.lanes.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity, hourlyPrice: String(l.hourlyPriceSatang / 100), sortOrder: l.sortOrder, isActive: l.isActive }))}
        />
      )}
    </div>
  );
}
