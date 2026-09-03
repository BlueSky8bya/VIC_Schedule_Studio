// 가을(입추~입동) — "물 위에 뜬 낙엽". 채도 낮춘 갈색·와인·마른 잎 여덟 장이 물결 위를 아주 천천히
// 떠다니며(translate, alternate) 살짝 돌고(rotate), 위쪽엔 은빛 서리 안개 띠(金)가 옅게 깔린다.
// 붉·주황·노랑 낙엽은 쓰지 않는다(火·조토 증폭 — CLAUDE.md Owner-fit palette rule). 잎 밑의 그림자는
// filter가 아니라 SVG 안의 어두운 사본(오프셋)으로 — filter·blur는 프레임 비용(frame-jank 메모리).
// 좌표·크기·시간은 CSS 변수로 잎마다 다르게(app/ambient.css `.gs-leaf`).

const LEAF = "M0,-18 C10,-14 14,-4 12,6 C10,14 4,18 0,18 C-4,18 -10,14 -12,6 C-14,-4 -10,-14 0,-18 Z";

type Leaf = { x: string; y: string; s: number; a: number; t: number; r: number; d: number; dx: number; dy: number; c: string };
// 1차 실측(2026-09-04): 28~44px·.62는 반투명 칸(76%)과 눈 편한 필터 뒤에서 거의 안 보였다 → 44~78px·.8,
// 열두 장, 바탕이 그대로 보이는 띠(왼쪽 rail 아래·화면 아래 띠·오른쪽 여백)에 더 많이.
const LEAVES: readonly Leaf[] = [
  { x: "5%", y: "16%", s: 58, a: -28, t: 58, r: 31, d: -12, dx: 140, dy: 26, c: "#a8744f" },
  { x: "11%", y: "62%", s: 70, a: 40, t: 66, r: 27, d: -30, dx: -120, dy: -18, c: "#8f5a48" },
  { x: "3%", y: "86%", s: 52, a: 12, t: 52, r: 35, d: -5, dx: 110, dy: 34, c: "#b08a55" },
  { x: "30%", y: "90%", s: 64, a: -62, t: 74, r: 29, d: -41, dx: -150, dy: 22, c: "#7d4b4f" },
  { x: "52%", y: "93%", s: 48, a: 75, t: 61, r: 33, d: -18, dx: 96, dy: -30, c: "#9c6a4a" },
  { x: "74%", y: "88%", s: 76, a: -10, t: 69, r: 25, d: -48, dx: -130, dy: -14, c: "#8a7a5a" },
  { x: "93%", y: "70%", s: 56, a: 95, t: 56, r: 30, d: -22, dx: 88, dy: 20, c: "#a06a52" },
  { x: "95%", y: "22%", s: 46, a: -45, t: 63, r: 28, d: -36, dx: 124, dy: -26, c: "#8b5f4a" },
  { x: "42%", y: "30%", s: 44, a: 18, t: 71, r: 34, d: -9, dx: -104, dy: 30, c: "#a06a52" },
  { x: "66%", y: "50%", s: 50, a: -80, t: 64, r: 26, d: -27, dx: 118, dy: -22, c: "#8f5a48" },
  { x: "20%", y: "38%", s: 42, a: 56, t: 59, r: 32, d: -15, dx: 92, dy: 24, c: "#b08a55" },
  { x: "84%", y: "8%", s: 48, a: -35, t: 67, r: 29, d: -44, dx: -110, dy: 18, c: "#7d4b4f" }
];

export function SeasonAutumn() {
  return (
    <div className="gs-season gs-season-autumn" data-season="autumn" aria-hidden="true">
      <div className="gs-mist" />
      {LEAVES.map((l, i) => (
        <span
          className="gs-leaf"
          key={i}
          style={
            {
              "--x": l.x,
              "--y": l.y,
              "--s": `${l.s}px`,
              "--a": `${l.a}deg`,
              "--t": `${l.t}s`,
              "--r": `${l.r}s`,
              "--d": `${l.d}s`,
              "--dx": `${l.dx}px`,
              "--dy": `${l.dy}px`
            } as React.CSSProperties
          }
        >
          <svg viewBox="-20 -22 40 44" focusable="false">
            {/* 물에 비친 그림자(오프셋 사본) → 잎 → 잎맥 */}
            <path d={LEAF} fill="#2b2320" opacity="0.16" transform="translate(2.5 3.5)" />
            <path d={LEAF} fill={l.c} />
            <path d="M0,-15 L0,15 M0,-4 L5,-9 M0,2 L-5,-3 M0,7 L4,3" fill="none" stroke="#fff5e6" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}
