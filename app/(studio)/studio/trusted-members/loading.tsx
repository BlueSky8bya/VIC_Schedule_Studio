// 매니저/작업자 관리 페이지 콜드 진입 로딩 — 실제 내용이 올 자리(셸+제목) 그대로 두고
// 그 아래에 스켈레톤을 깔아 위치가 튀지 않게(HCI: preserve position).
export default function Loading() {
  return (
    <main className="placeholder-page trusted-members-page" aria-hidden="true">
      <section className="trusted-members-panel">
        <p className="eyebrow">VIC Studio</p>
        <h1>매니저 / 작업자 권한</h1>
        <div className="insight-skel">
          <span />
          <span />
          <span />
        </div>
        <p className="insight-empty" role="status">
          불러오는 중…
        </p>
      </section>
    </main>
  );
}
