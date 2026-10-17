# 빅타민 귀가·습관 요약 검증 — 2026-10-17

Status: Deployed99ee2a76 and verified on2026-10-17. [PLAN-084](../plans/PLAN-20261017-084-companion-home-route.md). No independent reviewer was used.

## 동작

- 공유 renderer의 소파 호출은 기존 BFS/ballistic 발판 경로를 매 행동 종료 시 다시 구한다. 걷기는 최대180px 구간으로 나누며 각 점프의 상승/거리/낙하 한도는 기존140/260/240px다. 원래의 한 번에650–1600ms 장거리 비행을 제거했다. 잠든 상태는 먼저 깨어난다.
- 실제 발판을 우선 사용한다. 부족할 때 집 아래 빈 공간에96px 간격·최대24개의 작은 보조 발판 후보를 안전 기하로 만든다. 실제로 사용할 후보만 귀가 중에 표시한다. 텍스트/전체 버튼 hit target/집 경계/viewport를 피하며 음식 착지·일반 배회·최초공개에는 노출하지 않는다. 기존 집 바닥은 명시적인 귀가 경로에서만 중간 발판으로 허용한다.
- 바닥과 하단 버튼 사이에8초의 활성 시간이 지나도록 머물면 같은 귀가 계획을 사용한다. 기기 부재/창 수면 시간은 누적하지 않으며 경로 실패 후30초의 활성 시간 재시도 제한을 둔다. 실제 위쪽 발판에 올라가면 대기를 초기화한다. 별도 timer/관측 loop/서버 호출은 없다.
- 직접 소파 호출은 기존과 같이 자동 배회/자동 점프 OFF에서도 사용할 수 있다. 설정 자체를 바꾸지 않는다. 동작 줄이기는 기존 즉시 귀가를 유지한다. 직접 잡기·쓰다듬기·새 위치 선택은 귀가 목표를 취소한다. 일반 창은 행동 종료/수면 후 같은 목표를 이어가며, 집 접힘/상실은 실제 안전 발판으로 유한 착지한다.
- ‘배운 습관’은 기존 local sociability/playfulness/confidence의 유의한 변화만 짧게 설명한다. 초기/초기화는 중립 문장, 학습 OFF는 기억 보존 안내다. 기존 care store와 reset/storage subscription을 사용하며 추가 행동 기록·개인 정보·서버 수집은 없다.

## 환경과 확인

- 격리 production build `l3rM_GV8V8hQ-sfpCV2Yl`, port3184. 환경/자격증명 복사0. 변경7제품 파일 SHA256이 원본과 빌드 입력에서 일치한다(`.scratch-pw/side-084-source-proof.json`). 메인 빌드/OBS/브라우저/DB 작업과 분리했다.
- `next build`, 별도 `npm run typecheck`, 격리 전체 `npm run lint` exit0. 관련 unit121/121, 문서 memory unit18/18 PASS. 신규8개 단위 사례는 빈 달의 여러 점프/실제 경로 우선/옵션·상실/이동/상한/밀집 그래프/성향 요약을 포함한다.
- 실제 production fixture의 최종 상호작용9/9 PASS(1.8분). POST를 전부 가로채고 pageerror/POST0을 단언했다. 가짜 시계 없이 실제 키보드·마우스·창·접힘으로 검사했다. 시청자/빈 달 편집실의 바닥→귀가, 정상 크기·소파, 직접 이동, 초기화·OFF,1366×900 오른쪽 compact 집, 귀가 중 설정 왕복·드래그 취소·접힘, 자동 점프 OFF 상태의 직접 호출을 확인했다. 자동 탈출 사례는 호출 클릭 없이23.6초에 완료했다(별도 재실행23.4초). ‘8초’는 활성 대기이며 실제 걷기/점프 시간과 다르다. 시청자·편집실의 이동 중 보조 발판, 도착 소파, 설정 PNG를 직접 열어 확인했다.
- 초기 확장 검사에서 접힌 집의 경로가 남는 결함을 발견해 수정했다. 바닥 근처의 작은 패널 발판을 오른 경우도 낮은 구간으로 묶었다. 자동 검사 첫 시나리오는 실제 패널 발판으로 올라가는 성공을 ‘귀가하지 않음’으로 오인했다. 발판 부재 검사에서는 fixture의 화살표를 unavailable로 설정해 별도 조건을 만든다. 최초 배치 전에 이를 제거하면 기존 점유 발판까지 없어져 입력이 무효가 되는 하네스 문제도 배치 이후 설정으로 수정했다. 이 조건은 실제 계정/운영 데이터 변경이 아니다.
- 최종 문서 harness229개/brief6322bytes, memory unit18/18, scoped diff/ESLint 검사 PASS. 최종 visual spec까지 포함한 별도 typecheck exit0. 격리 전체 lint도 exit0이었다. 원본 근거는 ignored `.scratch-pw/side-084-source-proof.json`, `.scratch-pw/.scratch-pw/side-084-visual.json`, `companion-084-{viewer,studio}-{route.json,steps.png,home.png,habits.png}` 및 `companion-084-short-right-home.png`다. 이전 실패를 최종 PASS로 덮어 해석하지 않는다.

## 남은 경계

운영 로그인/모든 이전 visual suite/실제 OBS 장비를 검증한 결과로 확대하지 않는다. 귀가 거리는 자연 이동 시간에 영향을 주므로 기존 ‘5초 안 즉시 소파’ 전제의 시나리오는 통합 시 시간/사전 위치를 확인해야 한다. 권한·DTO/DB·KST·1840 포스터 표면·모바일 빅타민 제외는 바꾸지 않았다. 독립 통합 리뷰와 배포 확인은 아직 없다.

## 배포 후속

2026-10-17 소유자가 배포를 승인했다. 현재 main23d3a0a9 기준 전체 unit1,925/1,925 PASS(201파일). 최종 제품7파일의 SHA256이 검증한 격리 build 입력과 일치하며084 실제 상호작용9/9와 build/typecheck/lint 증거를 유지한다.083의 숨기/추출 변경도 함께 배포한다. 별도 리뷰어는 사용하지 않았으며 자체 소스 대조/자동 검사를 독립 리뷰어의 승인이라고 보고하지 않는다. 운영 결과는 실제 배포 후 확인한다.

배포 커밋99ee2a76 main push와 [Vercel success](https://vercel.com/bluesky-s-project3/vic-schedule-studio/p5Vww2JBguwBDfvRTrMMR96ZVCNf), [원격 quality39001831268 전체 PASS](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39001831268)를 확인했다. 실제 운영 API 전체 SHA가 일치했고 HTTP6개와 익명 설정창의 습관 설명/단일 빅타민·귀가 DOM을 검사했다. 개인 브라우저 설정/일정 데이터는 바꾸지 않았다. UI probe의 root POST1건은 익명 하트 복원용 server action이며 전송 전에 intercept했다. pageerror0, 전송된 POST0. 초기 probe는 POST-only `/api/activity`의 GET405를401로 잘못 기대했으며 실제 개발자 API `/api/developer/presence`의401과 구별해 수정했다. 첫 UI 검사도 실제 production의 root 복원 POST를 fixture처럼0건으로 기대해 실패했으며, 전부 차단됨과 허용된 경로/header를 단언하는 transport 검사로 정정했다. 원 실패 JSON을 보존했다.

최종 배포 확인 기록은 로컬 문서에 남겼다. 제품 변경 없는 사후 기록만을 위해 추가 운영 빌드는 만들지 않았다. 공급자 계량/한도 상태는 [083 기록](FLUID_HIDE_EXTRACTION-20261017.md#배포-승인한도-설명-정정)에 분리했다.
