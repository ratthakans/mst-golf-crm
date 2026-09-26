import type { Metadata, Viewport } from "next";
import "./fonts.css";
import "./globals.css";
import { siteOrigin } from "@/lib/org";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteOrigin();
  return {
    metadataBase: new URL(origin),
    title: { default: "MST Golf — Pro shop · Club fitting · Academy · Golf Simulator", template: "%s | MST Golf" },
    description:
      "MST Golf ชาญอิสสระ ทาวเวอร์ 1 ถนนพระราม 4 — ร้านอุปกรณ์กอล์ฟ ฟิตติ้งไม้กอล์ฟ อคาเดมี และ Golf Simulator 3 lane จองซิมและสะสมแต้มผ่าน LINE",
    applicationName: "MST Golf",
    openGraph: { type: "website", locale: "th_TH", siteName: "MST Golf" },
    icons: { icon: "/icon.svg" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b3d29",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
