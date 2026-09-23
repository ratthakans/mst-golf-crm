// Who may do what in the back office (MST-DEV-PLAN §10). Pure data, used by
// the API routes (enforcement), the pages (enforcement) and the nav (hiding).

export const ROLES = ["SUPER_ADMIN", "MARKETING", "STORE_MANAGER", "STORE_STAFF", "CUSTOMER_SERVICE"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "ผู้ดูแลระบบ",
  MARKETING: "การตลาด / CRM",
  STORE_MANAGER: "ผู้จัดการสาขา",
  STORE_STAFF: "พนักงานหน้าร้าน",
  CUSTOMER_SERVICE: "บริการลูกค้า",
};

export type Permission =
  | "overview.view"
  | "playbook.view"
  | "playbook.act" // mark plays, generate AI copy
  | "members.view"
  | "members.create"
  | "members.edit" // profile photo and details
  | "sales.record" // log a purchase by hand
  | "import.run"
  | "segments.view"
  | "automations.view"
  | "users.manage"
  | "audit.view";

const ALL = ROLES;

const MATRIX: Record<Permission, readonly Role[]> = {
  "overview.view": ALL,
  "playbook.view": ["SUPER_ADMIN", "MARKETING", "STORE_MANAGER"],
  "playbook.act": ["SUPER_ADMIN", "MARKETING"],
  "members.view": ALL,
  "members.create": ["SUPER_ADMIN", "STORE_MANAGER", "STORE_STAFF", "CUSTOMER_SERVICE"],
  "members.edit": ["SUPER_ADMIN", "STORE_MANAGER", "STORE_STAFF", "CUSTOMER_SERVICE"],
  "sales.record": ["SUPER_ADMIN", "STORE_MANAGER"],
  "import.run": ["SUPER_ADMIN", "STORE_MANAGER"],
  "segments.view": ["SUPER_ADMIN", "MARKETING"],
  "automations.view": ["SUPER_ADMIN"],
  "users.manage": ["SUPER_ADMIN"],
  "audit.view": ["SUPER_ADMIN"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[permission].includes(role);
}

/** Every permission a role holds — sent to the client so the nav can hide links. */
export function permissionsOf(role: Role): Permission[] {
  return (Object.keys(MATRIX) as Permission[]).filter((p) => MATRIX[p].includes(role));
}
