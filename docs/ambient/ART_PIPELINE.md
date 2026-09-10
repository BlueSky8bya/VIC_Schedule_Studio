# 엔티티 아트 작업·검토 파이프라인

[엔티티 목록](../../art-src/목록.md) → `<한글 범주>/<한글 엔티티>/프롬프트.md`가 작업 진입점이다. 이 페이지는 전체 파일 계획과 자료를 모은다. **실제 생성 지시는 선택한 run의 request.md/json과 고정 inputs**이며, 전체 계획이 이번 납품 범위를 늘리지 않는다. 저장 계약은 [art-src/AGENTS](../../art-src/AGENTS.md), 미감은 [ART_RULES](ART_RULES.md)가 맡는다.

## 엔티티와 고정 run

```text
art-src/<한글 범주>/<한글 엔티티>/
  프롬프트.md
  레퍼런스/                       # 영감 후보와 sidecar, 직하 배치
  반려본/<과거-batch>/             # legacy 반려 이미지·review
  생성본/<variant>/<계절-or-공통>/ # promote 원본 보관, 기존 legacy는 승인 계보 별도 확인
  검토/README.md                   # 아래 flat 결과·시트·판정 링크
  작업회차/<회차>/
    request.md / request.json      # 정확한 납품 목록·규격·입력 해시
    고정입력/합격참고/               # 합격 참고 고정 사본
    고정입력/레퍼런스/              # 요청에 기록된 참고 고정 사본
    고정입력/수집참고/              # 엔티티 레퍼런스/의 선별본 고정 사본
    원본/                          # 새 생성기 원본, 최종 파일명 그대로
    정리본/                   # 별도 정규화 결과, 평평한 폴더
    checks.json
    review.png / review-detail.png
    artifacts.json / review.json
art-src/공통화풍참고/              # 프로젝트 전체 분위기·색감·구도·카메라 참고
```

파일 이름은 manifest `slotFiles()`, 묶음·변형·계절 경로는 `scripts/lib/ambient-art-entities.mjs`, 실제 한글 폴더는 `scripts/lib/ambient-art-paths.mjs`와 [폴더명.json](../../art-src/폴더명.json)에서 계산한다. 한 계절에 쓰는 파일은 해당 계절, 여러 계절에 쓰는 파일은 공통에 한 번 보관한다. `seasons`를 파일 수에 곱하지 않는다. 내부 ID와 파일명은 영어 정본을 유지하며, 새 회차명은 한글·숫자를 쓴다.

엔티티 그룹과 계절짝 검사 계약은 별개다. 계절별 같은 나무는 같은 정체성을 유지하지만, 폴더를 묶었다고 소나무 전용 수치 검사를 다른 식물에 적용하지 않는다. 눈사람 단계·민들레 상태·달 위상도 임의로 서로 바꿀 수 있는 변형으로 취급하지 않는다.

## 카탈로그

```powershell
npm run art:catalog -- --all
npm run art:catalog -- --category bug
npm run art:catalog -- --category bug,fish --entity acorn
npm run art:catalog
npm run art:catalog -- --entity acorn
npm run art:catalog -- --entity tree-oak,tree-pine
npm run art:catalog -- --check
npm run art:catalog -- --all --check
```

전체 엔티티의 기본 진입점과 네 자료 폴더를 `--all`로 먼저 준비한다. 현재 207개 자리를 193개 엔티티로 묶으므로 생성 소유 문서는 엔티티당 5개와 `목록.md`를 합쳐 966개다. 해변 장식용 `starfish`와 도감용 `animal-starfish`는 `동물/불가사리` 하나로 묶되 파일 ID는 유지한다. 실제 개수는 manifest에서 계산한다. 변형·계절 하위 폴더는 자료가 필요할 때 만들며, 카탈로그는 빈 run을 만들지 않는다.

선택 옵션이 없는 실행은 기존처럼 폴더/public 자료가 있는 엔티티를 갱신한다. `--all`은 전체, `--category`는 해당 범주, `--entity`는 해당 ID를 추가 대상으로 선택한다. 반복 옵션과 쉼표 목록은 합집합이며, 기존 엔티티는 빠지지 않는다. `--all`과 함께 써도 알 수 없는 범주·ID 또는 빠진 인자 값은 오류다. 선택 옵션은 다른 엔티티를 지우거나 제외하는 필터가 아니다.

생성 대상은 `목록.md`, 엔티티 `프롬프트.md`, 레퍼런스·반려본·생성본·검토 README다. 이미지·run 요청·입력·판정을 수정하지 않는다. 생성 표시나 내용 해시를 수동 수정한 문서는 충돌로 보호하며, 충돌이 있으면 해당 실행에서 다른 문서도 쓰지 않는다. 메모는 별도 파일에 쓰고 카탈로그를 다시 생성한다. `--check`는 폴더 생성·파일 쓰기 없이 선택 범위의 현재 코드·자료와의 drift를 검사한다. 전체 진입점 누락까지 확인하려면 `--all --check`를 쓴다.

## 과거 자료 이관

```powershell
npm run art:migrate -- plan --references <reference-selection.json>
npm run art:migrate -- apply --receipt <migration-receipt.json>
npm run art:migrate -- check --receipt <migration-receipt.json>
```

plan은 정확한 source→destination·해시·이유를 담은 새 receipt를 기록한다. 기본 경로는 `art-src/이관기록/20260909-entity-layout.json`이며 `--receipt`로 다른 경로를 지정할 수 있다. 기존 receipt는 덮지 않는다. 내용을 확인한 뒤 현재 승인된 이관 범위에서 apply한다. 기존 루트 PNG는 엔티티 생성본으로, incoming 반려 폴더는 소나무 반려본의 같은 batch 이름으로 모은다. 시각적으로 확인한 대상 참고는 이미지+sidecar 쌍으로 해당 엔티티 레퍼런스 직하에 둔다. 전체 분위기 참고는 `공통화풍참고/`에 분리하고 자동 수집·NOTICE 대상에 넣지 않는다.

이관은 바이트를 바꾸거나 아트 합격을 선언하는 작업이 아니다. 사용자 요청으로 기존 작업회차와 반려 묶음의 폴더를 한글화했고, 고정 문서·그림·출처·기존 receipt는 바이트를 유지한다. `node scripts/ambient-art-folder-migrate.mjs check`로 [한글 이관 기록](../../art-src/이관기록/20260909-korean-folders.json)을 검증한다. `art:migrate check`는 옛 receipt의 원문 해시를 검사한 뒤 현재 경로에서 파일을 확인한다. 보존 legacy 파일은 최초 생성 원본이나 합격본과의 계보가 입증되지 않았을 수 있다. 중단된 이관은 receipt 기반 복구 후 재시도하며, 확인 없이 completed로 고치지 않는다. 현재 경로·복구는 [한글화 결과](../agent/handoffs/20260909-korean-art-folders.md)를 따른다.

## 새 요청·납품

```powershell
# 예시: 소나무 변형 2·3의 계절팩. dry는 쓰지 않는다.
npm run art:pipeline -- request tree-pine --run 20260909-파일럿-02 --variants 2,3 --dry
# --dry를 빼면 새 요청과 고정 입력을 기록한다.

# 현재 준비된 파일럿에 실제 납품이 들어온 뒤
npm run art:pipeline -- normalize art-src/나무/소나무/작업회차/20260909-pilot-01

# 독립 진단. 승인 근거는 run workflow의 고정 보고서·해시를 사용한다.
npm run art:check -- tree-pine --dir art-src/나무/소나무/작업회차/20260909-파일럿-01/원본 --baseline art-src/나무/소나무/작업회차/20260909-파일럿-01/고정입력/합격참고 --json
```

정확한 납품 이름은 request의 표를 따른다. 일반 입력은 manifest가 정한 1024×1024 투명 PNG이며, 새 raw는 현재 요청의 전체 목록과 맞아야 한다. 원본은 그대로 두고 정수배·nearest 정규화를 별도 normalized에 쓴다. 과거의 작은 보존 이미지를 새 generator 원본으로 위장해 넣지 않는다.

`request`는 엔티티 `레퍼런스/`의 현재 이미지를 `고정입력/수집참고/`로 복사하고 request.inputs에 `inspiration`으로 해시와 함께 기록한다. 생성기는 저장소 경로를 열 수 없으므로 **고정입력 사본을 전부 그림으로 첨부해야** 그 참고가 실제로 전달된다. 사이드카가 없거나 CC0가 아닌 이미지가 폴더에 있으면 request가 실패한다 — 선별에서 뺄 이미지는 요청 전에 지운다. 화풍 정본은 여전히 합격본이며 수집참고는 형태 발상용이다.

소나무 같은 paired family는 같은 변형의 계절팩을 요청·검토·반영 단위로 완결한다. 생성기를 한 번 호출할 때 모든 계절을 만들 필요는 없다. 합격본 없는 엔티티는 `style-pilot`으로 시작한다. 없는 합격본을 있다고 표시하거나 합격 시트가 없다는 이유만으로 무조건 멈추지 않는다.

기존 run은 덮지 않는다. 원본·정리본이 비었고 review가 pending이며 artifacts가 없는 준비 단계에서만 도구의 `--refresh-prepared`가 허용된다. 영어 경로에서 이관한 옛 요청은 이 예외로 갱신하지 않는다. 요청서의 옛 경로는 엔티티 프롬프트의 현재 원본·고정입력 링크로 읽는다. 입력 이미지나 요청 파일 목록을 바꾸지 않으며, 지시·그림·manifest/codex 계약을 바꾸면 새 run을 만든다.

## 판정과 public 반영

```powershell
# 실제 소유자 판단을 기록한다. 아래는 반려 예시다.
npm run art:pipeline -- review art-src/나무/소나무/작업회차/20260909-pilot-01 --decision rejected --reviewer owner --rule pine.snow.location --note "단 윗면 대신 외곽에 눈이 몰림"
# 실제 승인일 때만 --decision approved를 쓴다.
npm run art:pipeline -- promote art-src/나무/소나무/작업회차/20260909-pilot-01
# 승인된 반영 범위에서 실제 복사할 때만 --apply를 붙인다.
```

checks 항목은 ruleId·asset·status·measured·expected를 가진다. pass/fail/not-applicable/unmeasured를 구분하고, 없는 baseline 비교를 측정했다고 하지 않는다. 밑동·눈·가을 색의 소나무 전용 검사는 다른 엔티티에 일반화하지 않는다.

기계 실패는 승인을 막는다. unmeasured는 소유자 시각 검토와 판단 메모가 필요하다. 실제 표시 크기 review.png와 정수배 확대 review-detail.png를 함께 본다. `--reviewer owner`라는 필드는 실제 승인이나 인증을 만들어 주지 않는다.

promote는 승인, 기계 실패 없음, 동일한 요청·파일·해시, 완결된 계절팩을 확인한다. `--apply` 없이 양쪽 복사 계획의 정확한 경로·해시를 먼저 확인할 수 있다. 적용 시 `정리본/<name>`은 `public/ambient/art/<name>`, `원본/<name>`은 엔티티의 `생성본/<variant>/<계절-or-공통>/<name>`에 복사한다. run 원본은 이동하거나 다시 인코딩하지 않는다. 모든 목적지와 부모 경로를 쓰기 전에 검사하며 기존 public·원본 보관 파일은 덮지 않는다.

성공한 `published.json` v2에는 request/artifacts/review 해시와 각 파일의 raw·normalized source→target·SHA-256을 함께 기록한다. 두 run을 동시에 반영하지 않는다. 실패 시 이번 호출이 만들었고 해시가 같은 파일만 되돌린다. 부분 쓰기나 바뀐 파일 등 소유를 확정할 수 없는 잔여는 보존하고 `publish-recovery.json`의 `recovery-required` 상태로 기록한다. 해당 기록이나 기존 published가 있으면 자동 재반영을 차단한다. 복구 기록 자체를 쓸 수 없으면 CLI의 stderr에 출력한 전체 JSON을 보존한다. 새 빈 부모 폴더는 남을 수 있다. 기록한 경로·해시를 확인해 복구하며, 강제 종료까지 보장하는 파일시스템 트랜잭션으로 설명하지 않는다. 실제 반영 뒤 양쪽 파일을 확인한다.

## 반려와 검증

반려는 rule ID·관찰·기대 결과·파일 해시·시각·판단 메모를 보존한다. 다음 요청은 run review와 엔티티의 legacy 반려 기록에 있는 최근 미해결 사유를 함께 참고한다. 반려 그림은 REJECTED 라벨·문제 crop·기대 모양을 갖춘 실패 예시이며 합격 스타일 기준이 아니다.

문서/자료 이관 뒤 `npm run art:catalog -- --check`, `npm run ref:check`, `npm run harness:verify`를 실행한다. 코드 변경은 관련 단위검사를 더한다. 실제 이미지 생성·수치 측정·소유자 승인은 별개 상태로 보고한다. 옛 `art:normalize`의 public 제자리 쓰기는 차단됐고 `--dry`만 기존 파일 진단용으로 남았다.
