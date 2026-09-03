// 물결 레이어(2026-09-03, ADR-0016 금생수) — 편집실·시청자 화면 공용. "위에서 내려다본 모래사장 위의
// 얕은 물결": body의 아이보리(모래) 위에 얇은 물 필름 + 잔물결 그림자 띠 셋 + 윤슬(햇살이 물에 굴절돼
// 생기는 빛 그물) 선 셋 + 큰 스웰(물·햇살 얼룩)이 서로 다른 속도·방향으로 흐른다. 자기 배경은 반투명
// 필름뿐(불투명 없음)이라 모래가 그대로 비친다. 보이는 조건은 CSS가 판단(app/metal-water.css `.gs-tide`)
// — 차분 ON · 생동감 있는 동작 ON · 여력 있는 기기(data-gfx≠lite) · 웹(≥641px). 전부 transform/opacity.
//
// 사인파를 3차 베지에로 근사해 폭 TIDE_W에 담는다. SVG 폭이 화면의 200%이고 translateX(-50%)로 반복하므로
// 전체 폭의 주기 수는 짝수여야 이음새가 없다.
const TIDE_W = 2400;
const TIDE_H = 200;

/** 한 줄 사인파(왼→오른). closed면 아래(V TIDE_H)까지 닫는다. */
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

/** 물결 띠 — 위 사인파와 그보다 thick 아래의 사인파 사이(잔물결 그림자). 위에서 내려다본 물의 결. */
function tideBand(amp: number, mid: number, periods: number, thick: number): string {
  const half = TIDE_W / (periods * 2);
  let d = `M0 ${mid - amp}`;
  let x = 0;
  for (let i = 0; i < periods * 2; i++) {
    const from = i % 2 === 0 ? mid - amp : mid + amp;
    const to = i % 2 === 0 ? mid + amp : mid - amp;
    d += ` C${(x + half * 0.3642).toFixed(1)} ${from} ${(x + half * 0.6358).toFixed(1)} ${to} ${(x + half).toFixed(1)} ${to}`;
    x += half;
  }
  // 아래 결(오른→왼), 위 결과 반대 위상으로 두께가 숨쉰다.
  const lo = mid + thick;
  d += ` L${TIDE_W} ${lo + amp}`;
  for (let i = 0; i < periods * 2; i++) {
    const from = i % 2 === 0 ? lo + amp : lo - amp;
    const to = i % 2 === 0 ? lo - amp : lo + amp;
    d += ` C${(x - half * 0.3642).toFixed(1)} ${from} ${(x - half * 0.6358).toFixed(1)} ${to} ${(x - half).toFixed(1)} ${to}`;
    x -= half;
  }
  return `${d} Z`;
}

const BAND_1 = tideBand(14, 30, 4, 34);
const BAND_2 = tideBand(10, 96, 6, 26);
const BAND_3 = tideBand(8, 160, 8, 22);
const LINE_1 = tidePath(12, 56, 4, false);
const LINE_2 = tidePath(9, 118, 6, false);
const LINE_3 = tidePath(7, 176, 8, false);

const VB = `0 0 ${TIDE_W} ${TIDE_H}`;

export function WaterTide() {
  return (
    <div className="gs-tide" aria-hidden="true">
      <div className="gs-tide-swell gs-tide-swell-a" />
      <div className="gs-tide-swell gs-tide-swell-b" />
      <div className="gs-tide-swell gs-tide-swell-c" />
      {/* 물 — 화면 전체. 띠(그림자) 셋 + 윤슬 선 셋(글로우 밑받침 위 날카로운 선) + 빛살 둘. */}
      <div className="gs-tide-sea">
        <svg className="gs-tide-wave gs-tide-band-1" preserveAspectRatio="none" viewBox={VB}>
          <path d={BAND_1} />
        </svg>
        <svg className="gs-tide-wave gs-tide-band-2" preserveAspectRatio="none" viewBox={VB}>
          <path d={BAND_2} />
        </svg>
        <svg className="gs-tide-wave gs-tide-band-3" preserveAspectRatio="none" viewBox={VB}>
          <path d={BAND_3} />
        </svg>
        <svg className="gs-tide-wave gs-tide-glow gs-tide-glow-1" preserveAspectRatio="none" viewBox={VB}>
          <path d={LINE_1} vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="gs-tide-wave gs-tide-line gs-tide-line-1" preserveAspectRatio="none" viewBox={VB}>
          <path d={LINE_1} vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="gs-tide-wave gs-tide-glow gs-tide-glow-2" preserveAspectRatio="none" viewBox={VB}>
          <path d={LINE_2} vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="gs-tide-wave gs-tide-line gs-tide-line-2" preserveAspectRatio="none" viewBox={VB}>
          <path d={LINE_2} vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="gs-tide-wave gs-tide-glow gs-tide-glow-3" preserveAspectRatio="none" viewBox={VB}>
          <path d={LINE_3} vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="gs-tide-wave gs-tide-line gs-tide-line-3" preserveAspectRatio="none" viewBox={VB}>
          <path d={LINE_3} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="gs-tide-ray gs-tide-ray-a" />
        <div className="gs-tide-ray gs-tide-ray-b" />
      </div>
    </div>
  );
}
