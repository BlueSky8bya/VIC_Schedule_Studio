# 패널 제목·접기와 빅타민의 접지·교감

2026-10-15 KST. [PLAN-048](../plans/PLAN-20261015-048-victamin-panel-and-touch.md). 사용자 최신 요청이 PLAN-047의 무문자 집 제목과 클릭 전용 교감을 대체한다. 이전 검사를 현재 PASS로 재사용하지 않는다.

## 구현·근거

- `PanelSection` 하나로 태그 필터·계절 배경·빅타민 집의 가운데 제목을 통일한다. 시청자/비로그인/preview는 제목 버튼으로 개별 접고, 편집실 필터는 같은 가운데 제목을 쓰되 접지 않는다. native disclosure의 expanded/controls·키보드·hidden/inert 본문과 탭 메모리3개를 사용한다. 선택 태그/배경/돌봄 상태는 보존한다. 기존 `flipSpring`으로 이웃 카드 이동을 이어주고 쿠션 DOM을 유지한다.
- 집의 홈·하트 아이콘 제목은 ‘빅타민 집’으로 교체한다. 같은 재질의 작은 액자·화분 선반으로 오른쪽 상단을 채운다. 창·쿠션·급식기·쓰레기통은 직접 객체로 유지한다. 접을 때 집 주민과 집에 붙은 음식은 숨기며 펼칠 때 실제 쿠션/anchor를 복원한다.
- 스크롤로 점유 발판을 잃으면 임의의 가로 위치로 이동하던 `resolve`/`nearestPlatform`/landing inset 경로를 고쳤다. 수동 복구는 현재 x를 포함하는 실제 safe span 중 가까운 높이를 고른다. 유효 span이 없으면 x를 보존해 숨고, 새 geometry에서 회복한다. 명시적 집기/쿠션 이동과 실제 viewport 폭 변경은 별도다. parked의 이벤트 뒤 복구도 가로 이동을 하지 않는다.
- 음식은 최초 놓기에서 실제 DOM source와 local offset 또는 문서 좌표를 기억한다. viewport 밖으로 나가도 새 날짜/바닥으로 옮기지 않는다. 실제 scroll/layout 이벤트의 유한 rAF에서 최대3개의 rect만 따라가고, quiet 상태 자율 추적은 없다. DOM 제거 시 마지막 문서 좌표를 쓰며 월 변경은 기존처럼 음식을 지운다. pet의 follow2와 분리된 좌표 참조이며 제목/계정 정보는 읽지 않는다.
- 음식 그림은 [Google Noto Emoji](https://github.com/googlefonts/noto-emoji)의 [Apache-2.0 SVG 라이선스](https://github.com/googlefonts/noto-emoji/blob/e20cbc2bbec1926686be9f9bee7d1d2cfa1fea0e/2D/svg/LICENSE)를 확인한 단일 계열로 교체한다. 지원8종 원본과 부족5종 파생을 구분하고 원본/변경/라이선스를 [출처](../../../public/companion/food/SOURCES.md)에 기록한다.13개43.3KB, 로컬 SVG image로 그려 OS emoji font와 gradient ID 충돌을 피한다. 장식 선택 링은 없애고 키보드 focus 표시는 유지한다. 외부 CDN/런타임 모델/새 패키지를 추가하지 않는다.
- 머리 영역의 누르지 않은 mouse 왕복2회로 의도적인 쓰다듬기를 판정한다. 미세 잡음/단순 진입·정지/세로 통과/터치/이동·식사 중에는 시작하지 않는다. 유효 이동 간격550ms, 보상 간격4s를 분리해 정지 뒤 잡음으로 정산이 반복되지 않게 한다. 원래 happy pose와 작은 손 SVG가 반응하며 마지막 유효 동작 뒤650ms 내 끝난다. hover는 focus/capture/click을 만들지 않으며 클릭·키보드 대안은 유지한다. 캐릭터 raster를 수정하거나 생성하지 않는다.

[Apple Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/)의 직접 조작·즉각 반응·중단 가능한 동작, [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/)의 mouse hover/누름/취소 구분을 참고했다. 픽셀/시간 문턱은 프로젝트의 제품 판단이며 HCI 연구가 입증한 최적값이라고 주장하지 않는다.

## 검증

최종 후보 source의 typecheck·lint·production fixture build 통과. `npm run test -- viewer-companion agent-memory rule-migration`: companion183 + 문서/harness43 =226개 통과. `npm run harness:verify`는 기존 active-rule inventory/RULE_MIGRATION mapping2 실패를 그대로 보고한다.

| 검사 | 결과·범위 |
|---|---|
| panel3 + 기존 home9 | 고유12개 통과 후 최종 keep-all 빌드에서 panel3 재통과. PC/실제390touch·studio2구조/preview·제목 Range 중심오차<1px·두 단어 줄바꿈·독립 상태/선택 보존. 집의 rapid8.2ms fold/expand와 parked 복원, finite 반응 종료 후 Range0/pet DOM write0. viewer POST0, studio preview 기존 snapshot read1은 차단/전송0. |
| 새 contact6 + life9/scroll4 | 고유19개 통과 후 rapidfold 수정 빌드에서 contact6 재통과. 실제 mouse 머리 왕복/full·reduce, 한 방향/정지/사후 미세잡음 무보상, 손의 유한 종료·focus/capture/click 불변, 즉시drag·키보드. scroll source 이탈 뒤 x 보존/실제 접지·월 복귀·집 소유/박자·parked 종료를 검사했다. |
| 음식 care8 + 직접 음식9 | 고유17개 통과: 초기15개 + 최신 clone 빌드의 scroll 대상3 통과(그중2개가 앞선 준비/포인터 oracle 실패를 교정). PC/390 실제 문서/발판96px scroll50표본 p95=0/max3px,1100px 밖 숨김/복귀, 실제 reflow, disconnect 문서 fallback, 잡은 채 scroll→현재 실제 anchor에 놓기→재측정 위치 유지. PC는 pet/food가 같은 발판을 공유해 두 번 보정 회귀도 검사했다. |
| 하트·중단·절전·존재·설정·기본 | 이번 기능의 첫 candidate에서36개 통과. 보라/인간 하트 분리, hidden/modal·식사 완료 뒤 수면·CSS parked·resize·defaultOFF·설정/로컬 상태. 이후 수정은 rapidfold 재측정·음식 baseline 복사·제목 keep-all이며 영향받은 panel/contact/food를 새 빌드로 재검사했다. |
| 기존 motion4 | 최종 빌드에서4개 통과. 다른 검사 브라우저를 닫은 뒤 양방향·UI 반전 없음, full/lite 위치와 그림 재생 분리·하트 geometry 갱신 중 연속 이동을 확인했다. |
| 실제 anonymous `/` | 마지막 후보1920 PC/390touch 모두 통과. 과거2025-09, defaultOFF atlas0·tap/즉시drag·SVG급식/쿠션/반응형 같은 개체/설정OFF·export 내부 요소0·pageerror0. PC hover 손/3제목, agenda2제목 실제 fold/키보드 펼치기도 통과. 각 기존 초기 POST1 차단·전송0. |

렌더는 PC/390 집·제목과 studio/preview, 실제 손·과일 gallery를 열어 확인했다. 좁은 fixture의 특정 위치는 실제 safe span0이라 숨김이 맞다. mobile life는 안전 공백 월→원래 월 복귀를 검사했고 visible→visible 월 이동 전반의 증거는 아니다. 모바일 음식의 text-anchor 검사는 기존 카드 위에100px의 비상호작용 flow 여백을 둔 합성 fixture로 실제 DOM 접지를 확보했다. 플랫폼 목록/시계/rect를 위조하지 않았지만 무수정 운영 레이아웃의 전체 증거로 표시하지 않는다.

독립 검토에서 잡은 결함: rapid fold 사이 geometry signature 동등성 때문에 homeOccluded 잔류, 같은 Platform 객체를 runtime carry와 음식 기준으로 공유해 delta 중복, 좁은 studio 낱자 줄바꿈, 유효 쓰다듬기 뒤 미세 잡음의 반복 정산. 각각 근거를 확인해 수정하고 해당 회귀를 유지했다. 음식의 장식 outline은 pointer 입력에서0이며 키보드 focus는 남는다.

위 고유88개가 통과했으며 하나의 전체 실행이라고 표시하지 않는다. 최신 baseline clone/keep-all 수정 뒤 해당 음식3·제목3/실제 root2·motion4를 재검사했다. 수면 검사는 합성 focus-event 분기이며 실제 OS/OBS 증거가 아니다.

## 비용·배포

다른 검사 브라우저를 모두 종료한 뒤 `node scripts/measure-viewer-companion.mjs`로 각 상태3회×5초를 회전해 측정했다. AMD Ryzen5 7500F/Windows/Chromium148 headless의 단일 로컬 실험이며, 페이지 전체 renderer task 시간/경과시간이다. awake는 roam/jump를 끈 대기로 음식 조작·활발한 탐험/OBS 송출 부하의 측정은 아니다.

| 상태 | renderer task 중앙값 | script ms/s | layout ms/s |
|---|---:|---:|---:|
| OFF |0.240%|1.102|0|
| 깨어 있는 대기 |1.954%|4.892|0|
| visible blur 뒤 parked |0.364%|1.153|0|

9표본 모두 POST0/layout0. 자율 companion Range/DOM write0은 별도 parked 상호작용 검사로 확인했으며 CSS 호흡/꿈·페이지 자체가 무비용이라는 주장은 아니다. 원자료는 ignored `.scratch-pw/companion-panel-metrics.json`. 기존 시각 디자인에 대한 소유자 승인이나 실제 OBS 성능을 이 표로 대신하지 않는다.

Type/lint/build와226 unit, 고유88 browser, root PC/터치,9비용 표본을 확인했다. 소스 diff whitespace 검사는 통과하며, SVG 전체 검사에서는 byte 보존한 upstream peach/그 파생 apricot의 빈 줄 들여쓰기10줄이 보고된다. 원본/배포 hash를 지키기 위해 vendor bytes는 임의 정리하지 않았다. 독립 최종 검토에서 추가 확정 차단 없음.

기능 `a45af40636d84a92b5a8ba5cc008257805d218f2` main push 뒤 Vercel success와 실제 서비스 `/api/soop-live` 동일 build SHA를 확인했다. 운영 anonymous `/`의1920 PC/390touch를 과거2025-09로 열어 새 제목 fold/Space expand·defaultOFF atlas0·tap/drag·SVG급식·쿠션·반응형 같은 개체·설정OFF·export 내부0·pageerror0을 재검사했다. PC 머리 hover/손도 통과했다. 두 화면 모두 기존 초기 POST1 차단/전송0, 운영390 캡처 직접 검수. 운영13 SVG도 정상 MIME/HTTP와 로컬 SHA256 일치를 확인했다. 배포/입력 결과는 ignored `.scratch-pw/companion-panel-production-deploy.json`, `companion-panel-root-production.json`에 둔다. 이후 문서 커밋은 기능을 바꾸지 않는다.

공개 서버 DTO/권한/unlock/DB/KST/1840 기하 변경0. fixture 또는 과거 월·모든 POST 차단·실제 DB 시험 데이터0. 실제 OBS/GPU/OS-focus·Safari·스크린리더 장비는 별도 증거가 필요하다.
