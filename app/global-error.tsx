"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body className="system-state-body">
        <main className="auth-page system-state-page">
          <section
            className="auth-panel system-state-card"
            aria-labelledby="global-error-title"
          >
            <span
              className="system-state-icon system-state-icon-danger"
              aria-hidden
            >
              !
            </span>
            <p className="eyebrow">VIC Studio</p>
            <h1 id="global-error-title">문제가 발생했어요</h1>
            <p>앱을 불러오는 중 오류가 났습니다. 다시 시도해 주세요.</p>
            {/* P0-SEC-3: 원문 error.message 렌더 금지 — digest(서버 로그 대조용)만 표시. */}
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
      </body>
    </html>
  );
}
