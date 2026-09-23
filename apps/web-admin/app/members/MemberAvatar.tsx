// A member's photo, or their initial when there is none. Photos always load
// through /api/members/[id]/photo (private storage is never exposed by URL);
// `version` changes whenever the photo does, so the browser refetches it.

const LEADING_THAI_VOWELS = /^[เแโใไ]/;

export function initialOf(name: string): string {
  const trimmed = name.trim().replace(LEADING_THAI_VOWELS, "");
  return (trimmed[0] ?? "?").toUpperCase();
}

/** Short cache-buster derived from the stored value; changes on every upload. */
export function photoVersion(pictureUrl: string | null | undefined): string | null {
  if (!pictureUrl) return null;
  return String(pictureUrl.length) + pictureUrl.slice(-10).replace(/[^a-zA-Z0-9]/g, "");
}

export function MemberAvatar({
  id,
  name,
  version,
  size = 32,
}: {
  id: string;
  name: string;
  version: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (!version) {
    return (
      <span className="avatar avatar-initial" style={style} aria-hidden="true">
        {initialOf(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="avatar"
      style={style}
      src={`/api/members/${id}/photo?v=${version}`}
      alt={`รูปของ ${name}`}
      loading="lazy"
    />
  );
}
