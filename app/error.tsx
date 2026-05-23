"use client";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">VIC Studio</p>
        <h1>문제가 발생했어요</h1>
        <p>페이지를 불러오는 중 오류가 났습니다. 다시 시도해 주세요.</p>
        {error?.message ? <div className="auth-warning">{error.message}</div> : null}
        <button className="button primary" onClick={() => reset()} type="button">
          다시 시도
        </button>
      </section>
    </main>
  );
}
