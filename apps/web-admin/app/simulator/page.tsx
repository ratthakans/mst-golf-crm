import { calendar, getMember, localDateKey } from "@mstgolf/core";
import { allowPage } from "../../lib/auth";
import { currentOrg } from "../../lib/org";
import { Forbidden } from "../Forbidden";
import { SimulatorView } from "./SimulatorView";

export const dynamic = "force-dynamic";

export default async function SimulatorPage({ searchParams }: { searchParams: { date?: string; member?: string } }) {
  const user = await allowPage("booking.view");
  if (!user) return <Forbidden />;
  const org = await currentOrg();
  const today = localDateKey(new Date());
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : today;
  let initial;
  try {
    initial = await calendar(org.id, date, 1);
  } catch {
    return (
      <div className="page-head">
        <h1>ซิมกอล์ฟ</h1>
        <p>ยังไม่ได้ตั้งค่า lane — ไปที่ ตั้งค่า › การจองซิม เพื่อเพิ่มสาขา เวลาเปิด และ lane</p>
      </div>
    );
  }
  const preset = searchParams.member ? await getMember(org.id, searchParams.member) : null;
  return (
    <SimulatorView
      today={today}
      initialDate={date}
      initial={JSON.parse(JSON.stringify(initial))}
      can={{ manage: user.permissions.includes("booking.manage"), block: user.permissions.includes("booking.block"), money: user.permissions.includes("dashboard.revenue") }}
      presetMember={preset && preset.status === "ACTIVE" ? { id: preset.id, code: preset.code, name: preset.displayName, phone: preset.phone, tier: preset.tier, points: preset.points, hasLine: preset.hasLine } : null}
      noShowGraceMinutes={org.settings.booking.noShowGraceMinutes}
      holdMinutes={org.settings.booking.holdMinutes}
    />
  );
}
