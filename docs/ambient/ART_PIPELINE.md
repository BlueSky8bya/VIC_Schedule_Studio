# 엔티티 아트 작업·검토 파이프라인

[엔티티 목록](../../art-src/목록.md) → `<category>/<entity>/프롬프트.md`가 작업 진입점이다. 이 페이지는 전체 파일 계획과 자료를 모은다. **실제 생성 지시는 선택한 run의 request.md/json과 고정 inputs**이며, 전체 계획이 이번 납품 범위를 늘리지 않는다. 저장 계약은 [art-src/AGENTS](../../art-src/AGENTS.md), 미감은 [ART_RULES](ART_RULES.md)가 맡는다.

## 엔티티와 고정 run

```text
art-src/<category>/<entity>/
  프롬프트.md
  레퍼런스/                       # 영감 후보와 sidecar, 직하 배치
  반려본/<과거-batch>/             # legacy 반려 이미지·review
  생성본/<variant>/<계절-or-공통>/ # legacy 보존 이미지, 정본 파일명
  검토/README.md                   # 아래 flat 결과·시트·판정 링크
  runs/<run>/
    request.md / request.json      # 정확한 납품 목록·규격·입력 해시
    inputs/baseline/               # 합격 참고 고정 사본
    inputs/reference/              # 요청에 기록된 참고 고정 사본
    raw/                          # 새 생성기 원본, 최종 파일명 그대로
    normalized/                   # 별도 정규화 결과, 평평한 폴더
    checks.json
    review.png / review-detail.png
    artifacts.json / review.json
```

파일 이름은 manifest `slotFiles()`, 엔티티·원본 보관 경로는 `scripts/lib/ambient-art-entities.mjs`에서 계산한다. 한 계절에 쓰는 파일은 해당 계절, 여러 계절에 쓰는 파일은 공통에 한 번 보관한다. `seasons`를 파일 수에 곱하지 않는다. 소나무의 공통 파일과 가을·겨울 파일은 각각 실제 자리 이름을 유지한다.

엔티티 그룹과 계절짝 검사 계약은 별개다. 계절별 같은 나무는 같은 정체성을 유지하지만, 폴더를 묶었다고 소나무 전용 수치 검사를 다른 식물에 적용하지 않는다. 눈사람 단계·민들레 상태·달 위상도 임의로 서로 바꿀 수 있는 변형으로 취급하지 않는다.

## 카탈로그

```powershell
npm run art:catalog
npm run art:catalog -- --entity acorn
npm run art:catalog -- --entity tree-oak,tree-pine
npm run art:catalog -- --check
```

전체 목록은 계산하되, 폴더/public 자료가 있거나 명시적으로 선택한 엔티티만 진입점을 만든다. 생성 대상은 `목록.md`, 엔티티 `프롬프트.md`, 레퍼런스·반려본·생성본·검토 README다. 이미지·run 요청·입력·판정을 수정하지 않는다. 생성 표시나 내용 해시를 수동 수정한 문서는 충돌로 보호한다. 메모는 별도 파일에 쓰고 카탈로그를 다시 생성한다. `--check`는 쓰기 없이 현재 코드·자료와의 drift를 검사한다.

## 과거 자료 이관

```powershell
npm run art:migrate -- plan --references <reference-selection.json>
npm run art:migrate -- apply --receipt <migration-receipt.json>
npm run art:migrate -- check --receipt <migration-receipt.json>
```

plan은 정확한 source→destination·해시·이유를 담은 새 receipt를 기록한다. 기본 경로는 `art-src/migrations/20260909-entity-layout.json`이며 `--receipt`로 다른 경로를 지정할 수 있다. 기존 receipt는 덮지 않는다. 내용을 확인한 뒤 현재 승인된 이관 범위에서 apply한다. 기존 루트 PNG는 엔티티 생성본으로, incoming 반려 폴더는 소나무 반려본의 같은 batch 이름으로 모은다. 시각적으로 확인한 참고는 이미지+sidecar 쌍으로 해당 엔티티 레퍼런스 직하에 둔다. 모호한 참고는 범주 공용에 남긴다.

이관은 바이트를 바꾸거나 아트 합격을 선언하는 작업이 아니다. 기존 public 및 고정 run의 경로·바이트는 유지한다. 보존 legacy 파일은 최초 생성 원본이나 합격본과의 계보가 입증되지 않았을 수 있다. 같은 이름의 public 파일이 있어도 승인 증거로 간주하지 않는다. 중단된 applying/recovery-required 상태는 receipt 기반 복구 후 재시도하며, 확인 없이 completed로 고치지 않는다. 이관 후 receipt check, 출처 검사와 catalogue freshness를 확인한다. 이관 범위·결과는 [최신 결과](../agent/handoffs/20260909-entity-art-archive.md)에 기록한다.

## 새 요청·납품

```powershell
# 예시: 소나무 변형 2·3의 계절팩. dry는 쓰지 않는다.
npm run art:pipeline -- request tree-pine --run 20260909-pilot-02 --variants 2,3 --dry
# --dry를 빼면 새 요청과 고정 입력을 기록한다.

# 현재 준비된 파일럿에 실제 납품이 들어온 뒤
npm run art:pipeline -- normalize art-src/tree/tree-pine/runs/20260909-pilot-01

# 독립 진단. 승인 근거는 run workflow의 고정 보고서·해시를 사용한다.
npm run art:check -- tree-pine --dir art-src/tree/tree-pine/runs/20260909-pilot-01/raw --baseline art-src/tree/tree-pine/runs/20260909-pilot-01/inputs/baseline --json
```

정확한 납품 이름은 request의 표를 따른다. 일반 입력은 manifest가 정한 1024×1024 투명 PNG이며, 새 raw는 현재 요청의 전체 목록과 맞아야 한다. 원본은 그대로 두고 정수배·nearest 정규화를 별도 normalized에 쓴다. 과거의 작은 보존 이미지를 새 generator 원본으로 위장해 넣지 않는다.

소나무 같은 paired family는 같은 변형의 계절팩을 요청·검토·반영 단위로 완결한다. 생성기를 한 번 호출할 때 모든 계절을 만들 필요는 없다. 합격본 없는 엔티티는 `style-pilot`으로 시작한다. 없는 합격본을 있다고 표시하거나 합격 시트가 없다는 이유만으로 무조건 멈추지 않는다.

기존 run은 덮지 않는다. raw/normalized가 비었고 review가 pending이며 artifacts가 없는 준비 단계에서만 도구의 `--refresh-prepared`가 허용된다. 이 예외로 입력 이미지나 요청 파일 목록을 바꾸지 않는다. 납품 뒤 지시·그림·manifest/codex 계약을 바꾸면 새 run을 만든다. 요청에 기록된 inputs와 실제 생성기에 전달한 이미지를 확인하며, 새 엔티티 참고 폴더를 옛 run에 자동 연결했다고 주장하지 않는다.

## 판정과 public 반영

```powershell
# 실제 소유자 판단을 기록한다. 아래는 반려 예시다.
npm run art:pipeline -- review art-src/tree/tree-pine/runs/20260909-pilot-01 --decision rejected --reviewer owner --rule pine.snow.location --note "단 윗면 대신 외곽에 눈이 몰림"
# 실제 승인일 때만 --decision approved를 쓴다.
npm run art:pipeline -- promote art-src/tree/tree-pine/runs/20260909-pilot-01
# 승인된 반영 범위에서 실제 복사할 때만 --apply를 붙인다.
```

checks 항목은 ruleId·asset·status·measured·expected를 가진다. pass/fail/not-applicable/unmeasured를 구분하고, 없는 baseline 비교를 측정했다고 하지 않는다. 밑동·눈·가을 색의 소나무 전용 검사는 다른 엔티티에 일반화하지 않는다.

기계 실패는 승인을 막는다. unmeasured는 소유자 시각 검토와 판단 메모가 필요하다. 실제 표시 크기 review.png와 정수배 확대 review-detail.png를 함께 본다. `--reviewer owner`라는 필드는 실제 승인이나 인증을 만들어 주지 않는다.

promote는 승인, 기계 실패 없음, 동일한 요청·파일·해시, 완결된 계절팩과 기존 public 이름 보호를 확인한다. 기존 합격본 교체는 지원하지 않으며 신규 이름만 추가한다. 두 run을 동시에 반영하지 않는다. 실패 시 이번 호출이 만든 파일 중 해시가 같은 것만 되돌리며, 프로세스 강제 종료까지 보장하는 파일시스템 트랜잭션은 아니다. 실제 반영 뒤 전체 파일을 확인한다.

## 반려와 검증

반려는 rule ID·관찰·기대 결과·파일 해시·시각·판단 메모를 보존한다. 다음 요청은 run review와 엔티티의 legacy 반려 기록에 있는 최근 미해결 사유를 함께 참고한다. 반려 그림은 REJECTED 라벨·문제 crop·기대 모양을 갖춘 실패 예시이며 합격 스타일 기준이 아니다.

문서/자료 이관 뒤 `npm run art:catalog -- --check`, `npm run ref:check`, `npm run harness:verify`를 실행한다. 코드 변경은 관련 단위검사를 더한다. 실제 이미지 생성·수치 측정·소유자 승인은 별개 상태로 보고한다. 옛 `art:normalize`의 public 제자리 쓰기는 차단됐고 `--dry`만 기존 파일 진단용으로 남았다.
