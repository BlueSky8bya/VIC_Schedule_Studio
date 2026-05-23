import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">VIC Studio</p>
        <h1>페이지를 찾을 수 없어요</h1>
        <p>주소가 바뀌었거나 없는 페이지입니다.</p>
        <Link className="button primary" href="/">
          홈으로
        </Link>
      </section>
    </main>
  );
}
