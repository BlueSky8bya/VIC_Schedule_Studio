# 볼·수면·끊긴 얼굴 교정 — 2026-11-19

현재 상태: 잔상 교정과 사용자 최종 선택13B·15B 적용 완료. 선택반영의83단위/5production-fixture/typecheck/lint/build/document 검사 통과. 후속 직접 요청으로 커밋/push/배포가 승인돼 최신 main 통합·출시 검증 중이다. 최신결정·증거는 마지막 ‘출시 승인’ 절이다. 이전 후보/실패/승인은 당시 범위로 보존한다.

사용자 현재 요청: 볼 붉은 장식보다 눈을 위에 합성, 첨부 수면 아이콘처럼 감은 처진 눈+작은o입, 검수41울음/43윙크의 끊긴 입·눈물 수정.13반김/15쓰담은 여러 아이콘을 조사해 대안만 제안한다. 이전 쓰담 승인(.76)은 대안 선택 전 유지하며 공통 레이어 교정만 적용한다. 커밋/push/배포는 이번 요청에 포함하지 않는다.

기준main1ebbcfc2. 원프로젝트dirty를 보존하고 `C:/Projects/VIC-worktrees/20261119-companion-face-layer-sleep`/`codex/companion-face-layer-sleep`에서 작업한다. 원본과 기존 눈/입 크기·귀·몸·모자·헤롱눈 원형은 보호한다. 참고파일/SHA와 실제 원문은 ignored `.scratch-pw/face-correction/request.json`에 기록한다.

원인: 공통 painter가 눈·입을 그린 뒤 볼의주황RGB를 되돌리고, 새 선도 배경복원 영역에 가둔다. 실제 얼굴 잉크를 별도 투명면에 그려 볼보다 위에 합성하되 기존 전체alpha를 보존한다. native울음은 같은source의눈물색을 복원해 눈 주변 수리로 잘린 부분을 잇는다. native11/78수면만 편안하게 처진 감은 눈과작은o입으로 구별하며 하품·쓰담은 별개다. 현재 공통pipeline으로 파생을 재생성한다.

서버/공개DTO/권한/RLS/DB/KST/시간·입력·활동수집/의존성 변경 없음. G22는 자율 얼굴그림 보정이며 사람target·레이블·타임라인·최소사용집계 의미 불변. viewer/studio/preview/옷장은 같은packet/painter를 사용한다.

검증: 배경·볼·얼굴잉크 합성/alpha보존 단위, 동작60원화와상황36/포즈/진행의실제공통렌더러, production fixture수면·옷장·쓰담, 타입/lint/관련·전체단위/build/harness. 원화SHA와몸/귀/모자/13·15형태값을 확인한다. 같은화면·크기·테마 before/after PNG를 `.scratch-pw/face-correction/runs/20261119-face-correction/`에 저장해 사용자에게보인다. 실제기기/로그인RLS/자연생활36은별도미확인. 시안이므로 사용자시각승인이나출시성공을선행주장하지않는다.

첫 focused 검사는 pipeline 패킹 중에 겹쳐 packet SHA 한 건이 불일치했다. 소스/검사 기준은 바꾸지 않고 파생 완료 후 재검사하며, 최초 실패 로그를 보존한다.


## 후속 잔여물 지적과 전체 확인

사용자 “43번 아직도 입 위에 인중 부분에 뭔가 있어보이는데? … 눈이나 입 주위에 … 박스 잔상 … 모든 표정 다 확인”을 같은 작업에 반영한다. 처음 시안의 잔여 결함을 해결 완료로 부르지 않는다. 원인: wink의 붉은 옛 입이 기존 dark-component bounds 밖으로 나가 최종 볼 보호에서 되살아났고, 눈·입의 깨끗한 종이까지 사각형 전체를 보간했다. 새 얼굴선은 유지하면서 옛 잉크와 그2px AA 주변만 수리해 나머지 종이 질감은 정확히 유지한다. 울음16프레임은 과거 mouth=null이므로 원본의 실제 붉은 입 영역을 측정해 override로 등록한다. 눈물은 원래 물방울과 눈가가 끊기지 않게 연결한다. 모든520원화, 상황36×3포즈×3단계=324장면/판을 대조한다.

최초 전체단위469파일7319PASS/1SKIP은 첫 시안 소스의 결과이며 이후 교정의 완료 증거로 확장하지 않는다. lint에서 기준main의 새 설정검사 두 unused 변수를 발견해 실행 의미 없이 정리한다. 규칙/검사 기준 약화 없음. QA보고서 최초에는 전체RGBA숫자 직렬화가 커 중단했고 PNG전송으로 바꿨다. 실패 로그/첫 시안/후속 원문·첨부를 보존한다.


고정 검수용 전체 Next 서버 시작이 자동 승인 검토의 “정책 차단”으로 거절됐다. API/POST/일반화면을 Next 진입 전 차단하고127.0.0.1에만 붙는 고정fixture3개·정적파일 전용 서버로 좁혀 실행했으며 외부fetch도 금지한다. compiled36×3포즈×3단계와 실제 viewer/studio/preview Enter쓰담은 통과했다. 최초 낮잠 검사는 집 안 cozy수면인데 일반267만 기대해 실패했다. 실제sleep/cozy/519를 확인하는 정확한 기대로 수정해 해당 건만 재검사하며 실패를 보존한다. 전체단위에서 과거override6개만 기대하는 모자검사 한 건이 새울음mouth16등록을 반영하지 않아 실패했다. 원화/geometry 기준은 유지하고 실제22등록 목록으로 갱신해 관련 검사와 전체를 확인한다.

## 인계 후 전체 잔상 교정

첫 확대 감사 FAIL은 보존한다. 사각 Coons 보간의 가장자리 샘플이 남은 눈/AA색을 행 전체에 끌어온 것이 양눈 사이 수평선의 직접 원인이었다. 불규칙한 옛 잉크+AA2px만 실제 주변 종이에 연결하는 harmonic fill로 대체했다. 깨끗한 종이의 바이트와 alpha는 보존한다. 사각 경계의 안쪽만 보는 대신 원본의 바깥2px 잉크도 확인해 경계 AA를 놓치지 않는다. 눈/입 패치를 따로 원본에서 복원하면 겹친 입 패치가 지운 눈 일부를 다시 가져오므로 합집합을 한 번 복원한 뒤 기존 허용 영역과 볼 보호를 적용한다. 거의 감긴 눈동자는 마지막 납작한 띠를 남기지 않게 연속으로 흐린다. 원본 셀별 배경 캐시는 약한 참조와24개 상한이다.

material-source의 raw114 반환 미사용은 확인했으나 이를 전체 RGB 교체의 근거로 삼지 않았다. 실제 대조에서 source119 쓰담144는 raw114와 얼굴뿐 아니라 몸 포즈도 달랐다. 현재 기하/원본/보호 영역을 지키는 공통 복원 수정으로 해결하고 material-source 및 역사 원본은 변경하지 않았다. mouth=null241개는 원래 붉은 포즈별 입을 포함하므로 모두 같은 새 입으로 바꾸지 않았다.

회귀검사 중 npm 래퍼가 worker 인자를 넘기지 않아 다수 작업이 동시에 실행됐고 일부 시간 제한/허용 마스크 불일치가 발생했다. 해당 실행은 중단·로그 보존했다. 불필요하게 넓힌 runtime eye fringe는 기존.65로 되돌려 opaque admission/fallback 계약을 지켰으며, 새 합집합 복원은 허용 영역을 넓히지 않는다. 직접 Vitest 경로와 worker2로 전체를 다시 실행한다. 중간 소스가 섞일 수 있는 build도 중단하고 최종 소스 고정 후 다시 수행한다. 중간 검사나 이전 PASS를 최종 완료로 승격하지 않는다.

최종 증거 위치: `.scratch-pw/face-correction/runs/20261119-face-correction-clean/`의 같은화면 before/after-P1/P2/P3, 전체 원화60확대와 상황36×3포즈×3단계324장면,13/15 대안 및 native-regression/delivery-proof. 원본 SHA33와 파생33의 실제 캡처 SHA를 대조해 섞인 판을 거부한다. 1220/390폭의 이미지 깨짐·넘침도 확인한다. 실제기기/로그인RLS/자연생활36은 별도 미확인이다.

최종 확대에서 canonical 쓰담 눈의 끝 조각이 남는 별도 경로도 확인했다. 볼이 primary patch 모서리에 있으면 corner 표본이 부족해 작은 역사 landmark fallback으로 줄었고, 현재.76눈 끝을 다 지우지 못했다. canonical 셀의 경우 기존 bake와 같은 불투명 cream ring 표본을 허용해 전체 눈 영역을 복원한다. alpha245 미만 외곽은 여전히 거절한다. 회귀 관찰4픽셀(144셀의81,123 /114,122 /82,124 /115,122)은 열린 shy에서 원래 갈색이 사라지고 종이색이 되며 alpha253/254가 그대로인지 실제 PNG로 검사한다. 사용자 선택 없는13/15의 표정 설계 변경은 아니다.

## 최종 로컬 시안 검증

- 전체단위 `unit-clean.log`:469파일/7,321PASS/1SKIP/0FAIL, exit0. 그 뒤 canonical ring 및 타입표기 수정의 관련2파일/60건은 `unit-delivery.log`로 재검사해 exit0이다. 캐시의ArrayBufferLike 반환 타입으로 build 한 번 실패한 기록은 보존하고 실제ArrayBuffer 소유 배열로 타입을 명시해 고쳤다. 런타임 출력 변경 없음.
- 최종 `pipeline-delivery.log`, `build-delivery.log`, `typecheck-final-source.log` exit0. `lint-release-candidate.log` exit0이며 최종 production build의 lint/type도 통과했다. fixture.invalid/dummy 설정의 격리 build로, 운영 연결이나 실제기기 검증을 뜻하지 않는다.
- `live-delivery.json`:고정fixture production 검사5PASS/0FAIL/0SKIP. compiled36×3포즈×3진행324장면, viewer/studio/preview 실제 Enter쓰담, N낮잠의sleep/cozy/519를 확인했다. 쓰기/API/외부fetch 격리 유지. 검사 서버PID53304 종료,3198 LISTEN0 확인.
- `verify-final.log`:실제520PNG의 alpha변경0/넓은얼굴범위밖 RGB변경0, source/파생33패킷 실제SHA 일치. 남던쓰담눈4픽셀의 정상종이색과alpha253/254 보존. 1220/390폭의 전후판/대안판/전체확대 이미지깨짐0·넘침0. 같은화면4짝 overview는1040/390폭 확인했다.
- native확대5장과 상황확대6장을 실제 열어 눈사이수평선·사각복원판·쓰담전환조각 제거를 확인했다. 원본 붉은 입·ω입·헤롱눈·몸/귀/모자 의미는 보존한다. 이 관찰은 생성자의 확인이며 사용자 시각 승인이나 독립 역할 검수가 아니다. 최초 FAIL과 중간 결과는 별도 폴더/로그에 보존한다.
- `harness-delivery.log`:453문서/brief8185byte, exit0. 마지막 문서 정리 후 harness도 다시 실행한다. G22는 기존 사람target·레이블/타임라인/최소사용집계 변경이 없는 자율 그림 교정으로 제외했다. 서버/권한/KST/원프로젝트 사용자 변경과 미커밋 작업은 보존했다.

전달: `runs/20261119-face-correction-clean/overview.html/png`, `index.html`, `all-faces/index.html`, `alternatives.html/png`(모두 `.scratch-pw/face-correction/` 아래).13A/15B 추천은 미적용 대안이며 사용자 선택이 다음 결정이다. 이 교정의 커밋/push/배포와 사용자 시각 승인은 아직 없다. 실제기기/로그인RLS/자연생활36의 기존 미확인을 확대 해석하지 않는다.

## 후속13A·15B 비교 시안

사용자 “13번,15번 각각 A,B로 적용해서 전후 … 비교하고 더 나은거 선택”에 따라13A=양눈웃음+열린U입,15B=작은눈웃음+ω입을 로컬에 적용해 비교한다. 최종 선택/출시 승인이 아니다. 전은 방금 전달한 잔상 교정판을 먼저 실제 캡처해 고정하고, 후는 같은 포즈/크기/테마/진행30·55·80%로 캡처한다. origin/main1ebbcfc2 전후도 별도 짝으로 보존한다. 귀/몸/눈동자 기준/모자/다른 표정/권한/KST/사람target은 유지한다.

13은 윙크 대신 양쪽 감은 웃음으로,15는 낮은 눈웃음과 기존 두곡선ω입으로 표현한다.15의 실제petting과 같은 원화 재생인source9도 동일한 공통 정책/입 의미를 사용한다. 파생33패킷의 비교에서는 해당16셀 외 nativeRGB와 전체alpha 보존을 별도로 확인한다. 기존.76쓰담은 이전 시안/승인 기록으로 보존하고 새후보의곡률을 구분한다. 새원화 생성/자동다섯역할 검수는 없다.

후속 비교 구현:13의greeting은3단계 모두paired smile,15의melt는cat입/closed smile이며 `pettingArchControl=.44`로 아치 솟음을.42h→.26h로 낮췄다. source9의144..159는같은cat입tag로 맞춘다. 기준 눈 폭·선굵기1.15·입 두곡선·동작trigger/행동시간은 유지한다.

증거는 `.scratch-pw/face-options/runs/20261119-13A-15B/`에 별도 저장한다. `before.json`과모듈은제품수정전에 고정했고,각기존/후보/main에서18장면(2표정×3포즈×3진행)을 실제 공통painter로 캡처했다. `comparison.png/index.html`은직전교정판과새후보의대표전후,`details.html`은전체단계,`before-P13/P15.png`+`after-P13/P15.png`는origin/main1ebbcfc2 기준같은화면짝이다. 생성자가실제comparison을열어모양을확인했으며최종사용자선택과구분한다.

`proof.json`:nativeRGB는쓰담16셀만변경,나머지504셀동일/520전체alpha변경0/얼굴밖RGB변경0. `scope-proof.json`:다른34표정1394표본과520개배치·몸기하/다른입tag불변. 1040/390폭대표/단계판 이미지깨짐0·넘침0. 전체before/after는같은포즈·크기·테마·진행이다.

후속검증:관련단위69+appearance/accessory14=83PASS,`pipeline.log`/`build.log`/`typecheck.log`/`lint.log` exit0. production고정fixture5PASS(36표정×3포즈×3단계,실제viewer/studio/preview Enter쓰담,N수면519),`live.json`의unexpected/flaky0. API/쓰기/외부fetch차단그대로이며검사서버PID55224종료/3198 LISTEN0. 문서검사는최종정리후재실행한다. G22는기존사람target/타임라인/최소사용집계의의미를바꾸지않는그림변경으로제외한다. 사용자선택대기인로컬시안이며커밋/push/배포는하지않았다.

## 사용자 정정:13과15 각각 A·B 모두

사용자 “아니13번이랑15번둘다 A,B모두보여달라니까”로 앞선매핑오해를 정정했다.13A/15B를 최종고름으로해석하지 않는다.13A·13B·15A·15B 네가지를모두실제빅타민painter에적용한격리미리보기를만들었다. 제품의선택전13A/15B코드는이회차에서추가변경하지않았고source SHA불변을확인했다.

13B는기준눈크기의양눈을뜨고U입,15A는E.squeeze의편안한아래곡선눈과작은U미소다.13A/15B는앞선제안과동일하다. `.scratch-pw/face-options/four-variants.mjs`가공통painter에후보별sampler만바꿔렌더하며후보소스/해시도함께저장한다. 4후보×3포즈×3진행=36장면의alpha변경0,13A양눈감김/13B양눈열림/15A미소/15Bω입의정확한선택을검사했다. 새원화나외부이미지합성은없다.

결과폴더 `.scratch-pw/face-options/runs/20261119-13AB-15AB/`: `comparison-13.png`와`comparison-15.png`에서각각기존/A/B를같은포즈·크기·테마·55%로나란히보인다. 기존안은후보적용전잔상교정판이다. `details.html`에는각포즈의30/55/80%도있다. origin/main1ebbcfc2의before와각후보after8장도같은330px화면짝으로보존했다. 생성자가두비교그림을실제열어네후보가분리돼보이는것을확인했다. 1120/390폭두보고서이미지깨짐0·넘침0,네후보선택은아직사용자대기다. 이회차는제품수정이없는미리보기/문서작업이며직전빌드83단위/5fixture결과를새후보제품출시인증으로확대하지않는다.

## 최종 선택13B·15B

사용자 “둘 다 B로 적용해줘”로13B/15B를선택했다.13의greeting을양눈열림으로적용하고,15는이미후보로적용한작은눈웃음.44/ω입을유지한다. 최종sampler소스는네후보비교때의13B소스와동일해야한다. 과거.76/U입이나오해한13A를최종선택으로남기지않는다. 원본/비교후보는보존하며커밋/push/배포요청은없다.

최종증거 `.scratch-pw/face-options/runs/20261119-selected-13B-15B/`의 `selected-proof.json`:sampler소스SHA가실제로보여준13B후보와정확히같고,최종3포즈×3진행×2표정18PNG모두선택한13B·15B미리보기와바이트단위동일하다. 원본/파생이미지는직전15B후보와모두SHA동일하다. `comparison.png`의기존교정판/선택후를실제로열어확인했고origin/main전후짝도남겼다. 1040/390폭깨짐/넘침0. native전체alpha0/얼굴밖RGB변경0,쓰담16셀외504native불변(기존교정판대비)이다.

선택반영검증로그는 `.scratch-pw/face-options/selected-*`:unit69+appearance/accessory14=83PASS, pipeline/build/typecheck/lint exit0. live5PASS/0SKIP/0unexpected/0flaky로compiled36표정324장면과실제viewer/studio/preview Enter쓰담/N수면519를확인했다. 한정fixture서버PID55920종료/3198 LISTEN0. API/쓰기/외부fetch격리와서버/권한/KST/G22경계는이전과동일하다. 마지막문서검사를다시수행하고active/current에는완료이력을남기지않는다. 선택의시각승인은13B/15B범위이며실제기기/자연생활36/RLS/배포성공으로확대하지않는다.

## 출시 승인

후속 사용자 “좋아. 지금 수정한 것들 커밋하고 푸시해서 배포까지 해줘.”로 이번 얼굴 교정 전체와13B·15B의 커밋/main push/실제 배포 확인을 승인했다. 앞선 ‘출시 요청 없음’ 기록은 그 당시 권한이며 이 직접 요청으로 대체한다. 원프로젝트 dirty/HEAD는 보존한다. 현재 origin/main6c61f679의 설정 개선2개 커밋을 통합하고 최종 검증한다.

G21 독립 코드 검수 완료:공유painter/잉크합성/harmonic복원/WeakMap상한/alpha·양눈입장/역할·서버·KST경계/관련회귀를 검토했고 구체적 결함 없음. 승인소스4SHA/33파생패킷 SHA·bytes 일치를 독립 확인했다. 작성자가 수행한83단위/5fixture 로그를 검토했으며 검수자 직접 재실행·실기기 성능·main 통합후 검증은 별개다. 새다섯역할 아트검수를 추가하거나 승인얼굴을 재설계한 것이 아니다.

출시는 기존 Cloudflare Workers Builds의 GitHub 연결만 이용한다. 로컬cf:deploy/비밀복사/운영DB 변경은 하지 않는다. 실제release commit과 공개사이트 build SHA/33그림 SHA/클라이언트표정을 대조하고 결과를 로컬 출시 증거에 남긴 뒤,미커밋0을 확인해 이worktree를 같은세션에서 제거한다. 실제기기/로그인RLS/자연생활36의 기존 미확인을 출시성공으로 확대하지 않는다.
