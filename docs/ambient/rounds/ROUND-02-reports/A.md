# ROUND-02 · Agent A — Art Mood Director 보고(원문, 2026-09-05)

빌드 `0d3fdfb` · 캡처 루트 `.scratch-pw/qa/r02/before/` · 16 시나리오 정적 + 시간대 시트 16장 + s03·s04 긴 시트 + 흑백 시트 육안 검토, 픽셀 측정(자작 PNG 디코더로 Lab/HSV 영역 평균 · 행/열 자기상관) 및 확대 크롭 19장(세션 스크래치 `crops/c01~c19`).

**P0 없음.** 라운드 1 회귀 검사 — 다람쥐: s03 긴 시트 t=23~26s(run→sniff→grab→퇴장) 하단 v>.8, 지평선 접근 0 ✓ · 산 다섯 층: x880~980 열 L s09 97.7/93/77/82(② 어두움 = 겨울 예외) · s10 81/76/68/61 · s11 86/80/70/65 유지 ✓ · 잠긴 돌: 민물 3·계곡 물색 사본·수면선 유지 ✓. T-2(과장): 어느 띠·바이옴에도 없음(노을 하늘 S ≤ .09, 주황 hue 0) — 문제는 반대쪽(부재)이다.

---

```
[Issue] 여섯 시간대가 "같은 그림 위 베일 한 겹"이다 — 새벽≡노을, 밤은 약간 흐린 낮, 물·하늘은 시간을 모른다(정서 부재 → C의 T-1로 넘김; 여기서는 여섯 채널 수정이 과장으로 넘어가지 않을 T-2 상한과 정서 판정 기준을 준다)
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 전 16 시나리오 / 사철 / 여섯 띠 전부 / 맑음·안개·흐림 / 42 / showcase
[Category] T-2(상한 규정) + T-1(정서 부재, C 담당) · 부차 F-3(안개 속 물)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] SEASON_TIME_WEATHER §0.1·§2.1. 측정(band-*.png, 하늘 y0~90 · 근경 지면 y700~820 평균):
 · 새벽 vs 노을: 16/16에서 하늘 ΔL 동일(−2.5~−3.5), a* 차 1.3 — 구분 불가. 노을 하늘은 회장미(a*≈+14)가 아니라 중립 회색(a* +0.7, b* +6).
 · 밤: 근경 지면 ΔL −2.8(s02)~−9.2(s09), 목표 −16; 하늘 −11~−16. s16 밤 지면 S .286 vs 점심 .35(×.82, 목표 ×.62) → "흐린 낮".
 · 아침=점심 해시 동일 16/16, 지면은 새벽·노을에 오히려 +0.5~+1.3 밝음(틴트가 하늘에만 실림).
 · 물은 시간·날씨를 모른다: s12 수면 여섯 띠 전부 같은 하늘색, s06 계곡 안개·저녁에서 물 S .326 vs 둔치 .134(2.4배) → 안개가 짙을수록 물만 혼자 튄다(F-3). s10·s02 "노을"이 "황사"로 읽힌다.
[Suggested Fix] `world/time.ts` LIGHT → `LightProfile`(하늘/안개색 · 지면 ΔL · 채도 배율 · 그림자 길이·방향·α · 원경 안개 배율 · 글린트) 여섯 채널; `bakeHorizon`이 하늘·안개색을 프로파일에서 읽고, 물색이 하늘색을 반영(반사 = 하늘 a*/b*의 60%); 그림자 길이·방향을 프로파일에서 읽음. 엔진 틴트 α ≤ .12.
[Acceptance Criteria] (정서) ① 새벽↔노을 하늘 ΔE(ab) ≥ 10, 새벽 b* ≤ 노을 b* − 6 ② 밤 근경 지면 ΔL −12~−16 · 하늘 ΔL −18~−26 · 채도 ×.55~.70 ③ 아침≠점심 해시 16/16 ④ 수면 색이 띠를 따른다: 밤 수면 b* ≤ 점심 −6, 노을 수면 a* ≥ 점심 +5 ⑤ 안개·저녁 계곡 물 S / 둔치 S ≤ 1.6
 (T-2 상한) ⑥ 노을 하늘 HSV S ≤ .30, a* +6~+14, b* −8~+2, hue 20~45° & S > .25 평균 없음 ⑦ 밤 실루엣 ΔL ≥ 12, 지면 형태 대비 ≥ 8L ⑧ 노을→저녁 지면 ΔL ≤ 6 ⑨ 전체 틴트 α ≤ .12 ⑩ 어느 띠에서도 바이옴 기준색(점심)과 hue 차 ≤ 20°
[Confidence] 높음 — 16 시나리오 × 6띠 픽셀 측정 + SYSTEM_MAP §2.1 코드 경로 일치
```

```
[Issue] 성글게 한 숲(38그루)이 "숲"이 아니라 "공원·과수원"으로 읽힌다 — 원경에 닫힌 수관 줄이 없고, 나무가 무리 대신 점으로 흩어지고, 같은 스프라이트가 사슬·기둥으로 겹치고, 바닥이 초원 잔디와 같다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 숲 / 봄·가을 / 아침·노을 / 맑음·바람 / 42 / showcase (s01·s02)
[Category] R-2(정체성) + R-1(리듬) · 부차 S-3(사슬·기둥)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] BIOME_GRAMMAR §2 "원경: 닫힌 수관 줄(무리 5~8, 각 3~5그루) · 중경 초점 3그루 · 바닥 낙엽+솔가리", 부록 B. 관찰:
 · 원경 띠(y60~230) 열 점유율 s01 47%(런 6) · s02 50%(런 19) — 절반이 빈 잔디. 흑백 s01은 "초원 + 나무 몇 그루"와 구분되지 않는다.
 · s02 중경 초점: 같은 크기·같은 스프라이트 참나무 4그루가 (880,520)→(700,740) 대각선에 등간격으로 겹쳐 "애벌레"(크롭 c19).
 · s01 좌측 x60~200 소나무 3그루가 같은 x(±10)에 ≈150px 간격 세로 스택(c18) — 토템.
 · 수관 아래 그늘·낙엽·솔가리가 없어 나무가 "얹혀" 있고, 빈터 밖은 균일 산포(벽지). 소나무 자체는 픽셀 어법에 맞다(F-2 아님).
[Suggested Fix] `scenes/land.ts` forest: 무작위 산포 → 무리 중심 포아송 + 무리 안 흩기. 원경 v0~.2에 무리 5~8 × 3~5그루, 무리 안 크기 편차 ≥1.25, 같은 스프라이트 3개 이상 공선 재추첨, 같은 x±12 세로 스택 3개 이상 재추첨; 중경 초점 3그루는 3각 배치(각 간격 ≥ 60°). 바닥 `bake`: 낙엽·솔가리 픽셀 격자 텍스처 + 무리 아래 계단진 그늘 얼룩. 나무 수 38~46 유지.
[Acceptance Criteria] after s01·s02: 원경 띠 열 점유율 ≥ 62% & 런 5~8 · 같은 스프라이트·같은 k 3개 이상 한 직선(±8px) 0 · 같은 x(±12) 세로 스택 3개 이상 0 · 무리 안 최대/최소 수관 반지름 비 ≥ 1.25 · 빈터 중심 반경 w×.18 나무 0 · 숲 지면 200×200 패치 L 표준편차 ≥ 초원 ×1.5 · 흑백 3초 판정 "숲"
[Confidence] 높음 — 두 시드 조합·12칸 반복 관찰 + 측정
```

```
[Issue] 가을 버섯 대체물이 매끈한 구 셰이딩의 오렌지 갓(hue 25°, S .40)이라 픽셀 땅 위에서 채도·화풍 둘 다 튄다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 초원·숲 / 가을 / 아침·노을 / 맑음·바람 / 42 / showcase (s02 s03 s04)
[Category] F-2(화풍·팔레트) + F-3(튐)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] CLAUDE.md 픽셀아트 어법 · 오행 팔레트(주황 금지) · IMMERSION F-2. 갓이 연속 그라데이션 구체 + 흰 하이라이트, 대 흰색. s04 갓 최고 채도 픽셀 C 25 · hue 25° · S .40 vs 주변 지면 C 14.6 · S .22.
[Suggested Fix] `art/props.ts` mushroom 폴백 → 2~3px 셀 계단 셰이딩, 갓 색 와인·회갈(hue ≤ 15° 또는 ≥ 340°, S ≤ .30), 흰 대는 크림 L −8; 또는 mushroom 슬롯 아트 납품.
[Acceptance Criteria] 갓 최대 chroma ≤ 주변 지면 C + 6 · hue 20~45° & S > .3 픽셀 0 · 갓 가장자리 색 단계 ≤ 3 · 12px 확대 크롭에서 격자 계단이 보임
[Confidence] 높음
```

```
[Issue] 민물 먼 기슭이 1400px 전폭 직선 하드 에지(두 계단, −10L)로 잘려 뒤 땅이 "종이 띠 세 장"처럼 겹친다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 민물 / 봄 / 새벽(+6띠) / 안개(+5날씨) / 42 / showcase (s12 y180~187 전폭)
[Category] F-1(전폭 직선)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] VISUAL_DIRECTION §3, ADR-0017 ⑰. s12 x300~700 행 L: y179 82.3 → y181 79.1 → y187 72.5 — 폭 100% 곧은 계단.
[Suggested Fix] `scenes/summer.ts` 기슭 바탕 굽기: 물가 타원과 같은 저주파 굽이(진폭 8~14px, 파장 w×.3~.5) + 픽셀 계단 2~3px, 경계 위 12px 안개색.
[Acceptance Criteria] y150~250에서 |ΔL| ≥ 5가 폭 60% 이상 연속인 행 0 · 기슭 경계선 y 표준편차 ≥ 4px
[Confidence] 높음
```

```
[Issue] 산 ③ 띠에 10px 정간격 세로 빗살, 능선 림이 균일 밝기의 매끈 벡터 선, ① 봉우리 상단 360px 평탄
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 산 / 겨울·가을·여름 / 아침·노을·새벽 / 눈·안개·흐림 / 42 / showcase (s09 s10 s11)
[Category] S-3 + D-2(능선 미적 면) · 부차 F-2(AA 선)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] MOUNTAIN §2.2·§2.3 · IMMERSION S-3. s10 y435~470 열 L 국소 극대 x 936·946·956·966·976 — 정확히 10px 피치(바코드). 림 변주 2%(규칙 30%) + 2px AA. ① 상단 x730~1090 |기울기|<.02.
[Suggested Fix] `land.ts` mountain: 빗살 출처(원경 침엽수 줄기 stroke 또는 애추 해치)의 간격·높이·α를 rng ±40%로 흩거나 무리 단위로; 림 조각마다 L ±30% + 픽셀 계단; `peak()` 봉우리/안부 강제(평탄 ≤ 200px).
[Acceptance Criteria] 열 L 국소 극대 간격 같은 값 4회 이상 연속 0 · 림 max L 최대−최소 ≥ 6L(300px 창) · 림 경계 색 단계 ≤ 2 · ① 상단 평탄 ≤ 200px · 다섯 층 단차 유지
[Confidence] 높음
```

```
[Issue] 계곡 지면 전체가 6px 주기 가로 스캔라인(줄 노트)이다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 계곡 / 여름·가을 / 점심·저녁 / 맑음·안개 / 42 / showcase (s05 s06)
[Category] S-3 + F-1
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] s05 행 L y560~619: 6행마다 −3L, 자기상관 lag6 = .96 — 지면 전면 인터레이스.
[Suggested Fix] `land.ts` valley `bake` 지면 해치 → 픽셀 격자 노이즈(3~4px 셀, L ±3) 또는 비주기 등고 띠(간격 rng ±40%, 벽 안에서만).
[Acceptance Criteria] 200×60 지면 패치 3곳에서 행 L 자기상관 lag2~12 최대 ≤ .5 · 전폭 60% 이상 연속 동일 L 행 0
[Confidence] 높음
```

```
[Issue] 민물 갈대(부들) 대체물이 매끈 AA 선 ~20개의 근평행 빗살 + 매끈 타원 이삭이고 세 무리가 같은 형이다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 민물 / 봄 / 새벽 / 안개 / 42 / showcase (s12)
[Category] F-2 + S-3
[Severity: P0 / P1 / P2 / P3] P2
[Suggested Fix] `art/props.ts` reed 폴백 → 2px 셀 계단 stroke, 기울기 ±.35rad·높이 편차 ≥ 1.3×·이삭 높이 흩기, 무리별 시드; 또는 reed 슬롯 아트.
[Acceptance Criteria] 줄기 각도 표준편차 ≥ .12rad · 줄기 경계 색 단계 ≤ 2 · 세 무리 실루엣 해시 상이 · 이삭 y 표준편차 ≥ 10px
[Confidence] 중간
```

```
[Issue] 소프트 얼룩(AMB-F2-01)이 닫히지 않았고 범위가 더 넓다 — 갯벌은 "초점 나간 사진", 초원 흙 얼룩은 원경에서 "땅 위 먹구름", 민물 물풀 섬은 어두운 원반
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 갯벌 s07 s08 · 초원 s03 s04 · 민물 s12 / 42 / showcase
[Category] F-2 + F-1
[Severity: P0 / P1 / P2 / P3] P2
[Suggested Fix] `coast.ts`(해조 무리·뻘 얼룩) · `autumn.ts`(흙 얼룩) · `summer.ts`(물풀 섬)의 softBlob → 저해상 계단 얼룩 패스(4~6px 셀 오프스크린 → 확대, smoothing off); 원경(v<.2) 얼룩 크기 ×.6·α ×.6; 물풀 섬은 기슭 픽셀 링 + 잠긴 규칙.
[Acceptance Criteria] 얼룩 경계 픽셀 중 인접 ΔL ≥ 3 비율 ≥ 50% · 60px 이상 연속 그라데이션 얼룩 0 · 지평선 아래 60px 안 얼룩 L ≥ 주변 −6 · 갯벌 흑백 "뻘"로 읽힘 유지
[Confidence] 높음
```

---

**요약**
- `P0 0 · P1 2 · P2 6 · P3 0`
- 가장 넓게 걸린 문제: **시간대·날씨가 베일 한 겹**(16/16). 입구 ①을 열 때 1번 블록의 T-2 상한을 수용 기준에 함께. 숲 인상(2번)은 수는 맞고 **배치·바닥**이 아직 공원이다.
- 이번엔 안 고쳐도 되는 것: 깊은 바다 빛줄기 간격·너울 띠, 그루터기 아트 인상 — P3. 문제 없던 것: 소나무 픽셀 어법, 언덕 바위 채도, 억새 이삭 흰색, 잠긴 돌·다람쥐·산 다섯 층 회귀 없음.
