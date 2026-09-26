// Every rule the core enforces fails with a CoreError: a stable code for the
// API and tests, and a Thai message that can be shown to staff or customers.

export type CoreErrorCode =
  | "NOT_FOUND"
  | "PHONE_INVALID"
  | "PHONE_TAKEN"
  | "LINE_TAKEN"
  | "ALREADY_MEMBER"
  | "MEMBER_INACTIVE"
  | "INVALID_INPUT"
  | "FORBIDDEN"
  | "LIMIT_EXCEEDED"
  | "SLOT_TAKEN"
  | "SLOT_UNAVAILABLE"
  | "HOLD_EXPIRED"
  | "BOOKING_RULE"
  | "IMPORT_STATE"
  | "IMPORT_FILE";

const STATUS: Partial<Record<CoreErrorCode, number>> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  PHONE_TAKEN: 409,
  LINE_TAKEN: 409,
  ALREADY_MEMBER: 409,
  SLOT_TAKEN: 409,
  HOLD_EXPIRED: 409,
  IMPORT_STATE: 409,
};

export class CoreError extends Error {
  readonly status: number;
  constructor(
    readonly code: CoreErrorCode,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CoreError";
    this.status = STATUS[code] ?? 400;
  }
}

export function isCoreError(e: unknown): e is CoreError {
  return e instanceof CoreError;
}

/** Prisma unique-constraint violation (P2002), without importing Prisma's error classes. */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
