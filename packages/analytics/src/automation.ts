import type { MemberProfile } from "./segments-engine";

// Behavioural triggers → actions. The worker (workers/jobs) evaluates these on a
// schedule / on events; here we compute who is eligible RIGHT NOW so the
// dashboard can preview each automation's audience.

export type AutomationTrigger =
  | { type: "no_activity_days"; days: number }
  | { type: "near_tier_up"; minProgress: number } // 0–1 of the way to the next tier (12-month spend)
  | { type: "high_churn_risk"; minProbability: number }
  | { type: "vip_by_clv"; minClv: number };

export type AutomationAction =
  | { type: "send_message"; template: string }
  | { type: "grant_coupon"; label: string }
  | { type: "grant_points"; amount: number };

export interface Automation {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled: boolean;
}

export function isEligible(profile: MemberProfile, trigger: AutomationTrigger): boolean {
  switch (trigger.type) {
    case "no_activity_days":
      return profile.recencyDays >= trigger.days;
    case "near_tier_up":
      return profile.nextTierPct !== null && profile.nextTierPct >= trigger.minProgress;
    case "high_churn_risk":
      return profile.churnProbability >= trigger.minProbability;
    case "vip_by_clv":
      return profile.clv >= trigger.minClv;
    default:
      return false;
  }
}

export function eligibleMembers(
  profiles: MemberProfile[],
  trigger: AutomationTrigger,
): MemberProfile[] {
  return profiles.filter((p) => isEligible(p, trigger));
}

// Default automations for MST Golf — behaviour + statistics driven. (THB / Thai)
export const DEFAULT_AUTOMATIONS: Automation[] = [
  {
    id: "winback-60",
    name: "ดึงกลับ (เงียบ 60 วัน)",
    trigger: { type: "no_activity_days", days: 60 },
    action: { type: "grant_coupon", label: "คูปองต้อนรับกลับ ลด 15%" },
    enabled: true,
  },
  {
    id: "near-next-tier",
    name: "ใกล้เลื่อนระดับ (ยอด 12 เดือนถึง 80% ของระดับถัดไป)",
    trigger: { type: "near_tier_up", minProgress: 0.8 },
    action: { type: "send_message", template: "อีกนิดเดียวก็เลื่อนระดับสมาชิกแล้ว — ซื้ออีกครั้งก็ถึง!" },
    enabled: true,
  },
  {
    id: "churn-risk",
    name: "เสี่ยงหลุดสูง (p ≥ 0.7)",
    trigger: { type: "high_churn_risk", minProbability: 0.7 },
    action: { type: "grant_points", amount: 1600 },
    enabled: true,
  },
  {
    id: "vip",
    name: "ดูแล VIP (CLV ≥ ฿80,000)",
    trigger: { type: "vip_by_clv", minClv: 80000 },
    action: { type: "send_message", template: "เชิญสมาชิก VIP จองฟิตติ้งก่อนใคร" },
    enabled: true,
  },
];
