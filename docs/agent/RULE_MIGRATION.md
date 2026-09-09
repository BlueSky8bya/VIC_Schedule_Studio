# 규칙 보존 대응표 — 2026-09-09

원문은 [분할 전 보존본](archive/20260909-CLAUDE-before-memory-split.md)의 코드 펜스 안 589줄이다. 아래 줄 번호는 보존용 머리말 10줄을 제외한 **원문 번호**다. 원문 바이트·줄·순서는 바꾸지 않았다. 현재 규칙은 해당 주제 문서에서 읽으며 이 표를 시작 메모리에 자동 주입하지 않는다.

Source SHA-256: 61508ea7a2d4ee9bbd32935ed01f16384325a3b17514481a2c0639b21beb1e0a
Source lines: 589
Source UTF-8 bytes: 59266

## 판정과 검증 범위

- `이관`: 현재 G/UI/AMB/ART 규칙 ID로 보존. 수치 정본과 검수 조건은 해당 규칙 및 아래 측정 대장에 기록한다.
- `코드`: 값/동작을 현재 코드가 소유. 파일:심볼로 연결하며 소유자 확정 시각 기준을 자유 구현값으로 바꾸지 않는다.
- `의도적 삭제`: 현재 실행 지시에서 제외한다는 뜻이다. 원본·ADR 문장을 삭제한 것이 아니다. 제목/빈 줄과 실질 지시 철회를 구분하여 전부 열거한다.
- 한 원문 범위에 유지·철회 문장이 섞인 경우 대응표는 유지 목적지를 기록하고, 별도 부분 철회 대장에 제외 문구·이유·근거를 모두 적는다.
- 이관은 등록 규칙 ID, 코드는 파일:심볼을 최소 하나 포함하며 다른 형식은 보조 근거로 병기할 수 있다. TS는 실제 식별자/속성 경로, JSON은 실제 키, YAML은 최상위 키를 확인한다. 예제·주석 속 ID와 주석·문자열 속 심볼은 현역으로 인정하지 않는다.
- 하네스는 원문 해시, 589줄 정확히 1회 대응, 현행 ID 집합·파일 위치, 코드 파일/심볼 존재, 삭제 이유를 검사한다. 문장 의미의 동등성이나 실제 화면의 합격을 자동 증명하지 않는다. 의미 판정은 이 대장의 근거와 소유자 검토 대상으로 남는다.

검토 결과: 대응 163행, 현행 규칙 97개. 측정/절차 항목 102개 중 **복원 42개**. UI-M07과 AMB-M02의 620ms 전이는 한 번만 센다. 크기비 ≤12는 소유자 답변에 따라 **같은 엔티티의 변형끼리** 적용하며, 이는 별도 범위 명확화 1건이다.

## A-1 원문 전수 대응

<!-- rule-migration:coverage:start -->
| 원문 줄 | 분류 | 대상 | 원문 내용 | 판단·이유 |
|---|---|---|---|---|
| 1-2 | 의도적 삭제 | — | 옛 CLAUDE 제목·빈 줄 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 3-5 | 이관 | G-01, UI-33 | 방송 일정·편집실·최초공개·그림판 제품 범위, 스티커/PNG export/worker 은퇴 | 제품 범위와 되살림 금지는 공통 규칙 및 UI-33에 존속한다. |
| 6-6 | 의도적 삭제 | — | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 7-8 | 이관 | G-02, G-03, G-07 | 공개 화면/API에 private·운영·관리 데이터 금지 | 공개 DTO와 서버 정보 경계로 이관한다. |
| 9-11 | 의도적 삭제 | — | 빈 줄·Philosophy 제목 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 12-13 | 이관 | G-01, UI-08 | 동률이면 몰입·통일감 우선, 차가운 관리 패널 회귀 방지 | 공통 우선순위와 디자인 통일 원칙에 존속한다. |
| 14-14 | 의도적 삭제 | — | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 15-16 | 이관 | UI-25, UI-27 | 클릭·저장·전환의 즉각 피드백, 로딩·낙관·회복 상태 | 현재 동작에 적용한다. 은퇴한 export를 복구하라는 의미는 아니다. |
| 17-21 | 이관 | G-01, G-04, UI-08, UI-27 | 따뜻한 신뢰·명확성을 해치지 않는 움직임·역할별 도구 | 제품/권한/UI 기본 원칙에 분산 이관한다. |
| 22-26 | 의도적 삭제 | — | 빈 줄·옛 Design rules 내부 안내·Owner-fit 제목 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 27-29 | 이관 | G-07, UI-02 | 개인 적합성 원자료·원국은 로컬 전용, UI/API/커밋 금지 | 개인정보 경계를 그대로 유지하며 공개 가능한 디자인 결론만 UI 규칙에 둔다. |
| 30-30 | 의도적 삭제 | — | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 31-41 | 이관 | UI-01, UI-02, UI-33 | 금생수: 작업은 금, 컨테이너는 수; 의미색·하트·기하 보존 | 금생수·오행 한국어와 재질 세부를 UI-01에 복원. 현행 유리 토큰 이름은 코드에 맞춘다. |
| 42-45 | 이관 | UI-03 | 상단 수·좌측 은·중앙 따뜻함, 저장 한 개 주동작, 도달성 우선 | 방향 의미와 주동작 수를 그대로 유지한다. |
| 46-49 | 이관 | UI-19 | 날짜 편집 팝오버는 좌측 우선, 공간 없을 때만 우측 | 다음 날짜 가림을 막는 이유와 placeEditorPopover 연결 유지. |
| 50-56 | 이관 | UI-02, UI-04, G-02 | 극 색/불편 배치로 고의 스트레스 금지, 실제 경고만, 의미색8·접근성 우선 | 누락된 극 색/스트레스 금지 문구를 UI-02에 복원. 차분함은 의미 있는 동작을 제거하지 않는다. |
| 57-60 | 이관 | UI-04 | 차분한 편집실 항상 ON, 토글 제거, --studio-* 소비 | 항상 ON과 삭제된 토글 금지를 유지. 날짜·사용자 발언은 근거이며 실행할 마이그레이션이 아니다. |
| 61-64 | 이관 | UI-09, UI-13 | 편집실 북쪽 한 줄·소유자 순서·타이틀은 viewer·빈 topbar 클릭 통과 | 화면 순서와 포인터 경계를 유지한다. |
| 65-70 | 이관 | UI-21, UI-09 | 서쪽 도구 카드의 설정이 공통 허브, 웹 모달·모바일 역할 배지 재사용 | 설정 항목의 단일 컴포넌트 및 모달 동작으로 유지한다. |
| 71-81 | 이관 | UI-22, AMB-03 | 개발자 showcase 설정은 예외 허용, 공유 상태·현재 biome 유지·지속 force 복귀 손잡이 | 설정 두 화면의 단일 상태·Esc 순서·계절/날씨 동기화 유지. |
| 82-85 | 이관 | UI-11, UI-09 | 아바타 조작은 하단 중앙, rail 밖, 두 번째 가로행 금지, avatar58% | 위치 원칙 유지 및 rail 수치 검수 조건 복원. |
| 86-89 | 이관 | UI-10 | rail폭20vw−16·내용고정 grid·미리보기 실측 정렬 | 현행 minmax(0,1fr) 구현으로 폭 안정성을 복원한다. |
| 90-91 | 이관 | UI-13 | 배경 활성 topbar의 면·선·blur 없음 | 투명 topbar 규칙 존속. |
| 92-98 | 이관 | AMB-01, AMB-03 | 기본 meadow·11 biome·그래프 방향·lazy scene·620ms pan·출발/도착 두 장면 | ambient 담당 AMB-03 측정 계약과 PAN_DUR 단일 수치 출처로 통합한다. |
| 99-100 | 이관 | AMB-01 | 물은 pond/coast/sea, WaterTide mount 은퇴 | 장면 기반 단일 배경 시스템 유지. 이어지는 원문 101은 ambient 담당. |
| 101-102 | 이관 | AMB-01, AMB-03 | 물 장면 분리, water:true 연잎 조건, pond fixture와 바이옴 debug 경로 | 장면 역할과 재현 진입점 보존. 개발 단계 표기는 현행 다음 작업으로 사용하지 않는다. |
| 103-110 | 이관 | AMB-06, AMB-25, AMB-03 | 심해 옆모습·지면/원근 예외, 날씨 봉인과 시간대 반응, 620ms 이동, 6띠×5날씨 해시 계약 | 심해의 예외와 숫자·캡처 조건을 활성 규칙으로 복원한다. |
| 111-112 | 이관 | AMB-06, AMB-25 | 심해는 시간대를 읽고 수심·해설·빛줄기·생물로 변화한다 | 밤 발광의 당시 수치만 현재 구현으로 대체하며 날씨 봉인은 유지한다. |
| 113-113 | 의도적 삭제 | — | 심해 변화는 never from the clock라는 모순 문장 | 같은 원문107~110의 소유자 시간대 개방과 충돌하며 AMB-06/25와 현행 deep.ts가 시간대 반응을 보존한다. |
| 114-116 | 이관 | AMB-01, AMB-02 | 공유 AmbientLayer와 보고 있는 달 기준 계절, 네 월 구간 | 현재 달이 아닌 viewed month라는 조건과 월별 숫자를 보존한다. |
| 117-119 | 이관 | AMB-01, ART-02 | 계절 캔버스 장면과 카메라 | 현행 바이옴/flat·stand·shadow 및 심해 예외로 대응한다. |
| 120-122 | 이관 | AMB-26, ART-03 | 겨울 자국·눈가루, 가을 낙엽, 봄 꽃/나비 상호작용과 오행 색 | 실제 반응은 계절 생성 함수에서, 색/화풍은 ART-03에서 유지한다. |
| 123-124 | 이관 | AMB-12 | 계절 배경 기본 OFF, 기기별 유지·페인트 전 복원, OFF 게이트 | on/dim/off 현행 상태로 대응한다. |
| 125-127 | 코드 | components/shared/ambient/scenes/summer.ts:createSummer, components/shared/ambient/scenes/spring.ts:createSpring, components/shared/ambient/scenes/autumn.ts:SPECIES, components/shared/ambient/scenes/winter.ts:createWinter | 파문·나비·7종 낙엽·발자국의 구체 행동 | AMB-26에서 찾을 함수와 실측 범위를 연결하며 개별 행동 구현은 코드가 소유한다. |
| 128-128 | 이관 | AMB-02, AMB-09 | 실제 KST 특수일 우선, sprites/ground 사전 굽기 | SPECIAL_DAYS/pickAmbient 및 캐시 원칙 유지. |
| 129-130 | 이관 | AMB-27, AMB-11 | frame governor·가시 하한·줌 좌표 보정 | 측정 절차와 실제 offsetWidth/zoom 조건 복원. |
| 131-133 | 이관 | AMB-11, AMB-01 | 1700px 이상 studio 줌 실측과 단일 배경 시스템 | 현재 캔버스 크기/포인터 보정·WaterTide 직접 장착 금지를 유지한다. |
| 134-138 | 이관 | AMB-09, AMB-10, AMB-27 | load 0–1, +0.06/−0.15 매90프레임, max1/lite0.3, 점진 조절 | 현행 코드와 일치하는 수치·측정 조건을 복원한다. |
| 139-140 | 이관 | AMB-10, AMB-09, AMB-19 | soft 효과 저해상도, DPR mount 고정, 아트 캐시와 우리 생물 그림 | 현재 LOD 구현 수치로 연결한다. |
| 141-147 | 이관 | AMB-19, AMB-20, ART-03 | 동물도 오리지널 픽셀아트, Noto는 임시 대체, drawFacing/drawSprite 구분 | 철회된 동물 제작 금지를 다시 활성화하지 않고 새 아트 목표를 보존한다. |
| 148-155 | 코드 | components/shared/ambient/scenes/summer.ts:createSummer, components/shared/ambient/scenes/winter.ts:createWinter, components/shared/ambient/scenes/autumn.ts:createAutumn, components/shared/ambient/scenes/autumn.ts:ACORN_MAX, components/shared/ambient/scenes/spring.ts:createSpring, components/shared/ambient/scenes/spring.ts:ROWS | 계절별 이벤트·도토리 상한6·봄12줄·재렌더 방지 | 각 계절 행동 코드를 정본으로 연결하고 AMB-26에서 숫자 및 실제 행동을 함께 검수하게 한다. |
| 156-156 | 이관 | AMB-09, AMB-03 | 크기별 결정적 바탕 rng와 감상 키 처리 | 다시 굽기 결정성과 감상 진입/종료 입력을 보존한다. |
| 157-161 | 이관 | AMB-19, AMB-20, ART-11 | 수중 물고기 top-view silhouette와 라이선스 출처 | 카메라 적용 범위를 현행 예외와 함께 보존한다. |
| 162-166 | 이관 | AMB-20, AMB-21 | 오리 직립·좌우반전·ethogram·상태별 수면선·접촉 그림자 | 물 위에 뜬 것처럼 보이지 않는 관찰 조건과 상태별 구현을 유지한다. |
| 167-167 | 코드 | components/shared/ambient/scenes/summer.ts:fishTarget, components/shared/ambient/scenes/summer.ts:bigTarget | 물고기 목표2–14×면적, 큰 개체 load0.6/0.9, 가장자리 출입 | AMB-26에 코드의 저부하0 예외까지 연결한다. |
| 168-176 | 코드 | components/shared/ambient/scenes/util.ts:threat, components/shared/ambient/scenes/summer.ts:createSummer, components/shared/ambient/scenes/winter.ts:createWinter, components/shared/ambient/scenes/autumn.ts:createAutumn, components/shared/ambient/scenes/spring.ts:createSpring | 속도/loom 위협, 90px 놀람 전염·140px splash·1초 먹이, 동물별 행동 | AMB-21/26은 실측 절차를 소유하고 세부 행동 수치는 동일 함수의 debug와 분기에서 조회한다. |
| 177-177 | 이관 | AMB-21 | 새 행동에 실재 ethology 주석과 debug counter 필수 | 설명만 있는 행동을 완료로 보고하지 않는 증거 계약 유지. |
| 178-183 | 이관 | ART-01, ART-07, AMB-13 | 모든 그림 슬롯·정본 파일명·대체물·ArtSet/props 공유와 늦은 도착 rebake | 별도 슬롯/파일 목록을 만들지 않고 현재 API와 상태 구분을 유지한다. |
| 184-188 | 이관 | ART-07, ART-02 | 조립한 도형 식물 반려, 슬롯+fallback 경로, standing 3/4와 접촉 앵커 | 원문 금지와 카메라 예외의 적용 대상을 보존한다. |
| 189-190 | 이관 | ART-10, ART-01 | 개발자 전용 아트 보드, manifest 기반 프롬프트/표 | 서버 권한과 같은 정본에서의 생성 원칙 유지. |
| 191-194 | 이관 | ART-03, ART-11, ART-13 | 원본 아트·오행·6–10색·AA금지·동일계열 외곽선·합격본 비교 | 화풍 수치와 실제 화면 대조 조건 복원. |
| 195-199 | 이관 | ART-03, ART-05, ART-06, ART-13 | 단순하고 읽히는 덩이, 정수배 정리본, 밝은 바닥의 회갈색 줄기, 아트 fixture | 현재 슬롯 크기와 보존 파이프라인에 맞게 검수 의도를 유지한다. |
| 200-202 | 이관 | AMB-23 | 하늘 아트·8달위상·ArtSet version 포함 cache key | 실제 파일/변형 수는 manifest이고 아트 도착 rebake 규칙은 활성 유지. |
| 203-207 | 이관 | AMB-24, AMB-28 | 아트 자체축≈−16°·rotate/flip 수학·회귀검사·혜성26초 | 정확한 측정축과 변환 합성·시간 계약 복원. |
| 208-211 | 이관 | AMB-23, AMB-25, AMB-28 | seed,index 기반 희귀 일정·advance 동치·공유11장면·약8.8분 | 출력 결정성을 보존하며 재사용 캐시는 상태를 누적해 시간을 가속하는 감독과 구분한다. |
| 212-214 | 이관 | AMB-04 | 3/4 toy scale, TILE/SIZE, 같은엔티티변형끼리 최대:최소≤12 | 원문의 비교 집합을 2026-09-09 소유자가 같은엔티티 변형끼리라고 명확화했다. 다른자산비교나SIZE변경은 하지 않는다. |
| 215-220 | 이관 | AMB-04 | GROUND_SQUASH .7, depth .6→1/.05, horizon .26, aboveHz/groundYAt/groundK | 소유자 확정 카메라 수치와 좌표 측정 절차를 보존하며 변경 전 판단을 명시한다. |
| 221-224 | 이관 | AMB-05, AMB-16 | 지평선 원경/안개와 앞뒤 층 검수 | 현행 산 문법과 지면비율 안개 좌표로 보존한다. |
| 225-228 | 이관 | AMB-04, AMB-15, AMB-16 | toScreen 지평선아래·y-sort·스폰/클릭/자국 공유경계·SIZE사용 | 실제화면 경계와 입력/가림의 일치 조건 보존. |
| 229-229 | 의도적 삭제 | — | 세계11화면과 P1–P3가 남았다는 다음단계 지시 | 완료된 옛계획 진행메모이며 현행 작업은 CURRENT_STATE/사용자지시로 선택한다. 11바이옴 목록 자체는 코드에 남아 있다. |
| 230-232 | 이관 | AMB-02, AMB-07, G-06 | 보고있는달 날짜선택·6KST띠와 계절빛 | date/time정본과 금지색을 현재 서비스와 ART-03으로 보존한다. |
| 233-233 | 이관 | AMB-07 | 날씨는 달력slug/date 기반 결정적seed, 실제날씨API 사용안함 | 세계 서비스 규칙 유지. |
| 234-234 | 이관 | AMB-08 | slug 기반결정적흔적 | 월별monthTraces로보존. |
| 235-239 | 의도적 삭제 | — | 2023-05 탄생·2025-10-01 데뷔·키성장/위치/수명·도토리 연대기 수치 | 소유자의 연대기 철거 결정에 따른 의도적철회. world/traces.ts:monthTraces와 docs/ux/ambient-debut-tree-archive.md가 근거이며 성목크기등 현행규칙으로 되살리지 않는다. |
| 240-240 | 이관 | AMB-08 | 두더지흙·눈사람·연잎은 월별흔적 정본에서 조회 | 살아있는 세 흔적종류를 보존한다. |
| 241-243 | 이관 | AMB-08, AMB-07, AMB-22, G-02 | 공유결정세계·개인흔적localStorage·개발자강제조작·5등급희귀도/상한 | 개인 기록은 공유 세계에 섞지 않는 로컬 저장 원칙으로 보존한다. 현재 확인한 실제 localStorage 자료는 감상 방문 기록이다. 개인 발자국 영속 저장이 구현됐다고 주장하지 않는다. 날 강제 디버그는 현행 fixture 경로로만 해석한다. |
| 244-245 | 이관 | AMB-18, AMB-19, AMB-03 | 종목록정본과 fixture/debug 재현경로 | 현행CODEX/아트목표로대응한다. |
| 246-250 | 이관 | AMB-10 | full/lite/soft·soft≤2cores·나쁜방문2회·lite가시성 | 측정조건을복원하고 한표본으로숨기는실수를막는다. |
| 251-256 | 이관 | AMB-10, AMB-12 | 사용자품질우선·off게이트·lite에계절읽힘유지 | 현행load/씬별규칙으로비용조절을검수한다. |
| 257-263 | 이관 | AMB-12, AMB-03 | 계절배경/효과동기화·감상한진입점·Esc/상단닫기·OFF에서도복원컨트롤 | 현행3상태공유컨트롤로보존한다. |
| 264-269 | 이관 | AMB-12 | on/dim/off·절반프레임·공유세버튼현재상태·설정/프리뷰동기화 | 수치와현재상태조작을보존한다. |
| 270-273 | 이관 | AMB-14, AMB-12 | 투명헤더스크롤·집중모드배경만·backwards끝값·문자filter금지 | 실제computed opacity와월전환깜빡임을검수하게복원한다. |
| 274-277 | 이관 | AMB-18, ART-01 | 물고기/곤충/동물129종 CODEX정본·조건보유·spawn/art/catalog단일파생 | 129는현재재고관찰값이며고정증식상한이아니다. 명단/조건/종수정본은 CODEX/CodexEntry다. |
| 278-283 | 이관 | AMB-18, AMB-19 | 도감 rarity/cm/wave1–3·조건 도감·심해 side view·mudskipper 예외·Nintendo 내용 복제 금지 | ambient 담당이 조건 도감·시점 예외·참고 범위를 같은 규칙으로 보강한다. |
| 284-288 | 이관 | UI-31, AMB-14 | heavy media 뒤 ambient pause, settings 예외, poster 상시 rAF 금지 | 공유 pause/event 관찰 규칙 유지. |
| 289-293 | 이관 | UI-14, UI-12 | viewer36px셀·44px카드·13.5px본문과 pchrome 실측 tiers | 수치와 폭 고정 조건을 UI-14 검수 표에 복원. |
| 294-300 | 이관 | UI-14 | 아바타 끔/왼쪽/오른쪽 3상태·상시 표시·1클릭·폭 불변 | 전환 검수 조건으로 명시. 2클릭·다음동작 혼합은 반려 패턴으로 보존한다. |
| 301-302 | 이관 | UI-21 | 설정은 RhhSelect·body portal·키보드 listbox, native select 금지 | 기존 공유 설정/접근성 동작 유지. |
| 303-304 | 코드 | lib/ui/motion.ts:SETTINGS_EPOCH, UI-04, AMB-12 | 설정 세대 2026-09-04의 1회 저장값 reset | epoch 값·실행은 코드 소유이며 현재 기본값으로 재해석해야 한다. |
| 305-311 | 의도적 삭제 | — | 옛 CSS Tide 네트워크·변형·단일 caustic 레이어·gfx/모션/웹 가시성·studio 밝기 | 퇴역 WaterTide 전용 구현 지시. 현재 Scene/AmbientLayer 시스템과 lite/soft 정책으로 대체됐으므로 재활성화하지 않는다. 원본 전체는 archive에 보존한다. |
| 312-313 | 이관 | UI-13, AMB-01 | html 배경 금지와 body canvas 전파 이유 | 시스템에 관계없이 유효한 html 배경 금지는 UI-13에 복원한다. |
| 314-314 | 의도적 삭제 | — | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 315-316 | 의도적 삭제 | — | Stack & layout 제목·빈 줄 | 구조용 제목이며 독립적인 행동 규칙이 아니다. 현행 프로젝트 지도와 아래 항목으로 탐색 기능을 유지한다. |
| 317-319 | 코드 | package.json:dependencies, package.json:devDependencies, G-03, G-14 | 프레임워크·DB·배포·검증 도구 구성 | 버전·도구 정본은 package.json. 배포 승인 경계는 G-14가 별도로 유지한다. |
| 320-321 | 코드 | package.json:scripts | 개발·검증 명령 | 실행 가능한 명령은 package.json scripts가 소유한다. |
| 322-323 | 이관 | G-09, G-17 | 폴더별 역할·README 라우팅 | 프로젝트 지도와 해당 폴더 안내를 선택해 읽는 현행 라우팅 규칙으로 이관한다. |
| 324-327 | 이관 | G-02, G-03, G-04, UI-23 | 공개·onair·studio·API 경계와 역할별 진입 | 공개 DTO와 studio 권한 경계는 유지한다. 현재 경로 목록은 PROJECT_MAP 및 실제 app 라우트가 소유한다. |
| 328-328 | 코드 | components/studio/studio-shell.tsx:moveMonth | 달 경로는 최초·직접 진입용이며 매 이동 시 라우팅하지 않음 | ADR-0005의 달 내비게이션 계약과 현행 클라이언트 달 상태 구현을 따른다. |
| 329-331 | 의도적 삭제 | — | 빈 줄·Non-negotiable 제목 | 구조용 구분이며 실질 규칙은 바로 다음 행들로 모두 이관한다. |
| 332-332 | 이관 | G-06 | 시간은 KST | Asia/Seoul 날짜·경계·파일명 규칙으로 보존한다. |
| 333-333 | 이관 | G-02, G-03 | 서버에서 공개·비공개 분리 | CSS 숨김은 보호가 아니며 공개 로더·명시 DTO 경계로 보존한다. |
| 334-334 | 의도적 삭제 | — | 일반 일정 편집은 owner만이라는 단정 | 현행 ADR-0011/0012/0018 및 lib/permissions/roles.ts canEditSchedule은 owner·developer를 허용한다. owner_private만 owner 전용이라는 G-04로 대체한다. |
| 335-336 | 이관 | G-04 | developer의 owner 전용 데이터 접근 금지 | 일반 일정 유지보수와 owner_private 열람·생성 권한을 분리한 현행 역할 계약으로 보존한다. |
| 337-339 | 이관 | G-05, G-04 | Google 로그인·패스코드 grant 및 비공개 UI 철수 | 서버 언락 모델과 UI 퇴역을 구분하며 신규 일정 public 계약을 유지한다. |
| 340-341 | 이관 | UI-33, G-03 | 공개 포스터 표면에 편집·관리·언락 UI 금지 | 공개 캡처 표면 경계는 유지한다. 퇴역한 앱 내 PNG 내보내기를 다시 만들라는 지시로 읽지 않는다. |
| 342-344 | 의도적 삭제 | — | 빈 줄·Roles & permissions 제목 | 문서 구조만 제거하고 역할 규칙은 아래 행들에 보존한다. |
| 345-346 | 이관 | G-02, G-04, UI-33 | viewer는 공개 보기만 가능 | 서버 권한 및 공개 표면에서 비공개·편집·관리 UI 배제 규칙으로 보존한다. |
| 347-350 | 이관 | G-04 | manager·trusted members 철수 및 helper 역할 복원 금지 | 역할은 owner/developer/viewer뿐이다. canEditSupport와 canEditEventTags는 canEditSchedule과 같은 권한이라는 구현은 lib/permissions/roles.ts가 소유한다. |
| 351-351 | 코드 | lib/auth/config.ts:isOwnerEmail | owner 표시·복수 Google 소유자 계정 | 계정 판정은 isOwnerEmail과 OWNER_EMAIL 설정이 소유하며 ADR-0003의 앱/RLS 양쪽 바인딩 절차를 유지한다. |
| 352-353 | 이관 | G-04, UI-23 | developer 진단 및 읽기 전용 역할 미리보기 | 역할 미리보기는 실제 권한을 올리지 않는다는 계약을 보존한다. |
| 354-356 | 의도적 삭제 | — | 빈 줄·Visibility scopes 제목 | 구조용 제목으로 분류하며 세 스코프의 실제 권한은 다음 행과 AUTH/SECURITY 안내로 보존한다. |
| 357-361 | 이관 | G-04, G-05 | public/work/owner_private 세 스코프와 읽기 권한 | AUTH/SECURITY의 현역 역할·grant 조건을 따른다. work는 서버 스코프이며 퇴역 worker 역할을 뜻하지 않는다. |
| 362-364 | 의도적 삭제 | — | 빈 줄·Invariants 제목 | 구조용 구분이며 이어지는 현행 계약은 개별 행으로 보존한다. |
| 365-366 | 이관 | G-05, G-12 | 비공개 UI 재도입 시 정확한 경고 문구 유지 | UI retirement remains current; DoD preserves the conditional exact warning if separately authorized restoration occurs. ADR-0014 retires UI, not this future wording contract. |
| 367-367 | 코드 | lib/schedules/event-validation.ts:MAX_EVENT_TAGS, lib/schedules/event-validation.ts:MAX_PRIMARY_TAGS | 태그 개수 및 대표색 상한 | 현재 MAX_EVENT_TAGS=6, MAX_PRIMARY_TAGS=2가 정본이다. 원문의 총 태그 2개는 현재 검증 코드 및 event-validation 테스트와 불일치하며 대표 태그 2개와 구분한다. |
| 368-368 | 이관 | G-04 | 태그 생성·삭제·색 변경은 owner/developer | 현행 역할 경계로 보존한다. |
| 369-369 | 이관 | UI-02 | Support 표시 용어는 업 도움 | 한글 원어를 UI 의미색 규칙에 병기하고 현재 표시명은 유지한다. |
| 370-370 | 코드 | lib/ui/breakpoints.ts:BREAKPOINTS, lib/ui/breakpoints.ts:MOBILE_QUERY | 모바일 640px 기준 | 640px 모바일 기기 기준과 가로 터치 조건을 현재 공용 helper가 소유한다. studio/poster agenda 임계값과 섞지 않는 UI-07도 유지한다. |
| 371-372 | 이관 | UI-08 | CSS 디자인 토큰 정본 | 공유 공간·반경·그림자·모션 토큰을 사용하며 임의 하드코딩을 피한다. |
| 373-373 | 의도적 삭제 | — | 빈 줄 | 문단 구분이며 독립 규칙이 아니다. |
| 374-375 | 의도적 삭제 | — | 옛 Design rules 제목·빈 줄 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 376-381 | 이관 | UI-07, lib/ui/breakpoints.ts:MOBILE_QUERY, lib/ui/breakpoints.ts:STUDIO_AGENDA_QUERY, lib/ui/breakpoints.ts:POSTER_AGENDA_QUERY | 웹/모바일 정보구조 분리, 모바일 가로overflow0, 웹 공간·큰 활자 사용 | 640px 기기 분기와 실제999/1040px agenda 토폴로지 기준을 구분해 code-owned 표기. |
| 382-387 | 이관 | UI-15, UI-14 | 한 화면·한 control·한 짧은 lbl, long/short 쌍 금지 | 짧은 이름·13.5px 판독성을 유지한다. |
| 388-394 | 이관 | UI-15 | 툴팁 3경우: 접힌 이름/모호한 결과 약20자/명확한 이름 무툴팁 | 약20자, 괄호 부연 금지, native title 중복 금지를 복원한다. |
| 395-400 | 이관 | UI-16 | 아이콘 1개, 접힐 때 정체성 보존, 그룹 한 어휘 | 기능·정체성 없는 장식 아이콘 및 2개 병용을 금지한다. |
| 401-408 | 이관 | UI-06, UI-07 | 모바일 cream·12px/pill·의미색, 재질은 class topology로 gate | 12px 재질과 max-height640/coarse-pointer 조건을 복원·명시한다. |
| 409-417 | 이관 | UI-16 | 셀/agenda 크롬은 host ink lucide·no white ring/shadow, 데이터 채도 예외·13/14/11px | desktop calendar에서 원문 크기가 유지됨을 확인해 검수 조건으로 복원한다. 기존 agenda Play13px는 별도 topology의 코드 현황으로 명시하며 이번에 변경하지 않는다. |
| 418-425 | 이관 | UI-28, AMB-12 | 모션 OFF는 배경 제거 아님, 모든 투명 gate에서 reduce-motion 숨김 금지 | 축약 중 빠진 CSS selector 판별 조건을 UI-28에 복원한다. |
| 426-430 | 이관 | UI-28, AMB-13 | dt=0 초기 step·late assets bounded retry로 still bake, gfx 중복 OFF 없음 | 엔진 초기화 절차와 설정 중복 금지를 유지한다. |
| 431-435 | 이관 | UI-17 | 모든 scrollbar-width none·webkit0, 실제 scrolling 유지 | 0크기 scrollbar 및 thin/auto 재도입 금지를 유지한다. |
| 436-443 | 이관 | UI-34, lib/activity/labels.ts:AREA_ORDER | area는 실제 장소 한 이름, device/groupword 금지, 등록 data-act | 목록은 AREA_ORDER 코드 단일 출처. 사전 등록 검증 규칙을 유지한다. |
| 444-448 | 이관 | UI-29 | 좌우 이동에는 side-keyed animation name | 애니메이션 이름 변경과 동일 키프레임 이유를 유지한다. |
| 449-454 | 이관 | UI-29 | 지연 both hold 값은 방향 무관,5회반복에서0px snap | 실측 조건·합격0px를 복원하고 ±6px/12px 점프는 반려 근거로 보존한다. |
| 455-471 | 이관 | UI-32 | 오늘 n일 전체 금색 fade12px·sheen1px·bloom3px·padding11px·숫자1.3em·z8>7>6·높이21/18 | 모든 현행 수치와 overlap/header 불변 검수 조건을 복원한다. |
| 472-475 | 이관 | UI-18 | state segment 공유토큰·insethairline·unselected opacity | 현재 토큰과 선택형태 규칙으로 존속. |
| 476-479 | 이관 | UI-08 | 대칭·통일높이·공통tokens·콘텐츠 확대/공간 재분배 | 빈 공간을 메우는 구체적 방법까지 복원한다. |
| 480-482 | 이관 | UI-27 | pressed transition·진입/퇴장·chart tooltip 중앙/clamp·press→confirm2ticks | 누락된 차트 tooltip 위치와2단계 haptic 계약 복원. |
| 483-486 | 이관 | UI-27 | 모션 기본ON·data-reduce-motion inverse·OSseed 철회 | 현재 앱 설정만 authority로 유지한다. |
| 487-492 | 이관 | UI-05 | 눈편함 기본ON·ambient 비착색·rootfilter 재도입금지 | 기본값·token소유·rootfilter 폐지원인 유지. |
| 493-500 | 이관 | UI-05 | 유리RGB토큰+호출부alpha·배경ON달력픽셀≥50%·blue≈−8·html/season/canvas computed 동등 | 사라진 수치·측정대상·불변 속성 계약을 복원한다. |
| 501-503 | 이관 | UI-27, AMB-01, AMB-10 | 앱reduce-motion만사용; 오래된 tide lite 숨김과 transform/opacity 지침 | 앱 설정 권한과 현행 gfx 정책은 유지하되 퇴역 tide 전용 가시성 지시는 철회한다. |
| 504-505 | 이관 | UI-25, UI-08 | 눈·포인터 이동 최소, 가까운 관련 controls, skeleton과실제content위치유지 | 로딩/회복 및 배치 규칙으로 존속한다. |
| 506-514 | 이관 | UI-12, UI-15 | 뜨거운기능보존·폭 실측tiers·connected/width>0·remount 관측 재연결 | 수치 및 lifecycle 검수를 복원. 최신 짧은-label규칙으로 예전 tier설명의 이름만 정리한다. |
| 515-518 | 이관 | UI-11, UI-12 | filter≥132px·avatarflexshrink4·620/470px·bottom pill dodge·manualchecklist | 세로압축 수치·fixture 절차를 활성 검수 표로 복원한다. |
| 519-519 | 의도적 삭제 | — | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 520-521 | 의도적 삭제 | — | Optimistic writes & gating 제목·빈 줄 | 구조용 제목이며 아래 두 동작 계약을 보존한다. |
| 522-524 | 이관 | G-11, UI-36 | 직렬 쓰기·마지막 동작 우선·서버 재검증·실제 미완료 쓰기 경고 | 직렬 큐와 optimistic 보호, 실제 진행 중 작업 수에 의한 beforeunload 조건을 보존한다. |
| 525-527 | 이관 | G-11, UI-25 | 실제 작업에만 좁게 게이트 | 광역 pending 때문에 무관한 동작을 막지 않는 계약으로 보존한다. |
| 528-530 | 의도적 삭제 | — | 빈 줄·Harness loop 제목 | 구조용 구분이며 실행 규칙은 다음 행에 보존한다. |
| 531-532 | 이관 | G-09, G-18 | 계획 시 경로·역할·공개 경계·KST·역할별 기대 확인 | 공통 변경 범위와 역할별 점검 계약으로 이관한다. |
| 533-535 | 이관 | G-02, G-04, G-10, G-18 | 좁은 구현·서버 권한·helper 역할 금지·역할에 맞는 화면 | 현행 경계·역할·작업 범위 규칙으로 보존한다. |
| 536-539 | 이관 | G-12, G-18, UI-23, UI-27, UI-33, UI-36 | 보안·viewer/onair·동작 순서·주변 UI·모션·햅틱 검증 | DoD와 해당 UI 규칙을 함께 적용한다. 실제 실행하지 않은 검증은 성공으로 표시하지 않는다. |
| 540-542 | 의도적 삭제 | — | 빈 줄·Workflow 제목 | 구조용 구분이며 아래 절차를 개별 보존한다. |
| 543-544 | 이관 | G-12, G-14 | 타입·lint·build 및 공개 경계 확인과 커밋 보고 | 검증은 변경 범위에 맞게 수행한다. 커밋/푸시는 현재 사용자 승인 범위를 따른다. |
| 545-550 | 이관 | G-07, G-08, G-13 | 자동화·로컬 분석 수집 금지 및 운영 오염 삭제 경계 | 새 통계 경로도 lib/analytics/guard.ts를 사용한다. 기존 오염 정리는 현재 자료·복구 사본·승인 확인을 거친다. |
| 551-551 | 이관 | G-10, G-14 | main 기반 작업 분기와 요청된 commit/push만 수행 | 기존 작업/브랜치를 보존하며 새 구현 분기가 필요할 때 main을 기준으로 분기한다. 실행 범위는 현재 사용자 요청으로 정한다. |
| 552-553 | 코드 | scripts/apply-db.mjs:process.argv | SQL migration 수동 실행 명령 | 수동 도구는 그대로 있으며 G-13과 destructive-data 계약에 맞는 작업 범위에서만 실행한다. |
| 554-556 | 의도적 삭제 | — | 빈 줄·Repository memory 제목 | 구조용 제목이며 현재 메모리 규칙은 아래 행에 이관한다. |
| 557-559 | 의도적 삭제 | — | SessionStart가 상태 전체와 결정 색인을 자동 주입한다는 설명 | 승인된 메모리 분할로 bounded current brief로 대체됐다. 전체 이력·인덱스 본문 자동 주입은 폐기하고 호스트 실제 hook 활성은 별도 검증한다. |
| 560-560 | 이관 | G-16, G-17 | 작업 시작 시 CURRENT_STATE 확인 | 현재 작업·막힌 조건·다음 단계만 읽는 규칙을 유지한다. |
| 561-562 | 이관 | G-15 | Accepted 결정은 말없이 뒤집지 말고 supersede 표시 | 관련 결정만 찾아 읽고 대체된 절은 근거를 남기며 원문을 삭제하지 않는다. |
| 563-563 | 이관 | G-09 | 수정 경로는 PROJECT_MAP에서 찾기 | 해당 경로와 로컬 지침으로 라우팅한다. |
| 564-564 | 이관 | G-12 | DoD와 미실행 검증 구분 | 변경 범위에 맞는 실제 검증을 기록한다. |
| 565-565 | 이관 | G-02, G-05, G-13 | 위험 경로의 보안·권한·파괴 작업 규칙 | 루트 라우팅을 통해 해당 domain-rules를 읽는다. |
| 566-567 | 이관 | G-15, G-16 | 작업 후 현재 상태·ADR·변경 기록 갱신 | 현재 작업이 변할 때만 CURRENT_STATE, 주제 변경은 관련 기록에 쓴다. 중요한 결정·마이그레이션·공개 경계 변경은 해당 ADR/index/changelog로 남긴다. |
| 568-568 | 이관 | G-12, G-16 | L2/L3 구현 전 ACTIVE_PLAN | 구조적·치명적 작업의 사전 계획과 활성 계획 인덱스는 DoD의 계획 계약으로 유지한다. |
| 569-570 | 코드 | package.json:harness:verify, agent-harness.yaml:protocol_source | 하네스 자체 검사 명령과 설정·출처 정본 | 실행 명령은 package scripts, 설정·출처는 agent-harness.yaml이 소유한다. |
| 571-573 | 의도적 삭제 | — | 빈 줄·Source of truth 제목 | 구조용 구분이며 폴더 라우팅 규칙은 다음 행에 보존한다. |
| 574-577 | 이관 | G-09, G-17 | 폴더 README와 SOP·architecture·security 경로 | 전체 트리 일괄 읽기 대신 작업에 맞는 로컬 안내와 현재 보안 규칙을 따른다. |
| 578-584 | 이관 | G-09, AMB-29 | ambient 라우팅·장면문법·독립 검토·수정 예산·동일seed 비교 | 현행 ambient 라우팅과 시각 QA 계약에 모은다. P0 전체+최대4 entrance groups, 병렬 독립 검토·주 세션 통합의 수치/절차를 보존한다. |
| 585-586 | 이관 | AMB-08 | 연대기 퇴역·월별 molehill/snowman/lilypad 흔적 | 현행 traces 구현을 정본으로 쓰며 퇴역 debut-tree/acorn 연대기를 복원하지 않는다. |
| 587-587 | 의도적 삭제 | — | 빈 줄 | 문단 구분이며 독립 규칙이 아니다. |
| 588-589 | 이관 | G-01 | 보안→KST→권한→역할UX→출력품질→유지보수 우선순위 | 공통 충돌 우선순위로 보존한다. |
<!-- rule-migration:coverage:end -->

## 의도적 삭제 — 전체 범위 전부

제목·빈 줄은 문서 구조 정리이며 정책 폐기가 아니다. 나머지는 아래 이유로 현행 지시에서 제외했다.

| 원문 줄 | 제외 내용 | 이유 |
|---|---|---|
| 1-2 | 옛 CLAUDE 제목·빈 줄 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 6-6 | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 9-11 | 빈 줄·Philosophy 제목 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 14-14 | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 22-26 | 빈 줄·옛 Design rules 내부 안내·Owner-fit 제목 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 30-30 | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 113-113 | 심해 변화는 never from the clock라는 모순 문장 | 같은 원문107~110의 소유자 시간대 개방과 충돌하며 AMB-06/25와 현행 deep.ts가 시간대 반응을 보존한다. |
| 229-229 | 세계11화면과 P1–P3가 남았다는 다음단계 지시 | 완료된 옛계획 진행메모이며 현행 작업은 CURRENT_STATE/사용자지시로 선택한다. 11바이옴 목록 자체는 코드에 남아 있다. |
| 235-239 | 2023-05 탄생·2025-10-01 데뷔·키성장/위치/수명·도토리 연대기 수치 | 소유자의 연대기 철거 결정에 따른 의도적철회. world/traces.ts:monthTraces와 docs/ux/ambient-debut-tree-archive.md가 근거이며 성목크기등 현행규칙으로 되살리지 않는다. |
| 305-311 | 옛 CSS Tide 네트워크·변형·단일 caustic 레이어·gfx/모션/웹 가시성·studio 밝기 | 퇴역 WaterTide 전용 구현 지시. 현재 Scene/AmbientLayer 시스템과 lite/soft 정책으로 대체됐으므로 재활성화하지 않는다. 원본 전체는 archive에 보존한다. |
| 314-314 | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 315-316 | Stack & layout 제목·빈 줄 | 구조용 제목이며 독립적인 행동 규칙이 아니다. 현행 프로젝트 지도와 아래 항목으로 탐색 기능을 유지한다. |
| 329-331 | 빈 줄·Non-negotiable 제목 | 구조용 구분이며 실질 규칙은 바로 다음 행들로 모두 이관한다. |
| 334-334 | 일반 일정 편집은 owner만이라는 단정 | 현행 ADR-0011/0012/0018 및 lib/permissions/roles.ts canEditSchedule은 owner·developer를 허용한다. owner_private만 owner 전용이라는 G-04로 대체한다. |
| 342-344 | 빈 줄·Roles & permissions 제목 | 문서 구조만 제거하고 역할 규칙은 아래 행들에 보존한다. |
| 354-356 | 빈 줄·Visibility scopes 제목 | 구조용 제목으로 분류하며 세 스코프의 실제 권한은 다음 행과 AUTH/SECURITY 안내로 보존한다. |
| 362-364 | 빈 줄·Invariants 제목 | 구조용 구분이며 이어지는 현행 계약은 개별 행으로 보존한다. |
| 373-373 | 빈 줄 | 문단 구분이며 독립 규칙이 아니다. |
| 374-375 | 옛 Design rules 제목·빈 줄 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 519-519 | 빈 줄 / 구조 구분 | 원문 형식·탐색 구조이며 동작/검수 규칙이 아니다. 현행 주제별 제목·라우팅으로 대체하고 원문은 archive에 보존한다. |
| 520-521 | Optimistic writes & gating 제목·빈 줄 | 구조용 제목이며 아래 두 동작 계약을 보존한다. |
| 528-530 | 빈 줄·Harness loop 제목 | 구조용 구분이며 실행 규칙은 다음 행에 보존한다. |
| 540-542 | 빈 줄·Workflow 제목 | 구조용 구분이며 아래 절차를 개별 보존한다. |
| 554-556 | 빈 줄·Repository memory 제목 | 구조용 제목이며 현재 메모리 규칙은 아래 행에 이관한다. |
| 557-559 | SessionStart가 상태 전체와 결정 색인을 자동 주입한다는 설명 | 승인된 메모리 분할로 bounded current brief로 대체됐다. 전체 이력·인덱스 본문 자동 주입은 폐기하고 호스트 실제 hook 활성은 별도 검증한다. |
| 571-573 | 빈 줄·Source of truth 제목 | 구조용 구분이며 폴더 라우팅 규칙은 다음 행에 보존한다. |
| 587-587 | 빈 줄 | 문단 구분이며 독립 규칙이 아니다. |

## 의도적 삭제 — 유지 범위 안의 부분 철회 전부

| 원문 줄 | 제외한 구절/해석 | 이유 | 근거 |
|---|---|---|---|
| 31-41 | `--gs-water-glass`, `--gs-water-radius`, `--gs-water-line` 이름과 export 적용 문맥 | 옛 토큰 이름은 현행 --glass-* 소비로 대체됨. 인앱 PNG export 은퇴는 원문 4–5에도 명시되어 있다. 재질 의미와 화면 기하는 보존한다. | app/metal-water.css:--gs-metal-line, app/globals.css:--glass-cell, components/poster/poster-metal-water.css:.public-day, UI-33 |
| 50-56 | WCAG AA after the eye-comfort filter 중 filter 적용 전제 | 접근성 우선은 유지하되 루트 filter는 같은 원문 487–500의 나중 규칙 및 UI-05로 철회됐다. | UI-05, app/globals.css:html[data-eye-comfort="1"] |
| 86-89 | save time lives in the tooltip only | 현재 저장 성공 시각은 웹의 RoleBadge.savedAt에도 표시된다. 과거 tooltip-only 독점 위치 지시는 현행 UI-10과 충돌하므로 현재 동작을 되돌리지 않는다. | components/studio/studio-shell.tsx:renderRoleBadge, components/studio/role-badge.tsx:RoleBadge, UI-10 |
| 101-102 | Land biomes are thin plates until P2 agents and P3 art | 당시 구현 진행 상황이며 현재도 thin plate라고 단정하거나 완료된 P2/P3를 다시 실행하지 않는다. | components/shared/ambient/scenes/land.ts:createLand |
| 111-112 | jelly glow ×1.5 at night | 라운드11에서 밤 발광 ×2.0·반경 ×1.4로 대체된 이전 측정값이다. | components/shared/ambient/scenes/deep.ts:createDeep |
| 117-119 | water tide was summer default / all in the same top-down view as the tide | 여름 전용 tide 기본 배경과 모든 물체 top-down 일반화는 바이옴 세계·standing 3/4·심해 side 예외로 대체됐다. | components/shared/ambient/world/world-scene.ts:createWorld; components/shared/ambient/art/manifest.ts:ArtSlot |
| 123-124 | tide included / tide is summer’s | 퇴역 tide를 여름 배경이나 fallback으로 다시 조립하는 근거로 쓰지 않는다. | app/ambient.css:.gs-season |
| 129-130 | late frames >20% | 현행 mountScene은 >34ms 비율>12% 또는 평균>21ms로 하향한다. 원문의 전 단계 governor 한계를 되살리지 않는다. | components/shared/ambient/scene-engine.ts:mountScene |
| 131-133 | tide animation rules / old data-poster-theme 7-pack coexists for now | 퇴역 컴포넌트의 별도 애니메이션 규격과 당시 공존 진행 메모는 현재 구현 목표가 아니다. | components/shared/ambient/ambient-layer.tsx:AmbientLayer; app/ambient.css:.gs-season |
| 139-140 | wake offscreen 0.35–0.5× | 현재 ensureLo의 0.28/0.32/0.36 배율로 대체됐다. | components/shared/ambient/scenes/summer.ts:ensureLo |
| 141-147 | animals are never hand-drawn / 7–9 colours delivered | 손그림 금지는 원문 자체에서 철회됐다. 7–9색은 당시 합격 묶음 관찰값이며 모든 미래 그림의 색 한계는 ART-13의 6–10색 계약이다. | components/shared/ambient/world/codex.ts:CODEX; components/shared/ambient/art/manifest.ts:ART_STYLE_SPEC |
| 157-161 | Top-down view is law / No open-licensed top-view duck exists | 전 물체 카메라 일반화는 stand/side 예외로 대체됐다. 공개 오리 자산이 전혀 없다는 문장은 당시 검색 결과일 뿐 현재 전체 자산 시장에 대한 사실로 유지할 수 없다. | components/shared/ambient/world/codex.ts:ViewKind; components/shared/ambient/assets.ts:drawFacing |
| 191-194 | 64–96px logical resolution as a global limit | 소유자 격자 개정으로 128칸 참나무 등 슬롯별 dotGrid/override가 정본이다. | components/shared/ambient/art/manifest.ts:dotGrid; components/shared/ambient/art/manifest.ts:ART_SLOTS |
| 195-199 | 2–3 blobs readable at128px / 1024 overkill / fit to4×screen px / in-place art:normalize/desaturate | 옛 거부 사례의 전역 덩이 수·고정 표시 크기는 현재 슬롯 brief로 대체됐다. 현재 원본1024·targetEdge/sourceRatio 정수배와 raw/normalized 분리로 옛public 제자리 처리 권한을 철회했다. | components/shared/ambient/art/manifest.ts:ART_STYLE_SPEC; components/shared/ambient/art/manifest.ts:targetEdge; scripts/ambient-art-pipeline.mjs:normalizeRun |
| 208-211 | 18min comet first tried | 아무도 못 만난 이전 조율값으로 SKY_EVENTS의 현행 평균 약8.8분으로 대체됐다. | components/shared/ambient/world/sky-events.ts:SKY_EVENTS |
| 212-214 | debut cap192 as live world rule | SIZE에 남은 이름만으로 철회된 데뷔나무 연대기를 활성화하지 않는다. 숫자 존재와 실제 생성 규칙을 구별한다. | components/shared/ambient/world/traces.ts:monthTraces |
| 215-220 | depth .8 / horizon .12 / proposals .30 and .20 | 소유자가 약한원근·작은밤하늘을 지적해 확정한 .6/.26의 이전값 또는 채택되지 않은 제안값이다. | components/shared/ambient/world/view.ts:DEPTH_FAR; components/shared/ambient/world/view.ts:HORIZON_V |
| 221-224 | Mountains stay below horizon / haze to58% screen height | 모든봉우리 지평선 아래는 ROUND07 산 문법으로 대체됐다. 화면.58 안개끝은 HAZE_END_GV.28의 지면좌표로 대체됐다. | docs/ambient/MOUNTAIN_DEPTH_RULES.md; components/shared/ambient/world/view.ts:HAZE_END_GV |
| 233-233 | am/pm segment | 현행 weatherAt/segmentBounds는 최소4시간의 세마디를 사용한다. 오전/오후두칸표로돌리지않는다. | components/shared/ambient/world/weather.ts:segmentBounds |
| 234-234 | chronicle(slug,y,m,d) replays world from birth | 소유자가 연대기를 없애고 월별흔적으로 바꿨다. | components/shared/ambient/world/traces.ts:monthTraces |
| 240-240 | snowman Dec20→27/Feb15→25 and lily pads3→12 | 날별건설/해빙은 월별12월2단·1월3단·2월1단으로대체. 연잎현행6월5/7월9/8월12이다. | components/shared/ambient/world/traces.ts:snowman; components/shared/ambient/world/traces.ts:lilypads |
| 244-245 | species.ts8live+20priority / animals never ours | 옛분리목록은 CODEX129종 정본으로 대체됐다. 동물도오리지널아트이며 Noto는 임시대체다. | components/shared/ambient/world/codex.ts:CODEX |
| 246-250 | root filter kept | 2026-09-06 눈편한테마는 모든등급에서 토큰팔레트이며 배경까지물드는루트filter는폐지됐다. | lib/ui/gfx.ts:eyeComfortAttrValue |
| 251-256 | off keeps eye-comfort filter / fixed lite one butterfly,no pointer,30–60 leaves,no walker/dust | filter는토큰팔레트로대체. 고정lite목록/입자수는현재loadBand와각scene목표함수로대체됐고 일반불변조건은계절가시성이다. | lib/ui/gfx.ts:eyeComfortAttrValue; components/shared/ambient/scene-engine.ts:loadBand; components/shared/ambient/scenes/autumn.ts:targetCount |
| 257-263 | binary toggle [감상하기/배경끄기] and two-state switch sequence | 원문뒤264~269의직접선택on/dim/off세상태규칙으로대체됐다. 다음동작을이름으로쓴순환버튼을복원하지않는다. | components/shared/ambient/showcase.tsx:AmbientModeSegment |
| 264-269 | dim opacity .28 | 2026-09-05 소유자가끄기처럼보인다고반려해캔버스.5로바꿨다. 퇴역tide에만.28잔존한다. | app/ambient.css:--amb-op |
| 270-273 | focus dim background opacity .28 | 현행캔버스는focus와ambientdim 모두 --amb-op .5이다. | app/ambient.css:--amb-op |
| 284-288 | the tide’s animations pause | WaterTide 자체는 AMB-01로 은퇴. 살아 있는 ambient canvas pause 계약으로 적용 범위를 유지한다. | AMB-01, lib/ui/ambient-pause.ts:holdAmbient |
| 289-293 | 11px 글꼴, 2026-09-05 변경 이력 | 11px는 작아 반려된 이전값이다. 현행 합격값13.5px만 규칙으로 유지한다. | app/globals.css:--text-body, UI-14 |
| 303-304 | four switches … to ON once | 계절 배경 기본 OFF는 AMB-12와 app/layout prepaint에서 확정. calm은 UI-04로 항상 ON이며 더 이상 switch가 아니다. 원문 내부의 오래된 all-ON 문구를 재시딩 지시로 실행하지 않는다. | lib/ui/motion.ts:ambientMode, app/layout.tsx:RootLayout, AMB-12, UI-04 |
| 312-313 | it is the only ambient animation; add nothing louder | 퇴역 tide를 유일한 배경이라고 한 범위는 단일 biome world/AMB-01로 대체. 현재 엔진 외 두 번째 배경을 만들지 않는 원칙은 존속한다. | AMB-01 |
| 367-367 | 일정당 전체 태그 최대 2개 | 현재 검증 정본은 전체 6개·대표 2개이며 이전 문구를 복원하면 허용 범위를 잘못 축소한다. | lib/schedules/event-validation.ts:MAX_EVENT_TAGS |
| 376-381 | Web = min-width641px / Mobile = ≤640px를 모든 화면 토폴로지의 유일한 기준으로 해석 | 폭만으로 topology를 정하면 tablet 및 낮은 coarse-pointer 화면을 놓친다. 현행 공유 QUERY를 따른다. 모바일 우선 글꼴/CSS의 출발점640/641 자체는 provenance로 보존한다. | lib/ui/breakpoints.ts:BREAKPOINTS, UI-06, UI-07 |
| 382-387 | 1920px에서 tier1→0 실측 | 특정 당시 내용·폰트로 얻은 관측값이며 고정 breakpoint나 모든 화면의 합격 tier가 아니다. UI-12는 실제 overflow0으로 검수한다. | UI-12, UI-15 |
| 455-471 | 오늘 숫자의 이전 1.12em, legacy .day-strip span 12.5px white pill, 반려 3개 도형 | 반려한 숫자/도형을 현행 선택지로 되살리지 않는다. 금지 항목과 이유는 UI-32 및 원문 이력에 보존한다. | UI-32, components/poster/public-poster.css:.day-strip .d-num |
| 455-471 | Google/Apple/Outlook/Notion 관례 설명과 glyph .88em/.7em 비율 | 당시 결정의 배경 설명이다. 현재 외부 서비스 상태나 글꼴별 보편 측정값으로 주장하지 않으며, 실제 확정1.3em·header 높이 계약을 유지한다. | UI-32 |
| 487-492 | ambient canvas z−1을 특정 탈출 filter로 보정하는 우회안 | 원문도 inverse/per-child filter를 반려한 설명이다. 루트 필터 없는 토큰방식을 보존하며 우회안을 구현하지 않는다. | UI-05, app/globals.css:html[data-eye-comfort="1"] |
| 493-500 | 유리 배경의 hardcoded rgb(255 254 251 /76%) | 기존 버그 원인이므로 새 표면에 재사용할 수치가 아니다. 토큰화 규칙과 해당 수치가 실패했던 근거를 보존한다. | UI-05, app/globals.css:--glass-cell |
| 501-503 | studio tide layer must hide under data-gfx=lite | 퇴역 tide 지시이며 같은 원문305–310의 lite한겹표시와도 충돌. 현행 ambient lite는 인지가능성을 남기고 soft/off가 숨김을 담당한다. | AMB-01, AMB-10 |
| 506-514 | folded aria-label/title 중 항상 native title, tier1 short-preview 별도라벨, 이전 보여주기 문구 | 같은 원문382–394가 한 짧은lbl과 접힌때만data-tip을 확정했다. 접근 가능한 이름은 유지하며 과거 label쌍/native중복툴팁을 복원하지 않는다. | UI-15 |
| 506-514 | tier3에서 decorative title 축소를 필수 현재 studio 동작으로 해석 | 원문61–64가 장식타이틀을 viewer로 옮겼다. 남은 chrome는 실제 overflow로 단계화하며 삭제된 studio타이틀을 복구하지 않는다. | UI-09, UI-12 |
| 543-544 | 매 변경마다 main에 자동 commit & push | 같은 원문의 L551 및 현재 사용자 작업 지시가 요청된 커밋과 금지된 push를 구분한다. 자동 배포 권한을 부여하지 않는다. | AGENTS.md:G-14 |
| 545-550 | 2,694개 오염 세션과 새벽 동시접속 4명 및 당시 scratch SQL | 사고 당시 측정 이력이다. 현재 운영 행 수·백업·실행 승인으로 재사용하지 않는다. | docs/agent/verification/OPEN_CHECKS.md |
| 566-567 | 의미 있는 작업마다 CURRENT_STATE에 결과 누적 | 승인된 bounded-memory 수명주기로 대체한다. 완료 이력은 주제 기록에 남겨 현재 상태의 일기장화를 막는다. | docs/agent/decisions/ADR-0020-bounded-memory-and-art-review.md |

## A-2 복원한 측정 계약 42개

각 항목은 검수 단위로 센다. 한 단위의 여러 상수나 절차를 개별 계약으로 부풀리지 않았다. 이번 작업은 **규칙 복원**이며 아래 브라우저/기기/캡처 실측을 새로 수행했다는 뜻이 아니다.

| 번호 | 원문 줄 | 복원한 조건 | 현재 규칙 |
|---|---|---|---|
| 1 (UI-M05) | 85-85 | avatar 정상 rail 예산58% | UI-11 |
| 2 (UI-M06) | 86-89 | rail폭20vw−16·grid auto auto minmax(0,1fr) auto·상태변경 폭/끝점 불변 | UI-10 |
| 3 (UI-M09) | 289-292 | viewer control cell36px·외부/중앙카드44px·본문13.5px, 글꼴 변경시 실측폭 고정 | UI-14 |
| 4 (UI-M18) | 393-394 | 모호한 효과 tooltip 약20자이하·괄호부연금지 | UI-15 |
| 5 (UI-M20) | 403-408 | 모바일재질12px/pill radius | UI-06 |
| 6 (UI-M22) | 417-417 | desktop셀 band13px·heart14px·play11px | UI-16 |
| 7 (UI-M26) | 449-454 | 좌우5회전환에서 지연hold의순간위치변화0px | UI-29 |
| 8 (UI-M28) | 458-463 | goldfade12px양끝·sheen1px·bloom3px·padding0 11px | UI-32 |
| 9 (UI-M29) | 463-465 | 모든poster날짜.d-num1.3em | UI-32 |
| 10 (UI-M31) | 468-469 | selection/todayring8 > ribbonhead7 > ribbon6 | UI-32 |
| 11 (UI-M32) | 469-471 | badge높이poster21px/studio18px,header높이와lane/card위치불변 | UI-32 |
| 12 (UI-M33) | 482-482 | press→serverconfirm두단계action은haptic2ticks | UI-27 |
| 13 (UI-M35) | 487-487 | 눈편한테마기본ON | UI-05 |
| 14 (UI-M38) | 498-500 | 배경ON·눈편함OFF/ON달력픽셀≥50%변화·blue≈−8·html/season/canvas computed filter/opacity/blend동일 | UI-05 |
| 15 (UI-M41) | 515-516 | filter≥132px·avatarflexshrink4·height≤620pxicons/45%·≤470pxavatar숨김 | UI-11 |
| 16 (UI-M42) | 506-518 | 참조manual실측:width1600→1000owner/developer overflow/overlap/2rows0;1147wide height900→380filter≥132/railoverflow0;forcedworkspace500dodgefade/hittest | UI-11, UI-12 |
| 17 (AMB-M01) | 109-110 | 심해 날씨 봉인·시간대 캡처: 6띠×5날씨; 띠내해시동일; 고유해시6 → 고정조건 30장 전체행렬과 같은계약. 기존selftest는2조건smoke뿐 | AMB-25 |
| 18 (AMB-M02) | 94-109 | 11개 바이옴·카메라 전이: 11 biome·620ms/ease-out-quint/no overshoot → PAN_DUR0.62초/easeOutQuint/noovershoot; reduced예외 | AMB-03 |
| 19 (AMB-M05) | 116-116 | 월→계절 구간: 12–2/3–5/6–8/9–11 → 동일 seasonOfMonth 계약 | AMB-02 |
| 20 (AMB-M08) | 130-131 | 줌 좌표 실측: offsetWidth; pointer÷zoom; ≥1700px studio zoom → rect.width/offsetWidth 비율·offsetWidth/Height·포인터나눗셈 | AMB-11, AMB-04 |
| 21 (AMB-M09) | 135-136 | 연속여력 자동평가: load0–1,+.06/−.15,매90frames → 동일 +34ms/12%/21ms 하향 및3%/18.5ms상향조건 | AMB-27 |
| 22 (AMB-M10) | 138-138 | 품질고정값: max1,lite.3 → loadBand max1,lite.3; fixture/fixed에auto미적용 | AMB-27 |
| 23 (AMB-M12) | 152-153 | 가을도토리상한: max6 → ACORN_MAX6; 넘으면오래된활성도토리fade | AMB-26 |
| 24 (AMB-M13) | 154-154 | 봄풀띠: 12strips → ROWS12 | AMB-26 |
| 25 (AMB-M14) | 155-156 | DPR와재굽기 관찰: runtimeDPRflip→monthchange2s뒤rebake → mount중DPR불변,크기별결정rng | AMB-09, AMB-27 |
| 26 (AMB-M15) | 167-167 | 물고기목표와큰개체: 2–14×area; bigload.6/.9; two schools → fishTarget현재load<.12이면0; bigTarget.6/ .9 | AMB-26 |
| 27 (AMB-M16) | 168-171 | 위협/놀람/먹이 측정: loom=rate/d;전염90px;splash140px;먹이1s → 동일현재위협함수·90/140/1.0분기 | AMB-21, AMB-26 |
| 28 (ART-M04) | 187-188 | Standing카메라: high3/4 front+groundcontact → slotview별flat/shadow/stand;심해side예외 | ART-02, AMB-04 |
| 29 (ART-M05) | 193-194 | 픽셀색과경계: 물체6–10색,AA없음,동일색계열어두운외곽선 → 동일현행ART_STYLE_SPEC. 넓은machinecolorlimit와별개 | ART-13 |
| 30 (AMB-M17) | 203-206 | 스프라이트축/변환 검사: axis≈−16°;rot+(π−art);동일합성unit계약 → ART_HEADING 별똥−16.2/혜성−16.9, aimSprite수학 | AMB-28 |
| 31 (AMB-M18) | 207-207 | 혜성시간: 26s;별똥별과같은scale → SKY_EVENTS.comet.dur26 | AMB-28 |
| 32 (AMB-M19) | 209-210 | 결정성 분할진행: advance1000 == advance250×4;11biomes동시공유 → 동일URL/seed/frame 및분할진행동치 | AMB-25, AMB-23 |
| 33 (AMB-M20) | 211-211 | 혜성평균간격: 약8.8min;이전18min철회 → SKY_EVENTS gap120–300/chance.4 | AMB-28 |
| 34 (AMB-M23) | 214-216 | 바닥스쿼시·원근: GROUND_SQUASH.7;depth.60→1.00/.05 → 동일GROUND_SQUASH/DEPTH_FAR/depthScale | AMB-04 |
| 35 (AMB-M24) | 216-220 | 지평선과좌표: HORIZON.26;old.12;제안.30/.20;aboveHz/groundYAt/groundK → 현행HORIZON_V.26+거리/지면비율좌표 | AMB-04 |
| 36 (AMB-M26) | 225-228 | 지면투영·판정 측정: toScreen belowhorizon;y-sort;sharedgy/groundY → y=hz+v×(h−hz),스폰/클릭/자국동일경계 | AMB-04, AMB-15 |
| 37 (AMB-M31) | 242-243 | 희귀도 제약: 5tiers;legend1/session;rare동시1 → TIER_ORDER/SpawnDirector동일 | AMB-22 |
| 38 (AMB-M33) | 247-250 | 그래픽기기판정: software/cores≤2→soft;bad2consecutivevisits→lite → probeGfx 동일 +토큰eyeComfort | AMB-10 |
| 39 (AMB-M35) | 263-269 | 계절배경세상태·반속도: on/dim/off;3buttons;1click;opacity.28;half rate → 직접3상태선택·frame절반;opacity.5로소유자대체 | AMB-12 |
| 40 (AMB-M36) | 270-273 | 집중모드·입장애니메이션: 배경opacity.28;backwards;both pins1 → 배경만.5;backwards;끝값var(--amb-op) | AMB-14 |
| 41 (G-M12) | 568-568 | L2/L3 구현 전에 ACTIVE_PLAN 기록 | G-12, G-16 |
| 42 (G-M13) | 582-584 | 독립 읽기전용 검토자3명 병렬·메인 통합·P0 전부+비P0 입구묶음≤4·대상시나리오·같은seed 전후비교 | AMB-29 |

## 숫자·임계값·측정 절차 전수 대장

`retained` 기존 보존, `restored` 이번 복원, `code-owned` 코드 정본, `retired` 과거/대체된 값, `owner-clarified-scope` 소유자가 확정한 적용 범위. 날짜·ADR 번호·경로의 숫자는 측정 계약으로 세지 않고 A-1 문맥에 보존한다.

| 항목 | 원문 줄 | 상태 | 조건·원문 → 현행 | 대상·근거 | 판단 이유 |
|---|---|---|---|---|---|
| UI-M01 | 39-56 | retained | 의미색 8종·태그/하트 의미 고정 | UI-02, docs/ux/UI_RULES.md:UI-02 | 기존 분할에도 8종 목록이 유지됨; 한국어 원어를 보강했다. |
| UI-M02 | 44-45 | retained | 컨텍스트의 물빛 primary action은 저장 1개 | UI-03, docs/ux/UI_RULES.md:UI-03 | 단일 주동작은 기존 규칙에 유지되어 있었고 색 의미를 명료화했다. |
| UI-M03 | 61-64 | retained | studio 북쪽 chrome 한 줄·정해진 순서·빈 컨테이너는 pointer-events none | UI-09, UI-13, docs/ux/UI_RULES.md:UI-09, components/studio/studio-shell.tsx:StudioShell | 숫자 한 줄과 순서는 기존 UI-09에 보존됨. |
| UI-M04 | 63-64 | code-owned | topbar의 세 layout cell과 interactive child만 auto | UI-13, components/studio/studio-calm-layer.css:.studio-topbar | 세 셀의 구조는 현재 JSX/CSS가 소유하며 비상호작용 영역이 배경 입력을 막지 않는 계약은 UI-13이 소유한다. |
| UI-M05 | 85-85 | restored | avatar 정상 rail 예산58% | UI-11, components/studio/studio-shell.css:.avatar-slot, docs/ux/UI_RULES.md:UI-11 | 요약 문서에서 빠진58%를 검수 표에 복원했다. 낮은 창의45%/숨김 예외는 별도 높이 계약을 따른다. |
| UI-M06 | 86-89 | restored | rail폭20vw−16·grid auto auto minmax(0,1fr) auto·상태변경 폭/끝점 불변 | UI-10, components/studio/studio-calm-layer.css:--rail-w, components/studio/studio-calm-layer.css:.studio-role-tools | 현재 계산식과 grid를 확인하고 코드 정본을 가리키는 수치 검수 조건을 복원했다. |
| UI-M08 | 278-283 | code-owned | 도감 size(cm)·generation wave1–3·출현조건은 자기 계절에서 도달 가능 | AMB-18, components/shared/ambient/world/codex.ts, tests/unit/ambient-codex.test.ts | 정확한 종별 값·세대는 codex가 소유. 검수 계약은 AMB-18에 연결한다. |
| UI-M09 | 289-292 | restored | viewer control cell36px·외부/중앙카드44px·본문13.5px, 글꼴 변경시 실측폭 고정 | UI-14, components/poster/public-poster.css:.avatar-ctl-preview, app/globals.css:--text-body | 명시 수치가 빠져 있었고 현재 CSS와 일치해 복원했다. 36px는 셀, padding/border 포함 외부카드는44px다. |
| UI-M10 | 290-291 | retired | 이전 viewer 본문11px | UI-14, app/globals.css:--text-body | 각주처럼 작다고 반려되어13.5px로 바뀐 이전값; 새 합격값으로 복원하지 않는다. |
| UI-M11 | 292-293 | code-owned | viewer data-pchrome 단계1/2/3와 overflow 실측 | UI-12, components/poster/public-poster.tsx, components/poster/public-poster.css:html[data-pchrome] | 단계 숫자는 코드 소유. 단계 전환은 고정 너비 대신 실측 계약을 따른다. |
| UI-M12 | 294-300 | retained | 아바타3상태 상시 표시·OFF→right1클릭·모든 상태 폭변화0 | UI-14, components/poster/public-poster.tsx:.avatar-ctl-preview, docs/ux/UI_RULES.md:UI-14 | 3상태·1클릭·고정폭은 기존 규칙에 모두 남아 있었음; 검수 표에 비교 절차를 명시했다. |
| UI-M13 | 303-304 | code-owned | SETTINGS_EPOCH2026-09-04에서 기존 preference키를1회 reset | lib/ui/motion.ts:SETTINGS_EPOCH, lib/ui/motion.ts:SETTINGS_EPOCH, app/layout.tsx:RootLayout | 날짜는 코드가 소유하는 배포세대 식별값. 원문 읽을 때마다 reset하라는 명령이 아니다. |
| UI-M14 | 303-304 | retired | motion/eye/calm/ambient 네 switch 모두 기본ON | UI-04, AMB-12, lib/ui/motion.ts:ambientMode, app/layout.tsx:RootLayout | ambient는 후속 owner결정 기본OFF, calm은 항상ON으로 switch가 제거됨. 오래된4종ON 문구를 부활시키지 않는다. |
| UI-M15 | 305-312 | retired | lite에서 caustic1layer·계절ON/모션ON/webwidth 결합·유일한 ambient animation | AMB-01, docs/ambient/ENGINE_RULES.md:AMB-01, components/shared/ambient/ambient-layer.tsx:AmbientLayer | 퇴역 CSSWaterTide 전용 측정/가시성 규칙. 단일 biome world와 현행 gfx 정책으로 대체됨. |
| UI-M16 | 376-381 | code-owned | 기기모바일≤640px/기본CSSweb≥641px; 실제studio agenda≤999,poster≤1040 | UI-07, lib/ui/breakpoints.ts:BREAKPOINTS, lib/ui/breakpoints.ts:MOBILE_QUERY, lib/ui/breakpoints.ts:STUDIO_AGENDA_QUERY, lib/ui/breakpoints.ts:POSTER_AGENDA_QUERY | 640/641를 모든topology의 기준으로 복원하면현행태블릿아젠다를훼손. 공통query를정본으로명시. |
| UI-M17 | 382-387 | retired | 1920px에서 한짧은label 적용뒤 chrome tier1→0 관측 | UI-12, UI-15, docs/ux/UI_RULES.md:UI-12 | 당시역할/폰트/내용에서의결과. 1920이 언제나tier0이어야한다는새임계값이아님. overflow0실측으로계승. |
| UI-M18 | 393-394 | restored | 모호한 효과 tooltip 약20자이하·괄호부연금지 | UI-15, docs/ux/UI_RULES.md:UI-15 | 기존short result서술에서빠진글자수·형식을복원. |
| UI-M19 | 395-400 | retained | 한control에유용한아이콘1개·그룹어휘1개 | UI-16, docs/ux/UI_RULES.md:UI-16 | 원규칙수량은존속. 접힐때leading아이콘우선선택을명시. |
| UI-M20 | 403-408 | restored | 모바일재질12px/pill radius | UI-06, components/poster/public-poster.css, components/studio/studio-shell.css, docs/ux/UI_RULES.md:UI-06 | 모바일cream/pill만남았던요약에원래12px범주를복원. 모든컴포넌트를12px로강제하는신규설계아님. |
| UI-M21 | 407-408 | code-owned | landscape감지max-height640px와pointer coarse | UI-06, UI-07, lib/ui/breakpoints.ts:STUDIO_AGENDA_QUERY, lib/ui/breakpoints.ts:POSTER_AGENDA_QUERY | 기존classgate규칙은존속. 수치를공통query정본으로명시. |
| UI-M22 | 417-417 | restored | desktop셀 band13px·heart14px·play11px | UI-16, components/poster/public-poster.tsx:Play, components/poster/public-poster.tsx:Heart, components/poster/public-poster.tsx:Sprout | 현재desktopJSX와일치하는크기를복원. agenda Play13은별도기존code현황으로명시;이번작업에서크기변경없음. |
| UI-M23 | 426-428 | retained | stillframe은 scene.step dt=0초기화+lateasset boundedretry | AMB-13, UI-28, components/shared/ambient/scene-engine.ts:stillFrame, docs/ambient/ENGINE_RULES.md:AMB-13 | dt=0은ENGINE기존규칙에존속. UI에서투명CSSgate까지연결해복원. |
| UI-M24 | 431-435 | retained | scrollbar-width none / WebKit scrollbar0size;실제scroll기능유지 | UI-17, app/globals.css:scrollbar-width, docs/ux/UI_RULES.md:UI-17 | 기존UI17규칙과글로벌CSS에존속. |
| UI-M25 | 436-443 | code-owned | place한개에name한개·AREA_ORDER목록과data-act등록검사 | UI-34, lib/activity/labels.ts:AREA_ORDER | 목록의이름·개수는code정본. 장소/기기구분·등록검사는기존UI34에존속. |
| UI-M26 | 449-454 | restored | 좌우5회전환에서 지연hold의순간위치변화0px | UI-29, components/studio/studio-shell.css:rail-card-settle-l, components/poster/public-poster.css:rail-card-settle-l | 방향무관hold서술만남았던요약에측정반복수와0px합격기준복원. |
| UI-M27 | 451-454 | retired | 반려hold translateX±6px→12px점프,5회중5점프 | UI-29, docs/ux/UI_RULES.md:UI-29 | 실패한옛수치. 재현/원인근거로표기하되합격기준으로복원하지않음. |
| UI-M28 | 458-463 | restored | goldfade12px양끝·sheen1px·bloom3px·padding0 11px | UI-32, components/poster/public-poster.css:.public-day.today .day-strip strong, components/studio/studio-shell.css:.studio-day.today .studio-day-head strong | 현재CSS와맞춰복원. topwhite sheen plateau는현재14px이며goldfade12px와구별;원문same-way를모든stop12로잘못해석하지않음. |
| UI-M29 | 463-465 | restored | 모든poster날짜.d-num1.3em | UI-32, components/poster/public-poster.css:.day-strip .d-num | today뿐아니라모든날짜에대한확정크기복원. |
| UI-M30 | 463-465 | retired | 이전숫자1.12em·legacywhitechip12.5px·Hangul.88em/digit.7em추정 | UI-32, components/poster/public-poster.css:.day-strip .d-num | 앞둘은반려값. 글리프비율은당시서체의설명근거이며모든폰트의보편측정계약으로승격하지않음. |
| UI-M31 | 468-469 | restored | selection/todayring8 > ribbonhead7 > ribbon6 | UI-32, app/globals.css:--z-cal-select-ring, app/globals.css:--z-cal-ribbon-head, app/globals.css:--z-cal-ribbon | 정확한layer수치와실제band교차장면검수를복원. |
| UI-M32 | 469-471 | restored | badge높이poster21px/studio18px,header높이와lane/card위치불변 | UI-32, components/poster/public-poster.css:.public-day.today .day-strip strong, components/studio/studio-shell.css:.studio-day.today .studio-day-head strong | fixedheader서술에빠진21/18px와이웃칸비교절차복원. |
| UI-M33 | 482-482 | restored | press→serverconfirm두단계action은haptic2ticks | UI-27, components/poster/public-poster.tsx:hapticTick, docs/ux/UI_RULES.md:UI-27 | 기존haptic호출서술에빠진두단계계약복원. 두stage없는localtoggle에중복진동을추가하라는의미아님. |
| UI-M34 | 483-487 | retained | 생동감있는동작기본ON·attribute부재/설정의inverse값 | UI-27, lib/ui/motion.ts:reduceMotionEnabled, docs/ux/UI_RULES.md:UI-27 | 기존규칙에기본값과역의미가존속. |
| UI-M35 | 487-487 | restored | 눈편한테마기본ON | UI-05, lib/ui/motion.ts:eyeComfortEnabled, app/layout.tsx:RootLayout | 기존UI05에빠진기본값을현재코드와대조해복원. |
| UI-M36 | 489-490 | code-owned | bodychildambientz-index−1과htmlbackground전파경계 | UI-13, app/ambient.css:.gs-season, app/globals.css:body | z값은code소유. 필터/배경전파원인과html배경금지는UI13으로복원. |
| UI-M37 | 493-498 | retired | hardcodedglass rgb(255 254 251 /76%) | UI-05, app/globals.css:--glass-cell, components/studio/studio-calm-layer.css:.studio-day | 설정을무력화한이전literal. RGBtoken+use-sitealpha계약으로교체되어재사용금지. |
| UI-M38 | 498-500 | restored | 배경ON·눈편함OFF/ON달력픽셀≥50%변화·blue≈−8·html/season/canvas computed filter/opacity/blend동일 | UI-05, app/globals.css:--glass-cell, app/globals.css:--glass-head, app/globals.css:--glass-panel | 원문측정계약의조건·수치·대상을전부복원. blue≈−8은근사관측참조이며허용오차나색차정의를새로정하지않음. |
| UI-M39 | 502-503 | retired | studioTide를gfxlite에서숨김 | AMB-01, AMB-10, docs/ambient/ENGINE_RULES.md:AMB-01, docs/ambient/ENGINE_RULES.md:AMB-10 | 퇴역Tide대상이며원문305–310lite1layer규칙과도충돌. 현행scene lite는부하감소/존재유지,soft/off가숨김. |
| UI-M40 | 509-514 | retained | 측정tiers1/2/3·connected&&clientWidth>0·0×0측정금지·remount재관찰 | UI-12, components/studio/studio-shell.tsx:chromeTier, components/studio/studio-shell.tsx:shellEl | 핵심조건은기존UI12존속;수치표기와remount검수절차를명확히했다. |
| UI-M41 | 515-516 | restored | filter≥132px·avatarflexshrink4·height≤620pxicons/45%·≤470pxavatar숨김 | UI-11, components/studio/studio-shell.css:.avatar-rail-filter, components/studio/studio-shell.css:.avatar-slot, components/studio/studio-calm-layer.css:@media (min-width: 641px) and (max-height: 620px), components/studio/studio-calm-layer.css:@media (min-width: 641px) and (max-height: 470px) | 현행CSS값확인후복원.45%는원문이지칭한manual과현행CSS에있는낮은창예외. |
| UI-M42 | 506-518 | restored | 참조manual실측:width1600→1000owner/developer overflow/overlap/2rows0;1147wide height900→380filter≥132/railoverflow0;forcedworkspace500dodgefade/hittest | UI-11, UI-12, docs/ux/chrome-compaction-manual.md:검증 | 원문506/518이지정한매뉴얼측정절차를활성검수표로보강. QAfixture수치를runtimebreakpoint로바꾸지않는다. |
| AMB-M01 | 109-110 | restored | 심해 날씨 봉인·시간대 캡처: 6띠×5날씨; 띠내해시동일; 고유해시6 → 고정조건 30장 전체행렬과 같은계약. 기존selftest는2조건smoke뿐 | AMB-25 | 서술로축약됐던 전체측정조건 복원. 이번캡처실행아님. |
| AMB-M02 | 94-109 | restored | 11개 바이옴·카메라 전이: 11 biome·620ms/ease-out-quint/no overshoot → PAN_DUR0.62초/easeOutQuint/noovershoot; reduced예외 | AMB-03 | 원문92~100의 UI-M07과같은계약이라합산시중복제거. UI-M07(원문94–98)과 하나로 합산. 11개 바이옴 레지스트리 목록은 코드 정본이며 전이 조건은 AMB-03. |
| AMB-M03 | 111-111 | retired | 심해 밤발광: ×1.5 → 라운드11 현재발광×2.0·반경×1.4 | components/shared/ambient/scenes/deep.ts:createDeep | 현행코드에소유자검토후상향근거존재. 이전한계를복원하지않는다. |
| AMB-M04 | 112-112 | code-owned | 심해 해설 층: marine snow3layers → createDeep 해설3층 | components/shared/ambient/scenes/deep.ts:createDeep | 입자층수는장면구현정본. AMB06/25에서같은함수참조. |
| AMB-M05 | 116-116 | restored | 월→계절 구간: 12–2/3–5/6–8/9–11 → 동일 seasonOfMonth 계약 | AMB-02 | 월을넘긴프레임과실제KST특수일을별도로검수하도록복원. |
| AMB-M06 | 126-127 | code-owned | 가을낙엽종류: 7species → SPECIES7종 +별도ACORN | components/shared/ambient/scenes/autumn.ts:SPECIES | 전엔티티생물도감수와다른씬내잎모양목록. |
| AMB-M07 | 129-129 | retired | 구형자가조절한계: 늦은프레임>20% → >34ms비율>12% 또는평균>21ms | components/shared/ambient/scene-engine.ts:mountScene | 이미현행의측정조건으로대체된상한이며 AMB27에현재값복원. |
| AMB-M08 | 130-131 | restored | 줌 좌표 실측: offsetWidth; pointer÷zoom; ≥1700px studio zoom → rect.width/offsetWidth 비율·offsetWidth/Height·포인터나눗셈 | AMB-11, AMB-04 | 측정도구와캔버스좌표계를함께보존. breakpoint는화면레이아웃코드가소유. |
| AMB-M09 | 135-136 | restored | 연속여력 자동평가: load0–1,+.06/−.15,매90frames → 동일 +34ms/12%/21ms 하향 및3%/18.5ms상향조건 | AMB-27 | 단순연속조절서술에서평가기간·판정절차복원. |
| AMB-M10 | 138-138 | restored | 품질고정값: max1,lite.3 → loadBand max1,lite.3; fixture/fixed에auto미적용 | AMB-27 | 값뿐아니라자동평가적용대상을명시. |
| AMB-M11 | 139-140 | retired | 부드러운항적 해상도: offscreen.35–.5× → ensureLo .28/.32/.36 | components/shared/ambient/scenes/summer.ts:ensureLo | 현재더낮은단계식LOD로대체. DPR mount불변은AMB09/27로보존. |
| ART-M01 | 142-142 | retired | 당시합격색수 관찰: 7–9colours → 합격묶음관찰값; 일반화풍6–10색은현행 | ART-13 | 당시표본의관찰수를모든그림의새합격한계로일반화하지않는다. |
| ART-M02 | 146-147 | code-owned | 생물회전 수학: 180°rotation금지;topviewforward=up → drawFacing 좌우flip+제한pitch; drawSprite전진축 | components/shared/ambient/assets.ts:drawFacing, components/shared/ambient/assets.ts:drawSprite | 옆모습배가뒤집히는반려패턴은AMB20규칙으로보존. |
| AMB-M12 | 152-153 | restored | 가을도토리상한: max6 → ACORN_MAX6; 넘으면오래된활성도토리fade | AMB-26 | 숫자는코드정본이며활성·fade중상태를구별. |
| AMB-M13 | 154-154 | restored | 봄풀띠: 12strips → ROWS12 | AMB-26 | 행동구현숫자를활성조회계약에되돌림. |
| AMB-M14 | 155-156 | restored | DPR와재굽기 관찰: runtimeDPRflip→monthchange2s뒤rebake → mount중DPR불변,크기별결정rng | AMB-09, AMB-27 | 2초는과거증상이지허용지연수치아님. 검사대상은불필요rebake/팝핑. |
| AMB-M15 | 167-167 | restored | 물고기목표와큰개체: 2–14×area; bigload.6/.9; two schools → fishTarget현재load<.12이면0; bigTarget.6/ .9 | AMB-26 | 원문을하한항상2로오독하지않게현행분기까지명시. 두학교/출입은createSummer가소유. |
| AMB-M16 | 168-171 | restored | 위협/놀람/먹이 측정: loom=rate/d;전염90px;splash140px;먹이1s → 동일현재위협함수·90/140/1.0분기 | AMB-21, AMB-26 | 줌보정캔버스좌표와debug반응확인절차를복원. |
| ART-M03 | 180-181 | code-owned | 파일산정: slot당1; variants id-n → slotFiles:singleton=id.png,variants>1이면id-n | components/shared/ambient/art/manifest.ts:slotFiles | seasons곱을만들지않는파일명정본. |
| ART-M04 | 187-188 | restored | Standing카메라: high3/4 front+groundcontact → slotview별flat/shadow/stand;심해side예외 | ART-02, AMB-04 | 카메라와접촉앵커의적용대상보존. |
| ART-M05 | 193-194 | restored | 픽셀색과경계: 물체6–10색,AA없음,동일색계열어두운외곽선 → 동일현행ART_STYLE_SPEC. 넓은machinecolorlimit와별개 | ART-13 | 실제slotpx로합격본과비교하며소유자판단없이완화하지않음. |
| ART-M06 | 193-193 | retired | 논리격자 전역수치: 64–96px → dotGrid/slotoverride;참나무128등예외 | components/shared/ambient/art/manifest.ts:dotGrid, components/shared/ambient/art/manifest.ts:ART_SLOTS | 20260907소유자규격개정이전전역범위. |
| ART-M07 | 195-197 | retired | 덩이/표시크기/원본: 2–3blobs at128px;1024overkill → slotbrief+ArtSlot.px,현재1024투명원본/정수배정리본 | ART-13 | 당시복잡한표본반려를현재모든엔티티의덩이수나캔버스상한으로쓰지않음. |
| ART-M08 | 197-199 | retired | 저장크기/제자리처리: 4×slotpx;128–512;trees512;props128–256;publicnormalize/desaturate → targetEdge/sourceRatio;raw보존→별도normalized | components/shared/ambient/art/manifest.ts:targetEdge, components/shared/ambient/art/manifest.ts:sourceRatio, scripts/ambient-art-pipeline.mjs:normalizeRun | 임의축소및제자리파괴위험을현재파이프라인이대체. ART05/06/13에서원본격자·정수배·화면대조복원. |
| ART-M09 | 201-202 | code-owned | 하늘파일 재고: 달위상8/구름four kinds → 현재ART_SLOTS의sky파일계획 | components/shared/ambient/art/manifest.ts:ART_SLOTS | 설명용예시개수는독립상한아님. 이미지version변화rebake는AMB23. |
| AMB-M17 | 203-206 | restored | 스프라이트축/변환 검사: axis≈−16°;rot+(π−art);동일합성unit계약 → ART_HEADING 별똥−16.2/혜성−16.9, aimSprite수학 | AMB-28 | 대충눈대중과잘못된flip부호를막는실측/변환계약. |
| AMB-M18 | 207-207 | restored | 혜성시간: 26s;별똥별과같은scale → SKY_EVENTS.comet.dur26 | AMB-28 | 크기과장대신통과동작으로정체성보존. |
| AMB-M19 | 209-210 | restored | 결정성 분할진행: advance1000 == advance250×4;11biomes동시공유 → 동일URL/seed/frame 및분할진행동치 | AMB-25, AMB-23 | 가변감독중복step과출력결정성을분리해서검수. |
| AMB-M20 | 211-211 | restored | 혜성평균간격: 약8.8min;이전18min철회 → SKY_EVENTS gap120–300/chance.4 | AMB-28 | 정확한정기8.8분타이머라는뜻아님.18분초기값은폐기된조율. |
| AMB-M21 | 213-214 | code-owned | 축척정본 값: TILE64;leaf12–18;print18;crown128;debut192;flower24–28 → TILE64;SIZE leaf16/printSole18/treeCrownW128/flower26 | components/shared/ambient/world/scale.ts:TILE, components/shared/ambient/world/scale.ts:SIZE | 개별배치치수는SIZE/slot이소유. debut192가남아도철회연대기를복원하지않음. |
| AMB-M22 | 213-213 | owner-clarified-scope | 크기비 비교범위: biggest:smallest≤12,집합불명확 → 같은엔티티변형끼리만최대:최소≤12 | AMB-04 | 2026-09-09사용자응답으로범위확정. 다른엔티티비교·SIZE수정없음. |
| AMB-M23 | 214-216 | restored | 바닥스쿼시·원근: GROUND_SQUASH.7;depth.60→1.00/.05 → 동일GROUND_SQUASH/DEPTH_FAR/depthScale | AMB-04 | 소유자확정시각값변경전판단필수. 옛.8약한원근값철회. |
| AMB-M24 | 216-220 | restored | 지평선과좌표: HORIZON.26;old.12;제안.30/.20;aboveHz/groundYAt/groundK → 현행HORIZON_V.26+거리/지면비율좌표 | AMB-04 | 채택되지않은.30/.20과이전.12는활성값이아님. |
| AMB-M25 | 221-224 | retired | 봉우리·안개끝: 모든봉우리belowHz;화면높이58%안개끝 → 산문법예외;HAZE_ALPHA.13,HAZE_END_GV.28 | AMB-05, components/shared/ambient/world/view.ts:HAZE_END_GV, components/shared/ambient/world/view.ts:HAZE_ALPHA | ROUND07산문법과현재지면비율fog가대체. 화면.58/지면.28혼용금지. |
| AMB-M26 | 225-228 | restored | 지면투영·판정 측정: toScreen belowhorizon;y-sort;sharedgy/groundY → y=hz+v×(h−hz),스폰/클릭/자국동일경계 | AMB-04, AMB-15 | 숫자좌표식과실제경계의동일성을검수. |
| AMB-M27 | 231-232 | code-owned | 월드날·6시간대: 현재달오늘/과거말일/미래1일;6KSTbands → 현행worldTime/월날짜선택 | components/shared/ambient/world/time.ts:DAY_BANDS, components/shared/ambient/scene-engine.ts:mountScene | AMB02/07이의미를유지하며서비스가수치/태양고도계산을소유. |
| AMB-M28 | 233-234 | retired | 구형날씨분할: am/pm2segments → segmentBounds3마디·최소4시간 | components/shared/ambient/world/weather.ts:segmentBounds, components/shared/ambient/world/weather.ts:SEGMENT_MIN_H | 현행날씨마디로대체된규칙. |
| AMB-M29 | 235-239 | retired | 철회연대기수치: 2023-05/2025-10-01;4→14cm;Apr–Sep;45cm/1yr;3m/5yr;11m/20yr;cap20m;15/80cm;radiusheight/12;u.78v.062;Feb15;60%;cap6/life6 → 연대기제거·월별monthTraces | components/shared/ambient/world/traces.ts:monthTraces | 소유자가제거한데뷔나무/도토리성장연대기. 현재SIZE비율계약과무관. |
| AMB-M30 | 240-240 | retired | 월별흔적구형날수: snowmanDec20–27/Feb15–25;lily3→12 → snowman12월2/1월3/2월1;연잎6월5/7월9/8월12 | components/shared/ambient/world/traces.ts:snowman, components/shared/ambient/world/traces.ts:lilypads | 월별전환소유자결정으로대체된날짜/장수. |
| AMB-M31 | 242-243 | restored | 희귀도 제약: 5tiers;legend1/session;rare동시1 → TIER_ORDER/SpawnDirector동일 | AMB-22 | 서술에숨었던숫자상한을활성규칙에복원. |
| AMB-M32 | 244-244 | retired | 종목록구형재고: species.ts8live+20priority → CODEX129실재종정본 | components/shared/ambient/world/codex.ts:CODEX | 분리목록폐기. 현재종수는추가/삭제를막는한계아님. |
| AMB-M33 | 247-250 | restored | 그래픽기기판정: software/cores≤2→soft;bad2consecutivevisits→lite → probeGfx 동일 +토큰eyeComfort | AMB-10 | 한표본으로배경전체숨기는반려패턴차단.루트filter유지는폐기. |
| AMB-M34 | 253-255 | retired | 옛lite고정행동/개수: onecaustic/halfwake/ring1/onebutterfly/nopointer/leaves30–60/nowalker → 현재loadBand및각scene의load별target/행동 | components/shared/ambient/scene-engine.ts:loadBand, components/shared/ambient/scenes/autumn.ts:targetCount | 현행load.3에연속목표를적용하므로옛고정개수표복원안함. 계절가시성은AMB10보존. |
| AMB-M35 | 263-269 | restored | 계절배경세상태·반속도: on/dim/off;3buttons;1click;opacity.28;half rate → 직접3상태선택·frame절반;opacity.5로소유자대체 | AMB-12 | .28은퇴역tide만남은구형값임을명시하고현재계약복원. |
| AMB-M36 | 270-273 | restored | 집중모드·입장애니메이션: 배경opacity.28;backwards;both pins1 → 배경만.5;backwards;끝값var(--amb-op) | AMB-14 | computed opacity/filter/blend를텍스트와분리해월전환전후확인.旧.28은철회. |
| AMB-M37 | 275-277 | code-owned | 도감종수·조건: 3catalogues129species → CODEX/CodexEntry 정본;wave1–3는다음원문278UI-M08과연결 | components/shared/ambient/world/codex.ts:CODEX, components/shared/ambient/world/codex.ts:CodexEntry | 재고/분류수는생성대상정본이며수치고정규칙아님. |
| AMB-M38 | 101-277 | retired | 숫자이지만측정계약아닌표기: 2026날짜·ADR/PLAN번호·P0/P1/P2/P3·revision/version·round번호 → 원본아카이브의provenance/history로유지 |  | 동작한계/측정절차와구분. 완료단계번호를다음실행지시로재활성화하지않는다. |
| G-M01 | 317-321 | code-owned | Next.js 15·React 19 및 타입/lint/build/unit/e2e 명령 | G-12, package.json:dependencies, package.json:scripts | 설치 범위와 실행 명령은 package.json 정본. 문서 분할이 버전을 바꾸지 않는다. |
| G-M02 | 328-328 | retained | 달 이동은 클라이언트 상태, 달 URL은 최초·직접 진입만 | UI-36, components/studio/studio-shell.tsx:moveMonth, docs/agent/decisions/ADR-0005-month-routes-cold-entry-only.md | 현재 상태 갱신 및 ADR의 동작 계약 유지. |
| G-M03 | 332-361 | retained | KST·세 역할·세 서버 스코프·Google 로그인+유효 unlock grant | G-04, G-05, G-06, lib/permissions/roles.ts, docs/agent/domain-rules/AUTH.md | 역할/스코프 개수와 두 조건을 유지. 퇴역 UI와 서버 모델 구분. |
| G-M04 | 367-367 | retired | 전체 태그 최대 2개 | G-04, lib/schedules/event-validation.ts:MAX_EVENT_TAGS | 현재 전체 최대6개·대표 최대2개와 불일치하는 구문. 대표2 계약은 보존하고 전체2 문구만 철회. |
| G-M05 | 367-367 | code-owned | 태그6개·대표2개 상한 | UI-02, lib/schedules/event-validation.ts:MAX_EVENT_TAGS, lib/schedules/event-validation.ts:MAX_PRIMARY_TAGS | 검증 코드가 현재 상한을 소유. 태그 전체와 대표색을 혼동하지 않는다. |
| G-M06 | 370-370 | code-owned | 모바일≤640px, agenda/가로터치는 별도 조건 | UI-07, lib/ui/breakpoints.ts:BREAKPOINTS, lib/ui/breakpoints.ts:MOBILE_QUERY | 기기 기준과 studio/poster topology 기준 분리. |
| G-M07 | 522-527 | retained | 직렬 마지막 쓰기 우선·실제 진행 중 작업 수로 beforeunload·동작별 좁은 게이트 | G-11, UI-25, UI-36, docs/ux/UI_RULES.md:UI-36 | 시간 지연 상수가 아닌 실제 작업 완료 상태라는 측정/절차 계약 유지. |
| G-M08 | 531-544 | retained | 계획→구현→권한/회귀/시각/모션 검증, 타입+lint+build | G-09, G-12, G-18, docs/agent/DEFINITION_OF_DONE.md | 실행 범위별 검증과 미실행 구분 유지. 자동 push 지시는 별도 철회. |
| G-M09 | 545-550 | retired | 2일간 2,694개 오염 세션·새벽 동접4명 | G-08, docs/agent/verification/OPEN_CHECKS.md | 과거 사고 측정값. 현재 행 수/정리 대상/실행 승인으로 재사용하지 않는다. |
| G-M10 | 545-550 | retained | 자동/로컬 유입 guard·운영 삭제 전 백업과 승인 | G-07, G-08, G-10, G-13, lib/analytics/guard.ts | 모든 신규 수집 경로에도 guard 적용, 과거 SQL은 새 실행 권한이 아니다. |
| G-M11 | 552-553 | retained | 버전 SQL·수동 적용·멱등성 | G-13, scripts/apply-db.mjs:process.argv, docs/agent/DEFINITION_OF_DONE.md | 데이터 작업 DoD와 수동 도구로 보존. |
| G-M12 | 568-568 | restored | L2/L3 구현 전에 ACTIVE_PLAN 기록 | G-12, G-16, docs/agent/DEFINITION_OF_DONE.md | 분할에서 생략된 위험등급별 사전 계획 조건을 DoD에 복원. |
| G-M13 | 582-584 | restored | 독립 읽기전용 검토자3명 병렬·메인 통합·P0 전부+비P0 입구묶음≤4·대상시나리오·같은seed 전후비교 | AMB-29, docs/ambient/ENGINE_RULES.md:AMB-29, docs/ambient/VISUAL_QA_PROTOCOL.md | 엔진 규칙에 QA 수치/절차를 명시. 수정 전후 빌드 쌍을 기록하며 같은 빌드 내 재현성을 검증. |
| G-M14 | 585-586 | retained | 월별 흔적은 molehill·snowman·lilypad 3종 | AMB-08, components/shared/ambient/world/traces.ts | 퇴역 debut/acorn 연대기와 분리하여 현행 세 흔적 보존. |

## A-3 한국어 검색·확정값 경계

UI·AMB·ART의 모든 규칙 줄에 한국어 검색어를 병기했다. 금생수·오행, 아바타 자리, 눈 편한 테마, 오늘, 업 도움, 차분한 편집실은 해당 규칙 줄에서 검색된다. 오늘 크기/페이드·카메라 상수·확정 미술 검수값은 소유자 판단 없이 완화하지 않는다. 현재 코드값과 이미 철회된 역사값은 위 대장에서 구분한다.

## A-4 ADR 20건 전수 감사

전체 Status와 Date 및 기존 본문을 유지하고 대체된 절에 주석을 추가했다. `annotated`는 문서 전체 Superseded 전환이 아니다. ADR-0009의 기존 Superseded 상태는 유지한다.

| ADR | 결과 | 확인한 절·현재 근거 |
|---|---|---|
| [ADR-0001](decisions/ADR-0001-public-private-server-boundary.md) | annotated | Decision: work=owner·developer·worker; manager 권한. Consequences: 스티커 공개/비공개 적용 예시 → SECURITY §4: 현역 owner/developer/viewer, work는 owner/developer+grant, owner_private는 owner+grant. 스티커 철수. 공개 서버 분리는 유지하면서 퇴역 역할과 스티커를 현행 소비자로 오인하지 않게 표시 [docs/agent/decisions/ADR-0015-retire-decorate-stickers-worker.md, docs/agent/decisions/ADR-0018-retire-trusted-members.md, lib/permissions/roles.ts, docs/agent/domain-rules/SECURITY.md] |
| [ADR-0002](decisions/ADR-0002-private-content-encryption.md) | annotated | Rationale: 작업자가 work 일정을 공유하는 신뢰 협업 구조 → AUTH: worker/manager 및 비공개 UI 철수; AES-256-GCM 운영자 에스크로우와 키 보존 유지. 암호화 결정을 뒤집지 않고 당시 역할 가정만 과거로 표시 [docs/agent/decisions/ADR-0014-private-layer-ui-retired.md, docs/agent/decisions/ADR-0015-retire-decorate-stickers-worker.md, docs/agent/decisions/ADR-0018-retire-trusted-members.md, lib/private-layer/secret-crypto.ts] |
| [ADR-0003](decisions/ADR-0003-owner-dual-binding.md) | unchanged | Decision: OWNER_EMAIL/app.owner_emails와 calendars.owner_id 양쪽 오너 전환 → AUTH §4 및 actor/config/apply-db가 같은 이중 바인딩 계약을 유지. 전문과 현행 소스 대조 결과 철회·대체 증거 없음. 코드/계약 파일 읽기만 수행; 실제 오너 변경·DB 검증 미실행 [lib/auth/config.ts, lib/auth/actor.ts, scripts/apply-db.mjs, docs/agent/domain-rules/AUTH.md, tests/unit/owner-email.test.ts] |
| [ADR-0004](decisions/ADR-0004-poster-surface-geometry.md) | annotated | Decision·Consequences·Validation: 꾸미기==시청자 스티커 기하 및 꾸미기 실물검증 → ADR-0015: 꾸미기·스티커 철수. 표면 1840·내용 높이·JS fit 유지. 살아 있는 포스터 기하를 보존하며 폐기된 검증 대상을 복원하지 않게 표시 [docs/agent/decisions/ADR-0015-retire-decorate-stickers-worker.md, components/poster/public-poster.css, components/poster/public-poster.tsx] |
| [ADR-0005](decisions/ADR-0005-month-routes-cold-entry-only.md) | annotated | Related: /studio/decorate/[year]/[month] 월 라우트 → ADR-0015: decorate 라우트 제거; studio calendar 클라이언트 월 이동과 VIEW_COOKIE 유지. 월 전환 결정은 유효하며 퇴역 라우트만 범위에서 제외 [docs/agent/decisions/ADR-0015-retire-decorate-stickers-worker.md, components/studio/studio-shell.tsx, lib/ui/view-cookie.ts] |
| [ADR-0006](decisions/ADR-0006-optimistic-writes-keepalive-queue.md) | annotated | Decision: /api/sticker-write를 포함한 모든 편집 dispatch → ADR-0015: sticker-write 제거. studio-write·직렬 큐·keepalive·좁은 게이팅 유지. 폐기된 스티커 endpoint 추가 지시로 읽히는 부분만 대체 [docs/agent/decisions/ADR-0015-retire-decorate-stickers-worker.md, app/api/studio-write/route.ts, lib/studio/editor-model.ts, lib/studio/use-write-queue.ts] |
| [ADR-0007](decisions/ADR-0007-anon-hearts-device-token.md) | annotated | Consequences: 배지 계산 단조화 → heartTier: 월 최다 대비 비율+절대 하한; 상대 단계 하락 가능, 쓰기/역순 응답 보호 유지. 2026-08-27 사용자 결정이 코드 주석에 명시됨. 단조성을 배지 등급 영구 상승으로 오인하지 않게 표시 [lib/schedules/heart-tiers.ts, tests/unit/heart-tiers.test.ts] / Open Follow-up: 상대 순위 전환 미구현 → heartTier(count,isTop,maxHeart) 구현 완료. 옛 미구현 상태를 현재 TODO로 다시 올리지 않게 표시 [lib/schedules/heart-tiers.ts, tests/unit/heart-tiers.test.ts] |
| [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md) | unchanged | Decision: 공개 일정/태그·하트 집계·방송 월별/일별 집계만 공개; 운영 지표 차단·공유 차트 → SECURITY와 public-loader/public-insights가 같은 집계 경계·명시 DTO·공유 차트를 유지. 전문과 현행 소비자 대조 결과 대체할 절 없음. 응답·실제 DB/RPC 실행은 하지 않음 [docs/agent/domain-rules/SECURITY.md, lib/schedules/public-loader.ts, components/poster/public-insights.tsx, app/api/public/[calendarSlug]/broadcast/route.ts] |
| [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md) | annotated | Decision·Consequences·Revisit: 월드컵 미니게임·중력공·자동 테마·토글 설계 → 기존 Status: Superseded 유지. CHG-20260827-002 기능 삭제; 현행 ambient 제어는 AMB-12. 이미 철회됐지만 본문을 새 게임 지시로 실행하지 않도록 적용 범위와 근거 링크 보강 [docs/agent/CHANGELOG_AGENT.md, docs/ambient/ENGINE_RULES.md, lib/ui/motion.ts] |
| [ADR-0010](decisions/ADR-0010-broadcast-panel-public-dto-only.md) | annotated | Consequences: 미리보기 낙관 경로 teaser 미가림을 별도 잠재 이슈로 유지 → ADR-0012 불변식2와 previewSnapshot ?? schedule.viewerModePreview로 서버 공개 스냅샷만 사용. 판서 DTO/fail-closed 결정은 유지하고 후속 수정된 이슈의 옛 상태만 정정. 실세션 검증을 실행했다는 뜻 아님 [docs/agent/decisions/ADR-0012-phase0-capability-matrix.md, components/studio/studio-shell.tsx, lib/schedules/studio-loader.ts, tests/unit/broadcast-callsite.test.ts] |
| [ADR-0011](decisions/ADR-0011-ux-overhaul-l-decisions.md) | annotated | L6 및 함의: developer 일정 본문 편집 금지 → 후속 ADR-0012 권한표 및 canEditSchedule: owner/developer 일반 일정 편집, owner_private는 owner만. L6의 모순을 후속 결정과 실제 권한 함수로 좁혀 표시 [docs/agent/decisions/ADR-0012-phase0-capability-matrix.md, lib/permissions/roles.ts, docs/agent/domain-rules/AUTH.md] / L7 manager 태그 권한; L8 잠금 UI → ADR-0018 manager 철수, 전체6/대표2 유지. ADR-0014 비공개 UI 철수, auth-session grant 서버 모델 유지. 권한·UI 철수와 유효한 수치/보안 계약을 구분 [docs/agent/decisions/ADR-0018-retire-trusted-members.md, docs/agent/decisions/ADR-0014-private-layer-ui-retired.md, lib/schedules/event-validation.ts, app/api/unlock-private-layer/route.ts] |
| [ADR-0012](decisions/ADR-0012-phase0-capability-matrix.md) | annotated | Capability Matrix: manager/worker 열, 꾸미기·커스텀 이모지·멤버관리 및 비공개 UI → ADR-0015/0018 퇴역 기능·역할 제거, ADR-0014 비공개 UI 철수. AUTH/roles 현행 권한. Accepted 표 전체를 폐기하지 않고 철회된 열/행과 현역 권한을 명시 [docs/agent/decisions/ADR-0015-retire-decorate-stickers-worker.md, docs/agent/decisions/ADR-0018-retire-trusted-members.md, docs/agent/decisions/ADR-0014-private-layer-ui-retired.md, lib/permissions/roles.ts] / 불변식5/구현 이력: 24시간 tombstone 복구 미구현 → event-actions TOMBSTONE_RETENTION_MS·same-ID 복구·만료 purge 구현. 결정 유지, 당시 미구현 상태만 후속 구현으로 표시 [lib/schedules/event-actions.ts] |
| [ADR-0013](decisions/ADR-0013-activity-log-internal-identified.md) | annotated | Decision1: 내부자 owner/manager/worker/developer; 꾸미기 예시 → ADR-0015/0018 퇴역 역할은 옛 기록 판독용; actor 현역3역할, 조회 실패 기록 unknown. 시청자 집계/본문 금지 유지, 옛 역할 문자열을 현행 권한으로 해석하지 않게 표시 [docs/agent/decisions/ADR-0015-retire-decorate-stickers-worker.md, docs/agent/decisions/ADR-0018-retire-trusted-members.md, lib/auth/actor.ts, lib/activity/record.ts, lib/activity/kinds.ts] / 불가침: target uuid만·meta 원시값만 → 같은 ADR Decision5-1 버튼id/라우트 식별자 허용; sanitizeMeta 제한된 원시 배열도 허용, 본문/중첩 객체 금지 유지. 기존 본문 내부의 target 범위 혼동과 현행 sanitizer 형태를 명확화; 새 수집 정책을 만들지 않음 [lib/activity/kinds.ts, tests/unit/activity-kinds.test.ts] |
| [ADR-0014](decisions/ADR-0014-private-layer-ui-retired.md) | unchanged | Decision: 비공개 UI 철수, 서버 암호화·grant/fail-closed 유지, verifyOnly 떡밥 게이트·비밀번호 변경 → AUTH/roles와 unlock-private-layer verifyOnly가 같은 경계를 유지. 현행 사용자 UI 철수와 서버 보호 유지가 일치. 기존 비공개 1건은 당시 데이터 사실로 보존; 현재 DB를 재조회/변경하지 않음 [lib/permissions/roles.ts, app/api/unlock-private-layer/route.ts, docs/agent/domain-rules/AUTH.md, AGENTS.md] |
| [ADR-0015](decisions/ADR-0015-retire-decorate-stickers-worker.md) | annotated | Decision2·3: 신뢰 멤버는 manager 하나, trusted_members/trusted_role 잔존 → ADR-0018·0074: manager/table/enum 제거. 스티커·worker 철수 및 false worker stub 유지. 후속 철수 절만 표시하고 당시 배포/복원 명령은 역사로 구분 [docs/agent/decisions/ADR-0018-retire-trusted-members.md, db/migrations/0074_retire_trusted_members.sql, db/migrations/0065_retire_stickers_and_worker.sql, lib/domain/schedule-types.ts] |
| [ADR-0016](decisions/ADR-0016-metal-water-design-language.md) | annotated | Decision1: 초기 물빛 RGB 컨테이너·강한 광택 → 같은 ADR4차 개정: 크림/아이보리 베이스·절제 금 헤어라인. UI01~03 현행 토큰. 같은 문서의 후속 개정이 초기 색 배합을 대체했음을 명시 [app/metal-water.css, docs/ux/UI_RULES.md] / Decision3 및 다시 볼 때: 차분 스위치/차분 OFF로 복귀 → UI04: studioCalmEnabled 항상 true, app/layout 페인트 전 무조건 data-studio-calm. 2026-09-04 사용자 제거 결정을 근거로 퇴역 토글 복원 방지 [lib/ui/motion.ts, app/layout.tsx, docs/ux/UI_RULES.md] / Decision4·5: 눈 편한 root sepia/saturate/brightness 필터 → UI05·AMB14: UI token palette만 변경, ambient canvas 무영향. 2026-09-06 사용자 결정으로 폐기된 처리 방식만 대체; 접근성 우선 유지 [app/globals.css, docs/ux/UI_RULES.md, docs/ambient/ENGINE_RULES.md] / 4차/4차-b/4차-c: WaterTide 마운트·파일삭제 복귀·motion-off 배경숨김 → ADR0017 biome 개정·AMB01/12: 공용 AmbientLayer, 초원 기본, 바이옴 물, motion-off 정지프레임. 물/금 형태 의도·크림 베이스는 유지하고 옛 엔진 실행절만 표시 [docs/agent/decisions/ADR-0017-ambient-season-registry.md, components/shared/ambient/ambient-layer.tsx, docs/ambient/ENGINE_RULES.md] |
| [ADR-0017](decisions/ADR-0017-ambient-season-registry.md) | annotated | 개정2②: 모든 장면 top-view → ⑮ 및 ART02: standing high3/4, flat/shadow top-view, 깊은 종 slot별 side 예외. 동일 ADR 후속 카메라 결정과 slot 계약으로 초기 전역시점 제한 대체 [docs/ambient/ART_RULES.md, components/shared/ambient/art/manifest.ts] / 개정2④: 네 스위치 기본 ON 재시딩 → UI04·AMB12: calm 항상ON, ambient 기본OFF; 재시딩은 일회성 과거 이력. 오래된 설정 초기화 지시 반복 방지 [lib/ui/motion.ts, docs/ux/UI_RULES.md, docs/ambient/ENGINE_RULES.md] / ⑫·⑬ 및 ⑱22: 동물 손그림 금지, Noto 전용 → ADR0019·AMB19·ART03: 원작 픽셀아트 목표, Noto/실루엣 임시 대체물. 생물 행동/라이선스 계약을 유지하며 확정 철회 전제만 표시 [docs/agent/decisions/ADR-0019-codex-three-books.md, docs/ambient/ART_RULES.md, docs/ambient/ENGINE_RULES.md] / ⑭·⑯: chronicle/day treeChain·debut/acorn·world/flags.ts·species.ts → monthTraces slug/year/month의 흙더미·눈사람·연잎, codex 단일 종 정본. 소유자의 연대기 철거·월별 구분 결정과 종 정본 통합 반영 [components/shared/ambient/world/traces.ts, components/shared/ambient/world/codex.ts, docs/agent/decisions/ADR-0019-codex-three-books.md, docs/ambient/ENGINE_RULES.md] / ⑮: 36/65자리·29종, 생성기 최소크기·화면px4배·art:normalize 직접쓰기 → ART01/03/05/06·ADR0020: manifest 계획, 요청 원본 raw, 정수배 nearest·owner review·promote. 낡은 수량과 퇴역한 direct-public 절차를 현행 납품 계약과 분리 [components/shared/ambient/art/manifest.ts, docs/ambient/ART_PIPELINE.md, docs/agent/decisions/ADR-0020-bounded-memory-and-art-review.md, scripts/ambient-art-normalize.mjs] / ⑯: 지평선12% → AMB04 및 view.ts HORIZON_V=0.26·좌표 helper. 2026-09-06 소유자 하늘 확대 결정 근거가 code 주석에 있음 [components/shared/ambient/world/view.ts, docs/ambient/ENGINE_RULES.md] / Decision1·2·3 및 결과: 오늘/절기·사철/여름 CSS물결·WaterTide 복귀 → AMB01/02: 달력 달 계절, 특정일만 KST오늘, meadow기본·biome별 물·AmbientLayer. 원문 안의 순차 개정들이 대체한 초기 선택을 해당 절에도 표시 [components/shared/ambient/registry.ts, components/shared/ambient/ambient-layer.tsx, docs/ambient/ENGINE_RULES.md] / Decision4·5: OFF에서도 물결, viewer늘ON, motion/gfx-lite가 hide 게이트 → AMB10/12/13: 공용 on/dim/off 기본OFF, lite시인성유지, soft/off숨김, motion-off정지프레임. 현재 gate 코드와 사용자 결정에 반하는 옛 검사 전제 차단 [app/ambient.css, lib/ui/motion.ts, docs/ambient/ENGINE_RULES.md] / Decision7: fixture만 force가능, 실제 화면 prop없음 → UI22: developer 계절/날씨/띠 QA 제어, 바이옴 보존·해제 경로. 2026-09-05 사용자 결정이 devSeason/worldForce 주변 주석에 있음 [components/studio/studio-shell.tsx, docs/ux/UI_RULES.md] / ⑰6: haze alpha0.17/화면끝0.44 → view.ts HAZE_ALPHA0.13/HAZE_END_GV0.28, groundYAt/hazeEndY 사용. 후속 화질 검토의 실제 상수·좌표계로 대체된 수치 표시 [components/shared/ambient/world/view.ts, docs/ambient/ENGINE_RULES.md] / 남은 것·다음: rock4/P2·특정일/테마 철수 예정 → 현재 활성작업은 CURRENT_STATE, 수량/파일계획은 manifest-derived catalogue. 당시 미완료 상태를 현재 실행지시로 재생하지 않게 표시. 본문 내 깊은바다시간대 개정은 현재 AMB06과 일치하여 유지 [docs/agent/CURRENT_STATE.md, art-src/목록.md, docs/agent/decisions/ADR-0020-bounded-memory-and-art-review.md] |
| [ADR-0018](decisions/ADR-0018-retire-trusted-members.md) | unchanged | Decision: owner/developer/viewer 세 역할, trusted_members 제거·과거 라벨만 유지 → MembershipRole·resolveCurrentActor·roles와0074가 같은 철수 경계를 유지. 전문 대조 결과 후속 철회 증거 없음. historical manager/worker 문자열은 이 ADR이 명시적으로 허용한 판독 자료 [lib/domain/schedule-types.ts, lib/auth/actor.ts, lib/permissions/roles.ts, db/migrations/0074_retire_trusted_members.sql, lib/activity/kinds.ts] |
| [ADR-0019](decisions/ADR-0019-codex-three-books.md) | annotated | Decision1: manifest→Codex→public→art:normalize → ADR0020·ART_PIPELINE: request/raw/normalize/check/owner review/promote. 동물 원작화 결정을 유지하며 퇴역 납품명령만 대체 [docs/agent/decisions/ADR-0020-bounded-memory-and-art-review.md, docs/ambient/ART_PIPELINE.md, scripts/ambient-art-normalize.mjs] / 결과: 206자리·319장 → ART01: ART_SLOTS/slotFiles와 생성목록에서 현재수량 계산. 현재 카탈로그가207slots/419파일을 보이므로 당시 수량을 현행 계획으로 고정하지 않게 표시 [components/shared/ambient/art/manifest.ts, art-src/목록.md, docs/ambient/ART_RULES.md] |
| [ADR-0020](decisions/ADR-0020-bounded-memory-and-art-review.md) | unchanged | Decision: bounded memory·주제별정본·immutable run·실제owner검토·entity navigation·기록된legacy이관 → 현행 AGENTS·memory harness·art pipeline과 일치; WORK-ORDER의 후속 B/C는 별도 단계. A4 시점에서 이 ADR의 명시된 조항을 뒤집는 증거 없음. 아직 실행하지 않은 후속 B/C 구현이나 승인 의미를 선행 확정하지 않음 [AGENTS.md, scripts/agent-harness/memory.mjs, scripts/ambient-art-pipeline.mjs, art-src/AGENTS.md, docs/agent/handoffs/20260909-work-order.md] |

## A-5 현행 규칙 ID 재고

ID 추가·삭제·중복 또는 소유 파일 변경 시 이 표와 해시를 갱신하고 영향을 받는 원문 대응을 다시 판단한다. 존재하지 않는 코드 목적지·원문 누락/중복도 실패한다. 검사: `node scripts/agent-harness/rule-migration.mjs`, `npm run harness:verify`, `npm run test -- tests/unit/rule-migration.test.ts`.

Rule inventory SHA-256: ba56b9c6de3af4a5e546ce649bf099550c1e2bd0efcbb479fb9cbd4e81bf67cc

<!-- rule-migration:inventory:start -->
| 규칙 ID | 현행 문서 |
|---|---|
| AMB-01 | docs/ambient/ENGINE_RULES.md |
| AMB-02 | docs/ambient/ENGINE_RULES.md |
| AMB-03 | docs/ambient/ENGINE_RULES.md |
| AMB-04 | docs/ambient/ENGINE_RULES.md |
| AMB-05 | docs/ambient/ENGINE_RULES.md |
| AMB-06 | docs/ambient/ENGINE_RULES.md |
| AMB-07 | docs/ambient/ENGINE_RULES.md |
| AMB-08 | docs/ambient/ENGINE_RULES.md |
| AMB-09 | docs/ambient/ENGINE_RULES.md |
| AMB-10 | docs/ambient/ENGINE_RULES.md |
| AMB-11 | docs/ambient/ENGINE_RULES.md |
| AMB-12 | docs/ambient/ENGINE_RULES.md |
| AMB-13 | docs/ambient/ENGINE_RULES.md |
| AMB-14 | docs/ambient/ENGINE_RULES.md |
| AMB-15 | docs/ambient/ENGINE_RULES.md |
| AMB-16 | docs/ambient/ENGINE_RULES.md |
| AMB-17 | docs/ambient/ENGINE_RULES.md |
| AMB-18 | docs/ambient/ENGINE_RULES.md |
| AMB-19 | docs/ambient/ENGINE_RULES.md |
| AMB-20 | docs/ambient/ENGINE_RULES.md |
| AMB-21 | docs/ambient/ENGINE_RULES.md |
| AMB-22 | docs/ambient/ENGINE_RULES.md |
| AMB-23 | docs/ambient/ENGINE_RULES.md |
| AMB-24 | docs/ambient/ENGINE_RULES.md |
| AMB-25 | docs/ambient/ENGINE_RULES.md |
| AMB-26 | docs/ambient/ENGINE_RULES.md |
| AMB-27 | docs/ambient/ENGINE_RULES.md |
| AMB-28 | docs/ambient/ENGINE_RULES.md |
| AMB-29 | docs/ambient/ENGINE_RULES.md |
| ART-01 | docs/ambient/ART_RULES.md |
| ART-02 | docs/ambient/ART_RULES.md |
| ART-03 | docs/ambient/ART_RULES.md |
| ART-04 | docs/ambient/ART_RULES.md |
| ART-05 | docs/ambient/ART_RULES.md |
| ART-06 | docs/ambient/ART_RULES.md |
| ART-07 | docs/ambient/ART_RULES.md |
| ART-08 | docs/ambient/ART_RULES.md |
| ART-09 | docs/ambient/ART_RULES.md |
| ART-10 | docs/ambient/ART_RULES.md |
| ART-11 | docs/ambient/ART_RULES.md |
| ART-12 | docs/ambient/ART_RULES.md |
| ART-13 | docs/ambient/ART_RULES.md |
| G-01 | AGENTS.md |
| G-02 | AGENTS.md |
| G-03 | AGENTS.md |
| G-04 | AGENTS.md |
| G-05 | AGENTS.md |
| G-06 | AGENTS.md |
| G-07 | AGENTS.md |
| G-08 | AGENTS.md |
| G-09 | AGENTS.md |
| G-10 | AGENTS.md |
| G-11 | AGENTS.md |
| G-12 | AGENTS.md |
| G-13 | AGENTS.md |
| G-14 | AGENTS.md |
| G-15 | AGENTS.md |
| G-16 | AGENTS.md |
| G-17 | AGENTS.md |
| G-18 | AGENTS.md |
| G-19 | AGENTS.md |
| UI-01 | docs/ux/UI_RULES.md |
| UI-02 | docs/ux/UI_RULES.md |
| UI-03 | docs/ux/UI_RULES.md |
| UI-04 | docs/ux/UI_RULES.md |
| UI-05 | docs/ux/UI_RULES.md |
| UI-06 | docs/ux/UI_RULES.md |
| UI-07 | docs/ux/UI_RULES.md |
| UI-08 | docs/ux/UI_RULES.md |
| UI-09 | docs/ux/UI_RULES.md |
| UI-10 | docs/ux/UI_RULES.md |
| UI-11 | docs/ux/UI_RULES.md |
| UI-12 | docs/ux/UI_RULES.md |
| UI-13 | docs/ux/UI_RULES.md |
| UI-14 | docs/ux/UI_RULES.md |
| UI-15 | docs/ux/UI_RULES.md |
| UI-16 | docs/ux/UI_RULES.md |
| UI-17 | docs/ux/UI_RULES.md |
| UI-18 | docs/ux/UI_RULES.md |
| UI-19 | docs/ux/UI_RULES.md |
| UI-20 | docs/ux/UI_RULES.md |
| UI-21 | docs/ux/UI_RULES.md |
| UI-22 | docs/ux/UI_RULES.md |
| UI-23 | docs/ux/UI_RULES.md |
| UI-24 | docs/ux/UI_RULES.md |
| UI-25 | docs/ux/UI_RULES.md |
| UI-26 | docs/ux/UI_RULES.md |
| UI-27 | docs/ux/UI_RULES.md |
| UI-28 | docs/ux/UI_RULES.md |
| UI-29 | docs/ux/UI_RULES.md |
| UI-30 | docs/ux/UI_RULES.md |
| UI-31 | docs/ux/UI_RULES.md |
| UI-32 | docs/ux/UI_RULES.md |
| UI-33 | docs/ux/UI_RULES.md |
| UI-34 | docs/ux/UI_RULES.md |
| UI-35 | docs/ux/UI_RULES.md |
| UI-36 | docs/ux/UI_RULES.md |
<!-- rule-migration:inventory:end -->
