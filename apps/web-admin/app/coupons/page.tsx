import { listStores } from "@mstgolf/core";
import { allowPage } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { Forbidden } from "../Forbidden";
import { CouponCheck } from "./CouponCheck";

export const dynamic = "force-dynamic";

// The counter's coupon screen: scan or type the code from the member's LINE,
// check it, then mark it used. The discount itself is keyed into the POS.
export default async function CouponsPage() {
  const user = await allowPage("coupons.use");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const stores = (await listStores(org.id)).filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name }));
  return (
    <>
      <div className="page-head">
        <h1>ตรวจคูปอง</h1>
        <p>สแกน QR ในหน้าคูปองของลูกค้า หรือพิมพ์รหัส MST-XXXX-XXXX · ตรวจแล้วกด ใช้คูปอง จากนั้นลดราคาใน POS ตามมูลค่าคูปอง</p>
      </div>
      <CouponCheck stores={stores} />
    </>
  );
}
