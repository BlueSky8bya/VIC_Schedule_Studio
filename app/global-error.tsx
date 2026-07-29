"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <main style={{ padding: "48px", fontFamily: "sans-serif" }}>
          <h1>문제가 발생했어요</h1>
          <p>앱을 불러오는 중 오류가 났습니다. 다시 시도해 주세요.</p>
          {/* P0-SEC-3: 원문 error.message 렌더 금지 — digest(서버 로그 대조용)만 표시. */}
          {error?.digest ? <p style={{ color: "#8a93a3", fontSize: 13 }}>문의 코드: {error.digest}</p> : null}
          <button onClick={() => reset()} type="button">
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
