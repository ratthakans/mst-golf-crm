import type { Metadata, Viewport } from "next";
import "./fonts.css";
import "./globals.css";
import { siteOrigin } from "@/lib/org";

// Type: MST's Futura 100 Thai from Adobe Fonts (kit sxs5ann, loaded below) —
// Book for running text, Medium/Bold for titles and anything set heavier. The
// kit serves only the Latin subset until its owner sets the web project to
// "All characters"; until then Thai falls back to Kanit (titles, 400–700, from
// Google Fonts below) and Anuphan (text, self-hosted in fonts.css), which are
// loopless like Futura's Thai. Kanit is a plain stylesheet, not next/font:
// next/font fetches at build time and Next 14.2.35's loader crashes on Google's
// current font URLs.

export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteOrigin();
  return {
    metadataBase: new URL(origin),
    title: { default: "MST Golf — Pro shop · Club fitting · Golf Simulator", template: "%s | MST Golf" },
    description:
      "MST Golf ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 — ร้านอุปกรณ์กอล์ฟ ฟิตติ้งไม้กอล์ฟ และ Golf Simulator 3 lane จองซิมและสะสมแต้มบนเว็บไซต์",
    applicationName: "MST Golf",
    openGraph: { type: "website", locale: "th_TH", siteName: "MST Golf" },
    icons: { icon: "/icon.svg" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00A35F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://p.typekit.net" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-css-tags -- Adobe Fonts kits are served as a stylesheet */}
        <link rel="stylesheet" href="https://use.typekit.net/sxs5ann.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-css-tags, @next/next/no-page-custom-font -- the root layout covers every page; Kanit is only the Thai fallback (see above) */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
