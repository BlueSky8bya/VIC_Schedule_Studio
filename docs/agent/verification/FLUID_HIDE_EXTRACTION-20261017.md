# Fluid·숨바꼭질 꺼내기 — 2026-10-17

Status: Local implementation verified; independent integration review and production deployment remain. [PLAN-083](../plans/PLAN-20261017-083-fluid-and-hide-extraction.md).

## Vercel 실제 관측

12:29KST 별도 dashboard 탭, Production/Last hour, UI11:29–12:29.118invocations, Error0%/Timeout0%, Active CPU P75 203ms, 평균 사용252MB/할당2.05GB, CPU throttle P75 13.3%, cold11%. 상위 경로의 Active CPU 합: `/`12회3.27s, `/api/cron/vod-chat`13회2.98s, `/studio`10회2.92s, presence26회1.78s, activity20회750ms, warm13회700ms, soop-live4회650ms. 이들은 누적30일 quota 수치나 특정 빌드의 인과적 절감률이 아니다.

기존 [080](PLATFORM_REMEDIATION-20261017.md)의 timeout 상한·single-flight·변경 없는 파생 재빌드 억제가 현재 소스에 존재한다. 예전12시간warm41.4%와 이번1시간0%는 시간/분모가 달라 절감률로 환산하지 않는다. Duration는 기존 관측에서 Pro Demo여서 실제 Provisioned Memory 비용 분해는 미확인이다.

[Vercel 공식 과금 설명](https://vercel.com/docs/functions/usage-and-pricing): I/O 대기 중 Active CPU는 멈추지만 요청을 점유하는 할당 메모리 시간은 계속 계량된다. `after()`로 응답 후 옮긴 작업도 무료가 아니다. 빅타민의 로컬 애니메이션은 이 서버 CPU 계량과 별개다. 오래 걸리는 원본 수집/외부 요청을 줄이는 것이 주 경로이며, 이미 단축된 프로브를 무작정 없애거나 실제 heap252MB를 근거로 서버 설정을 바꾸지 않는다.

## 로컬 변경·검증

- 공유 renderer의 포인터·키보드 모두 실제 sheet 경계 밖 거리0→92px를 smoothstep으로 축소 비율→1에 연결한다. 새 pure helper는 pickup 때 받은 기하만 사용하며 추가 DOM 측정/타이머/DB 호출을 만들지 않는다. 잡은 재질 좌표에 scale을 적용해 커져도 포인터 아래 grip을 유지한다. 다시 안으로 들이면 같은 곡선을 역방향으로 따른다. 밖에 놓으면 기존 FLIP 시간/비초과 ease로 사용 가능한 정상 크기에 정착하고, 기존 단일 몸체·창 수면/취소·다음 실제 발판 인계를 유지한다.
- 한 숨은 public 카드에만9–14초 주기·시작 위상·좌우 방향을 세션마다 뽑는다. 서로 다른 휴지 간격 사이 짧은 rotate/translate 묶음으로 위치를 알린다. 기존 transform/FLIP을 덮지 않으며 공개 일정 기하·쓰기·제목을 바꾸지 않는다. reduced/off/soft는 기존 정적 힌트를 유지한다. 숨은 상태에 상시 JS loop를 추가하지 않았다.
- 격리 build `U-jy3WWRKrEOsw0FjwRcO`, port3183, 환경/자격증명 복사0. 실제 변경3제품 파일의 원본/빌드 입력 SHA256 일치. 메인 .next/3100/OBS·DB·로그인 탭에 쓰지 않았다. 공개 fixture만 열고 클라이언트 POST는 가로챘다.
- 관련 unit36/36 PASS. 실제 시간 studio native 검사1/1 PASS: 현실 내용 입력칸의44px(0.478261)→48.8px→63.3px→81.4px→92px 중간 프레임을 확인했다. 포인터 왕복/키보드18step/취소 모두 원래 작은 칸으로 되돌아왔고, 최종 바깥 놓기는1배가 됐다. 편집 내용·focus·단일 몸체·전경 창/teaser의 guest 철회 검사를 유지했다. 실제 전체 화면 PNG2장도 직접 확인했다.
- 시청자 기존 회귀3/3 PASS: 다른 상세창/발견/상호작용/추출·gfx-off의 정적 힌트와 키보드·보호 바닥 아래 추출 후 창 닫기. 이3개는 숨기 grace만 controlled clock으로 진행하고 실제 popup/입력·닫기 전환은 브라우저에서 검사했다. studio 신규 검사는 가짜 시계 없이56.1초, 키보드 확장 후 약1.1분이었다. 각 수치를 실제 로그인/RLS·모바일·방송 장비·모든 순열 검증으로 확대하지 않는다.
- production build PASS. 첫 별도 tsc는 격리 복사에 누락된 scripts 타입 import 때문에 실패했고 원인은 숨기 구현이 아니었다. scripts 읽기 junction을 보완한 뒤 별도 tsc PASS. 새 visual spec까지 복사한 최종 typecheck·격리 전체 ESLint도 exit0 PASS. scoped ESLint·diff check PASS, 문서 harness227/brief5947bytes 및 문서 unit43/43 PASS. 독립 integration review·운영 배포 검증은 아직 수행하지 않았다.

원본: ignored `.scratch-pw/side-083-{source-proof,unit,visual,regression,doc-unit}.json`, `companion-083-scale-samples.json`, `companion-083-hide-cue.json`, `companion-083-{reinserted,extracted}.png`. 과거 회귀 출력은083 별도 이름으로 보존했다. 메인082의 근거를 덮거나 이 빌드의 PASS를 그 배포에 소급하지 않는다.

이번 별도 작업에서 추가 서버 수집/주기/캐시 정책은 바꾸지 않았다. 현재 창에서 warm·soop-live가 주요 과다 비용이라는 새 근거가 없었고, 이미080이 해당 경로를 축소했다. 30일6h37m/460.2GB-Hrs는 소유자 제시 누적값이며 이후 같은 기간/분모의 운영 변화 확인이 남는다. `after()`를 없애거나 인증/수집 정확도를 낮추는 변경, 유료 전환/Fluid OFF/낮은 메모리 강제, 새 Redis 도입은 하지 않았다. 현재 크기의 heap을 할당 메모리 GB-Hrs로 환산하지 않는다.

## 배포 승인·한도 설명 정정

2026-10-17 소유자가 이 별도 대화에서 배포를 승인했다. 배포 전 현재 main23d3a0a9와 변경 범위를 대조하고 전체 unit1,925/1,925 PASS(201파일), 최종084 build/typecheck/lint/rendered9의 동일 소스를 확인했다. 새 서버/DB·요금 설정 변경과 사용자 art/preview/.vscode는 제외한다. 별도 리뷰어는 이 side 대화의 subagent 금지로 사용하지 않았으며, 자체 코드 대조와 자동/원격 검증을 독립 리뷰어의 PASS로 표시하지 않는다.

실제 Vercel UI의 Hobby 플랜·Last30Days 표시에서 CPU6h46m, Memory461.3GB-Hrs를 확인했다. 표시 구간은 `Sep16 오후10:00–Oct16 오후10:00`이며 이를 다른 기간의118회/오류0%와 같은 지표로 계산하지 않는다. 공식 [계량 규칙](https://vercel.com/docs/functions/usage-and-pricing)은 CPU를 실제 계산 시간, memory를 할당GB×요청을 처리하는 인스턴스 시간으로 정의한다. CPU는 외부 I/O 대기 중 계량을 멈추지만 memory는 계속된다. 4h/360GB-Hrs는 Hobby 포함량이며 초과는 아직 해소되지 않았다. [Hobby 정책](https://vercel.com/docs/plans/hobby)에 따르면 초과 시 기능 사용이 제한될 수 있다. 기존 누적은 최적화·재배포로 초기화되지 않는다. 유료 전환/한도 변경은 하지 않았다.
