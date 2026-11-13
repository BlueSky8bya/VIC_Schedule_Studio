import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, Heart, Mail as MailIcon, Scale, Settings } from "lucide-react";
import styles from "./legal-doc.module.css";

// 개인정보처리방침·이용약관 공용 틀. 공개 페이지라 데이터 로더를 import하지 않는다(글은 정적).
// 문의처·법령 링크는 여기 한 곳에서만 만든다.
export const LEGAL_CONTACT_EMAIL = "3blackspacegames@gmail.com";
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
          </article>
        </div>
      </div>
    </main>
  );
}

/** 문서로 가는 동안의 로딩 — 같은 바탕과 빈 문서 틀만(편집실·달력 뼈대 대신). */
export function LegalLoading() {
  return (
    <main aria-busy="true" className={styles.page}>
      <div aria-hidden="true" className={`${styles.shell} ${styles.skeleton}`}>
        <span />
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}

/** 법령 조문 바로가기 — 국가법령정보센터 조문 주소. article 예: "제15조", "제28조의8". */
export function LawRef({ article, detail }: { article: string; detail?: string }) {
  const href = `https://www.law.go.kr/${encodeURI(`법령/개인정보보호법/${article}`)}`;
  return (
    <a className={styles.law} href={href} rel="noreferrer" target="_blank">
      <Scale aria-hidden="true" size={13} />
      개인정보 보호법 {article}
      {detail ? ` ${detail}` : ""}
    </a>
  );
}

/** 외부 문서(업체 약정·방침, 신고 기관) 바로가기. */
export function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={styles.docLink} href={href} rel="noreferrer" target="_blank">
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

/** 실제 화면 일부를 옮긴 예시 — 설명하는 버튼이 어디에 있는지 바로 보이게. 표시용(눌러도 동작 없음). */
export function UiDemo({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className={styles.demo}>
      <div aria-hidden="true" className={styles.demoStage}>
        {children}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function HeartDemo() {
  return (
    <div className={styles.mockCard}>
      <span className={styles.mockBar} />
      <span className={styles.mockText}>
        <b>21시 합방</b>
        <i>일정 내용</i>
      </span>
      <span className={styles.mockHeart}>
        <Heart size={15} />
      </span>
    </div>
  );
}

export function SettingsDemo() {
  return (
    <div className={styles.mockRow}>
      <span className={styles.mockGear}>
        <Settings size={16} />
      </span>
      <span className={styles.mockLabel}>화면 모드</span>
      <span className={styles.mockSeg}>
        <em>밝게</em>
        <span>어둡게</span>
        <span>자동</span>
      </span>
    </div>
  );
}

export function GoogleLoginDemo() {
  return (
    <span className={styles.mockGoogle}>
      <svg height="16" viewBox="0 0 48 48" width="16">
        <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107" />
        <path d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" fill="#FF3D00" />
        <path d="M24 46c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 36.9 26.9 38 24 38c-6 0-10.7-3.9-12.5-9.3l-6.9 5.3C7.9 41.6 15.3 46 24 46z" fill="#4CAF50" />
        <path d="M44.5 20H24v8.5h11.8c-1 2.8-2.9 5.1-5.3 6.6l6.5 5.5C40.9 44.4 46 38 46 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2" />
      </svg>
      Google로 로그인
    </span>
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
