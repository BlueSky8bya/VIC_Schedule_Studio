# 빅타민 폼폼 점프 — 2026-11-18

현재 상태(2026-11-19 KST): 구현·사용자 시각 승인·독립 통합 검수 완료. 사용자가 “좋아, 이대로 커밋하고 푸시해서 배포까지 해줘.”로 이 시안의 commit/main push/Cloudflare 출시를 승인했다. 아래 시안 대기·미승인 문장은 당시의 검증 이력이며 이 승인 범위에서 대체한다. 운영 배포·QA 보존·worktree 정리의 실제 결과는 원프로젝트 ignored `.scratch-pw/companion-pompom-release-20261119/jump-pompom/release/`에 기록한다. 이 문서는 배포 성공을 선행 주장하지 않는다.

직접 사용자 요청: 폼폼/제기처럼 상승 중 아래가 모이고, 정점에서 잠깐 둥실 풀렸다가 하강 중 아래가 넓어지는 느낌. 원본/승인된 눈·쓰담·입·귀·모자는 유지하고 새 원화를 생성하지 않는 런타임 변형이다. 기존 쓰담 배포69672efe와 별도 범위다.

## 구현 계획

2026-11-18 후속 직접 요청: “재롱 동작 짧은 뜀 등 다 적용해”. 아래 초기 일반 이동 한정/던지기 제외/옷장 지상 한정은 이 요청 범위에서 대체한다. 실제 공중 변위가 있는 재롱·모자·음악/장난감의 뜀·하트·최초공개 이동·던져짐/낙하·초원·옷장 재생에도 같은 공통 변형을 적용한다. 잡힌 채 움직임, 접지한 호흡/기울임, reduced/off/soft는 제외한다. 짧은 뜀이 기존65px/s 문턱에 전부 지워지지 않도록 높이에 맞춰 반응을 조절한다. 원본/얼굴 보호와 실제 경로·시간 불변은 유지한다. 기존 PASS는 이전 일반 점프 시안 범위이며 새 범위는 재검증한다.

- 기존 공통 motion sampler의 실제 수직 이동과 상승/하강 phase를 사용한다. 새 시계·점프 지연·경로/착지 변경 없이 저속 정점 구간에서 변형을 풀고, 착지 전에 원형으로 복귀한다. 던지기/잡기/지상 동작은 제외한다.
- 공통 native compositor에서 입 아래 몸통에만 연속 가로 변형과 역수 세로 보상을 적용한다. 상단 RGBA·얼굴/귀/착용 좌표는 그대로 유지한다. 원본/파생 packet 재생성 없음. 2D 겉보기 면적 계약을 유지하며 실제3D물리/부피 인증으로 주장하지 않는다.
- viewer/studio/preview 공통 runtime과 초원/옷장 공통 sampler 소비 경로를 확인한다. 모자 없음·모자·얼굴 앞 장식의 레이어와 decoder3/inflight2·reduced/off/soft·hidden/OFF를 보존한다.
- G22: 자율 점프의 그림 반응만 변경. 기존 target/이름/포인터·키보드/활동기록·최소사용집계 의미 불변, 새 인간활동/메타데이터 수집 없음. 서버/DTO/권한/unlock/KST/DB 변경 없음.

## 검증·전달

단위로 상승/정점/하강/착지 연속성과 quiet 제외, RGBA 상단 보존·실제 native 몸 alpha 면적/잘림을 검사한다. typecheck/lint/단위/build/harness와 production fixture 실제 점프/착지·세표면·착용 회귀를 확인한다. origin/main69672efe와 같은 화면/크기/테마의 before/after PNG 및 짧은 동영상으로 감각을 비교한다. 새 범위의 시각 승인은 별도이며 이 계획 자체가 commit/push/배포 승인은 아니다.

## 구현

- 공통 sampler는 실제 수직 변위/경과 시각을 사용한다. 속도절댓값65px/s 이하는 변형0, 상승 최대−.22/하강 최대+.20. 상승 첫16%/하강 마지막24%에서 완만하게 진입/복원한다. 실제 세계 좌표·중력·경로·착지 시간을 바꾸거나 정점에서 물리 시계를 멈추지 않는다.
- 공통 native compositor의 body part에만 가로 배율/역수 세로 적분을 적용한다. 입 아래5논리px부터 시작하며 mouth가 없는 원화는 몸 높이70% 아래+5px를 보호 경계로 쓴다. source/상단 RGBA는 불변. premultiplied 보간으로 투명 경계의 검은 테두리를 막는다. 귀4슬롯/모자와 안경의 앞뒤 순서를 유지한다.
- 모자 없는 공중 자세도 같은 compositor를 쓰고, 실제 현재 그림이 준비된 경우에만 변형한다. 초원도 같은 sampler/painter를 소비한다. 동적 모듈은 점프 시작에 준비하고 중복 로딩·실패 재시도2회를 제한한다. 새 이미지 decoder/상시 RAF/저장소/수집·소리 이벤트는 없다. 옷장의 지상 자세 미리보기는 실제 공중 이동이 없어 변형을 만들지 않는다.

## 증거·한계

- `.scratch-pw/jump-pompom/`에 전체 단위/빌드/타입/lint/harness 로그와 실물 trace를 보존한다. 실제 점프32셀×4강도에서 보호영역 RGBA 변화0, 몸 alpha 면적 오차1% 미만·하단 잘림0을 검사한다. 실제3D부피 인증은 아니다.
- 같은 화면/크기/테마의 `runs/20261118-pompom-jump/before-POMPOM-{rise,apex,fall}.png`와 after 짝6장, `comparison.gif`/`comparison.mp4`, `index.html`을 제공한다. before는 origin/main69672efe의 공통 renderer 소스로 번들했다. 영상은 공통 renderer에 같은 예시 궤도를 주어2배 느리게 비교한 시안이며 자연생활 증거와 구분한다. 보고서1100/390폭에서 PNG6장 로드/가로넘침0 확인.
- 초기 TypeScript는 일부 native의 null mouth를 발견해 보수적 보호 경계를 추가했다. 초기 단위의 signed-zero와 큰 typed-array 비교 timeout은0 정규화/동일 바이트 Buffer.equals 비교로 수정했다. 면적/보호 기준은 약화하지 않았다.
- 오래된 top-jump 실물2건은 날짜칸 바닥을 지원 목록에서 누락한 단언과 집 복귀의 첫 경유 지점을 최종 도착으로 보는 단언에 실패했다. 원래 tests/visual 파일은 수정하지 않고 실패 JSON/trace를 남겼다. 새 범위 검사는 실제 DOM 날짜칸/그림/글자 받침·상승/정점/하강/착지·장식 순서를 관찰한다. 최초 네트워크 실패는 푸터 privacy/terms RSC prefetch가 guard 허용 목록 밖이었기 때문이다. 정확한 두 경로의 GET/fetch/RSC만 빈 로컬 응답으로 분리했다. 미확인 요청·쓰기·live API는 계속 차단/단언한다. 모든 최초 시도가 통과했다고 주장하지 않는다.
- 실제 production fixture의 viewer 무착용/왕관/안경, studio/preview 점프5건과 기존 승인 쓰담3표면3건을 확인한다. 합성 초기 설정/care/RNG·실제 UI 입력·읽기 전용 관찰이며 실제 로그인/RLS·방송PC 성능·자연생활36전체 증거가 아니다. 독립 통합 검수/사용자 시각 승인/새 commit·push·배포는 아직 하지 않는다.

### 최종 로컬 결과 — 시안 준비

최종 소스 `unit-checked.json`: 464파일7,247PASS/1SKIP/실패0. `build-checked.log` production build(내장 타입/lint 포함) exit0. 별도 typecheck/전체lint는 초기판exit0이며, 마지막 선택적 로딩 실패 제한 뒤에는 build 내장 타입/lint로 다시 확인했다. `checked-live.json`: production fixture8PASS/실패0/재시도0, 요청한 하부 변형과 실제 DOM 받침 착지·세표면 쓰담을 확인했다. 최초 실패 결과는 위 기록/로컬 파일에 남기고 이 결과로 덮어 주장하지 않는다. 문서 harness450문서/brief8056bytes·diffcheck 통과.

원본 art/packet/설정된 눈·쓰담 곡률/입·모자·분석/서버/권한/의존성 diff0. React 체크리스트는 기존 effect/취소/clock 유지, 프레임별 React state·storage·새 타이머 없음, 선택적 import 중복/실패 제한을 작성자가 점검했다. 독립 검수 완료 주장은 아니다. 기존 배포69672efe는 그대로이며 새 점프는 `codex/companion-jump-pompom`의 미커밋 시안이다. 실제 사용자 시각 피드백을 기다리고 임시 서버는 종료한다. 합치거나 푸시하지 않은 시안 worktree/QA는 보존한다.

## 후속 완료 — 짧은 뜀까지 공통 적용

일반 row4/5만 보던 이전 gate를 제거하고 공통 유한 `createCompanionPompomFlight`를 실제 발 높이·이동에 연결했다. 높이에 맞춘 속도 정규화/정점 deadzone/접지 envelope로 작은 뜀도 반응한다. 같은 시각 재페인트는 값을 유지하고, 새 action/접지/quiet/150ms 초과 clock 공백은 이전 속도를 버린다. 기존 세계 좌표·시간·입력·G22/소리·decoder 한도는 불변이다.

- 공통 적용: 일반 이동과 낮은 발판/제자리·횡이동, play/impact 재롱(연속 응원·덮치기·구르기·축하), 모자/프로펠러 재주, radio/instrument bounce, 실제 몸이 튀는 장난감 동작, 하트, 최초공개 입장/복귀, 던져짐/낙하. 초원은 같은 공통 관찰기를 쓰고 옷장은 bare/착용 재롱 모두 연결했다. 접지한 쓰담·호흡·nuzzle·기울임·retch나 물건만 튀는 동작은 몸의 점프로 만들지 않는다.
- 입뿐 아니라 각 원화의 실제 양눈 bounds도 보호 경계에 포함했다. 전체520원화×4강도에서 보호영역 RGBA 변화0/alpha면적오차1% 미만/하단clip0. 얼굴이 낮은 포즈에서는 얼굴 보호를 우선해 변형 가능한 하부만 사용한다. 원본/packet을 다시 만들지 않았다.
- 최종 `all-hop-unit-final.json`: 464파일7,249PASS/1SKIP/실패0. 전체 재롱 timing·모자·옷장·음악·최초공개 경로의 상승/하강/접지와 quiet·clock reset 검사 포함. `all-hop-build-final.log` production build/내장type·lint exit0. 별도 `all-hop-typecheck.log`/`all-hop-lint.log`도 통과했고, 마지막 최초공개 lift 끝점 정규화는 최종 build/단위로 재확인했다.
- `all-hop-live-final.json`: production fixture16PASS/실패0/재시도0. 기존 이동5·쓰담3, 실제 옷장 cheer/pounce/tumble의 맨몸/왕관6, 감소모션1, 실제 공개 초안 입력 중 재롱둥이의 짧은 응원1. 마지막 응원은 `data-working`이 실제 켜진 구간만 인정하도록 별도 `all-hop-working-verified.json`1PASS로 강화 확인했다(고유16건에 중복 합산하지 않는다). 모든 쓰기/live API는 차단, 공개 preview read만 합성 fixture로 처리했다.
- 새 전후는 `runs/20261118-pompom-all-hops/`: origin/main69672efe와 현재 실제 cheer sampler/compositor의 같은 순간 PNG6장, `comparison.gif/mp4`, `index.html`.2배 느린 비교 시안이며 실제 actor를 강제로 조작한 자연생활 증거가 아니다. 보고서1100/390폭 PNG6장/넘침0. 기존 이동 점프 보고도 보존한다.
- 최초 확장 전체단위1건은 새 내부 read-only lift 필드로 정확한 object 기대값이 달라져 실패했다. 좌표/입력 불변 단언은 유지하고 lift0 끝점 단언을 추가했다. 최초 새 실물8건은 설정의 미선택 글꼴 CSS guard 누락7건·roam OFF로 응원하지 않는 fixture1건으로 실패했다. 정확한 `UI_FONT_CSS` 선언 URL만 빈 로컬 CSS로 격리하고, 실제 응원은 허용된 roam 설정으로 확인했다. 실패 JSON/trace는 `all-hop-initial-results/` 등에 보존한다. 이전 실패를 PASS로 바꾸어 주장하지 않는다.

새 범위도 로컬 미커밋 시안이다. 원본/눈/입/귀/모자 그림·서버/권한/분석/의존성 변경 없음. 독립 통합 검수·새 시각 승인·commit/push/배포·실기기/실제로그인/RLS/자연생활36 검증은 별도다. 기존 쓰담 운영 배포는 그대로 유지한다.

## 출시 승인·독립 통합 검수 — 2026-11-19

작성 세션과 분리된 후속 세션 `01a1ef29-f9bb-73f0-af3f-dc97d0bcfbb8`에서 실제 diff/신규 두 파일/호출 문맥과 기존 증거를 검토했다. 작성자 자체 검수를 독립 검수로 재명명한 것이 아니다. 역할별 검토를 이 후속 검수자가 수행했고 별도 하위 에이전트 검수는 수행하지 않았다.

- 경계·역할·KST: 변경은 로컬 client 그림과 순수 sampler/내부 lift 메타데이터뿐이다. 서버·DTO·RLS·unlock·날짜·DB·의존성·원화/packet diff0. 공개/편집실/미리보기는 공통 렌더러를 유지하며 권한 승격/새 데이터 경로가 없다.
- UX·React: 실제 발 높이/속도의 유한 관찰만 추가하고 세계 경로/입력/시계를 보존한다. held/quiet/hidden·접지 복원, 얼굴 보호와 귀/장식 순서, 기존 effect 소유권/정리·늦은 import 취소/재시도 상한을 확인했다. 새 frame React state/저장·상시 시계 없음. 같은 순간 before/after 하강 PNG를 직접 대조했고 얼굴/왕관과 기존 화면 균형을 유지한다. 기존 1100/390 보고 검증도 확인했다.
- G22: 자율 재질 반응으로 기존 인간 조작 target·라벨·keyboard/pointer·타임라인·최소사용집계를 바꾸지 않는다. 새 활동/개인 취향/행동 식별자를 수집하지 않는다.
- QA: `all-hop-final-proof.json`의 소스14개 SHA256이 실제 파일과 모두 일치했다. 전체 단위7,249PASS/1SKIP·production fixture16PASS/working 강화1PASS·최종 build/type/lint 증거는 이 소스 범위로 승계한다. 추가 독립 단위2파일9PASS. 첫 추가 실행은 전체520원화 검사에서 기본5초 timeout(8PASS/1FAIL)이었으며 `--testTimeout=120000` 재실행9PASS로 확인했다. 제품 코드·검사 기준 변경 없음, 최초 결과도 보존한다.

통합 차단 지적0. 실제 기기/진짜 로그인·RLS/자연생활36은 여전히 미검증이며 이 client-only 출시에 새 권한 검증을 했다고 주장하지 않는다. 후속 문서 harness/memory·diff 검사, 최신 main fast-forward 조건, Workers Builds 새 SHA 및 운영 실제 JS/동작은 release 증거로 남긴다. QA는 기존14일/용량 정책으로 보존한다.

출시 검사 후속: 전체520원화 검사의 실측5.25초가 기본5초를 넘으므로 해당 단위 한 건에만30초 제한을 명시했다. 전역 timeout/CI 정책/제품코드·검사 기준은 바꾸지 않았다. 기본 명령의 독립 재검사 결과와 후속SHA의 원격 quality/Workers Builds 결과를 같은 release 증거에 남긴다.
