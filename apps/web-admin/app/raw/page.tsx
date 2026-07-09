import { eventTypeCounts } from "@mstgolf/analytics";
import { getCrmData } from "../../lib/data";
import { RawData, type RawRow } from "./RawData";

export default async function RawPage() {
  const { members, events } = await getCrmData();
  const nameById = new Map(members.map((m) => [m.id, m.displayName ?? m.id]));

  const fmt = (d: Date) =>
    `${d.toLocaleDateString("en-GB")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const rows: RawRow[] = [...events]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 600)
    .map((e) => ({
      type: e.type,
      memberId: e.memberId,
      memberName: nameById.get(e.memberId) ?? e.memberId,
      time: fmt(e.occurredAt),
      payload: e.payload && Object.keys(e.payload).length ? JSON.stringify(e.payload) : "—",
    }));

  return <RawData rows={rows} typeCounts={eventTypeCounts(events)} totalEvents={events.length} />;
}
