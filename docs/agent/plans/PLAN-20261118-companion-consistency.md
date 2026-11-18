# 빅타민 모습 일관성 — 2026-11-18

직접 요청: 정지·달리기 기준의 귀여운 비율/눈 선 굵기, 눈·입 잔상 제거, 쓰담 눈웃음, 귀4분할 전 동작 적용, 모자12종×접힌 귀/쓰담 겹침, 몸 밖 잔여 파티클 정리. 첫 뾰족 왕관 시안은 거절됐고 붉은 벨벳·금아치·보석 띠·십자가 있는 참조를 반영한다. 초기 두 포즈 시제품 한도와58개 불명확 눈 태그 후속은 이번 직접 요청에 따라 전체 적용으로 대체됐다.

## 현재 구현

- 원본은 유지한 채60고유 native 키를 측정하고115의 원래 비선형 역샘플로520셀에 body/주황뿌리/주황끝/노랑뿌리/노랑끝을 분할했다.33개 새 lossless WebP와 strict parent path+SHA 파생판을 사용한다. 행/열/등록/clip은 유지한다.
- 모자12종에서4귀→몸+현재얼굴→모자→접힌 앞귀 순서를 native-scale 단일canvas로 조립하고 한번 축소한다. 프로펠러 rear rotor 포함. viewer/studio/preview·옷장·초원이 공통 painter를 쓴다. 분리 CSS 레이어의 축소 틈을 제거했다.
-509얼굴은 정지 눈 reference의 크기/선·입 형태로 교정, 얼굴 없는11셀은 유지. 눈 상태는 원화별 open/closed/wink-orange/wink-yellow/sad-closed/squeeze/cry/spiral/back으로 고정한다. 변수 bbox로 재분류하지 않는다. 의도된 윙크/슬픔/빙글눈은 보존한다.
- 표정은 양눈 admission 후 옛 눈·입을 정수 inclusive 지우기로 제거한다. 쓰담은 후속 사용자 지적으로 더 깊고 둥근 ‘헤헤’ 아치와 작은 미소를 쓴다. 실제 petted 중에는 같은 melt 얼굴을 유지하되 유한 owner/보상/만료와 reduced/off/soft 의미를 유지한다.
- 눈/입 잔선과 몸 밖 export 잔여464,164픽셀을 정리했다. 의도된 종잇장 접힘선/감정 기호는 보존한다. 새 canonical mouth를 frame별 저장해먹기 좌표를 맞췄다.
- 몸/접촉/착지/관성의 절대 합산 strain 예산log(1.08)을 CSS/입/소파/잡기/옷장/초원이 공유한다. 원화 전체를 외곽 상자로 강제 정규화하지 않는다.
- 늦은 모자 준비 사이 몸 패킷이 LRU에서 빠진 경우 readiness event에서 기존 bounded decoder로 회복한다. generation으로 clear/새 포즈 뒤 옛그림 부활을 막는다. retained3/inflight2는 유지하고 추가 RAF/폴링/전체 preload는 없다. 새 packet decoded 최대4.7MB로 기존2.36MB보다 최대2배다.
- 왕관4방향 새SVG는 붉은 벨벳 돔·금색 아치/백합·보석 띠·십자가다. 기존111과 거절 시안은 보존하고 새 시안의 사용자 승인으로 기록하지 않는다.

## 경계

서버/DTO/권한/KST/이동 목표/보상/발견/활동 수집 규칙은 바꾸지 않았다. G-22 타임라인/적게 쓰인 기능에 새 사용자 행위를 만들지 않는다. 자율 눈/몸 변형은 집계 이벤트가 아니다. 실물 검사는 credential-free production fixture와 차단된 쓰기/API를 사용한다. 방송PC/OBS와 자연생활36개 전체 검증을 대체하지 않는다.

## 증거

[재현 도구/계약/후속 확장](../../../scripts/companion-consistency/README.md). 결과: worktree `.scratch-pw/companion-consistency/full/runs/20261118/index.html`. 같은 화면/크기/테마의 before/after를 실제img로 함께 표시, 전 origin/main e9c48f6e / 후 작업본.60고유원화×12모자720착용 독립검수.520×12×양방향12,480조합/판의 shared painter 검사 통과. 모자 predecode geometry와 live readiness/performance 범위는 구별한다.

새5개 appearance 단위검사는33패킷 출처/해시/크기,520등록/41행,4슬롯/눈 의미, 전셀 재조립을 검증한다. 겹침/누락/alpha/가시RGBA 불일치0. alpha0 RGB만정규화한다. readiness 독립회귀3/3:늦은hat+LRU복구,복구중clear,새pose우선. 독립 검수가 찾은 가변 눈 태그/한쪽윙크,spiral/sad 의미,AA틈,초원 누락,입좌표,늦은hat 회귀를 수정하고 재검사했다.

초기 단계86단위/13실물/6장기hover와 두 포즈 ear-lab은 역사 증거이며 새 전동작판 검증으로 포장하지 않는다. 최신 검증 결과는 아래에 갱신한다.

## 검증 결과

- typecheck,production build,변경파일 전체ESLint,git diff --check 통과.
- 전체429단위 파일:7,002 PASS/1 SKIP. 기본5초 제한으로 기존133 asset-script와agent-memory 검사가 부하중 timeout된 실행은 보존. 동일 assertion으로 `npm run test -- --maxWorkers=2 --testTimeout=15000` 재실행해전체통과(37.64초). 검사를삭제/약화하지않았다.
- production 실물41개:36표정×3단계/포즈 fixture1,viewer/studio/preview keyboard·pointer 쓰담6,viewer12모자쓰담12,옷장15(세표면교체/벗기기3·viewer/studio전체착용2·밝음/어두움3표면6·reduced/off/soft/disabled4),초원왕관쓰담1,장기hover6. 오류/예상밖요청0. readiness수정 뒤 새build에서왕관/베레모쓰담2도재통과(41개고유범위에중복실행은합산하지않음).
- 초원 신규검사는 기본30초 timeout 뒤90초 예산으로 동일36회입력/픽셀검사 통과(54.5초). actor/시계/RNG/position주입없음. headless성능을실제방송PC 성능으로주장하지않는다.
- 독립 소스/시각 검수:60×12착용 전부확인. 무착용 source와crop 재조립의가시RGBA/alpha일치0오류,실제92px CSS조립AA의소수RGB차이0–7은남으므로pixel-identical 렌더주장하지않는다. native62이마의시무룩표식은원본의의도된기호로확인했으며잔상과구분한다.
- 전체 lint는 기존 cloudflare/worker.ts:12 anonymous default export 경고1건으로 실패. harness는 기존 CURRENT_STATE의종료OPS-VERCEL-QUOTA active entry로실패. 다른작업항목은변경하지않았다.

로컬 branch `codex/companion-consistency`, worktree `C:/Projects/VIC-worktrees/20261118-companion-consistency`에 미커밋 보존. 커밋/push/배포하지 않았다. 원경로의 다른 사용자 변경은 보존했다.

## 후속 직접 지적 — 현재 v3 (2026-11-18)

앞선 작은눈판은 사용자 반려. 정지눈 평균+quarter중복축소를폐기하고변경전달리기304원본을실제눈/질감기준으로고정했다. 쓰담감은눈stroke1.15배. 역사gate에서빠진회전6셀도등록해515얼굴/5뒤통수로정정. original pupil주변cream/볼을복제하지않는투명glyph+경계일치faceplate로네모바탕을정리했다.

사용자가말한갈매기입은3을오른쪽90도돌린ω모양. frozen native27/28원본에있지만이전M.smile고정bake에서U로사라진회귀확인. native mouthState=cat와실제두곡선분기를추가해복원했다. N0/N2/N71/N74는원래U미소유지,붉은입들도임의cat변경제외. source/current/복원SHA·사진은 `.scratch-pw/mouth-audit/final/`.

몸runtime만면적보존해도frozen rig/fit에구운몸크기출렁임은남았음. 같은native의귀/분리기호제외alpha면적만uniform보정(배율.9686~1.0333). 모든face/입/모자/운반/접촉landmark에같은affine,clip은oldguard보다좁히지않고새alpha포함. 목표면적오차최대.916%,모든native최종면적폭최대1.242%,기존native8의9.523%폭→.844%. 이는깊이고정2D겉보기면적검사이며3D부피인증이아님.

새 [현재 계약](../domain-rules/COMPANION_APPEARANCE.md)·[조사/채택 근거](../research/COMPANION_APPEARANCE_PIPELINE-20261118.md)·단일pipeline명령을도입. 같은입출력hash확인후cache hit에서renderer/packer0회실행을실제로확인. 모자-only몸재생성0회와입력중간변경cache확정금지. crop별크기+RGBA SHAalias로중복포장정리,현재33packet18,264,890bytes. 캐시가QA PASS를자동승격하지않는다.

최신독립검수:648뜬눈의큰축소재발/소실0,515실제painter얼굴alpha변경0,ω2원화복원및U대조군확인. 기존원본·반려눈판보존. 최신전후보고 `full/runs/20261118-running-eyes/index.html`의baseline은실행당시origin/main(현재proof에fullSHA기록);이전e9c48f6e보고와별개다. 최종검증: typecheck/production build/변경파일전체ESLint/git diff --check 통과. `npx vitest run --testTimeout=15000 --maxWorkers=2 --reporter=json` 전체7,010PASS/1SKIP(431파일). npm run을통한앞실행은옵션이전달되지않아기본5초timeout2건을냈으며기록을보존한다. 동일assertion을직접Vitest실행해통과.

새production React실물35개+장기hover6개=41개통과(예상밖오류/실패0). 실제입력12모자쓰담,세표면keyboard/pointer,36표정fixture,옷장교체/벗기기·밝음/어두움·reduced/off/soft/disabled,초원왕관쓰담포함. 모든source geometry12,480조합/판·late readiness3회귀도재통과. 결과 `unit-final.json`, `live-final.json`, `long-pet-final.json`, `full-final.log`, `readiness-final.log`.

새report before baseline fullSHA는 b219562b0af312dc4cee57e9bb20b4be61c4518b(origin/main 실행시점), 후는현재v3. 기존전체lint의cloudflare/worker.ts경고1건·harness의OPS-VERCEL-QUOTA closed active entry는이전그대로실패. 로컬미커밋/미배포이며원경로다른사용자변경보존.


## 후속 직접 지적 — 둥근 ‘헤헤’ 쓰담 눈웃음 (2026-11-18)

사용자 원문은 [조사 기록](../research/COMPANION_APPEARANCE_PIPELINE-20261118.md#쓰담-헤헤-눈웃음--후속-직접-요청)에 보존. 온화하고 뿌듯해 보이던 쓰담 아치만 더 깊고 둥글게 바꿨다. 공통 policy `.76`으로 실제 아치 솟음 `.22h→.42h`; 폭/눈 크기/쓰담 선1.15배 유지. source9의 정적16셀과 실제 melt에 같은 값 적용, 기존 weight로 곡률도 진입/복귀 보간. 다른 표정/ω 원화/몸/귀/모자 코드는 이번 수정으로 바꾸지 않았다.

- 원본과 지적한 직전판은 별도 보존. `.scratch-pw/companion-consistency/hehe/runs/20261118-petting-hehe/index.html`에 동일 화면1000×660·밝은테마·같은자세/진행.5의 current-before/after와 origin/main-before/after PNG를 모두 실제 img로 표시.192px 확대/92px 실제 크기 포함. SHA와 범위는 옆 `proof.json`.
- 새 pipeline plan/doctor/build/verify-eyes 통과.515얼굴 재생성/5뒤통수 유지,33packet18,268,742bytes.648뜬눈 기준 검사 통과. 새 픽셀 비교5,006건: alpha·기존 얼굴 허용영역 밖 변화0, 정적 변화144..159만, 비쓰담 대조변화0. source9 전환에서 기존 얼굴 피부 보간값도 달라지므로 얼굴 내부의 모든 피부 픽셀까지 동일하다는 주장은 하지 않는다.
- 새 typecheck/production build/변경파일ESLint/diffcheck 통과. 전체 Vitest7,010PASS/1SKIP(431파일). 전체 lint는 이전부터 있던 cloudflare/worker.ts:12 경고1건으로 실패. 첫 verify의 엄격 metadata 기대값에는 새 policy키가 없어 실패했고 계약값 갱신 후67건과 eye-audit를 재통과했다.
- fresh production 실제 입력19건(36표정 fixture1,세표면keyboard/pointer6,12모자쓰담12),장기hover/reduced/off/soft6건,옷장15건·초원1건까지 총41건 통과. 오류/실패/재시도0. 증거는 같은 hehe 폴더의 `live-final.json`, `long-final.json`, `static-final.json`. 보고HTML도1440/390폭에서4개PNG 로드와 가로넘침0 확인.
- 독립 UX/QA 읽기 전용 검수: 차단 결함 없음. 곡률 보간·양눈/92px·다른표정·pixel/live 증거 확인. 실제 OBS/기기 성능과 사용자 시각 승인은 별도.
- G-22: 얼굴 그림만 변경. 기존 쓰담 target/이름/입력·활동기록/최소사용집계 의미 불변을 확인했으며 자율 표정에 새 인간행동 로그를 만들지 않았다. 공개 DTO·권한·unlock·KST·DB·decoder한도 불변. 이번에도 커밋/push/배포하지 않는다.
- 문서 harness는 기존 `OPS-VERCEL-QUOTA` closed 항목이 active index에 남은1건으로 실패. 이 세션이 초래한 CURRENT_STATE byte상한 초과는 해당 작업행을 줄여 해소했다. 다른 운영 작업의 상태/행은 변경하지 않았다. 실물 검증용3197서버는 종료하고 기존 worktree와 미커밋 결과를 보존한다.


## 사용자 승인·남은 gate 정리 (2026-11-18)

사용자 원문: “좋아, 이 표정으로 하고 남아 있는 lint랑 문서 검사 문제도 고쳐줘.” 쓰담 ‘헤헤’ 표정만 시각 승인으로 기록. 현재 승인된 곡률/이미지는 다시 수정하지 않았다. 왕관 등 다른 그림이나 커밋/push/배포의 승인으로 확대하지 않는다.

- `cloudflare/worker.ts`의 익명 default object를 `const worker` + `export default worker`로 명명해 ESLint 경고를 없앴다. fetch/DO export·cron 경로·인증·waitUntil 동작은 동일하다.
- `OPS-VERCEL-QUOTA`의 superseded행을 활성 목록에서 제외하고 다음 단계 참조를 `OPS-CLOUDFLARE-MOVE`로 정리. 과거 관측 수치/미확인 한도·비용 증거와 대체 관계는 기존 FLUID_HIDE 주제 기록에 보존했다. Vercel의 실제 제한 해소나 새 외부 작업을 주장하지 않는다.
- 후속으로 드러난 briefing8192byte 초과는 CURRENT_STATE의 중복 문구를 줄여 해소했다. harness 코드/한도/검사 강도는 바꾸지 않았다.
- 이번 범위에서 전체 lint, typecheck, production build, harness386문서 검사, 관련 memory/cron 단위21건, Worker 격리 smoke가 통과했다. smoke는 생성 OpenNext 모듈 대신 합성 handler를 써 fetch/DO identity, 알 수 없는 cron/누락·빈 비밀 차단, 지정·기본 origin과 Authorization/waitUntil을 네트워크 없이 검사. 실제 Cloudflare 배포 검증은 아니다.
- 증거: `.scratch-pw/companion-consistency/hehe/gate-cleanup/`의 lint/typecheck/build/tests/worker-smoke/harness 로그. 위 절의 기존 실패는 역사로 보존하고 이 후속 결과로 대체한다. 커밋/push/배포 없음.


## 커밋·브랜치 발행 승인 (2026-11-18)

사용자: “좋아, 이번 빅타민 수정사항이랑 lint·문서 정리한 내용 커밋하고 푸시해줘.” 이번 구현/파생 에셋/도구/검사/문서와 Worker lint 정리만 커밋하고 `codex/companion-consistency` 브랜치로 발행한다. 원격 main은 별도167커밋이 진행됐으므로 검증한 기준c1a72506을 임의 재배치하거나 main에 병합하지 않는다. push 직전 origin/main은684e16e1이며 실제 배포 검증/승인으로 확대하지 않는다.

최종 읽기 전용 독립 검수는 Worker 동작 불변, 문서 lifecycle/증거 보존, 변경116파일의 범위와 미추적 텍스트/추가줄 비밀 패턴0을 확인했고 차단 결함이 없었다. QA 산출물과 환경 파일은 커밋에서 제외한다. 커밋 trailer에는 실제 세션ID를 남긴다.

브랜치 push 확인 후 worktree 정리 규칙에 따라 이 임시 worktree를 제거한다. 로컬 QA `.scratch-pw/`는 먼저 원프로젝트의 `.scratch-pw/companion-consistency-release-20261118/`로 보존하며 기존14일보존정책을 따른다. 최신 전후 보고는 보존 경로 아래 `companion-consistency/hehe/runs/20261118-petting-hehe/index.html`이다. 원프로젝트의 다른 사용자 변경은 건드리지 않는다. 실제 commit SHA/원격 대조와 정리 결과는 로컬 인계에 남긴다.


## 최신 main 통합·배포 승인 (2026-11-18)

사용자 “문제 없이 푸시 하고 배포까지 해”로 main 통합/push/실제 배포까지 승인했다. 초기 브랜치1c5deb0dda27cfd34206da0a09f5db11c45ae42f 발행 뒤 최신 main684e16e1 위의 codex/companion-release-20261118에서 변경 커밋만 cherry-pick해9충돌을 해결한다. 다른 사용자 원프로젝트 dirty 변경은 제외한다.

- main의 익명홈 캐시·1분/인사이트 cron·victory-broadcast.com·기존 접촉·깜빡임·모자 가림/cache를 보존. blink numeric과 native options를 공통 painter에서 함께 지원하고, canonical 현재 셀 눈 크기/실제 baked입 baseline을 사용한다. 입밑 cubic/저강도 혀 연속성 유지. 한눈커버는 동일 throw camera500..507의 실제필요최대폭으로 고정해coverage축소없이맥동을없앤다.
- 새 source0 입 중심과 raw anchor 차이를 독립 검수가 확인했다. 실제canonical입 영역만붉은입교체예외로 허용하고 주변orange볼을 보호한다. 관련unit기준을약화하지않았다.
- latest main에 있던 SVG 왕관5개의 lint 경고는 같은class/src/기존CSS치수/eager 로드를 유지한 unoptimized Next Image로 정리한다. React hooks/state권한·추가상시루프·데이터수집은변경하지않는다.
- 정리 사고: 앞 worktree의 node_modules junction을 Git worktree remove가 따라가 원프로젝트 설치패키지를 지웠다. 원프로젝트 npm ci로633개 고정패키지복구, package.json/lock SHA불변·npm ls/주요패키지로드 확인. 소스·비밀·사용자아트는변경안함. 새 worktree는자체631개패키지설치이며junction없음. 앞으로정리전junction을반드시제외한다.
- 배포는 기존 Cloudflare Workers Builds의 GitHub main 연결만 사용. 로컬 cf:deploy/비밀이동/DB마이그레이션 없음. 통합후 전체gate와 실제production fixture 및 deployedSHA/asset/화면을 확인한다. 이전브랜치PASS를통합판PASS로복사하지않는다.


### 통합판 최종 로컬 검증

최종7244PASS/1SKIP(463파일),production fixture35+장기hover6=41PASS(실패/재시도0),SQL계약5PASS. typecheck/전체lint/production build/harness449문서/diffcheck 통과. 추가 blink27픽셀검사에서 alpha·canonical입RGB변경0; broad eye corridor가 입을 지우던 회귀는 명시적 보호와 새 unit으로 막았다. 독립 role/boundary/UX/QA 검수 차단 결함 없음. full12480조합/판·eye648·readiness3도 통과했다. 실제 방송PC/진짜로그인권한/자연생활36전체 증거로 확대하지 않는다.

새 증거는 release worktree `.scratch-pw/companion-release/`의 unit-passed/live-passed/long-passed JSON, build-final/typecheck-passed/lint-passed/harness-passed/sql-contracts 로그와 blink-proof PNG/JSON. 같은 화면 전후는 `.scratch-pw/companion-consistency/full/runs/20261118-running-eyes/`에 origin/main684기준으로 보존했다. 운영 전 익명뷰어도 실제JS에서684fullSHA 확인·실제키보드쓰담 확인, production-before JSON/production/before-viewer.png 보존. 운영후 확인은 main push/Workers Builds 완료 뒤 별도 시행한다.
