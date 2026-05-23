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
          {error?.message ? <pre>{error.message}</pre> : null}
          <button onClick={() => reset()} type="button">
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
