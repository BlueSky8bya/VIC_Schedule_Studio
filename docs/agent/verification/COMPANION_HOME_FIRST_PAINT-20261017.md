# 빅타민 집 새로고침 실루엣과 소파 피드백

[094 계획](../plans/PLAN-20261017-094-companion-home-first-paint.md). 공유 집 스타일 전달과 조작 피드백만 바꾸며093 brain/음식/정상 식사는 수정하지 않는다.

## 원인과 재현

`companion-home.tsx`의 CSS side-effect import는 public/studio의 `dynamic(ssr:false)` renderer 아래에만 있었다. 집 SVG는 viewBox에 의존하고 크기/배치/fill은 CSS에 있었다. old production fixture `mvTnvekoF00gUfxEqdp2y`의 viewer/light에서 실제 home CSS 응답을1초 늦춘 결과, 첫 가시 구간89표본 중66표본에 미적용을 확인했다. 방 높이533.922px·position static·창문339.984×295.25px·sky/gradient/stroke-only path 모두검정이었다. 가시 문제 구간845.5~1861.1ms, 실제 CSS 지연1011ms. 첨부의 거대 검정 형태와 일치하며 해당 전제의 로딩 레이스를 재현했다. 운영 당시 특정 요청의404/네트워크 원인까지 소급해 확정하지 않는다.

before native1건은 의도한 첫 가시 스타일 검사에서 FAIL했고, 원본/report는 격리 `.scratch-pw/094-home-before/`에 보존했다. 최종 PASS로 합산하지 않는다.

## 수정

- home CSS를 같은 파일 그대로 public-poster/studio-shell의 eager import 경계로 옮겼다. actor/runtime/아틀라스는 기존 lazy를 유지한다.
- SVG6개의 기본 크기와 fill:none을 명시했다. 그림 경로/마스크/실측 좌석/방132px는 그대로다.
- 소파에 작은 Home 아이콘과 hover/focus/pressed 배경 차이를 추가했다. 버튼/그림/좌석/전경 transform은 그대로이고, 내부 아이콘만 기존 press 토큰을 쓴다. reduced/off/soft는 transform/transition 없이 색으로 알린다.
- 독립 검토에서 quiet override 특이성이 active보다 낮던 P2를 찾아 실제 selector 체인으로 높였다. 재검토 차단0. 새 상시 loop/timer/서버 요청/의존성/운영 데이터 변경은 없다.

## 검증

최종 production fixture `XmSLc3XjlOzkGSpiqElOx` build/typecheck PASS. 초기 public/studio HTML 모두 공유 home stylesheet를 먼저 연결하며, actor/runtime는 lazy 유지다. 전체 lint PASS. 첫 병렬 unit은2,000PASS/agent-memory CLI5초 timeout1FAIL이었다(`.scratch-pw/094-unit-final.json`). 시간 제한은 유지하고 원격 CI와 같은 maxWorkers1로 전체 재실행해2,001/2,001 PASS·exit0(`094-unit-final-sequential.json`)를 확인했다.

새 `companion-home-readiness.spec.ts` native6/6 PASS: viewer/studio×light/dark4, viewer reduced1, studio gfx OFF1. 최초 진입과 실제 reload의 CSS 응답을 각각1초 늦추고 첫 가시 프레임부터 실제 크기/채색을 검사했다. 실제 hover/down/up/leave/Tab/Shift+Tab/Space, 저장 설정 유지, 좌석 기하 불변, quiet 처리와 쓰기 차단을 확인했다. 독립 감사에서6 raw의 가시1,329표본 경고0, CSS gate12회1,003~1,013ms, trusted click12회, button/bed/cushion 변화0px, writes/errors0을 재검산했다. PNG4장도 직접 검수했고 증거30개의 SHA/mtime 전후 불변을 확인했다(`.scratch-pw/companion-094/independent-home-raw-audit.json`).

신규 검사 작성 중 Window cast 타입 오류와 그래픽 full의 attribute 부재/편집실 CSS zoom의131.997px 소수점에 대한 잘못된 가정을 고쳤다. 최종 검사에는 실제 full 정규화와0.01px settle 허용을 쓰며 모든 가시 표본의0.1px 기하 기준은 유지한다. 이전 실패 raw/report도 보존하고 최종 PASS에 합산하지 않는다.

기존 회귀 첫 실행은 모바일 제외8/8 PASS, plush-home2건은6초 귀가 가정에서 timeout이었다. 실제 pet은 home journey를 유지한 채 여러 날짜 발판을 순차 이동하고 있었으며, 레이어 검사 전에서 멈췄다. 현재 `home-route.ts`의 거리/속도에 따른 걷기와 hop950ms, `viewer-companion.tsx`의 이동 뒤320ms glance에는 전역6초 도착 보장이 없다. 해당 소파/식사 검사는 기존 sofa-contact 검사와 같은 native P→실측 집 바닥 클릭→실제 home-floor·발 오차<2px·동일 DOM 착지를 선행하고 native Enter로 소파를 호출하도록 정합화했다. 제품 state/RNG/clock을 주입하지 않았고 기존6초/5초·전경·들기·식사 단언도 유지했다. 장거리 귀가 자체는 별도 committed-home 검사의 범위이며 이번 단거리 확인으로 재검증했다고 주장하지 않는다. helper/두 spec 독립 소스 검토 차단0.

최종 plush-home2/2 PASS: 소파 실측 전경 일치0.1px 이내·z/로컬 앞면·실제 들기 후 전경 해제·좌석 불변·native 음식 꺼내기/버리기를 light/dark에서 확인했다. 정상 식사1/1 PASS: 실제 배치 음식의 중력 착지 오차0.0005px, 집 바닥 접근/eat/음식 소멸·hunger0.8→0.45128을 확인했다. 기존 mobile8과 새6을 포함해 서로 다른 native17건 PASS, 최종 실행 skipped/flaky0. 이전 실패2건은 별도 report에 보존한다. 빌드 검증 소스와 main의 관련41파일 SHA 일치·불일치0, 전체 lint/타입 검사 PASS. 문서 harness248 PASS.

공개 DTO/역할/언락/KST/1840 기하·모바일 제외·사용자 아트·설정·실제 식사 보상은 유지한다. 실제 OBS/모든 장치/실제 역할 RLS를 이 검사로 보증하지 않는다.

## 릴리스

관련15파일만 `cb6a140f792789899d80fead81ac7a4b4e5e6313`로 commit/main push했다. staged exact scope·비밀 패턴6종0·whitespace PASS. 이전093의 배포 메타데이터를 함께 보존하며 사용자 아트/.vscode/기존 미추적 작업은 제외했다. [Remote quality39035142922](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39035142922)의 전체 SHA 일치·모든13단계 success, Vercel4A1gsrkGUxsfFPkEHpfyKc32HKi4 success를 확인했다.

2026-10-17 22:08:28 KST 운영 canary: 전체 SHA exact·clock200/no-store·warm204·anonymous developer401/error-only/no-store·fixture streaming404 비노출 PASS. 실제 로그인 developer studio에서도 배포 버전cb6a140·정상 채색된 집·새 cue1개·pet1개 visible/decoded를 읽기 확인했고 집 스크린샷을 직접 검수했다. 현재 화면의 공통 zoom에 따라 room118.785px/window57.587×50.399px/shelf49.497px로 비례 축소되어 있었으며 relative/absolute 배치와 sky의 비검정 채색을 확인했다. 운영 일정/설정 변경 없이 검증했다.

main ignored `.scratch-pw/companion-094/`에 remote-run/jobs/status·운영 canary/UI·source-equivalence·staged-files·unit/native report와 독립 원본 감사를 보존한다. 자체 fixture 서버/runner는 종료했다. 배포 후 결과 메타데이터는 로컬만 갱신해 문서만의 추가 Vercel 배포를 만들지 않는다. 기존 Hobby 초과/복구/실제 OBS/RLS 과제는 별도로 남는다.
