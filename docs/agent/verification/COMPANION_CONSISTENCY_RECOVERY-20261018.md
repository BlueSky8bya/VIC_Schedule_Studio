# 빅타민 큰 눈 통일·작은 집·지지면 회복

Status: Deployed and verified. [PLAN-098](../plans/PLAN-20261018-098-companion-consistency-and-recovery.md).

## 범위와 교체

최신 소유자 요청은097의 달력 앞 흐름 공간 예약을 취소했다. 상단 진입은 유지하고 공유 폭/실내132px의 작은 창을 body portal에 배치한다. 달력 일부 가림을 허용하며 열기/닫기로 달력 BCR·문서 높이·스크롤을 바꾸지 않는다. 실제 패널이 열리면 기존 패널 안 집을 쓴다. studio/viewer/preview 한 구현, agenda capability/모바일 제외, 저장된 선택·소파·음식·단일 주민을 유지한다.

기존097 전용 `companion-home-shelf*.spec.ts` 3개는 흐름 공간 예약을 필수로 요구해 최신 요청과 양립할 수 없다. 해당 revision `ae3cfdddcc7f849d91c9c710b65abb3f5da8fa05`에 이전 harness/결과를 보존하고 새 `companion-compact-continuity.spec.ts`와 `companion-support-recovery.spec.ts`로 교체한다. 기존 모바일/집/스크롤/편집창 회귀는 별도로 확인한다.

## 수정 전 실제 재현

동일097 production-fixture build `d90LG6_TsfDQjjA7XGJJ5`, headed Chromium, 실제 trusted 입력. 외부 live/trending read는 합성값, 모든 POST/PUT/PATCH/DELETE 차단. 실제 DB 저장 없음.

- 작은 집 열기: 달력 위치198px 이동. 새 요구의 before 실패로 보존했다.
- 실제 카드 발판에서 wheel52.8px: 원래 발판 상단90.29px, 같은x 일반 발판0, 실제 아래 카드 상단298.05px 존재를 렌더링 기하로 확인했다.316프레임 중312프레임 숨겨지고 x415.40px/빈 support 상태에서 회복하지 못했다.
- 실제 소파 주민을 제목으로 접어 숨긴 뒤 설정 창을 열자49/49프레임 잘못 드러났다.

위 두 오류는 페이지 오류0/쓰기0/입력 전부trusted/focus 유지/document.hidden0. genuine OS blur 증거로 해석하지 않는다. 원본 report·native context·raw frame·PNG·SHA manifest는 로컬 `C:/Projects/VIC-086/.scratch-pw/companion-098/before-compact` 및 `before-support`에 보존했다.

## 원화와 전 동작 계보

새 원본·실제 builtin 인자·회차 claim/사전검사·초안 영수증은 `art-src/빅타민/동행/작업회차/20261018-큰눈통일`에 저장한다. 현재7종 UI 입력마다1회 생성했으며 기존 원본을 덮어쓰지 않는다. 큰 열린 눈을 통일하고 잠/윙크/눈물/나선 눈/회복의 감정 의미를 구분한다. 초안 등록은 사용자 시각 승인이나 전문 검수 PASS를 뜻하지 않는다.

패킹은 새 whole-key RGBA crop·동일 비율 등록·기존 유한 귀/종이 rig만 사용한다. 얼굴을 붙이거나 눈을 수작업으로 그리지 않는다. 원래 PLAY 일부 원화의 귀 가림은 현재 런타임의4개 귀교정 키 치환을 새 EARS 원본으로 유지한다. 별도 응원단도 새 원본을 쓴다.

최종512슬롯·33행·32packet 전부 새 원본이다. row7의 호환 전용 slot127을 포함한 고유 참조451개, 실제 사용450개·71개 원화 키에 응원16키를 더했다. 새7원본96개 전체 crop와 실제7초안 등록 SHA, 기존 원본8개/기존 공개packet33개의 불변 SHA, 새 공개 자산33개와 실제512+16 decoded alpha plane SHA를 전수 검사했다. 모든 clip 밖 alpha>0 픽셀0·중심40/발80·기존 .76/.82 footprint 한도·304 rig의 얼굴 공유 rigid weight1/deviation0을 유지한다. 큰 표식/AA도 보존하려 전체 키 일부가4.4~6.1% 작아졌으며 얼굴 일부만 줄이거나 합성하지 않았다. 응원은16명 공통 scale과 전체 응원봉을 보존하고 기존 하단 anchor에서1~7px 위로 최소 보정했다.

기술 검토에서 HD body BCR±4 sampling의 감정 표식 삭제, 긴 whole-key square crop의 이웃 셀 포함, 응원 원본의 투명 padding 경계, 기존 clip 밖 AA7px을 발견했다. 실패 attempt와 원본은 보존했고 whole crop/all-alpha fit 및 등록을 고쳤다. 기존 footprint 단언을 완화하지 않았다. 최종 `--check` byte 재현과 contact 재현 PASS.32packet+응원 전체 압축 bytes5,092,850이며 동작별 lazy decode/3개 이미지·2개 in-flight 제한은 그대로다. compressed 전량은 초기 일괄 다운로드량을 뜻하지 않는다.3packet decoded RGBA 예산6.75MiB는 동일하며 새 상시 RAF/모델/서버 요청은 없다.

생성자 root가 최종 등록71키·응원16키 contact를 열어 큰 열린 눈·감정 의미·두 귀·전체 실루엣/표식·응원봉을 확인했다. 자동 전문 미술심사나 사용자 시각 승인으로 표현하지 않는다. 새 원본과 파생물은 이전 원본을 덮어쓰지 않았다.

## 검증 상태

main 전체207파일/2,113단위·typecheck·ESLint·production build·harness PASS(hover 위치 후속 전). 첫 production-fixture build `ATdCiAmsnZLmp02Inb3KV`의 native14개는10 PASS/4 FAIL. 사라짐 실제 재현2건과 주민/음식/소파 추종·zoom·미리보기·경계 전환은 통과했다. 실패는 다음과 같이 원본/report/PNG/frame/context를 `C:/Projects/VIC-086/.scratch-pw/companion-098/attempt1`에 SHA 봉인했다.

- viewer1280/최초공개 진입: hover transform으로 실제 launcher가1px 위로 이동해 집과의 anchor 오차가 정확히1px. 제품 hook이 pointer/focus 및 유한 transitionend도 관측하도록 수정했다. 상시 추종 loop는 없다.
- viewer1480: setup1초 부근의 JS 초기 fit이 계속 움직이는 중 before width1440.7207→opened1438.5566px(2.164px)으로 관측됐다. 실제 달력 BCR의 연속 안정 구간을 선행 확인하도록 검사 준비를 보완하며 기존1px/scroll0 단언은 유지한다. 제품 결과를 준비 실패로 덮지 않고 다음 같은 검사에서 재확인한다.
- 설정: 의도대로 aria-hidden/inert가 된 집을 접근성 getByRole로 조회하려 해 timeout. 동일한 native dialog 뒤의 클릭 불가/EFP 검사를 실제 wrapper 내부 read-only 선택자로 정정한다.

첫 지지면 회복이 끝날 때까지는 성공했지만 상단에서10프레임의 별도 깜빡임도 확인했다. 발87px에 등록된 실제 그림은 화면 안인데92px의 투명 셀 전체로 경계를 검사해 숨겼다. 실제 목적 발판을 가진 같은x 중력 회복의 상단 구간에만 `.82 × size + 8` 경계를 쓰며, 그 구간의 반동·회전·늘어남을 중립화한다. 일반 보행/점프/잡기·모달·집 숨김은 기존 경계를 유지한다. 새 native 단언은 실제83.44~100px 구간을2프레임 넘게 지나고 그동안 전부 보이는지 검사한다. 독립 코드 검토 blocking0, main 최종207파일/2,114단위·ESLint·typecheck·build PASS. 최종 production build `0BlwsqJcjZXQy9UUxeKq6`, fixture `R9GG1VOu-XSfqc1q7uznX`.

후속 최종 native·운영 배포는 아직 미확인. 이전 회차 PASS를098 결과로 재사용하지 않는다. 실제 OBS 합성/인코딩 부하와 genuine OS blur 장시간 검사는 별도 미해결 범위다. 서버 권한·DTO·언락·KST·DB·의존성 변경은 없다.

두 번째 fixture `R9GG1VOu-XSfqc1q7uznX` native14개는12 PASS/2 FAIL. hover anchor와 상단 투명 셀 깜빡임은 통과했다. build-copy label 복원 검사는 pointer가 launcher 위일 때의66px와 빠진 뒤67px을 잘못 비교해 실패했으며 현재 실제 launcher와의 anchor를 검사하도록 고쳤다. 격리 재검사에서 이 항목은 통과했다. 원본은 로컬 attempt2에 봉인했다.

나머지 viewer1280×480 초기 hidden은 실제 제품 오류였다. focused/visible·HD decode 완료·presence active인데 date-26 실측발290.146px와 이전 행 glyph203.616~221.522px가 .82body+3px 여유에서 겹쳐 같은 세로선의 모든 발판이 사라졌다. 실제 viewport-floor410px는 x963.601px에서 시작하고 원래x918.587px와45.014px 떨어져 있었다. 진단 원본 `jvKoDgZEMshpOuaxpmhkV`와 report/frame/context/SHA는 로컬 diagnostic-rejection-sealed에 보존했다. 임시 geometry rejection/DOM rectangle 진단은 제품에서 제거했다.

수정은 기존 같은x 일반 발판→실제 아래 카드상단/바닥 우선순위를 유지한다. 그 세로선이 전부 막혔을 때만 실제 아래 viewport 바닥 가장자리로650ms 중력 곡선을 사용하며 최초 lost-x 기준 .76size 이내로 제한한다. 새 스캔마다 예산을 누적하거나 가짜 바닥/먼 열로 순간이동하지 않는다. parked sleeper와 자연 숨바꼭질 복귀에도 같은 bounded escape를 쓴다. 실제 같은x 발판이 없을 때의 무기한 수평 고정 대기만 최신 사라짐 수정 요청에 맞춰 대체한다. 회귀 단위6개에 실측 case/경계/불변성/연쇄 이동 차단/위쪽·집·가짜 바닥 거절을 추가했다.

bounded 수정 fixture `LcJREgDD33Z4msKplBA3t`에서 새 native14/14 PASS. 낮은 viewer의 실제 사라짐 재현과 folded-home/modal 오표시, 상단 중력 구간 숨김0이 모두 통과했다. 이후 독립 읽기 검토가 natural-return의 같은 floor 순번ID 재clip에서 원래 이동 예산을 우회할 수 있는 P2를 발견했다. retained floor의 clamp도 최초x 예산으로 검증하고 성공한 return/직접 잡기에서 예산을 해제했다. 만료는 실제 복구를 위해 예산을 보존한다. 재검토 blocking0.

최종 main production build `fc6HvZP6arEt2hj4_7hje`: 전체207파일/2,120단위·typecheck·ESLint·build·harness256문서 PASS. 검토 WT와 product10파일 SHA가 일치한다. source/권한 검토에서 서버 DTO·역할·언락·KST·DB·의존성 변경0. 사용자 최초공개 아트 기록/과거 시안/로컬 설정은 staging에서 제외했다. 이 빌드에서 새14개와 기존 native throw/run·mobile exclusion·frame pipeline을 함께 재검사 중이다.

최종 native 회귀38개 중 첫 실행37 PASS/1 FAIL. 실패는 full/lite/full 품질 전환 뒤 먼 위치에서 소파 귀가를5초 locator 제한으로 검사한 항목이다. `data-home-journey`는 빈값 속성으로 유지됐으며 취소가 아니었다. 기존 committed-home의 거리 의존25초 계약으로 경로를 기록해 같은 빌드에서 재검사1/1 PASS: lite10,740.1ms/max8,491.5ms, 명령 누락0·hidden frame0, 실제 소파 발판 도착과 전경/스크롤 추종 확인. 제품 속도/경로·성격을 바꾸거나 시계를 조작하지 않았다. 첫 실패 원본은 release-native-attempt1, 재검사는 recall-native-sealed에 보존했다. 최신 harness는 해당 한 항목의 시간 예산과 read-only 경로 증거만 바꿨다. 다른37개 PASS는 같은 제품 빌드의 별도 범위로 유지한다.

별도 controlled-clock 자연 숨바꼭질 자동 복귀1/1 PASS. 이 항목은 실제 OS focus/실시간 검사로 표현하지 않는다. 신규14개와 throw/run12·mobile8·frame pipeline4의 실제 native 총38개 경로가 확인됐다. fixture 외부 쓰기/페이지 오류0, 실제 저장/DB/RLS 시험은 하지 않았다. 운영 배포 SHA/UI 확인은 다음 단계다.

배포 준비 중 git blob/working bytes 비교에서 신규 생성 영수증 등의 CRLF가 기본 LF 규칙으로 정규화되는 문제를 발견했다. 원화의 native SHA를 재작성하는 대신098회차 JSON에만 기존 snapshot과 같은 `-text whitespace=cr-at-eol` 예외를 둔다. 신규100파일의 index blob/raw byte가 전부 일치하는지 확인했다. 원화/512슬롯/제품 JS·CSS와 로컬 단위2,120·native38/controlled1에 사용한 파일 바이트는 바뀌지 않았다. 생성 영수증 원본과 실제 source pin을 플랫폼에 관계없이 보존한다. 후속 배포의 원격 단위/SQL/빌드 결과를 다시 확인한다.

## 배포 확인

Release `2588a882129409b83c042a61a3825b5cdb493435`, Vercel success. [원격 quality39050928440](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39050928440)의13단계가 전부 success이며 Linux 단위2,120·격리 SQL·harness·build·typecheck·lint를 통과했다. 앞선f6281fd0은 Linux 생성영수증 byte assertion1개 실패/2,119개 PASS였고, scoped 원본 바이트 보존으로 정정했다. 이전 skipped 단계는 PASS로 세지 않았다.

2026-10-18 01:50 KST 운영 API에서 full SHA 일치, clock200/no-store·warm204·anonymous developer401/error-only/no-store·fixture404 fallback marker 비노출 확인. 대표 기본/비행/응원 WebP3개 CDN SHA가 로컬 공개 자산과 일치한다. 실제 로그인된 개발자 편집실과 공개 DTO 시청자 미리보기에서 새 big-eyes-v1 디코드, 단일 펫/집,380px 작은 창과 달력 문서 높이/위치 비예약 확인. 시청자 열기 전후 calendar BCR·scrollY·문서높이 완전 동일. 편집실은 calendar 문서좌표/높이는 동일하지만 CUA DOM 버튼의 focus/scroll 과정에서 기존11.11px 스크롤이0으로 이동해, 운영 CUA 결과를 native scroll 불변 증거와 혼동하지 않는다. 쓰기 차단 native14개가 별도로 위치/스크롤 불변을 검증했다.

운영 일정 저장/관심 버튼/권한/DB 변경 없이 확인하고 편집실의 원래 왼쪽 패널 열림·집 제목 접힘 선택으로 복원했다. 집을 잃은 무기한 숨김과 일반 창의 stale 재표시 수정 범위가 완료됐다. genuine OS blur096 및 실제 방송 PC 장시간 OBS/RLS/공급자 한도는 이번 검증의 범위가 아니다. 배포 후 이 메타데이터는 documentation-only 재배포를 만들지 않도록 로컬에 유지한다.
