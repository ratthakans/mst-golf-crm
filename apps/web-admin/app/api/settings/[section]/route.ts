import { NextResponse } from "next/server";
import {
  publishConsentText,
  saveBookingRules,
  saveLane,
  saveLineChannel,
  saveNotificationToggles,
  savePointRules,
  savePosRules,
  saveSite,
  saveStore,
  saveTiers,
  type LineChannelInput,
} from "@mstgolf/core";
import type { OpenHours, TierSettings } from "@mstgolf/shared";
import { actorOf, requireApi } from "../../../../lib/auth";
import { fail, optStr, readJson, str } from "../../../../lib/api";
import { currentOrg } from "../../../../lib/org";

// Settings are saved one section at a time; @mstgolf/core validates each.
export async function PUT(req: Request, { params }: { params: { section: string } }) {
  const user = await requireApi("settings.manage");
  if (user instanceof NextResponse) return user;
  try {
    const b = await readJson(req);
    const org = await currentOrg();
    const actor = actorOf(user);
    switch (params.section) {
      case "tiers":
        await saveTiers(org.id, actor, b.tiers as TierSettings[]);
        break;
      case "points":
        await savePointRules(org.id, actor, { welcomeBonus: Number(b.welcomeBonus), perBaht: Number(b.perBaht) });
        break;
      case "booking":
        await saveBookingRules(org.id, actor, b as never);
        break;
      case "notifications":
        await saveNotificationToggles(org.id, actor, b as never);
        break;
      case "pos":
        await savePosRules(org.id, actor, {
          memberTag: optStr(b.memberTag) ?? undefined,
          pointExcludedSkus: Array.isArray(b.pointExcludedSkus) ? (b.pointExcludedSkus as string[]) : undefined,
          pointExcludedCategories: Array.isArray(b.pointExcludedCategories) ? (b.pointExcludedCategories as string[]) : undefined,
        });
        break;
      case "site":
        await saveSite(org.id, actor, {
          lineOaUrl: optStr(b.lineOaUrl) ?? undefined,
          mapsUrl: optStr(b.mapsUrl) ?? undefined,
          siteUrl: optStr(b.siteUrl) ?? undefined,
          phone: optStr(b.phone) ?? undefined,
          address: optStr(b.address) ?? undefined,
        });
        break;
      case "store":
        await saveStore(org.id, actor, optStr(b.id) || null, {
          code: str(b.code),
          name: str(b.name),
          address: optStr(b.address),
          openHours: (b.openHours ?? {}) as OpenHours,
          isActive: b.isActive !== false,
        });
        break;
      case "lane":
        await saveLane(org.id, actor, optStr(b.id) || null, {
          storeId: str(b.storeId),
          name: str(b.name),
          capacity: Number(b.capacity),
          hourlyPrice: str(b.hourlyPrice) || Number(b.hourlyPrice),
          sortOrder: Number(b.sortOrder ?? 0),
          isActive: b.isActive !== false,
        });
        break;
      case "consent":
        await publishConsentText(org.id, actor, {
          purpose: b.purpose === "MARKETING" ? "MARKETING" : "TERMS",
          title: str(b.title),
          body: str(b.body),
        });
        break;
      case "line":
        await saveLineChannel(org.id, actor, b as unknown as LineChannelInput);
        break;
      default:
        return NextResponse.json({ error: "ไม่รู้จักหมวดการตั้งค่า" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
