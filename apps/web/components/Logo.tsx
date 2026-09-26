import Image from "next/image";
import Link from "next/link";

export function Logo({ href = "/", height = 24 }: { href?: string; height?: number }) {
  const width = Math.round((height * 300) / 56);
  return (
    <Link href={href} className="logo" aria-label="MST Golf หน้าแรก">
      <Image src="/mst-logo.png" alt="MST Golf" width={width} height={height} priority />
    </Link>
  );
}
