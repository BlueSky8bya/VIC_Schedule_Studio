/* eslint-disable @next/next/no-html-link-for-pages -- Standalone document navigation avoids application prefetch on a routing-level 404. */
import type { Metadata } from "next";
import styles from "./global-not-found.module.css";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없어요 · 방송일정",
  robots: { index: false, follow: false }
};

// Routing-level 404 only. Keep this document independent of the authenticated
// root layout, application beacons, fonts, loaders and user-provided paths.
export default function GlobalNotFound() {
  return (
    <html lang="ko" className={styles.document}>
      <body className={styles.body}>
        <main className={styles.page}>
          <section className={styles.card} aria-labelledby="not-found-title">
            <span className={styles.code} aria-hidden="true">404</span>
            <p className={styles.eyebrow}>VIC Studio</p>
            <h1 id="not-found-title">페이지를 찾을 수 없어요</h1>
            <p className={styles.description}>주소가 바뀌었거나 없는 페이지입니다.</p>
            <a className={styles.home} data-act="not-found-home" href="/">홈으로</a>
          </section>
        </main>
      </body>
    </html>
  );
}
