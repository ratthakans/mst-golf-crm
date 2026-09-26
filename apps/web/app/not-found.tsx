import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="status-page">
      <Logo height={22} />
      <h1>ไม่พบหน้านี้</h1>
      <p>ลิงก์อาจเปลี่ยนไปแล้ว หรือบทความถูกนำออก</p>
      <div className="cta-row center">
        <Link href="/" className="btn btn-primary">
          กลับหน้าแรก
        </Link>
        <Link href="/blog" className="btn btn-secondary">
          บทความทั้งหมด
        </Link>
      </div>
    </main>
  );
}
