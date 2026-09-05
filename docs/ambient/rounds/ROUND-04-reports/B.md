# Agent B — Spatial Ecology Inspector · 라운드 4 before 보고

> 원문 그대로(메인 세션 저장). ⚠ B도 3100 서버가 작업 트리(after WIP)로 바뀐 것을 감지 — before 수치는 전부 캡처 PNG, 라이브를 쓴 항목은 "라이브(WIP)"로 표기.

빌드 `2e783de` 캡처(`.scratch-pw/qa/r04/before`) 기준. 코드 근거는 `git show 2e783de:` 기준. 측정 스크립트·산출물: `.scratch-pw/r04b-measure.mjs`(청크 `r04b-p1~p8.mjs`), `r04b-hashcheck.mjs`, 결과 `.scratch-pw/qa/r04/b-probe/`(`measure-*.txt` · `shadow-*.png` 잔차 시각화 · `crop-*.png` · `s05-1920x1080*.png` · `spawn-probe-s03*.txt`).

**검사 조건 주의(메인 세션 필독)**: 라이브 fixture 서버(127.0.0.1:3100)는 **작업 트리(라운드 4 WIP)** 를 서빙한다 — 점심·맑음 해시는 캡처와 같지만(s16 noon `36822493abd6` 동일) **비점심 띠는 다르다**(s16 night live `c1b7031358fa` ≠ 캡처 `bc13d346d638` · s10 dusk fog ≠ · s02 dusk wind ≠ · s12 dawn fog = 동일). 따라서 아래 before 수치는 전부 **캡처 PNG에서** 잰 것이고, 라이브를 쓴 항목(민물 오리·밤 다람쥐)은 "라이브(WIP)"로 표기했다. after 캡처 전에 서버 빌드를 고정할 것.

---

```
[Issue] 숲 노을·새벽에 해가 둘이다 — 매 프레임 그리는 나무(drawTree)는 그림자가 동(노을)/서(새벽)로 길어지는데, 바탕에 구운 소품(그루터기·통나무·바위·관목: scatterProps)은 점심 그림자(대칭·짧음·+2,−2 고정) 그대로. 산·언덕·초원·해안은 그림자 채널 자체가 0(전부 굽힘).
[Biome / Season / TimeOfDay / Weather / Seed / Camera] forest(+ mountain·hill·meadow·valley 대조) / autumn(s02)·summer(s16)·autumn(s10·s15) / dawn·dusk·night (점심 대비) / wind·fog·clear / 42 / showcase
[Category] T-1(주) + S-4(부: 한 장면 안 광원 불일치)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] BIOME_GRAMMAR 숲 "나무 그림자 방향·길이가 시간을 말한다", 초원 "그림자 길이·방향(나무·소품·생물)", 공통 "그림자는 발밑". 새벽→노을 직접 비교(반대칭 벡터, 줄기 발 기준 x): 나무 6그루 어두워진 중심 +42/+31/−24*/+28/+34/+24 px(동), 밝아진 중심 −37/−19/−38/+52/−22/−41(서) — *한 그루는 이웃 나무 그림자 간섭. 같은 프레임의 소품 7개(log 480,478 · shrub 540,528 · rock 1205,615 · stump 1130,707 · stump 1150,384 · log 1190,358 · shrub 1035,695): 변화 무게 0/0/0/0/2.4/0/14(이웃 나무 그림자 −49px 위치) → 소품 그림자는 띠와 무관. noon→dusk 잔차 클러스터: s02 어두워진 덩이 8개 meanDx +21.8(7/8 동쪽)·소품 창 dark 0 ; s10 산 0 · s15 언덕 0 · s16 초원 0 · s07 갯벌 0. 언덕 능선 나무(316,297) dusk 변화 42.3이 x −0.3/y −9.9(몸통 어둡힘만, 이동 0) · 산 침엽수(810,665) 198.5가 x +3.5(이동 0). 밤: 소품 그림자 상대 농도 점심과 동일(잔차 0), 나무는 α .33. 크롭 `crop-s02-dusk-tree-vs-log.png`/`-dawn-`: 오크 그림자가 오른쪽 ~2배/왼쪽으로 옮기는 동안 통나무·관목·바위 그림자는 두 장 픽셀 동일. 코드: `art/props.ts@2e783de L992` `softBlob(g, x+2, y−2, …, 0.16, …)`(조명 미참조) · `land.ts` 언덕 나무 `shadow(g, tx + 6*tk, ty−2, 46*tk, .15)`(L~282) · 산 침엽수 띠 `shadow(g, t2.x + 6*t2.k, …)`(L~1225) — 항상 오른쪽 +6k 편향(새벽엔 숲 나무와 반대 방향) · `drawTree L83~85`만 `currentLight().shadow` 읽음. 접점 자체는 ✓(나무: 노을 중심 +0.36R·반폭 1.07R → 발이 타원 안, 소품: +2/−2).
[Suggested Fix] `art/props.ts` scatterProps·drawProp 발밑 그림자를 `propShadow(currentLight().shadow)`로(작업 트리에 이미 propShadow·shadowKey·f.lightStable 골격이 있다 — 확인용), 장면 bake는 `shadowKey` 바뀌면 lightStable 뒤 1회 재굽기. **`land.ts` 지역 `shadow()`(언덕 나무·산 침엽수 띠·숲 그루터기 L1178/1187·계곡 바위 L866)도 같은 경로로** — props.ts만 고치면 산·언덕은 그대로 +6k. 새벽 초원 소품·초원 관목(`spring.ts L291` 등) 포함.
[Acceptance Criteria] (a) s02 시드 42 dawn→dusk 소품 7개 창: 어두워진 무게 ≥ 5 · 중심 x ≥ +0.2·W_shadow, 밝아진 중심 ≤ −0.2·W_shadow — 7/7(이웃 간섭 1개 제외 6/6) (b) s16 4개·s15 2개·s10 2개 창 부호가 나무와 같음(혼합 부호 0) (c) 점심·맑음 s16/s07/s15 해시 동일(항등) (d) 밤 s16 바위 발밑 L 낙차 ≤ 점심의 40% (e) noon→dusk 잔차 클러스터 s10·s15·s16 각 ≥ 5(지금 0) (f) 새벽 산 침엽수 그림자 중심 −x, 노을 +x(지금 항상 +6k).
[Confidence] 높음 — 코드 경로 + 캡처 픽셀(잔차·벡터·크롭) 셋 일치
```

```
[Issue] 산 ③층(자락)이 여전히 구조가 아니다 — 여름 ②↔③ 3.6~6.9L(기준 6/8), 겨울 ②body↔③ |0.8~2.9|L(기준 8·밤/안개 6), 겨울 ③↔④ 2.3~4.5(밤 2.3 <3).
[Biome / Season / TimeOfDay / Weather / Seed / Camera] mountain / summer(s11)·winter(s09) / 전 띠 / cloud·fog·rain·snow / 42 / showcase
[Category] D-1(주) + S-2(부: 애추·바위 무리 없음)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] MOUNTAIN_DEPTH_RULES §1 층마다 ≥ 8L, §5 "③에 애추 띠·큰 바위·침엽수 무리로 발을 만든다"; B.md 표 ②↔③ ≥ 6/8, 겨울 |Δ| ≥ 8(밤·안개 6). B.md rect(x 600~900, ③ y 391~466, ④ 603~754) 실측: s11 dawn clear ②↔③ **3.6** · dawn cloud 5.6 · noon cloud 6.9 · dusk cloud 5.8 · night cloud 5.7 · dawn fog 5.4 · dawn rain **3.7**. s09 겨울 ②body↔③ −2.9(morning clear)/−2.8(snow)/−2.9(noon)/−2.5(dusk)/−2.2(night)/−0.8(fog) — ③ rect의 중앙값이 눈밭(=④)이라 ②의 발이 그대로 눈밭에 닿는다(y 391~466에 침엽수·너덜이 열의 30% 미만). ③↔④ 겨울 3.7/3.7/2.9/2.3/4.5. 가을은 ②↔③ 7.6~13 ✓(안개 산 s10). 크롭 `crop-s09-belt-left.png`: 원경 침엽수 줄이 반투명(뒤 줄기 비침) — AMB-D1-02 그대로.
[Suggested Fix] `land.ts` mountain: ③ 애추 띠(v .36~.44 계단 다각형, 지면 −6~−8L, 겨울은 청회 그늘 L−8) + 침엽수 α 1·안개색 mix + 너덜 바위를 무리 중심 3~5(v .34~.46)로 (AMB-D1-02 = D2-03 한 입구).
[Acceptance Criteria] B.md rect로 s11 전 띠 ②↔③ ≥ 6(안개 ≥ 5) · s09 ②body↔③ |Δ| ≥ 8(밤·안개 ≥ 6) · s09 ③↔④ ≥ 3 전 띠 · row-median 프로파일 v .34~.50에 ≥ 4L 깊이 국소 최소 1 · 침엽수 띠 열 점유율 ≥ 55% · 반투명 겹침 0 · 점심·맑음 하늘↔①·①↔② 회귀 없음.
[Confidence] 높음
```

```
[Issue] 암석해안 물가 바위 — 수면선 흰 획이 바위 몸통을 가로질러 그려지고, 젖은 띠·잠긴 발치가 없다(파도가 바위와 접촉하지 않는다).
[Biome / Season / TimeOfDay / Weather / Seed / Camera] rocky / autumn / dusk / wind / 42 / showcase
[Category] S-4
[Severity: P0 / P1 / P2 / P3] P1 (AMB-S4-03 열림 항목 그대로)
[Why it breaks immersion] BIOME_GRAMMAR 암석해안 "물가 노두 발치: 앞 반원 흰 물살 + 젖은 띠 + 조류대 색 발치", 공통 물가 규칙 "잘라내기만 금지". 크롭 `crop-s13-tideline-rocks.png`(원본 700~1160 × 360~520): 물가 선(흰 1px, y 375→410 굽이)이 바위 (735~800, 395~435)·(1030~1100, 415~455) **위를 통과**, 바위 하단은 마른 색·젖은 띠 0, 앞 반원 수면선 0. 라운드 3에서 순서만 바로잡혀(띠 위 α 1) "유령"은 사라졌지만 접촉 표현은 없다. 물보라 x는 여전히 바위와 무관(`coast.ts` rand()·w).
[Suggested Fix] `scenes/coast.ts` rocky `lateRocks`: 물가 걸침 바위를 `drawSubmerged(depth 6~10k, wet 2~3px)`로, 수면선 획은 바위 실루엣 뒤(또는 clip-out), 앞 반원 수면선 추가, 물보라 스폰 x를 이 목록에서.
[Acceptance Criteria] s13 접촉 바위 ≥ 6개: 바위 실루엣 안 수면선 획 픽셀 0 · 발치 젖은 띠 L −10 2~3px 100% · 앞 반원 수면선 존재 · 물보라 x가 접촉 바위 ±30px 안 100% · 웅덩이–바위 겹침 0 유지.
[Confidence] 높음
```

```
[Issue] 산 하늘↔①(원경 능선) 단차가 **능선 바로 위에서** 1.0~2.9L — 메인 세션 rect(하늘 y20~60)로는 3.2~5.5로 통과하지만 눈이 읽는 경계(r1−24~r1−8)에서는 라운드 3 이전과 같다. 능선① 계단 0.6~1.7(기준 1.5/2) 미달.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] mountain / autumn(s10)·summer(s11) / 전 띠 / fog·clear·cloud·wind·rain / 42 / showcase
[Category] D-1 · D-2
[Severity: P0 / P1 / P2 / P3] P2 (능선선은 살아 있어 "능선 해석 불가"는 아님 — 면 단차만)
[Why it breaks immersion] B.md 다섯 rect(SKY [r1−24, r1−8]): s10 안개 dawn **1.6**(≥2 미달)·morning 2.8·noon 2.4·dusk 2.2·evening 2.0·night 2.3 / s10 dusk clear **2.5**·cloud 2.9·wind 2.6(≥3 미달) / s11 dawn clear 1.5·cloud 1.9·noon cloud 1.9·dusk 2.2·night 2.3·rain 2.2·fog **1.0**. 같은 프레임 메인 rect: s10 dusk fog 4.2·night fog 3.7·dusk clear 5.5·s11 dawn cloud 4.0 — 차이는 하늘 그라데이션(위쪽 하늘이 능선 위 하늘보다 2~3L 밝다). 능선① 계단(med[r−8,r−2]−med[r+2,r+8]) 0.6~1.7 전 프레임 미달, p95−p5 4.2~9.8. 능선② p95−p5 가을 안개 6.7~9.7(기준 10 미달, 라운드3 4.5에서 개선), 계단 3.0~5.2 ✓. 겨울은 ✓(sky↔① 2.6(fog)~5.2, ①↔②body 6.9~11.5).
[Suggested Fix] `land.ts` mountain ①: 능선 아래 그늘 띠를 3px→6px·L−5→−7로 깊게(계단 채널) 또는 ① 상단 12px 어둡힘; `view.ts` 지평선 광을 능선 국소에서 끊지 않기. 측정 정의는 B.md rect로 통일(after 표).
[Acceptance Criteria] 능선 국소 rect로 s10·s11 전 띠 sky↔① ≥ 3(맑음·흐림·바람·비) / ≥ 2(안개) · 능선① 계단 ≥ 1.5 · 능선② p95−p5 안개 ≥ 10(또는 소유자 재정의 6~8) · 점심·맑음 해시 동일.
[Confidence] 높음(측정법 차이까지 확인) — 등급은 중간(눈에 띄는 정도가 주관)
```

```
[Issue] 암석해안 조류대(검은 띠)가 굽은 물가 선을 따르지 않는 **직선 사각**이다 — 윗변 y 378~379·아랫변 415에서 각 195~202열의 전폭급 수평 하드 에지.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] rocky / autumn / dusk / wind / 42 / showcase
[Category] S-4(주) + F-1(부)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] 공통 물가 규칙 "물가 40px 띠 … 물이 땅을 판 흔적", 암석해안 "조류대가 바코드" 금지 예. 이음매 스캔(|ΔL|>8, >120열): s13 [378:195] [379:197] [415:202] — 물가 선은 x에 따라 y 375→410으로 35px 굽는데 띠 경계는 두 줄의 수평선. 왼쪽(x<880)에서 띠가 물 아래로 비쳐 물가 선과 띠 윗변이 교차한다(크롭 좌측).
[Suggested Fix] `coast.ts` rocky 조류대 띠를 shorePath의 오프셋 폴리곤(y = shore(x)+0…38)으로 굽기, 위·아래 경계 픽셀 계단 ±2.
[Acceptance Criteria] s13 전폭 이음매 행(>120열) 0 · 띠 윗변 − shore(x) 표준편차 ≤ 3px · 띠 안 바위 순서·α 1 유지.
[Confidence] 높음
```

```
[Issue] 민물 물풀 섬이 기슭·수면선 없는 어두운 방사형 얼룩(반경 ~80px)에 갈대 획만 꽂힌 형태 — 물에 "놓인" 것이 아니라 "번진" 것으로 읽힌다.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] pond / spring / dawn / fog / 42 / showcase
[Category] S-4
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] 민물 "중경: 열린 물의 앵커(물풀 섬 2 …)", 공통 물가 "잠긴 돌 2단 그리기·수면선·젖은 띠". 크롭 `crop-s12-plant-island.png`(560~780 × 290~460): 수면선 링 0, 물색 사본 경계 0, 어두운 얼룩이 갈대 발보다 60~90px 밖까지 소프트 페이드(ADR-0017 ⑱ 소프트 원반 금지와도 충돌).
[Suggested Fix] `summer.ts` midWater 물풀 섬: 작은 진흙 패치(눌린 타원, 픽셀 계단) + 앞 반원 수면선 + 갈대 밑동 젖은 띠, 얼룩 페이드 제거.
[Acceptance Criteria] 섬마다 닫힌 수면선 링(L +6, 둘레 ≥ 70%) · 갈대 발 밖 20px 이상 어둡힘 0 · 물 위 생물·오리 회귀 없음.
[Confidence] 높음
```

```
[Issue] 초원 봄·여름의 밤·새벽 생물 풀이 점심과 같다 — 밤에 분홍 나비 2·벌·무당벌레 2·메뚜기 3이 점심 자리 그대로 빛난다(AMB-T1-02).
[Biome / Season / TimeOfDay / Weather / Seed / Camera] meadow / summer(s16)·spring / night·dawn / clear / 42 / showcase
[Category] T-1(주) + A-1(부: 시간대의 공간 영향)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] 초원 "새벽 나비 0~1·벌 0, 저녁 퇴장, 밤 0", 공통 "원경이 흐린 시간대는 v ≥ .25". 캡처 `s16 band-night.png`(=`probe-before/s16-night.png`): 나비 (516,260) v .21·(950,234) v .17, 벌 (13,203), 무당벌레 (1361,852)·(15,611), 메뚜기 3 — 점심 debug 좌표와 동일. 코드 `spring.ts@2e783de`: `f.time`/`band` 사용 0회, `flyTarget/hopTarget/bugTarget` = load만, 벌 = load ≥ .6 + 타이머; `autumn.ts@2e783de L621` 다람쥐 = load ≥ .5 + 타이머(띠 없음). 라이브(작업 트리)는 이미 밤 0·새벽 나비1/무당1/메뚜기1, 밤 다람쥐 0/12 — after에서 확인만.
[Suggested Fix] `spring.ts` 목표치에 띠 계수(밤 0·새벽 나비 ≤1·벌 0·저녁 감소), 퇴장은 `state="leave"`로 가장자리까지(페이드 금지); `autumn.ts` 다람쥐·`winter.ts` 손님 동일 게이트.
[Acceptance Criteria] 시드 42 t 1.5/8s 밤: flies·bugs·hoppers 0, bee null(봄·여름) · 새벽 flies ≤ 1, bee null · 띠 전환 시 개체 소멸은 화면 밖에서만(퇴장 프레임 x ∉ [0,w] 또는 y > h) · 점심 개체 수 회귀 없음.
[Confidence] 높음
```

```
[Issue] 언덕 띠 3겹 경계 단차 3.2~5.0 / 2.9~4.6 / 1.1~1.5L로 규칙(8) 미달, 시간대 불변, 노을(4.1/3.9/1.4)이 점심(5.0/4.6/1.5)보다 **작다**(규칙은 노을 최대).
[Biome / Season / TimeOfDay / Weather / Seed / Camera] hill / autumn / 전 띠 / wind / 42 / showcase
[Category] D-2(주) + S-2(부: 나무 발 62px·노두 30~65px 능선 어긋남 유지)
[Severity: P0 / P1 / P2 / P3] P2 (AMB-D2-02 이월, 시간 차원 정량 추가)
[Why it breaks immersion] BIOME_GRAMMAR 언덕 "띠의 밝기 단차가 시간에 따라 변한다(점심 최소, 노을 최대)", "능선선 위에 발". 캡처 band 프레임(x 100~1300 step 10, 경계 y≈225/376/575): dawn 4.0/3.7/1.5 · morning 4.7/4.5/1.5 · noon 5.0/4.6/1.5 · dusk 4.1/3.9/1.4 · evening 3.8/3.6/1.1 · night 3.2/2.9/1.1 — multiply가 단차를 비례로 줄여 노을·밤에 **더 평평**해진다. 크롭 `crop-s15-outcrop-ridge.png`: 노두 바위 (135~280, 285~350)가 능선선(y≈215~235) 아래 50~110px 사면 위, 나무 발 (316,297) 능선 −62px.
[Suggested Fix] `land.ts` hill: 능선 그늘을 bake가 아니라 draw() 오버레이로 `shadow.len`·dx 비례(사면 명암), 띠별 파장·진폭 분리, 나무·노두 y = ridge_k(x) + [−4, 28].
[Acceptance Criteria] 세 띠 각 점심 ≥ 5 · 노을 ≥ 8 · 새벽/저녁 ≥ 6 · 밤 ≥ 4 · (노을−점심) ≥ 2 · 띠 3 ≥ 5 · 나무 |ty−ridge| ≤ 10 · 노두 ≥ 80% [−4, 28].
[Confidence] 높음
```

```
[Issue] 계곡 우측 벽 위 오크 6그루가 한 무리로 수관이 맞닿는다(무리 크기 ≤ 4 규칙 초과 의심).
[Biome / Season / TimeOfDay / Weather / Seed / Camera] valley / autumn / evening / fog / 42 / showcase
[Category] S-1
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] 공통 간격 표 "나무–나무 무리 안 ≥ .6(R1+R2), 무리 크기 ≤ 4". s06 static (1250~1400 × 220~430): (1305,235)(1360,255)(1265,340)(1370,335)(1325,390)(1395,425) — 인접 쌍 3~4개 수관 접촉. 계곡 나무는 claimSpot 경유(여유 .7R)라 겹침 자체는 규칙 안일 수 있음 — 미측정.
[Suggested Fix] `land.ts` valley 벽 위 나무 무리 크기 상한 4 + 무리 간 포아송 반경; `overlapRatio` 지표(P2)로 확인.
[Acceptance Criteria] 계곡 4시드 벽 위 무리 크기 ≤ 4 · overlapRatio ≤ 8% · 시내 굽이 바깥 바위 5×굽이 유지.
[Confidence] 낮음 — 한 장·육안, 미측정
```

---

## 회귀 확인(라운드 3에서 닫힌 것)

| 항목 | 결과 |
|---|---|
| 민물 뭍 위 물결·오리(P0) | 오리 y−물가선(x) **4/4 OK**: 시드 42 (835,502) +244 · 7 (931,451) +201 · 11 (778,545) +281 · 23 (496,504) +233(밤 t 6s, 라이브 — waterTopAt 로직은 3cbd675) · 뭍 포인터(x 300/700/1100, 물가선 −20) 고정 → 뭍 diff **0/0/0**, 물 diff 0(dawn fog, 라이브 해시 = 캡처 동일) · 물고기 14·글린트 7 유지 |
| 갈대 ㅡ자 절단 | s12 전폭 이음매 스캔: y 600 부근 0. 남은 행 [311:164](굽은 물가선) [677:121](근경 젖은 선) — 곡선, 이음매 아님 ✓ |
| 계곡 리본 끝(16:9) | 라이브 1920×1080 우하 520×300 크롭(`s05-1920x1080-corner.png`): 직선 캡 0 ✓ |
| 노두 claimSpot(암석) | s13 static: 바위가 바위를 뚫는 겹침 0, 위성 ≤ 5(육안) ✓ |
| 조류대 바위 순서 | 물가 바위 8개 띠 위 α 1 ✓ — 단 수면선 획이 바위를 가로지름(위 P1, AMB-S4-03 잔여) |
| 갯벌 물 안 소품 · 물골 형태 | s07·s08 물골 안 마른 소품 0, 꺾임·갈고리 0 ✓ |
| 숲 나무 수·겹침 | 44(34~48) ✓, 무리 겹침 ≤ 40% 수준 ✓. scatterProps가 claimSpot 경유·나무는 그 뒤 배치 → 구운 소품이 나무 앞을 가리는 A-3 구조 위험 없음 ✓ |
| 다람쥐 A-1 | `spawn-probe --only 3 --seeds 24`(morning): 등장 24/24 · v<.18 **0건** · 최소 출발/경로 v .201(시드 18) · 회오리 20/24 최소 .272 ✓. 밤(라이브 WIP, 12시드): 다람쥐 0/12(WIP 게이트) · 회오리 10/12 최소 v .231(밤 .25 권고보다 살짝 낮음, 현상이라 P3) |
| 잠긴 돌 | s05·s06 계곡 물 안 바위 수면선·후류 ✓, s12 민물 바위 물색 사본·수면선 ✓ |
| forbiddenCombo · E-1 | 16 시나리오 날씨 ∈ 허용표, 페이지 에러 0 ✓ |

## 측정표

**(1) 산 다섯 rect — B.md 방법(x 600~900 step 2 · median L* · r1·r2는 시나리오별 가장 맑은 프레임에서 검출: 가을 r1 107~205/r2 208~305 · 여름 208~313 · 겨울 107~189/211~317)**

| 프레임 | sky↔① | ①↔② | ②↔③ | ③↔④ | 능선② p95−p5 / 계단 | 능선① |
|---|---|---|---|---|---|---|
| s10 가을 dawn fog | **1.6** | 4.8 | 8.7 | 10.9 | 7.2 / 3.2 | 4.2 / 0.7 |
| morning fog | 2.8 | 6.1 | 13.0 | 13.9 | 9.2 / 3.9 | 6.8 / 1.0 |
| noon fog | 2.4 | 7.2 | 11.5 | 13.3 | 9.5 / 4.9 | 7.1 / 1.3 |
| dusk fog(static) | 2.2 | 6.0 | 8.4 | 11.5 | 9.7 / 4.1 | 7.9 / 1.2 |
| evening fog | 2.0 | 5.4 | 8.0 | 10.5 | 8.4 / 3.6 | 6.8 / 1.1 |
| night fog | 2.3 | 4.6 | 7.6 | 9.1 | 6.7 / 3.0 | 5.1 / 1.1 |
| dusk clear / cloud / wind | **2.5** / 2.9 / 2.6 | 7.0 / 7.0 / 7.3 | 6.3 / 8.4 / 6.6 | 10.5 / 10.0 / 10.5 | 9.5 / 5.0 · 9.7 / 4.5 · 8.7 / 5.2 | 7.6 / 1.5 · 8.2 / 1.3 · 6.4 / 1.7 |
| s11 여름 dawn clear | **1.5** | 7.2 | **3.6** | 6.6 | 11.9 / 5.6 | 9.6 / 0.9 |
| dawn cloud(static) | **1.9** | 7.9 | **5.6** | 6.8 | 12.4 / 5.5 | 9.8 / 0.8 |
| noon cloud · dusk cloud · night cloud | 1.9 · 2.2 · 2.3 | 9.0 · 8.1 · 7.0 | 6.9 · 5.8 · **5.7** | 8.0 · 6.7 · 5.5 | 11.3/6.6 · 11.8/6.0 · 9.8/4.5 | 7.6/0.8 · 9.0/1.2 · 8.3/0.7 |
| dawn fog · dawn rain | **1.0** · 2.2 | 4.9 · 7.2 | 5.4 · **3.7** | 7.5 · 5.7 | 7.9/3.8 · 11.9/4.9 | 4.5/0.6 · 9.7/0.7 |
| s09 겨울 morning clear | 5.0 | ①↔②cap 12.6 · body 11.5 | ②body↔③ **−2.9** | 3.8 | 15.8 / 13.7 | 11.4 / 4.7 |
| morning snow(static) · noon · dusk · night | 4.6 · 4.3 · 4.3 · 4.1 | body 10.5 · 9.9 · 8.1 · **6.9** | **−2.8 · −2.9 · −2.5 · −2.2** | 3.7 · 3.7 · **2.9 · 2.3** | 14/12 · 14.2/12.2 · 12.8/10.8 · 10.3/9.0 | 11.9/4.4 · 10.9/4.4 · 12.1/4.3 · 11.3/3.4 |
| morning fog · cloud | **2.6** · 5.2 | 8.3 · 10.7 | **−0.8** · −2.6 | 4.5 · 3.5 | 10.2/8.8 · 14.1/12 | 9.6/2.6 · 12.3/4.5 |

굵게 = B.md 표 미달. 꼭짓점 간격 ①↔②: 가을 Δx 308(≥168 ✓), 여름 312 ✓, 겨울 192 ✓.
메인 세션 rect(하늘 20~60 · ① 150~190 · ② 250~300 · ③ 420~470) 대조: s10 dusk fog 4.2/6.2/9.1 · night fog 3.7/4.8/8.0 · dusk clear 5.5/7.0/6.9 · noon fog 4.9/7.2/12.4 · dawn fog 3.2/5.1/9.2 · s11 dawn cloud 4.0/7.9/6.4 · night cloud 3.6/7.1/6.4 · dawn fog 2.9/4.9/6.1 · **s09 겨울 ①↔② 0.9(② rect가 설선 안 — 겨울엔 이 rect 무효, B.md ②cap/②body 사용)**.

**(2) 그림자 — 새벽→노을 반대칭 벡터(줄기 발 기준 px, 창 x±2.6R · y −.5R~+.45R)**

| 대상 | 어두워진 무게 / 중심 x | 밝아진 무게 / 중심 x | 판정 |
|---|---|---|---|
| s02 나무 oak(565,738) R70 · (1045,612) · (355,595) · (240,600) · (1090,478) · pine(950,690) | 56/+42 · 32/+31 · 64/−24* · 29/+28 · 27/+34 · 26/+24 | 4/−37 · 3/−19 · 1/−38 · 1/+52 · 1/−22 · 0/−41 | 동·서 반응 ✓(5/6) |
| s02 소품 log(480,478) · shrub(540,528) · rock(1205,615) · shrub(1035,695) · stump(1130,707) · stump(1150,384) · log(1190,358) | 0 · 0 · 0 · 14/−49(이웃 나무) · 0 · 2.4 · 0 | 0 · 0 · 0 · 0 · 0 · 0.1 · 0 | 반응 0 ✗ |
| s16 초원 shrub(1085,750) · rock(445,768) · stump(865,822) · tuft(655,408) | 0 · 0 · 0 · 0 | 0 | 반응 0 ✗ |
| s15 언덕 능선 오크(316,297) · rock(1245,718) | 42/−0.3(y −9.9: 몸통) · 0 | 0 · 0 | 이동 0 ✗ |
| s10 산 침엽수(810,665) · rock(604,512) | 198/+3.5(y −10.7: 몸통) · 0 | 0 · 0.1 | 이동 0 ✗ |
| s05 계곡 oak(760,398) · (905,398) R30 | 40/−0.2 · 38/+7.5 | 0 · 1.3 | 소형은 몸통 어둡힘에 묻힘(코드상 +10.8 예상) |

noon→dusk 잔차 클러스터(thr .06, ≥24px): s02 dark 8 / meanDx +21.8(+7/−1) · s01 dark 20 / +21.3(+19/−1) · s05 dark 9 / +15.4(+9/−0) · s10 0 · s15 0 · s16 0 · s07 0. 시각화 `shadow-<sid>-noon-vs-<band>.png`(파랑 = 밝아짐 — 어두운 픽셀에 대한 틴트 α .05 가산 효과가 섞여 있어 수관·줄기가 전부 파랗다; 방향 판정은 위 반대칭 표를 쓸 것).

**(3) 언덕 띠 경계 ΔL(x 100~1300 step 10, 경계 y≈225/376/575)**: dawn 4.0/3.7/1.5 · morning 4.7/4.5/1.5 · noon 5.0/4.6/1.5 · dusk 4.1/3.9/1.4 · evening 3.8/3.6/1.1 · night 3.2/2.9/1.1.

**(4) 조명 프로브 대조(`light-probe.txt`)**: s16 지면 ΔL −7.1/−2.0/0/−4.8/−9.2/−16.0 유지, 그림자 채널만 소비자 없음(위 (2)).

## 관찰(이슈 아님)
- 노을 나무 그림자는 대칭 타원을 ×2.04 늘린 것이라 해 쪽으로도 0.71R 뻗는다(수관 발자국 R 안이라 눈에 안 띔) — P3.
- s05 물가 오크(590,325)는 자갈 둔치 위에 서고 그림자만 물 위로 든다 — 물리적으로 맞음, 이슈 아님.
- 하네스: after 비교 전 서버 빌드 고정 필수(위 검사 조건). 산 표는 B.md rect로 잴 것(메인 rect는 겨울 ② 무효·하늘 20~60은 능선 국소보다 2~3L 후함).

## 권고 우선순위
1. **AMB-T1-03 입구 하나로**: `art/props.ts` 발밑 그림자 조명화 + `land.ts` 지역 `shadow()`(언덕 나무·산 침엽수·숲 그루터기·계곡 바위)까지 같은 경로 — 후자를 빼면 산·언덕은 after에도 "반응 0"으로 남는다. 수용 기준 = 위 (2) 표의 소품 행이 나무 행과 같은 부호.
2. 산 ③ 구조(AMB-D1-02 = D2-03) — 여름 ②↔③ 3.6·겨울 |2.9|는 팔레트로 안 풀린다; 애추 띠·침엽수 α 1 한 입구. 하늘↔① 국소 1.0~2.9는 같은 파일이니 능선 그늘 띠만 깊게.
3. 암석해안 물가 바위 `drawSubmerged` + 조류대 띠를 shore(x) 오프셋으로(AMB-S4-03 · 신규 띠 사각) — 민물 물풀 섬은 같은 "잠긴 규칙" 헬퍼로 묶으면 세 건이 한 입구.

## 요약
- **P0 0 · P1 3 · P2 6 · P3 0**(관찰 2)
- 가장 넓게 걸린 문제: **굽힌 것은 조명을 모른다** — 소품·언덕 능선 그늘·산 침엽수 그림자·조류대 띠·언덕 띠 단차가 전부 bake 시점(점심) 상태로 고정돼, 매 프레임 그리는 나무만 시간을 따라가 한 장면에 해가 둘이 된다.
- 이번 라운드에 안 고쳐도 되는 것: 계곡 벽 위 오크 무리 간격(P2·낮음 — `overlapRatio` 지표가 생긴 뒤), 밤 회오리 v .231(현상, P3).
