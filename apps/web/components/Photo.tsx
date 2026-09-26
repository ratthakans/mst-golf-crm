import Image from "next/image";
import type { SitePhoto } from "@/lib/images";

// A photo in a fixed-ratio frame (no layout shift), resized by next/image.
export function Photo({
  photo,
  ratio = "4 / 3",
  sizes = "(min-width: 900px) 50vw, 100vw",
  priority = false,
  className = "",
}: {
  photo: SitePhoto;
  ratio?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`photo ${className}`} style={{ aspectRatio: ratio }}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} />
    </div>
  );
}
