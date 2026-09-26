"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="status-page">
      <h1>ระบบขัดข้องชั่วคราว</h1>
      <p>ขออภัยในความไม่สะดวก ลองโหลดหน้านี้อีกครั้ง หากยังไม่ได้กรุณาติดต่อร้าน</p>
      <div className="cta-row center">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          ลองอีกครั้ง
        </button>
        <Link href="/" className="btn btn-secondary">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
