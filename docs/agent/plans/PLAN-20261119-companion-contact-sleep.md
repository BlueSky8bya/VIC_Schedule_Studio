# 커튼·불 점프와 수면 인상 교정

상태: 승인한 수면 눈을 보존하고 입 애니메이션까지 구현·검증·독립 코드 검수를 마쳤다. 소유자는 2026-11-20 점프 교정과 수면 입 애니메이션의 커밋·푸시·배포를 직접 승인했다. 기준 origin/main `63ecc14a7e10aea2bcaafafc9af958e8bcdceb68`. 기본 모습은 그대로 보존했다. 아래 배포 전 기록은 각 당시 상태이며 최신 승인으로 출시 단계가 이어진다.

사용자 요청: “그럼 기본 모습은 그대로 두고, 점프할 때 뚱뚱해지는 거랑 수면 때 어벙해 보이는 거 둘 다 고쳐서 전후 비교 보여줘.” 앞선 두 진단에서 커튼·불 접촉의 가로1.08/세로.9259와 수면 호흡의1.036269/.965, 수면 얼굴의 깊은 감은 눈·작은o입·접힌 귀/웅크림 조합을 관찰했다. 귀여움의 판단은 사용자에게 있으며 수치 통과로 시각 승인을 만들지 않는다.

## 범위와 구현

- 기본 얼굴/몸/귀/모자와 역사 원본은 유지한다. 수면native11/78에만 얕고 부드러운 감은 눈과 작은 닫힌 미소를 적용한다. 다른 감은 눈·쓰담13B/15B·헤롱눈·입 의미는 유지한다. 공통painter와 현재appearance pipeline으로만 파생한다.
- 커튼·불의 유효한 실제 접촉 중에는 손 뻗는row9 그림에 섞이던 bow/pounce의 압축·기울임을 제거한다. 실제reach 높이/속도로 같은pompom을 구동하되 이 접촉의 재질 반응은 작은 세로 늘어남까지만 허용하고 가로 팽창은 막는다. 일반 이동 점프/착지/입력/접촉 증명/시간/위치는 보존한다.
- 수면 호흡의 세로 압축과 회전을 작게 낮추며 reciprocal 면적 모델과 reduced/off를 유지한다. viewer/studio/preview/anonymous는 기존 공유 렌더러 한 경로다.
- 서버·권한·공개DTO·RLS·DB·KST·의존성·실제 활동수집 변경 없음. G22는 자율 그림/재질 교정이며 사람target·레이블·타임라인·최소사용집계 계약을 유지한다.

## 검증과 전달

기준 패킷·소스 SHA와 before를 제품 수정 전에 `.scratch-pw/contact-sleep/`에 고정한다. 같은 셀/크기/테마/진행의 실제 공통 렌더러 전후, 기본 모습 정확 일치, 수면 외520셀의 보호 범위/alpha와 다른표정/귀·몸·모자, 커튼·불 실제 입력과 접촉/일반·집안 수면/공유 표면을 확인한다. 수면 얼굴 변화는 눈·입에만, 재질 변형은 실제 뜀/수면 상태에만 제한한다.

typecheck/lint/관련·전체unit/build/harness와 production-build 고정fixture를 실행한다. fixture는 loopback과 dummy 환경, API/쓰기/외부fetch 차단으로 운영DB 연결 없이 사용한다. 커밋되지 않은 사용자 작업은 원프로젝트에 남기고 새worktree에서만 작업한다. 전후 PNG는 `runs/<회차>/before-<ID>.png`와 `after-<ID>.png`를 실제 `<img>`로 보여주며 결과를 Hub에도 보존한다. 실패·미확인/실제기기·로그인RLS·자연생활36은 보존한다.

## 2026-11-20 로컬 교정과 보호 검사

수면은native11/78의18셀만 변경했다. 얕은 아래곡선 감은 눈과 작은 닫힌 미소이며 접힌 귀/웅크림/기본0과수면 외502셀은 그대로다. `pixel-proof.json`:502셀 exactRGBA 동일, 전체alpha변화0/눈·입 주변faceROI밖RGB변화0. 원본·비수면·귀/몸/모자 변경 없음. 최초 검증기에서 뒤통수5셀에도 얼굴anchor를 요구해 실패한 로그를 남겼고, 타겟수면은anchor필수/비수면은exact검사를 유지하도록 바로잡았다. 제품이나검사조건을실패회피목적으로낮추지않았다.

`pipeline.log`/`build-before.log`/`build-after.log`/`typecheck.log`/`lint.log` exit0. 고정fixture9PASS/0SKIP/0unexpected/0flaky:viewer/studio/preview 각각커튼·불 실제접촉과5초이상수면호흡을확인했다. 접촉 중CSS가로최대1.08→1.00, 실제reach구동pompom[-.06,0]이며 손잡이효과/15px이상상승유지. 두수면의호흡한주기이상실측가로최대약1.0362→1.00502. 실제값은`.scratch-pw/contact-sleep/before/after`의native입력/읽기전용프레임증거다. 원본PNG추출은실제채택된atlas와검사로같은192px셀에고정했다.

실제기기/로그인RLS/자연생활36은미확인. 동작전후캡처는같은fixture·폭·방영역·테마의자연동작이며정확히동일한프레임시각/포즈인증은아니다. 원화전후는같은셀/크기/테마이고기본PNG는바이트동일을확인했다. 사용자에게보일교정한번을만들었으며추가미적변형/자동전문재검수는하지않았다.

최종전체단위 `unit.log`:472파일/7,345PASS/1SKIP/0FAIL,기본시간제한·worker1,exit0. 전후P1커튼/P2불/P3수면은 `.scratch-pw/contact-sleep/runs/20261120-contact-sleep/`의 `before-JUMP-CURTAIN.png`/`after-JUMP-CURTAIN.png`, `before-JUMP-LIGHT.png`/`after-JUMP-LIGHT.png`, `before-SLEEP.png`/`after-SLEEP.png`다. 기본0PNG바이트동일과18수면전체확대도있다. 생성자가두비교PNG를직접열어기본유지·감은눈/닫힌미소·실제동작변화를확인했다. 1040/390폭6보고서검사깨짐/가로넘침0이다.

Hub 보존: `C:/Projects/context-hub/out/vic/20261120-contact-sleep-01a1f30e/index.html`, 같은폴더 `runs/20261120-contact-sleep/proof.json`과evidence. 최종harness결과도검증로그로보존한다. 자기fixture서버종료/3199 LISTEN0,원프로젝트dirty/main은그대로이며추가worktree의미커밋후보를사용자비교용으로유지한다. 아직커밋/푸시/운영배포하지않았다.

## 후속 사용자 요청 · 수면 입 애니메이션

사용자 “잠자는 모습에 눈은 수정후 좋은데 입은 실선이랑 이전 동그란 입 번갈아가면서 하듯이 애니메이션 만들어줄 수 있어? 그럼 더 잘 어울릴 것 같아”와현재전후그림첨부. 수면 눈만 시각 승인한 범위로 고정하며 입을 닫힌 선/미소와 예전 작은o형 사이에서 천천히 호흡에 맞춰 바꾸는 구현을 이어간다. 일반267·집안519모두, 기본0·점프수정·귀/몸/기존눈은 유지한다. 이는 새 실제 사용자 요청이며 이전 교정1회 제한을 자동 반복하는 것이 아니다. 새 시각/움직임 검증이 필요하며 위 정적 후보의 PASS를 새 애니메이션 PASS로 재사용하지 않는다.

최초최종harness는새시작목록행때문에brief8306/8192로실패했다. 기존결정은남기고이번두목록행만짧게정리했다. 최초실패로그를별도로보존하고새최종결과를기록한다.

## 수면 입 애니메이션 구현 · 2026-11-20

일반267·집안519와 같은 native11/78의18수면셀에서 현재 닫힌 선/미소를 예전 작은o(`open=.18`)까지 한 contour로 보간한다. 기존4.8초 CSS 호흡의 실제 currentTime을 기존 paint에서 읽으며 닫힌 구간을 두고 천천히 열고 닫는다. 새 RAF/timer·원화·네트워크·의존성은 없다. 입 전용 불투명 영역만 복원/합성하고 승인된 눈·입 밖 RGB·전체alpha는 원본 바이트 그대로 복원한다. 다른 표정과 기본0에는 이 경로를 허용하지 않는다. 움직임 OFF/soft/감소와 모달 중에는 기존 정적 원화를 쓰며, 이미 paint가 멈춘 parked/숨김 상태를 새 시계로 깨우지 않는다. 자율 얼굴 변화이므로 G22 사람 행동/메타데이터/집계는 바꾸지 않는다. 서버/역할/공개DTO/DB/KST 변경도 없다.

관련단위82건 통과. 첫 실행의 두 실패는10ms표본이정점2112ms를정확히포함하지않은단언과기존AST검증기의옛eye-map식고정이었다. 정점직접검사·연속성검사를남기고표본최대만.9999이상으로검사했으며, 기존보호검증기는새분기의일반표정경로를실제소스에서계속컴파일하도록갱신했다. 최초실패로그는`mouth-unit-first-fail.log`에보존했다. `mouth-rig/proof.json`은18셀×5진행90장 모두 paint 성공, 눈영역/입밖RGB/alpha변화0·기본0거절을확인했다. `mouth-capture/`는production-build의실제입력으로시작한일반/집안수면의표시합성캔버스를추출한프레임이며의도적으로시계를조작하지않았다. 새애니검증은이기록과`mouth-*`로그만을근거로삼는다. 정적후보의이전전체7345PASS/1SKIP·실물9PASS는별도이력이다.

최종 후보는parked/숨김/pause/stopped에서입을새로그리지않고정적원화로돌리는조건도포함했다. 이후재build/typecheck/엄격lint/appearance doctor exit0. 최신production-build `mouth-runtime.json`:14PASS/0SKIP/0unexpected/0flaky(151.95초)이며일반/집안입움직임과입밖픽셀보호2건,OFF/soft/감소정적입3건,viewer/studio/preview의커튼·불접촉/수면호흡9건이다. 첫실물4실패는수면종료후캡처·표시하지않는합성canvas가정·quiet에서도519강제한테스트설정때문이었다. 최소4.8초관찰·원본alpha/입밖RGB검사는유지하고실제수면시간/실제표시canvas/quiet의267또는519를검사하도록수정했다. 첫실패JSON/trace를보존했다.

## 출시 승인 · 2026-11-20

소유자 “좋아. 지금 수정한 점프랑 수면 입 애니메이션까지 커밋하고 푸시해서 배포해줘.”가 앞선 미배포 범위를 대체한다. 비작성자 코드 검수는 역할·서버 경계·KST 불변, 기존 시계/quiet/parked 정책, 공통 화면과 눈·alpha 보호 및 현재 SHA에 묶인 QA 증거를 확인했고 결함 없음으로 판정했다. 미적 재검수나 실제 기기/RLS 검증으로 확대하지 않는다. 원래 dirty main을 건드리지 않고 현재 브랜치의 검증된 묶음만 원격 main으로 fast-forward한다. Cloudflare Workers Builds를 사용하며 로컬 직접 배포는 하지 않는다. 정확한 커밋/배포 상태/운영 화면 확인과 작업 폴더 정리 결과는 Hub `C:/Projects/context-hub/out/vic/20261120-contact-sleep-01a1f30e/release.json`에 남긴다.

최신실제캡처는`mouth-capture-final/`이며일반·집안기본0PNG둘다입애니전정적후보의동일캡처와바이트정확일치했다(원본패킷의기본0보존검사와별개). `runs/20261120-sleep-mouth/sleep-mouth-before-after.gif`는왼쪽눈승인본의정적닫힌입/오른쪽새입움직임,위일반/아래집안으로4.8초반복한다. 실제표시프레임을기록된CSS호흡시점으로각각정렬했고가짜시계를쓰지않았다. origin/main의교정전과최신결과는같은크기·셀·테마의`before-SLEEP-MOUTH.png`/`after-SLEEP-MOUTH.png`로따로남겼다. 전회커튼·불보고와함께Hub `C:/Projects/context-hub/out/vic/20261120-contact-sleep-01a1f30e/`에보존한다. 보고서1040/390폭깨진그림·가로넘침0을직접열어확인했다.최종harness8181byte/455문서/exit0,자기fixture서버종료·3199LISTEN0이며결과manifest와실제프레임을Hub에보존했다. 원프로젝트/main은건드리지않았고worktree미커밋후보를유지한다. 실제기기·로그인RLS·자연생활36은미확인,통합독립검수/커밋/푸시/배포는하지않았다.
