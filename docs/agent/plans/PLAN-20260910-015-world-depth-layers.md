# PLAN-20260910-015 — 세계 배경 깊이 레이어와 포인터 시차

Status: **Accepted** (2026-09-10 소유자 조건 확정·연구 기반 설계 위임 반영, 별도 구현 지시 대기) · Task Risk: **L2** (렌더 순서·좌표·아트 규격의 구조 변경; 이 단계는 문서만) · Created: 2026-09-10 (KST)

선행: PLAN-20260904-004, ADR-0016/0017/0019/0020/0021. **설계 조건은 승인됨. 별도 구현 지시 전 코드·이미지 작업 없음.** 승인된 변경은 §10에 기록한다. 규칙 파일 개정은 구현 단계에서 해당 결정과 함께 진행한다.

## 1. 범위와 결론

엔진 하늘 S + 이미지 원경 F / 지면 M / 근경 프레임 N. **소유자 결정 Q10 확정(2026-09-10): 심해 계절 봉인 유지.** 목표는 **10바이옴 × 4계절 × 3장 + 심해 공통3장 = 123장**. 초원 파일럿12장, 나머지111장. 시간대·날씨 이미지0장. 심해는 사계절 같은 배경이며 기존 날씨 봉인·자체 시간 반응을 유지한다. 최초132장 제안은 이 결정으로 대체됐고, 나머지 조건도 §10의 소유자 답변 및 연구 위임에 따라 확정했다. 구현·이미지 생성은 아직 착수하지 않았다.

생물·서 있는 나무·큰 소품·충돌 지형·수면 경계는 엔진 소유. 배경에 굽지 않는다. 이미지가 없거나 검사를 통과하지 못한 슬롯은 해당 절차적 레이어로 대체한다. 원경만 합격해도 지면·근경은 유지 가능하되, 공개 승격은 계절 짝 검사를 통과한 묶음만 허용한다.

이번 변경 파일은 본 계획과 ACTIVE_PLAN 행뿐. 기존 진행 중 계획, 소나무 검토 후보, 작업회차, 공통화풍참고 원본, 공개 합격본을 건드리지 않는다. 공개 데이터·권한·인증·DB·배포 변경 없음. G-16의 주제 상태는 이 계획과 활성 행에 기록한다. CURRENT_STATE 등 대량 개정은 구현 단계로 미룬다.


### 1.1 화면에서 보이는 최종 결정

소유자는 2026-09-10에 Q1/2/5의 세부 결정을 연구 근거로 위임하고 Q3/4/6/7/8/9/10/11을 확정했다. 아래 수치는 연구에서 찾은 절대 최적값이 아니라, 부록E의 지각 연구·공식 제품 사례·현행 아트/성능 제약을 결합해 선택한 **이 제품의 구현 시작값**이다.

- **세 겹:** 먼 풍경 / 동물이 서 있는 땅 / 앞쪽 낮은 풀. 겹 수를 늘리는 대신 가림·발점·색의 앞뒤 관계를 맞춘다. 하늘은 별도 기존 엔진층.
- **작은 움직임:** 1400px 폭 화면에서 한쪽 끝까지 마우스를 옮겨도 먼 풍경3px, 지면8px, 앞 풀16px. 수직은0/2/4px. 이전24px 근경안보다 절제하며 반동 없이 따라온다.
- **옅지만 알아볼 수 있는 원경:** 최대 품질에서는 원경만 1/2 해상도로 단순화, 활동면/근경은1배. 먼 곳은 기존 색·대비 차이와 큰 윤곽으로 표현한다. 선명한 잔디밭까지 함께 뭉개지 않는다.
- **모바일 제외:** 모바일 화면에는 계절 배경 자체가 없다. PC에서도 마우스/트랙패드 포인터가 없으면 시차는0, 자율 표류 없음.
- **감상 안에서만 움직임:** 감상 밖은 계절 풍경 전체를 정지 그림으로 유지한다. 동물·물결·입자 등 지속 장식 애니메이션도 정지한다. 월/날씨 등 상태가 바뀌면 정지 그림 한 번을 갱신하며 일정 조작은 정상 동작한다.
- **자동조절 기본:** PC가 바쁘면 장식량·효과 해상도·움직임을 줄이고, 그래도 무거우면 풍경을 정지한다. 여유가 돌아오면 천천히 복구. 사용자가 직접 고른 “항상 최대”·“가볍게”는 존중한다.
- 시점 유지, 봄 초원부터 확대, 심해 사계절 공통, 수평선 .26h로 통일. 최종 그림123장.

## 2. 실제 참고 이미지와 번역

아래 D는 `art-src/공통화풍참고/데이브 더 다이버/`, A는 `art-src/공통화풍참고/모여봐요 동물의 숲/1-핵심-환경분위기/`이다. **각 행의 그림을 실제로 열어 보았다.** 경로 약어는 파일 이름 변경 제안이 아니다.

| 실제 경로(D/A와 결합) | 관찰·가져오는 것 | 육지·해안 3/4 번역 | 바다·심해 직접 적용 / 제외 |
|---|---|---|---|
| D`207597_218580_5945.png` | 청록 수면, 밝은 먼 절벽, 양옆 덩어리와 가운데 여백 | 밝은 먼 능선·가장자리 숲·빈 중앙 활동면 | 바다의 수평 색 띠. **수면 위 캡처**이므로 심해 광선 근거라고 주장하지 않음. 보트·잠수부 제외 |
| D`images.jpg` | 보라/푸른 수면과 중앙 반사 길, 측면 절벽 | 중앙 여백과 명도 단계만; 회청·보랏빛으로 번역 | 수면 반사 리듬. 주황 일몰·괴수·캐릭터·문자 제외 |
| A`,jx.jpg` | 굽은 강둑, 3/4 나무 군집과 열린 면 | 숲 군집/계곡 곡선의 공간 질서 | 강둑 접촉 참고만. 원본 배치·분홍/빨간 장식 제외 |
| A`1.jpg` | 하늘–바다–해변의 넓은 수평 층 | 해안 시점 유지, 수평선 읽힘 | 먼바다 여백. 인물·UI 제외 |
| A`hf.jpg` | 젖은 모래·포말·바위의 맞닿음 | 해안 접촉과 발점 가림 | 물/돌 겹침만. 캐릭터 제외 |
| A`mj.jpg` | 푸른 밤, 달·야자수·파도 형체 | 밤에도 형체/발점 대비 유지 | 달·반사는 런타임. 날짜 문자 제외 |
| A`sfg.jpg` | 세로 구도의 해안 곡선과 포말 | 좁은 PC 크롭에서도 곡선/여백 유지(모바일은 미노출) | 파도 간격 참고. 구도 복제 제외 |
| A`ss.jpg` | 보라 밤과 작은 조명점 | 밤의 작은 밝은 점과 큰 어둠 덩어리 | 특정 다리·등·인물은 가져오지 않음 |
| A`vb.jpg` | 계절성 수관·바닥 군집 | 같은 실루엣의 계절 재질 차이 | 강한 주황·노랑과 과밀 소품 제외 |
| A`wer.jpg` | 넓은 물 면과 작은 파문 | 연못/해안 수면의 빈 면 유지 | 바다 수면 직접 참고. 수영 캐릭터 제외 |

| 실제 데이브 심해 스프라이트 경로(D와 결합) | 관찰과 반영 |
|---|---|
| `40e_xavcdCDpGV9S9t2YbcTipRK43Ikw8CIGFVXtcEK1vaZohAnMQGhf-SVYwTi-i8j5jZ_q1FiTVXkfCSyeCA.webp` | 연보라·회보라 한 덩어리 종형. 심해 생물 색을 전부 파랑으로 통일하지 않음 |
| `iVDLaLSeEzLx04Xw1M8SMfPLSM58fY2jzDmfwwuMVakLCVoZGeT-HJ0oNQwiO21L9OEZNUnpJwsaND8_qe9PCA.webp` | 어두운 올리브/갈색 몸과 작은 청록 발광점. 작은 강조점만 참고 |
| `Qbg7OIajkKYDbcE3Jcu1ppMa1T84QlFmT-HAD3iKOe9TJV0PEGkGy0oJI2xjhPoPNDbxwn2z9MCAriBNMH1hKLR4toNJ7fFbPhlDmDBwpw4fkH39z6aL6_fXYO2fxWfxJaAWlBLEJxFldXK2fCRw-A.webp` | 회청색 측면 몸통과 지느러미 덩어리. 고유 형태·잔도트 무늬를 복제하지 않음 |

데이브 감성의 적용 경계:

| 요소 | 육지/해안 3/4 | 먼바다 | 깊은 바다 측면 |
|---|---|---|---|
| 깊이 그라데이션·실루엣·색 온도 | 먼 면은 밝고 저채도, 가까운 지면은 선명. 같은 계열 어두운 외곽선 | 수평선–수면 거리로 번역 | y=수직 깊이, z=거리의 청록→회청→남색 |
| 안개 | 지면/물 경계와 발점 마스크에 적용 | 수평선 부근 위주 | 지상 안개 미적용, 자체 수중 감쇠 |
| 빛줄기 | 숲 틈의 절제된 런타임 빛만, 수중 광선처럼 만들지 않음 | 수중 caustics/광선 추가 금지 | 기존 `bakeShaft`/시간대별 수량 유지. 열린 참고는 광선 실증 자료가 아니므로 기존 심해 코드·규칙을 근거로 함 |
| 옆모습 한 덩어리 생물 | 적용 안 함: 기존 3/4 지상 생물 | 기존 수면/수중 그림자 규약 유지 | 측면 생물의 덩어리 읽힘만; 원본 생물 복제 금지 |

모든 생성물은 픽셀아트 한 어법, 장당 불투명 RGB 6–10색, AA 없음. 선명한 빨강·주황·노랑 금지. 조명 합성 후 화면 전체 색 수가 10색이라는 뜻은 아니다.

## 3. 레이어·좌표 계약

### 3.1 공통 대응과 수치 결정

지상 `hz = horizonY(h) = .26h`, `v=(y-hz)/(h-hz)`. 기존 .12/.30 표기는 현행 코드와 충돌하므로 구현 때 정리한다. 배경 이미지는 이미 투영된 3/4 그림으로, `GROUND_SQUASH=.7`을 이미지 전체에 다시 적용하지 않는다.

아래 α는 **배경 깊이 패스의 목표 혼합량**이며 바탕 실루엣의 불투명도를 낮추라는 뜻이 아니다. 맑음/짙은 안개 두 끝점을 Light 상태로 보간한다. 명도 수용 기준이 우선이며 산 전용 값은 아래 별도 적용한다.

| 기존 BIOME_GRAMMAR 공통 층 | 새 층 / 생성 | 주 영역 v | gfx2 최대 x/y, px | 상대 x계수 | 안개 α 맑음→안개 | 채도 배율 | 사전 굽기 해상도 |
|---|---|---|---|---|---|---|---|
| 하늘, y<hz | S 엔진 / 0장 | v<0 | 0/0 | 0 | 기존 sky 채널 | 기존 sky 채널 | 기존 하늘 캐시 |
| 원경 0–.20 | F 원경 실루엣 / 1장 | 0–.20, 하단 .08 겹침 | 3/0 | 3/16 | .20→.45 | .55 | 화면 backing의 1/2 |
| 중경 .20–.55 | M 지면 / 1장 | .12–1: 활동면까지 연장 | 8/2 | 1/2 | .06→.22 | .85 | 1 |
| 근경 .55–1 | N 근경 프레임 / 1장 | .55–1, 가장자리 비접촉 장식 | 16/4 | 1 | 0→.08 | 1 | 1 |

공통 층 구간은 **시각 구획**, M/N은 서로 배타적인 충돌 평면이 아니다. 근경의 보행 가능한 바닥도 M에 속하고 N은 그 앞의 프레임이다. F 하단을 M이 v=.12부터 덮어 .08 지면 높이만큼 겹친다. 불투명 점유부 사이에 투명 틈이 없어야 하며 최소 32px overscan + 상대 이동 여유를 검사한다. 단순 직선 절단면을 드러내지 않는다.

모든 배경 캐시 기준 크기는 `(w+64)×(h+64)`: 사방 32 CSS px. 원본 비율을 유지하고 확대 후 크롭한다. 논리 크기 384×256에서 정수 배율 k를 사용:
`k=ceil(max((w+64)/384,(hz+32)/(.26*256),(h-hz+32)/(.74*256)))`.
수평 가운데, 원본 기준 지평선 .26×256을 hz에 정렬한다. 추가 정수 픽셀 반올림까지 32px 여유 안에 들어야 한다. 좁은 PC 창의 중앙 안전 영역에도 바이옴 특징이 있어야 한다(모바일에는 렌더하지 않음). 필요한 가장자리 장식은 기존 절차적 요소가 유지한다. 원본을 비균등 늘려 생물/바위를 찌그러뜨리지 않는다.

F는 수직 이동 0으로 지평선을 잠근다. M의 지평선 인접 투명/가림 띠는 S/F를 침범하지 않는다. 물 경계와 활동면 마스크·생물·그림자·흔적·상호작용 좌표는 **같은 M 변환**을 공유한다. 히트 테스트에는 역변환을 쓴다. 움직이는 바닥 위에 생물을 화면 좌표로 고정하는 안은 금지한다.

### 3.2 바이옴별 예외

| 바이옴 | F / M / N 및 보존할 구조 |
|---|---|
| meadow | 먼 나무 실루엣 / 열린 잔디 활동면 / 낮은 가장자리 풀. 서 있는 나무와 꽃 군집 상호작용은 별도 객체 |
| forest | 먼 수관 / 중간 빈터 / 낮은 잎 프레임. 기존 30–40% 틈, 나무 y-sort 유지 |
| mountain | 아래 다섯 의미 층 유지. 절벽 표면을 새로운 보행 영역으로 해석하지 않음 |
| hill | v=.14/.38/.62 비평행 능선, 은빛 풀·완만한 보행/바람. 산의 암벽 구조와 구별 |
| pond | 먼 둑 / 기존 곡선 수면·둑 마스크에 끼우는 재질 / 가까운 낮은 수초. 물고기 그림자·부유물·결빙 개구부는 엔진 |
| valley | 먼 V자 벽 / 기존 굽은 개울/땅 분리 / 가장자리 식생. 물길·포말·생물 서식 마스크 동일 |
| tidal | 먼 육지 / 배수로와 갯벌 / 낮은 가장자리 진흙·풀. 조간대 눈 금지, 조수 경계 엔진 |
| sandy | 먼 해안 / 모래·기존 해안곡선 / 낮은 모래/풀. 파도 2 계열, 소나무는 객체 |
| rocky | 먼 암석 실루엣 / 암반·조수웅덩이 마스크 / 비접촉 가장자리 조각. 서 있는 큰 돌은 발점 정렬, 파도 3 계열 |
| sea | 수평선 중심 / 육지 없는 수면 / 매우 성긴 화면 가장자리 수면 재질. 파도 7 계열, 수중 caustics 없음 |
| deep | **하늘/지평선/바닥 없음**. F 먼 수중 색 띠, M 중간 물 덩어리, N 가까운 수중 프레임. y=깊이·z=거리 유지, 세 층은 z순; 지상 squash/depthScale/fog 미사용. 밝기·광선·발광은 기존 자체 시간 패스 |

산 5층을 PNG 3장으로 평탄화하지 않는다:

| MOUNTAIN_DEPTH_RULES | 대응 | 명도/안개 계약 |
|---|---|---|
| ⓪ 하늘 | S | 능선과 낮 L≥4, 밤 ≥6 |
| ① 먼 능선 | F | 불투명 실루엣, L80–84 / 채도 .35 / 안개 .45 |
| ② 산 본체 | M 내부 독립 마스크 | L68–74 / .60 / .25 |
| ③ 너덜 | M 내부 독립 마스크·기존 ridgeC | v=.34–.62, L56–64 / .85 / .08 |
| ④ 산기슭 | M 활동면 + N 비접촉 프레임 | v=.60–1, L44–56 / 1 / 0 |

②③④ 색/마스크 경계는 원본 규격과 bake metadata에 유지한다. 추가 생성 PNG는 없다. 인접 L≥8, 안개 속 능선 대비 ≥10, 겨울 반사율 예외는 기존 규칙대로 검사한다. 산 생물 v≥.34, 일반 ≥.18, 안개/새벽/밤 ≥.25 등 기존 발점 하한을 화면 변환 전 지면 좌표로 검사한다.

**지평선 통일 Q11 확정:** `sea.ts:bake`의 수면 top은 현재 `horizonY(h)+.06h=.32h`. 다른 지상/해안은 .26h. 소유자 승인에 따라 먼바다도 가시 수평선을 .26h로 맞추되 심해는 제외한다. 기존 먼바다 물 영역/파도 anchor도 같은 helper를 따르도록 구현하고 전후 비교한다.

### 3.3 객체·안개·팬 합성

P0에 선택적 레이어 어댑터와 공통 합성 함수(이하 **제안** `renderDepthScene`)를 만든다. 현행 Scene에 없는 인터페이스를 이미 있다고 가정하지 않는다.

정착 화면의 순서: S와 하늘 사건 → F와 원경 안개 → M의 물/땅/흔적/접촉 그림자 → 중경 깊이 안개 → 발점 y-sort 객체 및 N 가림 packet → 날씨 입자 → 최종 빛 패스. 객체 안개는 기존 `hazeAt`의 발점 기준으로 한 번만 적용한다. N의 가림 조각은 고정 화면 전체 덮개가 아니라 발점/마스크를 가진 packet으로 객체와 정렬한다. 생물을 가릴 수 있으나 중앙 활동/조작 영역을 지속적으로 막을 수 없다. 서 있는 나무·큰 돌·생물은 M 변환을 공유하며 이미지 N에 이중으로 존재하지 않는다.

현행 `scene-engine.ts:drawOnce`는 splitHaze일 때 `drawDepthHaze → drawAbove → particles`, 아닐 때 `particles → drawDepthHaze`, 마지막 `drawLightPass`다. 초원 가을만 먼저 splitHaze를 사용하고 다른 장면은 draw에 여러 층이 섞여 있다. 따라서 단순히 N drawImage 한 줄을 끼우지 않는다. 장면별 어댑터에서 기존 draw/drawAbove를 분리하고 새 합성 소유 여부를 **명시적 플래그**로 선언한다. 이관 전 장면은 기존 분기 그대로; 이관 후 엔진의 전역 haze/light를 중복 적용하지 않는다. `drawLightPass` 안 ground fog도 같은 소유 계약에 포함한다.

팬 중 현재 world는 splitHaze=false, fogFloor=NaN으로 묶는 경로가 있다. 새 어댑터에서는 출발/도착 **각 장면의 로컬 클립 안에서 완전한 합성**을 수행하고 바깥에서 다시 안개를 얹지 않는다. 수평은 화면 폭 이동, 수직은 기존 crossfade+22%h slide와 sweep, 620ms easeOutQuint 유지. 두 장면의 마스크/광원/봉인은 섞어 공유하지 않는다. 심해로 넘어갈 때 지상 날씨가 수중 장면에 유입되지 않아야 한다.

## 4. 포인터 식과 게이트

정규화 `p=(clamp(2x/w-1,-1,1), clamp(2y/h-1,-1,1))`. `offset_i = pixelRound(-a_i * pSmooth * panGain)`; a는 §3 표의 x/y별 최대치, pixelRound는 고정 DPR의 픽셀 경계 반올림이다. 원경3px, 활동면8px, 근경16px이 최대이며 y는0/2/4px. 폭1400px 미만 PC에서는 `s=min(1,w/1400)`을 곱하고 큰 화면에서도 상한을 늘리지 않는다. 이 값은 편안함이 보장되는 논문 수치가 아닌 설계 시작값이다.

spring 대신 시간상수 **τ=.12초 지수 수렴**. 입력이 바뀐 시점 (t0,p0,target)을 저장하고 `pSmooth(t)=target+(p0-target)*exp(-(t-t0)/τ)`. 벽시계/랜덤 사용 없음. 작은 잔여값은 정해진 .01px 기준에서 0/목표로 확정하여 정지한다. 수치 적분 횟수에 의존하지 않는 식으로 같은 입력 이력을 분할 advance해도 결과가 같아야 한다. 초기 pointer가 있으면 t=0의 시작값은 0으로 통일, pointer 없음은 처음부터 0.

- 모바일은 배경 자체 제외. 현재 CSS의 최소641px 게이트를 유지하며 모바일 레이아웃에서 새 asset fetch/decode/bake/RAF도 시작하지 않는다. 640/641px 경계와 실제 휴대폰 세로/가로를 검증한다. 가로 회전만으로 켜지는 경우 기존 모바일 레이아웃 판정과 일치시킨다. UA 문자열이나 coarse 포인터만으로 PC/모바일을 단정하지 않는다.
- PC의 포인터 없는 상태는 중앙0. 유효한 mouse pointermove(트랙패드 포함) 전에는 시차가 없다. 창 이탈은 τ로 중앙 복귀 후 정지; 터치만으로 시차를 시작하지 않는다. 생물 등 감상 애니메이션과 시차 입력은 별개이며 자율 시차 드리프트는 없다.
- reduced·생동감 OFF·감상 OFF: 즉시 offset 0, 잔류 spring 없음. 배경 시차 루프를 멈추고 정지 프레임을 그린다. 생동감 OFF는 배경 숨김이 아니라 정지이며, 계절 배경 OFF/gfx off·soft의 숨김과 구분한다.
- **Q8 확정:** 감상 OFF에서는 계절 풍경의 지속 움직임 전체 정지(시차·생물·구름·물결·날씨 입자·광선). 출입/월 변경·현재 시간/날씨 갱신·late-art는 이벤트 또는 기존 낮은 빈도의 상태 갱신으로 정지 프레임만 다시 그린다. 연속 RAF로 시간을 계속 진행하지 않는다. 이 결정은 앞선 “기존 생물/날씨 움직임 유지” 초안을 대체한다. 일정 편집/필수 조작 피드백까지 멈추는 뜻은 아니다.
- 620ms 팬 시작의 pSmooth를 두 장면에 동결하고 `panGain=1-easeOutQuint(clamp(elapsed/.62))`. 팬 중 새 포인터는 목표만 저장. 종료 시 offset0에서 τ로 최신 목표에 복귀. 월드 이동과 시차가 각자 카메라 위치를 바꾸지 않는다.
- 엔진 기존 `(clientX-rect.left)/zoomF`, `zoomF=rect.width/w` 경로 유지. 스크롤/줌/레이아웃 변경 때 rect를 갱신하고 좌표를 재투영한다. 좌표 갱신을 이미지 재굽기와 연결하지 않는다. DPR은 mount 중 고정 규약 유지.
- viewer도 실제 감상 진입 때만 기본 활성. 역할 preview는 권한을 바꾸지 않는다. 일정 제목/비공개 필드를 배경 seed·metadata로 보내지 않는다.

| gfx | 실제 배경 drawImage 층(S 제외) | x/y 최대 | 저해상 단계 | 정지/캐시 정책 |
|---|---|---|---|---|
| 2·여력충분 | F,M,N = 3 | 3/0, 8/2, 16/4 | 1/2,1,1 | 활성+팬 인접 장면만 bake |
| 1 또는 auto 절약 | F, M+N 합본 = 2 | 1/0, 4/1 | 1/4,1/2 | N도 합본과 같은 이동; 별도 근경 시차 없음 |
| 0 | 기존 효과 OFF에서는 0 | 0 | 없음 | 배경 캐시 해제. QA/명시적 정지 미리보기만 1장 1/4 합본 가능 |
| auto 여력부족 / reduced / 감상 OFF | 정지 합본 1장 | 0 | 최대1/2, 필요시1/4 | 입력 변화로 재굽지 않음; 기존 OFF/soft 숨김은0장 |

여기서 “흐림”은 **낮은 해상도로 미리 단순화한 형태**다. 최대 품질에서는 원경에만 적용한다. 캐시 해상도 비율은 미술적 흐림 강도와 같지 않으며 실제 실루엣·픽셀 무늬를 보고 판정한다. Gaussian blur가 아니며 배경에는 nearest 샘플링과 픽셀 계단을 유지한다. `ctx.filter`, CSS filter, 매 프레임 리샘플/재굽기 금지. 기존 저해상 안개 효과의 부드러운 합성은 아트 AA 계약과 구분한다.

## 5. 상태 축 유지 매트릭스

경로 약어: E=`components/shared/ambient/`, W=E+`world/`, C=E+`scenes/`. 함수는 현재 구현 기준; 새 함수는 명시적으로 “제안”으로 구분한다.

| 축 | 레이어/패스 반응과 보존 | 현재 담당 파일:함수/구조 |
|---|---|---|
| 계절 | 보고 있는 KST 달로 F/M/N 슬롯 선택, 절차적 재질·생물 계절 그대로. 심해 Q10 | E`registry.ts:seasonOfMonth,pickAmbient`; C`biome-loaders.ts:BIOME_LOADERS` |
| 시간 여섯 띠 | F/M/N 깊이 가중치로 sky/ground/shadow/saturation/visibility/reflection 채널 적용. 날짜별 태양 연속 보간, clear noon 중립 | W`light.ts:lightOf,lightAt,lerpLight,shadowKey`; W`view.ts:drawLightPass`; C`deep.ts:draw` 자체 시간 |
| 날씨 | 기존 입자/바람/수면·지면 반응. PNG에 비/눈 구름을 고정하지 않음. 심해 봉인 유지 | W`particles.ts:createParticles,windDirOf`; E`scene-engine.ts:stepScene,drawOnce`; C`winter.ts:ownsWeather` |
| 안개 | F/M/N 목표 계수, 기존 발점/산·골짜기·연못 바닥 마스크. 중복 haze/groundFog 제거 | W`fog.ts:bakeFogField,drawFogField`; W`view.ts:hazeAt,drawDepthHaze,drawLightPass`; C`land.ts:fogFloor,fogFloorKey` |
| 생물·스폰 | 기존 seed 호출 순서/정원/희귀도 유지, y-sort 및 z-sort 유지; pointer는 표시/상호작용 좌표만 변환 | C 각 `create*/step/draw`; W`rarity.ts:SpawnDirector`(연결된 장면만), W`codex.ts` 정의. 모든 장면이 감독을 쓴다고 단정하지 않음 |
| 달의 흔적 | 선택 달/seed 생성, M과 동일 변환. 새로운 영구 수집 DB 없음 | W`traces.ts:monthTraces`; C`spring/autumn/winter/summer.ts:draw` |
| 하늘 사건 | S 고정, 태양·달·별·구름은 기존 시간/seed; 산 능선 가림·개수 정규화 유지 | W`sky.ts:bakeSky,bakeClouds,drawSky,drawSkyLive` |
| 카메라 팬 | 620ms·기존 graph/input/lazy ensure 유지, §3.3/4 합성·시차 감쇠 | W`world-scene.ts:createWorld,begin,draw,step` |
| 도감 | 기존 도감 정의/만남 조건·감상 상태 보존. 이미지에 생물을 굽고 “발견” 처리하지 않음 | W`codex.ts`; E`showcase.tsx` 로컬 방문/도감 연결부(구현 전에 소비 경로 추가 확인) |
| 감상 | 진입 때 장식 애니메이션/시차 활성, 밖에서는 전체 풍경 정지. 종료·pinned fixture·meadow 복귀 유지 | W`world-scene.ts:step`; E`scene-engine.ts:sync`; E`showcase.tsx` |
| 시청자 | 공개 장면만, 기본 감상 안에서 시차. DTO/서버 로더·권한 변경 없음 | E`scene-engine.ts` 입력/게이트; `lib/ui/motion.ts` 설정. 비공개 로더 사용 안 함 |
| gfx 0/1/2 | 기존 설정/기기 판정 유지 + §7.1 공통 여력으로 장식 전반 감소/정지/복구. auto 기본, 수동 선택 보존 | `lib/ui/gfx.ts`; E`scene-engine.ts:readQuality` |
| reduced | 즉시 0 시차, 정지 render와 늦은 artVersion 재그리기 보존 | `lib/ui/motion.ts`; E`scene-engine.ts` reduced/advance/late-art 경로 |

현재 fog 캐시는 f/rgb가 키에 포함되어 연속 상태 변화에서 재굽힐 수 있다. 새 배경은 포인터·매 프레임 light 값을 bake 키로 삼지 않는다. 지형/깊이 마스크를 크기·품질·바이옴·계절·artVersion으로 한 번 굽고 light의 색/α로 합성한다. 기존 안개 리팩터링은 이 어댑터가 쓰는 경로에 한정하며 성능 계측으로 확인한다. sky의 기존 런타임 캐시는 “시간대별 생성 이미지”가 아니다.

## 6. 아트 계약과 이행

### 6.1 새 자리/규격

manifest에 새 범주 `backdrop`. 슬롯마다 `biome, season, layer, styleEnv`와 **제안** discriminated `geometry.kind="backdrop"`를 둔다. 기존 ArtSlot·ArtView의 객체 의미와 SOURCE_EDGE=1024 기본값은 보존하고 geometry 해석 helper로만 분기한다.

- 원본: **1536×1024 PNG**, 논리 격자 **384×256**, 픽셀 블록 4×4.
- 정리본: **768×512 PNG**, 정수 1/2 nearest 축소, 블록 2×2. 다른 종횡비/비정수 크기는 반려.
- 각 장 불투명 RGB 6–10색, alpha=0/255만. 점유 실루엣은 불투명. 빈 하늘/레이어 밖은 투명. 심해의 전면 물 색면만 `alphaMode=opaque` 명시 허용 후보.
- 동일 좌표 원점·지평선 anchor·crop bounds. **alphaBox trim/recenter 금지**. 그림자·시간대·비·눈발·안개·생물·게임 문자 없음. 계절 적설/초목 재질은 허용하되 현행 생태 규칙 준수.
- 계절 짝은 같은 바이옴의 **동일 layer끼리** 실루엣/anchor 비교. far↔ground처럼 다른 깊이끼리 IoU 비교하지 않는다. 수관/식생 계절 변화 허용 영역을 마스크로 기록하고 산/강둑 기준점은 고정.
- `ART_FAMILIES`에 바이옴별 12자리 묶음과 layer별 4계절 짝 metadata를 명시한다. 현재 `pairedVariants`의 단일 가족 비교를 그대로 켜지 않는다. id가 계절로 끝나는 자동 묶음에 의존하지 않는다.
- 공개 파일은 `public/ambient/art/<slot-id>.png`, variant 없음. 전체 목록은 부록 A. 기존 파일과 충돌하면 승격 중단; 덮어쓰기 금지.

**Q6로 승인된 규격 예외:** ART-06의 원본1024 정사각/trim 정규화, ART-13의 정사각 객체 격자를 backdrop 직사각 전용으로 좁혀 확장한다. ART-13의 6–10색·계열 외곽선·AA 없음은 면제하지 않는다. ART-02의 단일 객체/배경 없음도 이 범주에서만 여러 깊이 면으로 예외를 정의한다. 규칙 문서 개정은 구현 커밋에 포함한다.

### 6.2 변경 예정 파이프라인 지점

| 지점 | 필요한 변경(이번에는 미실행) |
|---|---|
| `art/manifest.ts` | category/geometry/styleEnv/family 추가. dotGrid/targetEdge/sourceRatio·batchPrompt/slotPrompt/styleSpec를 geometry별로 분기. 기존 객체 prompt와 정규화 출력 동일성 유지 |
| `scripts/lib/ambient-art-normalize.mjs` | backdrop에만 직사각 exact size·블록·무trim·alphaMode 검사. 자동 색 보정/구도 수리 없음 |
| `scripts/ambient-art-check.mjs` | backdrop 6–10색·binary alpha·동일 원점·빈틈/가림/계절 짝 검사. 기존 ≤128색 검사만 통과하고 화풍 합격으로 취급하지 않음. 객체 fill/IoU 기준과 분리 |
| `scripts/lib/ambient-art-entities.mjs`, `ambient-art-manifest.mjs` | 명시적 family 및 layer별 seasonPairs 전달, 세 슬롯 preview와 12슬롯 최종 승인 묶음 구분 |
| `art-src/폴더명.json` | category `backdrop→배경층`, 11 엔티티 한글 매핑: 초원/숲/산/언덕/연못/계곡/갯벌/모래해안/암석해안/먼바다/깊은바다 |
| `art-src/공통화풍참고/분류어휘.json`, `scripts/lib/ambient-style-library.mjs` | 새 범주 subjects/env 연결. 현재 entityWants의 codex 생물 기반 env만으로는 부족하므로 slot.styleEnv를 읽음. backdrop 전용 mood 선택은 Dave1+동숲1, 최대2; 기존 엔티티 선택 순서 불변 |
| 카탈로그 생성기 | 새로운 한글 경로·규격·슬롯/리뷰 상태를 생성. 생성 카탈로그 손수 편집 금지 |
| `art/load.ts` | backdrop 전용 full-frame 로드·검증, alphaBox fit 경로와 분리. lazy decode/LRU·artVersion 연동, 누락은 절차적 대체 |
| 아트 보드/검토 | 개발자/소유자 검토 화면에 전체 합성+각 층+계절짝 제공. 내부 raw/spec/리뷰정보를 공개 manifest/DTO에 싣지 않음 |

현재 자동 style 선택은 게임별 1장 보장을 하지 않는다. 분류어휘 추가만으로 Dave mood가 반드시 붙는다고 주장하지 않는다. backdrop profile의 안정적인 mood 우선순위/환경 매핑을 구현·검사한 뒤 request에서 실제 첨부 경로와 해시를 동결한다. 기본 mood2, depiction≤3, form≤1(같은 그룹 depiction 없을 때만), 총≤6 규약 유지. 게임 이미지 원본은 이름·바이트·위치 그대로 둔다. 첨부용 고정입력 사본만 파이프라인이 만든다.

### 6.3 초원 봄 request 예시 — 아직 없는 CLI 옵션은 제안

한 번의 요청에 `backdrop-meadow-spring-far/ground/frame` 세 자리. 후보 run:
`art-src/배경층/초원/작업회차/20260910-봄-깊이층-시안01/`.
현재 도구에 subset preview 계약이 없으므로 **구현 예정 인터페이스**를 다음처럼 정의한다. 지금 실행 가능한 명령으로 제시하는 것이 아니다.

```text
npm run art:pipeline -- request backdrop-meadow
  --run 20260910-봄-깊이층-시안01
  --files backdrop-meadow-spring-far.png,backdrop-meadow-spring-ground.png,backdrop-meadow-spring-frame.png
  --preview-only
```

요청 핵심: “초원 봄, 고정 3/4, 공통 anchor .26, 1536×1024/384×256, 6–10 회청·청록·연두 계열, AA 없음. far=밝은 먼 실루엣, ground=중앙 빈 잔디와 투명 하늘, frame=비접촉 가장자리 낮은 풀. 같은 원점, 생물/큰 나무/광원/날씨 없음. 화풍만 참고, 고유 구성 복제 금지.”

`style:pick`의 **새 backdrop profile에서 검증할 기대 mood**: D`207597_218580_5945.png` + A`,jx.jpg`. 현행 picker가 이미 이렇게 출력한다는 뜻은 아니다. request에는 선택 이유·상대경로·sha256·고정입력 사본·참고 시트를 남긴다.

순서: request 동결 → 생성 원본3 → normalize → 자동 검사·3층 합성 → **소유자 화풍 검토**. 이 부분 시안은 promote 금지. 합격 방향을 반영한 **새 12자리 전체 계절 request/run**에서 최종 원본/정리본을 마련하고 계절 짝 전체 검토 후 promote한다. 봄 후보를 재사용한다면 원본 run/file/hash를 새 요청의 고정입력에 명시하고 동일 바이트임을 검사한다. 기존 run에 9장을 덧붙이지 않는다. 123은 최종 슬롯 수이며 재시도/시안 산출물 수가 아니다.

누락 로드는 슬롯별 procedural fallback, 실패 상태도 버전 키에 기록하여 무한 재요청하지 않는다. artVersion 증가 때 해당 레이어만 한 번 재굽고 reduced의 dt=0 정지 프레임도 갱신한다. 시차/팬 프레임마다 파일을 디코드하지 않는다.

## 7. 성능 예산과 측정

아래는 **계산 예산, 실측 아님**. 기준 1400×860, overscan 포함1464×924, DPR 상한1.5로 배경 bake. 기존 엔진 DPR 자체는 바꾸지 않고 이 신규 캐시만 등급별 scale 적용한다. RGBA 4byte, MiB=2^20.

| gfx2 층 | backing 크기 | 캐시 메모리 약 | 추가 steady draw 호출 / 예산 |
|---|---|---|---|
| F, 1/2 | 1098×693 | 2.90 MiB | 1 / .20ms |
| M, 1 | 2196×1386 | 11.61 MiB | 1 / .45ms |
| N, 1 | 2196×1386 | 11.61 MiB | 1 / .55ms |
| 합 | 3장 | **26.13 MiB/장면** | 3 / **1.20ms 평균 이내** |

| 등급 | 정상/팬 배경 캐시 예산 | decode·부가 마스크 포함 신규 총예산 | 프레임 게이트 |
|---|---|---|---|
| 2·여력충분 | ≤27 / ≤54 MiB | ≤80 MiB, 팬 양쪽만 동시 상주 | 60fps 목표, frame 평균≤16.7ms·p95≤21ms·34ms 초과 비율 기존 대비 악화≤1%p |
| 1 또는 auto 절약 | F+합본 약3.63 /7.26 MiB | ≤20 MiB | 60fps 우선, 필요시30fps 일정 간격. 끊기는60보다 안정된30 선택 |
| auto 정지 | 합본≤2.90 MiB, 극저여력1/4면≤.73 | ≤8 MiB | 연속 장식RAF0. 전체 시스템 사용률0을 보장한다는 뜻은 아님 |
| gfx0/OFF·모바일 | 0 | 신규 배경 자산0 | 배경 fetch/decode/bake/RAF0 |

F/M을 이전 초안보다 선명하게 보존하면서 정상/팬 캐시 예산이 늘었다. 이 증가는 의도적이며 자동 절약에서는 원래의 가벼운2층 예산으로 내려간다. “항상 최대”도 무제한 크기/DPR을 뜻하지 않으며 위 상한을 지킨다.

정리본 한 장 decode는 768×512×4=1.5MiB. 활성/다음 장면 6장=9MiB, 123장 모두 decode하면184.5MiB이므로 **전량 preload 금지**. 늦게 온 fetch/디코드가 퇴출 장면을 되살리지 않도록 세대 키를 둔다. 계절 교체·팬 종료 시 이전 참조와 canvas를 해제한다. 기존 sky/생물 canvas 메모리는 위 “신규” 예산 밖이므로 전체 peak도 before와 함께 측정한다. 광원 보간용 별도 full-size 사본을 무제한 더 만들지 않는다.

효과 합성/마스크 포함 신규 전체 평균≤2.5ms·p95≤3ms를 시작 수용 기준으로 둔다. 대형 화면은 픽셀 수에 비례하는 사전 상한과 등급 강등을 적용해 총예산을 넘지 않는다. 수치는 하드웨어 독립 보장이 아니며 P0 실측 후 초과하면 층 해상도/캐시를 줄여 다시 검증한다.

측정 계획:
1. `scripts/ambient-qa/` 고정 fixture 프로덕션 서버 사용, `VISUAL_TEST_FIXTURE=1`, 기본3100. 실제 Supabase/analytics 없이 stub만. seed42, 고정 KST 날짜·size·load.
2. **제안** `scripts/ambient-qa/depth-perf.mjs`: gfx별 실제 RAF 30초 idle/포인터/반복팬, warmup 분리, headful GPU 및 CPU4× throttle 각각. 평균/p95/max/34ms초과, drawImage 수·bake 횟수·live canvas/decode bytes·nav10회 후 잔류를 기록.
3. 기존 `.scratch-pw/perf-frames.mjs`는 구 epoch·3111 루트·구 gfx 레코드가 있어 그대로 돌린 결과를 본 변경 검증으로 쓰지 않는다. fixture 전용 새 측정 경로에서 현행 gfx version을 사용.
4. 동일 빌드/브라우저/GPU/크기에서 before/after, 캐시 cold/warm 구분. pointer만 움직일 때 bake=0. resize/artVersion/season/품질 변경 때만 필요한 bake. 팬 draw 증가도 함께 보고.
5. 감상 밖/숨김/reduced에서는 연속 장식 루프0, late-art dt0 갱신 완료. AMB-27 EVAL90 기존 판정도 유지.


### 7.1 자동조절 — 모든 고비용 장식이 같은 여력 판단을 사용

**현재 있는 것:** `lib/ui/gfx.ts:gfxPref`는 미설정이면 이미 auto. `gfxMode/probeGfx`는 수동 max/lite 우선·software/코어≤2 soft·나쁜 방문2회 뒤 lite를 적용한다. `scene-engine.ts:loadBand/tick/applyLoad`에는 90프레임마다 늦은 프레임/평균으로 load를 내리고 천천히 올리는 조절기가 있다. 현재 max는 load1, lite는.3 고정이다. 새 조절기를 별도로 달지 않고 이 경로를 확장한다.

**관측 한계:** 브라우저는 PC 전체의 남은 CPU/GPU를 정확한 퍼센트로 알려주지 않는다. 실제 화면 지연·장면 draw/step 시간·관리 중인 canvas/decoded 자산 크기로 “현재 이 배경을 더 그려도 되는가”를 추정한다. Compute Pressure는 CPU 상태 힌트만 제공하고 지원도 달라 필수 의존성으로 채택하지 않는다(R9). GPU 잔량/OBS 실행 여부를 읽는다고 주장하지 않으며 프로세스 검색·외부 성능 서비스·공개 analytics 전송도 추가하지 않는다.

| 설정 | 사용자에게 보이는 동작 | 적용 |
|---|---|---|
| 자동조절(기본) | 한가하면 선명하고 자연스럽게, 바빠지면 단순/적은 움직임, 계속 무거우면 정지 | 아래 공통 정책. 새 기기/미설정은auto, 기존 명시적 선택 덮지 않음 |
| 항상 최대 | 정의된 최대 품질/장식량 유지 | 자동 부하 강등 안 함. 모바일 제외·감상 밖 정지·reduced·OFF·숨김·정해진 메모리 상한은 유지 |
| 가볍게 | 처음부터 장식이 적고 시차가 작음 | 기존 lite/load.3을 상한으로 사용. 지속 과부하일 때 정지 허용; “가볍게”보다 무겁게 자동 승급하지 않음 |
| 기존 off/soft | 기존 숨김 정책 | 설정 선택지를 없애거나 복원하지 않음 |

**소유자 위임에 따른 확장:** 이전 load 바닥이 장식 움직임을 항상 남기던 제한은 시차/고비용 장식에 한해 완전정지를 허용한다. lite의 정적 load.3도 고비용 장식 정지 상한에는 예외를 둔다. AMB-09/10/27 관련 설명을 구현 시 동기화하되 “나쁜 방문 두 번 뒤 저장 등급 강등”은 그대로 둔다. 순간 부하를 기기 영구 등급에 쓰지 않는다.

정책 시작값(논문 수치가 아닌 구현·실측 튜닝값):
1. 기존 EVAL90/늦음34ms·mean21ms/회복18.5ms 기준을 출발점으로 유지. 숨김/초기 로드·resize·의도적30fps skip은 과부하 표본에서 제외한다. raw RAF 간격은 skip 전에 관측하여 자체30fps를 고장으로 오인하지 않는다. draw/step 비용도 별도 기록.
2. auto의 load<.45가 유효한2구간 지속하면 절약, load<.20 및 나쁜 표본이2구간 지속하면 정지. 반대 방향은 load>.60의 좋은 표본이5구간 + 최소10초 안정 뒤에만 한 단계 복구한다. lite는 load.3 고정이므로 별도 부하 신호에서 나쁜2구간이면 정지, 복귀 시험의 좋은5구간이면 lite로만 복귀한다(load>.60을 요구하지 않음). 품질 bake는 전환당1회, hysteresis로 왕복 재굽기 방지.
3. 정지하면 load 자체가 더 이상 갱신되지 않으므로 **복귀 경로를 별도 명시**한다. 감상 진입/다시 포커스/실제 사용자 입력 때 또는 감상·가시 상태에서30초 cooldown 후, 최대90 raw RAF의 제한된 저비용 시험만 수행한다. 통과 시 절약부터 재개; 실패 시 다시 정지. 숨김/모바일/reduced/감상 밖에서는 시험 자체0. 시험을 뺀 정지 상태는 연속RAF0.
4. 성능 전환 시 현재 생물을 갑자기 지우거나 spawn RNG를 다시 돌리지 않는다. 장식 입자 상한/표현량은 점진 조절, 생물 정의·희귀도·도감 자격은 그대로다. 정지 중에는 생물 시뮬레이션을 얼리고 재개 때 경과시간만큼 순간이동시키지 않는다. 달력/실제 KST 상태는 낮은 빈도로 별도 갱신.
5. 단지 이동 폭만0으로 만들고 원래 full draw를 계속하면 절감이 아니다. 각 소비 경로의 draw/step/bake 호출 수와 실제 프레임 비용이 감소해야 완료다. 동작에 필요한 핵심 일정 UI·입력·저장·서버 권한 처리는 품질 조절 대상이 아니다.

| 고비용 기능 | 충분 → 절약 → 정지 |
|---|---|
| 시차/배경 | 3층3/8/16px → 2층1/4px → 합본·0시차 |
| 풀/수관 흔들림·낙엽·눈/비 입자 | 전체 장식량 → 기존 load 기반 감소·낮은 갱신 빈도 → 정지 표현 |
| 구름/별/하늘 사건·심해 광선 | 기존 표현 → 작은 장식 수/갱신빈도 감소 → 현재 시간대 정지 컷; 사건 중복생성 금지 |
| 물결/반사·glint/foam | 현재 바이옴 특징 유지 → 보조 효과 샘플/중복 패스 감소 → 곡선/수면이 읽히는 정지 컷 |
| 안개/조명 | 기존 상태 채널 → 낮은 해상도 mask·낮은 빈도 갱신 → 상태 변경 때만 합성 |
| 생물 | 기존 생태/스폰 의미 → 불필요한 장식/그리기 비용 우선 절약 → 위치/상태 정지, 재개 때 부드럽게 계속 |
| 카메라 이동 | 기존620ms 유지 → 같은620ms에 낮은 비용 합성 → reduced만 기존 즉시 이동. 자동 정지 상태의 요청 이동은 제한된620ms 동작 뒤 다시 정지 |

산5층·물 경계·앞뒤 가림·날씨 식별 같은 필수 공간 정보는 절약에서도 남긴다. 현재 코드에 남은 “filter 유지” 주석 등은 현행 토큰 팔레트 규칙으로 정정하고 filter를 복원하지 않는다.

## 8. 검증 설계

### 8.1 결정적 fixture

현재 page는 biome/season/band/weather/seed/t/load/pointer/날짜/camera를 받고 BiomeFixture는 gfx max를 강제한다. **gfx/reduced QA 파라미터와 설정 주입은 P0 구현 대상**이며 현재 URL에서 이미 동작한다고 쓰지 않는다. 설정은 첫 warmup 전에 적용한다.

기준 1400×860, seed42, 고정 year/month/day, load1, camera=showcase, t=1000. 실제 URL은 `pointer=700,430&y=2026&m=4&day=15` 형식이다. 계절별 대표 월 spring=4/summer=7/autumn=10/winter=1을 고정하고, band=noon/weather=clear부터 시작한다. 세 점 **(0,0), (700,430), (1400,860)** ×11×4=**132프레임/빌드/viewport**. before+after264. 추가 PC1024×768에서 (0,0),(512,384),(1024,768) 동일132. 모바일360×800은 풍경 캡처가 아니라 미노출·배경 network/decode/bake/RAF0 검사다. 640/641px·실제 휴대폰 가로 회전·키보드만 있는 PC를 별도 확인한다. 추가로 pointer 없음/창밖/나머지 두 모서리, scroll/zoom 및 터치 후 마우스 전환을 대표 조합에서 확인한다. 고정 포인터는 생물 반응에도 영향을 주므로 배경만 같다고 전체hash를 비교하지 않는다.

항등 계약:
- 동일 빌드·입력·준비 상태에서 `advance(1000)`, `advance(250)` 네 번, URL `t=1000`의 픽셀·offset·spawn 상태 동일.
- 처음 로드부터 ready/asset settled 후 같은 3회 dt0 warmup과 엔진 step 계약 사용. 포인터 입력 이력도 동일, τ 보간 시작 시점 동일. late-art 타이밍을 캡처시점 차이로 숨기지 않음.
- camera=plain/showcase는 Q8에 따라 시간 진행 의미가 달라진다. 공통 정지 snapshot(t=0,동일상태,pointer없음)만 항등으로 유지하고, plain에서는 wall-clock 대기/advance에도 장식 위치가 바뀌지 않는 정지 계약을 검사한다. 시간 항등3종은 showcase에서 검증한다. 생물/날씨가 계속 움직이던 옛 plain/showcase 시간별 전체항등은 이 소유자 결정으로 대체한다.
- 심해 6시간띠×5날씨 30장의 현행 검사는 각 시간띠 안 날씨별 동일 hash, 총6개 시간 상태를 유지. 확정 Q10에 따라 계절만 바꿔도 같은 심해 배경이어야 한다.
- 11×4×6×허용날씨 전수는 자동 지표. 기존 `metrics.mjs`는 미구현이므로 P0에 필요한 지표를 실제 만들고 결과 없으면 PASS로 표기하지 않는다.

### 8.2 A/B/C와 전후 시트

**구현 단계**에서 VISUAL_QA_PROTOCOL의 세 독립 읽기 전용 검사 에이전트를 같은 before 빌드·시트로 병렬 실행한다. 이번 계획 작성에는 구현 QA를 수행했다고 표기하지 않는다.

| 담당 | 라운드 초점 |
|---|---|
| A art/mood | 데이브 감성의 3/4 번역, 팔레트/AA, 원경 저채도·근경 선명, 44계절 짝, 산 L단차, 좁은 PC 여백·모바일 미노출 |
| B spatial/ecology | 지평선/발점, M 역변환, 나무/돌/생물 y-sort와 N 가림, 산5층, pond/valley 해안곡선·심해 z |
| C motion | τ와 advance 항등, pointer 이탈,620ms팬·zoom, reduced/OFF, late art, fog/sky/날씨 순서·성능 |

각 ≤12개 문제, 다른 보고를 보지 않고 먼저 제출. 메인은 중복 병합 후 **P0 전부 + 귀속 가능한 입구 묶음≤4**만 한 라운드에서 수정한다. 고정 대표16 시나리오를 유지하고 pointer 3점 시트를 추가한다. seed7은 P0/P1 재현과 다양성 확인에 추가. 0/250/500/1000/2000/4000ms temporal과15–30초 움직임도 검토한다.

보고 원형:
```text
[Issue] <한 문장>
[Biome / Season / TimeOfDay / Weather / Seed / Camera] <값>
[Category] <IMMERSION_BREAK_RULES 코드>
[Severity: P0 / P1 / P2 / P3] <하나>
[Why it breaks immersion] <조항·시트·좌표·크롭; pointer와 gfx도 기재>
[Suggested Fix] <파일·함수>
[Acceptance Criteria] <측정 가능 조건>
[Confidence] <높음/중간/낮음 + 이유>
```
블록 뒤 요약3줄, 기존 round 문서 형식대로 입력/통합표/선택/수정/검증/결과/백로그 기록.

현재 QA CLI의 selftest → capture --round NN --phase before/after --kinds static,temporal,band,weather → sheet → diff --compare before,after를 사용한다. 새 pointer/gfx 매트릭스는 runner 확장 후 목록과 URL을 저장한다. 서로 다른 빌드의 변경 대상은 의도된 diff를 평가하고, 변경 밖 정적 요소는 기존2% 규칙으로 검사한다. 같은 빌드 항등과 before/after 시각 변화는 다른 검사다.

회귀 수용 목록:
- 공중 보행0, 산/안개별 v하한·물/땅 서식 경계 유지, 발그림자 떨어짐0.
- 산5층 불투명/L단차, 평원처럼 보이는 산0, 깊은 바다 지상fog/바닥/squash0.
- y-sort 뒤집힘0, 근경에 가려 히트 좌표가 어긋나는 경우0, 가을 splitHaze·drawAbove 이중안개0.
- 구름 수 `(SC/3)^2` 정규화 유지, 넓은 화면9배 폭증0; 하늘 사건 중복 spawn0.
- 해안/연못 곡선·조수와 이미지 접촉, 파도/물반사/겨울 개구부 유지. 먼바다 caustics0.
- 기상 최소3반응 채널·시간대 최소2채널, 밤 암흑 덩어리·전역 푸른 tint로 붕괴0.
- overscan 검은틈/투명틈0, 팬 수평/수직620ms·기존 이동 그래프·pinned fixture/종료 복귀 유지.
- 랜덤 소비 순서 변동0, 기존 생물/희귀 한도·달흔적·도감 의미 유지.
- late-art 정지화면 갱신, gfx강등·ambient dim·reduced/OFF, 모바일 미노출·PC 포인터없음/줌/DPR 계약 유지.
- 공개 경로에 raw/owner review/비공개 일정/운영정보 노출0. 실제 DB 테스트·analytics 발생0.

## 9. 구현 단계·커밋·게이트·롤백

**설계 조건은 승인됐다. 모든 구현 단계는 별도 구현 지시 후.** 신규 승인 질문은 실제 충돌/아트 최종 검토에 한정하고 이미 승인된 일반 구현을 반복 확인하지 않는다. 아래 공통 게이트는 제품 변경 각 단계 종료에 모두 실행한다:

`npx tsc --noEmit` · `npm run lint` · `npm run test` · `npm run build` · `npm run harness:verify` · `npm run art:catalog -- --all --check` · `npm run style:check` · 해당 A/B/C 비주얼 라운드. 아트 미생성 단계도 catalog/style 무변경 검사를 한다. 실패/미실행은 구분 기록한다.

| 단계 | 커밋 단위와 구체적 산출물 | 게이트/승인 | 되돌리기 지점 |
|---|---|---|---|
| P0 | (a) fixture·좌표/τ·품질·합성 계약과 결정성 검사, (b) 기존 절차적 draw/bake를 F/M/N 어댑터로 장면군별 분리, (c) §7.1 공통 자동조절·감상 밖 정지·모바일 로드 차단, (d) 캐시/성능·QA·관련 문서. **이미지0** | 공통 게이트,3점44조합,대표16+A/B/C, 원래그림/생태 유지. 포인터/팬/수평선·감상 밖 정지·자동조절 변경 범위를 명시 | 장면별 어댑터/성능 정책 opt-in을 분리해 원래 procedural 경로까지 복귀. 사용자 변경 보존하며 해당 커밋만 revert |
| P1 | (a) backdrop manifest/직사각 normalize/check/한국어 폴더/style routing 계약, (b) 초원 봄3 시안 새 run, (c) 소유자 화풍 반영 후4계절12장 묶음 검토·승격·loader 연결 | §10 확정 결정 반영, 소유자 실제 후보 검토. 봄3 시안 단독 promote 금지. 공통 게이트+계절짝/alpha/합성/포인터 | 승격 연결/slot 선택만 revert→초원 procedural. 후보/합격 파일 덮기·삭제 없이 증거 보존 |
| P2 | 남은10바이옴: 숲·언덕 / 산·계곡 / 연못·해안3 / 먼바다·심해 순 묶음. 바이옴별 계약/새 run·검토/승격/QA를 구분 커밋. 확정111장 | 공통 게이트와 각 생태/가림·공통 여력 소비 검증. 산 L기준·심해 봉인/시간 검사. 각 아트 묶음 소유자 검토 후 promote | 바이옴 단위 asset 연결만 해제. 이미 승인된 다른 바이옴 유지 |
| P3 | 겹침/명도/해상도/캐시 조정·문서 최종화. 이 단계에서 §7.1 밖의 생물/설정 개편 금지 | 전수 지표+44×3×PC2크기+모바일 미노출+대표16+성능/모드·공개경계 최종. 공통 게이트 | 조정 커밋별 revert, 필요하면 P0 procedural 어댑터 또는 원래 렌더까지 복귀 |

실제 배포는 별도 push 지시 후만. main push가 배포라는 사실을 “계획 커밋”과 혼동하지 않는다.

## 10. 소유자 확정 결정과 연구 위임 결과

2026-09-10 답변을 반영했다. 같은 결정을 다시 승인 요청하지 않는다. 1/2/5의 숫자는 위임된 설계 판단이며 파일럿에서 근거 없이 더 강하게/더 흐리게 만들지 않는다.

| 번호 | 확정 내용 |
|---|---|
| 1 | 연구 위임→이미지3층+기존 하늘. 2층은 절약,4–5개 생성층은 불필요한 비용으로 채택하지 않음(부록E 비교) |
| 2 | 연구 위임→x3/8/16px·y0/2/4px,τ=.12초·반동0. 좁은 PC는 비례 축소,무한 드리프트0 |
| 3 | 모바일 계절 배경 자체 제외. PC 마우스/트랙패드 포인터 없으면 시차0 |
| 4 | 육지·해안3/4,심해측면 유지 |
| 5 | 연구 위임→최대 품질 원경1/2·지면/근경1배,원경의 세부/채도만 낮춤. 강한 blur/AA 없음 |
| 6 | 직사각 규격과 배경 범주 예외 승인.1536×1024→768×512,색6–10·binary alpha·무trim. 전체123장 |
| 7 | 봄 초원3장부터 소유자 화풍 검토→초원4계절12장→나머지 확대 |
| 8 | 감상모드에서만 계절 풍경 움직임. 감상 밖 정지,기본 일정 기능 정상 |
| 9 | 자동조절 기본,항상 최대/가볍게 수동 선택 존중. 고비용 장식 전체 공통 여력 조절,감소→정지→점진 복구 |
| 10 | 심해 계절 봉인 유지. 공통3장·시간 반응/날씨 봉인 그대로 |
| 11 | 먼바다 포함 지평선 .26h 통일. 심해는 지평선 없음 |

새로 필요한 사용자 결정은 없다. 남은 일은 별도 구현 지시 후 P0와 봄 초원 파일럿의 실제 동작/화풍 검증이다. 자동조절 한계·연구 전이 한계는 부록E에 기록했다.

## 부록 A. 전체 슬롯 목록

각 셀은 **정확한 slot id**이며 공개 파일명은 그 문자열에 `.png`를 붙인 것. 파일경로는 `public/ambient/art/` 아래다. 각 행의 세 셀은 순서대로 far/ground/frame이며 바이옴·계절을 모두 명시한다. 계절40행+심해공통1행=41행×3=123. 이것이 새 슬롯 전부이며 sky/time/weather 슬롯은 없다.

| 바이옴 | 계절 | far id → 파일명 | ground id → 파일명 | frame id → 파일명 |
|---|---|---|---|---|
| meadow | spring | `backdrop-meadow-spring-far` → `backdrop-meadow-spring-far.png` | `backdrop-meadow-spring-ground` → `backdrop-meadow-spring-ground.png` | `backdrop-meadow-spring-frame` → `backdrop-meadow-spring-frame.png` |
| meadow | summer | `backdrop-meadow-summer-far` → `backdrop-meadow-summer-far.png` | `backdrop-meadow-summer-ground` → `backdrop-meadow-summer-ground.png` | `backdrop-meadow-summer-frame` → `backdrop-meadow-summer-frame.png` |
| meadow | autumn | `backdrop-meadow-autumn-far` → `backdrop-meadow-autumn-far.png` | `backdrop-meadow-autumn-ground` → `backdrop-meadow-autumn-ground.png` | `backdrop-meadow-autumn-frame` → `backdrop-meadow-autumn-frame.png` |
| meadow | winter | `backdrop-meadow-winter-far` → `backdrop-meadow-winter-far.png` | `backdrop-meadow-winter-ground` → `backdrop-meadow-winter-ground.png` | `backdrop-meadow-winter-frame` → `backdrop-meadow-winter-frame.png` |
| forest | spring | `backdrop-forest-spring-far` → `backdrop-forest-spring-far.png` | `backdrop-forest-spring-ground` → `backdrop-forest-spring-ground.png` | `backdrop-forest-spring-frame` → `backdrop-forest-spring-frame.png` |
| forest | summer | `backdrop-forest-summer-far` → `backdrop-forest-summer-far.png` | `backdrop-forest-summer-ground` → `backdrop-forest-summer-ground.png` | `backdrop-forest-summer-frame` → `backdrop-forest-summer-frame.png` |
| forest | autumn | `backdrop-forest-autumn-far` → `backdrop-forest-autumn-far.png` | `backdrop-forest-autumn-ground` → `backdrop-forest-autumn-ground.png` | `backdrop-forest-autumn-frame` → `backdrop-forest-autumn-frame.png` |
| forest | winter | `backdrop-forest-winter-far` → `backdrop-forest-winter-far.png` | `backdrop-forest-winter-ground` → `backdrop-forest-winter-ground.png` | `backdrop-forest-winter-frame` → `backdrop-forest-winter-frame.png` |
| mountain | spring | `backdrop-mountain-spring-far` → `backdrop-mountain-spring-far.png` | `backdrop-mountain-spring-ground` → `backdrop-mountain-spring-ground.png` | `backdrop-mountain-spring-frame` → `backdrop-mountain-spring-frame.png` |
| mountain | summer | `backdrop-mountain-summer-far` → `backdrop-mountain-summer-far.png` | `backdrop-mountain-summer-ground` → `backdrop-mountain-summer-ground.png` | `backdrop-mountain-summer-frame` → `backdrop-mountain-summer-frame.png` |
| mountain | autumn | `backdrop-mountain-autumn-far` → `backdrop-mountain-autumn-far.png` | `backdrop-mountain-autumn-ground` → `backdrop-mountain-autumn-ground.png` | `backdrop-mountain-autumn-frame` → `backdrop-mountain-autumn-frame.png` |
| mountain | winter | `backdrop-mountain-winter-far` → `backdrop-mountain-winter-far.png` | `backdrop-mountain-winter-ground` → `backdrop-mountain-winter-ground.png` | `backdrop-mountain-winter-frame` → `backdrop-mountain-winter-frame.png` |
| hill | spring | `backdrop-hill-spring-far` → `backdrop-hill-spring-far.png` | `backdrop-hill-spring-ground` → `backdrop-hill-spring-ground.png` | `backdrop-hill-spring-frame` → `backdrop-hill-spring-frame.png` |
| hill | summer | `backdrop-hill-summer-far` → `backdrop-hill-summer-far.png` | `backdrop-hill-summer-ground` → `backdrop-hill-summer-ground.png` | `backdrop-hill-summer-frame` → `backdrop-hill-summer-frame.png` |
| hill | autumn | `backdrop-hill-autumn-far` → `backdrop-hill-autumn-far.png` | `backdrop-hill-autumn-ground` → `backdrop-hill-autumn-ground.png` | `backdrop-hill-autumn-frame` → `backdrop-hill-autumn-frame.png` |
| hill | winter | `backdrop-hill-winter-far` → `backdrop-hill-winter-far.png` | `backdrop-hill-winter-ground` → `backdrop-hill-winter-ground.png` | `backdrop-hill-winter-frame` → `backdrop-hill-winter-frame.png` |
| pond | spring | `backdrop-pond-spring-far` → `backdrop-pond-spring-far.png` | `backdrop-pond-spring-ground` → `backdrop-pond-spring-ground.png` | `backdrop-pond-spring-frame` → `backdrop-pond-spring-frame.png` |
| pond | summer | `backdrop-pond-summer-far` → `backdrop-pond-summer-far.png` | `backdrop-pond-summer-ground` → `backdrop-pond-summer-ground.png` | `backdrop-pond-summer-frame` → `backdrop-pond-summer-frame.png` |
| pond | autumn | `backdrop-pond-autumn-far` → `backdrop-pond-autumn-far.png` | `backdrop-pond-autumn-ground` → `backdrop-pond-autumn-ground.png` | `backdrop-pond-autumn-frame` → `backdrop-pond-autumn-frame.png` |
| pond | winter | `backdrop-pond-winter-far` → `backdrop-pond-winter-far.png` | `backdrop-pond-winter-ground` → `backdrop-pond-winter-ground.png` | `backdrop-pond-winter-frame` → `backdrop-pond-winter-frame.png` |
| valley | spring | `backdrop-valley-spring-far` → `backdrop-valley-spring-far.png` | `backdrop-valley-spring-ground` → `backdrop-valley-spring-ground.png` | `backdrop-valley-spring-frame` → `backdrop-valley-spring-frame.png` |
| valley | summer | `backdrop-valley-summer-far` → `backdrop-valley-summer-far.png` | `backdrop-valley-summer-ground` → `backdrop-valley-summer-ground.png` | `backdrop-valley-summer-frame` → `backdrop-valley-summer-frame.png` |
| valley | autumn | `backdrop-valley-autumn-far` → `backdrop-valley-autumn-far.png` | `backdrop-valley-autumn-ground` → `backdrop-valley-autumn-ground.png` | `backdrop-valley-autumn-frame` → `backdrop-valley-autumn-frame.png` |
| valley | winter | `backdrop-valley-winter-far` → `backdrop-valley-winter-far.png` | `backdrop-valley-winter-ground` → `backdrop-valley-winter-ground.png` | `backdrop-valley-winter-frame` → `backdrop-valley-winter-frame.png` |
| tidal | spring | `backdrop-tidal-spring-far` → `backdrop-tidal-spring-far.png` | `backdrop-tidal-spring-ground` → `backdrop-tidal-spring-ground.png` | `backdrop-tidal-spring-frame` → `backdrop-tidal-spring-frame.png` |
| tidal | summer | `backdrop-tidal-summer-far` → `backdrop-tidal-summer-far.png` | `backdrop-tidal-summer-ground` → `backdrop-tidal-summer-ground.png` | `backdrop-tidal-summer-frame` → `backdrop-tidal-summer-frame.png` |
| tidal | autumn | `backdrop-tidal-autumn-far` → `backdrop-tidal-autumn-far.png` | `backdrop-tidal-autumn-ground` → `backdrop-tidal-autumn-ground.png` | `backdrop-tidal-autumn-frame` → `backdrop-tidal-autumn-frame.png` |
| tidal | winter | `backdrop-tidal-winter-far` → `backdrop-tidal-winter-far.png` | `backdrop-tidal-winter-ground` → `backdrop-tidal-winter-ground.png` | `backdrop-tidal-winter-frame` → `backdrop-tidal-winter-frame.png` |
| sandy | spring | `backdrop-sandy-spring-far` → `backdrop-sandy-spring-far.png` | `backdrop-sandy-spring-ground` → `backdrop-sandy-spring-ground.png` | `backdrop-sandy-spring-frame` → `backdrop-sandy-spring-frame.png` |
| sandy | summer | `backdrop-sandy-summer-far` → `backdrop-sandy-summer-far.png` | `backdrop-sandy-summer-ground` → `backdrop-sandy-summer-ground.png` | `backdrop-sandy-summer-frame` → `backdrop-sandy-summer-frame.png` |
| sandy | autumn | `backdrop-sandy-autumn-far` → `backdrop-sandy-autumn-far.png` | `backdrop-sandy-autumn-ground` → `backdrop-sandy-autumn-ground.png` | `backdrop-sandy-autumn-frame` → `backdrop-sandy-autumn-frame.png` |
| sandy | winter | `backdrop-sandy-winter-far` → `backdrop-sandy-winter-far.png` | `backdrop-sandy-winter-ground` → `backdrop-sandy-winter-ground.png` | `backdrop-sandy-winter-frame` → `backdrop-sandy-winter-frame.png` |
| rocky | spring | `backdrop-rocky-spring-far` → `backdrop-rocky-spring-far.png` | `backdrop-rocky-spring-ground` → `backdrop-rocky-spring-ground.png` | `backdrop-rocky-spring-frame` → `backdrop-rocky-spring-frame.png` |
| rocky | summer | `backdrop-rocky-summer-far` → `backdrop-rocky-summer-far.png` | `backdrop-rocky-summer-ground` → `backdrop-rocky-summer-ground.png` | `backdrop-rocky-summer-frame` → `backdrop-rocky-summer-frame.png` |
| rocky | autumn | `backdrop-rocky-autumn-far` → `backdrop-rocky-autumn-far.png` | `backdrop-rocky-autumn-ground` → `backdrop-rocky-autumn-ground.png` | `backdrop-rocky-autumn-frame` → `backdrop-rocky-autumn-frame.png` |
| rocky | winter | `backdrop-rocky-winter-far` → `backdrop-rocky-winter-far.png` | `backdrop-rocky-winter-ground` → `backdrop-rocky-winter-ground.png` | `backdrop-rocky-winter-frame` → `backdrop-rocky-winter-frame.png` |
| sea | spring | `backdrop-sea-spring-far` → `backdrop-sea-spring-far.png` | `backdrop-sea-spring-ground` → `backdrop-sea-spring-ground.png` | `backdrop-sea-spring-frame` → `backdrop-sea-spring-frame.png` |
| sea | summer | `backdrop-sea-summer-far` → `backdrop-sea-summer-far.png` | `backdrop-sea-summer-ground` → `backdrop-sea-summer-ground.png` | `backdrop-sea-summer-frame` → `backdrop-sea-summer-frame.png` |
| sea | autumn | `backdrop-sea-autumn-far` → `backdrop-sea-autumn-far.png` | `backdrop-sea-autumn-ground` → `backdrop-sea-autumn-ground.png` | `backdrop-sea-autumn-frame` → `backdrop-sea-autumn-frame.png` |
| sea | winter | `backdrop-sea-winter-far` → `backdrop-sea-winter-far.png` | `backdrop-sea-winter-ground` → `backdrop-sea-winter-ground.png` | `backdrop-sea-winter-frame` → `backdrop-sea-winter-frame.png` |
| deep | common | `backdrop-deep-common-far` → `backdrop-deep-common-far.png` | `backdrop-deep-common-ground` → `backdrop-deep-common-ground.png` | `backdrop-deep-common-frame` → `backdrop-deep-common-frame.png` |

확정 Q10에 따라 심해는 season=common 세 슬롯만 둔다. 계절별12슬롯은 만들지 않는다. 테스트는 사계절 입력에서 심해 배경이 동일함을 확인하도록 기존44조합을 유지한다.

## 부록 B. 구현 때 개정할 조항과 ADR 초안

지금 규칙/ADR 파일은 수정하지 않는다. 구현 단계의 새 ADR 번호는 당시 결정 색인에서 배정한다.

- BIOME_GRAMMAR 공통 층 표·공통 지평선의 .12/.30 혼재를 §3의 현행 .26 및 이미지/의미층 대응으로 대체. 바이옴별 생태·발점 하한은 보존. 확정 Q11의 먼바다 통일·심해 무지평선 명시.
- VISUAL_DIRECTION 지평선 .30 관련 문장을 실제 helper와 통일; 3/4·픽셀·팔레트는 대체하지 않음.
- ADR-0017 ⑮의 아트1024 정사각·단일 객체 부분은 backdrop 예외만 추가; ⑯ 카메라 지평선 값은 현행 .26으로 명확화; ⑰6의 과거 haze 수치는 현행 HAZE_ALPHA=.13/끝점ground-v=.28과 새 층별 소유 관계로 정리. ⑰8의 불투명 원경·⑰11의 수직 이동·⑱17의 객체 가독성 취지는 유지.
- 심해 후속 봉인 조항은 Q10 확정으로 계절 예외 없이 유지한다. BIOME_LOADERS의 “시간 무영향” 주석만 실제 deep:draw 시간 반응에 맞춰 구현 때 정정한다.
- ENGINE_RULES AMB-09/10/13/25/29에는 레이어 캐시·정지·분할advance·감상별 pointer 항등 범위를 추가. AMB-03/04/05/06/16/17의 생태·시간·시점 계약을 이미지로 우회하지 않음.
- ART_RULES ART-02/06/13, ART_PIPELINE, manifest와 검사기에는 승인된 직사각/무trim/계절짝/preview-only 계약을 함께 넣는다. ART-11/14 및 ADR-0020/0021의 불변원본·실제 owner review는 유지.
- SYSTEM_MAP에는 현행 scene-engine의 splitHaze/최종Light 순서와 새 어댑터/팬 로컬 합성을 새 현재 구조로 기록. 과거 진단의 생물 파일 경로/개수·미구현 지표를 현행 사실로 재사용하지 않음.

ADR 초안: “배경 깊이는 S 엔진+F/M/N 데이터 자산으로 표현한다. 카메라·충돌 지형·생물·시간/날씨는 엔진 소유. 이미지 규격은 backdrop 전용 분기, 기존 객체 출력은 불변. 시차는 로컬 포인터와 시뮬레이션 시간의 결정적 함수이며 최대 이동/캐시 예산과 정지 게이트를 가진다. 각 장면이 합성 소유권을 명시하여 haze/light 중복을 막는다. 누락 자산은 절차적 대체, 승격은 소유자 검토와 계절 짝 검증 후. Q8/Q10/Q11 확정 결과와 §7.1 자동조절 확장을 명문화한다.”
대안: 전경 전체를 하나의 이미지로 flatten하면 y-sort/접촉 파괴, 시간·날씨별 생성은 장수/상태 폭증, 런타임 blur는 성능 회귀이므로 채택하지 않는다.

## 부록 C. 읽은 파일과 반영 한 줄

문서와 필수 규칙은 읽고 반영했다. 코드는 요청대로 **구조·관련 함수 위주**이며 모든 줄을 정밀 감사했다는 뜻이 아니다. 색인은 선택 항목을 파싱했고 실제 연 그림13장은 §2에 전부 기재했다. 파일명 검색만 한 경로는 완독으로 표기하지 않는다.

| 읽은 파일 | 읽은 범위 | 계획에 반영한 것 |
|---|---|---|
| `AGENTS.md` | 전체 | 권한/공개 경계·KST·문서만 변경·경로 지정 커밋·사용자 작업 보존. |
| `docs/agent/CURRENT_STATE.md` | 전체 | 현재 진행/검토 후보와 과거 기록을 구분, 기존 소나무 승인 작업에 개입하지 않음. |
| `docs/ambient/README.md` | 전체 | 주제 문서 라우팅과 구현 시 독립 A/B/C 검수 절차. |
| `docs/ambient/VISUAL_DIRECTION.md` | 전체 | 3/4·귀여운 여백·가독성, 오래된 지평선 수치 개정 대상을 명시. |
| `docs/ambient/BIOME_GRAMMAR.md` | 전체·11절 | 공통 v층/생태·11바이옴별 물·땅·능선·발점 예외를 §3에 대응. |
| `docs/ambient/SEASON_TIME_WEATHER_GRAMMAR.md` | 전체 | 보고 있는 달과 시간/날씨 런타임 반응을 PNG 축에서 분리. |
| `docs/ambient/MOUNTAIN_DEPTH_RULES.md` | 전체 | 산5층·불투명 실루엣·L/채도/안개·생물 너덜 하한. |
| `docs/ambient/IMMERSION_BREAK_RULES.md` | 전체 | 공중 보행·가림·안개·층 대비·팬 이음 회귀를 수용 기준화. |
| `docs/ambient/ENGINE_RULES.md` | 전체 | 현행 .26/.7/.6,620ms,정지/late-art,심해 봉인과 시간,결정성 보존. |
| `docs/ambient/SYSTEM_MAP.md` | 전체 | 장면/엔진 접점 확인; 과거 진단/경로는 실제 코드와 대조. |
| `docs/ambient/VISUAL_QA_PROTOCOL.md` | 전체 | 정확한 보고 블록·독립3보고·대표16·입구묶음≤4·항등 범위. |
| `scripts/ambient-qa/README.md` | 전체 | fixture 서버·capture/sheet/diff 경로, 미구현 metrics와 smoke 한계. |
| `docs/agent/plans/PLAN-20260904-004-biome-world.md` | 전체 | 승인된 3/4·11화면·기존 카메라/도감 의도를 유지. |
| `docs/agent/decisions/ADR-0016-metal-water-design-language.md` | 전체 | 금수 팔레트·수면 용기감 유지, 옛 루트 필터 복구 안 함. |
| `docs/agent/decisions/ADR-0017-ambient-season-registry.md` | 전체 | 아트/카메라/가림 후속 결정 및 대체 조항을 부록B에 구분. |
| `docs/agent/decisions/ADR-0019-codex-three-books.md` | 전체 | 자체 픽셀 생물·도감 정의, 측면 적용은 심해 한정. |
| `docs/agent/decisions/ADR-0020-bounded-memory-and-art-review.md` | 전체 | 동결 run과 실제 후보별 소유자 검토; 기존 파일 덮기 금지. |
| `docs/agent/decisions/ADR-0021-style-reference-auto-attach.md` | 전체 | mood/depiction/form 첨부 상한·고정입력·참고 원본 불변. |
| `art-src/AGENTS.md` | 전체 | 한국어 경로·raw/정리본/hash/review·승격 조건. |
| `docs/ambient/ART_PIPELINE.md` | 전체 | request→원본→normalize→검토→promote, 생성 카탈로그/check 규약. |
| `docs/ambient/ART_RULES.md` | 전체 | ART-02/06/13 예외를 질문으로,6–10색/AA·복제 금지는 유지. |
| `art-src/공통화풍참고/README.md` | 전체 | 참고 라이브러리 사용 경계와 원본 보존. |
| `art-src/공통화풍참고/목록.md` | 전체 | Dave mood2·동숲 mood8 및 색인 규모를 근거로 실제 이미지 선택. |
| `art-src/공통화풍참고/데이브 더 다이버/공통화풍원칙.md` | 전체 | 깊이/색 온도/덩어리만 번역하고 시점·잔도트 복제 배제. |
| `art-src/공통화풍참고/모여봐요 동물의 숲/공통화풍원칙.md` | 전체 | 3/4 여백/군집/환경 접촉을 참고,3D 스타일 그대로 수입 안 함. |
| `art-src/공통화풍참고/데이브 더 다이버/색인.json` | mood/deep-sea 항목 파싱 | mood2와 심해 스프라이트3의 실제 경로·역할 확인. |
| `art-src/공통화풍참고/모여봐요 동물의 숲/색인.json` | mood 항목 파싱 | mood8 실제 파일을 열어 공간/색/제외 요소 기록. |
| `art-src/공통화풍참고/분류어휘.json` | 관련 env/category/group | backdrop styleEnv 연결을 계획, 기존 색인 원본 수정 안 함. |
| `art-src/폴더명.json` | category/entity 매핑부 | 배경층·11바이옴 한국어 매핑 확장 위치. |
| `components/shared/ambient/art/manifest.ts` | ArtSlot/규격/prompt/family 함수 | 1024square 가정과 객체 prompt를 geometry 분기로 보존·확장. |
| `components/shared/ambient/scene-engine.ts` | Frame/Scene·입력·품질·draw/step/advance/resize/sync | 새 시차 시간/좌표 게이트와 splitHaze/Light 소유 순서를 설계. |
| `components/shared/ambient/world/view.ts` | 상수·투영·haze·light 관련 구조 | 현행 지평선/깊이·발점 안개·최종 fog 중복 방지. |
| `components/shared/ambient/world/light.ts` | Light 타입·시간/보간 함수 구조 | 새 독립 시간·날씨 roll 대신 기존 Light 소비. |
| `components/shared/ambient/world/fog.ts` | 전체 | 저해상1/8/바닥 키 및 연속 f키 재굽기 위험을 분리. |
| `components/shared/ambient/world/sky.ts` | bake/draw/live·캐시/구름 관련 구조 | skyArtVersion·구름 정규화·사건 결정성과 원경 가림 유지. |
| `components/shared/ambient/world/world-scene.ts` | 전체 | lazy scene·620ms·수평/수직팬·전환 splitHaze 경로 보존/개선. |
| `components/shared/ambient/scenes/biome-loaders.ts` | 전체 | 11×4 라우팅·초원 여름 변주·심해 season 미전달 충돌. |
| `components/shared/ambient/scenes/spring.ts` | create/bake/draw/step 구조 | 열린 활동면·잔디/생물/흔적을 별도 합성으로 이관. |
| `components/shared/ambient/scenes/autumn.ts` | create/bake/draw/drawAbove 구조 | 기존 splitHaze·낙엽/나무/다람쥐 y-sort 유지. |
| `components/shared/ambient/scenes/winter.ts` | create/bake/draw/step 구조 | ownsWeather·발자국·겨울 활동면/late-art 유지. |
| `components/shared/ambient/scenes/land.ts` | bake/draw·산/언덕/골짜기·fogFloor 구조 | 산5층/ridgeC·골짜기 물길·능선 마스크를 이미지와 함께 유지. |
| `components/shared/ambient/scenes/coast.ts` | bake/draw·조수/바위 구조 | .26 수면·조수/포말/바위 앞뒤 순서와 해안종 차이. |
| `components/shared/ambient/scenes/summer.ts` | pond bake/draw·ensureLo 구조 | 곡선 수면/둑·부유물 발점·load별 저해상 최적화 보존. |
| `components/shared/ambient/scenes/sea.ts` | bake/draw 구조 | .32 수면 시작 충돌·파도7·육지/caustics 없음. |
| `components/shared/ambient/scenes/deep.ts` | bake/bakeShaft/draw/step 구조 | 시간별 광선/상부밝기/발광과 z정렬,계절/날씨 봉인. |
| `components/shared/ambient/scenes/water.ts` | 팔레트/bake/파도/beam 함수 구조 | 물 조명/파도는 런타임 캐시, 생성 배경에 굽지 않음. |
| `components/shared/ambient/scenes/util.ts` | rng/makeCanvas/그림자 등 구조 | 랜덤 소비/캐시/접촉 그림자 보존. |
| `lib/ui/gfx.ts` | 품질 판정·설정·강등 구조 | 기존 auto/max/lite/off·2회 나쁜 방문·software 판정 재사용. |
| `lib/ui/motion.ts` | 전체 | reduced·ambient on/dim/off·기본OFF/정지 경계 유지. |
| `app/visual-fixture/biome/page.tsx` | 전체 | 실제 pointer=x,y·y/m/day·camera·force/freeze 파라미터. |
| `components/shared/ambient/biome-fixture.tsx` | 전체 | gfx max 강제와 ready→advance 순서; 새 gfx QA 주입 필요. |
| `components/shared/ambient/registry.ts` | 계절 선택/등록부 | KST 보고 있는 달 기준,특수일/생태 축 추가 안 함. |
| `components/shared/ambient/world/traces.ts` | 타입/월 생성 함수 | monthTraces 결정성과 M 좌표 결합. |
| `components/shared/ambient/world/codex.ts` | 정의 타입/초반 구조 | 도감 단일 정의와 배경 자산의 비생물 구분. |
| `components/shared/ambient/world/rarity.ts` | SpawnDirector/eligible/roll 구조 | 기존 희귀 한도·seed/자격 유지, 전장면 연결 단정 안 함. |
| `components/shared/ambient/world/particles.ts` | API/step/draw 구조 | 기존 날씨·풍향 소비 및 합성 순서. |
| `components/shared/ambient/showcase.tsx` | 로컬방문/도감 관련 검색부 | 현재 로컬 상태만 근거로 삼고 새 발견 DB를 발명하지 않음. |
| `components/shared/ambient/art/load.ts` | alphaBox/bake/cache/ArtSet 구조 | 현재 trim fit과 새 backdrop full-frame 경로 분리. |
| `scripts/lib/ambient-style-library.mjs` | entityWants/후보점수/선택 함수 | 생물 env만으로 부족한 슬롯 metadata·mood게임별 선택 확장. |
| `scripts/lib/ambient-art-normalize.mjs` | 전체 | 1024square·alpha·trim·정수 축소를 backdrop에서만 예외. |
| `scripts/ambient-art-check.mjs` | 검사 본체/가족 검사 | 현재≤128색/fill/IoU를 backdrop 합격 기준과 분리. |
| `scripts/lib/ambient-art-entities.mjs` | 전체 | 명시적12슬롯 family 및 같은 layer 계절짝 설계. |
| `scripts/lib/ambient-art-manifest.mjs` | 전체 | manifest bridge/family 전달 접점, 새 metadata 경로. |
| `scripts/agent-harness/verify-harness.mjs` | 검사 실행 구조 | 문서 링크·ADR·예산·카탈로그 읽기 전용 검증 경로. |
| `.scratch-pw/perf-frames.mjs` | 전체 | 구 epoch/포트/gfx 가정으로 현재 성능 PASS 주장하지 않음. |
| `package.json` | scripts/의존성 | 문서/제품 게이트 명령 존재 확인,의존성 수정 없음. |
| `components/AGENTS.md` | 전체 | 클라이언트 UI/공유 컴포넌트 범위와 공개 경계. |
| `app/AGENTS.md` | 전체 | fixture 접근 게이트·서버 라우트 경계. |
| `lib/AGENTS.md` | 전체 | 공유 설정/서버 전용 책임 유지. |
| `docs/README.md` | 전체 | 문서 라우팅과 현재/역사 기록 구분. |
| `docs/agent/PROJECT_MAP.md` | 전체 | 렌더/아트/검증 관련 목적지 찾기. |
| `docs/agent/DEFINITION_OF_DONE.md` | 전체 | 이번 문서 게이트와 향후 제품 전체 게이트 구분. |
| `docs/ux/UI_RULES.md` | UI/모션 관련 절 | viewer 가독성·감상/정지·모바일·기존 설정 의미 유지. |
| `docs/agent/plans/ACTIVE_PLAN.md` | 전체 | 기존 진행 행 보존하고 Proposed 행 하나만 추가. |
| `components/shared/ambient/ambient-layer.tsx` | 전체 | 현행 모바일 최소641px 게이트·공유 장면 진입 확인. |
| `app/ambient.css` | 계절 배경/감상 버튼 게이트·모션 관련 절 | 모바일 미노출·감상 밖 정지의 현재 CSS 접점 확인. |
| `.agents/skills/caveman/SKILL.md` | 전체 | 짧게 설명하되 기술 근거/충돌은 생략하지 않음. |
| `.agents/skills/caveman-commit/SKILL.md` | 전체 | 정상 Conventional Commit 제목, 경로 지정 커밋은 사용자 지시에 따름. |

요청 원문 `C:/Users/im917/.codex/attachments/a45b84d1-73b3-4af7-a69a-b84dd0749675/pasted-text.txt`도 읽었다. 이 파일에서 문서2개 한정·132장 설계·소유자 결정 질문·커밋/푸시 범위를 반영했다.

## 부록 D. 이번 문서 작업 검증

- 코드 변경 **0**, 이미지 생성 **0**, 아트/공통화풍참고 원본 변경 **0**.
- `npm run harness:verify` 통과: 문서78개, 링크·ADR 상태·활성 계획 수명주기·메모리 예산 확인.
- `npm run style:check` 통과: 출처2개·그림449장 색인 일치. `node scripts/ambient-art-catalog.mjs --all --check` 통과: slots207/files419, changes/conflicts 없음(npm 전달 인자와 별개로 직접 명령도 확인).
- 연구 반영 후 검증: 목록41행·고유 파일123개, 최대 품질 배경 캐시26.1239MiB/장면 재계산. `npm run harness:verify`와 `git diff --check` 통과. 화풍/카탈로그는 이번 연구 수정에서 변경하지 않았고 최초 검사 결과는 위에 구분해 기록했다.
- 제품 typecheck/lint/test/build/렌더 검증은 이번 문서 변경에서는 미실행; 향후 구현 게이트로만 기재했다. 성능 수치는 실측이 아닌 제안 예산이다.
- 작업 시작부터 있던 untracked `.vscode/`, `preview-360.png`는 사용자 작업으로 보존한다. 이번 계획 작업의 산출물/커밋에 포함하지 않는다.

## 부록 E. 연구·벤치마킹 근거와 결정의 한계

조사일: **2026-09-10 KST**. 검색 결과의 크롤링 날짜를 논문 발행일로 사용하지 않았다. 아래는 직접 읽을 수 있었던 연구 초록/본문과 공식 제품·표준 문서다. Wallpaper Engine/Lively를 설치해 실측한 것은 아니며 **공식 동작 문서 비교**다. 기존 소유자 게임 캡처13장의 시각 검토는 §2와 별개로 유지한다.

### E.1 출처별 확인과 적용

| 근거 | 실제 확인한 내용 | 이 계획에 적용 / 전이 한계 |
|---|---|---|
| R1 · IJsselsteijn 외(2008), [A room with a cue](https://research.tue.nl/en/publications/a-room-with-a-cue-the-efficacy-of-movement-parallax-occlusion-and/) · Presence17(3),269–282,DOI10.1162/pres.17.3.269 | 연구기관의 논문 초록: 사진같은 가상 창에서 movement parallax/blur/occlusion의 주효과,시차 효과크기가 가장 큼. 나머지는 상호작용에 영향받음 | 깊이감은 시차·가림·선명도 관계를 함께 설계. **픽셀아트나 마우스 배경에서3층/16px가 최적이라는 결과는 아님.** 표본/원문 통계는 확보하지 않아 추가 수치 주장 안 함 |
| R2 · Jobling 외(1997), [Motion parallax: effects of blur, contrast, and field size in normal and low vision](https://legge.dl8.umn.edu/sites/legge.psych.umn.edu/files/files/media/jobling97_motion_parallax-_effects_of_blur_contrast_and_field_size_in_normal_and_low_vision.pdf) · Perception26,1529–1538 | 대학 연구실 PDF 초록·도입·방법: 정상시력18/저시력10,실물 원통 깊이 판별,머리를 좌우로 움직이는 조건. 시차의 유용성은 관측되나 개인차 있음 | 서로 다른 깊이의 상대 이동을 분명하게 유지. 시각 약화를 “더 흐리게 하면 좋다”는 근거로 오독하지 않음. **머리 이동 실험→마우스 조작은 간접 전이**,이 수치로 UI 편안함 보장 안 함 |
| R3 · [Wallpaper Engine—Parallax](https://docs.wallpaperengine.io/en/scene/parallax/introduction.html) · 공식 제품 문서 | 레이어별 강도/지연/축 제한,개별층 시차0,이동 시 바깥 경계가 드러나지 않도록 여유 이미지 필요 | 원경y0·하늘고정·사방32px·층별 이동계수. 문서의2층 예시는 사용법이며2층 최적성 실험이 아님 |
| R4 · [Wallpaper Engine—Performance](https://help.wallpaperengine.io/en/performance/game.html) · 공식 지원 문서 | 다른 게임 실행 때 기본 pause,필요하면 메모리 해제,앱별 규칙 지원 | 배경은 본 작업 성능을 양보. 웹에서는 OS 프로세스/다른 창을 볼 수 없으므로 그대로 복제하지 않고 페이지 가시성·자체 지연으로 판단 |
| R5 · [Lively—Performance](https://github.com/rocksdanister/lively/wiki/Performance) · 개발자 문서 | 웹 배경 비용은 설계/갱신/FPS에 달림. 다른 앱/가려짐에 따라 정지. CPU/GPU 퍼센트는 클럭 상태 때문에 오해 가능 | 여러 효과가 한 성능 정책을 공유하고 보이지 않을 때 멈춤. native 창 감지나 전체 자원 “0%”를 브라우저 기능/보장으로 옮기지 않음 |
| R6 · [Apple HIG—Motion](https://developer.apple.com/design/human-interface-guidelines/motion) · 공식 설계 지침 | 목적 있는 절제된 움직임,선택 가능·간결한 피드백. 게임의 일관된30–60fps 고려. visionOS에는 주변부/대형 움직임과 고정 기준점 주의 | 마우스 움직임에만 작게 반응,수평선 고정·반동/드리프트0. visionOS 설명을 PC 실험 결과로 둔갑시키지 않고 보수적 설계 원칙으로만 참고 |
| R7 · [W3C—Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) · WCAG2.2의2.3.3 해설(AAA) | 비필수 상호작용 애니메이션을 끌 수 있어야 함. parallax를 예로 들고 reduced 설정 활용 설명 | 기존 생동감/reduced가 시차·장식보다 우선. 작은px이면 누구에게나 안전하다는 보장 대신 정지 가능성을 유지. 사이트 전체 AAA 준수 주장 아님 |
| R8 · [web.dev—Rendering performance](https://web.dev/articles/rendering-performance) · 브라우저 개발자 자료 | 60Hz의16.66ms 전체 프레임 예산과 브라우저 여유를 뺀 작업예산,layout/paint/composite 경로 비용 | FPS평균만 보지 않고 지연/분산·draw/step/bake 측정. DOM transform의 이점을 Canvas drawImage가 자동으로 동일하게 얻는다고 가정하지 않음 |
| R9 · [W3C—Compute Pressure Level1](https://www.w3.org/TR/compute-pressure/) · 현행 표준 문서 | 현재 source는CPU,상태는nominal/fair/serious/critical,플랫폼 지원·전달 제약. GPU는 미래 확장 예시 | “남은 컴퓨팅 능력”을 정확한 CPU/GPU 잔량으로 표시하지 않음. 필수 API 추가 없이 기존 프레임 조절을 공통화 |
| R10 · [Disney D23—Multiplane camera](https://d23.com/a-to-z/multiplane-camera/) · 공식 제작 기법 기록 | 유리 위 배경층을 나눠 깊이를 표현한 역사적 기법 | 같은 그림의 앞/중간/뒤를 나누는 표현 방법 참고. 특정 층 수의 사용자 선호 실험으로 인용하지 않음 |

열람이 막힌 일부 원문/리다이렉트 PDF는 결론의 근거로 채택하지 않았다. 마우스로 움직이는2D 픽셀 풍경에서 **2/3/4/5층·정확한px·저해상비를 직접 비교하여 보편적 최적값을 증명한 연구는 이번 조사에서 확인하지 못했다.** 아래 선택은 이를 숨기지 않은 제품 설계 판단이다.

### E.2 층 수 비교 → 3장 채택

| 생성층 수(하늘 별도) | 화면에서의 장단점 | 전체 최종 슬롯 수 | 판단 |
|---|---|---|---|
| 1 | 한 장처럼 움직여 내부 앞뒤 차이 부족 | 41 | 정지 합성/최저비용 표현용 |
| 2 | 앞/뒤는 분리되나 활동면과 앞 풀을 독립 조절하기 어려움 | 82 | 가볍게/자동 절약의 합성 방식으로 채택 |
| **3** | 먼 윤곽·발점 활동면·앞 프레임을 독립 배치,현재 y-sort와 연결 가능 | **123** | **기본 채택**. R1/R2의 깊이 단서와 R3의 조절 방식을 작은 비용으로 구현 |
| 4–5 | 중간 깊이를 더 세분할 수 있으나 추가 이음·가림·메모리·계절짝 검토 증가 | 164–205 | 선호 향상 근거가 없고 산의 의미5층은3파일 안에서 유지 가능하므로 미채택 |

숫자41은 일반10바이옴×4계절+심해 공통1조합이다. “연구가 세 겹을 최적이라고 증명했다”는 표현을 사용하지 않는다. 이 장면에서 역할이 다른 세 공간을 분리하는 가장 단순한 구조로 선택했다.

### E.3 움직임·흐림 선택

**움직임:** R1/R2는 깊이 차이를 주는 상대 이동의 유용성을 지지하고 R3는 층별 강도·축 제한을 제공한다. R6/R7은 과한 비필수 움직임을 피하고 끌 수 있게 하는 방향을 지지한다. 따라서 한쪽 최대x3/8/16px·y0/2/4px,τ=.12초·반동0을 선택했다. τ=.12이면 약.36초에 목표의95%를 따라가지만 이것은 지수식의 계산값이며 연구가 보장하는 선호/멀미 임계값이 아니다. 마우스가 멈추면 곧 정착하고 머리 추적처럼 시점을 회전시키지 않는다.

**흐림:** R1에서는 blur 효과가 다른 단서와 상호작용했고 R2는 시력/대비 저하 실험이므로 강한 배경 흐림의 미적 선호 근거가 아니다. 원경의 큰 윤곽/낮은 세부/채도·가림을 먼저 사용하고, 최대 품질에서 원경만1/2 backing 해상도로 제한한다. M/N은1배로 발점과 픽셀 형태를 유지한다. 이전1/4·1/2·1 전체 차등안은 선명한 활동면까지 약화시킬 우려와 근거 부족으로 대체한다. 가볍게의1/4·1/2는 비용 절감 옵션이며 미적 최적값이 아니다. 현재 ART-13에 맞춰 nearest·AA0·계열 외곽선을 유지하므로 사진의 광학적 defocus를 그대로 재현하지 않는다.

### E.4 봄 초원 파일럿에서 검증할 비교

연구 원칙을 실제 그림에 전이할 때의 오류를 확인하는 **구현 단계 실험**이다. 지금 시안/테스트를 만들었다는 뜻이 아니다.
- 같은 시드/그림3장을 재합성해 2층/3층을 비교한다. 추가 생성0. 4층이 필요하다는 재현 가능한 문제가 없으면4층용 그림을 만들지 않는다.
- 움직임: 정지 / 채택x3·8·16 / 이전강도4·10·24를 같은30초 경로로 비교. 강한 안은 비교용이며 기본으로 승격하지 않는다. 실제 마우스 자유 조작도 확인.
- 원경: 추가저해상없음 / 채택1/2 / 이전1/4 비교,활동면1배 고정. 눈에 띄는 계단 손실·바이옴 특징 소실·발점 대비 저하가 있으면 원경을1배로 복구하고 미술적 단순화만 남긴다. 가짜 blur로 덮지 않는다.
- 1400×860·1024×768·큰PC 화면,밝은 낮/어두운 밤/안개 조건. 깊이감·자연스러움·피로/산만함·활동면 읽힘을 구분 기록. 소유자 화풍 검토와 A/B/C 회귀검토를 함께 사용한다.
- 사람 참가자/표본이 없으면 “사용자 선호 실험 통과”라고 보고하지 않는다. 소유자1인 피드백은 소유자 취향 확인이며 통계적 일반화가 아니다. 불편함이 보고되면 강도를 낮추거나0으로 하고 정지화면에서도 앞뒤가 읽히게 한다.
- 자동조절: 충분→게임/방송 유사 부하→회복을 stub trace와 실제 CPU throttle로 검증. 빠른 품질 왕복0,전체 정지/재개 성공,공통 소비 경로 비용 감소,수동max/lite 의미 유지. 테스트 중 OBS/게임 설치·실행을 사용자에게 새로 요구하지 않는다.

이 근거 표와 선택값으로 위임된 판단을 완료한다. 새로운 승인 질문을 만들지 않으며 실제 구현 결과가 근거/예산과 어긋나면 해당 재현 증거와 함께 조정한다.
