"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page system-state-page">
      <section
        className="auth-panel system-state-card"
        aria-labelledby="error-title"
      >
        <span
          className="system-state-icon system-state-icon-danger"
          aria-hidden
        >
          !
        </span>
        <p className="eyebrow">VIC Studio</p>
        <h1 id="error-title">문제가 발생했어요</h1>
        <p>페이지를 불러오는 중 오류가 났습니다. 다시 시도해 주세요.</p>
        {/* P0-SEC-3: 원문 error.message는 DB 테이블명·내부 경로 등 서버 내부를 노출할 수
            있어 렌더하지 않는다. 추적은 Next가 서버 로그와 짝지어 주는 digest로만. */}
        {error?.digest ? (
          <p className="error-digest">문의 코드: {error.digest}</p>
        ) : null}
        <button
          className="button primary system-state-action"
          onClick={() => reset()}
          type="button"
        >
          다시 시도
        </button>
      </section>
    </main>
  );
}
