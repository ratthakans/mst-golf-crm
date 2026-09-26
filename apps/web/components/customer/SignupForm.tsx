"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconCheck } from "@/components/icons";
import { api, looksLikeLineApp } from "@/lib/client";
import { formatPoints } from "@/lib/format";
import type { CardData, ConsentDoc } from "@/lib/types";
import { Sheet } from "./Sheet";

type Field = "fullName" | "phone" | "birthday" | "email" | "terms";

interface Props {
  lineName: string;
  welcomePoints: number;
  terms: ConsentDoc | null;
  marketing: ConsentDoc | null;
  next: "booking" | null;
  todayKey: string;
}

// Flow page 03 step 02: name, mobile, optional birthday and email, PDPA
// consent. The LINE account comes from the session cookie on the server.
export function SignupForm({ lineName, welcomePoints, terms, marketing, next, todayKey }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(lineName.length >= 2 ? lineName : "");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [email, setEmail] = useState("");
  const [accept, setAccept] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<{ text: string; code: string } | null>(null);
  const [doc, setDoc] = useState<ConsentDoc | null>(null);
  const [done, setDone] = useState<{ outcome: "created" | "linked"; welcomePoints: number; member: CardData } | null>(null);

  const validate = (): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    if (fullName.trim().length < 2) e.fullName = "กรุณากรอกชื่อ-นามสกุล";
    const digits = phone.replace(/\D/g, "");
    if (!/^(0[689]\d{8}|66[689]\d{8})$/.test(digits)) e.phone = "เบอร์มือถือไม่ถูกต้อง (ขึ้นต้น 06 08 หรือ 09 และมี 10 หลัก)";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "อีเมลไม่ถูกต้อง";
    if (!accept) e.terms = "กรุณายอมรับข้อกำหนดและนโยบายความเป็นส่วนตัว";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      document.getElementById(`su-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const res = await api<{ outcome: "created" | "linked"; welcomePoints: number; member: CardData }>("/api/me/signup", {
      method: "POST",
      body: {
        fullName,
        phone,
        birthday: birthday || null,
        email: email.trim() || null,
        acceptTerms: accept,
        marketing: optIn,
        inLine: looksLikeLineApp(),
      },
    });
    setBusy(false);
    if (res.ok) {
      setDone(res.data);
      window.scrollTo({ top: 0 });
      return;
    }
    // Put the core's Thai message next to the field it is about.
    const field: Field | null =
      res.code === "PHONE_INVALID" || res.code === "PHONE_TAKEN"
        ? "phone"
        : res.code === "INVALID_INPUT"
          ? /ชื่อ/.test(res.error)
            ? "fullName"
            : /วันเกิด/.test(res.error)
              ? "birthday"
              : /อีเมล/.test(res.error)
                ? "email"
                : /ยอมรับ/.test(res.error)
                  ? "terms"
                  : null
          : null;
    if (field) {
      setErrors({ [field]: res.error });
      document.getElementById(`su-${field}`)?.focus();
    } else {
      setFormError({ text: res.error, code: res.code });
    }
  };

  const openCard = () => {
    router.replace("/app/member");
    router.refresh();
  };

  if (done) {
    const linked = done.outcome === "linked";
    return (
      <section className="panel welcome" aria-live="polite">
        <span className="welcome-mark" aria-hidden="true">
          <IconCheck size={28} />
        </span>
        <h1>{linked ? "เชื่อมบัญชี LINE เรียบร้อย" : "ยินดีต้อนรับสู่ MST Golf"}</h1>
        {done.welcomePoints > 0 ? (
          <p className="welcome-points">
            ได้ <b className="num">{formatPoints(done.welcomePoints)}</b> แต้มต้อนรับ
          </p>
        ) : null}
        <p className="muted">
          {linked
            ? "เราพบข้อมูลสมาชิกเดิมจากเบอร์นี้ แต้มและประวัติการซื้อเดิมอยู่ครบในบัตรของคุณ"
            : `รหัสสมาชิกของคุณคือ ${done.member.code} แสดงบัตรหรือแจ้งเบอร์มือถือที่เคาน์เตอร์เพื่อสะสมแต้มทุกการซื้อ`}
        </p>
        <div className="stack">
          {next === "booking" ? (
            <>
              <Link href="/app/booking" className="btn btn-primary btn-block">
                ไปจองซิมกอล์ฟต่อ
              </Link>
              <button type="button" className="btn btn-secondary btn-block" onClick={openCard}>
                ดูบัตรสมาชิก
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-block" onClick={openCard}>
              ดูบัตรสมาชิก
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      {next === "booking" && (
        <p className="notice" style={{ marginBottom: 20 }}>
          <span>
            <b>ต้องเป็นสมาชิกก่อนจองซิม</b> สมัครฟรีด้านล่าง เสร็จแล้วกดไปจองซิมกอล์ฟต่อได้ทันที
          </span>
        </p>
      )}
      <h1 className="panel-title">สมัครสมาชิก</h1>
      <p className="muted panel-lead">
        รับ <b className="num">{formatPoints(welcomePoints)}</b> แต้มต้อนรับทันที สะสมแต้มทุกการซื้อ และจองซิมกอล์ฟออนไลน์
      </p>

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="su-fullName">ชื่อ-นามสกุล</label>
          <input
            id="su-fullName"
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            maxLength={80}
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "su-fullName-err" : undefined}
          />
          {errors.fullName && (
            <p id="su-fullName-err" className="field-error">
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="su-phone">เบอร์มือถือ</label>
          <input
            id="su-phone"
            className="input num"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel-national"
            placeholder="08X-XXX-XXXX"
            maxLength={16}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "su-phone-err" : "su-phone-hint"}
          />
          {errors.phone ? (
            <p id="su-phone-err" className="field-error">
              {errors.phone}
            </p>
          ) : (
            <p id="su-phone-hint" className="hint">
              ใช้แจ้งที่เคาน์เตอร์เพื่อสะสมแต้ม ถ้าเคยให้เบอร์กับร้านไว้ แต้มเดิมจะมาอยู่ในบัตรนี้
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="su-birthday">
            วันเกิด <span className="optional">(ไม่บังคับ)</span>
          </label>
          <input
            id="su-birthday"
            className="input"
            type="date"
            value={birthday}
            max={todayKey}
            onChange={(e) => setBirthday(e.target.value)}
            autoComplete="bday"
            aria-invalid={!!errors.birthday}
            aria-describedby="su-birthday-hint"
          />
          {errors.birthday ? (
            <p className="field-error">{errors.birthday}</p>
          ) : (
            <p id="su-birthday-hint" className="hint">
              ใส่ไว้เพื่อรับแต้ม ×2 ทุกการซื้อในเดือนเกิด · ตั้งได้ครั้งเดียว
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="su-email">
            อีเมล <span className="optional">(ไม่บังคับ)</span>
          </label>
          <input
            id="su-email"
            className="input"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={120}
            aria-invalid={!!errors.email}
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div className="consents">
          <label className="check">
            <input id="su-terms" type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} aria-invalid={!!errors.terms} />
            <span>
              ยอมรับ{" "}
              {terms ? (
                <button type="button" className="text-link" onClick={() => setDoc(terms)}>
                  {terms.title}
                </button>
              ) : (
                "ข้อกำหนดสมาชิกและนโยบายความเป็นส่วนตัว"
              )}
            </span>
          </label>
          {errors.terms && <p className="field-error">{errors.terms}</p>}
          <label className="check">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <span>
              {marketing ? (
                <>
                  {marketing.title} <span className="optional">(ไม่บังคับ)</span> ·{" "}
                  <button type="button" className="text-link" onClick={() => setDoc(marketing)}>
                    อ่าน
                  </button>
                </>
              ) : (
                <>
                  รับข่าวสารและโปรโมชั่น <span className="optional">(ไม่บังคับ)</span>
                </>
              )}
            </span>
          </label>
        </div>

        {formError && (
          <div className="notice notice-error" role="alert">
            <span>{formError.text}</span>
            {formError.code === "ALREADY_MEMBER" && (
              <button type="button" className="text-link" onClick={() => router.refresh()}>
                เปิดบัตรสมาชิก
              </button>
            )}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy} data-loading={busy || undefined}>
          {busy && <span className="spinner" aria-hidden="true" />}
          <span>{busy ? "กำลังสมัคร…" : `สมัครเลย รับ ${formatPoints(welcomePoints)} แต้ม`}</span>
        </button>
      </form>

      {doc && (
        <Sheet
          title={doc.title}
          onClose={() => setDoc(null)}
          footer={
            doc === terms ? (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => {
                  setAccept(true);
                  setErrors((e) => ({ ...e, terms: undefined }));
                  setDoc(null);
                }}
              >
                ยอมรับ
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => setDoc(null)}>
                ปิด
              </button>
            )
          }
        >
          <p className="hint" style={{ marginBottom: 12 }}>
            ฉบับ {doc.version}
          </p>
          <p className="prose-body">{doc.body}</p>
        </Sheet>
      )}
    </section>
  );
}
