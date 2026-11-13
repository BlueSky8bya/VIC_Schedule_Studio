import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bug, ExternalLink, Lightbulb, Mail as MailIcon, Scale, ShieldCheck } from "lucide-react";
import { LEGAL_CONTACT_EMAIL } from "./contact";
import { ContactButton } from "./legal-interactive";
import styles from "./legal-doc.module.css";

// 개인정보처리방침·이용약관 공용 틀. 공개 페이지라 데이터 로더를 import하지 않는다(글은 정적).
// 문의처는 contact.ts, 움직이는 조각(화면 예시·문의 창)은 legal-interactive.tsx.
export { LEGAL_CONTACT_EMAIL };
export { GoogleLoginDemo, HeartDemo, ThemeDemo } from "./legal-interactive";
export const SITE_NAME = "빅토리 방송 일정표";

export type LegalSection = { id: string; title: string; body: ReactNode };
export type LegalFact = { icon: ReactNode; title: string; text: string };

export function LegalDoc({
  kind,
  title,
  effective,
  facts,
  sections
}: {
  kind: "privacy" | "terms";
  title: string;
  effective: string;
  facts: LegalFact[];
  sections: LegalSection[];
}) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.head}>
          <div className={styles.topRow}>
            <Link className={styles.back} data-act="legal-home" href="/">
              ← 일정표
            </Link>
            <nav aria-label="문서" className={styles.switch}>
              <Link
                aria-current={kind === "privacy" ? "page" : undefined}
                data-act="legal-privacy"
                href={"/privacy" as Route}
              >
                개인정보처리방침
              </Link>
              <Link aria-current={kind === "terms" ? "page" : undefined} data-act="legal-terms" href={"/terms" as Route}>
                이용약관
              </Link>
            </nav>
          </div>
          <div className={styles.headMain}>
            <div>
              <p className={styles.eyebrow}>{SITE_NAME}</p>
              <h1>{title}</h1>
              <dl className={styles.meta}>
                <div>
                  <dt>시행일</dt>
                  <dd>{effective}</dd>
                </div>
                <div>
                  <dt>문의</dt>
                  <dd>
                    <Mail />
                  </dd>
                </div>
              </dl>
            </div>
            {/* 머리 오른쪽 장식 — 토리님 일러스트(공개 자산 public/premiere). 좁은 화면에선 숨긴다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" aria-hidden="true" className={styles.headArt} height={150} src="/premiere/tori-invitation.webp" width={150} />
          </div>
          <ul className={styles.facts}>
            {facts.map((f) => (
              <li key={f.title}>
                <span aria-hidden="true" className={styles.factIcon}>
                  {f.icon}
                </span>
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </header>

        <div className={styles.body}>
          <aside className={styles.side}>
            <nav aria-label="목차" className={styles.toc}>
              <p>목차</p>
              <ol>
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <ContactButton variant="side" />
          </aside>
          <article className={styles.doc}>
            {sections.map((s, i) => (
              <section aria-labelledby={`${s.id}-h`} className={styles.section} id={s.id} key={s.id}>
                <h2 id={`${s.id}-h`}>
                  <span aria-hidden="true" className={styles.num}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                </h2>
                {s.body}
              </section>
            ))}
            <ContactBanner />
          </article>
        </div>
      </div>
    </main>
  );
}

/** 버그 제보·아이디어를 받는다는 홍보 띠 — 본문 끝. 누르면 같은 문의 창이 열린다. */
function ContactBanner() {
  return (
    <section aria-labelledby="legal-contact-banner-h" className={styles.banner}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" aria-hidden="true" className={styles.bannerArt} height={132} src="/premiere/victamin-cheer.webp" width={132} />
      <div className={styles.bannerBody}>
        <p className={styles.bannerKicker}>여러분의 한 줄이 일정표를 바꿉니다</p>
        <h2 id="legal-contact-banner-h">버그 제보 · 아이디어 대환영</h2>
        <ul className={styles.bannerChips}>
          <li>
            <Bug aria-hidden="true" size={14} />
            고장 난 곳
          </li>
          <li>
            <Lightbulb aria-hidden="true" size={14} />
            있으면 좋을 기능
          </li>
          <li>
            <ShieldCheck aria-hidden="true" size={14} />
            개인정보 요청
          </li>
        </ul>
        <div className={styles.bannerActions}>
          <ContactButton initialTopic="idea" variant="banner" />
          <span className={styles.bannerMail}>{LEGAL_CONTACT_EMAIL}</span>
        </div>
      </div>
    </section>
  );
}

/** 문서로 가는 동안의 로딩 — 같은 바탕과 빈 문서 틀(편집실·달력 뼈대 대신) + 움직이는 줄. */
export function LegalLoading() {
  return (
    <main aria-busy="true" aria-label="불러오는 중" className={styles.page}>
      <div aria-hidden="true" className={`${styles.shell} ${styles.skeleton}`}>
        <span />
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}

/** 법령 조문 바로가기 — 국가법령정보센터 주소. law 기본값은 개인정보 보호법(공식 표기 '개인정보보호법'). */
export function LawRef({ law = "개인정보보호법", label, article, detail }: { law?: string; label?: string; article?: string; detail?: string }) {
  const href = `https://www.law.go.kr/${encodeURI(`법령/${law}${article ? `/${article}` : ""}`)}`;
  const name = label ?? (law === "개인정보보호법" ? "개인정보 보호법" : law);
  return (
    <a className={styles.law} href={href} rel="noreferrer" target="_blank">
      <Scale aria-hidden="true" size={13} />
      {name}
      {article ? ` ${article}` : ""}
      {detail ? ` ${detail}` : ""}
    </a>
  );
}

type Brand = "soop" | "cloudflare" | "supabase" | "google";

/** 업체 아이콘 — 사이트가 직접 제공(외부 서버에서 받지 않음 → 문서를 연 사람의 접속 정보가 업체로 가지 않는다). */
export function BrandIcon({ brand, size = 16 }: { brand: Brand; size?: number }) {
  if (brand === "google") {
    return (
      <svg aria-hidden="true" className={styles.brand} height={size} viewBox="0 0 48 48" width={size}>
        <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107" />
        <path d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" fill="#FF3D00" />
        <path d="M24 46c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 36.9 26.9 38 24 38c-6 0-10.7-3.9-12.5-9.3l-6.9 5.3C7.9 41.6 15.3 46 24 46z" fill="#4CAF50" />
        <path d="M44.5 20H24v8.5h11.8c-1 2.8-2.9 5.1-5.3 6.6l6.5 5.5C40.9 44.4 46 38 46 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2" />
      </svg>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" aria-hidden="true" className={styles.brand} height={size} src={`/legal/${brand}.png`} width={size} />;
}

/** 이름 앞에 업체 아이콘을 붙인 글자 — 표 칸에서 쓴다. */
export function Vendor({ brand, children }: { brand: Brand; children: ReactNode }) {
  return (
    <span className={styles.vendor}>
      <BrandIcon brand={brand} />
      {children}
    </span>
  );
}

/** 외부 문서(업체 약정·방침, 신고 기관) 바로가기. brand가 있으면 업체 아이콘을 앞에 붙인다. */
export function DocLink({ href, brand, children }: { href: string; brand?: Brand; children: ReactNode }) {
  return (
    <a className={styles.docLink} href={href} rel="noreferrer" target="_blank">
      {brand ? <BrandIcon brand={brand} size={14} /> : null}
      {children}
      <ExternalLink aria-hidden="true" size={12} />
    </a>
  );
}

/** 근거·관련 문서 칩 줄. */
export function Refs({ children }: { children: ReactNode }) {
  return <p className={styles.refs}>{children}</p>;
}

export function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className={styles.callout}>
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td data-label={head[j]} key={j}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Steps({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ol className={styles.steps}>
      {items.map((s) => (
        <li key={s.title}>
          <strong>{s.title}</strong>
          <span>{s.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** 실제 화면 일부를 옮긴 예시 — 직접 눌러 볼 수 있다. hint: 무엇을 해 보라는 짧은 안내. */
export function UiDemo({ caption, hint, children }: { caption: string; hint?: string; children: ReactNode }) {
  return (
    <figure className={styles.demo}>
      {hint ? <span className={styles.demoHint}>{hint}</span> : null}
      <div className={styles.demoStage}>{children}</div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function Mail() {
  return (
    <a className={styles.mail} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
      <MailIcon aria-hidden="true" size={13} />
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}
