# 빅타민 숨바꼭질 교감·최초공개 연결 검증

2026-10-16 KST. [PLAN-060](../plans/PLAN-20261016-060-companion-hide-and-find-play.md), [PLAN-061](../plans/PLAN-20261016-061-companion-premiere-handoff.md). 구현·배포·실제 공개 화면 검사 완료. 실행 범위와 미검증 항목을 구분한다.

## 숨바꼭질

원인은 detail bridge가 PC 최초 위치 계산 및 모바일440ms 전환이 끝나기 전에 발견 상태를 발표한 데 있었다. 실제 sheet 준비 신호 뒤 최종 내부 위치에서 처음 표시한다. 일반 창의 조용한 잠자기는 그대로이고 발견한 guest만 기존 몸 전체 교감·6px 드래그 경계·키보드 입력을 받는다. 밖에 놓아도 상세창은 유지하며, 닫을 때 최신 실제 발판으로 한 번 정착한다. sheet DOM이 다른 일정에 재사용되면 public event ID까지 검증해 권한을 정리한다.

060 고정 snapshot(HEAD `8d0412d3`+미커밋060, 해시는 ignored `.scratch-pw/companion-060-built-source.json`)에서 build→type/scopedlint exit0, 관련35단위 통과. 실제 PC1920/native390 등4사례40.5초 통과. 첫 guest 표시의 최종 위치/scale 오차0, 밖drop 뒤 창 유지 및 닫은 뒤 x오차0, pet/room BCR0·전체Range0·quiet write0, POST0. 자동 복귀 actualscroll16px/발 오차.00003px. PNG 직접 검수.

단, 독립 검토에서 잡기 취소 후 기존100ms release mixer가 조기 정지하는 P2를 발견했다. 실제250ms 뒤 PC sy1.2896/mobile1.1604와 잡기 pivot이 남았다. 최초4사례 통과를 이 결함의 해결로 부르지 않는다. raw 로그/보고서는 `.scratch-pw/companion-060-initial-render*`에 보존했다. 유한160ms release tail 수정 뒤 최종4사례 전체 재실행41.6초 통과. 추가한 sy<1.05 및 중립 pivot 오차.5px 단언은 실제250ms 뒤 PC/native390 모두 sy1/sx1·pivot46px92px로 통과했다. 발견 진입의45초 age/rare 선택만 제어했으며, bridge440ms·이후 입력/교감은 실제 시간이다. 최종 증거는 `.scratch-pw/companion-060-hide-review.log`, `companion-060-hide-review-report.json`과 PNG다.

## 최초공개·패널 퇴장

공개 ID·revealAt·상태만 전달하는 allowlist 계약과 순수 시간/세대/귀환9개, 실제 끝점/상단 여백/유한 이동3개, 패널 타이밍/연속성/복구·물리 viewport10개를 포함해37파일385건 통과했다. 최종5차 production fixture build→전체lint→postbuild type 모두 exit0. 4차 뒤 최종 변경은 body clip CSS 하나로 순수/런타임 단위를 중복 실행하지 않았다. 테스트 파일군은 `viewer-companion`, `premiere`, `public-dto`이며 과거 더 넓은386건 실행과 혼합하지 않는다. 060 최종4사례는 위와 같다.

독립 검토에서 고친 결함: 반환 발판의 anchor 객체 대신 `.element` 비교(최초 build도 타입 오류로 실패, 해당 raw 로그 보존), 미합류 대상 삭제 시 새 generation 발행 및 현재 ID 재검증, 레일/compact 집의 React inactive와 지휘자 inert 원복 충돌, exit 없는800ms 반환 중 집 unmount, 반환 중 집 조작 해제, resize 뒤 오래된 입장/귀환 좌표. 최종 검토자는 수정된 코드에서 추가 확정 차단 결함이 없다고 보고했다. resize와 다른 ambient owner/숨김은 코드 검토 범위이며 이6사례만으로 실제 OS/모든 창 크기 전환을 검증했다고 하지 않는다.

패널은 기존 순서 안의1.8초 비행과 같은 그룹140ms 간격, 준비 반동·가장자리 곡선 이동·절제된 접힘/깊이·후반 opacity를 사용한다. 필터 퇴장 뒤152→148초에 달력이 확장된다. 토글은158→156.2초에 퇴장하고 배지는156→152초에 그 자리로 이어져 앞선16초 공백을 없앴다. 정착한 패널의5개 시간 변수는 값이 같으면 쓰지 않는다. 기존 최종10초 전체 시계의 모든 쓰기까지0이라고 주장하지 않는다. 자기 집2종의 inactive는 React 하나가 소유하고 지휘자는 표시만 소유한다.

최초061 여섯 사례는3통과/3실패였다. 모바일에서 불투명도0의 퇴장 패널이 실제 가로 overflow를 만들어390×844 화면의 innerWidth/Height가814×1760까지 늘어나는 제품 결함을 확인했다. client/visual viewport는390×844 그대로였다. 제품은 root의 참조수 기반 overflow-x:clip을 공연 및 마지막 cleanup 뒤700ms 유한 귀환까지 유지하며 원래 marker를 복구한다. 안무와 빅타민의 유한 입장/발판/귀환은 같은 client∩visual/offset 물리 bounds를 사용하고 새 per-frame layout read는 없다. 이때 카드가 보인다고 잘못 판정할 수 있어 가시성 검사도 client/visual 기준으로 강화했다. 집 opacity 검사는 진행률만 보지 않고 기존.02 기준까지 유한 CSS가 정착해야 통과한다. 가로 폭 단언은 완화하지 않았다. raw 첫6개 및 별도 모바일 재현 JSON/PNG는 `.scratch-pw/companion-061-initial-six*`, `companion-061-mobile-overflow*`에 보존한다. 제품 수정 뒤 재검증 중이다.

4차061은5통과/1실패로, root clip만으로는 모바일 body의 고정 요소 overflow가 남았다. 실제 스타일 비교에서 html 단독814×1760→html+body390×844/scrollWidth390으로 즉시 복원됐다. 최종 CSS는 같은 marker로 html과 body 모두 clip한다. 실제 CDP 세로pan은 scrollY0→365, visualViewport.offsetTop0 및390×844를 유지했고 sticky header top 차이는.000007px였다. html/body overflowY는 visible이다. ignored `companion-061-final4-six*`, `companion-061-final4-mobile-diagnostic*`, `companion-061-overflow-style-probes.json`, `companion-061-bodyclip-native-pan.json`에 실패 및 비교 증거를 보존했다. root 단독으로 해결됐다는 초기 판단을 대체한다.

최종5차061 여섯 사례는 첫 실행4통과/2검사 기준 실패 후 해당PC/native 입장·귀환2개만 재실행30.7초 통과했다. 단일6개 전체 녹색 실행으로 표시하지 않는다. 실패는 귀환 뒤 평소 brain이 재개된 약283ms의 정상 affection 감소(.3→.2998819583)를 완전 동일로 요구한 기준이었다. 정상 활동 최대2.4초에 해당하는[-.001,+1e-12] 범위와 실제 차이·마지막 반환/표본 시각을 기록하도록 고쳤다. 위치·타이밍·배율·한 번의 귀환·폭 단언은 유지했고 제품 코드는 바꾸지 않았다. 재실행에서는 두 경우 affection 차이0이었다. raw는 `companion-061-final5-first-six*`, `companion-061-review.log`, `companion-061-review-report.json`에 보존한다.

최종 모바일은 실제 터치pan 뒤 scrollY407/inner=client=visual390×844/scrollWidth390, 실제 보이는 카드 y492.5에서 native hit를 확인했다. 입장72.983초→합류68.985초→gather67.915초 순서, 명시적 공개 귀환47rAF·진입 edge1회·실제 공개 카드 안11px→92px를 확인했다. PC도 같은 경로가 통과했다. 공연 OFF·집/compact 퇴장·공개 시각 미룸/중간 취소는 첫 실행의 통과4개로 구분하며, 모든 경우 POST 전달0이다. clip marker가 제거된 정상 화면에서도 PC1920/native390 폭이 복원된다.

기존 `teaser-fluid.spec.ts`의 현재 시계/영역 퇴장, 달력 공간 확장/해제 복구·1840 불변, OFF/reduced 입력 해제, 늦게 추가된LIVE 안무, 계절 캔버스 fixed 포함 블록5개를 한 실행13.9초 통과했다. 이미지 baseline은 바꾸지 않았다. 로그/보고서는 `companion-061-fluid-review*`다.

실제 시간 PC fixture181의 데뷔 박스와 native390 fixture167의 compact 집을 별도로119/146rAF 관측했다. 진행률.4699/.4515에서 opacity1을 유지한 곡선 퇴장 PNG를 직접 열어 검수했다. POST0·브라우저 오류0, 실제 화면 폭/세로pan/1840 기하 확인과 원래 상태 복구를 기록했다. `companion-061-panel-capture.{log,json}`, `companion-061-panel-mid-{1920,390}.{png,json}`에 보존한다. native181에는 퇴장 영역이 없으므로 그 구간을 모바일 비행 검증이라고 부르지 않는다.

로컬 증거: ignored `.scratch-pw/companion-059-final4-hide-premiere-unit.log`, `companion-059-final5-hide-premiere-{build,lint,type}.log`, `companion-061-built-source.json`. 최종3·4차와 이전 스냅샷·최초 build 타입 오류·수정 전060 P2 증거도 삭제하지 않았다. 문서 harness는 기존 RULE_MIGRATION 규칙 목록/실제ID 불일치2건으로 실패했고 이번 제품 코드와 분리해 둔다(`companion-059-final5-hide-premiere-harness.log`).

## 운영 확인

코드 `8f4dcd4662f7b9168f9392dcae9769aa9d50a33e`를 main에 푸시했고 Vercel 자동 배포 success 및 실제 `/api/soop-live` build 동일 SHA를 확인했다. [운영 배포](https://vercel.com/bluesky-s-project3/vic-schedule-studio/BmR1rYASjX287yVSHRQTcsbX7i6S). 로컬 production fixture와 운영을 혼동하지 않는다. 운영에는 시험 일정을 만들지 않았다.

실제 익명 `/`의 과거2025-09를 PC1920 DPR2/native390 DPR1로 검사한2사례가 exit0이다. 공개 build/자두 asset hash 확인 후 기존059 검사를 출력 파일 접두어만061로 바꿔 재사용했다. 양쪽 실제 포인터의 actor hit, 세로 held 최소1.185·HD17/16포즈·관성,8개 음식/9번째 기존8개 보존, 소파 관통 후 실제 바닥30/31rAF·45.78~52.04px 낙하·바닥local오차.0005px 이하, 집 위치/접힘/compact 복귀·같은DOM 유지·임의 추락 없음이 통과했다. POST는 각1개 차단/전달0, 페이지 오류0. PC·모바일 PNG를 직접 검수했다. 개인 최초공개 설정OFF로 다른 달의 실제 공연과 이 일반 동작 검사를 분리했다. 운영에서 최초공개 시험 데이터를 만들거나 실제 공개 시각을 바꾼 검사는 아니다.

증거는 ignored `companion-061-production-deploy.json`, `companion-061-public-production.json`, `companion-059-hide-premiere-public-production.log`, `companion-061-public-production-{1920,390}-home-food.png`다. 재사용한 probe의 SHA256은 `11FF3F9CD69F614518FB8DBF9D53CA0B248490FE2D54214E1657226E7318B093`이다.059 당시 결과는 원래 접두어로 보존했다.

운영 fixture 접근도 읽기만 확인했다. HTTP status만404로 요구한 첫 수동 검사는200으로 실패했으나 응답은 `NEXT_HTTP_ERROR_FALLBACK;404`이며 포스터/fixture props/샘플 이벤트는 없다. 스트리밍 시작 후 not-found가200을 유지할 수 있다는 [Next.js 공식 문서](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)에 맞춰 실제 경계 응답을 확인했다. fixture가 운영에 열렸다고 판단하거나 상태 코드를 바꾸는 제품 수정은 하지 않았다. 증거는 `companion-061-production-fixture-gate.json`이다.

기존 defaultOFF/92px/1840 표면, 공개 DTO/권한/언락/KST, DB/폴링/생산 의존성은 유지한다. 실제 로그인/RLS·물리 OBS·실제 OS 초점/기기 및 소유자 미감 평가는 별도다. 캐릭터 이미지 생성/교체는 하지 않았고 기존 사용자 미술 기록과 보류 자산은 그대로다.
