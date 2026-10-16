# 빅타민 전수 점검 — 2026-10-17

Status: 수정본 production-fixture 최종66개 PASS. 운영 배포 검증 대기.
Plan: [PLAN-077](../plans/PLAN-20261017-077-companion-comprehensive-audit.md)

## 범위와 재현 기준

시청자·비로그인·미리보기·owner/developer 편집실의 공유 빅타민, 음식, 집, 입력과 창 소유권을 조사했다. 전체 사이트의 모든 가능한 순열을 검증했다는 뜻은 아니다. 기존 검사 전체와 새 경계 조합을 production build에서 한 worker·재시도0으로 실행하고, 실패 trace/PNG 및 원본 검사 SHA를 보존했다.

수정 전 기준은 `5ff385f25c95f1dabd8b3a226b556a6dda1766ab`, build `o7_pMOvCqDKGUak92NA9H`다. 수정 전 제품 소스58개 및 최초219개 검사 목록을 별도로 동결했다. 1차 수정본은 build `Q8BmPcnPs0mtO8cpq5Hmv`, 제품·검사166개 SHA를 동결해238개를 실행했다. 2차 `SpW8hT7SKAamctfgLJvMX`의71개, 3차 `wN_FnyyJzhRyOQDGXAWlZ`의핵심12개, 4차 `nVYAV5Z3aO47Tg-43sdLB`의54개와 최종 `-ya8Orx0Nh8_s6xLwH-Dh`의66개(소스168개 SHA 동결)를 구별한다.

시험용 Supabase 데이터 쓰기나 현재/미래 달 시험 데이터 생성은 하지 않았다. 자동화는 과거2026-06 fixture, 쓰기 요청 차단과 합성 읽기 응답을 사용했다. 별도의 짧은 운영 브라우저 접근에서 발생 가능한 방문 telemetry는 아래 한계와 구별한다. 공개 DTO·역할·unlock·KST·실제 사람의 하트/집계 경로는 변경하지 않았다.

## 확정 결함과 수정

| 결함 | 수정 전 증거 | 수정 |
|---|---|---|
| 보호된 하단 바닥 아래에 놓은 빅타민이 발판 없이 그려지거나 다른 날짜로 재생성됨 | care6개 trace에서 빈 support·숨김 해제·다른 날짜, 새 viewer/studio×full/lite4개 실패 | 첫 하향 접촉이 없을 때 같은 x의 실제 viewport 바닥만 복구. 유효한 발판 없는 명시 drop은 수동 복구 의도로 유지 |
| 숨은 빅타민을 팝오버에서 꺼내 맨 아래에 놓고 닫으면 사라짐 | 새 native guest 회귀1개: card→빈 support→returning 만료→hidden | 같은 명시 drop 규칙 공유. 실패 bridge가 위 날짜를 고르는 passive 복구로 바뀌지 않음 |
| 일반 일정 창이 열린 동안 두 번 눌러 위치를 고르면 입력은 종료되지만 위치가 바뀌지 않음 | HD 원본 trace의 목표 오차568.86px, 표시용 perch만 변경 | 직접 드래그와 같은 실제 위치 채택·기존 중력·공유 스케줄러 사용. 창 닫은 뒤 명시 이동 위치 유지 |
| 이미 잠든 동물을 일반 창 밖에서 옮기면 착지는 끝나도 jump 자세·zzZ 없음으로 멈춤 | Q8의 native drag·두 번 눌러 이동2개 모두 실제 착지 후6초 동안 pose111/journey 종료/parked·jump 잔류 | ordinary 창의 이미 parked인 명시 drop에 마지막 sleep·dreaming을 확정. 감소 동작의 즉시 착지도 같은 helper 사용. 2차 viewer4종과 기존HD/관성/수면 검사 통과 |
| 편집실의 일반 빅타민 첫 tap이 편집창을 닫고, 날짜 칸의 역할이 배치 입력까지 거부 | 2차 quiet 검사 studio full/lite/reduced/off4개 실패. 실제 ARTICLE.studio-day hit ancestry와 첫 tap 뒤 presence active·창 닫힘 보존 | 일반 actor 직접 입력은 바깥 닫기에서 제외. guest는 실제 aria-owns 소유권 유지. 구조적 날짜 칸만 배치 허용하고 실제 버튼·입력은 먼저 보호 |
| 초기/뒤로가기 패널 전환 때 별도 소파 앞면이 중복·분리되어 보임 | Q8 PNG293 원본에서 확인. 새 entry4개 모두 2차 빌드에서 FAIL, 실제 전환 alpha와 clear 고정 앞면 동시 표시 기록 | 외부 앞면은 seat/back 내부 개체의 가림에만 사용. local/외부 앞면 중 하나만 그림. 현재 방의 위치·alpha를 기존 유한 추종에서 공유하고 초기 진입도 그 lease로 처리 |
| 편집실 lite 패널이 화면 안으로 들어와도 집의 빅타민은 전환 종료까지 숨음 | 4차 native 왼쪽 전환에서291.1ms에 침대 전체가 화면 안·alpha .901인데 hidden,591.2ms에만 표시 | 기존 유한 추적 안에서120ms 큐로 정식 안전 발판 재검증. 검증 요청은 추적 시간을 연장하지 않고 실제 이벤트가 우선하며, parked 구독은 유한 꼬리가 끝나면 해제 |
| 편집실 축소된 집→compact 집 전환 때 음식이3.609px 뜸 | 새 studio 연속 조작 실패, zoom floor32.390625→portal36px·이전 offset 유지 | 집 바닥 음식의 y만 현재 실제 바닥−6으로 정렬. 원래 local x·버튼 회피·소파 제외·외부 낙하 유지 |
| 다크 설정의 비선택 글자 대비 부족 | 새 viewer/studio 실측3.7765:1, PNG 확인 | 공유 설정의 기존 `--ink-soft` 토큰 사용. 선택 상태/배경/모션 유지 |

편집실에도 공유되는 설정 설명의 시청자 전용 문구도 바로잡았다. 새 아트·의존성·DB·API·전역 필터·프레임 루프는 추가하지 않았다. full60/lite30 이동, 포즈 cadence, parked 상태의 자율 프레임·기하 측정0(검사 quiet-tail 구간),92px 전체 몸체,1840 포스터와 모바일 완전 제외를 유지한다.

## 검사 오라클 교정

원본 실패를 삭제하거나 성공으로 덮어쓰지 않았다. 수정 전219개 결과는178 PASS/41 FAIL, 새18개는5 PASS/13 FAIL, 추가 guest1개는 FAIL이다. 같은 원인의 여러 실패를 서로 다른 제품 결함 수로 세지 않는다.

- 과거76px·20행 대신 현재92px·통합32행 metadata로 측정. 이동·포즈·프레임 기준 유지.
- 짧은 클릭=쓰다듬기, 일반 창의 자동 밀기/닫기 복귀라는 옛 기대를 현재 승인 동작으로 교정. 실제 hover·Enter 친밀도, bonk·취소·capture·수면 검사는 유지.
- 입력 이벤트 안의 동기 DOM 상태 대신 실제 첫 표시 프레임을 측정.7px 즉시 드래그·capture·300ms 상한 유지.
- 전체 설정 backdrop에 가려진 pet 좌표로 입력을 보내던 검사는 실제 노출된 일반 팝오버와 `elementFromPoint`로 검증.
- 하단 바닥보다 아래에 음식을 놓고 위 바닥을 기대하던 fixture 좌표, 초기 점프 중 쓰다듬기,900ms보다 느린 subpixel 왕복, 짧은 착지/표정 beat를 뒤늦게 poll하던 순서를 교정. 물리 낙하·실제 왕복·표정/decode·동일 DOM 검사는 유지.
- 새 cold-held 검사는 정상 idle→touch 이미지 교체를 허용하고, 차단한 held packet 대기 중 실제 decoded touch 이미지가 유지되는지 확인.91.999969px 같은 BCR 오차는0.01px 이내만 허용하며 숨김0·decode·가시성 기준은 유지.
- 단독 하트 DOM 검사는 실제 모듈의 새 의존성을 함께 로드. 사람의 수치·하트 우선권·click 전달·저장/삭제·pause 검사는 그대로 유지.
- 소파 밖에서는 완전한 local 앞면, 내부에서는 별도 가림 앞면 하나만 요구하도록 house-flip·sofa-contact·plush-home 검사를 교정. 원래의 실제 rim·몸체·grip·정렬 허용값과 native 조작을 유지하고 내부 가림 양성을 별도로 요구한다.
- 새 quiet 검사의 편집실 측정25회는 실제 stack과 빌드 chunk를 추적해 기존 편집창 위치 루프의 `ASIDE.event-editor-panel` 읽기임을 확인했다. 실제 lazy manifest의 빅타민 파일을 기준으로 측정 원인을 나누고, 창을 여는 동안 빅타민 측정 양성도 요구한다. quiet-tail의 빅타민 측정·DOM 쓰기0, Range0과 같은 DOM·착지·sleep·zzZ·focus·native 입력 조건은 유지한다.

## 실행 결과

| 검사 | 결과 |
|---|---|
| typecheck / 전체 lint / production fixture build | PASS |
| 바닥 복구 unit |21/21 PASS |
| 음식 unit 새 회귀 | RED 재현 후28/28 PASS |
| 전체 unit 최종 제품 소스 |1686 PASS/8 FAIL(1694개). 아래의 기존 실패와 동일 |
| 빅타민 관련 unit |49파일557개 PASS. 기하50개에 새 경계5개 포함 |
| 기존 빅타민 visual 전체 | 수정 전219개 실행 완료,178 PASS/41 FAIL |
| 새 입력12·집2·다크/모바일4 | 수정 전18개 실행 완료,5 PASS/13 FAIL |
| 새 입력12·집2·다크/모바일4 수정본 | Q8에서18/18 PASS. 집 앞면 정렬 오차 최대0.015625px, 음식 바닥은 native 기준2px 미만 |
| 새 guest 최하단 추출 | 수정 전1개 FAIL 재현 |
| 1차 visual 전체238개 |229 PASS/9 FAIL. 원본 결과 보존 |
| 2차 후속71개 |67 PASS/4 FAIL. 원래9개 실패는 전부 해소, 남은4개는 신규 편집실 직접 입력 문제 |
| 새 quiet reduced2 / entry4 수정 전 |각2 FAIL /4 FAIL로 재현. 후속 결과와 별도 보존 |
| 3차 핵심12개 |7 PASS/5 FAIL. alpha 불일치1개 수정, 편집창 자체 비용 귀속4개는 위 근거로 교정 |
| 4차 제품54개 |51 PASS/3 FAIL. 패널 진입 중 숨김1개 수정, 소파 외부 앞면 옛 오라클2개 교정 |
| 최종 후속66개 |66/66 PASS,8.7분,worker1·재시도0·skip0·flaky0. 동결168개 소스의 실행 전후 SHA 일치 |
| 독립 제품/검사/PNG 검토 | 원인별 완료. 음식/바닥 작성자의 자체 검토는 별도 표시하고 다른 리뷰어의 독립 검토도 받음 |
| harness | 기존2건 FAIL: active rule ID·RULE_MIGRATION inventory 불일치 |
| 운영 배포·익명 smoke | 미실행 |

전체 unit의 기존8건은 ambient-codex2, centering-vs-animation1, public-cache-revalidate1, scroll-position-wiring1, timeline-route1, vod-chat-recovery2다.076의 기존 실패 목록과 같다. 이 작업의 PASS로 부르지 않는다.

## 행렬과 증거

대표 조합은1920·1440·1280·1040 경계와390 모바일, dark/light, full/lite/gfx-off/reduced, 양방향 스크롤·월·zoom, 설정 저장/복원, 귀/몸통 잡기·관성·hover·키보드·capture 취소, 음식8개·중력·입·휴지통·집 부착, 소파 안/밖/앞면, 팝오버/검색/기록/설정, 숨바꼭질·찾기·추출, 최초공개 집 퇴장·일정 진입·공개 후 귀환이다. 실제 개별 실행은 보고서가 기준이며 전체 직교 조합을 뜻하지 않는다.

다크 설정의 수정 후 비선택 글자 대비는 viewer/studio 모두 최소6.6274:1이다. 수정본의 집·설정·모바일 PNG42개는 별도 `companion-077-final-surface-visual-review.json`에서 검수했다. 추가로40개 contact sheet의472개 후보(Q8 실제 첨부238개와 별도 시점 PNG234개)를 모두 열람하고 원본24개를 확대했다. 각 시점과 증거 한계를 나눠 기록했고, 그 과정에서 초기 소파 전환 결함을 추가 발견했다. 4차 PNG62개는 별도 원본·1:1 ROI 검수로 소파 U실루엣·단일 앞면·경계 틈을 확인했으며, 정지 PNG로 진입 중 hidden 실패를 정상 판정하지 않았다. 전체 실행 중 발견한 식사 완료 규칙·짧은 프레임 관측·옛 하트 출력·재로딩 시 다른 일정 ID 선택·실제700+700ms 수면 단계라는 검사 문제는 원본을 보존하고 후속 검사와 구별한다.

최종 진입4개·28단계의1,832 native 프레임을 별도 리뷰했다. 내부 가림507프레임·부분 alpha105프레임에서 alpha/앞면 소유/정렬 위반0, 각 문서·관찰 단계 안에서 같은 DOM 유지, 중복 개체0, 외부 앞면 중복0이다. 최대 정렬 오차는0.00050px, alpha 차이는0이다. 문제의 studio-lite 왼쪽 전환에서 첫 표시가591.2→359.6ms로 앞당겨지고 부분 alpha 표시가0→7프레임으로 회복됐다. 침대 전체가 화면 안인데 숨은 구간은302.9→66.3ms다. 안전 후보 노출부터 실제 표시까지는136.8ms로,120ms 큐와 다음 프레임을 포함하므로 절대120ms 이내라고 주장하지 않는다. 최종 정지 PNG24장도 따로 열람했으며, 초기 offscreen/희미한8장은 연속 가시성 양성에서 제외했다.

로컬 증거는 `.scratch-pw/companion-077-*`의 보고서·버전별 results·PNG·JSON·trace, 오라클 원본 SHA 백업에 보존한다. 수정 전 전체 보고서는 `companion-077-baseline-report.json`, 새 검사는 `companion-077-new-before-report.json`·`companion-077-guest-before-report.json`, 수정본은 `companion-077-final-report.json`이다. PNG 검토 목록은 `companion-077-surface-visual-review.json`에 별도 기록한다. 합성 데이터여도 원본 trace는 커밋하지 않는다.

최종 실행은 `companion-077-r5-report.json`, 소스 일치는 `companion-077-r5-final-proof.json`, 진입 정량 비교는 `companion-077-r5-entry-comparison-actions.json`, 원본24장 검수는 `companion-077-r5-ui-aa-review.json`, geometry·runtime 독립 검토는 `companion-077-home-revalidation-independent-review.json`이 근거다.

## 한계

fixture의 owner/developer는 실제 로그인·운영 RLS 증명이 아니다. 기존 Chrome의 실제 운영 개발자 세션과 당시5ff385f 버전 접근은 읽기로 확인했으며 편집·저장하지 않았다. 이 짧은 기존 브라우저 접근의 일반 방문 telemetry는 인터셉트하지 않았으므로 fixture/자동화 smoke의 쓰기 차단 증거와 구별한다. 실제 OBS/SOOP 송출·스트리머 GPU/브라우저 장비, 감각적 만족도, OS 자체의 백그라운드 스케줄링은 검증하지 않았다. 코드/브라우저 측 프레임·정지 비용 검사와 구별한다. 사용자가 열어 둔 이미지·미커밋 아트·설정 파일은 보존했다.
