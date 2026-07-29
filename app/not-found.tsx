import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page system-state-page">
      <section
        className="auth-panel system-state-card"
        aria-labelledby="not-found-title"
      >
        <span className="system-state-icon" aria-hidden>
          404
        </span>
        <p className="eyebrow">VIC Studio</p>
        <h1 id="not-found-title">페이지를 찾을 수 없어요</h1>
        <p>주소가 바뀌었거나 없는 페이지입니다.</p>
        <Link className="button primary system-state-action" href="/">
          홈으로
        </Link>
      </section>
    </main>
  );
}
