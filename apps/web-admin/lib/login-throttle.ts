// Best-effort brute-force brake: 5 wrong passwords for an email locks it for
// 15 minutes. In-memory, so per server instance — a speed bump, not a wall.
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const state = new Map<string, { fails: number; until: number }>();

export function isLocked(email: string): boolean {
  const s = state.get(email);
  return !!s && s.until > Date.now();
}

export function recordFailure(email: string): void {
  const s = state.get(email) ?? { fails: 0, until: 0 };
  s.fails += 1;
  if (s.fails >= MAX_FAILS) {
    s.until = Date.now() + LOCK_MS;
    s.fails = 0;
  }
  state.set(email, s);
}

export function clearFailures(email: string): void {
  state.delete(email);
}
