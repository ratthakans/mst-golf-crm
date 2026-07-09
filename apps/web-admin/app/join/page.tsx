import { getRepo } from "../../lib/repo";
import { SignupForm } from "./SignupForm";

export default async function JoinPage() {
  const repo = await getRepo();
  const [org, fields] = await Promise.all([
    repo.getOrg(),
    repo.getFieldDefinitions(),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>ฟอร์มสมัครสมาชิก</h1>
        <p>
          ฟอร์มเก็บข้อมูลลูกค้า — สร้างฟิลด์อัตโนมัติจาก config ขององค์กร
          เมื่อต่อ LINE แล้วจะกลายเป็นหน้า LIFF แต่ตอนนี้ก็บันทึกสมาชิกจริงได้แล้ว
          (event + แต้ม + ความยินยอม PDPA)
        </p>
      </div>

      <div className="join-wrap">
        <SignupForm
          fields={fields}
          consentText={org.consentText}
          signupBonus={org.signupBonus}
        />
        <aside className="join-aside card">
          <h3>เก็บข้อมูลอะไรบ้าง</h3>
          <ul className="collect-list">
            <li><b>ตัวตน</b> — ชื่อ เบอร์ อีเมล</li>
            <li><b>โปรไฟล์กอล์ฟ</b> — {fields.length} ฟิลด์ที่ปรับได้ (แฮนดิแคป มือถนัด แบรนด์…)</li>
            <li><b>ความยินยอม</b> — บันทึก PDPA แบบมีเวอร์ชัน</li>
          </ul>
          <h3 style={{ marginTop: 18 }}>ข้อมูลไปไหน</h3>
          <ul className="collect-list">
            <li>สร้าง <b>Member</b> (attributes แบบ JSONB)</li>
            <li>สร้าง event <b>REGISTER</b> → ป้อนกรวยและ RFM</li>
            <li>สร้าง <b>PointTransaction</b> (แต้มต้อนรับ)</li>
            <li>สร้าง <b>Consent</b> (หลักฐาน PDPA)</li>
          </ul>
          <p className="aside-foot">
            ลองเพิ่มคน แล้วเปิดหน้า <b>สมาชิก</b> — จะเห็นทันที พร้อมคะแนนและจัดกลุ่มแล้ว
          </p>
        </aside>
      </div>
    </>
  );
}
