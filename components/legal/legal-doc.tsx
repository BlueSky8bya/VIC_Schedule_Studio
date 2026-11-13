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
  summary,
  sections
}: {
  kind: "privacy" | "terms";
  title: string;
  lead: string;
  effective: string;
  /** 맨 위 '한눈에 보기' — 긴 글을 읽지 않아도 핵심을 알 수 있게. */
  summary: ReactNode[];
  sections: LegalSection[];
}) {
  return (
    <main className={styles.page}>
      <article className={styles.doc}>
        <header className={styles.head}>
          <Link className={styles.back} data-act="legal-home" href="/">
            ← 일정표로 돌아가기
          </Link>
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          <p className={styles.date}>{effective}</p>
        </header>
        <section aria-labelledby="legal-summary-h" className={styles.summary}>
          <h2 id="legal-summary-h">한눈에 보기</h2>
          <ul>
            {summary.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
        {sections.map((s) => (
          <section aria-labelledby={`${s.id}-h`} className={styles.section} id={s.id} key={s.id}>
            <h2 id={`${s.id}-h`}>{s.title}</h2>
            {s.body}
          </section>
        ))}
        <footer className={styles.foot}>
          <span>
            궁금한 점은 <Mail />로 보내 주세요.
          </span>
          {kind === "privacy" ? (
            <Link data-act="legal-terms" href={"/terms" as Route}>
              이용약관 보기
            </Link>
          ) : (
            <Link data-act="legal-privacy" href={"/privacy" as Route}>
              개인정보처리방침 보기
            </Link>
          )}
        </footer>
      </article>
    </main>
  );
}

/** 문서로 가는 동안의 로딩 — 같은 바탕과 빈 문서 틀만 보여 준다(편집실·달력 뼈대 대신). */
export function LegalLoading() {
  return (
    <main aria-busy="true" className={styles.page}>
      <div aria-hidden="true" className={`${styles.doc} ${styles.skeleton}`}>
        <span />
        <span />
        <span />
        <span />
      </div>
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

/** 작은 글씨의 근거·참고 줄(법 조항 등) — 본문 흐름을 끊지 않게 따로 둔다. */
export function LegalNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

export function Mail() {
  return <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
}
