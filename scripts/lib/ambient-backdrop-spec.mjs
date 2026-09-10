/** Stage-one backdrop candidates only. Deliberately outside ART_SLOTS until the
 * full-frame loader and complete seasonal promotion contract are implemented. */
export const BACKDROP_PILOT = {
  id: "backdrop-meadow", category: "backdrop", nameKo: "초원", season: "spring",
  geometry: { kind: "backdrop", source: [1536, 1024], target: [768, 512], grid: [384, 256], block: 4, trim: false },
  horizon: 0.26, palette: [6, 10], alpha: "binary", previewOnly: true,
  styleEnv: ["meadow", "forest"],
  layers: [
    { id: "far", nameKo: "먼 풍경", brief: "밝고 저채도인 먼 나무 실루엣. 공통 지평선 바로 위의 낮은 띠. 하늘과 지면은 투명." },
    { id: "ground", nameKo: "지면", brief: "지평선 아래부터 하단까지 빈틈 없는 열린 잔디 활동면. 중앙은 단순하게, 하늘은 투명. 서 있는 나무·돌·꽃 군집 없음." },
    { id: "frame", nameKo: "가까운 풀숲", brief: "하단 모서리와 바깥 가장자리에만 성긴 낮은 풀. 중앙과 상단은 투명. 큰 덤불·서 있는 객체 없음." },
  ],
};
