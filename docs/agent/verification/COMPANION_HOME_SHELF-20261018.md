# 빅타민 집 비가림 배치097

범위: 소유자가 제시한 우하단 집 버튼/열린 박스의 일정 가림. [계획097](../plans/PLAN-20261018-097-companion-home-shelf.md)은044의 fixed compact 위치만 대체한다. 서버 DTO·권한·언락·KST·DB·의존성·아트는 변경하지 않는다.

## 구현과 경계

시청자/편집실/공개 미리보기는 하나의 launcher/shelf slot과 기존 한 runtime을 쓴다. 실제 옆 패널이 열리면 그 안의 집을 쓰며, 접히면 상단 크롬의 집 버튼으로 달력 앞 문서 흐름에 공간을 확보한다. 닫힌 hidden wrapper는 controls ID만 유지하고 높이0이다. 집은 공유 패널 폭, 실내132px, 펫92px, 기존 실물44px 조작을 유지한다. studio shell0.9/0.8 zoom을 slot에서 상쇄한다. 달력의 폭 배율/내용 최소 높이는 유지하고 기존 빈 세로 공간 채움만 재계산한다.

제목은 기존 저장되는 본문 접힘, launcher/X/Escape는 compact 방문 닫기다. 열기 전 문서 좌표·닫기 전 복원 자격을 캡처해 layout 제거 뒤 복원하며 wheel/touch/스크롤 키/다른 문서가 개입하면 강제 복귀하지 않는다. 실제 sticky 헤더를 방문 inset으로 측정한다. 안정적인 launcher는 expanded/controls·열기/닫기 기록·focus를 유지한다. 최초공개는 header 안 launcher에 퇴장을 중첩 적용하지 않으며 React가 집/launcher inert를 소유한다. 기존 geometry/home 사건·유한 observer를 쓰고 상시 RAF/모델/서버 요청을 추가하지 않는다.

기존 capability는 `POSTER_AGENDA_QUERY`를 공유하므로1040px 이하 PC agenda도 미마운트다. 초기900px 활성 가정은 소스 확인 후 폐기했다. 모바일 기능을 되살리지 않는다.

## 재현과 검증

- 이전096 fixture `NNvB9gp4V333ija0mzLJp`:1480×938에서 launcher와 실제 월 grid/날짜/일정의 합산 교차9437.78096px²로 첫 물리 단언 실패. 새 marker 부재가 아닌 기존 가림을 재현했다.
- 1차 `Z7xUD5KTRzjAtgPi5LsOK`:12건 중9통과/3실패.900px 활성 추정1건과, 배치 전에 잰 좌표를 focus 스크롤 뒤 사용한 주민 준비2건이다. 원본 raw/PNG/오류를 보존했다.
- 최종 제품 fixture `d90LG6_TsfDQjjA7XGJJ5`: 첫15건 중13통과/2주민 검사 실패. studio는 실제 seat/전경 BCR 일치 뒤 SVG `visibility:hidden`을 읽지 않은 paint 판정 오류, viewer는 귀가 locator의 준비 스크롤로 소파가 상단으로 이동한 준비 경계였다. 실제 paint visibility와 매번 측정한 native hit point를 검사하도록 하네스를 보완했다. 중앙에 놓인 실제92px 주민이138px 소파의 중앙 표적을 가리므로 노출된 가장자리에서 native 클릭한다.
- 주민 재검사에서 wheel 직후 한 표본씩 앞림96px 차이를 관찰했다. 선등록된 검사 rAF가 같은 프레임 뒤에 등록된 제품 follower보다 먼저 중간 DOM을 읽었다. 원본 표본/실행보고서/문맥을 `resident-edge-raw`/`resident-edge-errors`에 봉인하고, 같은 rendering update의 콜백들이 끝난 다음 task에서 관측하도록 보완했다. 원래 모든 registered 표본의 `<1px` 정렬·전경 존재·로컬 중복0 단언은 그대로다. 독립 검토 후 viewer75/75·studio76/76 정렬 오차0, 각 native wheel2회 scroll0→96→0, 단일 집/펫·음식/소파 동행을 확인했다. 실제 compositor/OBS 모든 출력 프레임의 증명은 아니다.
- 최종 제품 기준 서로 다른 native20건 통과: 새 배치/키보드/좌우/zoom/깊은 스크롤/접힘/모달/compact 최초공개15건, 짧은1060×480 다크·감소 동작/1679↔1680 경계2건, 모바일 제외/desktop 복귀3건. 변형 요청·pageerror0. 집/launcher와 실제 일정 영역 교차0, 실내132px·실물44px, shell0.8 zoom 상쇄를 실측했다. 최종 raw/PNG/보고서 합본을 `sealed-final-raw`, `sealed-boundary-raw`, `native-final-summary.json`에 봉인했다.
- main 단위2,087·린트·typecheck·production build 통과. 최종 문서 harness254 통과. 최종 제품8파일 main/WT byte equality와 새 하네스3파일 일치를 확인한다. commit/push 뒤 운영 SHA/UI를 별도 확인한다.

로컬 원본: WT `.scratch-pw/companion-097/`의 각 실행 JSON report·log·오류 문맥과 sealed raw/PNG, `.scratch-pw/097-home-shelf/<buildId>/`. 같은 빌드·동일 이름의 custom raw/PNG는 후속 하네스 실행으로 갱신되며 최초 v3의 주민 custom 원본2개는 별도 봉인 전 갱신됐다. 그 실패의 실행 report/문맥은 보존했고, 원래 rAF 표본과 최종 표본은 별도 봉인했다. 모든 변형 요청을 차단하고 공개 미리보기의 정확한 읽기 action만 synthetic 응답으로 대체했다. RNG/시계/제품 상태/포커스를 위조하지 않는다. actual role/RLS/방송 PC/모든 기기를 증명하지 않는다.

## 독립 검토와 남은 단계

독립 소스·개인정보 검토에서 원래 스크롤 캡처 단계, 최초공개 inert 소유, 열린 launcher의 기록/이름3건을 지적해 수정했다. 버튼 Space/편집실 sticky 방문 경계도 보완했다. 최종 제품8파일/새 하네스3파일 main/WT SHA256 동일·차단 결함0 확인. 독립 raw 검토에서도 주민 연속 표본·원래 단언 유지·요청0을 확인했다.

## 운영 확인

`ae3cfdddcc7f849d91c9c710b65abb3f5da8fa05` commit/push 완료. [quality39044817066](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39044817066)13단계·Vercel 모두 success. `/api/soop-live` full SHA 일치200, public clock200/no-store, warm204, 비로그인 developer presence401/error-only/no-store, 운영 fixture는 streaming HTTP200 안의404 fallback으로 미노출 확인했다. main `.scratch-pw/companion-097/{remote-run,remote-jobs,remote-status,deployed-canaries}.json`에 증거를 저장했다.

실제 로그인된 개발자 Chrome1643×1048에서 새 버전 배지 `ae3cfdd` 확인 후 편집실 집을 native 클릭했다. 집1·펫1, 실내131.997px, 집과 실제 월 grid 교차0 확인. 실제 메뉴의 시청자 화면으로 전환하고 같은 집을 열어 집1·펫1·expanded=true·실내131.997px·교차0을 다시 확인하고 화면을 육안 검수했다. 일정·설정·음식·하트 데이터는 변경하지 않았다. 과거096 actual focus gap/실방송 OBS/GPU/모든기기/실제RLS·provider한도는 이 배치 검증으로 닫지 않는다. 이 운영 후 메타데이터는 docs-only 재배포를 피하려고 로컬에 남긴다.
