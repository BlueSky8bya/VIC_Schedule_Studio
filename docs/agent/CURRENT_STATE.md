# Current State — VIC Schedule Studio

> **에이전트에게**: 이 파일이 "지금 이 프로젝트의 현재 시제"다. 과거 일기장이 아니다.
> 작업 시작 전에 여기부터 읽고, 의미 있는 작업(기능·구조·마이그레이션)이 끝나면 **여기를 갱신**한다.
> 완료된 역사는 여기 쌓지 말고 git log와 `docs/decisions/`(ADR)로 보낸다.
> 세션 시작 시 이 파일은 SessionStart 훅이 자동으로 읽어 넣는다(`.claude/settings.json`).

Last Updated: 2026-09-03
Project Version: 0.1.0
Harness: `agent-harness.yaml` (protocol `project-initializing_260710.md`, 최소 도입안)

---

## Current Objective

- **편집실 배치 대개편 + 물결 레이어 + 동작 스위치 극성(2026-09-03, PLAN-20260903-002)**:
  ① 웹 크롬 두 행 → 한 행. 옛 액션바(관리 3종·아바타 좌/우·단축키·역할 배지·로그아웃)가 사라지고
  달력이 그 높이(≈50px)를 얻는다. 역할 배지·로그아웃은 헤더 북동 모서리(`.studio-role-tools`),
  관리 3종+단축키는 **서쪽 rail 도구 카드**(`.studio-tools` 타일, 아바타 scene이면 [필터|도구|아바타 자리],
  아니면 `.studio-left-panel` 필터 아래), 아바타 좌/우 세그먼트는 **하단 중앙 플로팅 행**(`.bottom-float-row`,
  확대 배율 컨트롤과 같은 줄 — 처음엔 아바타 자리 박스 안에 뒀다가 "rail과 같이 옮겨가 마우스 왕복이
  화면 폭만큼"이라는 사용자 지적으로 화면 중앙 고정으로 철회). 아바타 자리
  flex 63→58%(길어진 rail에서 옛 절대 높이 유지). 실측: 1720×1000(zoom .9) 필터 잘림 0, 1600×1000
  51px(옛 배치 44px과 동급). data-act 키 불변. 2026-08 "드롭다운 접기 철회"는 접지 않는 타일로 존중.
  ② `.studio-tide`(components/studio/studio-calm-layer.css) — fixed z:-1 배경(셸 배경 투명): 물빛 스웰 2 +
  물결 채움 2 + 은선 stroke 1 + 상단바 헤어라인 글린트. 보이는 조건 = 차분 ON ∧ 동작 줄이기 OFF ∧
  `html[data-gfx]≠lite` ∧ ≥641px. 실측(perf-frames.mjs studio): GPU 60fps 0 드롭(켜도 같음);
  소프트웨어 렌더는 켜면 86→47fps라 gfx 판정이 필수 — probeGfx가 이제 **필터 또는 물결이 보일 때**
  재고, lite면 `data-gfx="lite"`(페인트-전 스크립트도 붙임)로 물결을 접는다. 판정 기록 v2(옛 full 재측정).
  ③ 역할 배지 스위치 "동작 줄이기(기본 OFF)" → **"생동감 있는 동작(기본 ON)"** — 저장 키·속성 의미
  불변, 표시 극성만 반전(설정 4개 전부 ON=기본). data-act는 한글이라 라벨 사전 자동.
  검증: verify-layout.mjs(owner/manager/developer, 3 게이트, 팝오버 오른쪽 잘림 0, 힌트 바 상단바 아래
  12px, 아바타 좌→우) · tsc · lint · vitest 521 · 비주얼 기준선 갱신.
  ④ **금생수(金生水) 스킨(ADR-0016)** — 일(편집 팝오버·읽기 카드·띠·버튼·타일·칩·카드 테두리·달 이동 링)
  = 금(헤어라인·윗면 광택·작은 라운드·슬레이트 글자·띠 각인), 품는 것(페이지·표면·칸·요일 머리·패널·상단바·
  힌트 바·역할 팝오버) = 수(물빛 유리·큰 라운드·낮은 대비 선·안쪽 빛). 토큰 `--gs-*`(app/metal-water.css,
  띠 공용 질감 포함), 편집실은 studio-calm-layer.css ④(차분 스위치로 되돌림), 시청자/미리보기/export는
  poster-metal-water.css(기본 모습, mist는 그 위). 의미색·태그색·기하 불변. ⚠ 눈 편한 필터(sepia .1·
  saturate .8)가 옅은 물빛을 중성 회백으로 누른다 — 실측 픽셀: 페이지 (217,222,227) 쿨, 표면·칸 (243,243,239)
  중성. 필터 OFF면 전부 물빛. 더 짙게 가면 밝기가 떨어져 여기서 멈춤(원하면 페이지/표면 토큰만 올린다).
  ⑤ 아바타 알약: 쉼 상태 opacity .62·블러 없음(밑 일정 읽힘), 호버/포커스 불투명+블러, workspace 아래 72px
  여백으로 스크롤 끝 겹침 0(실측 여유 15px).
  ⑥ 사용자 교정(같은 날): 헤더 오른쪽 순서 = 저장 상태 · **관리자 · 시청자 화면 보여주기** · 로그아웃.
  팝오버 **종류 색은 금 스킨이 덮지 않는다** — 윗변 3px 액센트·손잡이 틴트·그립(수정 보라 · 새 초록 · 업 도움
  장미 · 기간 안내 하늘)은 종류 규칙 그대로, 금은 좌/우/아래 은선 + 광택(inset)만(실측 4종 확인). 띠 색도 불변.
  물결 "검이불누 화이불치": 바다 36%·먼/중간/가까운 세 겹(3.5/6/9%)·은선 1.5px+글로우 밑받침·빛살 둘(26/38초)·
  가운데 큰 스웰·상단 14% 하늘물(뒤집힘, 반대 방향, 유리 상단바 뒤로 번짐). 여전히 transform/opacity만.
  ⑦ **금생수 2차(사용자: "바다 말고는 차이를 못 느끼겠다 · 시청자 화면도 왜 변동이 없나")**: 원인은 눈 편한
  필터의 sepia .1 — 옅은 물빛을 중성으로 눌렀다(칸 #e8f0f9 → 233,235,235). 조치 ① 필터 `saturate(.85)
  brightness(.96) sepia(.03)`(globals.css; lite 팔레트는 옛 값 그대로 — 약한 기기 전용, 재계산 보류) ② 물 토큰
  깊게(칸 #e3ecf7·지난 날 #d5e1ef·페이지 #dfe9f5→#c8d8ec·유리 그라데이션) ③ 금을 '보이게': 브러시드 두 톤
  광택 면(버튼·도구 타일 쉼 상태·아바타 알약), 은화 달 이동 링(방사 광택), 띠 에나멜 ::before 오버레이(공용,
  span z:1), 카드 에나멜 background-image(태그색 inline backgroundColor 위, 혼합 카드는 inline background가
  이겨 테두리만), 팝오버 면 브러시드 + 새김 제목 + 물빛 입력 칸 ④ 시청자: 페이지·표면·칸·요일·레일 카드·'이 달
  기록' 칩(금속)·달 이동 스텝(은화)·모바일 아젠다(머리/범례/월 바 물, 날짜 카드 금, 빈 날 묶음 반투명 물).
  실측(필터 ON): 편집실 칸 (222,228,235)·페이지 (192,203,219), 시청자 칸 (227,232,236)·페이지 (197,208,222).
  ⑧ **3차(사용자: "광택 너무 강함 · 색 단조로움 · 배경 아직 아이보리")**: ① 광택 완화 — 두 톤 꺾임 제거, 띠/카드/칩
  오버레이 절반(28/18/22%), 은 단추 방사 부드럽게. ② 물 네 갈래(토큰): 파란 물(칸·페이지), 남빛(요일 머리·모바일
  머리), 옥빛(태그 필터 카드·범례), 연보라(도구 카드·아바타 자리·보는 달 카드·월 바); 물결 바탕·스웰도 연보라/옥빛/
  파랑으로 갈라짐. ③ **아이보리의 정체 = 라이브 캘린더 poster_theme가 'autumn'**(꾸미기 시절 값) — 계절 테마
  규칙이 [data-poster-theme] 특이도로 스킨을 덮어 시청자·미리보기가 가을 크림으로 보였다. Supabase 직접
  update로 `none`(기본) 전환(공개 캐시 TTL 300초 뒤 반영). 편집실은 다른 달 칸(#f2f0f8)·물결 꺼진 셸 바탕
  (핑크·라벤더)을 찬 계열로. ⚠ 앞으로 "스킨이 안 보인다"면 먼저 테마 값(역할 배지 팝오버 '포스터 테마')을 본다.
- **업도움/기간 띠 여백 칸별 압축(2026-09-02)**: 띠 줄 수를 "주별 최대"로 세어 그 주 모든 칸의
  일정 목록에 같은 paddingTop을 주던 것을, **각 칸을 실제로 지나는 띠의 최고 레인 깊이**로 전환
  (시청자 `renderDayCell` cellLaneDepth · 편집실 동일). 띠 없는 칸 카드가 머리글 바로 아래로
  붙어 달력 높이 압축(9월 주0 실측 203→186px). ⚠ '개수'가 아니라 '최고 레인+1'이어야 한다 —
  레인 번호가 절대 위치(top: lane×20)라 레인1만 지나는 칸도 40px을 비워야 한다. 순서변경
  드래그는 elementFromPoint+카드 rect 실측이라 칸별 패딩 차이에 자동 대응(별도 레이어 불필요).
  보류: 레인 배정 자체는 여전히 월 전체 패킹(`assignSupportLanes`) — 주 단위 재패킹(옵션 B)은
  효과 대비 변경이 커서 미착수. 후속: 시청자 띠 레인 스텝 20→18(SUPPORT_LANE_STEP, 띠 사이
  틈 3→1px — 사용자 신고 "간격 과함"). 편집실은 스텝(20×zoom)에만 배율이 곱해지고 띠 높이
  (17 고정)엔 안 곱해져 배율 따라 틈이 변하는 구조라 그대로 둠(사용자 "편집실은 괜찮다").
  후속 2: 시청자 휠 확대(--cal-zoom 125/150%)에 띠도 동참 — 높이(17×z)·글자(micro×z)는
  public-poster.css, 레인 스텝·paddingTop(×z)은 TSX. 셋이 같은 배율이어야 겹침이 없다
  (틈 1×z 실측). 편집실 띠는 여전히 높이/글자 고정(별도 신고 없음).
  후속 3(2026-09-02): ① 띠→첫 카드 여유 10→4px(paddingTop 고정분 8→2, 카드 gap 3px과 한 식구).
  ② **시청자 아래 채움** — 일정 적어 포스터가 창 세로보다 짧으면 부족분을 `.public-calendar-area`
  min-height(레이아웃 px, calFillMinH state)로 줘 그리드 auto 행들이 균등 스트레치로 바닥(창-14px)
  까지 채운다. natH에 직전 채움이 포함돼 '이전+부족분' 고정점 수렴(RO 재측정 경로), 배율은 폭
  기준이라 무피드백. 포스터가 창보다 긴 달은 0(기존 스크롤). 아젠다 모드는 stage 미렌더라 무관.
  스티커 렌더는 완전 소멸(주석만 남음)이라 기하 리스크 없음. 창 세로만 변하는 리사이즈용
  window resize 리스너 추가. 실측: 1600×1200 채움(행 132→162.7, stage 바닥=창-14) ·
  1600×700 채움 0.
  후속 4(2026-09-02): 시청자 Ctrl+휠 확대가 **월을 한 번이라도 넘기면 죽던 회귀** 수리 —
  표면이 key(surface-년-월)로 리마운트되는데 휠 리스너 useEffect(deps [showAgenda])가 재실행
  안 돼 떨어져 나간 옛 DOM에 남았다(preventDefault도 안 걸려 브라우저 줌으로 샘). callback
  ref로 전환해 요소가 갈릴 때마다 산 노드에 재부착. '높이 꽉 찬 달력이라 확대 거부' 같은
  조건은 원래 없음(최대 단계여도 preventDefault 유지). 월 이동 후 1↔1.25↔1.5 실측 정상.
- **이용기록 목록 세로 상한(2026-09-03)**: 행동 타임라인 `.act-visits` · 적게 쓰인 기능
  `.usage-list`에 `max-height: clamp(320px, 44vh, 460px)` + 내부 스크롤(overscroll contain) —
  방문·항목이 많아도 카드가 그 선 이상 안 자란다(사용자 요청). 접기 토글·15개 컷은 기존 그대로.

- **다시보기 창 대개편 2차(2026-09-03, 유튜브 2패널)**: 16:9 미리보기가 창 전폭을 먹고 챕터가
  바닥 스크롤 띠로 밀리던 비율을 뒤집음 — 좌 영상+제목(18px, 유일한 title급) · 우 챕터 세로
  한 열 레일(380px). 마크업 무변경, `.dvm-vod:has(.vod-chapters)` grid-areas 재배치. 핵심 트릭:
  레일 `height:0; min-height:100%` — 행 크기 계산에 레일 내용이 못 끼게(fr이 내용만큼 자라
  창이 늘어짐) 하고, 확정된 셀 높이(좌열)로 스트레치 후 내부 스크롤 = '패널 높이=플레이어'.
  썸네일 크롭 수리: max-height 56vh 캡이 진범(상자를 눌러 cover가 상하 크롭) → 캡 완화+
  contain+어두운 배경(레터박스가 플레이어처럼). 날짜는 13.5px 회색 보조로 강등. 활성 챕터
  하이라이트 추가(vod-chapters.tsx activeSec, 인라인 점프 시만). <900px는 세로 스택 폴백.
  후속 2(2026-09-03, 챕터 = 즉시 재생): 재생 전 챕터 클릭이 '시간만 이동'이던 원인 — 플레이어는
  iframe 수명당 **첫 Pload에서만 autoPlay를 존중**, 2차 Pload/pre-media Pplay·PseekTo는 전부
  무시(음소거 변형·URL 파라미터까지 실측 무반응). 수리 = iframe 재마운트(dayVodNonce key) +
  pending → 첫 Pload{autoPlay:true}; 차단 브라우저는 PonReady 3초 감시 → mutePlay:true 재마운트
  (항상 재생됨, 실측) → Punmute 시도(origin 잠금이라 무시돼도 무해). 허용/차단 프로필 양쪽
  Playwright 실측 통과. 상세는 메모리 soop-embed-iframe-api.
  후속 3(2026-09-03, 점프 지연 최소화 — 사용자 "체감 3초"): 실측 차단 프로필 3.7초(소리 시도
  무응답 → 3초 감시 → 리마운트 로드). 수리 = ① **슬롯 a/b 2중 iframe**(dayVodSlots): 주(보임)
  + 숨긴 순정 대기(PonReady만, Pload 안 보냄). 재생 전 점프는 대기에 첫 Pload{autoPlay:true}를
  쏘고 그 자리에서 승격, 물러난 주는 gen++로 리로드 → 새 대기. 메시지는 e.source↔iframe 대조로
  슬롯 식별. ⚠ DOM 순서 a,b 고정(키드 재배치 = iframe 리로드), 보이기만 CSS(.is-standby
  visibility:hidden). ② **차단 기억**(localStorage `vic.vod.soundAutoplayBlocked`, 3일 TTL):
  감시창에 걸리면 기억 → 다음 점프부터 곧장 음소거 시동(+Punmute); 소리 시도가 실제로 굴러가면
  즉시 해제(자가 교정). ③ 감시창 3초→1.5초(대기가 데워져 있어 Pload→첫 이벤트 ≈0.1초).
  실측(클릭→첫 미디어 이벤트): 허용 464→247ms · 차단 첫 클릭 3723→1598ms · 차단 이후 114ms.
  ④ 창이 떠 있는 동안 ←/→ = **영상 10초 탐색**(마지막 점프/재생 방송, timeUpdate currentTime
  기준, 120ms 속도 제한), 월 이동 핸들러는 dayVodOpenRef로 원천 차단(사용자: 프레임 밖 포커스
  에서 키 넘기다 달이 바뀌어 끊김). 실측: 재생 전/중 월 불변, 닫은 뒤 정상 이동.
  후속 4(2026-09-03, 가독성·HCI 3차): ① 창 1280→1720(레일 420 고정, 영상 1080p 실측 1230×692,
  768 높이 814×458 — 둘 다 16:9 캡 안 걸림; .dvm-thumb max-height = 94vh−205). ② **현재 챕터
  재생 추적** — 부모가 timeUpdate currentTime을 콜백 구독(subscribeDayVodTime, setState 아님:
  포스터 전체 초당 4회 리렌더 회피)으로 흘리고, VodChapters가 '시각 ≤ 현재' 중 가장 늦은 항목을
  activeIdx로(바뀔 때만 setState). 현재 = 파란 바탕+왼쪽 3px 바, 지나온 항목 .is-past 흐림.
  챕터가 **바뀔 때만** 레일이 scrollIntoView(nearest, scroll-padding 56)로 따라가고 마우스가
  레일 위면 멈춤(같은 챕터 안에선 안 끌고 감 — 의도). 클릭·챕터 점프·←/→ 탐색도 notify로 즉시
  반영. ③ 코너 헤더 sticky(카드 안에서만), 시각 13→14·라벨/헤더 14→15, 얇은 스크롤바.
  ④ 머리에 키 힌트 `← → 10초 · Esc 닫기`. 실측: 점프#3 → active 3/past 3, 레일 scrollTop 0으로
  되돌린 뒤 →키로 챕터 60→61 넘기면 양 뷰포트에서 visible=true.
  후속 5(2026-09-03): ① **재생 중 Esc 안 먹던 것** — 플레이어를 마우스로 누르면 포커스가 교차
  출처 iframe으로 들어가 keydown이 우리 창에 안 온다. 창 컨테이너 tabIndex −1 + 열 때 포커스,
  window blur 후 activeElement가 창 안 iframe이면 되찾기(직전 400ms 안 Tab keydown이면 키보드
  진입으로 보고 안 되찾음 — 교차 출처 iframe엔 :hover가 안 붙어 hover 판별 불가, 실측).
  Space = 재생/일시정지(Pplay/Ppause, 포커스가 버튼·링크 위면 제외). 실측: iframe 클릭 후
  activeElement=창, Space 토글에 pause 이벤트, Esc로 닫힘. 재생 전(창에 막 들어옴) Space = ▶
  (마지막 점프/재생 방송, 없으면 그 날 첫 방송 0초 — 대기 슬롯 승격 경로, 사용자 신고 후속).
  **후속 7(2026-09-03, 후속 6의 M·자동 unmute·인계 철회)**: 사용자 신고 "Space·M·챕터 연타에
  고장" + "Space로 재생 중 혼자 멈춤". 원인 = 재생 중 Pplay(시작 직후 0초 정지 리셋, 재생 중 위치
  튐)에 기댄 unmute 경로가 플레이어 상태에 민감 + 연타 시 승격·인계·타이머 겹침. 결정: 믿을 수
  있는 원시 동작(새 iframe 첫 Pload 자동재생 · PseekTo · Ppause · 정지 중 Pplay 제자리 재개)만
  남김. M 단축키·음소거 의도·인계 승격·unmuteDayVod 전부 제거(소리 켜기/끄기 = 플레이어 볼륨
  버튼). 차단 브라우저 음소거 폴백은 음소거 그대로(자동 unmute 없음). Space = 낙관적 정지 상태
  갱신 + 250ms 연타 억제 + 시동 중(첫 Pload 뒤 미디어 이벤트 전, 6초 상한) 무시. 챕터 연타는
  승격 연쇄가 마지막 pending으로 수렴(리로드로 앞선 것 소멸). **제어 명령 금지창 2개**(VOD_SETTLE_MS
  800): ① 자리잡기 전(첫 timeUpdate+0.8초) — Space·방향키 무시, 챕터 클릭은 PseekTo 대신 재시동
  (실측: 시작 0.3초 뒤 Ppause → 0초 정지 후 무반응). ② seek 뒤 0.8초 — Space만 무시(실측: seek+
  재개 100ms 뒤 Ppause → 이후 Pplay 무반응; seek끼리 연타는 안전). 정지 중 챕터의 Pplay는 지연
  타이머 없이 seek 직후 즉시(타이머가 다음 seek와 뒤섞이던 것). 소리 시도 감시는 '실제 굴러감'
  (timeUpdate)으로 성공 판정 — buffer만 오고 안 굴러가는 경우(허용 프로필도 간헐) 정지에 갇히던 것;
  '차단 기억'은 아무 이벤트도 없었을 때만(진짜 차단 서명). 실측(허용 2회·차단 1회 전부 통과):
  재생 전 Space×6, 챕터×5 연타(마지막으로 수렴), Space×7 연타 후 재개, 정지→챕터→Space→Space
  섞기, 10초 방치 멈춤 없음.
  후속 6(2026-09-03, M 음소거 + 체감 지연 — **M·unmute·인계는 후속 7에서 철회, 원시 동작 실측
  기록으로만 유효**): 번들 실측으로 `Pmute/Punmute/Pvolume`은 숲 내부 origin 전용 확정. 대체 원시 동작(메모리 soop-embed-iframe-api 참조): **Pplay = 소리 켜기**
  (음소거로 굴러가는 플레이어에 Pplay → muted:false, 차단 프로필도; 굴러간 뒤 ≥0.9초 필요,
  위치 튐 → 0.5초 뒤 PseekTo 복구) · 음소거 켜기는 새 iframe 첫 Pload{mutePlay:true}뿐.
  구현: ① M = 음소거 의도 토글(dayVodMuteIntentRef). 켜기 = **인계 승격**(옛 슬롯 Ppause로
  소리만 즉시 끊고 프레임 유지, 새 슬롯 숨은 채 음소거 시동 → 첫 timeUpdate에 교체
  commitDayVodSwap, 검은 화면 없음). 끄기 = unmuteDayVod(안전 시점 1.5초 뒤 Pplay + 0.5초 뒤
  PseekTo 복구); 인계 교체 전이면 인계 취소 + 옛 슬롯 Pplay(즉시). ② 차단 브라우저 음소거
  폴백도 unmuteDayVod로 **자동 소리 켬**(예전 Punmute는 무시됐음). rollingAt은 timeUpdate만
  기준(play 이벤트가 먼저 오면 안전 지연 반토막 → 간헐 리셋 실측). ③ 정지 중 챕터 클릭
  seek→Pplay 간격 1.2초→0.12초(gap 0~900ms 전부 정상 재개 실측). ④ Space 재개가 음소거
  의도면 Pplay 대신 음소거 인계. ⑤ 토글 피드백 토스트(🔇/🔊/⏸/▶, 1.4초). 인계 중 Space는 무시,
  챕터 클릭은 인계 취소 후 진행. ⑥ 챕터 클릭 뒤 포커스가 링크에 남아 Space가 죽던 것 — 점프 시
  창으로 포커스 복귀 + Space는 BUTTON 위에서만 양보. ⑦ 잘린 챕터 라벨 호버 툴팁(.vch-tip,
  fixed, 120ms, 잘린 항목만·레일 스크롤에 닫힘). 종합 실측(양 프로필): Space 정지/재개 ≈50ms ·
  정지 중 챕터 → 재개 ≈50ms · M 음소거 소리 끊김 ≈50ms, 화면 교체 0.75~0.8초 검은 틈 없음 ·
  M 해제 ≈0.46초 · 연타 취소 ≈60ms · 재생 전 챕터: 허용 0.96초(영상=소리), 차단 첫 클릭
  영상 2.2초/소리 4.1초(이후 클릭 ≈1초/2.5초 — 안전 지연 1.5초는 리셋 방지용, 더 못 줄임). ② 커버 썸네일 흐림 — 숲 SnapshotLoad
  는 `_r`(640×360)·`_l`(480×270)뿐, column/접미사 변형 전부 ≤640(실측). 1230px 커버에서 1.9배
  확대가 원인. SVG feConvolveMatrix 언샤프(합 1)로 가장자리만 보정(`#vod-cover-sharpen`, TSX
  인라인 defs). 원본 해상도 한계는 그대로.

  후속(2026-09-03): ① 창 1040→1280·레일 420, 역할별 타입 계단(제목 20 > 날짜·레일머리 15 >
  코너헤더·항목 14 > 시각 13 > 크레딧 11), 여백 24 정렬. ② 다중 방송 날 — 방송마다 흰 카드
  (영상+제목+자기 레일 한 덩어리)로 묶고 챕터 기본 펼침(defaultOpen 항상 true): 접힌 토글만
  레일 자리에 떠 '어느 영상의 타임라인인지' 안 읽히던 문제. 카드 안 코너는 얇은 테두리.

- **다시보기 창 챕터 리뉴얼(2026-09-02, 애플 grouped-list)**: 코너 헤더(10.5px 옅음)가 항목
  (12.5px)보다 약해 위계가 뒤집혀 있던 것을 재설계 — 코너 = 흰 카드(헤더 13.5px/800 진한색 +
  밑 헤어라인 + 항목들, break-inside 단위 유지), 항목 13.5px/600 + 시각 12.5px 파란 tabular
  (min-width 48), 행 사이 헤어라인, 바탕 연회색(#f2f3f7). 백드롭 blur(7px), 창 라운드 20px·
  오프화이트(#fbfbfd), 헤더·본문 좌우 여백 20px 정렬. 전부 public-poster.css(.vch-*/.dvm-*/
  .day-vod-*), 마크업 변경 없음.

  후속 5(2026-09-02): 아래 채움 '이전값+부족분' 증분식이 **min-height 무효 구간에서 고착**하던
  버그 수리 — 채움값이 내용 높이보다 작으면 크기 변화가 없어 RO 재측정이 안 울려 수렴이 멈췄다
  (좁은 창+7월 실측: 756px 고착, 바닥 123px 미달). '지금 area 실높이 + 부족분' 절대값으로 전환:
  한 번에 목표 도달, 무효 구간에서도 다음 목표가 같아 고착 없음. 4시나리오 재실측 전부 정상.

- **모바일 날짜 카드 폭 시청자=편집실 잠금(7b2f298, 2026-09-01)**: 며칠간 "폭이 안 맞다" 재신고의
  진범은 `.agenda-flow` 그리드 암시적 컬럼의 min-content 바닥 — 카드 속 안 꺾이는 내용이 넓으면
  카드가 컨테이너를 뚫었고, 두 화면은 내용(수정 버튼·VOD 칩)이 달라 뚫리는 양도 달랐다.
  `minmax(0,1fr)`로 카드 폭=컨테이너 고정 + 세 숫자(패딩 14·레일 92·간격 10)를 globals.css
  `--m-agenda-*` 공유 토큰으로 일원화(시청자 `.agenda-mode`/`.agenda-legend-rail`/`.agenda-header` ·
  편집실 `.studio-mobile`/`.m-topstick`/`.agenda-rail`). 시청자 콘솔에 빌드 해시 스탬프 추가
  (포스터에 빌드 UI가 없어 '옛 빌드 탭' 판별 불가였음). 360/412/700 실측 완전 동일.
  후속 1(8d9996c): 옛 빌드로 떠 있는 시청자 탭 자동 새로고침 — /api/soop-live 응답에 서버
  빌드 커밋 동봉, 시청자 페이지가 불일치 감지 시 '탭 숨김 순간에만' reload(루프 가드
  sessionStorage, 편집실·미리보기 제외). 이 코드 이전에 열린 탭은 자가 치유 불가.
  후속 2(1849c1c, **최종 진범**): 재신고의 화면은 실제 시청자가 아니라 owner/developer의
  '시청자 미리보기'였다 — 미리보기는 아바타 슬롯 때문에 poster-page에 avatar-scene이 붙고,
  ≤1099px scene 끔 복원 규칙(패딩 22, 특이도 0,3,0)이 .agenda-mode의 14(0,2,0)를 눌러
  미리보기만 좌우 8px 넓었다(카드 214 vs 230 @360). 같은 미디어 블록에서 agenda-mode 재선언
  으로 수정. 실제(/)·미리보기 360/412 실측 완전 동일. 익명 화면은 처음부터 정상이었다.

- **숲 VOD 아카이브(PLAN-20260831-001) — Phase 1 완료, Phase 2 대기(2026-08-31)**:
  Phase 1 출고 — `vod_archive`(0068, anon SELECT 허용·service_role grant) + 수집기
  `lib/broadcast/vod-archive.ts` + broadcast-poll 오프라인 30분 증분 + 백필 376건(prod 적재 완료,
  스킵 0) + 공개 API `vods` DTO + 시청자 날짜 상세 '다시보기 (N시간 M분)' 칩(CHG-20260831-001).
  **귀속 규칙 2건(2026-08-31 사용자 결정)**: ① 30분 체인 — 직전 VOD 종료와 간격 30분 이내면
  같은 방송, 앞 방송의 broadcast_day를 잇는다(`chainBroadcastDays`, 이행적). 수집기는 최근 저장
  40행을 합쳐 체인(페이지 경계 커버). ② **방송일 경계 = 새벽 6시 KST**('다시보기 가중치') —
  6시 이전 시작 방송은 전날 밤 방송으로 귀속(`attributeBroadcastDay`). 단 rowKey가 실측 시작
  날짜와 다르면 rowKey 우선(SOOP이 세션 기준으로 준 값). 백필 재실행으로 prod 22건 교정
  (별별랭킹·플러스뱅송 1/6→1/5 등 — 1/6 휴뱅 카드에 새벽 방송이 붙던 어긋남 해소).
  같은 날 여러 VOD는 날짜 카드에 '다시보기 1·2'로 함께 붙는다. ③ **구독(플러스) 전용 제외**
  (0069) — SOOP `auth_no`(101=공개, 107=구독 전용) 저장, 공개 칩은 101만(일반 시청자는 107
  재생 불가; 미상 0도 fail-closed 제외). prod 실측 107=11건(플러스뱅송 9 + 제목 무표기 2).
  전수 감사(2026-08-31): 일정↔VOD 어긋남 0건, 유일 잔여 = 2025-03 WBD 2일차 -1/-2가
  46분 간격으로 12/13일 분할(체인 30분 밖, 일정 없는 시대라 실해 없음 — 사용자 보류).
  ④ **날짜 진입로**: PC = 날짜 칸 배경 클릭 → 다시보기 팝오버(`day-vod-pop`, hover에만
  ▶ 배지+링 — 포스터 캡쳐 불침범), 모바일 = 날짜 줄 인라인 칩(모든 방송 날, 카드 아래).
  일정 상세의 다시보기 버튼은 제거(진입로 날짜 일원화). 칩 라벨 = VOD 제목(말줄임, 툴팁 전문).
  ⑤ **과거 일정 카드 생성 v3**(CHG-20260831-002): ≤2025-12 일정 없던 153일에 224건 —
  '+' 활동 단위로 분리, " - " 소제목은 길면 들여쓰기, 태그 자동 부여(387건, 무태그 0,
  빅이봤=카페보기·아르마=게임 등 사용자 정정 반영). 롤백 = `--purge db/backfills/...json`.
  '베스'는 숲 베스트 스트리머 호칭(사용자 확인) — 발표 구경 = 소통 태깅 확정.
  ⑥ **인사이트 적용**(CHG-20260831-003, 0070): 방송시간 통계에 VOD 폴백(세션 없는 날만 다시보기
  길이 합 — 공개 RPC + 서버 로더 mergeVodFallback 동일 규칙) + 공개 월별 통계 '보는 달' 앵커.
  과거 달 '이 달 기록'·인사이트에서 방송시간·태그 통계가 살아난다(2024-03 실측 77.1h).
  ⑦ **Phase 2 A안 출고**(CHG-20260831-004/005, 0071/0072): 팬 타임라인 챕터 + PC 날짜 클릭은
  중앙 '창'(지정 썸네일 미리보기·인라인 임베드 플레이어·챕터 2열, 히스토리 스택 = 인사이트 시트
  규약). 동기화 = `maybeSyncVodPipeline` 단일 진입점(DB 스로틀 1/5/30분 + 12시간 전체 스윕
  `syncVodArchiveDeep` — 옛 VOD 수정·삭제 추적, 타임라인 전체 ~20시간 순환; 크론+soop-live
  after() 이중 트리거, prod 자가치유 실증 8/31=소요카님 63챕터) — vod_timeline(백필 335/376)
  + 증분(broadcast-poll 30분, 최근 14일 8개), 공개 라우트 vod-timeline, `VodChapters` UI(코너 헤더
  그룹·구간 길이·'타임라인 (○○님 감사합니다)' 크레딧, 새 탭 링크 = `?change_second=초` — 실측 확정, 구
  changeSecond 무효). 스틸 트랙은 실측 후 보류(SnapshotLoad = 단일 대표컷).
  ⑧ **인라인 재생 = 숲 iframe API**(`3813127`→`240841e`→`1306ede`, 2026-09-01): 임베드
  `?fromApi=1`, 창 열 때 iframe을 바로 깔고 PonReady 후 **Pload{autoPlay:false}로 초기화만**
  (무음, ▶ 대기) — 첫 클릭이 곧 프레임 안 ▶라 어떤 브라우저든 1클릭 소리 켠 재생(엄격 정책
  실측). 스냅샷 커버(`dvm-cover`, 클릭 통과)는 **실제 재생 시작까지 유지** — 토리님 지정
  썸네일이 계속 보인다(사용자 절충). 챕터 점프 = PseekTo —
  **seconds는 반드시 {time, seekType} 객체**(숫자면 0초 리셋), **seek 직후 Pplay 연달아 금지**
  (시킹 끊겨 0초 리셋 — 정지 중일 때만 pause 이벤트 추적 후 1.2s 지연 재개). 리로드 없음 =
  광고 재시작 없음. origin 정확 일치 허용 목록(vod.sooplive.com/.co.kr).
  숲 댓글 API는 HTML 이스케이프(이중 &amp;amp; 실재) — 파서 `decodeHtmlEntities`(3회 반복 상한),
  백필 스크립트 복제본 동일, prod vod_timeline 90행 제자리 교정 완료(잔여 0).
  **남은 것**: 팬 닉 표기 동의(토리님 경유 권장), B안(순간 검색 — 파싱 데이터 재사용, UI만),
  '1년 전 오늘' 아이디어.
- **물빛 포스터 테마 + 테마 입구 복원(2026-09-03, 오행 레이어 P2)**: `POSTER_THEMES`에 `mist`(물빛 —
  안개·은백 종이+옅은 물빛 그라데이션+잔물결 선, 밝기 규칙 유지·의미색 불변, 🫧/🌊 코너). 특별한
  날 빵빠레는 이 테마에서 쿨톤 색종이(🫧✨🌊) — 별도 설정 없이 테마에 묶음. 꾸미기 철수(ADR-0015)
  뒤 사라졌던 테마 선택 입구를 **역할 배지 팝오버의 '포스터 테마' 셀렉트**(소유자만 표시)로 복원:
  `studio-write op:"posterTheme"` → `lib/schedules/calendar-actions.ts` `updatePosterThemeAction`
  (서버 owner 검사·키 검증·revalidate 3줄·theme.change 기록). 낙관적 반영 후 router.refresh.
  실측: 셀렉트 owner만(manager 0), 비로그인 API 403.
- **비주얼 기준선 갱신(2026-09-03)**: `npm run test:visual -- --update-snapshots` 79 통과. 바뀐
  기준선 4개 = 포스터 geometry txt·viewer-surface PNG(09-02 '시청자 아래 채움'으로 표면 872→1482,
  갱신이 밀려 있던 것) + 편집실 owner/manager PNG(차분 모드 기본 ON). `playwright.visual.config.ts`
  storageState에 `vic.gfx=full`도 심음 — 헤드리스에서 그래픽 판정이 lite로 튀면 눈 편한 테마가
  필터→팔레트로 바뀌어 스냅샷이 흔들린다. `studio-editor.spec.ts:173`(끌면서 저장 경합)은 1회
  실패 후 `--repeat-each 2` 14/14 통과 — 타이밍 플레이키, 회귀 아님.
- **프레임 끊김 수리(2026-09-03, 사용자: "다른 PC에서 동작 줄이기 꺼도 툭툭 끊김")**: Playwright
  rAF 간격·롱태스크 실측(CPU 4배 스로틀 + `--disable-gpu`=약한 GPU 흉내). 원인 둘. ① **띠 그룹
  호버 React 상태**(`hoverSupportId`) — 띠 위를 지날 때마다 포스터/편집실 전체 리렌더, 진입/이탈
  8회에 롱태스크 15개(≈180ms@4배). 수리 = DOM 클래스 토글(`lib/ui/band-hover.ts`, 포스터 띠에
  `data-supportid` 추가) → 롱태스크 0, 상호작용 롱태스크 11→1. ② **눈 편한 테마의 루트 CSS filter**
  — 소프트웨어 렌더에서 idle 79→45fps(paint 애니 다 꺼도 45; GPU 기기는 차이 0). 수리 =
  `html[data-eye-comfort="1"]`(필터) / `"lite"`(필터 결과를 미리 계산한 토큰 팔레트, globals
  `:root` 토큰 + 편집실 바탕·액션바·기본 카드색) 이원화, `lib/ui/gfx.ts`가 기기당 30일 1회 rAF
  표본(로드+3초, 1.5초×2, 둘 다 나쁘면 = 20ms 초과 8%↑ 또는 평균 19ms↑; 코어≤2면 즉시)으로
  `vic.gfx` 판정, `<GfxProbe/>`(layout) + 페인트-전 스크립트가 값 적용. 실측 no-gpu idle: 필터 49
  → lite 86fps. ③ 덤: 오늘 맥동(아젠다 동그라미)·오늘 숨쉬기(달력 칸)의 box-shadow 키프레임을
  ::after/::before 링의 opacity/transform으로(합성기). 띠 광택(sb-sheen)은 sb-head가 overflow
  허용이라 배경 방식 유지(면적 작음). reduce-motion 규칙에 새 pseudo 추가.
- **차분한 편집실 + 휴식 넛지 + 편집 카드 계측(2026-09-03, 오행 레이어 1차 스프린트)**: 방향서
  `docs/ux/saju-redesign-direction.md`(사용 데이터 기반, 코덱스 `계획서.md`는 근거·가드레일 — 둘 다
  미커밋·로컬; 원국 정보는 저장소에 싣지 않는다). CLAUDE.md 철학에 "Owner-fit palette rule" 추가.
  ① `html[data-studio-calm]`(기본 ON, `vic.studioCalm`, 역할 배지 팝오버 스위치, 페인트-전 스크립트):
  저장 버튼 노랑→물빛 — 처음엔 진한 채움(#1e5aa8·흰 글자)이었으나 팝오버의 파스텔 칩들 사이에서
  혼자 무겁다는 사용자 지적으로 **파스텔 틴트 면(`--studio-action-tint`)+진한 물빛 글자
  (`--studio-action-text` #1c4f8c, 대비 6.6:1)+부드러운 테두리**로(옵션 칩 문법); 물결 링·셰브런은
  진한 물빛 유지(버튼 안 `Ctrl+S` kbd는 길어져 잘려서 철회 — 사용자 지시) · 달 이동 셰브런 물빛 · 좌측 필터 패널 은백 카드 · 달력 칸 반 단계 냉각
  (오늘·바깥달·편집중·드롭·휴식 칸 제외) · 관리 칩 3개 고스트(위치·노출은 유지 — 드롭다운 접기 철회
  결정 존중) · 제목 ✨ 정지. 규칙은 studio-shell.css 파일 끝 블록, 토큰은 globals :root `--studio-*`.
  ② 휴식 넛지(.rest-nudge): 편집실 활동 50분(포인터·키·휠, 5분 무입력이면 정지, sessionStorage로
  새로고침 이어짐) 뒤 우하단 물빛 카드, 30초 자동 사라짐(=조금만 더, 15분 뒤 재시도), '쉬고 올게요'=0.
  소유자·개발자만, 시청자 화면 없음. ③ 편집 카드 여닫기 계측: section.enter/leave target `editor`,
  leave에 dur_ms·meta{typed, saved, how: esc/outside/cell/collapse/other} — "칸 361 vs 저장 176"의
  둘러보기/포기 판별용(2주 뒤 분석). 라벨 사전 등록(editor·rest-nudge·studio-calm-toggle·rest-nudge-*).
- **설정 세대 1회 복원(2026-09-03, 관리자 결정)**: `lib/ui/motion.ts` `SETTINGS_EPOCH`("2026-09-03").
  layout.tsx 페인트-전 스크립트가 저장된 `vic.settingsEpoch`가 다르면 `vic.reduceMotion`·
  `vic.eyeComfort`를 지워(동작 줄이기 OFF·눈 편한 테마 ON) 세대를 기록 — 배포 후 첫 방문 1회만,
  이후는 사용자 값 유지. 이유: 초반에 실수로 동작 줄이기를 켜 두고 잊은 시청자. 다시 전체 복원이
  필요하면 값만 올린다. 비주얼 테스트는 `playwright.visual.config.ts` storageState로 현재 세대를
  미리 심음(안 심으면 테스트의 reduceMotion=on이 첫 로드에 지워짐).
- **업 도움 띠 종류 support_kind(2026-09-01, `1306ede`, 0073)**: 'up'(기본, 도와주러 가기
  CTA) | 'period'(단순 기간 안내 — **하늘색**+📌, CTA는 링크 있을 때만 '자세히 보기', **만료돼도
  안 사라짐** — 정보성 기록). 편집 폼에 종류 라디오, 색 정의는 globals `.sb-period`(단일 출처).
  **2026-09-03 라벤더→하늘색(#155e75/#0e93b4/#2ab7d8)**: 편집실 '일정 편집 = 보라 점선'과 같은
  색이라 기간 안내를 고르면 팝오버 점선·리더 라인이 구분되지 않았다(사용자 신고). 편집 대상 색
  규율 = 신규 초록 · 일정 보라 · 업 도움 장미 · 기간 안내 하늘 · 떡밥 보라 링 · 미정 주황.
  같은 커밋: 삭제 버튼이 폼의 현재 종류를 따라 '이 기간 안내 삭제'+하늘색(`.support-delete
  [data-kind]`), 팝오버 `.is-period`(점선·그립·리더 라인·상단 액센트 border-top)도 **폼 현재값**
  기준(종류 칩을 바꾸면 폼 테마와 함께 즉시 갈아입음) — 달력 위 띠 `.sb-period.is-editing`만
  저장값 기준. 상단 액센트는 `.is-support`(장미)/`.is-period`(하늘)가 `.is-edit`(보라)를 덮는다.
  마비노기 알파테스트(9/3~6)를 period로 실전환. 같은 커밋: 띠 라벨이 주 안에서 1칸뿐이면
  (일요일 종료 등) sb-solo 압축 — 남의 칸 위로 튀던 오버플로 수정(시청자+편집실).
- **'적게 쓰인 기능' 카드에서 철수 기능 갈라내기(2026-08-31, 사용자 지시)**: 이 카드는 "없앨 후보"를
  찾는 화면인데 이미 지운 기능(꾸미기/스티커 ADR-0015 · 월드컵 ADR-0009 · 비공개 레이어 UI ADR-0014 ·
  작업자 미리보기)이 바닥에 깔려 후보를 덮었다. `lib/activity/labels.ts`에 `retired` 표식(RETIRED_* 세트
  한 곳 관리 — 사전 항목은 지우지 않는다, 지우면 '이름 미등록'으로 떨어짐), 카드에선 후보 목록 밖
  "이미 지운 기능 N개" 접힌 묶음으로(채움 막대 없음·한 톤 다운, 복사본엔 포함). 위치 필터·저사용
  요약도 살아있는 것만 계수, 역할 필터에서 '작업자' 제거(내역 줄엔 '작업자 N' 유지). 기록 보존 90일이
  지나면 묶음도 자연 소멸.
- **월별 인사이트 탭 순서 = 트렌드 먼저(2026-08-31, 사용자 지시)**: 개발자판(insights-dashboard)·
  멤버판(member-insights) 모두 트렌드→일정→참여→하이라이트, 기본(첫) 탭 = 트렌드. CSS가
  data-active=n ↔ nth-child로 짝을 맞추므로 개발자판은 트랙 섹션 DOM도 같이 이동. 멤버판 렌더러는
  인덱스 평행 배열 → key 매핑으로 바꿔 순서 변경이 렌더러를 못 끌고 가는 사고를 구조적으로 차단.
- **방문 집계 '개발자 2' 수정 + 범위 토글 재배치(2026-08-28, 사용자 신고)**: 한 탭에서 로그아웃↔로그인이
  섞이면 `foldOne`이 계정 해시를 '해시 있는 첫 행'에서 집어 "역할=developer, 계정=anon 토큰" 방문이 생겨
  `(날짜|계정)` 순방문자 집계가 개발자 1명을 2명으로 셌다(prod 08-27·08-28 실측 재현). 계정 해시는 역할을
  정한 조각(main)→같은 역할 조각→아무 조각 순(`lib/insights/visit-fold.ts`), 회귀 테스트 2건. 과거 행은
  원본 그대로라 재집계로 자동 교정(마이그레이션 없음). 시청자/운영진/전체 토글은 **운영진→시청자→전체**
  순 + 처음 열면 운영진(`DEFAULT_VISIT_SCOPE`, 방문 패널·일별 모달·요약 블록 공용).
- **애플 HCI 감성 다듬기 3차(2026-08-27, 사용자 지시 — B2·D3·C2로 보고서 후보 소진)**:
  · **B2 시청자 모바일 카드→시트 줌 전이** — 탭한 카드 rect를 `agendaDetailOriginRef`에 기억, 시트 마운트 직후
    WAAPI FLIP(translate+scale, `--spring-smooth`)으로 카드 자리에서 자라남, 내용은 45% 이후 페이드인. 손잡이 탭·
    배경 탭 닫기는 `closeAgendaDetailAnimated`(정확한 역방향 300ms), 드래그 닫기는 훅의 슬라이드, Esc 즉시.
    PC 팝오버(anchor)·동작 줄이기 제외. 편집실 모바일 편집 시트(4585~)와 같은 문법.
  · **D3 방송 ON 모프** — 모바일 하단 '오늘'↔LIVE를 **한 버튼**으로(이전엔 두 요소 교체): 빨강은 `::before` opacity로
    차오르고, false→true 전이 순간만 `.just-live` 젤리 팝(`--spring-bouncy`) + 햅틱 2틱(시작·확정 620ms).
    첫 마운트에 이미 LIVE면 조용. 데스크탑 `.soop-live-card`는 좌하단에서 스프링 스케일 등장 + LIVE 배지 팝.
    (fixture 달에 오늘이 없어 모바일 전이는 브라우저 검증 불가 — 코드 경로 검토·데스크탑 카드 실측.)
  · **C2 타이포 역할 토큰화** — raw px 278곳을 `--text-*`로(exact/±0.5px 근사: 10·10.5→micro(신설 10.5),
    11·11.5→caption, 12·12.5→label, 13·13.5·14→body, 14.5~15.5→ui, 17·18→title, 19·20→display, 28→hero).
    **`@media (min-width)` 안(웹 확대 단)은 raw 유지** — 2단 타이포 보존. 8~9.5px·16·22px 이상은 raw.
    검증: 13화면 전/후 레이아웃 지표(`.scratch-pw/layout-metrics.mjs` — 줄수·높이·너비·잘림·문서 폭) 비교
    → 줄바꿈·잘림·높이 급변 0건, 편집실 모바일 문서 높이 +19px(행마다 0.5px 누적)만. 스크린샷 육안 이상 없음.
- **후속 정리 3건(2026-08-27, 사용자 결정)**: ① prod의 유령 `work` 일정 1건(2025-11-04, 2026-08-03 테스트 잔재)
  hard delete — 비공개 범위 잔여 0. ② `unlock_sessions` drop(**0067 prod 적용 완료**): `has_private_unlock()`를
  private_unlock_grants(auth 세션 결속) 모델로 이식 후 drop, 코드의 legacy delete 3곳 제거. ③ 콜드 스타트 워밍
  `.github/workflows/warm.yml`(5분 표기, GH 실효 ~2h) + **cron-job.org(사용자 계정)에 5분 잡 2개 등록 완료(2026-08-27)**:
  "빅토리 일정표 깨우기 (첫 화면)" `/` · "(일정 API)" `/api/public/vic/events`. 같은 계정의 "빅토리 방송 감지"
  (`/api/cron/broadcast-poll`, 1분)는 **꺼져 있음** — 켜려면 Advanced 헤더 `Authorization: Bearer <CRON_SECRET>` 필요.
- **애플 HCI 감성 다듬기 2차(2026-08-27, 사용자 지시 — 출석 도장은 하지 않음)**:
  · **B1 시청자 모바일 시트 끌어서 닫기** — 편집실 시트의 `use-sheet-drag-close` 훅을 시청자 상세 시트에 연결.
    그립 존 `.agenda-detail-top`(sticky·touch-action:none·음수 마진으로 시트 맨 위) + 손잡이 `.agenda-detail-grab`,
    **그립 존은 손잡이 줄만**(≈27px, 배경 없음) — 헤더까지 sticky로 두면 X(44px) 탓에 두꺼워져 제목을 가렸다(사용자
    리포트, 수정). **모바일 X 제거**(사용자 결정): 손잡이 = 접근 가능한 닫기 버튼(탭=닫기) + 스와이프 + 배경 탭 + Esc.
    PC 팝오버(anchor)는 X 유지, 그립 없음. 같은 요소에 ref 둘 → 콜백 ref 병합.
    게이트: `tests/visual/viewer-sheet-drag.spec.ts`.
  · **C1 재질 마무리** — 시청자 모바일 시트·편집실 모바일 편집 시트(+sticky 그립 존)·라이브 카드·복사 토스트·삭제
    스낵바(다크 재질)를 `--material-*`로. export surface 밖만.
  · **A3 코너 동심** — 허깅 쌍 실측(.scratch 감사 스크립트): 관리 묶음 14→`calc(r-control+4)`=16, 메뉴 항목
    r-control(12)→r-sm(8) (메뉴 16−패딩 8−테두리 1). 나머지 쌍(시트 안 버튼 등)은 모서리에 안 닿아 규칙 비적용.
  · 액션바 "비밀번호 변경" 버튼(웹 관리 묶음·모바일 툴바) 제거 — 월별 인사이트 보안 탭에 동일 기능(사용자 지시).
- **최종 전체 검토(2026-08-27 밤, 정리 작업 회귀 점검)**: 런타임 코드의 drop 테이블/함수·삭제 라우트·삭제 모듈
  참조 0(에이전트 감사). 발견·수정: ① 죽은 CSS 제거기가 `:not(.dead)` 규칙을 통째로 지워 단축키 칩이 풀림 →
  `.kbd-hints span`으로 복원(5ec57cd) ② `db/policies`가 drop된 스티커 테이블·`is_worker`를 참조하고
  `is_active_worker` 원본을 되살릴 수 있어 정리(9d8bed4) ③ 관심 링 `@property` 미지원 폴백. 프레즌스 '지금
  접속' 임계 300s/180s ≫ 60s 하트비트라 안전. prod 스모크·verify-public·비주얼 77·vitest 490 통과.
  **e2e(`npm run test:e2e`)는 dev 서버+실DB로 돌며 visit_session/activity_event에 익명 행을 남긴다 — 통계 오염 주의.**
- **정리 5건 실행(2026-08-27, CHG-20260827-003)**: 폴링 완화(soop-live·presence 25s→60s), 공개 로더
  `calendar_hearts` 쿼리 + `PublicSchedule.heartCount` 삭제(소비자 0), `scripts/_verify_*.mjs` 11개 삭제,
  죽은 CSS 1,101줄 제거(정확 문자열+템플릿 접두 스캔, `evt-pat`은 `:not()` 참조라 유지), DB 0066
  (visit_log·presence_ping·presence_hourly/peak/active_days·owner_sessions·calendar_hearts·add_calendar_heart
  drop — 백업 `docs/agent/backups/2026-08-27_legacy-presence.json`). **0066 prod 적용 완료(2026-08-27,
  c2194a8 배포 확인 후; 테이블 3·함수 5 drop 검증, 공개 API 200).**
  남은 후보: `unlock_sessions`(코드가 아직 delete 호출 — 별도 결정), 콜드 스타트 워밍 핑.
- **관심 단계 링 v2(2026-08-27 재설계)**: v1(바깥 spread+넓은 halo)이 모바일에서 이웃 링끼리 겹치고 짙어
  난잡(사용자 리포트). v2 = 링을 카드 '안쪽'에 마스크(padding-box 도려냄, inset −1px로 카드 테두리를 대체)
  → 절대 안 겹침; 색 사다리 살구→복숭아코랄→로즈코랄→금(2→2.5px에서 멈춤); 폭발·1위만 conic 그라데이션이
  링을 따라 회전(`tier-sweep`, transform이라 합성 친화); halo는 형제 `.tier-halo`(마스크가 그림자를
  잘라서 분리) spread 0 저농도 숨쉬기, 모바일 아젠다는 halo 없음. **주의: 링에 `overflow:hidden` 금지**
  (padding-box로 잘라 border 채움이 사라진다). 범례 견본은 `.tier-swatch.tier-swatch`로 특이도 확보.
- **편집실 액션바 오른쪽 묶음 정리(2026-08-27)**: 역할 배지 높이 44→36(로그아웃과 통일), 배지 팝오버·헤더
  미리보기 메뉴는 오른쪽 끝 정렬(왼쪽으로 펼침 — 오른쪽 잘림 버그 수정).
- **월드컵/축구 시뮬 전부 삭제(2026-08-27, 사용자 결정 — CHG-20260827-002, ADR-0009 Superseded)**:
  `components/seasonal`(미니게임·중력공 ~6,100줄), `lib/football`(28파일), `tests/unit/football`, `docs/sim`,
  `lib/calendar/worldcup.ts`, `lib/ui/use-worldcup-visibility.ts`, `components/ui/pop-number.tsx`,
  `tests/unit/calendar/holidays.test.ts`(월드컵만 검사) 삭제. `holidays.ts`의 `MarkKind`/`match`/
  `withoutWorldCupMark` 제거(DayMark = name·isHoliday만), `classifyDay`의 markKind/wcMatch 제거. 포스터·
  편집실의 월드컵 토글·자동 테마·경기 칩·공 렌더 제거, CSS(wc-·worldcup 테마·pop-number) 제거.
  `WORLD_CUP_UI_ENABLED=false`라 동작 변화 0. 활동 라벨 사전의 io-worldcup 항목은 과거 행 판독용으로 유지.
- **편집실 헤더 정리(2026-08-27 사용자 지정 배치)**: 역할 배지("개발자 ?")·로그아웃을 헤더 우상단에서 액션바
  오른쪽으로 — 순서 **단축키 · 역할 배지 · 로그아웃**. 헤더 우측은 저장 상태 + 미리보기만.
- **달력 꾸미기(스티커)·작업자 역할 철수 + drop(2026-08-27, ADR-0015)**: 관리자 결정. 코드: 꾸미기 라우트·
  팔레트·스티커 레이어/도형·테마 스위치·`api/sticker-write`·스티커/테마 액션·`public-poster.tsx` 스티커
  상태/좌표 매핑/probe/툴바(파일 7,0xx→4,26x줄)·CSS ~33KB 삭제. 공개 로더 스티커 조회 제거(**공개 DTO에서
  `stickers/stickerAssets` 삭제**, CHG-20260827-001). 작업자: `MembershipRole`에서 제거, 권한 함수 isWorker
  인자 제거, 신뢰 멤버 = 매니저만(패널 재작성: 이메일 추가/삭제, 역할 표 3열), 개발자 역할 미리보기에서
  작업자/이중 제거. 레거시 `api/trusted-members`·`api/private-layer`·`studio/private-layer`·
  `relockPrivateLayerAction` 삭제. DB: `0065_retire_stickers_and_worker.sql`(테이블 2 drop·스토리지 정책·
  빈 버킷·`is_active_worker()`=false·`is_worker` drop) + `scripts/cleanup-sticker-storage.mjs`. 백업:
  `docs/agent/backups/2026-08-27_stickers.json` + 원본 이미지 12개. **배포 순서: push → Vercel 확인 →
  스토리지 --delete → 0065 apply**(옛 코드가 스티커 테이블을 읽음) — **전부 적용 완료(2026-08-27)**: prod 배포
  확인 후 버킷 객체 12개·버킷 삭제(Storage API), 0065 OK(테이블 404·is_worker 없음). 검증: tsc·lint·build 0, vitest 618,
  비주얼 77(지오메트리·포스터 기준선 의도 갱신).
- **정리 후보 조사(2026-08-27, 에이전트 감사 — 즉시 안전 항목은 위 CHG-20260827-003으로 실행됨)**: 즉시 안전 — 죽은 프레즌스 DB 객체(visit_log·presence_ping·
  presence_hourly/peak/active_days·owner_sessions·add_calendar_heart), `calendar_hearts` 공개 로더 쿼리(소비자 0),
  폴링 간격(soop-live 25s·presence 25s → 60s), `scripts/_verify_*.mjs` 15개, 죽은 CSS ~760줄(동적 클래스
  오탐 주의). 결정 필요 — 월드컵/축구 시뮬(`WORLD_CUP_UI_ENABLED=false`, ~15,500줄, ADR-0009 뒤집기).
  activity 라벨 사전의 낡은 항목은 과거 행 판독용이라 **삭제 비권장**.
- **편집실 비공개 레이어 UI 철수(2026-08-27, ADR-0014)**: 관리자가 '공개 범위 옵션'·'비공개 일정 보기'를
  안 씀. 제거: 액션바·모바일 툴바 토글, 하단 '지금 잠그기' 배너(`relockNow`), 모바일 '비공개 일정 표시
  중' 배너, 범례 '비공개' 필터 칩(웹·아젠다), 편집 폼 공개 범위 피커(웹 `scope-picker`·모바일
  `me-seg`), `canTogglePrivateLayer`/`togglePrivateLayer`. 접힘 헤더 "공개 범위 · 옵션"→**"옵션"**,
  요약은 미정/업 도움/최초공개만(없으면 "없음"). **서버 모델·권한·fail-closed 저장 검사·공개 API 경계는
  불변** — 새 일정은 항상 public. 비밀번호는 최초공개 게이트(`verifyOnly`)·변경 전용: '비밀번호 변경'
  버튼을 관리 묶음(웹, `.io-passcode`)·모바일 툴바(옛 토글 자리)에 관리자만. prod 비공개 일정 1건
  (work)은 편집실에서 안 보임 — 관리자 결정 대기(공개 전환/삭제). e2e calendar-ui의 토글 기대 제거.
- **관심 단계 = 이 달 최다 대비 비율 + 절대 하한(2026-08-27, 사용자 결정)**: 절대 수(높은 12+·폭발 25+)
  만 쓰던 동안 8월 실측(최다 12, 나머지 5~11)에선 '관심'과 👑만 남았다. `heartTier(count, isTop,
  maxHeart)` — 관심 5+ · 높은 = 최다 50%↑ & 6+ · 폭발 = 최다 80%↑ & 8+ · 👑 = 최다(공동) & 10+.
  `maxHeart`/`topEventIds`는 **보는 달 일정만**으로(예전엔 로드된 전체 달의 최댓값이라 "이 달 1위"가
  전체 1위였음). 낙관적 heartCounts에서 파생 → 내 하트 누름/취소·👑 이동이 같은 프레임에 반영, 남의
  하트는 재진입 때. 트레이드오프(남의 하트로 내 단계 하락 가능)는 알고 수용. 인사이트 '관심 단계 받는
  기준' 문구 갱신. 단위 테스트 `tests/unit/heart-tiers.test.ts` 7.
- **상세 팝오버 단계 배지 재설계(디자인 피드백)**: 별도 "아이콘 관심 단계 최고 인기" 줄 삭제 → 제목 줄을
  flex(좌 `.adt-text` ↔ 우 `.adt-badge`)로, 헤더(날짜↔닫기)와 같은 좌우 리듬. 배지 = 단계 색 글자 +
  옅은 채움 알약, 1위만 "👑 최고 인기". 제목이 길면 다음 줄 오른쪽 끝(margin-left:auto).
- **숲 '공지 쓰기' 기능 제거(관리자가 안 씀)**: `components/notice/notice-modal.tsx` 삭제, studio-shell의
  버튼(웹 폼 아래·모바일 me-tools)·모달 타입·본문 제거, `.notice-*`/`.modal-card-notice`/
  `.modal-backdrop-notice` CSS 제거(개발자 '이용 기록' 버튼은 `.aux-open`으로 이름만 바꿔 유지),
  `lib/activity/labels.ts`의 notice 항목 제거. 이벤트 카테고리 `"notice"`(schedule-types)는 별개 —
  건드리지 않음.
- **관심 단계 = 카드 테두리 링 + 👑(2026-08-27, 사용자 아이디어)**: 불꽃 알약(`.event-popular`, 카드
  바닥 한 줄 ≈18px)이 행마다 쌓여 달력 비율을 무너뜨리던 것 → 카드 안 absolute `.tier-ring`(높이 0)
  + 1위 `.tier-crown`(우하단 모서리)으로 교체. `TierMark` 컴포넌트, 데스크탑·아젠다 카드 마지막
  자식. **테두리만**(사용자 지정 — 2차 피드백으로 아래 변 불꽃 밴드·conic 회전 반짝 제거): 안 1px +
  바깥 spread(두께 1→2→3→3px) + halo 숨쉬기. 관심=#f59e0b 1px · 높은=#f97316 2px · 폭발=#dc2626 3px
  불규칙 flicker · 1위=#eab308 3px brightness 반짝 + 👑(배경 없이 생으로, 카드 우상단 모서리 위
  top:-11/right:-6, rotate ±14° bob). 본문 레이어(`.event-main/.event-subs/.event-meta`) z-index 1,
  링 0. **2색 카드 함정**: `.public-event[data-mixed] > :not(.evt-pat){position:relative;z-index:1}`가
  링·👑까지 흐름 안으로 끌어 링이 카드 바닥 띠·👑이 왼쪽 아래로 밀렸음(사용자 리포트) →
  `> .tier-ring.tier-ring`/`> .tier-crown.tier-crown`에 absolute·층 재지정(spec이 position·높이 검사).
  카드마다 위상 분산(nth-child). 동작 줄이기·내보내기: 애니 정지, 두께/색/halo로 구분. 모바일 아젠다:
  정적 링(inset -4/-6)+👑 오른쪽 위. 범례 3곳(웹·축약·아젠다 도움말) 🔥→`.tier-swatch` 견본.
  **상세 팝오버/시트에 단계 글자**(`.agenda-detail-tier`: 견본 + "관심 단계" + 관심/높은 관심/폭발적
  관심/최고 인기 — 링만으론 관심↔폭발 구분이 어렵다는 3차 피드백; PC 팝오버·모바일 시트 공용). 정밀 라벨은
  `.tier-ring` role=img aria-label·title. fixture `?hearts=1`(6/14/30/45/0 순환)로 검증,
  `tests/visual/heart-tier.spec.ts` 3(링=티어 수·불꽃 0·본문 z 1·표면 높이 하트 유무 동일·모바일).
- **월 이동 깜빡임 수정(아바타 scene)**: 원인 = 월 바뀜→스티커 canon 리셋→`probeCanonFrame`이
  한 프레임 동안 `avatar-scene/left/right` 클래스를 뗐다 붙임 → 슬롯 `display:none↔flex`, 세로
  레일·정보 카드 등장 애니(opacity 0→1) 재생. 수정: probe는 클래스를 안 건드리고
  `.poster-page.sticker-geom-probe .poster-surface`가 표면 안 배치(레일 252·gap 16·가로 패딩 18)만
  !important로 기본값 복원 — canon은 표면 대비 비율이라 결과 동일. avatar-scene.spec에 24프레임
  opacity 샘플 테스트 추가(min ≥ 0.999, display none 0회).
- **아바타 scene "한눈에" — 세로 스택·전역 밀도 압축·고정 컴포지션(2026-08-27, PLAN-20260827-004)**:
  뱅온 미리보기가 OBS 1920×1080 안에서 한 화면에 들어오게. 사용자 결정("토리님은 한 눈에 들어오는
  게 취향"). ① 오른쪽 칸 카드 **세로 스택**(`.avatar-top-cards` 슬롯 안 흐름·column·열 전폭) —
  나란히 max 48%라 `2026년 08 / 월` 줄바꿈되던 것 해소, in-rail 정보 카드 타이포 한 단계 ↑.
  ② **전역 밀도 ~12% 압축**(글자 크기 유지): 행 최소 150→132, weekday 10/7→8/5, 표면 세로
  padding 18→14·row-gap 16→12, day-events 5/6-5-8→4/5-5-6, 카드 gap 3→2·padding 5→4, 날짜
  머리 27→25. 6월 fixture 표면 998→872. scene 전용 압축은 꾸미기≠시청자 지오메트리라 금지 —
  전역이라 canon 프레임이 두 모드에서 같이 바뀜(기존 스티커는 칸 대비 소폭 이동 가능).
  ③ **고정 컴포지션**: `--avatar-col: clamp(300px, 18.75vw, 380px)`(1920에서 정확히 360),
  슬롯 = `top:76/bottom:14` 세로 flex 열 [카드][꾸미기 토글 `.avatar-ctl-inslot`(JSX를 슬롯
  안으로 이동)][점선 박스 flex:1] — `--avatar-h`·translate 매직 넘버 제거. 시청자 미리보기
  scene(≥1100px)은 fit을 **폭·높이 둘 다**(`min(w/natW, availH/natH, 1.6)`) + `--poster-dy`
  translate로 세로 중앙 — **당일 철회**: prod 8월(6주·고밀도, 표면 ~1200)에서 배율이 ~0.6으로
  떨어져 방송 화면 글씨가 너무 작아짐(사용자 스크린샷). scene도 평소처럼 **폭 fit만**(세로는
  스크롤). `sceneFit`·`--poster-dy`·resize 리스너 제거. <1100px: 슬롯은 꾸미기 토글만 좌상단.
  **뱅송 미리보기 URL `/onair`**(`app/onair/page.tsx`): 로그인 없이 열리는 고정 scene
  (`avatarFixed` prop — 항상 켜짐·토글 없음, `?side=right`, `?y=&m=`, 방송 아닐 때 라이브 카드
  확인은 기존 `?live-preview=1`), 공개 로더만 사용(`/`와
  같은 공개 경계), robots noindex. OBS 브라우저 소스(1920×1080)에 그대로 올리는 용도.
  fixture `?fixed=left|right`로 같은 경로 검증.
  **여백 다이어트**(사용자: 달력 너비 챙기기): scene에서 슬롯 안쪽 패딩 14→10, stage가 슬롯 안으로
  `--avatar-gap`(4px) 파고듦, 레일 쪽 `--rail-gutter` 138→134(레일 가장자리 12→8), 셸 패딩 4→0,
  표면 가로 패딩 18→6(scene 전용 — 레일 컬럼 접기와 같은 부류, 스티커는 canon↔live 매핑 보정).
  1920 실측: 달력 그리드 1371→~1410px(+3%), 배율 0.760→0.77.
  검증: tsc·lint·build exit 0, vitest 612, 비주얼 69(지오메트리 게이트·포스터 픽셀 기준선은
  **의도한 레이아웃 변경으로 갱신**), 신규 `tests/visual/avatar-scene.spec.ts` 4.
  알려진 것(기존): 하단 좌우 월 이동 ‹ › 버튼이 아바타 점선 박스 영역과 겹침(이전 75vh 박스도
  동일). 액션바 '월별 인사이트' 버튼 이모지(🛠/📊) 제거(모달 제목은 유지).
- **그림판 펜 카드 위 첫 클릭·미리보기 아바타 컨트롤·동작 줄이기 기본값(2026-08-27)**:
  ① `.bp-draw-surface`에 `z-index: 50` — 일정 레이어가 스택 zIndex를 갖게 된 `526585e` 이후
  입력면이 카드 아래로 깔려 카드 안에서 시작한 펜 획이 안 그려지던 회귀(입력면은 투명, 선택
  도구일 땐 pointer-events none이라 카드 조작 불변). ② 시청자 미리보기 `.avatar-ctl-preview`를
  fixed→absolute(.poster-page 기준) — 스크롤 따라 내려와 달력 가리던 것. ③ **동작 줄이기 기본
  OFF**: layout 인라인 스크립트·`reduceMotionEnabled()` 모두 'on'일 때만 켬(P1-MOTION-1의 OS
  prefers-reduced-motion 시딩 철회, 사용자 결정; CLAUDE.md 갱신). 월드컵 CSS의 OS 미디어쿼리
  게이트도 `html[data-reduce-motion]`로. 눈 편한 테마는 이미 기본 ON(변경 없음).
  ④ 액션바 아바타 세그먼트 가운데 라벨을 흐린 작은 글자+양옆 hairline으로 — 버튼처럼 보이던 것.
  검증: fixture e2e(카드 안 첫 클릭 획 alpha 255·선택 도구 카드 도달·OS reduce 에뮬레이션에서
  data-reduce-motion 없음·미리보기 컨트롤 스크롤 동반), 그림판 e2e 18, 비주얼 14, 기준선 1건.
- **태그 순서 변경 수술 이식 + 액션바 IA 복원(2026-08-27)**: wak-schedule `38ba152`를 이식.
  순수 모델 `lib/tags/reorder.ts`(`reorderAtEdge` 행+edge 목적지·같은 결과=같은 참조 no-op·
  휴뱅 머리 고정 클램프, `edgeForPointer` 중앙선±데드존 히스테리시스) + 단위 테스트 12개.
  에디터: 유령 포인터 1:1(관성·회전·흔들림 제거), 콘텐츠↔형식 경계 드래그 차단, 자동 스크롤
  중 판정 갱신, Esc(capture)/pointercancel/blur 시 시작 스냅샷 복구, 들린 행=점선 슬롯.
  태그 모달 dirty 닫기(X·배경·Esc) → '계속 편집/버리고 닫기' 오버레이(`.modal-discard-ask`,
  에디터 `onDirtyChange`는 ref 대입만). `applyTagUpdates`가 kind/parentId도 낙관 반영.
  감사 문서: `docs/tags/tag-editor-reorder-ux-audit.md`. 토큰 `--violet-rgb` 추가.
  액션바: '관리 ▾' 드롭다운 철회 → 태그 편집·멤버 관리·월별 인사이트를 `.studio-manage-group`으로
  바로 노출(권한 게이트 불변). 웹은 `.studio-actionbar-tools`가 3열 그리드(1fr·auto·1fr) —
  가운데 열에 아바타 세그먼트 [왼쪽 · 아바타 자리 · 오른쪽](🎙️ 제거, 슬롯 힌트도 텍스트만).
  검증: tsc/lint/build/vitest 612, 편집실 e2e 15, fixture 실측(세그먼트 중심 오차 <0.01px),
  `studio-owner-web-light` 기준선 갱신(액션바 줄만 diff).
- **temp id·옛 클로저·낙관-서버 갈라짐 전수 정리 + 하트 즉시성(2026-08-18, `9a22389`·`0cf3ec7`)**:
  `04f8a3f`(끄는 도중 id 교체 경합)와 같은 부류를 편집실·포스터·꾸미기·태그·멤버·비공개 패널
  전체에서 정리. **규칙**: 제스처/비동기 콜백은 배열을 ref로, id는 `canonId`(temp↔실제 동일시)로
  비교; 저장 중 카드에 대한 조작은 실제 id 확정 뒤 같은 큐에서 전송; 서버 스냅샷은 로컬 낙관
  상태와 '병합'(덮어쓰기 금지); 부모 props가 바뀌면 손대지 않은 항목만 재동기화.
  하트: 일정별 집계는 공개 캐시(300초) 밖에서 매 요청 신선하게 읽어 덮는다(public-loader
  `loadLiveEventHeartCounts`, 실패 시 캐시값); PublicPoster는 schedule prop 변화 때 집계·내 하트를
  재동기화하되 응답 대기 중(heartOpRef `done=false`) 일정은 낙관값 유지; 편집실 미리보기는
  accountEmail로 세션 델타를 계정별 분리. 검증: tsc/lint/build/vitest 600 + visual 4 spec(19).
  ⚠ studio-editor '만들자마자 끈 카드' 테스트가 마지막 순서로 돌 때 1회 fling 판정으로 flake
  (재실행 2/2 통과) — 속도 판정이 마우스 step 타이밍에 민감. 반복되면 테스트의 마지막 move
  steps를 늘리거나 FLING_SPEED 여유를 볼 것.
- **콜드 엔트리 체감 속도(2026-08-12, `6cd0221`)**: URL 직접 진입 흰 화면의 원인은
  루트 layout·loading.tsx가 둘 다 `resolveCurrentActor`(GoTrue 왕복)를 await하던 것.
  스켈레톤 톤은 이제 힌트 쿠키 `vic_lt`(30일, StudioShell="s"/독립 포스터="p")만 읽고,
  actor 의존 비콘(Presence·SW)은 `ActorTail`+Suspense로 분리해 셸이 즉시 스트리밍된다.
  **가드 불변**: (studio) 그룹 layout의 viewer→`/` 리다이렉트와 page의 actor 분기는
  그대로 서버에서 확정 — vic_lt는 배경/문구용 힌트일 뿐 권한에 절대 쓰지 말 것.
  남은 후보(미착수): 미들웨어 익명 패스트패스(인증 쿠키 없으면 getUser 생략),
  콜드 스타트 워밍 핑(외부 5분 핑; Vercel every-min cron은 Pro 필요),
  (studio) 가드의 스트리밍화(보안 경계라 신중 — ADR감).
- **방문 지표 재정의 + 행동 기록(2026-08-04, PLAN-20260804-003 / ADR-0013)**:
  ① **방문 = 탭 수명**(0061 `visit_key`, sessionStorage). `visit_session` 1행은 '화면이 보인
  한 구간'인데 문서 네비게이션(pagehide)마다 끊겨, 사이트 안에서 페이지만 옮겨도 방문이
  늘었다 — 실측(04:11~04:20 owner 단독)에서 연속 9분 1회가 4행(4초/5분/7초/4분)으로 찍혔다.
  `lib/insights/visit-fold.ts`가 적재 직후 구간→방문으로 접는다(같은 탭 → 같은 계정의 겹치는
  탭; 계정 미상은 절대 안 합침). **체류는 구간 합집합** — 단순 합은 창 2개 동시 표시를 두 번 센다.
  시간대 점유·동접은 방문 span이 아니라 `spans`(실제 가시 구간)를 스윕한다.
  ⚠ 방문수·평균 체류의 정의가 바뀌어 **과거 수치와 직접 비교 불가**.
  ② **실시간 프레즌스**: track이 마운트 1회뿐이라 숨긴 탭도 접속으로 셌다(기록은 hidden에서
  끊는데 실시간만 안 끊김). 이제 `visibilitychange`마다 `visible`을 갱신 → 패널
  '화면에 떠 있음 / 탭만 열림' 2열. **visible은 화면 출력 여부지 시선이 아니다**(가려진 창·보조 모니터).
  ③ **행동 기록 `activity_event`(0062)** — 어느 화면·어느 일정·무엇을 고쳤는지. 개발자 패널
  '행동 타임라인'(날짜 모달)에서 방문 단위로 재구성.
  **불가침: meta에 일정 제목·본문 저장 금지**(target=uuid, 제목은 읽을 때 권한 확인 후 조인;
  공개 일정만 제목, 비공개는 범위 라벨). 어기면 ADR-0002 본문 암호화가 무의미해진다.
  **식별은 내부자(owner/manager/worker/developer)만** — viewer·비로그인은 `accountHashForRole`이
  쓰기 시점에 `account_hash`를 null로 만들어 개인 타임라인이 구조적으로 불가능. 보존 90일.
  server kind(실제 변경)를 클라가 사칭할 수 없다(`isClientKind`). 규약은
  `tests/unit/activity-kinds.test.ts`가 고정.
  ④ **버튼 전수 수집 + 시청자 카운트 전환(0063, 2차 요구)** — 목적이 "어떤 버튼이 안 쓰이나"라
  버튼마다 kind를 만들지 않는다. `ui.click` 하나에 버튼 id를 `target`으로 담고 문서 전역
  위임(capture)으로 전부 받는다. id는 `data-act` 우선, 없으면 마크업 유추 `auto:` 접두사
  (**깨질 수 있다는 표시** — 계속 볼 항목은 `data-act`로 굳힐 것). 라우트가 아닌 화면
  (그림판·꾸미기·모달)은 `section.enter/leave`+`dur_ms`(`useSectionActivity`).
  **시청자·비로그인은 이제 `activity_event`에 안 들어간다** — `activity_daily_count`에
  (날짜×역할×종류×대상) count만. 개인 세션조차 안 남아 익명성이 집계 구조로 보장되고,
  전수 수집의 행 폭증도 같이 막힌다. 사용량 패널은 **적은 순** 정렬(판단이 필요한 건 바닥).
  **미배선(종류만 등록)**: `export.png`/`export.clipboard`(공식 내보내기는 Playwright라 인앱
  버튼 없음)·`zoom.change`·`decorate.open`(섹션으로 대체)·`settings.toggle`.
  **관측 필요**: ① 스티커 배치 저장 빈도(배치 1건=1행으로 줄였지만 실사용 확인 전)
  ② `auto:` id 비율 — 높으면 마크업 변경 때 통계가 갈라진다.

  **⚠ 계측 함정 3건(2026-08-04 실측으로 확정, 재발 금지)**
  1. **버튼 id에 `aria-label`·`textContent`를 쓰지 않는다.** 그 자리에 사용자·외부 내용이
     들어온다 — `${s.publicTitle} 도와주러 가기`(일정 공개 제목), `지금 방송 중: ${live.title}`,
     `${asset.name} 삭제`, `${l.name} 삭제`, 카드의 textContent=일정 제목 그 자체.
     한때 aria-label이 1순위였다(제목이 target에 저장될 수 있었다 — 실제 데이터에는 안 남았음).
     지금은 `className`만 본다. 사람이 읽을 이름이 필요하면 **소스에 `data-act`를 박는다**.
     `tests/unit/activity-autoid.test.ts`가 회귀를 막는다.
  2. **클래스는 가장 구체적인 토큰을 고른다.** 첫 토큰을 고르면
     `className="button io-accent io-preview"` → `.button`이 되어 서로 다른 버튼이 전부
     한 항목으로 뭉친다(실측: '일반 버튼(합계)').
  3. **상태를 클릭 핸들러 클로저에서 읽어 기록하지 않는다.** 연타가 리렌더 전에 몰리면 전부
     같은 값이 찍힌다 — 월 이동 ×16이 전부 '2026-07'로 기록됐지만 실제 착지는 2025-04였다.
     `useEffect`로 **실제로 바뀐 상태**를 보고 남긴다.

  **표시 규약**: 이 화면을 보는 사람은 대부분 코드를 모른다. 이름은 화면 문구로, **위치(area)**
  를 함께, 기계용 id는 '개발자 정보' 토글에서만. 모르는 값은 지어내지 말고 '이름 미등록'.
  `lib/activity/labels.ts` + `tests/unit/activity-labels.test.ts`.
  `describeTarget`은 `auto:.<토큰>`도 점을 떼고 ACT를 한 번 더 찾는다(안 그러면 사전에 있는데도
  전부 '이름 미등록'으로 뜬다 — 실제로 그랬다).

  **⑤ 진단(diag) 층 + 자가 복구(2026-08-04 2차)**
  - **떡밥이 시청자 화면에서 빈 칸으로 멈추던 버그**: 캐시된 stub의 공개시각이 지난 뒤 관리자가
    공개시각을 **미래로 다시 잡으면**, 클라는 "지났으니 내용 달라" → 서버(`loadRevealedEvents`)는
    `.filter(e => !e.teaser)`로 **빈 배열** → 카드가 영원히 빈 채로 남았다(새로고침해도 캐시가
    같은 옛 stub을 주므로 반복). → 서버가 **미공개도 최신 stub으로** 돌려준다(제목 없음 = 유출 0).
    클라는 새 공개시각을 받아 카운트다운으로 복귀한다. 회귀 테스트로 필터 재도입을 막는다.
  - **실시간이 '탭만 열림'으로 오판**: 프레즌스 키가 localStorage(브라우저 공용)라 두 탭이 같은
    키를 덮어썼다 — 숨긴 탭이 마지막에 track하면 보고 있는 탭까지 `visible=false`. → **탭당 키**
    (sessionStorage). 같은 사람 두 탭은 2로 세지만 '화면에 떠 있음/탭만 열림'으로 나뉘어 정확하다.
  - **진단 층(0064 `activity_event.diag`)**: `diag.teaser`(카드가 어떤 상태로 그려졌나)·
    `diag.reveal`(공개 요청 결과)·`diag.visible`(가시성 전이)·`diag.refresh`. **보존 3일**
    (일반 90일) — 촘촘한 만큼 빨리 쌓이고 버그 쫓을 때만 쓴다. 타임라인·사용량 기본 조회에서 제외,
    '진단' 버튼으로만 표시. **복사는 항상 진단을 포함**한다(켜뒀는지에 결과가 달라지면 안 된다).
  - **세션 진단 리포트 복사**: 방문마다 복사 버튼 → 환경(브라우저·화면·주소·시각) + 그 방문의
    전 항목(원본 kind/target/meta 포함). "이거 했는데 안 됐어요"에 이것만 붙이면 원인 추적이 된다.
  - 컬럼명이 `diag`인 이유: `verbose`는 Postgres 키워드와 부딪혀 인덱스 술어에서 문법 오류가 난다.

  **보류(사용자 결정 2026-08-04)**: 옛 `auto:` 89행은 **지우지 않는다**(제목 유출 없음이 확인됐고,
  사전 수정 후 정상적으로 읽힌다). 떡밥 공개 시각이 과거일 때의 경고도 넣지 않는다.
- **⚠ 방송시간 머리 손실 재발 → BTIME으로 이관(2026-08-05 새벽, 사용자 신고 "실제 8시간 20분인데
  7시간대로 뜬다")**: 원인은 시작시각 정답값이 **한 곳뿐**이었던 것 — 방송국 API
  `chapi.../station`의 `broad.broad_start`를 SOOP가 응답에서 **빼버려**(2026-08 실측: `broad`
  객체는 있는데 `broad_start` 키 없음) `fetchSoopBroadStart`가 항상 null → `start_verified`가
  계속 false → started_at이 '첫 폴링이 발견한 시각'으로 굳었다(당일 실측 머리 32분 손실,
  7.88h vs 실제 8.41h). 대체 정답값: **`player_live_api`의 `BTIME`(방송 경과 초)** — 이미 매
  폴링마다 받는 같은 응답 안에 있어 추가 요청이 없고, 폴링이 늦어도 시작시각이 정확하다
  (`startedAtFromBtime`, 0<초≤48h 가드). 검색 API(`sch.sooplive.co.kr` liveSearch)의
  `broad_start`를 2차 폴백으로 남겼다(station API 의존은 제거).
  ⚠ **폴러를 정밀도의 근거로 삼지 말 것**: GitHub Actions `*/5` 크론이 실측 **2~2.5시간
  간격**으로만 돈다(GH 스케줄 스로틀 — 워크플로우 주석에 기록). 그래서 정밀도는
  시작=BTIME, 종료=VOD 보정이 책임지고 폴러는 '끝났음을 알아채는' 신호에 가깝다.
  VOD 재보정 창은 6h→**48h**로 확대(성긴 폴링에서 재시도 기회가 없어 꼬리가 깎인 채 굳었다).
  과거 행은 `scripts/backfill-broadcast-times.mjs`(드라이런 기본, `--apply`로 반영)로 보정 —
  2026-08-05 4건 반영(진행중 세션 7.88→8.41h 외 3건 분 단위). 계약은
  `tests/unit/broadcast-start-time.test.ts`가 고정. → [[broadcast-time-tracking]]
- **⚠ 오버레이 스택 함정(2026-08-03, `cada217`)**: 모달/시트가 닫힐 때 오버레이 스택이
  history.back()을 호출하는데, 이 되감기는 **그 순간 진행 중인 router.refresh()/문서
  네비게이션을 취소**한다(잠금해제 미반영 버그의 근본 원인 — Playwright로 확정).
  오버레이를 닫으면서 서버 갱신을 함께 트리거해야 하면: 상태로 닫지 말고 문서 리로드로
  한 번에 처리하거나, 히스토리 되감기가 끝난 뒤 갱신할 것.
- **최초공개 시청자 기대 기능(2026-08-03, `6de578e`)**: 카운트다운 긴장 곡선(D-n→24h
  실시간→1h soon 고조→10s 심장박동), 공개 순간 제목 스크램블, 떡밥 카드 클릭→상세
  팝오버(공개 시각+기대돼요). 0060 teaser_hope(0040 익명 하트 패턴, 기기토큰 1표,
  공개 전만 토글, 공개 후 "n명이 기다렸어요" 배지). 적용 완료·Playwright 실측 검증.
- **하이프 4차 — 장인 정밀도(2026-08-04)**: 계획 `docs/ux/motion/hype-craft-plan.ko.md`를
  6개 수정과 함께 전량 구현. ① 팝오버 라벨을 링 밖 독립 행(`.dt-count-ringbox`)으로 분리
  — 원 하단 좁은 현(≈56px)에 6글자(≈67px)가 안 들어가 stroke와 겹치던 기하 버그.
  ② 시트 표면을 `sheetWarm=I^1.35`로 연속 가온(불투명, 떡밥 팝오버는 공개 전 전 기간
  `.is-teaser` → 60초 경계 재질 점프 없음). ③ 리더선을 선-로컬 `<g>` 좌표계로 바꿔 점선
  흐름을 `stroke-dashoffset`(매 프레임 SVG paint) → `transform`으로, 박동은 고정 굵기
  복제선의 opacity로. ④ 부제목·메타·태그 공개 스태거(`.reveal-secondary`, transform/opacity만
  써서 레이아웃 불변; 긴 제목이면 제목 60% 확정까지 시작을 민다).
  **위상 동기의 핵심**: 같은 duration을 주는 건 동기화가 아니다 → 빈도 적분 LUT로 절대
  위상을 구해 `animation-delay`에 음수로 못 박는다(`hypeMotionFrame`). 파형은 CSS가 60fps로
  그리고 JS는 10Hz로 위상만 재고정.
  **접근성**: 박동 주기 하한 0.62s(1.61Hz) — 최악 1초에 박동 2 + 공개 단발 1 = 3회로
  WCAG 2.3.1 한계에 여유를 남긴다(0.55s면 여유 0). 시트 대비는 실제 CSS 색으로 단위 테스트.
  **CSS 특이도 함정 3건**: 유리 재질(`.agenda-detail-backdrop.is-pop .agenda-detail-sheet`),
  `.detail-anchor-link line`, 박동 정지 규칙 — 클래스 단독 선택자로는 전부 조용히 진다.
  검증: tsc·lint·vitest 350·시각 스펙 신규 6 통과, 전체 시각 실패는 기존 6건 그대로(신규 0).
- **최초공개(떡밥) 편집실 가림(2026-08-03)**: 아직 안 풀린 떡밥은 편집실 카드/확대상세에서도
  제목 ???, 클릭 시 편집 폼 대신 비번 게이트(비공개 레이어 비번, `verifyOnly` — grant 미발급,
  rate limit 동일). 통과 id는 화면 생존 동안만 기억. 이동/드래그/복사는 게이트 없이 가능하되
  복사는 teaser 필드째 복사(CopiedEvent 확장 — 안 하면 붙여넣기가 가림을 벗겼음).
  실기기 검증 남음: 데스크톱 팝오버 게이트 폭/리더라인, 모바일 시트 게이트, 오답 shake.

**전면 UX/HCI 개선 계획 실행 중** — 코덱스 설계안(`docs/ux/audit/vic-schedule-studio-ux-hci-
improvement-plan_260729.md`)을 사용자 승인 하에 진행. 방침: **기능/안정(P0→P1→P2) 먼저,
그 다음 애플 기조 리디자인/애니메이션을 뼈대 위에 덮어씌움**. 결정 8건은 ADR-0011,
권한표/불변식은 ADR-0012가 정본.

- **완료(2026-07-29)**: `P0-SEC-1`(공개 범위 fail-closed — 조용한 public 변환 금지, 모바일
  게이트 통일, 서버 잠금해제 검증), `P0-SEC-2`(미리보기 = 서버 공개 스냅샷 전용 + 진입 시
  재조회 `preview-actions.ts` — 떡밥 가림 우회 제거), `P0-SEC-3`(오류 원문 비노출 —
  `safe-action-error.ts`, error boundary digest만), `P0-AUTH-1`(`event-validation.ts` —
  날짜/링크 https/태그 payload 서버 검증 + 매니저 비공개 태그 차단 + 특성화 테스트 13개.
  L6 반영: developer 권한 회수 안 함), `P0-PRIV-1`(드래프트 메모리 전용 + legacy 키 물리 삭제).
- **`P0-DATA-2` 완료(2026-07-29 밤)**: 0055 마이그레이션 적용됨(save_event_atomic/
  reorder_events_atomic/link_chain_atomic, SECURITY INVOKER). 액션 연결 + 클라 target rollback
  (전체 스냅샷 복원 폐지). service-role 왕복 실측 검증. **실계정 첫 저장/드래그로 실전 확인 권장**.
- **`P0-PRIV-3` 완료(2026-07-29 밤)**: embargo 행 0 감사 + 0056 CHECK 제약(신규 embargo 쓰기
  DB 차단, 적용됨) + 죽은 can_view_embargo true 기록 중단 + 샘플 현행화. 앱의 embargo 분기는
  fail-closed 방어로 의도적 존치.
- **`P0-A11Y-1` 부분 완료**: 모바일 편집실 월 이동 버튼 가시화(44px, sticky 헤더). fixture에
  poster CSS import(모바일 아젠다 골격이 poster CSS 공유 — fixture 전용 갭이었음).
  남은 A11Y-1: roving date grid + 선택일 event list, 드래그 메뉴 대안, 업도움 키보드 경로.
- **`P0-PRIV-2` 완료(2026-07-30 새벽, `a576d28`)**: 잠금해제를 auth-세션 결속 grant로(0057 적용).
  opaque 토큰 HttpOnly 쿠키 + sha256 해시 + session_id 결속, 10분 5회 rate limit, '지금 잠그기'
  버튼, 보안 패널=grants 기준, 비번변경/개별만료 시 grant 폐기. **배포 후 기존 잠금해제 전부
  무효 → 각 기기에서 비밀번호 1회 재입력 필요(토리님께도 안내)**. legacy unlock_sessions는
  미참조 잔존(후속 drop). 실계정 검증 필요: 해제→새로고침 유지→지금 잠그기→재잠김, 두 기기
  독립성, 오입력 6회 429.
- **`P0-DATA-1` 완료(2026-07-30, `e302e57`)**: 0058 tombstone(적용됨) + restore 액션/op +
  전 조회 경로 deleted_at 필터 + Ctrl+Z를 같은-id 복구로 교체 + 8초 실행취소 스낵바.
  fling은 복구 가능해져 존치(제거 여부는 이후 판단). '최근 삭제' 보관함 UI는 미구현(P1 후보).
  DB 왕복 실측 4항목 검증. **실계정 검증: 삭제→스낵바 실행취소→태그·하트 보존 확인**.
- **`P0-A11Y-1`/`P0-RESP-1` 완료(2026-07-30, `89092c0`) → P0 12/12 전부 완료 🎉**:
  roving focus 달력(단일 탭 스톱+화살표/Home/End — ←/→가 전역 월 이동과 겹쳐 stopPropagation
  필수였던 함정 기록), 편집 패널 [이동][복제] 버튼(이동=버튼+날짜 클릭, WCAG 2.5.7 비드래그
  대안, insertEventCopy 공통 경로), 가로폰 차단 오버레이 제거(MOBILE_QUERY가 이미 커버).
  A11Y 잔여 소과제(업도움 키보드 경로·공개 semantic list·SR 실기 검증)는 P1에서.
- **P1 진행 중**. `P1-FLOW-1` Quick Add 완료(2026-07-30, `c90d917`): 모바일 시트의
  공개범위·미정·업도움·최초공개 묶음을 기본 접힘 카드로(데스크톱 fold-field와 동일 문법,
  `me-fold`, scopeFoldSummary 공유) — 새 일정 quick tier = 제목→태그→저장. 계획서의
  '셀 팝오버' 안은 사용자 선호(새 일정 = 옆 패널 유지)에 따라 채택 안 함.
  `P1-MOVE-1`은 사용자 결정으로 **제외**(이동/복제 버튼 롤백 — 드래그+Ctrl C/V로 충분).
- **`P1-HIST-1` 완료(2026-07-30, `c6f073c`)**: 통합 다시 실행 — undo/redo 이중 스택,
  단일 실행기(applyHistoryAction)가 적용마다 역연산을 반대 스택에 적재. 새 작업은
  pushUndo 단일 창구로 들어와 redo를 비운다(충돌 가드). Ctrl+Shift+Z/Ctrl+Y.
  삭제 스낵바 복구도 redo 계약에 편입. fixture+스텁 검증 6항목 PASS(_verify_undo_redo).
- **모바일 '오늘' 버튼(사용자 요청, `494e4a7`)**: 하단 레일 시청자 화면 왼쪽 고정 슬롯,
  시청자 화면과 같은 복귀 동작(달 이동 후 오늘 카드 중앙 스크롤).
- **P1 추가 완료(2026-07-30 오후)**:
  - `IPAD-1`(`b9184c0`): 1000px 미만 편집실 = 아젠다 토폴로지(STUDIO_AGENDA_QUERY 999px,
    studio-shell.css 640/641→999/1000 전량 이동). 1024 가로는 데스크톱 유지. 포스터 CSS는
    기존 1040 경계 그대로. 남은 것: 세로 태블릿용 컴팩트 월 오버뷰 스트립(F4)은 미구현.
  - `ROUTE-1`(`e3c65d7`): 월 라우트 URL>쿠키>KST(예전엔 params 통째 무시). parseMonthParams
    단일 출처+단위테스트. 꾸미기 라우트는 쿠키 우선 유지(의도된 설계), NaN 구멍만 봉합.
  - `MOTION-1`(`c9353e6`): 인앱 미설정이면 OS prefers-reduced-motion 따름, 명시적 인앱
    선택이 항상 우선. CSS 게이트는 계속 html[data-reduce-motion] 단일(CLAUDE.md 갱신).
  - `EXPORT-1`(`7e3b28c`): 클립보드 거부/미지원 → PNG 다운로드 폴백(KST 파일명).
    렌더 실패만 '실패' 표기.
  - `VIEWER-1`+`MULTI-0`(`97d74d8`): 모바일 '이 달 기록' 진입을 legendTags 결합에서 해제,
    무액션 범위선택 강조 제거(판서 도구의 실제 범위선택은 유지).
- **P1 전량 완료(2026-07-30 저녁)** — MOVE-1은 사용자 결정으로 제외:
  - `STICKER-0`+`TITLE-1`(`a40b9ab`): 스티커 Tab 포커스=선택(이후 기존 화살표/Delete/
    Ctrl+D/Esc 전역 키가 이어받음, 포인터 불변) + 제목칸 상시 helper(첫 줄=제목 규칙,
    14자 소프트 카운터, 20자 amber 경고) 웹·모바일 공용.
  - `DIALOG-1`(`abd8f56`): `lib/ui/use-focus-trap.ts` 공통 훅 — 초기 포커스 진입 +
    Tab/Shift+Tab 카드 내 순환(capture). 4개 모달(메인·비밀번호·태그 시트·업도움 시트)
    적용. Esc·포커스 복원은 기존 B2 효과. 잔여: 시청자 '이 달 기록' 시트·모바일 편집
    시트는 미적용(터치 중심), background inert 처리도 후속.
- **P2 시작(2026-07-30 밤)**: `P2-ROUTE-1`+`P2-PROTO-1` 완료(`f63675c`) —
  /studio/tags·trusted-members → /studio?panel= 리다이렉트(StudioShell panel 딥링크,
  버튼과 동일 권한 게이트), 가짜 proposals 공개 엔드포인트 삭제(404 계약 테스트),
  supportCampaigns/Proposal/RequestItem 죽은 payload·타입 제거(공개 8→7, 스튜디오 4→3
  병렬 쿼리). DB 테이블은 보존. CHANGELOG_AGENT CHG-20260730-001.
  또: TITLE-1 심화(제목칸 라이브 미러 — 첫 줄 진하게+카드식 세부 레일, `c2fce73`~`f1a1d76`).
- **P2 추가 완료(2026-07-30 밤 2차)**: `KST-1`(월/시각 헬퍼 단일화 + UTC 경계 테스트),
  `STICKER-1` 키보드부(+/- 크기·[/] 회전, 실행취소 묶음), `A11Y-2` 강제색부(색=정보 표면만
  forced-color-adjust:none) — `63c9642`·`aa37bee`.
  **⚠ MULTI-0 롤백(`63c9642`)**: 달력 드래그 범위 강조는 사용자 요청으로 복원 — 방송 중
  기간 짚기 실사용 도구. 계획서의 '액션 없는 상태' 판정은 오판이었다. 다시 제거 금지.
- **P2 3차(2026-07-30 심야)**: `INSIGHT-1` 1차(`4af3ec9`) — 방송시간/트렌드 차트 sr-only
  요약(숫자 비노출 정책 존중, 요약 있으면 차트 aria-hidden). 웹 제목칸 굵기 카드와 통일(`a1ca16f`).
- **판정(supersede 아님, 병합)**: `TOKEN-1`은 기반(색·간격·라운드·그림자·모션 시맨틱 토큰,
  globals :root 단일 관리처)이 **이미 구축돼 있음** — 남은 '산재 리터럴 전면 이관'과 `IA-1`
  (상단 재편)은 애플 리디자인이 같은 선언을 다시 만지므로 **리디자인 단계에 병합**(두 번 작업 방지).
- **`ARCH-1` 1단계 완료(`d96d793`)**: 모듈 레벨 순수 코드(~300줄)를
  `lib/studio/editor-model.ts`로 추출(동작 0 변화, 특성화 테스트 8건 + fixture 회귀 4종 통과).
  단계 계획 = `docs/agent/plans/ACTIVE_PLAN.md`(PLAN-20260730-001) — 2단계(렌더 함수 분리)
  → 3단계(쓰기 큐 훅) → 4단계(undo/redo 훅) → 5단계(그리드/아젠다 분리)는 후속 세션.
  제목칸 라이브 미러/레일은 사용자 결정으로 철회(`bfeb8a5` — textarea 구조 한계).
- **`ARCH-1` 완료(scope-adjusted, `2217dfb`·`1185a1b`)**: 2단계 ReadonlyEventDetail·RoleBadge
  분리, 3단계 useStudioWriteQueue 훅(저장 칩·temp id·flush). 4·5단계(undo/redo 훅·그리드
  분리)는 상태 응집 없인 이득<위험으로 **보류 판정**(ACTIVE_PLAN 참조). 각 단계 fixture
  회귀 통과. **→ 다음 = 애플 기조 리디자인**(TOKEN 이관+IA 재편 포함).
- **🎨 애플 리디자인 계획 항목 완주(`2f31c05`, PLAN-20260730-002 Completed)**:
  1화면 편집 패널 타이포(`c64dbc5`) · 2화면 상단 IA 관리 드롭다운(사용자 A안, `b63644f`) ·
  월 내비 헤더 통합(사용자 요청, `0f88418`) · 3화면 모바일 타이포(`6a6129c`) ·
  4화면 꾸미기 크롬 라벨(표면 불가침, `2f31c05`). 5화면(시청자 크롬)은 기정돈 판단으로
  피드백 주도 전환. **이후 리디자인은 사용자 지적 → 그 지점 수정 루프.**
- **편집 카드 = 앵커 팝오버 전환(2026-07-31, 사용자 결정 — 목업 승인 후)**: 데스크톱 편집
  카드가 우측 고정 슬라이드 패널이 아니라 **선택한 날짜 칸 옆에 뜨는 앵커 팝오버**(absolute,
  workspace 기준·JS 실측 배치 placeEditorPopover — 오른쪽 우선/왼쪽 flip/뷰포트 클램프,
  재선택 시 닫히지 않고 transition으로 이동). 달력은 편집 중에도 전폭 유지(그리드 3번째
  칸·avatar-scene fixed 편집창·≤1180 전폭 행 규칙 전부 제거). 모바일 시트는 그대로.
  기존 바깥클릭 닫기/Esc/serialized 큐 로직 무변. 2차(사용자 피드백): **헤더 바 드래그로
  팝오버 이동**(수동 배치, 다른 날짜 고르면 자동 배치 복귀), **팝오버→앵커 칸 점선 리더 라인
  +도트**(어느 칸의 편집창인지 상시 시각 연결), 헤더 날짜 "M월 D일 (요일)" 형식
  (formatEditorDate, editor-model), 아바타 margin transitionend·달력 ResizeObserver 재배치.
  3차: 드래그 중 React 리렌더 대신 DOM 직접 갱신(끊김 제거), 클램프 완화(가로 140px·헤더만
  화면에 남으면 됨 — 꽉 가두기 금지), 리더 라인 끝점=카드의 앵커 쪽 최근접 가장자리
  (popEdgePoint), 새 일정(초록 +)/일정 수정(보라 ✎) 배지·라인·카드 상단 액센트 색 구분.
  4차: 앵커 좌표를 이벤트가 아니라 **rAF 루프로 매 프레임 실측 동기화**(placeEditorPopover,
  변화 없으면 setState 동일 객체 → 리렌더 0) — 실서비스에서 배치 후 레이아웃 시프트(체인
  등높이 JS 등)로 행이 밀리며 도트가 칸 위로 떠 보이던 드리프트 해결(fixture에 강제 행
  시프트 시뮬로 검증). 드래그 중엔 editorPopDragActiveRef로 루프가 좌표를 안 되돌린다.
  + 카드 맨 위 전폭 '이동 손잡이' 스트립(모드 색 틴트+중앙 그립 필, editor-grab).
  5차(진짜 원인): 드리프트 = **대형 모니터 CSS zoom**(≥1700px .studio-shell 0.9 / ≥2400px 0.8)
  — gBCR은 zoom 반영 화면 px, CSS left/top·SVG 좌표는 zoom 전 로컬 px라 전부 0.9배 지점에
  그려졌던 것(rAF는 무관). getPopZoom()=화면폭/offsetWidth 배율로 나눠 로컬 좌표로 변환,
  드래그 delta도 /z. 2560 뷰포트(zoom 0.8) fixture에서 전 행 오차 0·드래그 1:1 실측.
  ⚠ 교훈: 편집실에서 gBCR 좌표를 absolute/SVG에 쓸 땐 반드시 zoom 보정.
  ⚠ 교훈2(f77e2ac): 드래그처럼 DOM style을 직접 쓰는 상호작용은 종료 시 **DOM도 직접
  동기화**해야 한다 — 새 상태가 React의 이전 상태와 같으면 React가 diff 없음으로 보고
  드래그가 남긴 DOM 값을 안 고친다(파묻힘 미복귀의 진범). 상단 기준선은 하드코딩 대신
  getChromeBottomV(상단바+액션바 실측), 팝오버 최대높이는 --pop-max-h(가용 세로 실측).
  파묻힘 회귀는 22항목 매트릭스(4방향 플링·크롬 침범·up유실·blur·연속·스크롤 × 2뷰포트)로 검증.
  후속 수정: 저장 반짝(.panel-saved)의 잔존 position:relative가 팝오버를 0.6초간 그리드로
  떨어뜨리던 버그(`e256889`) · 태그 모달 저장 푸터 투시 제거(스크롤 래퍼 display:contents
  패턴 + 흐름 밖 고정 푸터) · 공지/방문 버튼은 날짜 선택(새 일정)에만 노출(`e41bca5`).
  6차 스타일(사용자 요청): 카드 밖 4px 오프셋 모드색 점선 아웃라인(리더 라인과 같은 색
  언어) + 앵커 도트 흐림(r4.5, fill-opacity .42, 흰 테두리)(`beac3d6`) — 카드 반투명은
  '집중이 안 된다' 피드백으로 **롤백**(불투명 var(--surface) 복귀) + 팝오버 세로 압축
  (폼 gap/패딩·칩 33px·트레이 여백·fold-head 38px 한 단계씩 축소) + 카드 폭 384→356
  (압축 후 비율이 옆으로 뚱뚱해 보인다는 피드백; form·readonly 동시 이동 필수).
  ⚠ 함정: .editor-grab 전폭 스트립 음수 마진은 폼 패딩과 동치여야 — 패딩만 줄이면
  2px 튀어나와 폼(overflow-y:auto)에 가로 스크롤바가 생긴다(overflow-x:hidden 안전벨트 추가).
  7차 태그 트레이
  애플식 정돈: 태그 색을 인라인 style 대신 **CSS 변수(--tp-bg/--tp-border/--tp-ink)**로
  넘기고(tag-picker.tsx, 기본 렌더 불변 — 모바일 시트 fixture로 확인) 팝오버 스코프에서만
  재해석 — 안 고른 칩 = 중립 표면 + 왼쪽 9px '색 점', 고른 칩만 태그 색 채움, 호버 =
  color-mix 24% 틴트, 콘텐츠/형식 칸 같은 헤어라인 문법(형식만 점선이던 비대칭 제거).
  ⚠ 함정: dev 서버 살아있는 채 `npm run build` 돌리면 .next를 덮어써 정적 청크 전부
  ERR_ABORTED(무스타일 렌더) — 빌드 후 dev 재시작 필요.
- **시청자 포스터 헤더 재편 + 메모 컬럼 삭제(2026-07-31, 사용자 결정)**: 서비스 제목
  '✨빅토리 일정표✨'는 상단 크롬(내 관심 ↔ 이 달 기록 사이, .poster-chrome-title)으로 이동
  — **공식 PNG export는 연·월만 표기**(사용자 확정). 표면 헤더 = 큰 '2026년 07월'(54px).
  왼쪽 메모지(238px) 컬럼은 기능째 삭제(surface 2컬럼: 달력 1fr + 우측 220px) — 달력이
  ~254px 넓어짐. 모든 모드가 같은 지오메트리라 스티커 모드 간 불일치 없음. 과거 달 메모지
  위 스티커는 그대로 존치(사용자 확정 — 필요시 꾸미기에서 수동 이동). publicMemo/memoLines
  DTO 필드는 UI 소비자 0인 레거시로 존치. 모바일 아젠다는 무변.
  이어서: **PC 시청자 일정 상세 팝오버** — 달력 카드 클릭(Enter/Space 포함) 시 모바일 상세
  시트와 같은 내용(agendaDetail 재사용)이 카드 옆 앵커 팝오버로 뜬다(anchor 있으면 is-pop
  분기, fixed·flip·클램프). interactive 모드만(꾸미기·캡쳐 无). 바깥 클릭/Esc 닫기.
- **시청자 레일 재편 + 라이브 카드 + 캡쳐 삭제(2026-07-31, 사용자 결정)**: ① 레일(태그
  필터 위) 업도움 카드 → **정보 카드**(🎂 데뷔 D+N(debutDPlus, holidays)·오늘 날짜 —
  전 모드 렌더, 캡쳐에도 찍힘). ② 업도움 접근은 **달력 띠 클릭 → 상세 팝오버 '도우러
  가기'**(support-bar.is-clickable, interactive만). ③ **라이브 카드**: 방송 중이면 우하단
  플로팅(soop-live-card, 표면 밖 fixed)에 SOOP 임베드 플레이어(bjId/bno로
  /{bjId}/{bno}/embed?autoPlay&mutePlay)+LIVE 배지+제목/보러가기 — 옛 좌상단 알약 비콘
  대체(모바일은 기존 '오늘'→LIVE 버튼 유지). ④ **일정표 캡쳐(클립보드/PNG) 기능 삭제** —
  poster-export-actions 컴포넌트·canExport prop·html2canvas 의존성 제거(토리님 미사용).
  공식 Playwright export 경로(tests)는 별개로 존치.
  2차(디자인+기능): 편집실 팝오버 문법 이식 — 카드→팝오버 **리더 점선+도트(대표 태그 색)**,
  **그립 띠/헤더 드래그 이동**(DOM 직접 갱신+손 뗄 때 상태 확정), rAF로 카드 위치 매 프레임
  실측(스크롤·리사이즈 추적, 카드가 DOM에서 사라지면 자동 닫힘). 디자인: 대표 태그 1~2색
  그라데이션 그립 띠(--dt-c1/c2) + 흰 카드 + 타이포 정돈(제목 21px 앵커).
  아울러 **편집실 아바타 자리 = 항상 켜짐**
  (끄기 토글 제거, 좌/우만 선택 — vic_avatar_on 키는 이제 시청자 포스터 전용, 시청자
  미리보기는 controlled 공유를 끊고 포스터 자체 상태로). fixture+Playwright 실측(anchor/
  flip/bottom-clamp/재클릭 닫기/아바타 컨트롤) 통과.
- **아바타 scene 재배치(2026-07-31 밤, `ca74d37`, 사용자 목업 승인)**: 아바타 자리 ON이면
  (시청자 미리보기+꾸미기 공통) 표면 안 오른쪽 레일을 접고(grid 컬럼 252→0 트랜지션) 달력이
  표면 1840 전체 차지. 태그 필터 = 아바타 **반대편** 얇은 1열 fixed 레일(.avatar-side-rail,
  인기도 포함), 정보 카드 = 아바타 자리 좌상단·라이브 카드 = 우상단(.avatar-top-cards).
  스프링 슬라이드/팝-인, reduce-motion 존중, <1100px는 평소 복원. 마크업 공용화:
  railInfoCard/renderLegendFilter 추출. ⚠ 스티커는 표면 비율 좌표라 scene(달력 폭 확장)에선
  비-scene 배치와 가로로 어긋남 — 꾸미기도 scene이 켜지므로 scene에서 꾸미면 scene과 일치.
  캡쳐 삭제로 '표면 고정 레이아웃(ADR-0004)' 제약은 사용자 결정으로 해제됨.
  후속(2026-08-01, ~`7b58cd9`): 레일 120px·아바타 22vw·여백 다이어트, 인기도 1열 축약
  (is-compact), 카드=점선 박스 완전 위(+꾸미기는 --avatar-h 72px 축소로 헤더/토글 회피),
  꾸미기 단축키 안내 접기+의미 그룹 3개,
  시청자 달력 Ctrl+휠 글자 확대 100/125/150(포스터 --cal-zoom, 하단 배율 배지).
- **스티커 scene/확대 드리프트 최종 해결(2026-08-01, ~`b865b5f`)**: 저장 좌표(DB)는 기본
  지오메트리(아바타 OFF·100%) 표면 비율 그대로, 렌더 시 기준(canon)↔현재(live) **실측 앵커
  구간별 매핑**으로 보정(저장 시 역매핑). x 앵커=열 경계+각 열의 카드 좌/우변(여백 상수 고정),
  y 앵커=스티커가 앉은 칸의 [칸 top·날짜줄·각 카드 상/하단·칸 bottom]. 기준은 항상 probe
  (한 프레임 안에서 scene 클래스/--cal-zoom을 트랜지션 off로 원복→실측→복구, reflow 후 클래스
  해제로 재전환 방지)로만 얻고, 표면 등장/월 슬라이드 애니 중엔 미루고 450ms 재시도(중간
  지오메트리 오염 방지). 월 전환 시 기준 무효화. Playwright 실측: 6모드(아바타×확대) 카드
  4지점 delta 0.0px, 5회 로드 동일 수렴. fixture `?avatar=1`, dev `__stickerMapDebug`.
  ⚠ 상수 폴백의 252/16은 .poster-surface 컬럼과 동기.
- **피드백 루프 3회전(2026-07-30, `4a06856`·`60ba610`·`43ebf8f`)**: 사용자 스크린샷 지적 →
  즉시 수정 방식. 주요 결정·함정 기록:
  - **그림판 왼쪽 기둥 = 달력 카드만(콘텐츠 높이, 항상 펼침)** — '접기=좌측 수납' 안도,
    그 다음 '아바타 점선 자리' 안도 사용자 결정으로 순차 제거. 접기 토글 자체가 없어졌고
    헤더는 월 라벨 span. 접기/아바타 존 재도입 금지.
  - 레이어 썸네일은 **전체 판 100% 축소**가 정본(획 bbox 크롭 안은 위치 맥락 상실로 롤백).
  - 미니 달력 '보냄'은 글자 배지 금지 — 칸 하이라이트 + aria-label만.
  - 도구 셸프: max-height 상한 금지(바닥 고정, 위로 성장 — 상한이 굵기 행을 잘랐음),
    굵기 6개 한 줄, 그룹 stretch로 등고.
  - 공지류 모달: 하단 여백은 스크롤러 padding-bottom이 아니라 **sticky 푸터 자신이** 가진다
    (스크롤러 방식은 푸터 아래 투시 구간 발생).
  - `.scope-opt.on::after` 같은 높은 특이도 구규칙은 리디자인 오버라이드 시 **같은 특이도로
    기하까지 전부 재선언**해야 함(체크 마크 어긋남 사고).
  - flex 컨테이너 안 혼합 인라인 텍스트는 조각화됨 — 문장은 항상 단일 span으로 감싸기(tag-tip).
  - 저장 배지: 최장 상태 폭 min-width 고정 + 좌측 정렬(출렁임 금지 패턴).
  - **신규 기능**: 모바일 시청자 일정 카드 탭 → 상세 바텀시트(`agenda-detail-*`, 공개 DTO만,
    태그 이름·색 표시). 데스크톱 미연결(아젠다 전용).
  - 검증: tsc·build·vitest 324개 통과. Playwright visual은 미실행(신규 시트 baseline 없음 —
    다음 visual matrix 배치에서 수용할 것).
- (시작 기록) 애플 리디자인 시작(`c64dbc5`, PLAN-20260730-002): 기반=타이포 역할 토큰 6종
  (--text-*, 현행값 스냅) + 1화면(데스크톱 편집 패널) 11종 px→6역할 수렴 + me-seg 동심.
  방식: 화면당 1슬라이스 배포→**사용자 눈 확인 후** 다음(2=상단 IA는 모형 승인 선행,
  3=모바일, 4=꾸미기, 5=시청자 크롬). 롤백 금지 목록(모달 글래스·fly 전이 등)은 플랜 참조.
- **✅ 사용자 실기기 검증 완료(2026-07-30, `4f2cc3c` 기준)**: 범위선택 복원·undo/redo·
  키보드 달력·모달 트랩·월 북마크/panel 딥링크·평소 편집 흐름·저장 칩·읽기전용 상세·
  역할 팝오버·스티커 키보드·캡쳐 폴백·모바일 시트/오늘/스낵바·아젠다 경계 — 전부 정상 확인.
- **P2 잔여(리디자인과 무관, 선택)**:
  `COLOR-1` 색 picker 키보드/컴팩트 시트, `CONFLICT-1`(증거 게이트 — 실제 충돌 관찰 후),
  STICKER-1 잔여(스냅 큐·터치 핸들), A11Y-2 잔여(200/400% 줌·SR 실기), INSIGHT-1 잔여(데이터 표).
  **그 다음(또는 ARCH-1 후) 애플 기조 리디자인**(TOKEN 이관·IA 재편 포함).
- **주의**: role fixture·canary 자동화는 아직 부분적(event-validation 단위 테스트만). 계획서
  K5 매트릭스 기준으로 슬라이스마다 채울 것.

## (이전) Objective

시청자 포스터의 **몰입·재미·편의 개선**(스냅샷 + 멀티에이전트 평가/리서치 기반)이 방금 끝났고,
지금은 **편집실 UX 다듬기**와 **시청자 참여 기능**으로 넘어가는 중.

## Current Status

- **운영 중(안정)**: 공개 포스터(`/`), 편집실(달력/태그/멤버/비공개 레이어), 꾸미기·PNG export,
  하트(비로그인 포함), 관리자 인사이트, 태그 2계층, 비공개 본문 암호화, 방송시간 기록.
- **2026-07-29 — '이 달 기록' 닫기 정책 + 애플 HCI 벤치마크 1차**(`bb23f6f`, `bf70da9`, `028e6f0`):
  - '이 달 기록' 시트는 **백드롭 클릭으로 닫히지 않는다**(신고 반영 — 같이보기 방송 중 오클릭
    사고 방지). 닫기 = X·Esc·뒤로가기만. overlay-pop에 800ms 유예 안전망(방금 안쪽이 닫혔으면
    지각 popstate도 안쪽 몫 → 미리보기 오닫힘 방지, 대신 시트 닫은 직후 0.8초 내 뒤로가기는
    한 번 무시될 수 있음 — 의도된 비대칭).
  - **X/백드롭 → 편집실 튕김은 현재 코드로 재현 불가**였다(dev·prod build, 정상/cold-entry/
    좁은폭/판서 churn/더블클릭 전부 미리보기 유지 확인). 원인 미상 리포트에 대해 위 정책 변경
    + 안전망으로 대응. 재현용 **편집실 fixture** `app/visual-fixture/studio`
    (`VISUAL_TEST_FIXTURE=1` 전용, owner actor + 샘플 데이터, `?viewer=1`로 미리보기 cold-entry)
    를 추가했다 — 오버레이 스택 회귀는 여기서 인증 없이 실측할 것.
  - **애플 HCI 리서치 보고서** `docs/ux/apple-hci-benchmark-report.md`(조화·몰입·재미 3×3,
    적용 후보 12건 P1~P3). 1차 적용(A1·A2): `globals.css`에 `--spring-smooth/--spring-bouncy`
    `linear()` 스프링 토큰(+`--dur-spring-*`), 전역 버튼 누름 70ms 즉각/뗌 스프링 복귀,
    '이 달 기록' 시트 등장·아바타 자리 등장/슬라이드·pop-number 스프링 치환. 다음 후보:
    C1(재질 토큰)·A3(코너 동심 감사)·B1(모바일 시트 드래그 닫기).
  - lint 경고 6건 제거로 `npm run lint`(max-warnings=0) 게이트 복구.
- **2026-07-29(밤) — 애플 HCI 벤치마크 P1~P2 일괄 적용**(`a67b758`…`1aaf2c5`, 검증 12/12 PASS):
  - **마이크로 인터랙션**: 모든 X 닫기 버튼에 그림판 X와 같은 호버 90° 회전+스프링 복귀
    (.pi-close/.modal-close/.dtp-pop-x/.m-edit-x/.peek-close/.bp-kbd-close). 모달·팝오버·
    바텀시트 등장을 `--spring-smooth`로 통일.
  - **C1 재질**: `--material-*` 토큰 + 모달/날짜시간·태그색·확대 팝오버/판서 단축키 안내를
    반투명 블러 유리로(@supports 가드, export surface 밖).
  - **B1**: 모바일 편집 시트 끌어서 닫기(`lib/ui/use-sheet-drag-close.ts`) — 1:1 추적·위로
    러버밴딩·릴리스 속도 스프링·임계 햅틱. **함정 2개 실측으로 잡음**: pointerdown 즉시
    setPointerCapture 금지(click이 캡처 요소로 가서 X 먹통), click 억제 플래그는 제스처 후
    반드시 자동 해제.
  - **B2**: 모바일 카드→시트 matched-geometry morph(열림=카드에서 자람, X/백드롭 닫기=역방향),
    웹은 카드 잔상 비행(`lib/ui/fly-ghost.ts`)으로 고정 편집 패널과의 연결감만.
  - **B3**: 스티커 경계 러버밴딩(표시만, 저장 좌표는 기존 clamp·직렬 큐 불변) + 스냅 노치 햅틱.
  - **B4**: 아젠다 필터 FLIP(`lib/ui/list-flip.ts`) — 시청자·편집실 모바일 아젠다.
  - **D1**: 캡쳐 성공 시 완성본 미니 썸네일 스프링 팝인 + 2틱 햅틱.
  - **부수 대어**: 편의 캡쳐(클립보드)가 **07-19부터 조용히 깨져 있었음** — `.event-subs`
    세로 레일의 `color-mix` computed(`color(srgb …)`)를 html2canvas가 파싱 못 해 전체 throw.
    transparent border + `::before`(currentColor+opacity)로 픽셀 동일하게 복구(`4a88582`).
    **교훈: export surface 안에는 color-mix 금지**(html2canvas 한계).
  - 검증 인프라: `scripts/_verify_hci.mjs`(12항목 실측), visual baseline 재캡쳐(stale이었음 —
    clean HEAD에서도 실패 확인 후 갱신). fixture가 프로덕션 빌드에서 무스타일이던 문제
    (studio-shell.css는 (studio) layout 소유)도 fixture 직접 import로 해결.
  - **디스코프**: C2 타이포 역할 토큰(전면 px 토큰화) — 100+ 지점 산재라 시각 리뷰 없이
    일괄 치환은 회귀 위험이 커 보류. A3 코너 동심 전수 감사도 스폿체크만(보상 썸네일 등
    신규 UI는 규칙 적용). 다음 세션에서 화면 단위로 진행 권장.
- **2026-07-27에 끝난 것 — 일정 그림판 작업 문맥 편의**:
  - 패널 세션에서 처음 일정을 보내면 `일정` 레이어 표시·활성 + `선택` 도구로 자동 전환. 모든
    카드를 뺐다가 다시 보내는 경우를 포함해 이후 보내기는 현재 그림 레이어·도구 유지. 보내기 뒤
    disabled 버튼에 남던 키보드 포커스도 다음 작업점으로 이동. 숨긴 일정 레이어에 새 날짜를 보내도
    레이어 표시를 복구해 결과가 즉시 보임.
  - 색 선택은 `선택/지우개 → 펜`, 굵기 선택은 `선택 → 펜`; 형광펜·지우개·도형처럼 해당 값을
    직접 쓰는 도구는 유지. 색·굵기·그리기 도구를 고르면 최근의 표시·잠금 해제 그림 레이어로
    자동 복귀. 숨김/잠금 자동 해제와 레이어 자동 생성은 하지 않음.
  - 커스텀 색 미리보기 취소 시 색뿐 아니라 도구·레이어도 원복. 새 빈 레이어는 선택/지우개 상태면
    펜으로 시작. 레이어 삭제/undo/redo 뒤에는 사용 가능한 그림 레이어를 우선 선택하고, 일정 레이어
    문맥은 이력 조작이 뺏지 않음. 미니 달력 `보냄` 표시 + 중복 전송/무의미한 undo 이력 제거.
  - 스타일러스에서 OS가 CSS 커서를 숨겨 판서 중 도구가 안 보이던 문제: pen 전용 DOM 커서를
    추가. hover/down/move 추적, up/cancel/lost-capture/leave 정리, 펜·형광펜·지우개 footprint와
    도형 crosshair/아이콘 표시. 마우스 전환 시 native cursor 복구, 활성 pen 우선권·touch 무시,
    240Hz 경로는 React state 갱신 없음.
  - 새로 열면 `펜 + #000000 + 레이어 1`로 즉시 판서 가능. 그림 레이어의 썸네일·이름을
    마우스/펜으로 직접 끌어 보라 삽입선 위치에 놓는다. 5px 의도 임계값, drag ghost,
    독립 목록 edge auto-scroll, `Alt+ArrowUp/Down` 대체 경로를 제공하고 이동 1회만 통합
    undo/redo 1건. drop 위치는 drag 시작 때 한 번 측정해 긴 목록의 pointer move layout 재측정을
    없앴고, 다중 포인터·목록 밖 drop·Esc·pointercancel은 안전하게 취소. 새 레이어는 스크롤
    목록 맨 위로 자동 노출·포커스하고 키보드 순서 이동도 화면 안에 유지. 눈·잠금·삭제는
    drag에서 제외하며 `일정` 구조 레이어는 맨 아래 고정.
  - 임의의 그림 레이어 6개 hard cap과 `(n/6)` 노출 제거. `+ 새 레이어`로 계속 추가하되 기존
    총 backing-pixel 예산을 레이어 수로 나누고 필요하면 0.25 scale 아래까지 해상도를 적응시킨다.
    DOM·썸네일·stroke 비용은 별도라 물리적 무한을 보장하지 않으며, 수백 레이어가 실제 요구되면
    virtualization·hidden backing 해제를 후속 검토.
  - 상단을 `현재 작업·기록 명령 / 이름이 보이는 도구·도형 / 색상 팔레트·빠른 판서 설정`으로
    재구성. 좁은 데스크톱 폭은 내부 가로 스크롤, 명령 바는 줄바꿈. 선택 카드 정렬은 선택
    문맥에서만 나타난다.
  - 모바일은 일정 그림판 진입점이 없어 범위 제외. 검증: vitest **294/294**, typecheck,
    changed-files lint, production build 통과. 전체 build의 기존 lint 경고 5개는 유지.
    구현 커밋 `376e7eb` Vercel Production 성공. 연결 브라우저가 없어 실제 렌더·마우스 drag·
    실기기 펜 스모크는 미실행.
- **2026-07-12에 끝난 것**(커밋 `9324779`…`c509657`):
  - 미니게임 opt-in화 + 시즌 테마 강제 해제 + 태블릿(641~1040px) 아젠다 전환 → [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md)
  - 포스터 마스트헤드/시각 위계/대비(WCAG AA) · 모션 토큰(`--ease-enter/exit`, `--dur-4/5`) ·
    빈 날 접기 · 셀 호버 · 하트 승급 토스트
  - **시청자 '이 달 기록'(공개 인사이트)** — 관리자와 같은 차트 재사용, 집계 RPC로만 개방 →
    [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md) (마이그레이션 0049·0050 적용 완료)
  - 편집기: 공개 범위·옵션 접기(기본 접힘), 단축키 안내 축약, **새 일정 = Alt+N 하나로 통일**,
    카드 순서 드래그 삽입선 판정(카드 중심선 기준)
- **2026-07-26에 끝난 것**(`6e1ee43`, `4c7b01c`):
  - **하트 배지 사라짐 수정**(`6e1ee43`, 마이그레이션 0054 적용 완료): 로그인 토글
    `toggle_event_heart`가 익명 하트를 빼고 집계를 반환 → 클라가 그 작은 수로 덮어써
    배지(🔥 5개↑)가 사라지고 새로고침해야 복귀하던 증상. 0040에서 이 함수만 합산 누락.
  - **방송시간 머리 손실 수정**(`6e1ee43`): 세션 started_at을 '첫 폴링 발견 시점' 대신
    방송국 API `broad.broad_start`(실제 뱅온 시각)로 기록(`fetchSoopBroadStart`,
    bno 일치 확인 + 이상치 가드). 시청자가 늦게 들어오면 그만큼 깎이던 문제(4h24m→4h).
    꼬리(ended_at=last_live_at)는 보수적 추정 유지. → [[broadcast-time-tracking]]
  - **판서 패널 손맛·필기감**: `4c7b01c`·`45e3711` 이후 연구값을 제품 예산으로 과장하지 않게
    [근거 아카이브](../ux/broadcast-panel-inking-research.md)를 교정. coalesced 단일 소비 +
    분리 prediction 캔버스, 필압 감마(^0.65)·시간 기반 EMA, pen-priority palm guard
    (첫 touch 오탐/hover 연장/pointercancel 커밋 제거), WCAG 잉크 아이콘 대비·중립 outline,
    KST 오늘 링 자정 갱신, 레이어 28px 표적. 작업대는 따뜻한 라이트 톤 유지. 모바일은 기능
    진입점 자체가 없어 범위 제외. 검증: vitest 256/256 · typecheck · production build 통과;
    연결 브라우저가 없어 실제 판서 화면/실기기 펜 검증은 미실행.
- **2026-07-25에 끝난 것(2) — 방송 가독성 2종(토리님 승인, PLAN-20260725-001)**
  (`15181d4`·`57f2c75`·`effd28c`·`3c8cd46`·`9717a57`·`6d2b359`):
  - **A안 달력 확대**: 달력 패널 위 Ctrl+휠만 가로채 `--cal-zoom` CSS 변수로 100/125/150%
    단계 확대(브라우저 줌의 모바일 전환 부작용 회피). 125%+는 서브 접기 `+N` + 상세 팝오버
    (핀·Esc·실측 배치·포커스 복귀). 트랙패드 정규화·드래그/FLIP/유령 회귀 가드,
    buildbox `−/%/＋` + 확대 중 하단 플로팅 배율 표시. `lib/ui/calendar-zoom.ts`(13 tests).
  - **B안 방송 판서**: 미리보기(owner/developer·PC)에서 여는 전체화면 불투명 모달.
    서버 공개 스냅샷→명시 DTO만(→ [ADR-0010](decisions/ADR-0010-broadcast-panel-public-dto-only.md),
    teaser fail-closed 마스킹, 유출 canary 테스트). 미니 달력 다중선택→날짜순 나란히,
    stroke 벡터 엔진(`lib/broadcast/stroke-engine.ts`, 증분 렌더·undo 200·DPR/픽셀 cap),
    배경 DOM+캔버스 3장 동좌표 스크롤, 화면 맞춤(판서 있으면 잠금), 히스토리 스택 편입
    (뒤로가기=판서만 닫힘), 닫으면 완전 소멸(저장소·클립보드 미사용 정적 단언).
  - 훅 확장: `useCellRangeSelect`에 exemptRefs·getSelected·clearSelection·toggleIndex·
    escapeClears(opt-in, 기존 소비처 불변).
  - 검증: tsc/lint/build 0 · vitest 229/229 · Codex 더블체크 게이트 총 16회(G0×3 · G1×3 ·
    G2×2 · G3a×2 · G3b×6) 전부 통과. **남은 검증**: 실기기 스모크
    [docs/ux/broadcast-tools-qa-checklist.md](../ux/broadcast-tools-qa-checklist.md) 전항 미실행.
- **2026-07-25에 끝난 것**(`9911cb7`, `a03670e`):
  - **방송시간 오귀속 수정 + 재발 방지**(`9911cb7`, 마이그레이션 0051): 연속 방송이 새벽·무관중
    폴링 공백(`SESSION_GAP_MS` 4h)을 만나 두 세션으로 쪼개지고 뒷부분이 다음날로 오귀속되던 버그
    (실제 22일 9h34m→3h41m). SOOP **BNO(방송번호)**를 세션 연속성 정답값으로 도입 —
    `broadcast_session.bno` + `recordLiveTick(bno)`, bno 같으면 공백 무시하고 이어 붙임. 과거
    22·23일 데이터도 보정(1회, 하드코딩 id). → [[broadcast-time-tracking]] 갱신.
  - **월별 방송시간 툴팁 잘림**(`9911cb7`): 최신 막대가 100시간대(3자리)면 `.trend-bar::after`가
    가운데 정렬이라 패널 밖으로 잘리던 것 → 첫·마지막 막대만 가장자리 정렬.
  - **모바일 아젠다 형식색 점**(`a03670e`): PC처럼 마지막 서브 줄 오른쪽에 인라인(높이 절약) +
    오른쪽 정렬. 편집실은 왼쪽 정렬 별도 줄이었음. `.agenda-subs .pill-sub-last` 추가.
- **2026-07-21에 끝난 것**(`6c52a2a`): 시청자/편집실 다듬기 3종 —
  (1) 비로그인 '이 달 기록'의 최근 6개월 트렌드(StackTrendChart, vt-*)가 스타일 없이 깨지던 것.
  vt-* 구조 규칙이 `studio-shell.css`(=편집실 전용)에만 있어서 — 2026-07-17 하이라이트 카드와 **동일
  버그 클래스**. 구조 규칙을 공유 `insights-charts.css`로 옮겨 해결(anon playwright로 3차트 렌더 확인).
  (2) 모바일 시청자 아젠다 폭(좌우 22)이 편집실(`.studio-mobile` 14)보다 좁아 같은 글자 수 특별한 날
  표기가 시청자에서만 줄바꿈 → `.agenda-mode` 좌우 14로 통일(데스크톱 서페이스 기본 22 불변). 색상
  필터 레일은 시청자 104 vs 편집실 92인데 시청자 레일은 '이 달 기록'·미니게임·'내 관심' 라벨이 92↓에서
  잘려 유지 → 잔여 ~12px 폭차는 의도. (3) 특별한 날 조합 표기 순서 '이름·경기'→'경기·이름'.
- **2026-07-17에 끝난 것**: '이 달 기록'·인사이트 잘림 3종 —
  (1) 하이라이트 카드 스타일이 `studio-shell.css`(= (studio) 레이아웃 전용)에만 있어 **비로그인
  시청자에겐 통째로 안 붙던 버그**를 발견해 `insights-charts.css`로 이동(차트가 이미 같은 이유로
  분리돼 있던 것과 동일 조치). (2) 긴 제목 = 가로 스크롤 대신 …+호버/탭 툴팁(`.hl-sub`도 검사),
  문장형 sub는 아랫줄 전체 폭. (3) 일별 방송시간 툴팁을 툴팁 실측 폭으로 clamp(고정 32px이라
  1일·말일에서 패널 `overflow-x:hidden`에 잘렸다). 포스터 상단 '내 관심'/'이 달 기록' 간격 추가.
- **2026-07-17(2)**: 꾸미기 — 업로드한 커스텀 이모지를 눌러도 달력에 안 올라가던 버그.
  칩 래퍼 div에 `setPointerCapture`를 걸면 뒤따르는 click이 **캡처 요소로 리타겟**돼 안쪽
  `<button>`의 onClick이 아예 오지 않는다(브라우저 실측). 캡처는 관리 권한자에게만 걸려
  관리자에게서만 재현됐고, 같은 이유로 칩의 × 삭제도 죽어 있었다. → 캡처 경로에선 pointerup에서
  직접 추가하고, ×는 캡처를 걸지 않는다. **교훈: 포인터 캡처 + 안쪽 버튼 onClick 조합 금지.**
- **2026-07-17(3)**: 꾸미기에서 놓은 스티커가 시청자 화면에서 칸 대비 위로 떠 보이던 문제.
  표면 **안**에 모드로 갈리는 것이 있으면 안 된다(ADR-0004). 범인은 **🔥 관심 등급 배지**
  (`tier`가 `interactive &&`로 게이팅 → 꾸미기엔 없음): 이 배지가 카드 흐름에 있어 1행 +7px,
  2행 +19px → 표면 26px 김 → 칸은 26px 내려가고 스티커는 비율이라 14px만 내려가 ≈12px 어긋남.
  같이 고친 것: 메모 칸(내용 없으면 시청자만 컬럼째 접혀 가로로 밀 수 있던 잠복 버그) → 항상
  자리 유지 + 라벨만 숨김 · 범례 태그(꾸미기만 `<span>`이라 3.8px 차) → 마크업 통일 + disabled ·
  ♥ 인기도 안내 박스도 모드 무관 렌더. 실측: 표면 높이·달력 42칸·범례 Δ **전부 0**.
  → 남은 리스크(2026-07-17 **감수하기로 결정**): 하트가 5개(`HEART_MIN`) 문턱을 넘으면 그 카드에
  배지가 생기며 칸이 7~19px 커진다 → 월초에 놓은 스티커가 하트가 쌓이며 조금씩 밀린다.
  단 그 순간에도 꾸미기·시청자·PNG는 서로 일치한다(등급 상승 🔥→🔥🔥→👑은 줄이 이미 있어 높이 불변
  — 문제는 0↔5 문턱 하나뿐). 배지를 absolute로 빼는 안은 **기각**: 표면이 26px 줄어 기존 스티커를
  전부 한 번 재조정해야 하고, 카드 네 귀퉁이가 이미 ♡(우상)·형식색 점(우하)·제목(좌상)·소제목(좌하)로
  차 있어 어디에 놔도 겹친다. '메타 줄 항상 예약' 안도 기각(35개 중 26개 카드가 그 줄이 없어 포스터가
  100px 넘게 길어진다). 다시 꺼내려면 이 비용부터 반박할 것.
- **2026-07-17(4)**: 작은 스티커의 크기·회전 핸들이 스티커를 삼키던 문제. 디자인 툴 밴치마킹
  (Sketch=선택박스 부풀리기 / Figma=핸들 숨김 / PS·AI=겹쳐 쌓기, 공통점은 **핸들을 객체 크기에
  비례시키는 툴이 없다**) 후 **Sketch식 최소 선택박스**를 채택: 스티커가 작으면 링을 화면 기준
  72px까지 부풀려 핸들을 스티커 밖으로 밀어내고, 링 안쪽 전체가 이동 손잡이가 된다.
  회전은 알약 버튼을 없애고 링 바깥 22px 띠(Photoshop식 핫존, 호버 시 점선+⟳ 힌트)로.
  핸들은 `--poster-scale` 역보정으로 **어느 배율에서도 화면 28px**(히트영역 44px).
  → 참고: 이 값들은 `.sticker-item`의 `--h-size/--h-hit/--ring-min/--rot-band/--ring-out`.
- **2026-07-17(5) — 개선안 배치 1~3 적용**(`1d50628`, `ba59cb3`, `3c30810`, `20f3682`):
  하트 2단계 햅틱 + 실패 토스트(액션이 **throw**하면 롤백조차 안 되던 구멍을 실물 테스트로 발견) ·
  월이동/관심토글/필터해제/시트X 촉감 통일 · 브로드 게이팅 3곳 제거(TagPicker·태그삭제·취소) +
  tags/palette prop에 in-flight 가드 · 미들웨어 matcher에서 비콘·공개 API 제외 · 월드컵 장난감
  dynamic 전환(`/` 177→152 kB, 꾸미기 181→151 kB).
  → **곁가지로 프로덕션 500 발견·수정**: `/api/public/vic/events`가 Server-Timing 헤더의 한글
  desc 때문에 매 요청 500이었다(헤더는 ByteString만). 공개 API 계약인데 e2e가 NOT RUN이라
  흘러갔다. `ServerTiming.header()`에서 방어 + 유닛 테스트 4개 추가(vitest 140).
  **교훈: e2e(`npm run test:e2e`)를 계속 안 돌리면 공개 계약이 조용히 깨진다.**
- **2026-07-17(6) — 개선안 배치 4~6**(`d276c91`, `c17955a`, `a52b1dd`, `3a5eac4`):
  필터 흐림에 업 도움 끈 포함 + 스르륵 전환 · 리사이즈 rAF 스로틀(폭 안 바뀌면 갱신 0회) ·
  `getEventsForDate` 정리(**단 감사의 "O(N²) 최우선"은 실측 결과 오판 — filter가 sort보다 먼저라
  병목 아님. 250건에서 0.22→0.20ms**) · 폰/태블릿 '이 달 기록' 진입점(ISSUE-002 해소) + 바텀시트 ·
  하트 탭타깃 44px(의사요소 — 표면 지오메트리 불변 확인).
  → 새 안전망: `tests/unit/events-for-date.test.ts` 10개(달력 정렬 규칙 고정). vitest 150.
  → **함정 2개 기록**: ① 미디어쿼리는 우선순위를 안 올린다(모바일 블록은 기본 규칙 뒤에 둘 것)
  ② **PowerShell 5.1 `Set-Content`로 한글 문서를 쓰면 깨진다**(시스템 코드페이지) — 문서 수정은
  Edit 도구로만.
- **2026-07-17(7) — 개선안 배치 7~10 + 신고 대응**(`69b619f`, `492de15`, `a07caf1`, `dc69957`,
  `29f5d6f`, `503d628`): 인사이트 로딩 점프 46→4px·정직한 실패 · 폰 뒤로가기로 시트만 닫히게 ·
  버튼 셋(켜기/이 달 기록/편집실) 옷 통일 + 미니게임 칩 32px · 하이라이트 네 장 골격 통일 ·
  Esc 해제/단축키 안내 · **드래그 이동 Ctrl+Z** · 서버 왕복(admin 싱글턴·캐시헤더·page 병렬·
  GoTrue N+1·0051 RPC+폴백) · **죽은 코드 1,483줄 제거**.
  → 겹친 오버레이 뒤로가기: 편집실과 그 안의 포스터가 **각각** popstate를 들어 한 번에 둘 다
  닫혔다. "안쪽이 표식 남기고 바깥이 건너뛴다"는 **실패**(바깥이 먼저 불려 안쪽을 언마운트시킨다).
  → `lib/ui/overlay-pop.ts` 카운터 방식으로 해결. 새 오버레이를 겹칠 땐 이걸 쓸 것.
    (**2026-07-18 정정**: 이 카운터도 '순서 무관'이 아니었다 — 아래 (8) 참고.)
- **2026-07-18 — 신고 2건**(`f5c058d`, `3272736`):
  ① '이 달 기록' X/바깥클릭이 미리보기까지 닫아 편집실로 튕김. 원인: overlay-pop 카운터를
     안쪽 메아리 핸들러가 **동기적으로** 내렸는데, 미리보기 안 포스터는 새로 마운트된 자식이라
     그 popstate 리스너가 바깥(StudioShell)보다 **먼저** 불릴 수 있다 → 바깥이 볼 땐 이미
     innerDepth=0 → '내 pop'이라 오인해 viewerMode를 닫았다. (7)의 '순서 무관' 가정이 틀림.
     → 메아리의 `popInnerOverlay()`를 `queueMicrotask`로 미뤄 그 디스패치가 끝난 뒤 내린다 →
     리스너 순서와 무관하게 바깥은 이번 pop을 안쪽 것으로 본다. **교훈: 겹친 popstate에서
     공유 카운터는 그 디스패치 안에서 내리지 말 것(microtask로 미룰 것).**
  ② 자동 '기타' 태그가 `display_name==="기타"` 리터럴에 묶여, 운영자가 그 태그를 지우자
     아무 태그도 안 붙었다. **불변식("이벤트당 콘텐츠 ≥1")을 버렸다**: 태그 0개 = 색 없는
     흰 카드 허용(서버·클라 강제 부착 제거), '기타'는 인사이트에서만 합성 버킷(태그 0개 공개
     일정, 휴뱅 제외)으로 카운트. **교훈: UI/DB 불변식을 특정 태그 '이름'에 묶지 말 것.**
- **부분 완료**: 축구/월드컵 시뮬 — taxonomy·기초 적립 완료(68 테스트). 물리·인지 제약 정밀화 남음.
  월드컵 자동 테마는 `KOREA_MATCHES` 수동 입력 대기.
- **2026-07-18 — 태그 색 커스텀화 프로젝트 시작**(계획 `docs/tags/custom-tag-color-plan.md` v4.1,
  코덱스 4라운드 적대검수 반영·디스코프). 방향: 무늬 유지(색맹 단서)+가독성만 고침+커스텀 bg_hex+
  단일 resolver. **Phase 0-pre 첫 슬라이스 완료**(`b36b01c`): 공개 sample/type 분리 —
  `sample-public-data.ts` 신설, 공개 트리(public-loader·proposals route)가 privateMeta·requests
  품은 sampleStudioSchedule을 import하던 공개경계 잠복 위반 제거 + `public-boundary.test.ts`(정적
  import 가드 + 폴백 누출검사). 공개 API 출력 불변.
  **Phase 0-pre 비주얼 스위트도 완료**(`76f5186`): dangling이던 `test:visual`을 실제 스위트로 —
  `app/visual-fixture/poster`(VISUAL_TEST_FIXTURE=1 전용 route, 플래그 없으면 not-found·포스터
  미노출) + `playwright.visual.config.ts`(production build, viewport/DPR 고정, 애니 정지) +
  baseline(viewer-surface, `[data-export-surface]`만, OS별=현재 win32). **함정**: 언더스코어 폴더
  (`app/__x`)는 Next private라 라우팅 제외 → route 폴더명에 언더스코어 금지.
  **Phase 0A 진행 중**: 특성화 테스트(`tag-visual-contract.test.ts`, 17개)로 현재 색/잉크 동작을
  못박고(`edbee1d`), 단일 resolver `lib/tags/tag-visual.ts`(`createTagVisualResolver`) 신설
  (`2263540`) — visualOf(rootTagId·kind·colorKey·bg·border·legacyTextColor·patternKey·missing),
  이벤트 분배는 month.ts에 위임(정의상 동일). **시청자 포스터 카드 색을 resolver로 이관**(`217cbce`),
  비주얼 하네스로 구코드 vs 이관 = **픽셀 동일 증명**. **비주얼 하네스 flaky였다**(교훈): render
  타이밍 변화가 전역 diff 유발 — 원인 ①월드컵 공 JS rAF(CSS animations:disabled로 안 멈춤)
  ②`--poster-scale`가 폰트 로드 타이밍에 좌우. → 스펙에 reduce-motion 토글(localStorage
  `vic.reduceMotion=on`)로 rAF 정지 + 폰트 후 resize 재측정 + 표면 높이 안정 대기로 굳힘.
  **다음**: 나머지 표면 이관(studio-shell 카드·insights 4맵·칩·범례). ⚠ Phase 1 전 필수:
  pattern_key CSS 재작업(`data-pattern` + {shape,ink,alpha}), 무늬 CVD 자동배정.
- **미착수**: 시청자 출석 도장(체크인) — 계획서만 있음(`docs/insights/viewer-checkin-attendance-plan.md`).

## Active Work

**시간대 동접 차트 오독 + 타임라인 접기 손실 수정(2026-08-07)** — 실측 조사 결과 데이터는 정상
(8/7 22:13 기준 23시 0건, 마지막 막대는 21·22시). 문제는 표시였다: ① 눈금이 6시간 간격뿐이라
오른쪽 끝을 24시로 외삽해 읽음 → **3시간 간격 + 오른쪽 끝 `24` 끝선**(일별 모달·월별 대시보드 공통).
② 아직 안 지난 칸과 0인 칸이 같아 보임 → **오늘이면 `nowMark`(KST 소수 시각)로 '지금' 마커 +
이후 칸 흐리게**(`DayVisitDetail.nowMark`). ③ 진행 중인 시간의 분모가 3600초 고정이라 22시가
실제의 1/5로 찍힘 → `computeOccupancy(rows, days, partial)`가 그 칸만 **경과 초로 나눔**(하한 60초).
④ 행동 타임라인 접기가 `kind+target`만 봐서 `diag.visible`의 true/false가 한 줄로 뭉쳤고, 시각도
첫 항목 것만 남아 4시간 뒤 재진입이 사라짐 → **meta 지문(hops·count 제외) 비교 + `lastT`로
'첫–끝' 표시**(화면·복사 리포트 동일). 검증: tsc/lint/build/vitest 592 통과, 브라우저 실측 미수행.

**'진행 중인 구간'을 완료된 구간과 구별 — 인사이트 전반(2026-08-07, 위 수정의 확장)** —
같은 계열의 오독을 전 표면에서 제거했다. ① 6개월 추이 배지가 이번 달 며칠치를 지난달 전체와
비교해 매달 초마다 ▼70%가 뜨던 것 → `lib/insights/month-progress.ts`(순수, KST) +
`components/studio/trend-delta-badge.tsx` 공용 배지. 진행 중이면 `≈`(지난달 같은 페이스 환산치와
비교) + '진행 중 7/31일' 칩 + 마지막 막대 빗금. 개발자 인사이트·멤버 인사이트·방송시간·
StackTrendChart(시청자 공개 인사이트 포함) 전부 같은 규칙. ② 월별 시간대 동접도 진행 중인 칸은
경과 초로 나누고, 아직 안 온 칸은 오늘을 관측일에서 뺀다. ③ 관리자 접속 세션 트랙: 막대 폭이
실측 체류였던 것 → **span(시작~끝)**, 안쪽 채움 = 실제로 떠 있던 시간, 미종료 세션은 `.live`
(오른쪽 열림 + '지금'). ④ 일별 세션·미니달력·방송 일별 막대에 오늘/미래 구분. ⑤ 24h 축 통일
(3시간 간격 + 끝 `24`): 히트맵은 칸 중앙 정렬로 교정, 관리자 트랙은 `HourTicks`(경계 눈금)로 교체.
⑥ 방문 요약(`visitGist`)이 라벨만 접어 횟수를 잃던 것 → ×N 유지. 검증: tsc/lint/build/vitest 600
(month-progress 8 신규) 통과, 브라우저 실측 미수행.

**태그 색 커스텀화 — 기능 전체 구현 완료**(Phase 0~3, `85d6faf`까지). 커스텀 색이 전 표면 일관
반영(카드·2색·점·칩·범례·상세·인사이트) + 편집기 색 칸(단색 입력 + 톤 프리셋 파스텔/부드럽게/선명/
깊게 + 대비 배지 AA + 기본 되돌리기) + 서버 검증(#RRGGBB·대분류만·재부모 NULL). 무늬 전면 제거.
DB `bg_hex` 컬럼(0052) 적용됨. **색 편집 UI 재설계 완료**(`fe403a5`): 네이티브 color input(쓰기
어렵고 디자인 따로 놀고 행이 늘어 좌우스크롤)을 버리고 **팝오버 색 피커**로 — 행은 스와치 하나,
팝오버에 SV영역(좌표)+색조 슬라이더+톤 프리셋(4칸)+프리셋12색+미리보기/hex. 앱 토큰으로 통일.
**포털(body)+fixed**라 편집기 overflow에 안 잘림(스와치 rect 기준 배치, 화면밖이면 위로 flip).
마운트 onChange 억제(열기만 해도 색 박히던 버그 방지). AA배지 제거(잡음), 흐릴 때만 경고.
`color-picker-popover.tsx` + `color-tone.ts`(HSV/톤/대비). **남음 = 실사용 후 자잘한 디자인 피드백.**
아래는 세부 이력.

--- (세부 이력) ---
태그 색 커스텀화 — 0A(resolver 이관)·0B(가독성) 완료, **무늬 전면 제거 완료**(`cd53f06`,
baseline 교정 `5d2039e`). 토리님 결정으로 무늬 알파↓론 체감 없어 아예 제거 — 카드/칩 단색.
globals.css `[data-color=*]` 무늬 + `.evt-pat` 삭제, eventInkStyle isPatternColor 분기 제거(2-arg),
2색 `.evt-pat` 오버레이 제거. geometry Δ0. **Phase 1 대폭 단순화**: 무늬 없으니 pattern_key CSS
재작업·CVD 자동배정 blocker **소멸**(bg_hex 컬럼만). **함정 기록**: CSS 변경 후 비주얼 baseline이
안 바뀌면 **`.next/cache` 제거**하고 재빌드(next build가 옛 CSS를 캐시함 — 무늬 제거 때 실제로 당함).
**Phase 1 첫 슬라이스 완료**(`198c3d1`): `broadcast_tags.bg_hex` 컬럼(0052, **prod 적용됨**) +
resolver `buildEffectivePalette`(대분류 bg_hex가 colorKey 엔트리 덮어씀 → 카드·칩·범례 전부 bg_hex
반영, 없으면 palette 폴백=렌더 불변) + 로더 select/매핑 + BroadcastTag.bgHex. 커스텀 색이 end-to-end
흐름(태그에 bg_hex 넣으면 즉시 표시). **배포 순서 지킴**: 마이그레이션 먼저 적용 후 push.
**Phase 2 완료**(`922674d`): saveTagsAction이 bgHex 검증(#RRGGBB)·저장(대분류만, 세부/재부모 NULL
강제) + 편집기 대분류 행에 `<input type=color>` + '팔레트로' 되돌리기 + Draft.bgHex 배선 + 낙관 반영.
**커스텀 색 end-to-end 사용 가능** — 관리자가 색 골라 저장하면 카드·칩·범례 반영. **토리님 원래 목표
(원하는 색 지정) 달성.** **남음(폴리시)**: Phase 3 = HSLuv 색환 피커(현재는 네이티브 color input) +
톤 프리셋. 지금도 기능은 완전 동작 — 피커는 UX 고급화일 뿐. (ADR-0006 keepalive 라우팅은 태그 저장
전반의 기존 tech-debt로 별건.)
아래는 이전 0A/0B 상세.
- (이전) **0B 1차(가독성)**(`164fb71`, 지금은 무늬 제거로 대체됨).
0B: 무늬 알파↓(indigo 34→18·mint 10→6·sky 11→7·gen 6~7%) + eventInkStyle 전 카드 헤일로
(text-shadow=paint-only라 굵기·레이아웃 불변, 스티커 안전). 무늬는 유지(색맹=hue별 '모양'이 담당).
**geometry.spec 하드 게이트 신설**(offset 기반=결정적: 표면 자연 폭/높이·칸 높이·스티커 비율좌표) +
비주얼 fixture에 무늬 카드(대회=indigo) 추가(샘플에 무늬-fill 카드가 없어 커버 못 하던 구멍). 지오 Δ0
실측. **비주얼 하네스 교훈 추가**: getBoundingClientRect는 transform:scale subpixel로 run간 흔들림 →
지오는 offsetWidth/Height + 인라인 스타일로 측정할 것. **다음**: 0B 더(scrim 강화/AA 미달 태그) 또는
Phase 1(bg_hex). ⚠ 미이관(의도): 상세 칩 raw colorKey, insights 4맵(bg_hex는 Phase 1). ⚠ Phase 1
전 필수: pattern_key CSS 재작업(`data-pattern`+{shape,ink,alpha}), 무늬 CVD 자동배정.

## 배포가 안 될 때 (2026-07-17 실제로 겪음 — 다음 에이전트가 같은 길로 헤매지 말 것)

**증상**: `git push`는 성공하는데 Vercel Deployments에 **새 항목이 아예 안 생긴다**(실패도 아니고 무반응).
프로덕션은 옛 빌드를 계속 서빙한다.

**원인은 대개 우리 코드/설정이 아니다.** 2026-07-17엔 **GitHub 장애**였다 — Vercel 대시보드가
"GitHub Outage — affecting automatic deployments and account connection" 배너를 직접 띄웠다.
곁가지 증상: 대시보드의 GitHub 관련 칸이 회색 스켈레톤으로 멈춤(=계정 연결 API 실패), 배포가
붙어도 8분+ 지연.

**진단 순서**(위에서부터, 각 단계가 서로 다른 원인을 배제한다)
1. `git ls-remote origin refs/heads/main` — 원격에 커밋이 실제로 갔는지. (갔으면 우리 잘못 아님)
2. **배포된 사이트를 직접 읽어** 어느 커밋까지 반영됐는지 확인(추측 금지). 예:
   `https://vic-schedule-studio.vercel.app/` HTML에서 `/_next/static/css/*` 를 받아 특정 클래스
   존재 여부로 판독. (2026-07-17엔 삭제한 `.home-grid`가 남아 있는지로 판정했다.)
3. Vercel → Deployments: **새 항목이 없다** = 이벤트 미수신(장애·연결). `Error` = 빌드 실패(로그 보기).
   `Canceled` = Ignored Build Step. `Queued/Building` = 그냥 밀린 것(기다린다).
4. Vercel 대시보드 상단 **배너**(장애 공지) · `status.vercel.com` · `githubstatus.com`.
5. GitHub 쪽: 저장소 Settings → **Webhooks는 비어 있는 게 정상**이다(Vercel은 GitHub App을 쓴다.
   여기서 헤맸다). 볼 곳은 Settings → **GitHub Apps** → Vercel → Repository access.

**장애/연결 문제일 때 우회 배포(=GitHub를 안 거치고 로컬 코드를 Vercel이 빌드)**
```bash
npx vercel link --yes --project vic-schedule-studio --scope bluesky-s-project3   # 최초 1회(.vercel 생성)
npx vercel --prod --yes                                                          # 즉시 프로덕션 배포
npx vercel ls vic-schedule-studio --scope bluesky-s-project3                     # 배포 목록 확인
```
- CLI는 이미 `bluesky8bya`로 로그인돼 있다. `.vercel/`은 `.gitignore`에 있다.
- **주의**: `vercel link`가 `.env.local`을 프로젝트 환경변수로 **덮어쓴다**(그리고 .gitignore에 추가).
  로컬에만 있던 값이 있었다면 확인할 것.
- Git 연결이 실제로 풀렸다면 `npx vercel git connect` (대화형 확인 필요 — 에이전트는 못 누른다.
  사용자에게 터미널에서 직접 실행 요청할 것. 성공 시 `> Connected` 출력).

**교훈**: "push했으니 배포됐겠지"로 보고하지 말 것. **배포된 사이트를 읽어서** 확인하고 말하라.

## Known Issues

- **ISSUE-008 — (해결 2026-08-05) 그림판: 지우개가 주변까지 지우고, 채운 색이 범위 밖인데 선택됨.**
  뿌리 3개. ① 획은 포인터가 움직인 만큼만 점을 남긴다(빠르면 20~60px 간격) — 그 점 단위로
  지우니 점 하나가 닿으면 양옆 구간이 통째로 날아갔다 → 지우개 근처만 1.5px로 다시 샘플링해
  자른다(`refineNearEraser`). ② 도형은 닿으면 통째 삭제였다 → 윤곽을 폴리라인으로 펴서 닿은
  만큼만 덜어내고 남은 조각은 `tool:"poly"`. **poly는 곡선 보간 없이 곧은 선으로 그린다** —
  중점 베지어로 그렸더니 직각 모서리가 30px씩 깎였다(실측). ③ 그림(채우기 조각)을 상자로
  판정했다 — 채우기 상자는 화면 절반만 하고 대부분 투명이라 여백만 긁어도 통째로 잡혔다 →
  알파 마스크(`lib/broadcast/image-mask.ts`)로 칠해진 픽셀을 본다(선택·지우개 양쪽).
  덤으로 깜빡임: 구운 PNG가 디코드될 때까지 재생에서 그림이 빠졌다 → 방금 만든 캔버스를
  들고 있다가 즉시 그린다(`bmpCache`).
  전수 점검표는 `docs/ux/broadcast-eraser-checklist.md`(A~E 25항목, 전부 자동 검증 + 뮤테이션).
- **비주얼 기준선의 외부 의존(2026-08-05).** 포스터 기준선이 **방송 ON/OFF**에 흔들렸다
  (라이브 카드가 통째로 사라지며 레일 레이아웃이 밀림 — 23583px diff). 썸네일 마스크만으로는
  부족하다(카드의 **유무**가 레이아웃이다). `poster.spec.ts`가 `/api/soop-live`를 가로채
  `isLive:false`로 고정한다. **규칙: 외부 실시간 상태가 레이아웃을 바꾸면 마스크가 아니라
  라우트 스텁으로 고정한다.**
- **ISSUE-007 — (해결 2026-08-05) 비주얼 스냅샷 6건 red = 기준선 미갱신.**
  원인은 커밋 `711ef82`(2026-07-31, 사용자 결정) **상단 마스트헤드 제거** — 연·월을 레일 정보
  카드로 옮기며 표면이 1137→998px(−139)로 짧아졌는데 지오메트리·픽셀 기준선을 그때 다시 안 찍었다.
  추적 방법 기록: dev 서버에서 재면 1137(옛 값), prod 빌드에서 998 → "커밋이 아니라 빌드 모드
  차이"로 보였는데, 실제로는 **dev가 다른 라우트의 CSS까지 전부 실어** 옛 레이아웃을 흉내 낸
  것이었다. 지오메트리 판단은 반드시 prod 빌드(visual config)로 한다.
  지금 상태가 의도된 모습이라 6건 모두 재기록했다(지오메트리 diff는 surface.h 한 줄뿐 —
  칸 높이 150·스티커 비율 좌표 불변).
  **규칙: 레이아웃을 의도적으로 바꾸는 커밋은 같은 커밋에서 `npm run test:visual -- --update-snapshots`
  를 돌려 기준선을 함께 갱신한다.** 안 그러면 게이트가 상시 red가 되어 진짜 드리프트를 못 잡는다.
- **안정성 테스트 확충(2026-08-05).** 오늘 사고들이 전부 "테스트가 없어서 몰랐던" 곳이라
  6개 축을 메웠다. 앞으로 이 영역을 만지면 여기부터 돌린다.
  ① 편집실 실물 e2e(`tests/visual/studio-editor.spec.ts`) — `/api/studio-write`를 가로채
  **명령 내용·순서**를 검사한다(운영 DB 무접촉). 저장/실패 표시/직렬 큐/삭제→되돌리기/드래그
  이동/keepalive. ISSUE-001(편집실 실물 검증 불가)의 실질적 우회로.
  ② 그림판 되돌리기·다시실행(`broadcast-undo.spec.ts`) — 지우개·채우기가 장면 통째 교체
  경로라 새로 위험해진 자리. 그림판은 서버 저장이 없어 되돌리기가 유일한 안전망이다.
  ③ 쓰기 라우트→캐시 무효화(`public-cache-revalidate.test.ts`) — 라우트 op 6종 + 미등록 op.
  ④ 최초공개(`teaser-reveal.spec.ts`) — 공개 전 제목이 DOM·RSC payload 어디에도 없는지,
  카운트다운이 0에서 실제로 요청을 쏘는지, 실패해도 화면이 죽지 않는지. fixture `?teaser=<초>`.
  ⑤ 자정(KST) 경계 — `kstDayKey` 단일 출처로 모으고(적재/조회가 갈리면 조용히 어긋난다)
  경계·연말·윤년 + 탭이 자정을 넘길 때 방문이 안 합쳐지는지.
  ⑥ 1000행 cap — 페이지네이션을 `lib/db/paginate.ts` 하나로 모으고 경계/오류/무한루프 방어.
  ⚠ 가짜 시계(page.clock)는 SSR 카운트다운과 어긋나 하이드레이션 오류를 만든다 — 실제 대기로.
- **ISSUE-006 — (해결 2026-08-05) 그림판: 채우기가 다시 번지고, 지운 게 선택됐다.**
  ① 채우기를 '찍은 점' stroke로 저장해 **재생마다 다시 flood fill**했다 → 나중에 경계가 뚫리거나
  획이 움직인 뒤 화면이 다시 그려질 때 엉뚱한 데까지 번졌다. 이제 채운 결과를 그 자리에서
  비트맵 조각(image stroke)으로 굳힌다 — 재생은 그림 한 장 그리기라 몇 번을 그려도 같고,
  선택·이동·크기변경·지우개가 붙여넣은 그림과 같은 규약으로 공짜로 따라온다.
  ② 지우개가 destination-out **획으로 장면에 남아** 화면에서만 가렸다. 그 획을 선택하면
  '지우개 위로 올리기' 로직 때문에 지운 부분이 그 자리에서 되살아났다(실측: alpha 0→255).
  이제 커밋 시점에 기하를 덜어낸다(펜·형광펜은 남은 구간으로 분할, 도형은 통째 삭제,
  그림은 픽셀에 구워 넣기). 지우개 stroke는 더 이상 저장하지 않는다.
  검증은 **브라우저 실물**: `tests/visual/broadcast-erase-fill.spec.ts` 3종(옛 코드에서 3종 모두
  실패 → 새 코드 통과 확인). fixture(`/visual-fixture/studio`)로 로그인 없이 편집실을 띄운다 —
  ISSUE-001(편집실 실물 검증 불가)의 우회로가 생겼으니 앞으로 편집실 회귀도 이 길을 쓴다.
- **ISSUE-005 — (해결 2026-08-05) 한 탭이 두 방문으로 갈려 타임라인이 텅 비어 보임.**
  방문 키(`visit_key`)는 프레즌스 비콘이 sessionStorage에 넣는데, 화면 진입 기록(route.enter)이
  그보다 먼저 나가 `visit_key=null`로 저장됐다. 묶기 로직은 키 없는 행을 '그때까지 만들어진
  방문'에만 얹어서, 그 행이 탭의 첫 기록이면 별도 방문이 생기고 뒤이은 키 있는 기록은 또 다른
  방문이 됐다 → 60분 방문인데 '항목 1건'(2026-08-05 실측, owner 16:33~17:44).
  ① 클라가 **보낼 때** 키를 다시 찍고 ② 묶기는 두 번에 나눠(키 있는 행으로 뼈대 → 키 없는 행을
  `visit_session` 구간·계정·역할로 붙임) 옛 기록도 제자리를 찾는다.
  ⚠ 같이 확인된 사실: 그날 owner 이벤트는 실제로 11건뿐이었다(클릭 0). 데이터 유실이 아니라
  **정말 아무 버튼도 안 누른 방문**이었다 — 지표를 의심하기 전에 원본 행을 먼저 본다.
- **ISSUE-004 — (해결 2026-08-05) 일정 생성·삭제가 시청자 화면에 최대 5분간 반영 안 됨.**
  `saveEventAction`/`deleteEventAction`에서 `revalidatePath("/")`·`revalidatePath("/studio")`·
  `revalidatePublicSchedule()` 3줄이 커밋 `72f6971`(행동 기록 추가) 때 **통째로 삭제**돼 있었다.
  공개 로더는 `unstable_cache(TTL 300초)`라, 무효화가 없으면 새 일정이 시청자·미리보기에 5분간
  안 뜨고 지운 일정은 그대로 남는다. 이동/순서(`reorderEventsAction`)만 무효화가 남아 있어
  "옮기면 반영, 새로 만들면 안 됨"이라는 헷갈리는 증상이 됐다(2026-08-05 실측 로그로 확인).
  지운 것이 떡밥이면 서버가 그 id를 못 찾아 카드가 **빈 흰 칸**으로 굳었다(강력 새로고침도 같은
  캐시). 재발 방지: `tests/unit/public-cache-revalidate.test.ts`가 (1) 액션을 실제로 실행해
  `revalidateTag` 호출을 확인하고 (2) `lib/schedules/*-actions.ts`의 모든 쓰기 액션을 훑는다.
  **교훈: 쓰기 액션에 무언가를 끼워 넣을 때 캐시 무효화 3줄을 같이 지우지 말 것.**
- **ISSUE-001 — (2026-08-05 해소) 편집실 실물 검증.** 이제 두 겹으로 닫혀 있다:
  ① 브라우저(`tests/visual/studio-editor.spec.ts`) — fixture로 편집실을 띄우고 `/api/studio-write`를
  가로채 클라가 보내는 **명령의 내용·순서**를 검사.
  ② 서버 왕복(`npm run test:integration`) — 서버 액션 → 실제 DB(RPC save_event_atomic /
  reorder_events_atomic) → 공개 로더 재조회까지. 생성·수정·삭제·복구·태그·이동·최초공개 가림·
  잠금 없이 비공개 저장 거절. **RLS는 이 층의 대상이 아니다**(actor를 owner로 고정하고
  service-role로 접근한다 — RLS는 공개 경계 e2e와 SQL 정책 담당).
  남은 진짜 공백은 '브라우저에서 진짜 로그인 세션으로' 도는 경로뿐인데, 그건 테스트용 인증
  우회로를 만들어야 해서 **일부러 안 만들었다**(보안 경계가 최우선 — CLAUDE 충돌 우선순위 1).
  ⚠ 통합 테스트 안전 규칙: 과거 달에만, 제목에 `[통합테스트]` 표식, afterAll에서 물리 삭제 +
  잔여 0 확인. 이걸 어기면 시청자 실시간 화면이 오염된다.
- **ISSUE-001(원문) — 편집실 실물 검증이 막혀 있음.** 편집실(`/studio/*`)은 Google 로그인이 필요해
  로컬 Playwright로 실물 확인을 못 한다. 최근 편집실 변경(공개범위 접기, 단축키, Alt+N, 드래그
  삽입선)은 타입·빌드·코드 리뷰까지만 검증됐다. Status: Open.
  → 다음에 편집실을 만질 땐 사용자에게 실물 확인을 요청하거나, 테스트용 로그인 경로를 마련할 것.
- **ISSUE-002 — 모바일에는 '이 달 기록' 진입점이 없다.** 버튼(`.insights-open`)이
  `.public-calendar-header`에만 있는데 모바일(≤640px)은 아젠다 레이아웃이라 이 헤더를 안 그린다
  → 모바일 시청자는 공개 인사이트를 열 수 없다. Status: Open(미요청, 별도 판단 필요).
- **ISSUE-003 — 미리보기 낙관 경로가 teaser를 안 가린다.** `studio-shell.tsx`의 viewerMode
  미리보기는 낙관적 `events`에서 공개 일정을 추리는데(spread + privateMeta 제거), 공개 시각 전
  teaser의 실제 `publicTitle`이 서버 redaction 없이 그대로 미리보기에 노출될 수 있다(방송 화면
  공유 시 유출면). 판서(B안)는 ADR-0010으로 이 경로를 우회했지만 미리보기 자체는 남아 있다.
  Status: Open (2026-07-25 판서 작업 중 발견 — 수정 시 spread 제거 + 공유 redaction 적용 방향).

## Locked / Stable Areas — 명시적 이유 없이 건드리지 말 것

| 영역 | 왜 잠겨 있나 | 근거 |
|---|---|---|
| `lib/schedules/public-loader.ts` + `app/api/public/*` | 공개 경계. 비공개 필드가 새면 제품의 핵심 약속이 깨진다 | [ADR-0001](decisions/ADR-0001-public-private-server-boundary.md) |
| 공개 인사이트에 들어가는 값 | 방문/체류(운영 지표)는 공개 금지. 방송·하트는 **집계만** | [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md) |
| 포스터 표면 지오메트리(폭 1840 고정, JS 스케일) | 뷰포트 미디어쿼리로 표면 내부를 재배치하면 스티커 좌표가 어긋난다 | [ADR-0004](decisions/ADR-0004-poster-surface-geometry.md) |
| 시즌 연출(미니게임·테마) | 기본 꺼짐·클릭 통과·오너 테마 우선 | [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md) |
| `PRIVATE_DATA_ENC_KEY` / 암호화 배포 순서 | 키 분실 = 비공개 본문 복구 불가 | [ADR-0002](decisions/ADR-0002-private-content-encryption.md) |
| 오너 바인딩(`OWNER_EMAIL` + `calendars.owner_id`) | 한쪽만 바꾸면 RLS로 저장이 조용히 실패 | [ADR-0003](decisions/ADR-0003-owner-dual-binding.md) |
| 스튜디오 월 라우트 | 북마크/콜드 진입 전용. 런타임 라우트 월 이동 금지 | [ADR-0005](decisions/ADR-0005-month-routes-cold-entry-only.md) |

## Open Decisions

- 하트 인기 배지를 절대 임계값 → **상대 순위**로 전환하기로 합의만 됨(미구현).
- 공개 인사이트에 방문자 지표를 넣을지(현재는 의도적으로 제외 — ADR-0008).
- 꾸미기 심화 중 보류: 칸별 데코 / 스티커 그룹 / 스티커 팩.

## Next Exact Steps

0. **마이그레이션 0051 적용** — `node scripts/apply-db.mjs db/migrations/0051_visit_known_accounts.sql`
   (새/재방문 판정용 DISTINCT RPC + `(day, account_hash)` 인덱스. 미적용이어도 코드가 옛 경로로
   폴백하므로 급하진 않지만, 적용해야 인사이트 열 때의 순차 왕복 40회+가 사라진다.)
1. **개선안 백로그 배치 1~10 전부 완료**(`docs/plans/refinement-backlog-2026-07.md`).
   보류 항목과 "이 감사에서 배운 것"은 그 문서 머리에 정리돼 있다.

1. 시청자 출석 도장: `docs/insights/viewer-checkin-attendance-plan.md`의 A안(오늘만, 서버 KST 강제).
   `event_hearts` 패턴 복제(비로그인 기기 토큰 포함), 마이그레이션 + `*_grants.sql` 잊지 말 것.
2. 멀티에이전트 리뷰가 제안한 Phase 3 잔여(사용자 승인 시): 시청자 저장/공유 버튼 + OG 메타 +
   월별 고정 PNG URL, LIVE/카운트다운 pill, 꾸미기 스탬프 모드, 휴방 상태를 1급 셀 상태로.
3. 축구 시뮬: GK 손→패스/개인기 규칙·물리·인지 제약 정밀화(`docs/sim/`).

## Last Verified (2026-07-17, 배치 1~10 이후 · 프로덕션 실측)

| 확인 | 결과 |
|---|---|
| 프로덕션이 최신인가(사이트 직접 판독) | **예** — 삭제한 `.home-grid`가 배포 CSS에서 사라짐 = `503d628`까지 반영 |
| `/api/public/vic/events` | **200** (한글 Server-Timing 헤더로 매 요청 500이던 것 수정됨) |
| 배포 경로 | GitHub 장애로 자동배포가 멈춰 **`npx vercel --prod`로 직접 배포**함(위 "배포가 안 될 때" 참고) |
| GitHub 자동배포 | 장애 회복 중(8분+ 지연 관측). 복구되면 push→배포가 저절로 정상화된다 |

## Last Verified (2026-07-17, 배치 1~3 이후)

| command | result |
|---|---|
| `npm run typecheck` / `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — **140** tests (server-timing 4 신규) |
| `npm run test:e2e` | **여전히 NOT RUN** — 이것 때문에 공개 API 500을 오래 못 봤다. 다음에 꼭 돌릴 것 |
| 공개 API 실물 | `/api/public/vic/events` 200(240건) · `/api/soop-live` 200 · `/api/presence` start 200 |
| 하트 실물(Playwright, vibrate 후킹) | 정상 [12,12] 두 톡(37~43ms 간격) · 실패 [12,20-60-20] + 토스트 후 2.6초 자동 해제 |
| 번들(로컬 prod 빌드) | `/` 152 kB · 꾸미기 151 kB · 편집실 221 kB. 초기 스크립트 16개에 월드컵·축구 코드 없음 |
| 7월(월드컵 달) 연출 실물 | 미니게임 버튼·중력 공·결승 표기 497ms에 정상 등장 |

## Last Verified (2026-07-17, 이전)

| command | result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | 0 errors (기존 경고 4 — `--max-warnings=0`이라 exit 1) |
| `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — 136 tests |
| 공개 '이 달 기록' 실물(Playwright, prod build, 비로그인) | PASS — 하이라이트 카드 스타일 적용, `pi-body` 가로 넘침 0(560=560), 긴 제목 …+툴팁(그리드 폭 안), 일별 툴팁 안 잘림 |
| 편집실 인사이트 '트렌드' 탭 실물 | **NOT VERIFIED** (로그인 필요 — ISSUE-001; 같은 컴포넌트를 공개 시트에서 검증) |
| 꾸미기 팔레트(DecoratePalette) 실물 | PASS — 로그인 벽 우회용 임시 라우트에 실제 컴포넌트를 올려 Playwright로: 수정 전 "칩 클릭→아무 일 없음"·"× 안 됨" 재현, 수정 후 클릭/터치탭 추가·× 삭제·드래그 순서·탭 분류이동 전부 OK, 중복 추가 없음. 임시 라우트는 삭제함 |

## Last Verified (2026-07-12)

| command | result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | 0 errors (기존 경고 4) |
| `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — 136 tests |
| `npm run test:e2e` / `test:visual` | NOT RUN |
| 마이그레이션 0048·0049·0050 | 적용 완료(Supabase) |
| 공개 포스터 실물(Playwright, prod build) | PASS — 미니게임 opt-in, 태블릿 아젠다, 인사이트 시트 |
| 편집실 실물 | **NOT VERIFIED** (로그인 필요 — ISSUE-001) |

---

## 이 저장소의 하네스 범위

`project-initializing_260710.md`의 **최소 도입안**만 채택했다.
채택: 이 파일 · ADR(`docs/decisions/`) · 매니페스트(`agent-harness.yaml`) · provenance ·
**자동화 훅**(`.claude/settings.json`: SessionStart 브리핑 + Stop 시 상태 갱신 확인).
미채택: `docs/agent/` 별도 트리, 상시 ExecPlan/Handoff, `CHANGELOG_AGENT.md`, 코드 내 `[WH-CHANGE]`
주석 규격 — 각각 기존 `docs/` 트리, `docs/plans/`, 한국어 git log, 이미 짙은 "왜" 주석과 중복이다.
