// 물결 레이어(2026-09-03, ADR-0016 금생수) — 편집실·시청자 화면 공용. "모래(아이보리) 위로 얕은 물결이
// 일렁이는" 느낌 — 자기 배경은 없다(완전 투명 컨테이너), body의 아이보리(--paper) 위에 옅은 빛/물빛 결만
// 얹는다. 보이는 조건은 CSS가 판단(app/metal-water.css `.gs-tide`) — 차분 ON · 생동감 있는 동작 ON ·
// 여력 있는 기기(data-gfx≠lite) · 웹(≥641px)에서만. 전부 transform/opacity(합성기) — 무한 애니 규칙.
// 사인파를 3차 베지에로 근사해 폭 TIDE_W에 담는다. SVG 폭이 화면의 200%이고 translateX(-50%)로
// 반복하므로 전체 폭의 주기 수는 짝수여야 이음새가 없다.
const TIDE_W = 2400;
const TIDE_H = 200;

function tidePath(amp: number, mid: number, periods: number, closed: boolean): string {
  const half = TIDE_W / (periods * 2);
  let d = `M0 ${mid - amp}`;
  let x = 0;
  for (let i = 0; i < periods * 2; i++) {
    const from = i % 2 === 0 ? mid - amp : mid + amp;
    const to = i % 2 === 0 ? mid + amp : mid - amp;
    d += ` C${(x + half * 0.3642).toFixed(1)} ${from} ${(x + half * 0.6358).toFixed(1)} ${to} ${(x + half).toFixed(1)} ${to}`;
    x += half;
  }
  return closed ? `${d} V${TIDE_H} H0 Z` : d;
}

const TIDE_FILL_1 = tidePath(22, 78, 4, true);
const TIDE_FILL_2 = tidePath(16, 112, 6, true);
const TIDE_FILL_3 = tidePath(10, 56, 8, true); // 먼 물·하늘물(짧은 파장, 낮은 진폭)
const TIDE_LINE = tidePath(22, 78, 4, false);

export function WaterTide() {
  return (
    <div className="gs-tide" aria-hidden="true">
      <div className="gs-tide-swell gs-tide-swell-a" />
      <div className="gs-tide-swell gs-tide-swell-b" />
      <div className="gs-tide-swell gs-tide-swell-c" />
      {/* 북쪽 하늘물 — 유리 상단바 뒤로 비치는 뒤집힌 얕은 물결(반대 방향, 아주 옅게). */}
      <div className="gs-tide-sky">
        <svg className="gs-tide-wave gs-tide-sky-fill" preserveAspectRatio="none" viewBox={`0 0 ${TIDE_W} ${TIDE_H}`}>
          <path d={TIDE_FILL_3} />
        </svg>
      </div>
      {/* 바다 — 먼 물(3) · 중간(2) · 가까운(1) 세 겹 + 은선(글로우 밑받침 위에 날카로운 선) + 빛살 둘. */}
      <div className="gs-tide-sea">
        <svg className="gs-tide-wave gs-tide-fill-3" preserveAspectRatio="none" viewBox={`0 0 ${TIDE_W} ${TIDE_H}`}>
          <path d={TIDE_FILL_3} />
        </svg>
        <svg className="gs-tide-wave gs-tide-fill-2" preserveAspectRatio="none" viewBox={`0 0 ${TIDE_W} ${TIDE_H}`}>
          <path d={TIDE_FILL_2} />
        </svg>
        <svg className="gs-tide-wave gs-tide-fill-1" preserveAspectRatio="none" viewBox={`0 0 ${TIDE_W} ${TIDE_H}`}>
          <path d={TIDE_FILL_1} />
        </svg>
        <svg className="gs-tide-wave gs-tide-line-glow" preserveAspectRatio="none" viewBox={`0 0 ${TIDE_W} ${TIDE_H}`}>
          <path d={TIDE_LINE} vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="gs-tide-wave gs-tide-line" preserveAspectRatio="none" viewBox={`0 0 ${TIDE_W} ${TIDE_H}`}>
          <path d={TIDE_LINE} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="gs-tide-ray gs-tide-ray-a" />
        <div className="gs-tide-ray gs-tide-ray-b" />
      </div>
    </div>
  );
}
