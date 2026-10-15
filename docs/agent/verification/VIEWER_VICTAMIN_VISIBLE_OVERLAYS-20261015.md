# 일반 창 위에 남는 빅타민

2026-10-15 KST · [PLAN-049](../plans/PLAN-20261015-049-victamin-visible-overlays.md).

## 변경

일정 상세·검색·기록·설정은 빅타민을 없애는 hard block에서 분리했다. 같은 DOM과 달력의 실제 발판을 보존하고, 진행 행동을 유한하게 마친 뒤 기존 presence의 휴식·하품·CSS 수면으로 이어간다. 설정에서 처음 켜도 열린 창 옆에 보인다. 창 동안은 inert·Tab 제외·pointer 통과이며 집/음식의 입력과 이전 배치 capture/click guard를 해제한다. 창이나 집으로 초점을 빼앗지 않는다.

실제 창 rect와 겹치면 가까운 여백으로 표시만 옮긴다. 공간이 부족하면 60/44px 셀까지 줄이고, 빈 여백이 전혀 없는 경우에는 작은 모서리 표시를 쓴다. world 좌표·발판을 새로 심지 않는다. 이동은 공유 FLIP 시간/곡선을 쓰며 동작 줄이기·gfx off는 즉시 반영한다. 고정 캐릭터의 최종 transform을 유지해야 하므로 transform을 비우는 `flipSpring()` 대신 같은 상수를 쓰는 유한 WAAPI를 적용한다.

창 rect 관측은 실제 창들의 ResizeObserver와 해당 창 노드의 style/class MutationObserver뿐이다. 동일 노드의 관측을 반복 등록하지 않는다. 조용해진 뒤에는 캐릭터의 판단·기하 스캔·타이머·rAF가 없다. 열린 창이 실제로 이동/크기 변경될 때만 표시 여백을 다시 정한다. 일반 창의 `poster-window` ambient holder는 배경에 그대로 적용하되 빅타민 숨김에서는 제외한다. 다른 ambient holder, hidden tab, page inert, 배경 감상, 최초공개, 월 선택·선물·가차의 기존 hard block은 유지한다.

모바일 상세 창 진입 시 native tap의 마지막 스크롤을 포함해 점유 anchor를 따라간다. 창 중에는 구독을 끄되 익명 anchor의 마지막 follow snapshot을 보존하며, 복귀 시 새 기하 연결 전에 실제 anchor 차이를 반영한다.

아젠다에서 닫힌 집의 작은 열기 버튼은 왼쪽 여백에 둬 오른쪽 레일의 ‘기록’ 버튼을 가리지 않는다. 펼친 집의 구조·크기는 유지한다.

## 경계

- viewer/anonymous/preview의 `PublicPoster` 한 구현. 서버 DTO·API·권한·unlock·KST·DB 스키마 변경 없음.
- 위치/기하와 기존 로컬 돌봄 정보만 사용. 일정 내용·계정 정보·새 요청 없음. 포스터 1840 export 표면 밖의 기존 portal 유지.
- 새 이미지·의존성·LLM·폴링 없음. 기능 기본 OFF 유지.
- 테스트는 fixture 또는 과거 월, POST 전부 차단. 현재/미래 달 시험 데이터 생성 없음.

## 검증 상태

최종 상품 소스의 typecheck·lint·fixture production build PASS. 단위239개 PASS(빅타민/ambient196 + 문서43). 독립 검토에서 발견한 RO 재등록 루프, 창 닫기 ambient cleanup 순서, 실제 창 selector, 팝오버 이동 감지 문제를 수정했다. 후속 소스 검토와 PC·390 세 화면의 가림/식별 검토에서 추가 확정 차단 없음. 기록 화면의 등장 fade 중 캡처는 최종 본문 대비 판정 근거에서 제외했다.

실제 익명 `/`의 과거2025-09 월에서 PC1920·native-touch390 두 화면 PASS: 기본OFF atlas0, 열린 설정에서ON 즉시 가시성, 검색 타이핑, 기록 버튼·각 창 닫기, 같은DOM·pointer 통과/Tab 제외, export 표면 밖. 화면당 bootstrap POST1 전부 차단, sent0, pageerror0. `.scratch-pw/companion-overlay-public-{local,production}.json`에 실행별 결과를 저장한다. local2·production2 모두 PASS. focus는 headless 결정성을 위해 고정했고 실제 OS focus/OBS 검증으로 간주하지 않는다.

같은 최종 상품 빌드의 fixture 회귀 unique24개 PASS(전체 실행23 + 최종 모바일1). basic9·interruptions4·passive6·settings3·새 ordinary-window2. PC1920/실제 touch390에서 상세·검색·기록·설정의 같은DOM, 창 입력/닫기/초점, 원래 발판·좌표 복귀를 검사했다. 모바일은 정식 small 선호의 실제 제목 card-2에 native 배치한 뒤 귀환 오차0, 닫기 중 hidden 전환0. PC는 상세를 기존 빅타민 자리로 실제 드래그해 표시 여백 갱신도 확인했다. 조용해진 각 창에서 Range0·창 rect 조회0·pet DOM write0. hidden tab·premiere/showcase 등 기존 hard-hide 검사는 유지했다. fixture POST0.

몸체(.76셀)와 창의 겹침은 PC 네 창, 모바일 상세/검색/설정0. 모바일 기록 창은 rect(0,24,390,820)으로44px 셀 전체를 창 밖에 놓을 여백이 없어44px 모서리 fallback을 사용했다. 이 경우 몸체 일부 겹침802px²를 허용하되 native 닫기와 pointer 통과를 확인했다. 일반 여백이 있는 경우의 가림0와 구분한다.

상품 commit `b73b9fc9588e0d5241684eba8292cd035bf807a9` push·[Vercel 배포 성공](https://vercel.com/bluesky-s-project3/vic-schedule-studio/61UNU65X1AGVFijbGfjJ6pP8C6ZV). 운영 `/api/soop-live`의 build SHA 일치 후 위 production2를 실행했다. [운영 주소](https://vic-schedule-studio.vercel.app). 이후 완료 상태 기록만 별도 docs commit으로 갱신한다.

기존 패널 종합 root 스크립트의 재사용본은 모바일에서 닫힌 집의 임시 hidden frame이나 펼친 집이 가린 바닥 주민에게 즉시 가시성을 요구해 통과하지 못했다. 해당 광범위 돌봄/resize 실행 전체를 이번 변경의 PASS에 포함하지 않는다. 위의 창 전용 실제 root 두 화면과 별도의 fixture 회귀를 합격 근거로 구분한다.

완료 문서 변경 후 문서 단위43개 PASS. 최종 `harness:verify`는 기존 UI-38~44 migration inventory 누락 때문에 두 오류로 exit1(Active rule IDs changed / inventory table differs). 새 broken link나 이번 작업의 rule ID 변경은 없으며 전체 harness PASS로 기록하지 않는다. 실제 OBS 장비의 프레임 지표는 이 브라우저 검사로 입증하지 않는다.
