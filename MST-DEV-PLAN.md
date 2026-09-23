# MST Golf Platform — แผนพัฒนาระบบ ฉบับสมบูรณ์

**Know Every Golfer. Create Every Next Move.**
**MST Golf Platform** — ระบบ Customer Intelligence ของ MST Golf ที่รวมหน้าร้าน LINE สมาชิก แต้ม รางวัล ซิม และแคมเปญ ไว้ในโปรไฟล์ลูกค้าเดียว

`v3 · 23 ก.ย. 2026 · อ้างอิง repo commit 2d0c57f · ทีม: คุณ + Claude · เริ่ม 28 ก.ย. 2026`

---

## สารบัญ

0. การตัดสินใจที่ล็อกแล้ว
1. ผลิตภัณฑ์คืออะไร
2. ระบบเดิม — เก็บ ย้าย ตัด เลื่อน
3. สถาปัตยกรรม
4. โครงข้อมูล
5. กติกาทางธุรกิจ (สเปกตรรกะ)
6. หลังบ้าน — ทุกหน้าจอ
7. หน้าลูกค้าใน LINE — ทุกหน้าจอ
8. การเชื่อม LINE
9. ชั้น AI
10. สิทธิ์ผู้ใช้ห้าระดับ
11. แผนงานรายสัปดาห์
12. การทดสอบ
13. การย้ายข้อมูลและเปิดใช้
14. การดูแลหลังเปิดใช้
15. คำถามที่ต้องได้จาก MST พร้อมค่าตั้งต้น
16. ความเสี่ยง

---

## 0 · การตัดสินใจที่ล็อกแล้ว

| เรื่อง | ตัดสินใจ | ผลต่อแผน |
|---|---|---|
| ขอบเขต | **ครบตามสเปก** (หลังปรับข้อที่ทำไม่ได้จริงตามข้อ 9) | PMS ลากย้ายได้ · A/B · ระบบแนะนำคู่ซ้ำ · ห้า role ครบ |
| POS | **export รายบรรทัดสินค้า + หมายเหตุบิลได้** | เก็บระดับ SKU · affinity ระดับแบรนด์/หมวด/สินค้าทำได้เต็ม |
| ยืนยันเบอร์ | **ยืนยันที่หน้าร้าน** ไม่มี OTP | เบอร์ verified เมื่อบิลแรกที่มี `MSTMEMBER` ตรงกับเบอร์นั้น · ไม่มีค่า SMS |
| ค่าซิม | **จ่ายหน้าร้าน** | ไม่มี payment gateway · จองฟรี จ่ายตอน check-in |
| ฐานะของระบบ | **แพลตฟอร์มของเรา** ชื่อ **MST Golf Platform** · MST เป็น tenant แรก | เก็บ multi-tenant ทั้งหมด · ลิขสิทธิ์โค้ดเป็นของเรา · หน้าจอลูกค้าเป็นแบรนด์ MST 100% |
| ทีม | **คุณ + Claude** งานเดินทีละสาย | แผนเรียงลำดับ ไม่มีงานขนาน · ~28 สัปดาห์รวมวันหยุด |
| จำนวนสมาชิก | **ยังไม่รู้** | ออกแบบให้รองรับถึง 50,000 สมาชิก / 20,000 บิลต่อเดือน · A/B เปิดอัตโนมัติเมื่อกลุ่มใหญ่พอ |
| ราคา | ไม่อยู่ในแผนนี้ | |

---

## 1 · ผลิตภัณฑ์คืออะไร

### วงจรของระบบ

```
COLLECT     POS · LINE · Booking · Redeem
   ↓
IDENTIFY    MST Customer ID — คนเดียว โปรไฟล์เดียว
   ↓
UNDERSTAND  Customer 360
   ↓
DISCOVER    Opportunity (สถิติคำนวณ → AI อธิบาย)
   ↓
ACT         Campaign · Offer · Reward · Creative   ← มนุษย์อนุมัติก่อนส่ง
   ↓
MEASURE     เทียบคนที่ได้รับกับกลุ่มควบคุม → รายได้ที่เพิ่มจริง
   ↓
LEARN       ผลย้อนหลังกลายเป็นบริบทของแคมเปญถัดไป
```

### โมดูล

| รหัส | โมดูล | สิ่งที่ทำ |
|---|---|---|
| **P** | Platform | tenant · login · role · audit · settings · job · feature flag |
| **I** | Identity | MST Customer ID · ผูก LINE/เบอร์/POS/อีเมล · merge · PDPA |
| **S** | Sales | POS import · สินค้า · บิล · การคืน · data quality |
| **L** | Loyalty | แต้ม ledger · กติกาแต้ม · หมดอายุ · tier · สิทธิประโยชน์ |
| **R** | Rewards | แคตตาล็อก · แลก · โค้ด · อนุมัติ |
| **B** | Booking | จองซิม · PMS · check-in · no-show · block lane |
| **C** | Campaigns | segment · offer · creative · อนุมัติ · ส่ง · วัดผล · A/B |
| **N** | Intelligence | RFM · CLV · churn · affinity · opportunity · AI brief · AI creative |
| **X** | LINE Experience | LIFF · Rich Menu · แจ้งเตือน |

Booking เป็นโมดูลที่ปิด/เปิดได้ต่อ tenant — tenant ถัดไปที่ไม่มีซิมก็ใช้ระบบเดียวกันได้

---

## 2 · ระบบเดิม — เก็บ ย้าย ตัด เลื่อน

### เก็บ

| ส่วน | บทบาทใหม่ |
|---|---|
| `packages/analytics` ทั้งหมด + tests | หัวใจของ Intelligence |
| `apps/web-admin/lib/playbook.ts` (10 plays) + `/playbook` | ACTION PLAN |
| `/members` · `/members/[id]` | MEMBERS · Customer 360 |
| `/` · `DailyBriefing` · `/api/ai/briefing` | OVERVIEW · AI Brief |
| `/api/ai/campaign` · `lib/ai.ts` | AI Creative (ย้าย model ID ไปเป็น env `AI_MODEL`) |
| `PointTransaction` · `Consent` · `LineChannel` · `FieldDefinition` · `RfmSnapshot` · `Segment` · `Automation` | ขยายต่อ ไม่รื้อ |
| `forOrg()` · `encrypt()/decrypt()` | ใช้ต่อทุกที่ |
| `Organization` · `Plan` · `settings` JSON | ใช้ต่อ — เป็นแพลตฟอร์ม |
| sample-data mode + `generator` + `fixture` | dev · demo · tests เท่านั้น |

### ย้าย

| ส่วน | ไปที่ |
|---|---|
| `/join` | `apps/web-liff` หน้าสมัครสมาชิก |
| `/segments` | ขั้น WHO ใน wizard แคมเปญ + ตัวกรองใน MEMBERS |
| `/import` | สร้างใหม่ทั้งหมดเป็น POS IMPORT |
| `workers/jobs/nightly.ts` | route `/api/cron/nightly` เรียกจาก Vercel Cron |

### ตัด

| ส่วน | เหตุผล |
|---|---|
| `/quote` | เครื่องมือขาย ไม่ใช่ผลิตภัณฑ์ |
| `/data-model` | เอกสาร dev อยู่ในหน้าจอลูกค้า |
| `/raw` | เสี่ยง PDPA |
| `/analytics` `/insights` `/operations` (หน้า) | ซ้อนกัน · ตัวเลขย้ายเข้า OVERVIEW และ 360 · ฟังก์ชันเก็บ |
| `apps/api` (NestJS เปล่า) | API อยู่ใน Next.js สองแอป |
| Redis + BullMQ | ตาราง `Job` ใน Postgres + Vercel Cron |
| tier จากแต้มคงเหลือ · tier `"Silver"` hardcode ตอน import | ผิดตรรกะและผิดกฎ `CLAUDE.md` |
| `lineUserId` ปลอม `pos:…` `web:…` | แทนด้วย `MemberIdentity` |

### เลื่อน (ไม่ตัด เพราะเป็นแพลตฟอร์ม)

| ส่วน | ทำเมื่อ |
|---|---|
| หน้า `/automations` | เฟส 4 · engine พร้อมแล้ว |
| Tenant self-onboarding · billing · UI ตั้งค่า LINE ต่อ tenant | เมื่อมี tenant รายที่สอง · ระหว่างนี้ใช้ seed script |

### เรื่องชื่อ

ชื่อผลิตภัณฑ์คือ **MST Golf Platform** — ใช้ในหลังบ้าน เอกสาร สัญญา และโดเมน · หน้าจอลูกค้าใน LINE ใช้แบรนด์ MST Golf
คำว่า Golffy เลิกใช้ทั้งหมด (ตรงกับกฎใน `CLAUDE.md` เดิม)

ชื่อที่แสดงในหน้าจออ่านจาก config ของ tenant (`Organization.name` + แบรนด์ใน Settings) ไม่ hardcode ในโค้ด
tenant รายถัดไปจึงได้ชื่อของตัวเองโดยไม่ต้องแก้โค้ด

| ที่ | ค่า |
|---|---|
| ชื่อในหลังบ้าน · title · อีเมลระบบ | MST Golf Platform |
| โดเมนหลังบ้าน | เปลี่ยนจาก `golffy.vercel.app` → เช่น `mst-golf-platform.vercel.app` หรือโดเมนของ MST |
| โดเมน LIFF | ตั้งใน W8 ตามชื่อเดียวกัน |
| ชื่อ LINE OA · Rich Menu · LIFF | MST Golf |

---

## 3 · สถาปัตยกรรม

```
                      LINE Provider "MST Golf"  (ต้องเป็น provider เดียวกัน — ดูข้อ 8)
               ┌───────────────┴────────────────┐
     Messaging API channel              LINE Login channel
     webhook · push · multicast          LIFF apps
     Rich Menu (ผูกรายคน)                     │
               │                                │
               ▼                                ▼
     ┌─────────────────────────────────────────────────┐
     │ apps/web-liff  (Next.js · Vercel project ใหม่)    │
     │ /liff/*  หน้าลูกค้า                               │
     │ /api/line/webhook                                │
     │ /api/liff/*  API ฝั่งลูกค้า (ตรวจ LIFF ID token)     │
     │ /r/:token  ลิงก์ติดตามแคมเปญ                        │
     └─────────────────────┬───────────────────────────┘
                           │
                  packages/core  ← ตรรกะธุรกิจทั้งหมดอยู่ที่นี่ (ใหม่)
                  identity · points · import · booking · redeem · campaign
                           │
                  packages/database (Prisma · forOrg)
                           │
                  Postgres — Neon (branch: prod / staging / dev)
                           │
     ┌─────────────────────┴───────────────────────────┐
     │ apps/web-admin  (Next.js · Vercel "mst-golf-crm") │
     │ หลังบ้าน 6 เมนู · /api/admin/* · Auth.js            │
     │ /api/cron/*  ← Vercel Cron (ป้องกันด้วย CRON_SECRET) │
     └─────────────────────┬───────────────────────────┘
                           │
                  packages/analytics  สถิติล้วน ไม่เรียก LLM
                  lib/ai.ts           LLM เฉพาะข้อความที่คนอ่าน
```

### หลักการ

- **ตรรกะธุรกิจอยู่ใน `packages/core`** ไม่อยู่ใน route handler — สองแอปเรียกโค้ดชุดเดียวกัน และเทสต์ได้โดยไม่ต้องมี HTTP
- **ทุก query ผ่าน `forOrg(orgId)`** · ทุกการเขียนที่เกี่ยวกับแต้ม/บิล/การจองอยู่ใน transaction เดียว
- **งานเบื้องหลังผ่านตาราง `Job`** — cron หยิบงานที่ถึงเวลา ทำเป็นก้อน ก้อนละไม่เกิน ~50 วินาที ทำไม่เสร็จก็ต่อรอบหน้า

### Cron

| งาน | ความถี่ |
|---|---|
| หยิบ Job ที่ถึงเวลา (ส่งแคมเปญ · แจ้งเตือน · import ใหญ่) | ทุกนาที |
| เตือนการจองล่วงหน้า | ทุก 15 นาที |
| Nightly: RFM snapshot · tier · แต้มหมดอายุ · data quality · สรุปผลแคมเปญ | 02:00 น. |
| แจ้งเตือนแต้มใกล้หมดอายุ | รายเดือน |

### Environment

| | Neon branch | Vercel | LINE |
|---|---|---|---|
| dev | dev | local | channel ทดสอบ |
| staging | staging | preview | channel ทดสอบ |
| prod | main + backup รายวัน · PITR | production | channel จริงของ MST |

### กฎที่เขียนลง `CLAUDE.md` สัปดาห์แรก

1. LLM เรียกได้เฉพาะตอนสร้างข้อความที่มนุษย์จะอ่าน ห้ามเรียกต่อสมาชิก ต่อ event ต่อ cron
2. ทุกคะแนน สัญญาณ และกลุ่ม คำนวณใน `@mstgolf/analytics` ด้วยสถิติ
3. AI ไม่ส่งข้อความถึงลูกค้าเอง ทุกแคมเปญต้องผ่าน `APPROVED` โดยมนุษย์
4. Import ต้อง idempotent — ไฟล์เดิมสองรอบได้ผลเท่ารอบเดียว
5. `Member.code` คือตัวตนหลัก เบอร์/LINE/POS เป็น identity ที่ผูกไว้
6. แต้มเปลี่ยนได้ทาง `PointTransaction` เท่านั้น
7. การกระทำของพนักงานที่เปลี่ยนแต้ม สิทธิ์ การจอง สมาชิก หรือแคมเปญ ต้องเขียน `AuditLog`
8. ตรรกะธุรกิจอยู่ใน `packages/core` ไม่อยู่ใน route

---

## 4 · โครงข้อมูล

ทุกตารางมี `orgId` (ยกเว้น `Organization`) และ `createdAt/updatedAt` — ไม่เขียนซ้ำด้านล่าง

### Platform

```prisma
User            email · name · passwordHash · role(SUPER_ADMIN|MARKETING|STORE_MANAGER|STORE_STAFF|CUSTOMER_SERVICE)
                storeId? · isActive · lastLoginAt
AuditLog        userId · action · entity · entityId · before Json? · after Json? · reason? · ip?
                @@index([orgId, entity, entityId]) @@index([orgId, createdAt])
Job             kind · payload Json · runAt · status(PENDING|RUNNING|DONE|FAILED) · attempts · lastError?
                @@index([status, runAt])
Store           code · name · openHours Json · isActive
```

### Identity

```prisma
Member          code "MST00003821" @@unique([orgId, code])
                displayName · firstName? · lastName? · birthday? · gender? · email?
                attributes Json (โปรไฟล์กอล์ฟ ผ่าน FieldDefinition)
                points Int (cache) · tierId? · tierLockedUntil?
                lifetimeSpend Int · spend12m Int · lastPurchaseAt? · lastSeenAt?
                preferredStoreId? · status(ACTIVE|MERGED|ERASED) · mergedIntoId?
                noShowCount90d Int
MemberIdentity  memberId · type(LINE|PHONE|POS_ID|EMAIL) · value · verifiedAt? · source
                @@unique([orgId, type, value])     ← เบอร์หนึ่งผูกได้คนเดียว
Consent         (เดิม) purpose(TERMS|MARKETING|PERSONALIZED) · version · granted · textSnapshot · channel
ConsentText     purpose · version · body · effectiveAt      ← ข้อความ consent แต่ละเวอร์ชัน
MergeLog        survivorId · mergedId · movedCounts Json · userId · reason
```

`Member.lineUserId` เดิม → ย้ายเข้า `MemberIdentity(type=LINE)` แล้วลบคอลัมน์

### Sales

```prisma
Product         sku · name · brand? · category? · family? · posCategory? · isPointExcluded
                @@unique([orgId, sku])
CategoryMap     posCategory → category · brand?     ← จับคู่หมวดของ POS เป็นหมวดมาตรฐาน
Sale            storeId · invoiceNo · type(SALE|VOID|RETURN|REFUND|EXCHANGE) · refInvoiceNo?
                occurredAt · memberId? · memberRef? (ค่าที่อ่านได้จากหมายเหตุ)
                grossAmount · discount · netAmount · pointEligibleAmount · paymentMethod?
                batchId · status(POSTED|REVERSED)
                @@unique([orgId, storeId, invoiceNo, type])   ← กัน import ซ้ำ
SaleLine        saleId · productId · qty · unitPrice · discount · netAmount
ImportBatch     storeId? · fileName · fileHash · uploadedBy · status(PREVIEW|COMMITTED|ROLLED_BACK|FAILED)
                counts Json · committedAt?
                @@unique([orgId, fileHash])        ← ไฟล์เดียวกันเป๊ะ เตือนตั้งแต่ upload
ImportRow       batchId · rowNumber · raw Json · status(OK|UNMATCHED|INVALID|DUPLICATE) · errorCode? · saleId?
```

### Loyalty

```prisma
PointTransaction (เดิม) + type(EARN|BONUS|REDEEM|REVERSAL|EXPIRE|ADJUST|OPENING|TRANSFER_IN|TRANSFER_OUT)
                 saleId? · redemptionId? · ruleIds String[] · createdBy? · reason? · batchId?
PointLot        memberId · sourceTxId · earned · remaining · expiresAt
                @@index([orgId, memberId, expiresAt])   ← ตัดแต้มแบบเก่าก่อน (FIFO)
PointRule       name · kind(BASE|MULTIPLIER|BONUS) · conditions Json · value · stackable
                startsAt? · endsAt? · priority · isActive
Tier            name · rank · minSpend12m · pointRate · benefits Json · color
```

### Rewards

```prisma
Reward          name · description · imageUrl? · pointsCost · kind(VOUCHER|PRODUCT|SIM_HOUR|PRIVILEGE)
                stock? · perMemberLimit? · approval(AUTO|STAFF) · validDays · minTierRank? · isActive
Redemption      memberId · rewardId · code @@unique([orgId, code]) · status(PENDING|APPROVED|ISSUED|USED|EXPIRED|CANCELLED)
                pointTxId · approvedBy? · usedAt? · usedStoreId? · expiresAt
Entitlement     memberId · kind(SIM_HOUR) · quantity · remaining · redemptionId · expiresAt
```

### Booking

```prisma
Lane            storeId · name · capacity(3) · hourlyPrice · isActive · sortOrder
Booking         laneId · memberId? · guestName? · guestPhone? · startAt · endAt · partySize
                status(HELD|CONFIRMED|CHECKED_IN|COMPLETED|NO_SHOW|CANCELLED) · heldUntil?
                source(LINE|WALKIN|PHONE|STAFF) · price · entitlementId? · note?
                createdBy? · cancelledBy? · cancelReason?
LaneBlock       laneId · startAt · endAt · reason(MAINTENANCE|PRIVATE|EVENT) · note
```

กันจองซ้อนที่ระดับฐานข้อมูล (migration แบบ SQL):

```sql
CREATE UNIQUE INDEX booking_active_slot ON bookings ("laneId", "startAt")
  WHERE status IN ('HELD','CONFIRMED','CHECKED_IN');
```

### Campaigns

```prisma
Offer           name · kind(DISCOUNT_PCT|DISCOUNT_AMT|BONUS_POINT|REWARD|PRIVILEGE) · value
                rewardId? · validFrom · validTo · codeMode(SHARED|UNIQUE) · sharedCode?
Campaign        name · objective(PURCHASE|VISIT|REDEEM|BOOKING|ENGAGEMENT) · audience Json
                sourcePlayId? · offerId? · status(DRAFT|AI_SUGGESTED|IN_REVIEW|APPROVED|SCHEDULED|SENDING|SENT|CANCELLED)
                scheduledAt? · sentAt? · holdoutPct(10) · abEnabled · attributionDays(7)
                createdBy · approvedBy? · approvedAt?
CampaignVariant campaignId · label(A|B) · headline · message · cta · visualNote · aiGenerated
CampaignRecipient campaignId · memberId · variantId? · isHoldout · offerCode?
                  sentAt? · deliveryStatus? · clickedAt? · redeemedAt? · visitedAt?
                  attributedSaleId? · attributedRevenue?
                  @@unique([campaignId, memberId])
TrackedLink     token @@unique · recipientId · targetUrl
CampaignResult  campaignId · computedAt · metrics Json · liftRevenue · liftConversion · pValue?
BrandBrief      section(TONE|PRODUCT|PROMO_RULES|CALENDAR|OBJECTIVE|PAST_WORK) · body
```

### Event

`Event` เดิมยังเป็นบันทึกพฤติกรรม ทุกการซื้อ แลก จอง check-in คลิก ยังเขียน Event
เพิ่ม `EventType`: `BOOKING_CREATED · BOOKING_CHECKED_IN · BOOKING_NO_SHOW · CAMPAIGN_CLICK · REWARD_REDEEMED · RETURN`

---

## 5 · กติกาทางธุรกิจ

ค่าที่เขียนว่า **ค่าตั้งต้น** ตั้งได้ในหน้า Settings และรอ MST ยืนยัน (ข้อ 15)

### 5.1 ตัวตนลูกค้า

**รหัสสมาชิก** `MST` + เลข 8 หลักเรียงลำดับ · ไม่เปลี่ยนตลอดชีวิต · ไม่นำกลับมาใช้

**Normalize เบอร์** ตัดทุกอย่างที่ไม่ใช่ตัวเลข → `66xxxxxxxxx` → `0xxxxxxxxx` · ต้องขึ้นต้น `06 08 09` และยาว 10 หลัก ไม่งั้น INVALID

**จับคู่บิลกับสมาชิก** อ่านหมายเหตุบิลด้วย pattern `MSTMEMBER:(ค่า)` แล้วเรียงลำดับ

1. ค่าเป็นรหัส `MST…` → จับคู่ตรง
2. ค่าเป็นเบอร์ → หา `MemberIdentity(PHONE)` 
3. เจอ → ผูกบิล · ถ้าเบอร์ยังไม่ verified → **verify เลย** (นี่คือการยืนยันเบอร์ที่หน้าร้าน)
4. ไม่เจอ → สร้างสมาชิกใหม่สถานะ POS-only (ไม่มี LINE) พร้อม identity เบอร์ที่ verified
5. ไม่มีหมายเหตุ → บิลไม่มีเจ้าของ นับเข้า data quality

**สมัครผ่าน LINE ด้วยเบอร์ที่มีอยู่แล้ว**
- เบอร์เป็นของสมาชิก POS-only → ผูก LINE เข้ากับสมาชิกเดิม ได้แต้มและประวัติเดิมทันที
- เบอร์เป็นของสมาชิกที่มี LINE อื่นอยู่แล้ว → ไม่ผูก ส่งเข้าคิว "ต้องตรวจ" ให้ Customer Service
- เบอร์ใหม่ → สร้างสมาชิกใหม่ เบอร์สถานะ unverified

### 5.2 Merge

- **ผู้อยู่รอด** = สมาชิกที่มีรหัสเก่ากว่า (เลือกเปลี่ยนได้)
- ย้าย: identity · บิล · event · consent · redemption · entitlement · booking · campaign recipient
- แต้ม: `TRANSFER_OUT` จากคนที่ถูก merge → `TRANSFER_IN` เข้าผู้อยู่รอด · ย้าย PointLot ตามวันหมดอายุเดิม
- คำนวณ tier และ spend ใหม่ · คนที่ถูก merge สถานะ `MERGED` + `mergedIntoId`
- Customer Service ขอ merge ได้ · Super Admin อนุมัติ · บันทึก `MergeLog` + `AuditLog`
- **ระบบแนะนำคู่ซ้ำ** (เฟส 3): ชื่อ + วันเกิดตรงกัน · เบอร์ต่างกันหนึ่งหลัก · อีเมลซ้ำ · LINE displayName ตรงกับชื่อใน POS

### 5.3 แต้ม

**การคำนวณต่อบิล**

```
ยอดที่ได้แต้ม = Σ SaleLine.netAmount ที่ Product.isPointExcluded = false
แต้มฐาน      = floor(ยอดที่ได้แต้ม × Tier.pointRate)
ตัวคูณ       = rule MULTIPLIER ที่ตรงเงื่อนไข
              stackable=false → ใช้ตัวที่สูงที่สุดตัวเดียว   ← ค่าตั้งต้น
              stackable=true  → คูณกัน (เพดาน 3X)
แต้มโบนัส    = Σ rule BONUS ที่ตรงเงื่อนไข (บวกเพิ่ม ไม่คูณ)
รวม          = แต้มฐาน × ตัวคูณ + แต้มโบนัส
```

เงื่อนไขที่ rule รองรับ: แบรนด์ · หมวด · SKU · สาขา · วันในสัปดาห์ · ช่วงวันที่ · tier · เดือนเกิด · ยอดขั้นต่ำ

ทุก `PointTransaction` เก็บ `ruleIds` ที่ใช้ — ตอบได้เสมอว่าแต้มนี้มาจากไหน

**หมดอายุ** ค่าตั้งต้น 12 เดือนหลังได้รับ · ใช้แต้มแบบเก่าก่อน (FIFO ผ่าน `PointLot`) · nightly ตัดแต้มที่หมดอายุเป็น `EXPIRE`

**คืนสินค้า**
- `RETURN/REFUND` อ้าง `refInvoiceNo` → กลับแต้มตามสัดส่วนยอดที่คืน · `VOID` → กลับทั้งบิล
- แต้มคงเหลือไม่พอ → **ยอมให้ติดลบ และระงับการแลกจนกว่าจะเป็นบวก** (ค่าตั้งต้น)
- `EXCHANGE` → คิดเฉพาะส่วนต่าง
- หาบิลต้นทางไม่เจอ → INVALID เข้า data quality ไม่ตัดแต้มเดา

**ปรับแต้มด้วยมือ** ต้องมีเหตุผล · Store Manager ปรับได้ไม่เกิน ±1,000 ต่อครั้ง · เกินนั้น Super Admin

### 5.4 Tier

- คำนวณจาก `spend12m` (ยอดสุทธิหลังคืน 12 เดือนย้อนหลัง) · **ไม่ใช้แต้มคงเหลือ**
- **ขึ้นทันที** เมื่อ import บิลที่ทำให้ถึงเกณฑ์ → แจ้งเตือน LINE
- **ลงเดือนละครั้ง** วันที่ 1 และมีช่วงผ่อน 30 วัน (`tierLockedUntil`)
- ค่าตั้งต้น: MEMBER 0 · SILVER 100,000 · GOLD 1,000,000 บาท/12 เดือน — รอ MST
- สิทธิประโยชน์ต่อ tier (`benefits`): อัตราแต้ม · ส่วนลด% · ของขวัญวันเกิด · ส่วนลดซิม% · ชั่วโมงซิมฟรีต่อเดือน · จองล่วงหน้าได้กี่วัน · เข้าแคมเปญพิเศษ

### 5.5 รางวัล

```
เลือกรางวัล → ตรวจ (แต้มพอ · tier ถึง · stock · limit ต่อคน · แต้มไม่ติดลบ)
   → ตัดแต้ม REDEEM (transaction เดียวกับการสร้าง Redemption)
   → AUTO: ISSUED + โค้ดทันที     STAFF: PENDING → พนักงานอนุมัติ → ISSUED
   → ใช้ที่หน้าร้าน: พนักงานสแกน/พิมพ์โค้ดในหลังบ้าน → USED
     หรือพิมพ์ MSTCODE:XXXX ในหมายเหตุบิล → import ทำเป็น USED ให้
```

- โค้ด 8 ตัว ไม่มีตัวที่สับสนง่าย (0/O, 1/I) · หมดอายุตาม `validDays` → คืนแต้มอัตโนมัติ (ค่าตั้งต้น)
- ยกเลิกก่อนใช้ → คืนแต้มเป็น `REVERSAL`
- รางวัล `SIM_HOUR` → สร้าง `Entitlement` ใช้ตอนจองซิมแทนการจ่ายเงิน

### 5.6 จองซิม

| กติกา | ค่าตั้งต้น |
|---|---|
| ช่องเวลา | 1 ชม. ตรงชั่วโมง ตามเวลาเปิดของสาขา |
| จองได้ล่วงหน้า | 14 วัน (GOLD 21 วัน) |
| จองได้ต่อคน | ไม่เกิน 2 ช่องต่อวัน · ไม่เกิน 4 การจองที่ยังไม่ถึงเวลา |
| คนต่อ lane | 1–3 |
| HELD | 5 นาที · หมดอายุตรวจตอนอ่าน ไม่ต้องรอ cron |
| ราคา | `Lane.hourlyPrice` (฿1,000) − ส่วนลดตาม tier · ใช้ Entitlement ได้ = ฿0 |
| จ่ายเงิน | หน้าร้านตอน check-in |
| ยกเลิกเอง | ก่อนเวลาเริ่ม 2 ชม. · หลังจากนั้นโทรหาร้าน |
| No-show | เกิน 15 นาทีไม่ check-in พนักงานกด NO_SHOW · ครบ 2 ครั้งใน 90 วัน → การจองผ่าน LINE ต้องรอพนักงานยืนยัน |
| Walk-in / โทร | พนักงานสร้างใน PMS · ไม่ต้องเป็นสมาชิก (`guestName/guestPhone`) · ถ้าเบอร์ตรงสมาชิก ผูกให้อัตโนมัติ |

**กันจองซ้อน**

```
ลูกค้ากดเลือกช่อง → BEGIN
  ยกเลิก HELD ที่หมดอายุในช่องนั้น
  INSERT Booking(status=HELD, heldUntil=now+5m)  ← unique index ปฏิเสธถ้ามีคนถืออยู่
COMMIT → แสดงหน้าคอนเฟิร์ม
กดยืนยันก่อน heldUntil → CONFIRMED · เลย → แจ้ง "ช่องนี้หลุดแล้ว"
```

### 5.7 แคมเปญ

**สถานะ**

```
DRAFT ──┐
AI_SUGGESTED ─→ IN_REVIEW ─→ APPROVED ─→ SCHEDULED ─→ SENDING ─→ SENT
                      ↑ ส่งกลับแก้        (Marketing หรือ Super Admin เท่านั้น)
```

**ใครได้รับ**
- ต้องมี LINE · ยังไม่ unfollow · ให้ consent `MARKETING`
- กลุ่มที่เลือกโดย AI / segment เชิงพฤติกรรม → ต้องมี consent `PERSONALIZED` เพิ่ม
- Frequency cap: ไม่เกิน 2 ข้อความการตลาดต่อคนต่อ 7 วัน (ค่าตั้งต้น) — คนที่เกินถูกตัดออกก่อนส่ง แสดงจำนวนให้เห็น
- ช่วงห้ามส่ง 21:00–09:00 (ค่าตั้งต้น)

**กลุ่มควบคุม** สุ่ม 10% ของกลุ่มเป้าหมาย ไม่ส่ง แต่ติดตามพฤติกรรมเหมือนกัน · ปิดได้เมื่อกลุ่มเล็กกว่า 100 คน

**A/B** เปิดได้เมื่อกลุ่มหลังหักควบคุม ≥ 1,000 คน (ค่าตั้งต้น) · แบ่งสุ่ม 50/50 · ผลแสดง "ยังสรุปไม่ได้" จนกว่าค่า p < 0.05

**Attribution**

```
Clicked    คลิกลิงก์ติดตาม /r/:token
Redeemed   ใช้โค้ดของแคมเปญ (หลังบ้าน หรือ MSTCODE: ในบิล)
Visited    มีบิล หรือ check-in ซิม ภายใน attributionDays
Purchased  มีบิล SALE ภายใน attributionDays หลังส่ง
Revenue    ยอดสุทธิของบิลเหล่านั้น (หักคืนสินค้า)
Lift       (conversion ของกลุ่มที่ได้รับ − กลุ่มควบคุม) × จำนวนผู้รับ × ยอดเฉลี่ย
```

- สมาชิกได้หลายแคมเปญพร้อมกัน → บิลนับให้แคมเปญล่าสุดที่ส่งก่อนบิล (last-touch)
- Delivered / ยอดอ่าน ใช้สถิติรวมที่ LINE ให้ (ไม่มีรายคน)

### 5.8 PDPA

- สมัคร: `TERMS` บังคับ · `MARKETING` เลือก · `PERSONALIZED` เลือก · เก็บ version + ข้อความ + เวลา + ช่องทาง
- เปลี่ยน consent ได้ในหน้าโปรไฟล์ใน LINE · ถอน `MARKETING` มีผลทันทีกับแคมเปญที่ยังไม่ส่ง
- ขอลบข้อมูล: ลบ identity ทั้งหมด · ล้างชื่อ/วันเกิด/attributes · สถานะ `ERASED` · **บิลเก็บไว้** (จำเป็นทางบัญชี) แต่ไม่ผูกตัวตน
- Export ข้อมูลสมาชิก: Super Admin และ Marketing เท่านั้น · เขียน AuditLog ทุกครั้ง

---

## 6 · หลังบ้าน — ทุกหน้าจอ

```
01 OVERVIEW     02 ACTION PLAN     03 MEMBERS     04 POS IMPORT     05 CAMPAIGNS     06 SIMULATOR
⚙ SETTINGS
```

### 01 OVERVIEW

- ตัวเลขหลัก (เลือกช่วงเวลา · เลือกสาขา): สมาชิก · Active 30 วัน · สมาชิกใหม่ · ยอดซื้อของสมาชิก · % ยอดขายที่ระบุตัวตนได้ · แต้มออก/แลก · การจองซิม · อัตราใช้ lane
- **AI Brief** 3–5 ข้อ (สร้างวันละครั้ง cache ไว้)
- **Task Center**: POS error · สมาชิกไม่ตรง · คำขอแลกรอนุมัติ · การจองมีปัญหา · import ล้มเหลว · คำขอ merge · แคมเปญรออนุมัติ — แต่ละรายการกดเข้าหน้างานนั้นได้
- กราฟ: ยอดซื้อรายสัปดาห์ · สัดส่วนกลุ่ม RFM · อัตราใช้ซิมรายชั่วโมง

### 02 ACTION PLAN

- การ์ดโอกาสเรียงตามมูลค่า: ชื่อ · จำนวนคน · ยอดซื้อในอดีต · ประเภทโอกาส · คำอธิบายจาก AI · มูลค่าที่ประเมิน
- โอกาสมาตรฐาน (10 เดิม + ใหม่): VIP · ดึงกลับ · ขายพ่วง · ฟิตแล้วไม่ซื้อ · ใกล้เลื่อน tier · สมาชิกใหม่ยังไม่ซื้อ · แฟนแบรนด์ · มาบ่อยซื้อน้อย · วันเกิด · เงียบ 6 เดือน · **แต้มใกล้หมดอายุ** · **เคยจองซิมแล้วหายไป** · **ชั่วโมงซิมว่าง** · **แลกแล้วไม่กลับมาซื้อ**
- `[สร้างแคมเปญ]` → เปิด wizard พร้อมเติม WHO + OBJECTIVE + ร่าง CREATIVE จาก AI (สถานะ AI_SUGGESTED)
- ดูรายชื่อในกลุ่มได้ก่อนสร้าง

### 03 MEMBERS

แท็บ **Members · Membership · Privileges · Review Queue**

- **Members**: ค้นหา ชื่อ/เบอร์/รหัส · ตัวกรอง tier · แต้ม · ยอดซื้อ · ซื้อล่าสุด · สาขา · วันสมัคร · กลุ่ม RFM · มี LINE หรือไม่ · consent · แบรนด์ที่ชอบ · บันทึกตัวกรองเป็น segment ได้
- **Customer 360** (`/members/[id]`)
  - หัว: ชื่อ · รหัส · tier + ความคืบหน้าสู่ tier ถัดไป · แต้ม (+ ใกล้หมดอายุ) · Lifetime spend · จำนวนบิล · การจองซิม · กลุ่ม RFM · ความเสี่ยงหลุด · CLV
  - Affinity: แบรนด์ · หมวด · สินค้าที่น่าจะซื้อต่อ
  - Timeline รวม: ซื้อ · คืน · แต้ม · แลก · จอง · check-in · แคมเปญที่ได้รับ/คลิก · consent · merge
  - แท็บ: บิล · ledger แต้ม · รางวัล · การจอง · แคมเปญ · identity · consent · audit
  - Action: ปรับแต้ม · ออกรางวัล · จองแทน · ขอ merge · แก้ข้อมูล · ขอลบข้อมูล
- **Membership**: tier · เกณฑ์ · จำนวนคนต่อ tier · คนที่ใกล้ขึ้น/ใกล้ลง
- **Privileges**: สิทธิประโยชน์ต่อ tier
- **Review Queue**: เบอร์ชนกัน · คู่ที่น่าจะซ้ำ · คำขอ merge · คำขอลบข้อมูล

### 04 POS IMPORT

แท็บ **Upload · History · Data Quality · Products**

```
IMPORT POS                              สาขา [ MST ... ▾ ]   รูปแบบ [ POS preset ▾ ]

[ วางไฟล์ CSV ที่นี่ ]

────── Preview ──────
1,842 บิล  ·  4,907 บรรทัด  ·  ช่วง 01–07 ต.ค.
1,796 จับคู่สมาชิก   32 ไม่พบสมาชิก   14 ผิดรูปแบบ   0 ซ้ำ
ยอดขาย ฿2.48M   แต้มที่จะออก 2.48M   คืนสินค้า 6 บิล (−18,400 แต้ม)
สินค้าใหม่ 12 SKU  →  [ ตรวจหมวด ]

[ ดูรายการที่มีปัญหา ]      [ IMPORT ]
```

- Column mapping บันทึกเป็น preset ต่อยี่ห้อ POS (ทำครั้งเดียว)
- ไฟล์ซ้ำ (hash เดิม) → เตือนตั้งแต่ upload · บิลซ้ำ → ข้ามอัตโนมัติ นับเป็น DUPLICATE
- Import เป็นก้อนเดียว (transaction) · ย้อนทั้งก้อนได้ภายใน 7 วัน (ถ้ายังไม่มีการแลกที่พึ่งแต้มนั้น)
- หลัง import: แจ้งเตือนแต้มรายคน (ถ้าเปิด) · อัปเดต tier · เขียน Event
- **History**: ทุกรอบ ใคร เมื่อไร ผลเท่าไร ดาวน์โหลดแถวที่มีปัญหาเป็น CSV
- **Data Quality**: % บิลที่ไม่มีเลขสมาชิก ต่อสาขา ต่อวัน · เบอร์ผิดรูปแบบ · เบอร์ที่ไม่พบ · สาขาที่ผิดปกติ · สินค้าที่ยังไม่มีหมวด
- **Products**: รายการ SKU · แก้แบรนด์/หมวด/family · ตั้งสินค้ายกเว้นแต้ม · ตาราง CategoryMap

### 05 CAMPAIGNS

แท็บ **Campaigns · Offers · Rewards · Redeem Requests**

- **Campaigns**: รายการ + สถานะ + ผล · กรองตามสถานะ
- **Wizard** 5 ขั้น

```
1 WHO        All Members · Tier · AI Suggested (จาก Action Plan) · Custom Segment (ตัวกรอง)
             → จำนวนคน · หักคนไม่มี consent / เกิน frequency cap · กลุ่มควบคุม %
2 OBJECTIVE  Purchase · Store Visit · Redeem · Simulator Booking · Engagement
3 OFFER      Discount · Bonus Point · Reward · Privilege · No Offer · วันเริ่ม/หมด
4 CREATIVE   Headline · Message · Visual Direction · CTA
             [ ให้ AI ร่าง 3 แบบ ] · เปิด A/B (ถ้ากลุ่มใหญ่พอ)
             พรีวิวแบบข้อความ LINE จริง · ส่งทดสอบหาตัวเอง
5 SCHEDULE   ส่งทันที / ตั้งเวลา · attribution 7 วัน → ส่งขออนุมัติ
```

- **หน้าผลแคมเปญ**: Sent · Delivered · Clicked · Redeemed · Visited · Purchased · Revenue · เทียบกลุ่มควบคุม · Lift · A vs B · รายชื่อผู้ซื้อ
- **Offers**: สร้าง/แก้ · โค้ดร่วม หรือโค้ดรายคน
- **Rewards**: แคตตาล็อก · stock · รูป · การอนุมัติ · tier ขั้นต่ำ
- **Redeem Requests**: คิวรออนุมัติ · ช่องสแกน/พิมพ์โค้ดเพื่อทำเป็น USED · ประวัติ

### 06 SIMULATOR

- **Calendar** แกนตั้งเป็นเวลา แกนนอน 3 lane · มุมมองวัน/สัปดาห์ · สีตามสถานะและที่มา
- ลากย้ายการจองข้ามเวลา/lane · ลากขอบไม่ได้ (ช่องละ 1 ชม.)
- คลิกช่องว่าง → สร้าง (สมาชิก ค้นหาจากเบอร์/รหัส หรือ walk-in)
- คลิกการจอง → check-in · no-show · ยกเลิก · ย้าย · บันทึกการจ่าย · เปิด 360
- Block lane (ซ่อมบำรุง · ปิดส่วนตัว · อีเวนต์)
- รายการวันนี้สำหรับหน้าเคาน์เตอร์ (เรียงตามเวลา ปุ่ม check-in ใหญ่)
- สถิติ: อัตราใช้ต่อ lane/ชั่วโมง · no-show · ที่มา

### ⚙ SETTINGS

LINE (channel · LIFF · Rich Menu) · สาขาและเวลาเปิด · Lane · กติกาแต้ม · Tier · หมดอายุแต้ม · กติกาจอง · กติกาแคมเปญ (frequency cap · ช่วงห้ามส่ง · กลุ่มควบคุม · A/B threshold) · ข้อความ consent · ฟิลด์โปรไฟล์ · Brand Brief · ผู้ใช้และ role · Audit Log · แบรนด์ของ tenant (โลโก้ สี)

---

## 7 · หน้าลูกค้าใน LINE — ทุกหน้าจอ

### Rich Menu

```
ก่อนสมัคร                         หลังสมัคร
┌──────────────────────┐         ┌──────────┬──────────┬──────────┐
│                      │         │ MEMBER   │ MY       │ REWARDS  │
│     JOIN MEMBER      │         │ CARD     │ POINTS   │          │
│                      │         ├──────────┼──────────┼──────────┤
└──────────────────────┘         │ GOLF SIM │ MY       │ SHOP     │
                                 │          │ BOOKING  │          │
                                 └──────────┴──────────┴──────────┘
```

### หน้าจอ LIFF

| หน้า | เนื้อหา |
|---|---|
| **สมัคร** | LINE Login → ชื่อ · เบอร์ · วันเกิด · อีเมล (ไม่บังคับ) · โปรไฟล์กอล์ฟ (dynamic) → consent 3 ข้อ → สำเร็จ → เปลี่ยน Rich Menu |
| **Member Card** | ชื่อ · tier · รหัส · QR (รหัสสมาชิก) · แต้ม · แถบความคืบหน้า tier · ปุ่มเพิ่มความสว่างจอ |
| **My Points** | แต้มคงเหลือ · ใกล้หมดอายุ (จำนวน+วันที่) · ประวัติ ledger พร้อมเหตุผล |
| **ประวัติซื้อ** | บิลย้อนหลัง · สาขา · รายการสินค้า |
| **Rewards** | แคตตาล็อก (กรองตามแต้มที่แลกได้) · รายละเอียด · แลก → โค้ด + QR · รางวัลของฉัน (ยังไม่ใช้/ใช้แล้ว/หมดอายุ) |
| **Golf Simulator** | เลือกวัน → ตาราง 3 lane (● ว่าง · × เต็ม) → เลือกช่อง → จำนวนคน → ใช้สิทธิ์ชั่วโมงฟรี (ถ้ามี) → ยืนยัน · นับถอยหลัง 5 นาที |
| **My Booking** | การจองที่จะถึง · ยกเลิก (ภายในกติกา) · ประวัติ |
| **โปรไฟล์** | แก้ข้อมูล · consent · ขอลบข้อมูล |
| **Shop** | ลิงก์ออกไปหน้าร้านออนไลน์ของ MST (ถ้ามี) — ไม่สร้างร้านค้าใหม่ |

สมาชิกที่แต้มติดลบ เห็นยอดติดลบและเหตุผล · ปุ่มแลกปิดพร้อมคำอธิบาย

---

## 8 · การเชื่อม LINE

### สิ่งที่ต้องตั้งค่า

- **Messaging API channel และ LINE Login channel ต้องอยู่ใน provider เดียวกัน** — LINE userId ต่างกันตาม provider ถ้าคนละ provider ระบบจะเห็นลูกค้าคนเดียวเป็นสองคน
- LINE OA ควรเป็นบัญชีที่ verified แล้ว
- LIFF app หนึ่งตัว ขนาด Full · endpoint = `https://<โดเมน>/liff`
- Rich Menu สองชุด อัปโหลดผ่าน API · ผูกรายคนด้วย `link rich menu to user` ตอนสมัครเสร็จ

### Webhook ที่รับ

| Event | ทำอะไร |
|---|---|
| `follow` | สร้าง/ปลุก identity LINE · ส่งข้อความต้อนรับ + ปุ่มสมัคร (reply ฟรี) |
| `unfollow` | ติดธง unfollow · ตัดออกจากแคมเปญ |
| `postback` | ปุ่มใน Flex message (เช่น ยืนยันการจอง) |
| `message` | เขียน Event `MESSAGE_RECEIVED` · ตอบอัตโนมัติเรื่องเมนู |

ตรวจลายเซ็น `x-line-signature` ทุก request · ตอบ 200 ทันทีแล้วทำงานต่อใน Job

### ข้อความอัตโนมัติ

| ข้อความ | ประเภท | ตั้งปิดได้ |
|---|---|:-:|
| ต้อนรับหลังสมัคร | บริการ | – |
| ได้แต้มหลัง import | บริการ | ✔ (หรือรวมเป็นสรุปรายวัน) |
| เลื่อน tier | บริการ | – |
| แต้มใกล้หมดอายุ (30 วันก่อน) | บริการ | ✔ |
| ยืนยันการจอง · เตือนล่วงหน้า 2 ชม. · ยกเลิก | บริการ | – |
| โค้ดรางวัล · รางวัลได้รับอนุมัติ | บริการ | – |
| แคมเปญ | การตลาด | ตาม consent |

push message ทุกข้อความนับโควตาของ LINE OA — หน้า Settings แสดงจำนวนที่ใช้ไปในเดือน

### การส่งแคมเปญ

multicast ก้อนละ 500 คน · หน่วงระหว่างก้อน · ถ้า LINE ตอบ 429 ถอยแล้วลองใหม่ · ทุกผู้รับบันทึก `sentAt` · ใช้ Flex message เมื่อมีรูปและปุ่ม

---

## 9 · ชั้น AI

### สิ่งที่คำนวณ vs สิ่งที่ AI เขียน

| | ใครทำ |
|---|---|
| Recency · Frequency · Monetary · CLV · churn · cohort | สถิติ (`packages/analytics` มีแล้ว) |
| Brand/Category/Product affinity · ซื้ออะไรต่อจากอะไร | สถิติ (มีแล้ว ต่อเข้ากับ SaleLine) |
| Point / Redeem / Booking / Store / Campaign response behavior | สถิติ (เพิ่มใหม่) |
| ใครอยู่ในโอกาสไหน มูลค่าเท่าไร | สถิติ (rule ใน Action Plan) |
| **WHY · WHAT HAPPENED · WHAT SHOULD MST DO** | AI เขียนจากตัวเลขที่คำนวณแล้ว |
| **Headline · Message · CTA · Visual Direction** | AI ร่าง มนุษย์แก้และอนุมัติ |
| **AI Brief รายวัน** | AI สรุปจากตัวเลข |

### ข้อมูลที่ส่งเข้า prompt

ตัวเลขสรุปของกลุ่ม (ไม่ส่งชื่อ เบอร์ หรือข้อมูลรายคน) + Brand Brief + กติกาโปร + ผลแคมเปญที่คล้ายกันย้อนหลัง 3–5 รายการ + offer ที่เลือก

### Learning loop — ทำได้จริงแค่ไหน

สเปกเขียนว่า "AI เรียนรู้ว่ากลุ่มนี้ตอบสนองกับรางวัลประสบการณ์มากกว่าส่วนลด" สิ่งที่ระบบทำจริงคือ

1. ทุกแคมเปญที่ครบ attribution window → คำนวณ `CampaignResult` (lift เทียบกลุ่มควบคุม · ค่า p ถ้ามี A/B)
2. หน้า Campaigns มีแผง **"What worked"** — เรียงผลตามกลุ่ม × objective × ประเภท offer
3. ตอนให้ AI ร่างแคมเปญใหม่ ผลที่คล้ายกันถูกใส่เข้า prompt พร้อมตัวเลข
4. AI ไม่ได้ถูก train ใหม่ และระบบไม่เปลี่ยนกติกาเอง — มนุษย์เห็นผลแล้วตัดสิน

### Guardrail

`AI_SUGGESTED → IN_REVIEW → APPROVED → SCHEDULED → SENT` · AI ไม่มีสิทธิ์เปลี่ยนสถานะเกิน `AI_SUGGESTED`

### ขอบเขตการเรียกโมเดล

| งาน | ต่อเดือน (ประมาณ) |
|---|---|
| AI Brief (วันละครั้ง) | ~30 |
| คำอธิบายโอกาส (cache 24 ชม.) | ~300 |
| ร่างแคมเปญ (3 แบบ × แคมเปญ) | ~30–60 |
| **รวม** | **< 400 ครั้ง ไม่ขึ้นกับจำนวนสมาชิก** |

---

## 10 · สิทธิ์ผู้ใช้ห้าระดับ

`✔ เต็ม · ◐ บางส่วน/สาขาตัวเอง · 👁 ดูอย่างเดียว · – ไม่เห็น`

| | Super Admin | Marketing | Store Manager | Store Staff | Customer Service |
|---|:-:|:-:|:-:|:-:|:-:|
| Overview | ✔ | ✔ | ◐ | ◐ | 👁 |
| Action Plan | ✔ | ✔ | 👁 | – | – |
| Members ค้นหา/ดู 360 | ✔ | ✔ | ✔ | ◐ ไม่เห็นยอดซื้อรวม | ✔ |
| แก้ข้อมูลสมาชิก | ✔ | – | ◐ | – | ✔ |
| ปรับแต้ม | ✔ | – | ◐ ±1,000 | – | ◐ ±1,000 |
| Merge | อนุมัติ | – | – | – | ขอ |
| ลบข้อมูล PDPA | ✔ | – | – | – | ขอ |
| Export สมาชิก | ✔ | ✔ | – | – | – |
| POS Import | ✔ | – | ◐ | – | – |
| Products / CategoryMap | ✔ | ✔ | – | – | – |
| Campaigns สร้าง | ✔ | ✔ | – | – | – |
| Campaigns อนุมัติ | ✔ | ✔ | – | – | – |
| Offers / Rewards ตั้งค่า | ✔ | ✔ | – | – | – |
| Redeem อนุมัติ/ใช้โค้ด | ✔ | ✔ | ✔ | ✔ | ✔ |
| Simulator | ✔ | 👁 | ✔ | ✔ | ✔ |
| Settings | ✔ | ◐ แคมเปญ/Brand Brief | – | – | – |
| Users & Roles · Audit Log | ✔ | – | – | – | – |

สิทธิ์เก็บเป็นตาราง `role → permission[]` ในโค้ด · ตรวจทั้งฝั่ง UI (ซ่อน) และ API (ปฏิเสธ)

---

## 11 · แผนงานรายสัปดาห์

ทีม: คุณ + Claude · หนึ่งสายงาน · ทุกสัปดาห์จบด้วย test ผ่าน + deploy ขึ้น staging
**ทุกวันที่ MST ตอบคำถามข้อ 15 ช้า เลื่อนแผนเท่ากัน**

### ภาพรวม

```
ก.ย.–ต.ค.   พ.ย.        ธ.ค.          ม.ค.         ก.พ.          มี.ค.        เม.ย.
W1 ─ W2 ──────────── W11 W12 │W13 W14 W15 ─────── W22 │W23 ───────── W28
S0 │──── เฟส 1 Foundation ──│ดูแล│── เฟส 2 Engagement ───│── เฟส 3 Intelligence ──│
                          ▲ go-live 1          ▲ หยุดปีใหม่       ▲ go-live 2              ▲ go-live 3
                          11 ธ.ค.                              26 ก.พ.                  9 เม.ย.
```

---

### Sprint 0 · W1 · 28 ก.ย. – 2 ต.ค. · เตรียมงาน

| งาน | ผลลัพธ์ |
|---|---|
| ส่งคำถามข้อ 15 ให้ MST + ขอไฟล์ POS จริง 1 สัปดาห์ | คำถามออกวันจันทร์ |
| เขียนกฎ 8 ข้อลง `CLAUDE.md` | |
| ตัดหน้า `/quote` `/data-model` `/raw` `/analytics` `/insights` `/operations` · ซ่อน `/automations` · ลบ `apps/api` | nav เหลือ 6 เมนู (บางเมนูว่าง) |
| สร้าง `packages/core` · ย้าย model ID ไป env | |
| Neon: branch prod/staging/dev · Vercel env ต่อ environment · ปิด sample mode บน production | |
| **ปิด `golffy.vercel.app` ด้วย password protection** จนกว่า login จะเสร็จ · เพิ่มโดเมนใหม่ตามชื่อ MST Golf Platform แล้วปลด `golffy` | |
| ชื่อที่แสดงในหลังบ้านเป็น MST Golf Platform (อ่านจาก config ของ tenant) | |

---

### เฟส 1 · Foundation · W2–W11 · 5 ต.ค. – 11 ธ.ค.

เป้าหมาย: เก็บข้อมูลลูกค้าให้ถูกตั้งแต่วันแรก

**S1 · W2 · Login · Role · Audit**
- Auth.js + email/password (`User.passwordHash` มีแล้ว) · reset รหัสผ่าน · session หมดอายุ 12 ชม.
- ห้า role + ตาราง permission + middleware ตรวจทุก `/api/admin/*`
- `AuditLog` + helper `audit()` · หน้า Users & Roles
- ✅ ทุกหน้าหลังบ้านต้อง login · ทดสอบสิทธิ์ครบห้า role

**S2 · W3 · Schema v2**
- migration: Store · Member.code · MemberIdentity · Product · CategoryMap · Sale · SaleLine · ImportBatch · ImportRow · PointTransaction ใหม่ · PointLot · PointRule · Tier · ConsentText · MergeLog · Job
- ย้าย `lineUserId` เข้า MemberIdentity · ออกรหัส `MST…` ให้สมาชิกเดิม
- `normalizePhone()` + tests · seed ใหม่ที่ใช้โครงนี้
- ✅ migrate จากฐานเดิมผ่าน · seed ผ่าน · tests tenant isolation ผ่าน

**S3 · W4–W5 · POS Import v2**
- parser CSV (UTF-8/TIS-620 · BOM · ตัวคั่น) · column mapping + preset
- ตรวจ: รูปแบบ · เบอร์ · บิลซ้ำ · ไฟล์ซ้ำ · บิลคืนหาต้นทาง
- จับคู่สมาชิกตาม 5.1 · verify เบอร์ที่หน้าร้าน · สร้างสมาชิก POS-only
- สร้าง Product อัตโนมัติ + CategoryMap · หน้า Products
- Preview → Commit (transaction) → Rollback · History · ดาวน์โหลดแถวที่มีปัญหา
- ไฟล์ใหญ่ (> 2,000 บิล) แตกเป็น Job
- ✅ import ไฟล์จริงของ MST ผ่าน · import ซ้ำได้ผลเท่าเดิม · rollback คืนแต้มครบ

**S4 · W6 · Point engine**
- คำนวณแต้มตาม 5.3 · ruleIds ทุกรายการ · PointLot FIFO
- Reversal (RETURN/REFUND/VOID/EXCHANGE) · ติดลบ + ระงับการแลก
- หมดอายุ nightly · ปรับมือพร้อมเพดานตาม role
- ✅ test ครบทุกกรณีในตาราง 12.2

**S5 · W7 · Tier · Privilege · Merge · Settings**
- `spend12m` · ขึ้นทันที/ลงรายเดือน + ช่วงผ่อน · หน้า Membership · Privileges
- Settings: สาขา · กติกาแต้ม · tier · หมดอายุ
- Merge ด้วยมือตาม 5.2 · Review Queue (เบอร์ชนกัน · คำขอ merge)
- ✅ merge แล้วแต้ม บิล การจอง ตรงครบ · audit มีทุกขั้น

**S6 · W8–W9 · LINE + LIFF**
- Vercel project ใหม่สำหรับ `apps/web-liff` · โดเมน
- LineChannel (มีแล้ว) · webhook + ตรวจลายเซ็น · follow/unfollow/message
- LIFF: login · สมัคร (ย้ายจาก `/join`) · consent 3 ข้อ + ConsentText · Rich Menu สองชุด + ผูกรายคน
- Member Card + QR · My Points · ประวัติซื้อ · โปรไฟล์/consent
- การสมัครด้วยเบอร์ที่มีอยู่ตาม 5.1
- ✅ สมัครจากมือถือจริง → Rich Menu เปลี่ยน → ซื้อที่ร้าน → import → แต้มขึ้นในบัตร + ได้ข้อความแจ้ง

**S7 · W10 · ต่อหลังบ้านเข้าข้อมูลจริง**
- Overview · Members + ตัวกรอง · Customer 360 (บิล · ledger · identity · consent · audit) บน Postgres
- Data Quality · Task Center v1
- ซ้อมย้ายข้อมูลเก่าของ MST บน staging (ข้อ 13)
- ✅ ตัวเลขใน Overview ตรงกับผลรวมจาก SQL

**S8 · W11 · UAT และเปิดใช้เฟส 1**
- UAT กับ MST บน staging ตามสคริปต์ · แก้ · ย้ายข้อมูลจริง · อบรม (แอดมิน · ผู้จัดการสาขา · พนักงาน · ขั้นตอนพิมพ์ `MSTMEMBER:` ในบิล)
- **go-live ศุกร์ 11 ธ.ค.**

**W12 · 14–18 ธ.ค. · ดูแลหลังเปิด** — แก้ปัญหา · ดู data quality สาขาต่อสาขา · ปรับขั้นตอนหน้าร้าน

**Definition of done เฟส 1**
- พนักงาน import ไฟล์ของวันเองได้ในไม่เกิน 5 นาที และ import ซ้ำแล้วแต้มไม่เบิ้ล
- ลูกค้าสมัครผ่าน LINE ได้เอง เห็นบัตรสมาชิกและแต้มหลัง import ของวันนั้น
- คืนสินค้าแล้วแต้มกลับตามจริง มีประวัติตรวจได้
- ทุกหน้าหลังบ้านต้อง login และทุกการเปลี่ยนแต้มมีชื่อคนทำ

---

### เฟส 2 · Engagement · W13–W22 · 21 ธ.ค. – 26 ก.พ. (หยุด W14 ปีใหม่)

เป้าหมาย: ให้ลูกค้ามีเหตุผลกลับมา

**S9 · W13 · Rewards backend + LIFF**
- Reward · Redemption · Entitlement · กติกา 5.5 · โค้ด + QR
- LIFF: แคตตาล็อก · แลก · รางวัลของฉัน
- ✅ แลกพร้อมกันสองเครื่องจนแต้มไม่พอ → สำเร็จเครื่องเดียว

**W14 · 28 ธ.ค. – 1 ม.ค. · หยุดปีใหม่**

**S10 · W15 · Redeem ฝั่งร้าน + แจ้งเตือน**
- หลังบ้าน: Rewards · Redeem Requests · สแกน/พิมพ์โค้ด · `MSTCODE:` ใน import
- หมดอายุคืนแต้ม · ข้อความแจ้งเตือนทั้งหมดในตาราง 8 (ยกเว้นแคมเปญ) · สรุปแต้มรายวัน
- ✅ รางวัล STAFF ต้องรออนุมัติ · ใช้โค้ดซ้ำไม่ได้

**S11 · W16–W17 · Booking engine + LIFF**
- Lane · Booking · LaneBlock · unique index · HELD 5 นาที · กติกา 5.6
- LIFF: ตาราง 3 lane · เลือกช่อง · จำนวนคน · ใช้ชั่วโมงฟรี · ยืนยัน · My Booking · ยกเลิก
- ยืนยัน/เตือน/ยกเลิก ทาง LINE
- ✅ ยิง 20 request จองช่องเดียวพร้อมกัน → สำเร็จ 1

**S12 · W18–W19 · Simulator PMS**
- Calendar 3 lane มุมมองวัน/สัปดาห์ · ลากย้าย · สร้าง walk-in/โทร · check-in · no-show · ยกเลิก · block
- รายการวันนี้สำหรับเคาน์เตอร์ · บันทึกการจ่าย · สถิติการใช้
- ✅ การจองจาก LINE โผล่ในปฏิทินภายใน 5 วินาที · ย้ายไปช่องที่ไม่ว่างไม่ได้

**S13 · W20–W21 · Campaigns v1 + Offers**
- Offer · Campaign · Variant · Recipient · TrackedLink
- Wizard 5 ขั้น · ตัวกรอง consent + frequency cap + ช่วงห้ามส่ง · กลุ่มควบคุม
- สถานะ + อนุมัติ · ตั้งเวลา · ส่งผ่าน Job multicast · ส่งทดสอบหาตัวเอง
- ลิงก์ติดตาม `/r/:token` · โค้ด offer ใช้ในหลังบ้านหรือ `MSTCODE:`
- ✅ แคมเปญที่ยังไม่อนุมัติส่งไม่ได้ · คนถอน consent ไม่ได้รับ

**S14 · W22 · UAT และเปิดใช้เฟส 2** — อบรมพนักงานซิม · ย้ายการจองที่มีอยู่เข้าระบบ · **go-live ศุกร์ 26 ก.พ.**

**Definition of done เฟส 2**
- จองจาก LINE สองเครื่องพร้อมกันใน lane เดียว สำเร็จได้เครื่องเดียว
- พนักงานเห็นทุกการจอง ไม่ว่ามาจาก LINE โทร หรือ walk-in ในปฏิทินเดียว
- แลกรางวัลได้ครบวงจรจาก LINE ถึงหน้าร้าน
- แคมเปญส่งได้เฉพาะหลังมีคนกดอนุมัติ

---

### เฟส 3 · Intelligence · W23–W28 · 1 มี.ค. – 9 เม.ย.

เป้าหมาย: เปลี่ยนข้อมูลเป็นแคมเปญ และรู้ว่าแคมเปญทำเงินเท่าไร

**S15 · W23 · Analytics บนข้อมูลจริงทั้งหมด**
- ต่อ `packages/analytics` เข้า SaleLine (affinity SKU/แบรนด์/หมวด · ซื้ออะไรต่อจากอะไร)
- behavior ใหม่: แต้ม · แลก · จอง · สาขา · การตอบสนองต่อแคมเปญ
- Customer 360 ครบทุกแท็บ + timeline รวม · RFM snapshot จาก Sale
- ✅ ตัวเลข affinity ตรวจมือกับ 20 สมาชิกตัวอย่างตรง

**S16 · W24 · Opportunity + AI**
- Action Plan: 10 เดิม + 4 ใหม่ · มูลค่าประเมิน · คำอธิบาย AI (cache)
- `[สร้างแคมเปญ]` เติม WHO/OBJECTIVE/CREATIVE ให้ → AI_SUGGESTED
- AI Brief บนข้อมูลจริง · หน้า Brand Brief
- ✅ ไม่มีการเรียกโมเดลใน nightly หรือต่อสมาชิก (ตรวจด้วย log)

**S17 · W25–W26 · วัดผลแคมเปญ**
- Clicked · Redeemed · Visited · Purchased · Revenue ตาม 5.7 · last-touch
- เทียบกลุ่มควบคุม · lift · หน้าผลแคมเปญ · CampaignResult ใน nightly
- แผง "What worked" · ผลย้อนหลังเข้า prompt
- ✅ แคมเปญทดสอบบน staging ด้วยข้อมูลจำลองที่รู้คำตอบล่วงหน้า คำนวณ lift ตรง

**S18 · W27 · A/B + ระบบแนะนำคู่ซ้ำ**
- A/B 50/50 · two-proportion test · "ยังสรุปไม่ได้" จนค่า p < 0.05
- คู่ที่น่าจะซ้ำเข้า Review Queue ตาม 5.2
- ✅ A/B เปิดไม่ได้เมื่อกลุ่มเล็กกว่าเกณฑ์

**S19 · W28 · UAT และเปิดใช้เฟส 3** — **go-live ศุกร์ 9 เม.ย.** (ก่อนสงกรานต์)

**Definition of done เฟส 3**
- ทุกแคมเปญที่ครบ 7 วัน ตอบได้ว่าทำยอดเพิ่มเท่าไรเทียบกับคนที่ไม่ได้รับ
- จาก Action Plan ถึงแคมเปญพร้อมอนุมัติ ใช้ไม่เกิน 3 นาที

---

### เฟส 4 · Real-time & Scale · หลังเม.ย. 2027

ทำเมื่อเงื่อนไขครบ

| งาน | เงื่อนไขก่อนเริ่ม |
|---|---|
| POS API · แต้มเข้าทันที | POS มี API หรือ webhook |
| Automation UI (trigger → action) | แคมเปญมือซ้ำเดิมเกิน 3 เดือน · engine มีแล้ว |
| วิเคราะห์รายสาขาเชิงลึก · แคมเปญท้องถิ่น | ข้อมูลหลายสาขาเกิน 6 เดือน |
| Personalization ขั้นสูง (next best action รายคนใน LIFF) | CampaignResult สะสมเกิน 20 แคมเปญ |
| Tenant onboarding · billing | มี tenant รายที่สอง |

---

## 12 · การทดสอบ

### 12.1 ระดับ

| ระดับ | ครอบคลุม | เครื่องมือ |
|---|---|---|
| Unit | analytics · point calc · normalizePhone · CSV parser · attribution · ความถี่/consent filter | vitest (มีแล้ว) |
| Integration (Postgres จริง) | import · reversal · merge · redeem · booking · tenant isolation | vitest + Neon branch ต่อ run |
| Concurrency | จองช่องเดียว 20 request · แลกพร้อมกัน · import สองไฟล์พร้อมกัน | สคริปต์ยิงขนาน |
| E2E | สมัคร → ซื้อ → import → แต้ม → แลก → จอง → check-in | Playwright (หน้า LIFF เปิดนอก LINE ด้วย mock LIFF) |
| UAT | สคริปต์ต่อ role ให้ MST ทำเอง | เอกสาร |

### 12.2 กรณีแต้มที่ต้องมี test

ซื้อปกติ · สินค้ายกเว้น · ตัวคูณสองตัวไม่ซ้อน · ตัวคูณซ้อนชนเพดาน · โบนัส + ตัวคูณ · วันเกิด · คืนบางส่วน · VOID · คืนหลังแลกจนติดลบ · EXCHANGE · หมดอายุ FIFO · หมดอายุบางส่วนของ lot · merge ที่ lot หมดอายุต่างกัน · import ซ้ำ · rollback หลังมีการแลก (ต้องปฏิเสธ)

---

## 13 · การย้ายข้อมูลและเปิดใช้

### ข้อมูลเก่าของ MST

| ข้อมูล | วิธี |
|---|---|
| รายชื่อสมาชิก (ถ้ามี) | CSV → สมาชิก POS-only + identity เบอร์ (verified ถ้ามีประวัติซื้อ) |
| แต้มคงเหลือเดิม | `OPENING` 1 รายการต่อคน · PointLot หมดอายุ 12 เดือนจากวันย้าย |
| tier เดิม | ตั้งตามเดิม + `tierLockedUntil` 90 วัน ไม่ให้ตกทันที |
| ยอดขายย้อนหลัง 12 เดือน | import ผ่าน POS Import เพื่อให้ spend12m และ RFM ถูก (ไม่ออกแต้มซ้ำ — ใช้โหมด "history") |
| การจองซิมที่มีอยู่ | สร้างใน PMS ก่อน go-live เฟส 2 |

### ขั้นตอนเปิดใช้แต่ละเฟส

1. ซ้อมย้ายบน staging → ตรวจยอดรวม (สมาชิก · แต้ม · ยอดขาย) กับตัวเลขของ MST
2. ตัดข้อมูลวันศุกร์หลังปิดร้าน → ย้ายจริง → ตรวจยอดรวมซ้ำ
3. เปิดวันเสาร์ที่สาขาเดียวก่อน (ถ้ามีหลายสาขา) → อาทิตย์ถัดไปเปิดทุกสาขา
4. แผนย้อนกลับ: backup ก่อนย้าย · หน้าร้านกลับไปใช้วิธีเดิมได้เพราะ POS ไม่ถูกแตะ

---

## 14 · การดูแลหลังเปิดใช้

- Error alert: Vercel log → แจ้งเตือนเมื่อ error 5xx เกินเกณฑ์ · import ล้มเหลว · webhook ล้มเหลว · Job ค้าง
- Backup: Neon PITR + dump รายวันเก็บ 30 วัน
- Runbook: import ผิดไฟล์ · ลูกค้าบอกแต้มไม่ขึ้น · จองซ้อน · LINE token หมดอายุ · ขอลบข้อมูล
- ทบทวนรายเดือน: data quality ต่อสาขา · โควตาข้อความ LINE · จำนวนการเรียก AI · เวลาที่ใช้ดูแล

---

## 15 · คำถามที่ต้องได้จาก MST พร้อมค่าตั้งต้น

ส่งใน Sprint 0 · ถ้ายังไม่ได้คำตอบ ระบบใช้ค่าตั้งต้นและเปลี่ยนได้ใน Settings

| # | คำถาม | ค่าตั้งต้น | ต้องได้ก่อน |
|---|---|---|---|
| 1 | จำนวนสมาชิกปัจจุบัน · บิลต่อเดือน · จำนวนสาขา | รองรับ 50k สมาชิก / 20k บิล | W3 |
| 2 | **ไฟล์ export POS จริง 1 สัปดาห์** · ชื่อยี่ห้อ POS · ชื่อช่องหมายเหตุ · สแกน QR ลงช่องนั้นได้ไหม | — | **W3 (บล็อกงาน)** |
| 3 | รายชื่อสาขา · เวลาเปิดปิด · สาขาไหนมีซิม | สาขาเดียวมีซิม | W3 |
| 4 | กติกาแต้มปัจจุบัน · มีแต้มคงค้างที่ต้องย้ายไหม | 1 บาท = 1 แต้ม | W6 |
| 5 | แต้มหมดอายุแบบไหน | 12 เดือนหลังได้รับ | W6 |
| 6 | คืนสินค้าหลังแลกแต้มไปแล้ว ทำยังไง | ติดลบได้ ระงับการแลก | W6 |
| 7 | ตัวคูณแต้มซ้อนกันได้ไหม | ใช้ตัวสูงสุดตัวเดียว | W6 |
| 8 | Tier: ชื่อ · เกณฑ์ · สิทธิประโยชน์ · มี tier เดิมไหม | MEMBER / SILVER 100k / GOLD 1M | W7 |
| 9 | LINE OA verified หรือยัง · แพ็กเกจข้อความ · ใครเป็นเจ้าของ provider · มี LINE Login channel ไหม | — | **W8 (บล็อกงาน)** |
| 10 | ข้อความ consent และนโยบายความเป็นส่วนตัว | MST จัดหา · เรามีแม่แบบให้ | W8 |
| 11 | รายชื่อพนักงาน + role | — | W10 |
| 12 | แคตตาล็อกรางวัลชุดแรก (ชื่อ · แต้ม · รูป · stock · อนุมัติแบบไหน) | 3 รายการตามสเปก | W13 |
| 13 | ซิม: เวลาเปิด · จองล่วงหน้ากี่วัน · ยกเลิกล่วงหน้ากี่ชม. · no-show · ราคาต่อ lane หรือต่อคน · ส่วนลดสมาชิก | ตามตาราง 5.6 | W16 |
| 14 | ใครอนุมัติแคมเปญ · ใครดูแลรายการสินค้า | Marketing | W20 |
| 15 | frequency cap · ช่วงห้ามส่ง | 2 ข้อความ/7 วัน · 21:00–09:00 | W20 |
| 16 | Brand guideline · tone · ปฏิทินแบรนด์ · งานเก่า | — | W24 |
| 17 | หน้าร้านออนไลน์สำหรับปุ่ม SHOP | ซ่อนปุ่มถ้าไม่มี | W8 |

---

## 16 · ความเสี่ยง

| # | ความเสี่ยง | ผลกระทบ | รับมือ |
|---|---|---|---|
| 1 | MST ส่งไฟล์ POS หรือข้อมูล LINE ช้า | แผนเลื่อนเท่ากับวันที่ช้า | ขอใน Sprint 0 · ทำงานที่ไม่ขึ้นกับคำตอบก่อน (login · schema · infra) |
| 2 | พนักงานไม่พิมพ์ `MSTMEMBER:` ในบิล | ข้อมูลไม่มีเจ้าของ AI ไม่มีอะไรให้ทำงาน | Data Quality รายสาขารายวัน · อบรม · เฟสถัดไปเปลี่ยนเป็นสแกน QR |
| 3 | Messaging API กับ LINE Login อยู่คนละ provider | ลูกค้าคนเดียวกลายเป็นสองคน | ตรวจใน W8 ก่อนเปิด LIFF |
| 4 | ค่าข้อความ LINE สูงกว่าที่ MST คาด | แคมเปญถูกลดความถี่ | แสดงโควตาใน Settings · สรุปแต้มรายวันแทนรายบิล |
| 5 | คนพัฒนามีคนเดียว | ป่วยหรือติดงานอื่น = ทั้งแผนหยุด | ทุก sprint deploy staging ได้ · เอกสารใน repo · test ครอบคลุมส่วนแต้ม |
| 6 | ขอบเขตครบตามสเปก ~28 สัปดาห์ | MST อยากได้เร็วกว่า | go-live ทุกเฟส ลูกค้าใช้งานได้ตั้งแต่ธันวาคม |
| 7 | การจองซ้อน | ลูกค้าสองคนมาที่ lane เดียว | unique index ระดับฐานข้อมูล + test ยิงขนาน |
| 8 | ย้ายแต้มเก่าผิด | ลูกค้าร้องเรียนทันที | ซ้อมบน staging · ตรวจยอดรวมกับ MST ก่อนและหลัง |
| 9 | สมาชิกจริงมีหลักพัน | A/B ไม่ได้ใช้ | A/B เปิดตามขนาดกลุ่มอัตโนมัติ · กลุ่มควบคุมใช้ได้ทุกขนาด |
