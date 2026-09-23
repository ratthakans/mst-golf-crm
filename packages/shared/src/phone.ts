// Thai mobile numbers — one canonical form so a member is found whether the
// POS, the sign-up form or LINE wrote "081-234-5678", "+66812345678" or
// "66812345678". Pure; imported via "@mstgolf/shared/phone".

/** Canonical "0XXXXXXXXX" for a Thai mobile (06/08/09), or null if it isn't one. */
export function normalizeThaiMobile(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  const local = digits.startsWith("66") && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  return /^0[689]\d{8}$/.test(local) ? local : null;
}

/** Every stored spelling of a canonical number, for lookups against legacy rows. */
export function phoneVariants(canonical: string): string[] {
  const rest = canonical.slice(1);
  return [canonical, `+66${rest}`, `66${rest}`];
}
