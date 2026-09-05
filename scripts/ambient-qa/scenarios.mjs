// 대표 시나리오(docs/ambient/VISUAL_QA_PROTOCOL.md §4.2) — 캡처·시트·diff·셀프테스트가 같은 표를 읽는다.
// 바꾸면 프로토콜 문서와 tests/unit/ambient-qa-scenarios.test.ts(허용 날씨·바이옴 키 대조)도 같이 본다.

/** 계절 → fixture가 보는 달(components/shared/ambient/biome-fixture.tsx SEASON_MONTH와 같아야 한다). */
export const SEASON_MONTH = { spring: 4, summer: 8, autumn: 10, winter: 1 };

export const DEFAULT_SEED = 42; // 재현용
export const ALT_SEED = 7; // 다양성 확인(P0·P1 재현 시에만)

export const SCENARIOS = [
  { id: 1, biome: "forest", season: "spring", band: "morning", weather: "clear", why: "기본 상태·간격·수관", agents: "B·A" },
  { id: 2, biome: "forest", season: "autumn", band: "dusk", weather: "wind", why: "바람 삼단 반응·낙엽·노을 그림자", agents: "C" },
  { id: 3, biome: "meadow", season: "autumn", band: "morning", weather: "clear", why: "다람쥐 스폰·이동·레이어(A-1)", agents: "B·C" },
  { id: 4, biome: "meadow", season: "autumn", band: "dusk", weather: "clear", why: "다람쥐 + 원경 흐림에서의 표면 판정", agents: "C" },
  { id: 5, biome: "valley", season: "summer", band: "noon", weather: "clear", why: "잠긴 돌·여울·물길 형태", agents: "B" },
  { id: 6, biome: "valley", season: "autumn", band: "evening", weather: "fog", why: "안개 깊이·상류 소실·저녁 형태 유지", agents: "C" },
  { id: 7, biome: "tidal", season: "summer", band: "noon", weather: "clear", why: "물골 형태·배수망·퇴적", agents: "B" },
  { id: 8, biome: "tidal", season: "autumn", band: "evening", weather: "cloud", why: "흐림 반응·썰물·광택", agents: "C" },
  { id: 9, biome: "mountain", season: "winter", band: "morning", weather: "snow", why: "적설·만년설·층 분리", agents: "A·B" },
  { id: 10, biome: "mountain", season: "autumn", band: "dusk", weather: "fog", why: "산·능선·배경 분리(D-2)", agents: "A·B·C" },
  { id: 11, biome: "mountain", season: "summer", band: "dawn", weather: "cloud", why: "능선 너머 깊이 유지", agents: "B·C" },
  { id: 12, biome: "pond", season: "spring", band: "dawn", weather: "fog", why: "물 위 안개·잠긴 돌·반사", agents: "B·C" },
  { id: 13, biome: "rocky", season: "autumn", band: "dusk", weather: "wind", why: "물보라·파도 ×1.5·노을 림", agents: "C·A" },
  { id: 14, biome: "deep", season: "summer", band: "night", weather: "cloud", why: "밤 정보 하한·빛줄기 0·별 없음", agents: "C" },
  { id: 15, biome: "hill", season: "autumn", band: "noon", weather: "wind", why: "억새 진행파·띠 3겹·경사 배치", agents: "B·C" },
  { id: 16, biome: "meadow", season: "summer", band: "noon", weather: "clear", why: "시간대 인식(T-1) 기준 화면 — band 시트", agents: "C·A" }
];

/** 스모크 셋 — 성격이 다른 셋: 생물이 사는 초원(가을) · 정적 판 + 안개(산) · 물·발광 애니(깊은 바다). */
export const SMOKE_IDS = [3, 10, 14];

export const byId = (id) => SCENARIOS.find((s) => s.id === Number(id));
