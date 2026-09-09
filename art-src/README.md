# 엔티티별 아트 작업실

엔티티 하나의 프롬프트·참고·반려·생성 원본·검토를 같은 곳에서 찾는다. [목록](목록.md)은 manifest의 전체 파일 계획과 실제 작업 폴더를 연결한다. 파일 규격은 manifest, 저장 규칙은 [AGENTS](AGENTS.md), 명령은 [ART_PIPELINE](../docs/ambient/ART_PIPELINE.md), 현재 작업은 [CURRENT_STATE](../docs/agent/CURRENT_STATE.md)가 맡는다.

## 폴더 역할

```text
<category>/<entity>/
  프롬프트.md                       # 생성된 진입점: 전체 파일 계획 + 현재 run
  레퍼런스/                         # 분류한 외부 영감 후보 + 원래 sidecar
  반려본/<과거-batch>/               # 반려 이미지·이유·출처
  생성본/<variant>/<계절-or-공통>/   # 정본 파일명으로 보존한 legacy 이미지
  검토/README.md                    # run의 평평한 납품 폴더·검사·시트 링크
  runs/<run>/                       # 고정 의뢰·입력·raw·normalized·판정
reference/<category>/               # 여러 엔티티가 공유하거나 아직 미분류인 참고
```

실제 자료가 있거나 작업 대상으로 선택한 엔티티만 폴더를 만든다. 전체 엔티티·자리·파일 수는 생성된 목록에서 계산한다. 계절은 파일 수에 곱하지 않는다. 여러 계절에 쓰는 한 PNG는 공통에 한 번 보관하고, 계절별로 따로 정의된 자리는 해당 계절에 놓는다. 정확한 대응은 엔티티 프롬프트의 파일 표를 따른다.

새 납품은 run의 `raw/`에 정확한 이름으로 들어간다. 별도 정규화·검사와 실제 소유자 검토 뒤 `promote`를 사용한다. public에 먼저 넣고 옛 `art:normalize`를 실행하는 절차는 철회됐다. [public/ambient/art](../public/ambient/art/)는 화면에 제공하는 정리본이며, 엔티티 원본 보관처와 역할이 다르다.

## 참고와 이력

엔티티의 레퍼런스 직하에 놓인 외부 그림은 **대상을 확인해 연결한 영감 후보**다. 화풍 합격이나 해당 생물 종의 일치를 보장하지 않는다. [공용 참고 안내](reference/README.md)는 출처·선택·검사를 맡는다. [합격본 시트](../docs/ambient/reference/README.md)와도 구분한다.

과거 루트 PNG와 incoming 폴더는 사용자가 승인한 이관으로 엔티티에 모았다. 파일 이름·바이트·옛 위치의 대응은 [migration receipt](migrations/20260909-entity-layout.json)에 남겼다. 반려 이미지와 설명은 모두 소나무 `반려본/` 아래에 있고, 루트의 옛 incoming 폴더는 제거했다. 기존 run은 경로와 바이트를 유지한다. 현재 이관 결과와 검증은 [엔티티 아카이브 결과](../docs/agent/handoffs/20260909-entity-art-archive.md)에 기록한다.

카탈로그가 만드는 프롬프트와 하위 README는 직접 편집하지 않는다. 수기 메모·판정은 별도 파일에 쓴다. `.scratch-pw/`는 추적되지 않으므로 전달·재현의 유일한 보관처로 쓰지 않는다.

## 원본 계보의 한계

보존된 legacy 파일은 최초 생성 원본이나 합격본과의 계보가 입증되지 않았을 수 있다. public에 같은 이름이 있다는 이유로 승인된 원본이라 부르지 않는다.

2026-09-09 확인: 보존된 `sun-disc-2.png`는 448×448이다. 합격 소나무 `tree-pine-1`, `tree-pine-autumn-1`, `tree-pine-winter-1`의 최초 생성 원본은 없다. public과 run baseline은 정규화된 합격 참고이며, 반려 이력의 같은 이름 세 장은 240×432이고 합격본과 해시도 다르다. 이를 복구 원본으로 대체 표시하지 않는다.
