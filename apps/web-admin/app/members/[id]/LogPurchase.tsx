"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATALOG = [
  { name: "Qi10 Driver", category: "clubs", brand: "TaylorMade", price: 15192 },
  { name: "Pro V1 (1 โหล)", category: "balls", brand: "Titleist", price: 2560 },
  { name: "Performance Polo", category: "apparel", brand: "Callaway", price: 1200 },
  { name: "Pro/SL Shoes", category: "footwear", brand: "FootJoy", price: 4800 },
  { name: "ฟิตติ้ง 1 ชั่วโมง", category: "services", brand: undefined, price: 2000 },
];

export function LogPurchase({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const item = CATALOG[idx]!;
  const amount = item.price * qty;

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/members/${memberId}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        channel: "store",
        items: [{ name: item.name, category: item.category, brand: item.brand, qty, unitPrice: item.price }],
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error ?? "ผิดพลาด");
    } else {
      setMsg(`+${data.pointsAwarded} แต้ม · ระดับ ${data.newTier}`);
      router.refresh(); // re-render server component with the new event
    }
  }

  return (
    <div className="logbuy">
      <div className="logbuy-row">
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
          {CATALOG.map((c, i) => (
            <option key={c.name} value={i}>
              {c.name} — ฿{c.price.toLocaleString("en-TH")}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
          style={{ width: 64 }}
        />
        <button className="btn" onClick={submit} disabled={busy}>
          {busy ? "…" : `บันทึก ฿${amount.toLocaleString("en-TH")}`}
        </button>
      </div>
      {msg && <div className="logbuy-msg">{msg}</div>}
    </div>
  );
}
