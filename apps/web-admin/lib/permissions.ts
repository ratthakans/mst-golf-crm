// Who may do what in the back office (docs/PRODUCT.md §9.2). Pure data, used by
// the API routes (enforcement), the pages (enforcement) and the nav (hiding).

export const ROLES = ["SUPER_ADMIN", "MARKETING", "STORE_MANAGER", "STORE_STAFF", "CUSTOMER_SERVICE"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "ผู้ดูแลระบบ",
  MARKETING: "การตลาด",
  STORE_MANAGER: "ผู้จัดการสาขา",
  STORE_STAFF: "พนักงานหน้าร้าน",
  CUSTOMER_SERVICE: "บริการลูกค้า",
};

export type Permission =
  | "dashboard.view"
  | "dashboard.revenue" // money figures on the dashboard
  | "members.view"
  | "members.create"
  | "members.edit" // profile, phone, photo
  | "points.adjust" // limits per role live in @mstgolf/core (ADJUST_LIMIT)
  | "members.merge"
  | "members.erase"
  | "reviews.request" // ask for a merge / erasure
  | "reviews.resolve"
  | "import.run" // upload, commit, roll back POS files
  | "booking.view"
  | "booking.manage" // create, move, check in, no-show, cancel
  | "booking.block" // close a lane
  | "posts.manage"
  | "settings.manage"
  | "users.manage"
  | "audit.view"
  // Out of the Phase 1 contract — only when settings.features.intelligence is on.
  | "playbook.view"
  | "playbook.act"
  | "segments.view"
  | "automations.view";

const ALL = ROLES;
const FRONT = ["SUPER_ADMIN", "STORE_MANAGER", "STORE_STAFF", "CUSTOMER_SERVICE"] as const;

const MATRIX: Record<Permission, readonly Role[]> = {
  "dashboard.view": ALL,
  "dashboard.revenue": ["SUPER_ADMIN", "MARKETING", "STORE_MANAGER", "CUSTOMER_SERVICE"],
  "members.view": ALL,
  "members.create": FRONT,
  "members.edit": FRONT,
  "points.adjust": ["SUPER_ADMIN", "STORE_MANAGER", "CUSTOMER_SERVICE"],
  "members.merge": ["SUPER_ADMIN"],
  "members.erase": ["SUPER_ADMIN"],
  "reviews.request": ["SUPER_ADMIN", "STORE_MANAGER", "CUSTOMER_SERVICE"],
  "reviews.resolve": ["SUPER_ADMIN"],
  "import.run": ["SUPER_ADMIN", "STORE_MANAGER"],
  "booking.view": ALL,
  "booking.manage": FRONT,
  "booking.block": ["SUPER_ADMIN", "STORE_MANAGER"],
  "posts.manage": ["SUPER_ADMIN", "MARKETING"],
  "settings.manage": ["SUPER_ADMIN"],
  "users.manage": ["SUPER_ADMIN"],
  "audit.view": ["SUPER_ADMIN"],
  "playbook.view": ["SUPER_ADMIN", "MARKETING"],
  "playbook.act": ["SUPER_ADMIN", "MARKETING"],
  "segments.view": ["SUPER_ADMIN", "MARKETING"],
  "automations.view": ["SUPER_ADMIN"],
};

export const INTELLIGENCE_PERMISSIONS: Permission[] = ["playbook.view", "playbook.act", "segments.view", "automations.view"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[permission].includes(role);
}

/** Every permission a role holds — sent to the client so the nav can hide links. */
export function permissionsOf(role: Role, opts: { intelligence?: boolean } = {}): Permission[] {
  return (Object.keys(MATRIX) as Permission[]).filter(
    (p) => MATRIX[p].includes(role) && (opts.intelligence || !INTELLIGENCE_PERMISSIONS.includes(p)),
  );
}
