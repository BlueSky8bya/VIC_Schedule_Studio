import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./legal-doc.module.css";

// 개인정보처리방침·이용약관 공용 틀. 공개 페이지라 데이터 로더를 import하지 않는다(글은 정적).
// 문의처는 한 곳에서만 바꾼다.
export const LEGAL_CONTACT_EMAIL = "3blackspacegames@gmail.com";
export const SITE_NAME = "빅토리 방송 일정표";

export type LegalSection = { id: string; title: string; body: ReactNode };

export function LegalDoc({
  kind,
  title,
  lead,
  effective,
  sections
}: {
  kind: "privacy" | "terms";
  title: string;
  lead: string;
  effective: string;
  sections: LegalSection[];
}) {
  return (
    <main className={styles.page}>
      <article className={styles.doc}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>{SITE_NAME}</p>
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          <p className={styles.date}>{effective}</p>
        </header>
        <nav aria-label="목차" className={styles.toc}>
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {sections.map((s, i) => (
          <section aria-labelledby={`${s.id}-h`} className={styles.section} id={s.id} key={s.id}>
            <h2 id={`${s.id}-h`}>
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ))}
        <footer className={styles.foot}>
          <Link data-act="legal-home" href="/">
            ← 일정표로
          </Link>
          <span className={styles.footLinks}>
            {kind === "privacy" ? (
              <Link data-act="legal-terms" href={"/terms" as Route}>
                이용약관
              </Link>
            ) : (
              <Link data-act="legal-privacy" href={"/privacy" as Route}>
                개인정보처리방침
              </Link>
            )}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>문의</a>
          </span>
        </footer>
      </article>
    </main>
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
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Mail() {
  return <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
}
