import Image from "next/image";
import type { SitePhoto } from "@/lib/images";

const BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;

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
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        priority={priority}
        // Uploads (public Blob) and /public files are resized; any other https link MST pastes is shown as is.
        unoptimized={!photo.src.startsWith("/") && !BLOB.test(photo.src)}
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}
