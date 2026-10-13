import type { Metadata, Viewport } from "next";
import { Kanit, Lato, Montserrat } from "next/font/google";
import "./fonts.css";
import "./globals.css";
import { siteOrigin } from "@/lib/org";

// Type: MST's Futura 100 Thai from Adobe Fonts (kit sxs5ann, loaded below) —
// it carries Thai and Latin, Book for running text, Medium/Bold for titles and
// anything set heavier. Montserrat / Lato / Kanit / Anuphan stay as fallbacks
// should the kit fail to load.
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--ff-montserrat", display: "swap", preload: false });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--ff-lato", display: "swap", preload: false });
const kanit = Kanit({ subsets: ["thai", "latin"], weight: ["500", "600", "700"], variable: "--ff-kanit", display: "swap", preload: false });

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
    <html lang="th" className={`${montserrat.variable} ${lato.variable} ${kanit.variable}`}>
      <head>
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://p.typekit.net" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-css-tags -- Adobe Fonts kits are served as a stylesheet */}
        <link rel="stylesheet" href="https://use.typekit.net/sxs5ann.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
