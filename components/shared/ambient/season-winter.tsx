// 겨울(입동~입춘) — "물가에 내리는 눈". 작은 눈송이 스물여섯이 느리게 내리고(translateY) 좌우로
// 살짝 흔들린다(안쪽 요소 translateX — 한 요소에 transform 애니 둘은 못 겹쳐 두 겹). 위 모서리엔 은빛
// 서리 광택(金), 화면엔 아주 옅은 찬 물빛 필름(水). 눈은 水의 결정이자 흰 金색 — 소유자에게 필요한 둘.
// 어둡게 만들지 않는다. 눈송이마다 x·크기·주기·지연·투명도를 CSS 변수로(app/ambient.css `.gs-flake`).

type Flake = { x: number; s: number; t: number; d: number; o: number; sw: number };
// 결정적(고정) 배치 — 매 렌더 같은 눈(SSR·하이드레이션 일치, 검증 재현성).
// 1차 실측(2026-09-04): 3~7px 흰 점은 아이보리 바탕에서 안 보였다 → 5~11px, 얼음빛 테두리 링(app/ambient.css),
// 서른네 송이 + 화면 아래 '소복한 눈' 둔덕(.gs-snowbank).
const FLAKES: readonly Flake[] = Array.from({ length: 34 }, (_, i) => {
  const g = (i * 0.61803398875) % 1; // 황금비 분산 — 겹침 없이 고르게
  return {
    x: Math.round(g * 100),
    s: 5 + ((i * 5) % 7), // 5~11px (⚠ (i*7)%7은 항상 0 — 1차 실측에서 전부 5px였다)
    t: 22 + ((i * 11) % 17), // 22~38초
    d: -((i * 5) % 23), // 음수 지연 = 처음부터 하늘에 흩어져 있게
    o: 0.72 + ((i * 3) % 5) * 0.07, // .72~1
    sw: 10 + ((i * 13) % 14) // 좌우 흔들림 폭 10~23px
  };
});

export function SeasonWinter() {
  return (
    <div className="gs-season gs-season-winter" data-season="winter" aria-hidden="true">
      <div className="gs-frost" />
      {/* 소복한 눈 둔덕 — 그라데이션 띠는 '밝은 안개'로만 읽혔다(1차 실측). 완만한 언덕 윤곽 + 얼음빛 헤어라인(金)
          이 있어야 눈으로 읽힌다. 뒤 둔덕(옅은 청)이 깊이, 앞 둔덕(흰)이 눈. 폭은 뷰포트에 늘려 맞춘다. */}
      <svg className="gs-snowbank" viewBox="0 0 1600 160" preserveAspectRatio="none" focusable="false">
        <path
          d="M0,92 C180,60 330,110 520,84 C720,58 880,118 1080,80 C1280,44 1440,104 1600,72 L1600,160 L0,160 Z"
          fill="rgb(206 222 240 / 55%)"
        />
        <path
          d="M0,112 C220,78 360,128 560,100 C760,72 920,134 1120,98 C1320,64 1470,124 1600,96 L1600,160 L0,160 Z"
          fill="rgb(255 255 255 / 94%)"
          stroke="rgb(168 192 222 / 70%)"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {FLAKES.map((f, i) => (
        <i
          className="gs-flake"
          key={i}
          style={
            {
              "--x": `${f.x}%`,
              "--s": `${f.s}px`,
              "--t": `${f.t}s`,
              "--d": `${f.d}s`,
              "--o": f.o,
              "--sw": `${f.sw}px`
            } as React.CSSProperties
          }
        >
          <b />
        </i>
      ))}
    </div>
  );
}
