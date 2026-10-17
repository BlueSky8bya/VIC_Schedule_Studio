# 빅타민 흔들기 감도·낙하 표정·회복 연결 검증

소유자 요청: 덜 흔들어도 빙글빙글 눈이 나오며, 놓은 뒤 낙하 중에도 유지하고 착지 후 회복의 끊김을 줄인다. [091](../plans/PLAN-20261017-091-companion-dizzy-continuity.md)이089의 감도·일반 낙하 얼굴·짧은 회복만 대체한다.090의 더블클릭 이동 제거와087/088의 편집창 닫기·직접 귀가를 보존한다.

## 변경과 원인

- 실제 반전 조건은40→30px·400→300px/s·반전3→2회와 세 번째 stroke·최소450→280ms로 조정했다.16ms 시각 격자·유한 history·160ms 공백 처리·원래1초 latch·한 번 소비는 유지한다. 단발 이동/한 번 왕복/작은 떨림/느린 이동/이벤트 폭주는 반응하지 않는다.
- 기존 row8 집기 물리는 유지하면서 마지막 row22 그림의 column을 실제 jump 동안 보존한다. 실제 첫 지지면과 row5/6 낙하·착지 물리를 바꾸지 않는다. 완료 때 local로 옮긴 column은 기존 action 초기화 뒤 첫 ground22에 이어진다. 취소·새 입력·blur·감소/OFF·일반 창·집 명령의 우선권을 유지한다.
- row22는 실제2그림, row23은4그림이다. 희소 그림을 더 느리게 나열하는 대신 shake 전용520ms 어지러움+800ms 회복에서 안정된 빙글빙글→눈 감음→정상 눈으로 잇고 기존 pose plane의 유한 감쇠 lean/compression을 매 표시 프레임 샘플링한다. 지지점은 고정이며 기존 다른 반응은 compression0이다. 새 프레임/픽셀 보간/새 아트를 생성했다고 주장하지 않는다.
- 회복 row23은 이전에는 beat 시작 때야 읽어 cold decode가 초반 회복을 건너뛸 수 있었다. 실제 첫 집기 때22, 어지러움 시작 때23을 기존 decoder로 준비한다. exact decoded image·2 in-flight/3 retained·실패시 기존 몸체 표시·현재 단일 display scheduler를 유지한다. 새 consumer/clone/canvas/상시 loop/timer/React 프레임 업데이트/서버 요청은 없다.

## 실패 확인과 수정

첫 production-build fixture8개는5PASS/3FAIL이었다. 편집실 ground22→23 경계에서 tick의 sample.row와 paint의 새 시각으로 계산한 play.row가 한 프레임 달라 마지막 나선 그림이 바뀌었다. carry 조건을 실제 표시 sample.row에 맞춰 고쳤다. 첫 raw report/trace/JSON/PNG는 보존했다.

나머지 lite/터치는 취소 동작 전에 arm 확인에서 실패했다. 관측용 native pointermove 기록을 추가해 실제 입력을 확인했다. 첫 stroke는 seed 이후45px만 남았고 lite155.3ms(289.8px/s), touch217.8ms(206.6px/s)로300px/s보다 느렸다. 단조 시각/시계/제품 상태를 주입하지 않았다. 제품의 느린 이동 거절은 유지하고, 검사 제스처를 기존10회±100px에서3회±90px·3step×30ms+30ms pause로 조정했다. 더 작은70px/200ms 경로는30/60/120/240Hz 단위검사로 별도 확인한다.

다음8개는7PASS/편집실 첫 지지점X1FAIL이었다. 실제 마우스를 놓은940px 아래에 기존 중앙 패널 토글의 보호 영역이 있어 실제 안전한 floor span850.96px로 옮겨 착지했다. 이는 유지해야 하는 기존 control 보호다. 제품 물리를 바꾸지 않고 검사 집기 중심을740px로 옮겨 마지막830px 낙하 ray를 실제 버튼과 분리했다. 첫 지지면/동일X/전 프레임 실제 표정/pivot/취소 단언은 유지한다. 모든 첫 실패와 관측용 재현 결과를 별도 보존한다.

## 최종 검증

격리 production fixture build `COhDP-yWtcC2J1ll649l3`, Windows Chromium. 설정만 seed하며 위치/행동 callback·랜덤·시계는 대체하지 않는다. POST는 차단하고 실제 운영 일정은 수정하지 않는다. 공개 DTO/역할/언락/KST/1840 기하와 모바일 제외를 유지한다.

| 검사 | 결과 | 범위 |
|---|---|---|
| 전체 unit |1,954/1,954 PASS·skip0 |감도16개·회복 연속성/경계·기존 전체 |
| 정적 검사 |build/typecheck/전체 lint PASS |경계 수정 후 재빌드·typecheck·대상 lint도 확인 |
| 새 실제 조작 |8/8 PASS·retry/skip0 |viewer/studio full·lite·단발·reduced/OFF·native lostcapture/touchcancel |
| 기존 실제 조작 |31/31 PASS·retry/skip0 |관성5·빠른 놓기/최종up10·일반 창2·편집창 닫기6·직접 귀가8 |
| 독립 검토 |최종 blocking0 |실제 sample 기준 전환·기존 controls 보호·엄격 단언 보존·PNG/JSON 후속 확인 |
| 소스 일치/harness |28파일 바이트 일치·harness242 PASS |검증한 격리 소스만 main에 통합 |

양성3개의 실제 낙하39/38/37프레임과 첫 지상 어지러움28/31/24프레임은 각각 동일한 HD22 한 그림을 유지했다. 회복은 실제 채택23의 눈 감음→정상 눈 딱1회, 그 사이 연속 transform46/48/24개와 최종 중립(tilt0·scale1)을 확인했다. 전 프레임 같은 노드/visible/decoded, 실제 첫 바닥·releaseX 오차0·회복 동안 위치 고정, 저장 설정 bytes 동일, 새8개 POST/pageerror0이다. fresh held9개씩의 grip 오차 최대0.000518px·pivot0.015346px였다. PNG6장을 독립 검수해 실제 나선눈·기존 무사지 몸체/귀·과도한 확대나 유령 겹침/잘림 없음을 확인했다. 수치는 이 fixture 관측 범위의 결과다.

원본은 격리 작업트리 `.scratch-pw/091-*`, 전달 증거는 메인 `.scratch-pw/companion-091/`에 둔다. UI 검사는 합성 fixture에서 실제 native 입력을 실행한 범위이며 실제 OBS 장비·모든 장치/기하/네트워크 순열·권한/RLS를 증명하지 않는다. 읽기 전용 서버 prefetch까지 DB 요청0이라고 주장하지 않는다.

## 배포

관련 코드/검증 문서만 정상 commit/push하고 원격 quality·Vercel·실제 운영 전체 SHA/노출 경계를 확인할 예정이다. 실제 운영 결과 확인 전 배포 완료로 기록하지 않는다. 사용자 아트·별도 표정 기록·임시 PNG/.vscode는 보존하고 stage하지 않는다. 기존 Vercel Hobby 초과 및 실제 OBS 검증은 별도 미결이다.
