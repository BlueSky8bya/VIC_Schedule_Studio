# 방송 병행 빅타민 파이프라인 — 2026-10-17

대상: [PLAN-076](../plans/PLAN-20261017-076-companion-broadcast-pipeline.md). 성능 측정 후보는 fixture build `-S59OcmbVUz2SMdS-qZsY`다. 이후 실제 viewport 축소 복구만 보강한 최종 fixture build는 `o7_pMOvCqDKGUak92NA9H`다. OBS/SOOP 실제 송출 장비를 측정한 결과가 아니다.

## 변경

- 기본값: 저장된 선택 없는 PC는ON. 유효한 v1의 명시ON/OFF·세부 취향은 보존하고 master 필드만 없으면ON을 채운다. 손상 JSON/미지원 버전/잘못된 master 타입은OFF다. epoch나 다른 설정을 초기화하지 않는다. 공유 hook의 미확인 hydration seed만OFF로 두어 저장된OFF를 읽기 전 mount/이미지 요청을 막는다. 모바일 제외는 유지한다.
- 이미지: decode 완료한 **동일 HTMLImageElement**를 기존92px clip/등록 wrapper에 옮긴다. CSS URI의 별도 소비/요청을 없애며 준비 전에는 현재 몸체와 그 등록값을 유지한다.8×2 셀은 자식 transform으로만 이동한다. 현재 연결된 그림은 cache에서 보호하고 외부 연결 owner에게서 탈취하지 않는다. 최대3 retained 이미지·동시 decode2, 실패 재시도2회 상한이다. 용량 부족은 현재 그림을 유지하며 기존 표시 경계에서 양보·재시도한다. controller 재시작은 현재 자식을 유지하고 실제 unmount만 해제한다. unmount 중 전역 이벤트로 옛 listener가 다시 paint하지 않게 한다.
- 입력: 모든 쓰다듬기/관성 샘플과 논리 좌표를 보존하며 full60/lite30의 기존 표시 경계에 몸체/손을 묶는다. 짧은120ms 입력 꼬리 동안 조용한14Hz를 입력 cadence로 올리므로 손맛을14Hz로 낮추지 않는다. 감소 동작/off/soft와 일반 창의 수면 동물 직접 옮기기는 즉시 유한 피드백을 유지한다. 누름·인정된 보상·놓기는 즉시 처리하며 최종 몸체를 놓기 전에 그린다.
- 음식: 입력마다 논리 위치는 받되 집 hit-test/기하는 기존 pending drag rAF 한 번으로 합친다. 마지막 rAF 전에 놓아도 집 판정과 표시를 동기 flush하므로 휴지통 대기/낙하가 옛 위치에 남지 않는다. 그래픽 등급은 mount와 pref/auto/storage 이벤트에서 snapshot으로 갱신한다. 음식 낙하/집 추종이 매 프레임 localStorage/auto JSON을 다시 읽지 않는다.
- 공유 환경: 같은 renderer·settings·capability로 시청자/비로그인/미리보기/편집실에 적용한다. 창/비활성/숨김/최초공개 우선순위, 잠들기 전 현재 행동 마무리와 CSS zzZ, 해상도·아트·1840/소파/입 기하·학습은 보존한다. 새 상시 loop·모델·DB·외부 호출·의존성은 없다. 서버 DTO/역할/unlock/KST 변경도 없다.
- viewport 복구: 회귀에서 실제 창 축소 뒤 예전 좌표 아래 발판을 찾지 못해 몸체가 숨는 결함을 발견했다. 실제 width/height 변경만 기존 geometry callback에서 가까운 안전 span·보정 착지 좌표로 복구한다. 일반 scroll의 같은 x 유지·직접 놓기의 첫 아래 발판·소파 충돌은 유지하며 새 observer/RAF/timer는 없다.

## 전후 측정

기준은 직전 실제 빌드 `BGFWYstCt9Lc1MVFCiW2_`, 이후는 위 측정 후보 빌드다. 최종 변경과의 차이는 viewport 복구이며 이 측정은 창 크기를 바꾸지 않는다. 동일 Chromium148·화면1920×1100·시청자/편집실·full/lite·각2회로 전후8회씩, 별도 깨끗한 CDP 구간의 평균이다. 입력은 실제 native80번/약1.4초로 약57Hz이며1000Hz 장치 측정이 아니다. 카운터 관측 구간과 무계측 CDP 구간은 분리했다. 모든 경우 관측한 클라이언트 mutation 요청/페이지 오류0.

| 화면/등급 | 쓰다듬기 Script ms/s 전→후 | 음식 이동 Script ms/s 전→후 |
|---|---:|---:|
| 시청자 full |21.22→20.10|30.83→29.89|
| 시청자 lite |19.11→15.47|28.73→28.74|
| 편집실 full |17.49→18.50|26.51→24.32|
| 편집실 lite |15.86→14.01|24.00→25.59|

동일80입력에서 lite 손 style 쓰기80→40~40.5, 몸체 style 쓰기약206.5~211→113~113.5로45~46% 줄었다. full 손80회와 display rAF 약84회는 유지됐다. 음식 기하 조회는 시청자265rect/146computed/73hit, 편집실286/140/70으로 같았다. 이미 display 주기와 가까운 입력이므로 더 높은 입력률 절감을 입증한 자료가 아니다.

편집실 full 쓰다듬기는 Script+1.01ms/s, lite 음식은+1.59ms/s였다. 두 표본과 자율 포즈 차이를 넘는 일괄 가속/회귀 부재를 주장하지 않는다. 깨끗한 Layout 비용은 이후 모두≤.445ms/s지만 일부+.04~.22ms/s 증가했다. 관측용 hover 기하 조회도 일부 늘었으므로 모든 기하 작업이 줄었다고 하지 않는다. GPU/OBS 렌더링·인코딩·캡처 결과는 별도 측정이 필요하다.

원본/served bundle SHA·입력·환경은 `.scratch-pw/companion-076-perf-{baseline-2026-10-16T19-25-05-956Z,after-2026-10-16T19-34-03-160Z,comparison}.json`에 보존한다. 실제 기능/픽셀 회귀 결과와 구분한다.

## 검증 상태

- 독립 texture/소유권·입력/음식 해제·gfx 검토에서 최종 차단 문제 없음. 해제 직전 최신 음식 paint와 게스트/일반 몸체 최종 paint를 보강하고 재검토했다.
- 최종 build/typecheck/lint PASS. viewport 수정 이후 전체 unit을 다시 실행해 companion49파일546검사 PASS. 전체1683 중1675 PASS/8 FAIL: 기존 ambient-codex2, centering-vs-animation1, public-cache-revalidate1, scroll-position-wiring1, timeline-route1, vod-chat-recovery2와 동일하다. 최종 JSON `.scratch-pw/companion-076-final-release-unit.json`과 동일 실패명 대조 `companion-076-final-release-unit-proof.json`. 전체 suite PASS로 표시하지 않는다.
- 문서 관련 agent-memory18검사 PASS. 최종 harness는 기존 규칙 ID/inventory 불일치2건으로 동일하게 FAIL이며 이번 변경은 AGENTS/규칙 ID를 바꾸지 않는다.
- 신규 방송 경로6 + contact continuity6은 최종 고정 빌드에서 첫 실행12/12 PASS(46.563초, retry/skip/flake0). 시청자·편집실 각각 fresh 기본ON→설정OFF→reload/다른 화면 OFF 보존, legacy OFF cold mount/이미지 요청0, 실제 음식 낙하·집 접힘 중 gfx 저장소 조회0을 확인했다. cold held76프레임에서 body 누락0·숨김 mutation0, decode된 동일 DOM과14개 셀 전환·요청1회를 확인했다. 실제 전체 화면 PNG에서 두 귀·몸체 선명도도 확인했다. `.scratch-pw/companion-076-owned-first-report.json`, `companion-076-owned-source-proof.json`, `companion-076-held-cold.{png,json}`.
- 첫 기존70 회귀는60 PASS/10 FAIL(7.5분, retry0). 실제 viewport 축소 복구1건을 수정했다. 나머지는 최신 승인과 어긋난 창 강제 이동3·클릭 쓰다듬기2·편집실 접힘 제외1·옛 설정 문구1,20행 metadata로32행 runtime의 수동 낙하를 점프로 오인한1, 마지막 키 입력의 다음 display를 기다리지 않은1이다. 제품을 옛 동작으로 되돌리지 않고 검사를 최신 의미로 정정했다. 원본 `.scratch-pw/companion-076-regression-first-report.json`과 최초 실패 artifacts는 보존한다.
- 수정 검사에서 감소 동작의400ms 표시 주기 사이에 짧은 waking 표시를 강제한 추가 실패가 있었다. 감소 동작에만 중간 프레임 개수 의무를 없애고 동일 DOM·좌표·focus·여행 없음·active 도달은 유지했다. full/reopen/blur의 실제 waking 프레임과 parked Range/DOM 쓰기0 기준은 보존한다. 이 실패도 `.scratch-pw/companion-076-corrected-wake-reduced-first-error.md`에 남겼다.
- 최종 build/type/lint PASS, viewport 수정 뒤 관련 viewer-companion48파일539검사·prefs/sprite/문서48검사 PASS. companion-activity-labels7은 앞선 전체 실행 PASS이며 변경 없다. 실제 두 축 및 높이 단독 resize, 자율 ballistic, pointer/keyboard/창 복귀의 집중 검사도 통과했다.
- 최종 `o7_pMOvCqDKGUak92NA9H` native51/51 PASS(208.330초, retry/skip/flake/unexpected0). freshON/legacyOFF와 요청0·cold decoded-node 유지·실제 두 축/높이 단독 resize·키보드/hover/drag·집/음식/소파/긴 프레임·감소동작·모바일 제외·창 뒤 유지/재기상·숨김/최초공개 우선순위를 확인했다. 창 닫힘 첫 프레임/기상 중 위치 오차0, focus 탈취0, blur 후 parked 기하조회/DOM쓰기0. `.scratch-pw/companion-076-final-report.json`, `companion-076-source-proof.json`, `companion-076-final-resize.png`.

## 운영 확인

2026-10-17(KST) 제품 `0da8ce9ec79f60612a7fdcedf82a9281c69ae92a` commit/push 후 Vercel/GitHub success, 실제 `/api/soop-live` build 전체 SHA 일치와 공개 페이지200을 확인했다. 제품6파일은 검증한 최종 fixture build의 SHA와 commit 내용이 일치한다. 운영 runtime에서 동일 lazy CSS `818f468665319dcd`·JS `7863.951e9155fe0af329` 및 실제 요청 응답·`vc-texture`/gfx/학습 설정 표지를 확인했다.

운영 공개 `/`의 독립 익명 Chromium2context: 설정 key 없는 freshON에서 mount1·실제 준비된 `<img>`1(1536×384)을 확인했고 저장 key를 임의 생성하지 않았다. 명시v1OFF는 cold/reload 모두 mount0·texture0·이미지 요청0, 저장값false 유지다. 양쪽 페이지 오류0. 클라이언트 mutation은 전부 차단했으며 fresh1/OFF2개의 시도는 전송되지 않았다. 일정 선택/하트/로그인/실제 내용·계정정보 수집은 하지 않았다. 버전용 기존 GET 자체의 서버 유지 작업까지 DB쓰기0이라고 주장하지 않는다. 실제 계정 편집실과 OBS/SOOP/GPU 실기기 검증은 이 익명 smoke의 범위가 아니다.

근거: `.scratch-pw/companion-076-production-deploy.json`, `companion-076-deployed-resources.json`, `companion-076-committed-source-proof.json`, `companion-076-production-smoke-0da8ce9e.json`. 로컬 fixture 서버·검증 browser는 종료했다. 기존 아트/사용자 미커밋 파일은 그대로 두었다.

## 공식 근거와 한계

- [MDN Image.decode](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode): decode한 **그 이미지**를 준비 후 DOM에 삽입하는 경로. 이 프로젝트의 CSS 별도 소비 간격은075의 실제 실패 증거와 구별해 검증한다.
- [브라우저 layout batching](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing), [animation performance](https://web.dev/articles/animations-and-performance): 읽기/쓰기 배치와 transform 중심 표시 참고. 계수·프레임/메모리 예산은 VIC 선택이다.
- [Chrome LoAF](https://developer.chrome.com/docs/web-platform/long-animation-frames):50ms 초과 자료의 귀속은 그 아래 작업 전체나 실제 모니터 표시의 증거가 아니다.
- [OBS 성능 문제 설명](https://obsproject.com/kb/encoding-performance-troubleshooting): GPU 합성·장면·인코딩 부하는 브라우저 JS 결과와 다르다. 이 검사가 실제 방송 PC/SOOP의 무끊김을 보장하지 않는다.
