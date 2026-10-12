import type { Metadata, Viewport } from "next";
import { Kanit, Lato, Montserrat } from "next/font/google";
import "./fonts.css";
import "./globals.css";
import { siteOrigin } from "@/lib/org";

// MST Golf Corporate Visual Identity: Montserrat for titles, Lato for body.
// Neither has Thai glyphs, so Thai falls back per character to Kanit
// (titles) and Anuphan (body, self-hosted in fonts.css).
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--ff-montserrat", display: "swap" });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--ff-lato", display: "swap" });
const kanit = Kanit({ subsets: ["thai", "latin"], weight: ["500", "600", "700"], variable: "--ff-kanit", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteOrigin();
  return {
    metadataBase: new URL(origin),
    title: { default: "MST Golf — Pro shop · Club fitting · Academy · Golf Simulator", template: "%s | MST Golf" },
    description:
      "MST Golf ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 — ร้านอุปกรณ์กอล์ฟ ฟิตติ้งไม้กอล์ฟ อคาเดมี และ Golf Simulator 3 lane จองซิมและสะสมแต้มบนเว็บไซต์",
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
      <body>{children}</body>
    </html>
  );
}
