# ADR-0021 — 공통화풍참고 색인과 요청 자동 첨부

Status: Accepted
Date: 2026-09-10
Area: 아트 참고 / 생성 요청

## Context

소유자가 `art-src/공통화풍참고/`에 상업 게임 캡처 449장(데이브 더 다이버 186, 모여봐요 동물의 숲 263)을 직접 넣고, 209장을 하나하나 분류하는 대신 "소나무·다람쥐를 그려 달라"고만 하면 그림체 참고가 알아서 붙는 파이프라인을 요구했다(2026-09-10). 기존 규칙은 이 폴더를 "자동 첨부하지 않는다"고 못 박았고(README, ART-11, 카탈로그의 레퍼런스 README), 엔티티 레퍼런스는 CC0 sidecar가 있어야만 요청에 들어갔다.

## Decision

- 공통화풍참고는 **게임별 폴더 + 색인**이 된다. 그림 바이트·파일명은 건드리지 않고 `<게임>/색인.json`이 한 장마다 sha256·크기·종류·카메라·subjects(엔티티/범주/부류 태그)·환경·시간·계절·역할·표시·메모를 기록한다. 어휘는 `분류어휘.json`이 닫힌 목록으로 정한다.
- 역할은 넷이다. `mood`(장면 분위기), `depiction`(같은 부류의 단순화 어법), `form`(3D 렌더의 비율만), `none`(첨부 금지). **출처 게임의 캡처만** mood/depiction/form이 될 수 있다. 스톡·워터마크·다른 게임·사진·출처 불명은 폴더에 있어도 `none`이다. 형태 참고로 쓰려면 라이선스를 확인해 엔티티 `레퍼런스/`로 옮긴다(ADR-0019·CC0 규칙 유지).
- `art:pipeline request`는 색인에서 결정적으로 고른 그림(기본 ≤6: mood ≤2, depiction ≤3, form ≤1은 같은 부류 depiction이 없을 때만)을 `고정입력/화풍참고/<slug>-<sha8>.<ext>`로 복사하고 request.json에 원본 경로·해시·역할·사유를 기록한다. 프롬프트는 이 사본을 `style-mood`·`style-depiction`·`style-form`으로 구분해 적고 복제·트레이스 금지를 명시한다. `--no-style`·`--style-limit`로 끈다.
- 색인되지 않은 그림, 바이트가 바뀐 그림은 절대 첨부되지 않는다. `style:check`가 미분류·해시 불일치·어휘 위반·목록 drift를 잡는다.
- 분류는 에이전트가 대조 시트를 보고 작업지를 채우는 방식으로 반복 가능하다(`style:scan --sheets` → 작업지 → `style:apply`). 2026-09-10 최초 분류 449장은 Claude가 시트 38장을 육안 검토해 채웠고 `classifiedBy`에 남아 있다.
- 합격본 시트는 여전히 화풍 정본이다. 화풍 참고는 승인 근거가 아니며 `mode`를 바꾸지 않는다(합격본이 없으면 여전히 style-pilot).

대체되는 조항: 공통화풍참고 README·ART-11·카탈로그 레퍼런스 README의 "생성 요청에 자동 첨부되지 않는다". 유지되는 조항: 자산 복제·트레이스·public 반출 금지, 합격본 우선.

개정 2026-09-11(소유자 결정): 엔티티 `레퍼런스/`의 **CC0 전용 요건은 자유 라이선스 요건으로 넓혔다** — CC0·퍼블릭 도메인·CC-BY·CC-BY-SA·OGA-BY를 받고 사이드카에 출처·작성자·라이선스를 기록한다. NC·ND·GPL·출처 불명은 여전히 받지 않는다. `ref:fetch-all`이 OpenGameArt 픽셀아트와 위키미디어 커먼즈 사진(640px JPEG)을 전 엔티티에 모은다. 판정 코드: `scripts/lib/ambient-ref-library.mjs:licenseAccepted`, ART-11.

## Consequences

소유자는 엔티티 ID만 말하면 된다. 새 캡처는 폴더에 넣고 scan→분류→apply만 거치면 다음 요청부터 후보가 된다. manifest.ts가 바뀌어 기존 준비본 `20260909-파일럿-01`의 source 계약 해시가 어긋난다 — 그 run은 어차피 새 회차로 대체될 예정이며 원문은 그대로 둔다. 상업 캡처를 생성기에 첨부하는 일 자체는 소유자의 결정이고, 결과물에 게임 자산이 옮겨 오지 않았는지는 검토 시트에서 사람이 본다.

## Evidence

- [공통화풍참고 README](../../../art-src/공통화풍참고/README.md), [분류어휘](../../../art-src/공통화풍참고/분류어휘.json), [목록](../../../art-src/공통화풍참고/목록.md)
- `scripts/lib/ambient-style-library.mjs`, `scripts/ambient-style-refs.mjs`, `tests/unit/ambient-style-library.test.ts`
- [ART_PIPELINE](../../ambient/ART_PIPELINE.md) 화풍 참고 절, [ART_RULES](../../ambient/ART_RULES.md) ART-11·ART-14

## Revisit Trigger

생성기가 참고 그림을 직접 읽는 경로가 생기거나, 소유자가 특정 게임을 화풍 기준에서 빼거나, 게임 자산이 결과물에 옮겨 온 사례가 검토에서 발견될 때.
