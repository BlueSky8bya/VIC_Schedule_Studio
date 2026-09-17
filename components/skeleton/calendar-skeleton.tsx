import { getCurrentKstYearMonth } from "@/lib/calendar/month";
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
  label = "일정표",
  month
}: {
  variant?: "poster" | "studio";
  label?: string;
  /** 콜드 진입 대상 달(월 라우트에서 전달). 없으면 KST 현재 달 — 본문과 같은 글자가 그대로 이어진다. */
  month?: { year: number; month: number };
}) {
  const cells = Array.from({ length: 42 });
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  // 2026-09-17: 본문 제목이 서비스 이름 → 보고 있는 달로 바뀌었다. 스켈레톤도 같은 글자를 미리
  // 세워 두면 본문이 도착할 때 제목이 바뀌지 않는다(자리·글자 모두 그대로 이어짐).
  const shown = month ?? getCurrentKstYearMonth();
  const monthTitle = `${shown.year}년 ${String(shown.month).padStart(2, "0")}월`;
  return (
    <div className={`cal-skel-stage cal-skel-stage-${variant}`} aria-busy="true">
      {/* 모바일 전용(≤640px): 달력 뼈대. 웹에선 CSS로 숨긴다. */}
      <div className={`cal-skel-card cal-skel-${variant}`} aria-hidden="true">
        {variant === "poster" && <aside className="cal-skel-rail cal-skel-rail-left" />}

        <div className="cal-skel-main">
          <div className="cal-skel-heading">
            <span className="cal-skel-spark">✨️</span>
            <strong className="cal-skel-title">{monthTitle}</strong>
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
          이미 달 제목이 있어 label을 숨기고 "불러오는 중…"만 둔다. */}
      <p className="cal-skel-note" role="status">
        <span className="cal-skel-note-label">{label} </span>불러오는 중…
      </p>
    </div>
  );
}
