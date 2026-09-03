// 물결 레이어(2026-09-03, ADR-0016 금생수) — 편집실·시청자 화면 공용. "위에서 내려다본 모래사장 위의
// 얕은 물"을 애플 결로: 기하 무늬 없이, 얇은 물 필름 위에 **caustic(햇빛이 물결에 굴절돼 바닥에 만드는
// 가늘고 밝은 빛 그물)** 두 겹이 반대 방향으로 흐르며 살짝 기울고(skew) 밝기가 숨쉰다(opacity). 노이즈
// 필드의 한 높이 등고선만 가늘게 뽑으면 닫힌 셀 모양의 선 그물이 된다(수영장 바닥 무늬와 같은 원리).
// 필터(feTurbulence 등)는 내용이 불변인 레이어라 **첫 래스터 한 번**, 이후엔 transform/opacity만 —
// 합성기만 일한다. 자기 배경은 반투명 필름뿐이라 모래(아이보리)가 그대로 비친다.
// 보이는 조건은 CSS가 판단(app/metal-water.css `.gs-tide`) — 생동감 있는 동작 ON · 여력 있는 기기
// (data-gfx≠lite) · 웹(≥641px). 계절 레이어(ADR-0017)에선 **여름의 전유물**: 다른 계절엔 `offSeason`으로
// `data-off-season`이 붙고, 계절 배경 스위치가 ON이면 app/ambient.css가 숨긴다(OFF면 사철 물결).
export function WaterTide({ offSeason = false }: { offSeason?: boolean } = {}) {
  return (
    <div className="gs-tide" aria-hidden="true" data-off-season={offSeason ? "" : undefined}>
      <svg className="gs-tide-defs" width="0" height="0" focusable="false">
        <defs>
          {/* caustic — 프랙탈 노이즈 → 밝기를 알파로 → 좁은 띠(테이블)만 남겨 등고선 = 셀 그물 → 살짝 번짐 →
              따뜻한 흰빛. a·b는 주파수·씨앗이 달라 겹치면 셀이 서로 어긋나 흔들려 보인다. */}
          <filter id="gs-caustic-a" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.0095 0.0115" numOctaves="3" seed="11" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="luminanceToAlpha" result="lum" />
            <feComponentTransfer in="lum" result="ridge">
              <feFuncA type="table" tableValues="0 0 0 0 0 0 0 0.35 1 0.35 0 0 0 0 0 0 0" />
            </feComponentTransfer>
            <feGaussianBlur in="ridge" stdDeviation="1.3" result="soft" />
            <feFlood floodColor="#fffaf0" result="col" />
            <feComposite in="col" in2="soft" operator="in" />
          </filter>
          <filter id="gs-caustic-b" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.013 0.0105" numOctaves="3" seed="29" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="luminanceToAlpha" result="lum" />
            <feComponentTransfer in="lum" result="ridge">
              <feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0.4 1 0.4 0 0 0 0 0 0" />
            </feComponentTransfer>
            <feGaussianBlur in="ridge" stdDeviation="1.5" result="soft" />
            <feFlood floodColor="#fff6e2" result="col" />
            <feComposite in="col" in2="soft" operator="in" />
          </filter>
        </defs>
      </svg>
      {/* 큰 너울 — 아주 옅은 물빛 덩어리 둘(깊이감), 햇살 얼룩 하나. 어두운 얼룩은 두지 않는다(곰팡이처럼 읽혔다). */}
      <div className="gs-tide-swell gs-tide-swell-a" />
      <div className="gs-tide-swell gs-tide-swell-b" />
      <div className="gs-tide-light" />
      {/* caustic 두 겹 — 반대 방향으로 흐르며 살짝 기울고 밝기가 숨쉰다. */}
      <svg className="gs-tide-caustic gs-tide-caustic-a" preserveAspectRatio="none" focusable="false">
        <rect width="100%" height="100%" filter="url(#gs-caustic-a)" />
      </svg>
      <svg className="gs-tide-caustic gs-tide-caustic-b" preserveAspectRatio="none" focusable="false">
        <rect width="100%" height="100%" filter="url(#gs-caustic-b)" />
      </svg>
    </div>
  );
}
