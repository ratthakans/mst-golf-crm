import { formatThaiDate } from "@/lib/format";

export function ConsentDocument({
  heading,
  intro,
  sections,
}: {
  heading: string;
  intro?: string;
  sections: Array<{ title: string; body: string; version: string; effectiveAt: string }>;
}) {
  return (
    <article className="article">
      <div className="wrap article-wrap">
        <header className="article-head">
          <h1>{heading}</h1>
          {intro && <p className="lede">{intro}</p>}
        </header>
        {sections.length === 0 ? (
          <p className="empty">กำลังปรับปรุงเนื้อหา กรุณาติดต่อร้านหากต้องการข้อมูล</p>
        ) : (
          sections.map((s) => (
            <section key={s.title} className="consent-doc">
              <h2>{s.title}</h2>
              <p className="hint">
                ฉบับ {s.version} · มีผลตั้งแต่ {formatThaiDate(new Date(s.effectiveAt))}
              </p>
              <p className="prose-body">{s.body}</p>
            </section>
          ))
        )}
      </div>
    </article>
  );
}
