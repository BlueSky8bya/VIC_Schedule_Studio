import "./calendar-skeleton.css";

// 라우트 레벨 로딩 스켈레톤. loading.tsx(서버, JS 없음)에서 즉시 렌더된다.
//
// 웹(>640px): 풀 달력 뼈대는 실제 화면과 괴리감이 커서, 목적지에 맞는 간단한 텍스트
//   ("편집실 불러오는 중…")만 가운데에 보여준다.
// 모바일(≤640px): 달력 뼈대 + 같은 텍스트를 보여준다.
//
// 배경색은 목적지에 맞춘다(studio=편집실 톤, poster=시청자/포스터 크림 톤) — 웹·모바일 공통.
//
// 경계 규칙(CLAUDE.md): 비공개 데이터는 한 글자도 없다. 편집 핸들·비공개 토글·잠금 UI 없음.
export function CalendarSkeleton({
  variant = "poster",
  label = "빅토리 일정표"
}: {
  variant?: "poster" | "studio";
  label?: string;
}) {
  const cells = Array.from({ length: 42 });
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return (
    <div className={`cal-skel-stage cal-skel-stage-${variant}`} aria-busy="true">
      {/* 모바일 전용(≤640px): 달력 뼈대. 웹에선 CSS로 숨긴다. */}
      <div className={`cal-skel-card cal-skel-${variant}`} aria-hidden="true">
        {variant === "poster" && <aside className="cal-skel-rail cal-skel-rail-left" />}

        <div className="cal-skel-main">
          <div className="cal-skel-heading">
            <span className="cal-skel-spark">✨️</span>
            <strong className="cal-skel-title">빅토리 일정표</strong>
            <span className="cal-skel-spark">✨️</span>
          </div>
          <div className="cal-skel-monthbar">
            <span className="cal-skel-month" />
          </div>
          <div className="cal-skel-weekrow">
            {weekdays.map((w) => (
              <span className="cal-skel-weekday" key={w}>
                {w}
              </span>
            ))}
          </div>
          <div className="cal-skel-grid">
            {cells.map((_, i) => (
              <span className="cal-skel-cell" key={i} />
            ))}
          </div>
        </div>

        {variant === "poster" ? (
          <aside className="cal-skel-rail cal-skel-rail-right" />
        ) : (
          <aside className="cal-skel-editor" />
        )}
      </div>

      {/* 목적지 텍스트 — 웹에선 "{label} 불러오는 중…" 단독 표시. 모바일에선 카드 헤딩에
          이미 "빅토리 일정표"가 있어 label을 숨기고 "불러오는 중…"만 둔다. */}
      <p className="cal-skel-note" role="status">
        <span className="cal-skel-note-label">{label} </span>불러오는 중…
      </p>
    </div>
  );
}
