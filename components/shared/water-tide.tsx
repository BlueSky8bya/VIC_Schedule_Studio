// 물결 레이어(2026-09-03, ADR-0016 금생수) — 편집실·시청자 화면 공용. "위에서 내려다본 모래사장 위의
// 얕은 물"을 애플 결로: 기하 무늬(사인파 줄) 없이, 크고 흐릿한 물그림자 덩어리 + 따뜻한 빛 얼룩 +
// 유기적인 caustic(물에 굴절된 햇빛이 바닥에 만드는 빛 그물) 두 겹이 아주 느리게 서로 다른 방향으로
// 떠다닌다. caustic은 SVG 노이즈(feTurbulence) 필터로 **한 번만 래스터**되고(내용 불변), 이후엔
// transform으로만 흘러 합성기만 일한다. 자기 배경은 반투명 필름뿐이라 모래(아이보리)가 그대로 비친다.
// 보이는 조건은 CSS가 판단(app/metal-water.css `.gs-tide`) — 차분 ON · 생동감 있는 동작 ON · 여력 있는
// 기기(data-gfx≠lite) · 웹(≥641px).
export function WaterTide() {
  return (
    <div className="gs-tide" aria-hidden="true">
      <svg className="gs-tide-defs" width="0" height="0" focusable="false">
        <defs>
          {/* caustic — 프랙탈 노이즈의 중간 밝기 등고선만 남겨(feFuncA 테이블) 빛 그물을 만들고, 살짝
              번진 뒤 따뜻한 흰빛으로 칠한다. a·b는 씨앗·주파수가 달라 겹치면 간섭이 생긴다. */}
          <filter id="gs-caustic-a" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0075 0.011" numOctaves="2" seed="7" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="luminanceToAlpha" result="lum" />
            <feComponentTransfer in="lum" result="ridge">
              <feFuncA type="table" tableValues="0 0 0 0.2 0.85 1 0.85 0.2 0 0 0" />
            </feComponentTransfer>
            <feGaussianBlur in="ridge" stdDeviation="1.6" result="soft" />
            <feFlood floodColor="#fff7e4" result="col" />
            <feComposite in="col" in2="soft" operator="in" />
          </filter>
          <filter id="gs-caustic-b" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0105 0.0085" numOctaves="2" seed="23" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="luminanceToAlpha" result="lum" />
            <feComponentTransfer in="lum" result="ridge">
              <feFuncA type="table" tableValues="0 0 0 0.15 0.8 1 0.8 0.15 0 0 0" />
            </feComponentTransfer>
            <feGaussianBlur in="ridge" stdDeviation="2.2" result="soft" />
            <feFlood floodColor="#fffaf0" result="col" />
            <feComposite in="col" in2="soft" operator="in" />
          </filter>
        </defs>
      </svg>
      {/* 물그림자 — 크고 흐릿한 청록 덩어리 셋(깊은 곳). */}
      <div className="gs-tide-shade gs-tide-shade-1" />
      <div className="gs-tide-shade gs-tide-shade-2" />
      <div className="gs-tide-shade gs-tide-shade-3" />
      {/* 빛 얼룩 — 햇살이 물을 지나 모래에 닿는 따뜻한 밝은 덩어리 둘. */}
      <div className="gs-tide-light gs-tide-light-1" />
      <div className="gs-tide-light gs-tide-light-2" />
      {/* caustic 두 겹 — 반대 방향으로 아주 느리게, 한 겹은 살짝 커졌다 작아진다. */}
      <svg className="gs-tide-caustic gs-tide-caustic-a" preserveAspectRatio="none" focusable="false">
        <rect width="100%" height="100%" filter="url(#gs-caustic-a)" />
      </svg>
      <svg className="gs-tide-caustic gs-tide-caustic-b" preserveAspectRatio="none" focusable="false">
        <rect width="100%" height="100%" filter="url(#gs-caustic-b)" />
      </svg>
    </div>
  );
}
