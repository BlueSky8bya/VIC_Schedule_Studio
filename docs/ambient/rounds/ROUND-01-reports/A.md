# Agent A — Art Mood Director · Round 1 보고(빌드 980f170 · seed 42 · before)

읽은 것: VISUAL_DIRECTION · IMMERSION_BREAK_RULES · SEASON_TIME_WEATHER_GRAMMAR §2 · MOUNTAIN_DEPTH_RULES §1~2 · BIOME_GRAMMAR(공통·부록 B·숲·산·언덕·초원·갯벌·암석) · SYSTEM_MAP §1/§4/§7. 본 시트: s01·s07·s09·s10·s11·s13·s15·s16 static/static-gray, s16·s10 band-sheet. Suggested Fix의 줄 번호는 `components/shared/ambient/scenes/land.ts`·`coast.ts`·`spring.ts`·`world/view.ts`에서 직접 확인한 것이다.

```
[Issue] 산의 "구곡 그늘"이 화면을 세로로 가르는 반투명 기둥 7개(등간격·직선·양 봉우리 관통)로 그려져 산체가 블라인드/유리판처럼 보인다.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] mountain / winter / morning / snow ; mountain / autumn / dusk / fog ; mountain / summer / dawn / cloud / 42 / showcase
[Category] F-1 (부차 S-3)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] F-1 "하드 에지 사각·직선", S-3 "등간격 반복", VISUAL_DIRECTION §3 부드러움("각진 형태·전폭 직선 금지"). s09 static.png x≈40–90 · 300–350 · 490–540 · 700–750 · 830–880 · 1040–1100 · 1330–1380, y≈150→480에 세로 반투명 기둥이 w/7 간격으로 서고, 두 봉우리를 그대로 관통해 v≈.45(침엽수가 서 있는 ③층)까지 내려온다. s10 static(x≈40·300·500·720·850·1050·1350)·s11 static도 동일, s10 band-sheet 여섯 칸 전부에 있다. static-gray에서는 산보다 기둥이 먼저 읽힌다 — 프레임에서 가장 큰 구조물이 "산"이 아니라 "줄무늬"다. 코드: land.ts `peak()` L986–1003 — `gxp = ((q+.5)/7)·w ± 6%`, `yAt(gxp)+4 → foot`까지 내려가는 사다리꼴 + 가로 그라데이션. L977 주석이 피하라고 적은 "반투명 직사각형"을 구곡 루프가 그대로 되살렸다.
[Suggested Fix] land.ts mountain 분기 `peak()` 구곡 블록: (a) 위치를 1/7 등간격이 아니라 능선의 안부(ridge 배열 국소 최소)에서만 시작, 봉우리당 2~4개; (b) 형태는 아래로 좁아지는 쐐기, 봉우리 높이의 55~70%에서 끝(절대 `foot`/③층까지 내리지 않음), 가장자리는 픽셀 격자 4px 계단, α ≤ .08, 북서(빛) 쪽 1px 밝은 림; (c) 또는 구곡을 없애고 MOUNTAIN_DEPTH_RULES §5 "계단진 다각형" 그늘 2~3장으로 대체(이미 있는 대각 광원 그라데이션 L979–985는 유지).
[Acceptance Criteria] s09·s10·s11 static-gray에서 x 편차 < 6px인 세로 에지가 80px 이상 이어지는 곳 0; 음영 기둥이 해당 봉우리의 발선(v .34) 아래로 내려오지 않음; 구곡 x 간격의 변동계수 ≥ .35(등간격 아님); s10 band-sheet 여섯 칸 모두 기둥 없음.
[Confidence] 높음 — 코드 경로(L986–1003) 확인 + 3 시나리오·6띠 시트에서 반복 관찰.
```

```
[Issue] 산의 층이 미적으로 뒤집혔다 — 가장 먼 지평선 띠(초록 언덕·나무 줄)가 가장 채도 높고 밝게 산 위에 얹히고, 봉우리는 능선선 없는 매끈한 혹 두 장이며 오른쪽 절반은 평평한 직선 능선, 발치는 안개로 녹아 "회색 벽 두 장"으로 읽힌다.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] mountain / summer / dawn / cloud ; mountain / autumn / dusk / fog ; mountain / winter / morning / snow / 42 / showcase
[Category] D-2 (부차 D-1)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] MOUNTAIN_DEPTH_RULES §1(①은 불투명, 산은 profile "mountain"으로 굽어 언덕·나무 줄 없음, 인접 층 ΔL ≥ 8), §2-3("부드러운 혹 두 개 = 회색 벽", 봉우리·안부 2~4개), §3 다섯 단서(채도: 원경이 가장 낮다). s11 static.png y 30–100: 지평선 띠가 프레임에서 가장 채도 높은 초록(언덕 2겹 + 롤리팝 나무 줄)이고 그 바로 아래 y 160–330의 봉우리는 탈색된 청회 — "파란 호수 위의 초록 들판"으로 읽힌다. s10 static: 앞 봉우리 윗선이 y≈215에서 x≈750→1400(650px) 직선 — ridge 걸음의 평균 회귀(`yv += (base − amp·.55 − yv)·.06`, 경사 변경 확률 14%)가 고원을 만든다. s09 static-gray: 하늘·①·②의 L이 모두 ≈82–88로 단차가 없고, 뒤 봉우리(α .5)로 앞 봉우리·안개가 비치며 두 발치가 `${fill}00`으로 사라져 산에 "발"이 없다. s10 band-sheet 여섯 칸 전부 같은 벽.
[Suggested Fix] view.ts `bakeHorizon`: `profile: "mountain"` 추가(안개 띠만, 언덕·나무 줄 n=0 — 또는 언덕을 봉우리 색조의 L+6으로). land.ts `peak()`: 두 봉우리 α 1, 원근은 색으로(① 밝고 회색, ② 어둡고 채도 중간 — §1 표), ridge 걸음의 평균 회귀를 없애고 봉우리·안부 제어점 2~4개 사이를 각진 걸음으로 잇기(같은 y ±4px 구간이 w×.25를 넘지 않게), 양 봉우리에 능선선(1px 림 L+6/+8 + 2~3px 그늘 띠, 계단), 발치는 `${fill}00` 대신 ③층 색(GROUND.mountain 윗값)으로 맞물림.
[Acceptance Criteria] s09·s10·s11 static-gray에서 층 경계 상하 12px 평균 L: 하늘↔① ≥ 4, ①↔② ≥ 8, ②↔③ ≥ 8; |Δy| < 4px인 능선 구간이 w×.25를 넘지 않음; 산 프레임의 지평선 띠(y < 103)에 언덕·나무 실루엣 0; s11에서 지평선 띠 채도 ≤ ② 채도; 뒤 봉우리를 통해 앞 봉우리·안개가 비치지 않음.
[Confidence] 높음 — SYSTEM_MAP §4 그리기 순서 + `peak()` L940–972 확인 + 3 시나리오·밴드 시트.
```

```
[Issue] 해안 두 곳의 땅이 "자로 그은 기하"로 읽힌다 — 암석해안은 전폭 평행 물결 띠 4~5줄 + 바코드 조류대 + 검은 얼룩, 갯벌은 하드 에지 남색 리본 물골에 등폭 둔치 오프셋과 폴리곤 윤곽선(와이어프레임)이 그대로 보인다.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] rocky / autumn / dusk / wind ; tidal / summer / noon / clear / 42 / showcase
[Category] F-1 (부차 S-3; 물골 중심선 형태는 S-5 — B에게)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] F-1 "전폭 1px 선·하드 에지·오프셋 폴리곤 겹침", S-3 "평행 반복", BIOME_GRAMMAR §9 몰입 파괴 예 "조류대가 바코드·바위 스티커 산포", VISUAL_DIRECTION §7 "도형 이어붙인 물길". s13 static.png: y≈470·540·600·660·720에 화면 전폭을 달리는 물결 모양 명암 띠(rocky ① 단차, coast.ts L621–644 — `lineTo(x, ly(x)+34)`로 닫는 전폭 스트립)가 gray에서 등고선/계단식 논으로 읽힘; y≈380–430 조류대는 하드 에지 검은 띠 + 윗변 1px 흰 선; (150,455)·(700,595)·(640,690)·(490,730)·(975,430)의 검은 불규칙 얼룩이 프레임에서 가장 어두운 표식이라 물이 아니라 잉크 방울/새 실루엣으로 읽힌다(웅덩이인지 표착 해조인지 코드 미확인 — 어느 쪽이든 "위협적 어두운 덩어리"). 바위 7무리는 같은 y 띠(v .55~.9)에 비슷한 크기로 흩어져 스티커. s07 static.png: 물골이 x 470–600, y 330–430에서 세 직선 구간의 남색 리본, 둘레에 등폭 밝은 둔치(drawChan 4패스 1.35/1.0/0.5/1.04), (520–580, 400–440)·(715–790, 575–660)에 얇은 폴리곤 윤곽선이 와이어프레임처럼 비친다; 뭍/바다 경계 y≈320은 전폭 매끈 곡선 + 1px 흰 선.
[Suggested Fix] coast.ts rocky ① 단차(L621–644): 전폭 스트립을 2~4 구간으로 끊고(바위 결 루프 L684–688의 pen up/down 방식) 구간마다 y 오프셋·계단 에지; 조류대(L794~): 상·하연 ±30% 요동 + 노두가 끼는 곳에서 끊기, 윗변 1px 흰 선 제거; 웅덩이/해조 표식: 웅덩이는 주변 암반보다 L+6~10(하늘빛)이고 위쪽 1px만 어두운 턱, 해조는 픽셀 점 무리(L691 주석의 방향). coast.ts tidal `drawChan`(L187–232): 1.04 stroke 패스(보이는 윤곽선) 제거, 둔치 폭을 저주파 노이즈 ×.8~1.4로 가변, 물색을 뻘 대비 ΔL ≤ 14로 낮춰 남색 리본을 피함. 중심선(직선 현 + 단일 사인)은 B의 S-5와 같은 라운드에 함께 고친다.
[Acceptance Criteria] s13 static-gray: 물가 선 아래에서 폭 70% 이상 이어지는 연속 명암 에지 0(물가 선 자체 제외); 웅덩이 L ≥ 주변 암반 L; 조류대 두께 변동계수 ≥ .3. s07: 물골 가장자리를 따라가는 ΔL > 10의 1px 선 0(윤곽 stroke 없음); 둔치 폭 변동계수 ≥ .25; 뭍/바다 경계 흰 1px 전폭선 없음.
[Confidence] 높음 — coast.ts rocky L619–690·SYSTEM_MAP §7 drawChan 패스 확인 + static/gray 관찰.
```

```
[Issue] 모든 육지 바이옴의 지평선 "먼 숲"이 같은 크기의 정원 + 막대(롤리팝) 20여 개가 한 기준선에 늘어선 구슬 줄로 읽힌다.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] meadow / summer / noon / clear ; forest / spring / morning / clear ; hill / autumn / noon / wind ; mountain / winter·autumn·summer / morning·dusk·dawn / snow·fog·cloud / 42 / showcase
[Category] S-3 (부차 F-1)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] S-3 "같은 크기·같은 y 반복", F-1 "소프트 원반·정원", IMMERSION_BREAK_RULES §3 예시 "지평선 나무 줄 간격이 규칙적 → S-3 P2", VISUAL_DIRECTION §7 "등간격·같은 크기·같은 y". s16 static.png y≈65–85, x = 110·160·180·225·255·295·330·375·400·425·460·480·515·675·700·730·760·790·840·950·980·1235·1295 — 두 크기(≈6/9px)의 원이 1~2px 막대 위에 공통 기준선으로 늘어선다; s01·s15(가을 갈색 구슬)·s09(겨울 나목 점)·s10·s11 전부 동일, s16·s10 band-sheet 12칸에도 그대로. 산 프레임에서는 봉우리 위에 얹혀 MOUNTAIN_DEPTH_RULES §1(산은 나무 줄 없음)과도 충돌. 코드: view.ts `bakeHorizon` L160–183 — `n = w/34`, `arc(x, y − s·0.8, s)` + `fillRect` 줄기.
[Suggested Fix] view.ts `bakeHorizon` 나무 줄: 포아송 중심으로 무리(2~6그루, 무리 간격 ≥ 무리 폭 1.5배), 크기 0.7~1.6× + 밑선 y ±3px 흔들기, `arc` 대신 픽셀 격자 실루엣 2종(소나무 계단 삼각 · 참나무 3덩이 계단 수관)을 한 path로 합쳐 채워 개별 "구슬"이 분리되지 않게, 안개 α와 함께 옅어짐; `profile:"mountain"`이면 n = 0(위 산 항목과 연동).
[Acceptance Criteria] s16·s01·s15 static-gray: 크기(±1px)·기준선이 같은 지평선 형태가 4개 이상 연속하는 구간 0; 줄 안에 ≥ 60px 빈 틈 3곳 이상; 원(arc) 수관 0; 산 프레임 지평선 띠에 나무 줄 없음.
[Confidence] 높음 — 코드 경로 L160–183 + 육지 6 프레임·밴드 시트 전부에서 관찰.
```

```
[Issue] 픽셀아트 땅 위에 가우시안식 소프트 얼룩(radial softBlob)이 크게 깔려 흐린 렌즈 먼지·검은 연기 그림자처럼 보이고, 픽셀 화풍과 부드러운 블러가 한 화면에서 싸운다.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] meadow / summer / noon(여섯 띠 전부) / clear ; tidal / summer / noon / clear ; forest / spring / morning / clear(옅음) / 42 / showcase
[Category] F-2 (부차 F-1)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] F-2 "픽셀 옆 안티에일리어싱·보간", F-1 "소프트 원반(렌즈 먼지)", VISUAL_DIRECTION §3 포근함("위협적인 검은 덩어리 없음"), ADR-0017 ⑱ 대체물 픽셀 격자. s16 static.png (75,155)·(345,170)·(1160,150)·(870,290)·(1000,380)·(590,540)·(830,620)에 반경 60~130px, 에지 없는 어두운 얼룩 — 풀·꽃·풀포기가 전부 또렷한 픽셀인데 얼룩만 흐려 gray에서 "더러운 렌즈"로 읽힌다(달력 뒤 기본 화면이라 노출이 가장 크다). s07 static.png: 뻘에 밝고 어두운 소프트 스미어 26개((80,370)·(300,440)·(560,430)·(950,440)·(1000,470)·(1300,700)) + 짙은 초록 소프트 해조 덩이((450,560)·(600,640)·(800,490)) → 목탄 문지른 판. 코드: spring.ts L235–241 `softBlob(… (120+g0()·260)·pk …, α .19)`; coast.ts tidal L372–379(해조 4겹 softBlob)·L394(광택 얼룩 26 × softBlob 70–260px). 같은 원인: 픽셀 지면 위에 radial 그라데이션 얼룩을 직접 칠한다.
[Suggested Fix] 지면 얼룩용 `softBlob` 호출을 저해상 얼룩 패스로 교체: 1/6 배 오프스크린(≈233×143)에 2~3단 계단 톤(단마다 ΔL ≤ 6), GROUND_SQUASH로 눌러 그린 뒤 `imageSmoothingEnabled=false`로 확대(LOD 저해상 규칙을 얼룩에 적용 → 6px 셀이 보이는 얼룩); 가장 어두운 얼룩은 지면 L − 8 이내; tidal은 광택을 밝은 계단 패치로만, 해조는 rocky처럼(L691 주석) 픽셀 점 무리로. 대상: spring.ts L235–241, coast.ts L372–379·L394(그 외 `softBlob` 지면 호출도 같은 규칙).
[Acceptance Criteria] s16·s07 static-gray: 반경 24px 이상에 걸쳐 단 없이 단조 감소하는 명도 구배(매끈한 radial) 0; 지면 얼룩 최저 L ≥ 지면 L − 8; 얼룩 에지에 ≥ 4px 양자화 계단이 보임; 여섯 띠 시트에서 얼룩이 "그림자"가 아니라 "풀 색 차이"로 읽힘.
[Confidence] 높음 — softBlob 호출 위치 확인 + 3 프레임에서 관찰.
```

**P0 0 · P1 3 · P2 2 · P3 0**
가장 넓게 걸린 문제: `view.ts bakeHorizon`의 롤리팝 나무 줄 — 육지 6 프레임·밴드 시트 12칸 전부에 있고, 산에서는 층 뒤집힘(2번)의 절반 원인이기도 하다(한 함수 고치면 두 건이 움직인다).
이번 라운드에 안 고쳐도 되는 것: **T-2(노을 과장·밤 정보 소실)는 위반 없음** — s16·s10 band-sheet의 노을은 주황이 아니라 따뜻한 회베이지(S ≪ .3)이고, 밤도 풀·꽃·실루엣·능선이 다 남아 있다. 다만 여섯 띠가 "같은 그림에 필터 여섯 장"으로 읽히고 아침=점심 해시가 같다 — 이는 **정서 부재 → C의 T-1로 넘긴다.** (부차로 s09 눈 위 황토색 바위·s10/s15 갈색 땅 위 청회 바위의 F-3 튐은 P3 — 이번엔 두자.)
