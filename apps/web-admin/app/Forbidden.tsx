import Link from "next/link";

export function Forbidden() {
  return (
    <div className="card forbidden">
      <h1>ไม่มีสิทธิ์เข้าหน้านี้</h1>
      <p>บัญชีของคุณไม่ได้รับสิทธิ์สำหรับหน้านี้ ติดต่อผู้ดูแลระบบถ้าต้องใช้งาน</p>
      <Link href="/" className="btn btn-ghost">กลับหน้าภาพรวม</Link>
    </div>
  );
}
