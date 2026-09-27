# Runbook — MST Golf Platform

This runbook tells ORIONS and the store's Super Admin how to fix common problems. Staff follow the manual (`docs/mst-golf-manual.pdf`); the business rules are in `docs/PRODUCT.md`.

**Start with the back office for every problem.** Settings › สถานะระบบ shows the scheduled jobs, LINE messages, imports and system values. Settings › บันทึกการใช้งาน shows who did what.

| Where | What |
|---|---|
| Back office | Vercel `mst-golf-crm` (apps/web-admin) |
| Website + customer pages | Vercel `mst-golf-web` (apps/web) |
| Database | Neon, one database with a schema per environment: `public` = production · `preview` · `dev` · `test_core` |
| 15-minute cron + backup | GitHub Actions `cron-frequent.yml` · `backup.yml` (secrets: `ADMIN_URL` `CRON_SECRET` `DATABASE_URL_UNPOOLED` `BACKUP_BLOB_TOKEN` `BACKUP_PASSPHRASE`) |
| Nightly cron | Vercel Cron `/api/cron/nightly` 02:00 Bangkok |

Commands below run from the repo root. They need `.env.local`, and the database URL must point at the right database. `DATABASE_SCHEMA=public` means production: check the environment twice before pressing enter.

---

## 1. Imported the wrong file / wrong day

- **Who fixes it:** the Store Manager or Super Admin, in the back office.
- Go to นำเข้า POS › ประวัติการนำเข้า › **ยกเลิกรอบนี้** and give a reason. This works for **7 days** after the import.
- The system then:
  - takes the bills out
  - takes back the points
  - recalculates tiers
  - cancels the LINE messages that were still waiting
- The same file can be imported again afterwards.
- **Refused** when a return bill in a later round refers to this round. Cancel the later round first, then this one, then import both again in order.
- **More than 7 days ago:** you cannot cancel the round. Fix each member with **ปรับแต้ม** instead, with the reason "แก้การนำเข้าผิด <file name>". The Super Admin adjusts without a limit. Tell ORIONS if sales need correcting in the database.

## 2. A customer says their points did not arrive

1. Open the member › **บิล** tab. Is that bill there?
   - **Yes:** open **แต้ม**. Points are given at the tier held before that bill. Check whether the product is excluded from points (Settings › แต้ม).
   - **No:** go on to step 2.
2. นำเข้า POS › ประวัติ. Has that day been imported?
   - **No:** import it. The points go in right away.
   - **Yes:** download **มีปัญหา** for that round and look up the bill number:
     - **"ไม่มีเบอร์สมาชิกในบิล":** the staff forgot `MSTMEMBER`. Confirm with the receipt, then **ปรับแต้ม** with the bill number as the reason.
     - **"อ่านเบอร์/รหัส…ไม่ได้":** the remark was typed wrong. Same fix.
     - **"ไม่พบรหัสสมาชิก":** the code was mistyped. Same fix.
3. The same thing keeps happening: look at **คุณภาพข้อมูล 7 วันล่าสุด** on the import page and follow up with the counter.

## 3. "เบอร์ชนกัน" / the customer cannot sign up in LINE

- **Cause:** the phone is already linked to another LINE account. The system has already put an item in คิวตรวจสอบ.
- **Fix:**
  - Contact the customer and check whether it is the same person (changed phone or new LINE account).
  - Same person with two accounts: fix it with **รวมบัญชีซ้ำ** (Section 4).
  - Someone else is using that phone number: change the phone on one of the two accounts (แก้ไขข้อมูล).
- Mark the queue item **ดำเนินการแล้ว**.

## 4. Merging duplicate accounts

- Super Admin only: member › **รวมบัญชีซ้ำ** › search for the other account › choose the account to keep › reason.
- **What moves:** identities, points, sales, bookings, events and consents.
- **What doesn't:** no second welcome bonus is paid. LINE messages still waiting in the old account are cancelled.
- **You cannot undo it.** It is refused if both accounts are linked to *different* LINE accounts. Remove one LINE account first by contacting the customer (ask ORIONS if needed).

## 5. A customer asks to delete their data (PDPA)

1. Confirm who the customer is, and keep evidence of the request (message or email).
2. Super Admin: member › **ลบข้อมูล (PDPA)** › reason or request reference › type "ลบข้อมูล".
3. Name, phone, LINE, email and photo are removed. Sales stay, with no link to the person, so the store's totals do not change.
4. Record the date it was done in the reply to the customer.

## 6. LINE messages are not going out

- **Check first:** สถานะระบบ › ข้อความ LINE (7 days).
  - **Many "ข้าม" and LINE not connected yet:** normal. Messages are sent once the credentials are in.
  - **"ส่งไม่สำเร็จ" rising:** go to Settings › LINE and look at **ข้อความที่ส่งเดือนนี้**.
    - It shows "อ่านไม่ได้": the token has expired or was revoked. Ask the LINE team for a new long-lived token, then enter it in Settings › LINE (leave the secret blank to keep it).
    - The monthly quota of the OA's plan is used up: the LINE team or MST must upgrade the plan.
  - **"รอส่ง" piling up with an old date:** the 15-minute cron is not running (Section 7).
- **One customer only:** the member page shows the badge **LINE ส่งไม่ถึง** (they blocked the OA). Ask them to add the OA as a friend again. The flag clears on the next successful send.
- **Note:** a message that failed 5 times is not sent again automatically. It is recorded as FAILED.

## 7. A scheduled job did not run (สถานะระบบ shows red)

| Job | Check | Run it by hand |
|---|---|---|
| Nightly | Vercel › mst-golf-crm › Logs, path `/api/cron/nightly` · Vercel Cron in the project settings | `curl -H "Authorization: Bearer $CRON_SECRET" https://<admin>/api/cron/nightly` |
| Every 15 min | GitHub › Actions › cron-frequent (is it running? are the secrets `ADMIN_URL` and `CRON_SECRET` set?) | Actions › cron-frequent › Run workflow |
| Backup | GitHub › Actions › backup (look at the log of the failed step) | Actions › backup › Run workflow |

- Every job is safe to run twice. Running nightly on a day other than the 1st never moves anyone down a tier.
- GitHub turns off scheduled workflows in repos with no activity for 60 days. If that happens, press "Enable workflow" in the Actions tab.

## 8. Backup failed / restoring from a backup

- **Backup failed:** open the log in GitHub Actions and check:
  - the secrets (`DATABASE_URL_UNPOOLED`, `BACKUP_BLOB_TOKEN`, `BACKUP_PASSPHRASE`)
  - the Blob store's space
  - that Neon is reachable
  Then run it again by hand.
- **Restoring** (ORIONS only; always test it on a temporary database first):
  ```
  # 1. download backups/mst-golf-<time>.sql.gz.enc from the private backup Blob store
  # 2. decrypt it into a temporary database or schema first
  openssl enc -d -aes-256-cbc -pbkdf2 -in mst-golf-<time>.sql.gz.enc -pass env:BACKUP_PASSPHRASE | gunzip | psql "<temporary database URL>"
  # 3. check the totals (members, points, sales) before switching or copying anything into production
  ```
  - Backups are kept for 30 days.
  - **Without `BACKUP_PASSPHRASE` a backup cannot be opened.** Keep it outside the system.

## 9. Nobody can sign in as Super Admin

```
DATABASE_SCHEMA=public pnpm --filter @mstgolf/database admin:create <email>
```

- This creates the account, or turns an existing one back into a Super Admin with a new temporary password. The password is printed **once**.
- Use the production database URL and `DATABASE_SCHEMA=public`. This script does not ask you to confirm production, so check twice.
- Every run is recorded in the audit log as `user.admin_cli`.

## 10. `ENCRYPTION_KEY` lost or different between the two projects

- **Symptoms:** Settings › LINE shows "อ่านไม่ได้", or the website cannot log customers in or send messages.
- `mst-golf-crm` and `mst-golf-web` must use the **same value**.
- **Lost:** the LINE credentials already stored can never be read again.
  1. Set a new key in both projects and redeploy.
  2. Enter the LINE credentials again in Settings › LINE, using the values the LINE team sent.

## 11. Points ledger and points balance do not match

- The nightly job checks every night. สถานะระบบ › งานกลางคืน shows "แต้มไม่ตรง N". The Vercel log has `[nightly] points cache drift` with a few member IDs.
- This should never happen, because the ledger and the balance are always written in the same transaction. If it does, tell ORIONS before anyone adjusts points.
- The ledger (`point_transactions`) is correct. Fix the balance to match it, then find the cause.

## 12. The website did not update after an edit

- Content pages update within **5 minutes**. Refresh after that.
- Uploading a photo failed with "ยังไม่ได้ตั้งค่าที่เก็บรูปเว็บไซต์": `PUBLIC_BLOB_READ_WRITE_TOKEN` is not set on `mst-golf-crm`. Paste an https link instead for now.

## 13. A deploy went wrong

- Vercel › project › Deployments › choose the last good deployment › **Promote to Production** (instant rollback).
- If a database migration shipped with that deploy, rolling back the app does not roll back the schema. Tell ORIONS to check that the old code still works with the new schema.
- `main` = production for both projects. Merge only after the preview has passed UAT.
