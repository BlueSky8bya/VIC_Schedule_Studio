# 빅타민 모습 일관성 도구

프로젝트 루트에서 실행한다. 기존 원본은 읽기 전용이고 운영 DB/서비스에 접속하지 않는다. 새 파생 WebP와 source-bound JSON만 만든다. 생성 모델/새 런타임 의존성은 사용하지 않는다.

현행 기준은 [현재 모습 계약](../../docs/agent/domain-rules/COMPANION_APPEARANCE.md)과 `appearance-policy.json`이다. [조사/채택 근거](../../docs/agent/research/COMPANION_APPEARANCE_PIPELINE-20261118.md). 실행은 아래 한 진입점으로 시작한다.

```sh
node scripts/companion-consistency/pipeline.mjs plan --scope=eyes
node scripts/companion-consistency/pipeline.mjs doctor
node scripts/companion-consistency/pipeline.mjs build --scope=eyes
node scripts/companion-consistency/pipeline.mjs verify --scope=eyes
node scripts/companion-consistency/pipeline.mjs report
```

`build --scope=headwear`는 몸 재생성0회. 같은 입력/출력 SHA면전체build도renderer/packer0회. 특정native는`plan --scope=ears --native=62`로영향범위를확인하되현재발행은전체일관판단위. QA는캐시자동PASS하지않는다. 세부단계를직접재현해야할때만아래순서를쓴다.

```sh
node scripts/companion-consistency/prepare-appearance.mjs
node scripts/companion-consistency/bake-style.mjs
node scripts/companion-consistency/prepare-appearance.mjs --styled
node scripts/companion-consistency/full-audit.mjs
node scripts/companion-consistency/readiness-audit.mjs
npx vitest run tests/unit/companion-appearance.test.ts tests/unit/viewer-companion-mouth.test.ts
```

첫 단계는 고정 `input-metadata.json`의33개 parent SHA와115 native 원본 SHA를 검증하고520셀/60고유키의 귀·눈 의미를 등록한다. 두 번째는 실제 공통 expression painter를 Chromium에서 실행해515개 보이는 얼굴을 원래 달리기304 눈 기준으로 다시 그린다. 뒤통수5셀은 유지하며 회전6셀도별도등록한다. 마지막 packing은 새 얼굴과 export cleanup을 적용하고 `public/companion/hd/appearance-20261118-*.webp`, `appearance-edition.json`을 갱신한다. `native-parts.json`은 원화에서 측정한 주황/노랑 귀의 뿌리·끝 소유권과 고정된 눈 상태다. 변수 bbox 비율로 윙크·감은 눈을 재분류하지 않는다.144..159와266은 후속 원화의 명시적 예외다.

귀 소유권은115의 원래 비선형 역샘플 좌표로 전파한다. 원래 얼굴 잉크가 귀로 잘리지 않도록 feature guard를 둔다. 각 atlas의 첫384px는 기존 cell 배치와 똑같은 whole-pose plane, 그 아래는 body+4귀의 배타적 crop을 MaxRects로 포장한다. 원본 포즈·이동 등록·clip·행/열은 유지한다. 강한 큰 분리 요소와 원래 감정 기호는 남기며, 큰 alpha 성분과 떨어진 작은 export 잔여만 지운다. 종잇장 몸체의 의도된 접힘선은 무조건 지우지 않는다.

## 실제 제품 조립

viewer/studio/preview, 옷장, 초원 모두 같은 accessory painter를 사용한다. 모자 착용 시 `뒤 rotor → 뒤 귀 뿌리/끝 → 몸+현재 얼굴 → 모자 → 접힌 앞 귀 끝`을 하나의384px canvas에서 조립한 다음 한 번 축소한다. 귀를 따로 CSS 축소해서 생기는 AA 틈을 피한다. 각 귀는4개의 독립된 source slot이며, 숨은 연결 원화를 새로 추측해 굽히지는 않는다. 좌우 반전은 전체 부모에 한 번 적용한다.

표정도 원본을 겹쳐 놓지 않는다. 양눈 patch를 함께 허용하고, 정수 inclusive 범위로 옛 잉크를 제거한 뒤 하나의 눈/입 형태를 그린다. 감은 눈·윙크·슬픔·빙글눈의 의미와 양쪽을 고정한다. 입은 새 얼굴 축의 canonical 좌표를 저장하고 먹기 투영도 같은 좌표를 사용한다. alpha와 허용 영역 밖 RGB는 보존한다.

합산 변형은 `log(1.08)`의 절대 strain 예산을 공유한다. 네 겹 회전/압축이 섞여도 각 축의 배율 상한은1.08, 종횡비 상한은1.08²이다. CSS, 입/소파/잡기 투영, 옷장과 초원이 같은 계산을 쓴다. 원근·실제 포즈를 외곽 상자 기준으로 강제 평준화하지 않는다.

디코더는 기존 retained3/inflight2 제한을 유지한다.33패킷의 최신 encoded bytes는 `appearance-edition.json`/pipeline 증거로 확인한다(ω·투명눈판 수정판18,264,890bytes), 최댓값1536×768×4=4,718,592 decoded bytes/packet으로 기존1536×384보다 최대2배다. 부하가 공짜라는 뜻은 아니다. 런타임은 모든 패킷을 미리 읽지 않는다. 모자 준비 중 몸 패킷이 LRU에서 빠지면 그 readiness event에서만 기존 decoder로 재준비하고 generation을 확인한다. clear/새 포즈는 옛 복원을 취소한다. 추가 RAF/폴링/Image cache는 없다.

## 증거와 범위

결과는 `.scratch-pw/companion-consistency/`에 두며 [보존 정책](../scratch-retention/README.md)의 feature14일/전체 용량 한도를 따른다. 영구 배포 증거가 아니다.

- `full/runs/20261118-running-eyes/index.html`: 전 실행 당시 origin/main(fullSHA는proof) / 후 작업본. 같은1000×900 화면·테마·입력의 before/after PNG를 `<img>`로 표시한다.60고유원화×12모자=720착용 그림 전체와520×12×2=12,480조합/판의 실제 painter 검사를 담는다. geometry 감사는 모자만 통제 predecode하며 실제 준비/성능 증거와 구분한다.
- `full/appearance-proof.json`, `style-proof.json`:60키/520셀,515얼굴 교정과 원본에서의 export 잔여 정리(현재raw pass474,329픽셀, styled재실행은이미정리돼0). 원본은 유지한다.
- `tests/unit/companion-appearance.test.ts`: strict path+SHA/bytes/dimensions,520등록/41행,4슬롯/눈 의미, 모든 셀 재조립. 겹침·누락·alpha·가시 RGBA 불일치0. WebP의 alpha0 RGB만0 정규화하므로 완전투명 RGB까지 원바이트 동일하다는 주장은 하지 않는다.
- `readiness/proof.json`: 실제 Image/decoder/모자 준비를 사용한 늦은 응답/LRU 퇴출/clear/새 포즈3회귀. HTTP응답만 지연하며 가짜 texture를 주입하지 않는다.
- `live/`: production React 표면의 실제 입력·옷장·쓰담 증거. 표현 fixture는36개 rig의 렌더 범위이며 자연생활36개 발견/보상 전체를 검증했다는 뜻은 아니다. 실제 OBS/방송PC 성능은 별도다.
- 최신 둥근 ‘헤헤’ 수정은 `hehe/runs/20261118-petting-hehe/index.html`: 직전 온화한 현재판과 origin/main을 각각 같은 화면·크기로 비교한다.515정적얼굴/비나선runtime5,006개 비교와 fresh production41건 증거는 `hehe/`에 있다. 현재33패킷18,268,742bytes; 기존 ω/눈질감 수정판 수치는 역사 기록이다.

왕관은 사용자가 거절한 뾰족 시안 대신 붉은 벨벳 돔·금아치·백합·보석 띠·십자가 있는 `royal-crown-20261118-v2.svg`4방향이다. 기존111 원본과 거절 시안은 보존한다. 사용자 시각 승인을 임의 기록하지 않는다.

## 교정의 다음 발판

`native-parts.json`의 특정 native 키를 수정하면520파생셀에 같은 역샘플로 반영된다. 새로운 포즈/귀를 추가할 때에는 원본 SHA·측정 capsule·folded와eye tag를 함께 등록한다. 새 모자는4방향 art/content bounds와 fitting을 추가한 뒤 full-audit/readiness/live 검사를 재실행한다. 눈 기준은 변경 전 달리기304로 고정하고 선 굵기를 고치되 잠든 눈·윙크·원근을 구별한다. 실제 귀 관절을 더 굽혀 빈 영역을 드러내는 동작은 별도의 연결 원화가 필요하다.

`ear-grid.mjs`, `ear-pilot.mjs`, `audit.mjs`와 이전 `runs/20261118/ear-lab.html`은 초기 두 포즈 연구 도구/증거다. 현재 전체 적용의 실행 순서는 위 명령이며, 초기 제한은 후속 사용자 요청으로 대체됐다.
