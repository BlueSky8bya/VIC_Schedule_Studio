import "./calendar-skeleton.css";

// 라우트 레벨 로딩 스켈레톤. loading.tsx(서버, JS 없음)에서 즉시 렌더돼,
// 인증·역할·일정이 풀릴 때까지 빈 화면 대신 달력 뼈대를 보여준다.
//
// 경계 규칙(CLAUDE.md): 비공개 데이터는 한 글자도 없다 — 공개 안전한 제목 텍스트와
// 회색 shimmer 칸만. 편집 핸들·비공개 토글·잠금 UI는 절대 미리 보이지 않는다.
//
// 실제 화면(.poster-surface)은 1840×1035 고정 캔버스를 JS로 축소하지만, 스켈레톤은
// JS가 없으므로 폭에 맞춰 반응형으로 같은 "모양"(제목 + 월 + 7열 그리드 + 양옆 레일)만
// 흉내 낸다. 실제 콘텐츠가 마운트되면 교체된다.
export function CalendarSkeleton({
  variant = "poster"
}: {
  variant?: "poster" | "studio";
}) {
  const cells = Array.from({ length: 42 });
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return (
    <div className="cal-skel-stage" aria-hidden="true">
      <div className={`cal-skel-card cal-skel-${variant}`}>
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
      <p className="cal-skel-note">불러오는 중…</p>
    </div>
  );
}
