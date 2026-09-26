import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { addDays, availability, findMemberByLine, isCoreError, localDateKey } from "@mstgolf/core";
import { BookingApp } from "@/components/customer/BookingApp";
import { LoginPanel } from "@/components/customer/LoginPanel";
import { getOrg, getStore, loginSetup } from "@/lib/org";
import { currentLineUser } from "@/lib/session";
import type { AvailabilityData } from "@/lib/types";
import { loadBookings, loadCard } from "@/lib/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "จองซิมกอล์ฟ",
  description: "จอง Golf Simulator ที่ MST Golf ผ่าน LINE หรือเว็บไซต์ เลือกวัน เวลา lane และจำนวนคน",
  robots: { index: false, follow: false },
};

// /app/booking — Rich Menu button D in LINE, "จองซิม" on the website.
export default async function BookingPage() {
  const org = await getOrg();
  const [setup, user] = await Promise.all([loginSetup(org.id), currentLineUser()]);

  if (!org.settings.features.booking) {
    return (
      <section className="panel login-panel">
        <h1>ระบบจองออนไลน์ยังไม่เปิด</h1>
        <p className="muted">ระหว่างนี้จองซิมกอล์ฟได้ที่หน้าร้านหรือทาง LINE OA</p>
      </section>
    );
  }
  if (!user) return <LoginPanel setup={setup} purpose="booking" />;

  const member = await findMemberByLine(org.id, user.sub);
  if (!member) redirect("/app/member?next=booking");

  const todayKey = localDateKey(new Date());
  const [card, bookings, store] = await Promise.all([loadCard(org.id, member.id), loadBookings(org.id, member.id), getStore()]);
  let initialDate = todayKey;
  let initial: AvailabilityData | null = null;
  let unavailable: string | null = null;
  try {
    initial = await availability(org.id, todayKey);
    // Late in the day (or on a closed day) open on tomorrow instead of an empty grid.
    const nothingLeft = !initial.open || initial.slots.every((s) => s.lanes.every((l) => l.state === "past"));
    if (nothingLeft && card.tier.bookingDaysAhead >= 1) {
      initialDate = localDateKey(addDays(new Date(), 1));
      initial = await availability(org.id, initialDate);
    }
  } catch (e) {
    if (!isCoreError(e)) throw e;
    unavailable = e.message;
  }
  const b = org.settings.booking;

  return (
    <BookingApp
      todayKey={todayKey}
      initialDate={initialDate}
      daysAhead={card.tier.bookingDaysAhead}
      tierName={card.tierName}
      simDiscountPct={card.tier.simDiscountPct}
      initial={initial}
      unavailable={unavailable}
      bookings={bookings}
      rules={{
        holdMinutes: b.holdMinutes,
        cancelHoursBefore: b.cancelHoursBefore,
        reminderHoursBefore: b.reminderHoursBefore,
        maxSlotsPerDay: b.maxSlotsPerDay,
      }}
      storeName={store?.name ?? org.name}
    />
  );
}
