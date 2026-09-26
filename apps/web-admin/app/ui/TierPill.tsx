// Member / Silver / Gold badge. `rank` is the tier's position (0 = entry tier).
export function TierPill({ name, rank }: { name: string; rank: number }) {
  return <span className={`tier-pill t${Math.min(2, Math.max(0, rank))}`}>{name}</span>;
}

export function tierInfo(key: string, tiers: Array<{ key: string; name: string }>): { name: string; rank: number } {
  const i = tiers.findIndex((t) => t.key === key);
  return { name: tiers[i]?.name ?? key, rank: Math.max(0, i) };
}
