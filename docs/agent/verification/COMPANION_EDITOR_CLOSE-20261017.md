# 편집창 닫힘 뒤 빅타민 지속 소실

Status: Complete — locally integrated and verified; later owner-authorized089 combined release pending. [PLAN-087](../plans/PLAN-20261017-087-companion-editor-close.md), [release record](COMPANION_SHAKE_RELEASE-20261017.md). Original local evidence below predates that authorization.

## 원인과 변경

일반 편집창은 빅타민을 강제로 밀거나 별도 게스트로 옮기지 않는다. 창을 닫으면 새 geometry 관측을 시작하는데, 화면 전환 중 첫 측정에서 같은 x의 안전한 발판을 찾지 못할 수 있다. 기존 parked 분기는 그 순간 표시를 숨기고 관측도 바로 종료했다. 눈에 보이는 창이어도 포커스가 없으면 parked 수면을 유지하므로, 이후 정상 발판이 돌아와도 다시 측정하지 못했다. DOM 소멸·이미지 해상도·원래 자리로 귀환 문제와 구분한다.

`components/poster/viewer-companion/viewer-companion.tsx:2113`의 공유 parked 복구를 보완했다. 일반 발판을 일시적으로 놓친 경우 기존 전환 추종 기간 동안만 관측을 유지하고, 기존 `parkedLayoutTimer`로 마지막 재검증을 한 번 요청한다. 마지막 검사에서 정상 발판을 찾으면 같은 x와 발판 높이에 수면 표시를 복구하며 관측을 종료한다. 계속 유효한 발판이 없으면 기존 숨김 안전 동작을 유지한다.

`viewer-companion.tsx:1917`의 최종 요청은 관찰자 식별 토큰을 소비한다. `lib/ui/viewer-companion/geometry.ts:459`에서 실제 mutation과 검증 요청이 합쳐져 `validationOnly=false`가 되어도 최종 콜백이 기간을 늘리거나 다시 예약하지 않는다. 일반 클릭·무관한 키 입력은 대기 검사만 취소하지 않는다. 실제 잡기/행동/집 이동·새 창·pause·포커스 인계는 기존 소유권을 우선한다.

명시적 놓기의 첫 충돌/실패, 집 주민, 숨바꼭질 게스트, 최초공개·숨김 탭의 소유권은 보존했다. 새 상시 loop·타이머 종류·API·DB/권한·공개 DTO·KST·1840 포스터 기하 변경은 없다.

## 수정 전 증거

현재 배포 `ecaa940f`와 같은 제품 소스의 production fixture build `FjBCgLBfH0mm62aMkRKPn`, Windows Chromium, 1920×780에서 재현했다. maple18 설정 후 native Ctrl+wheel 확대2회, 스크롤, 실제 P 배치, 일정 제목 dblclick, 실제 닫기 버튼을 사용했다. `document.hidden=false`, `document.hasFocus=false`는 보이는 창의 비활성 상태를 모형화한 환경 stub이며 제품 상태·좌표·callback은 주입하지 않았다.

- formal 수정 전: 총142 표본 중133개가 숨김. 관측 시작151.8ms부터2350.9ms까지 숨김이 지속했고1.2초 이후70개 표본도 모두 숨김이었다. 동일 DOM은 유지됐다. 엄격한 회귀 단언이 실제 FAIL했다.
- 별도 scout: 닫힌 뒤132/132 표본 숨김. 집중 상태의 다른 실행에서는 약150ms 뒤 스스로 복구했다. 이 차이가 parked 경로를 특정했다.
- 원래 `HTMLElement.hidden` setter를 그대로 호출하며 읽기만 기록한 진단에서, `hidden=true` 호출 스택이 번들8743의 offset240352였다. 해당 바이트를 확인해 parked 발판 누락 분기 `support=""; … el.hidden=true; … offGeometry()`임을 확정했다. setter 동작을 대체하거나 실패 상태를 주입하지 않았다.
- 기존 넓은 창1920×1100의 일반 창 소유권 검사2개는 수정 전에도 PASS했다. 이 결과를 짧은 창/포커스 없는 닫힘 증거로 확대하지 않는다.

숨겨진 노드의 computed transform은 `none`이므로 이를 좌표로 해석하면 잘못된46/92가 나온다. formal 관측은 실제 inline transform을 읽어 이를 피했다. 최초 scout의 대상 선택 실패3건과 hidden probe 생성의 shell 문법/후속 config 오류는 하네스 실패로 구분해 보존했다.

실제 운영 편집실 탭은 읽기만 확인했다. 당시에는 이미 집으로 돌아온 상태여서 운영 세션에서 같은 실패를 재현했다고 주장하지 않는다. 해당 편집창·일정·설정을 변경하지 않았다.

## 수정 후 검증

격리 작업트리 `C:/Projects/VIC-086`, production fixture build `7EVIm2i3tgVWfqs-bJMVK`.

| 검사 | 결과 | 범위 |
|---|---|---|
| 새 닫힘 회귀 |6/6 PASS; viewport/동일 좌표 단언 보강 뒤6/6 재통과 |full/lite/reduced/off4, 닫힘 도중 무관 pointer/keyboard2 |
| 전체 unit |1,933/1,933 PASS |skip0, 제품 소스 동결 뒤 실행 |
| build/typecheck/lint |PASS |새 검사 타입 변환 오류2건을 unknown 경유로 고친 뒤 typecheck 재통과; 보강 뒤 typecheck/대상 lint 재통과 |
| 기존 상호작용 |13/13 PASS |일반 창 소유권2, 빠른 놓기8, 숨바꼭질 추출1, 일반 팝오버1, 잠든 상태 집기1 |
| 독립 검토 |차단0 |최종 검사 재무장·관찰 잔존 지적을 수정한 뒤 소스 재검토, 검사 QA 별도 |
| 문서 harness |PASS |235개 문서 링크·활성 수명주기·메모리 예산 검증 |

최종 full 실행은141 표본 중 잠깐 숨김6개 후 복구했고, 마지막 숨김은 관측 시작275.4ms였다.1.2초 이후 숨김0, 최종 좌표는 열려 있을 때와 같은(643.43,762)이었다. 새6개 모두 같은 DOM·화면 안의 같은 위치·수면·ZZZ 복구 및350ms 동안 pet DOM 쓰기0을 확인했다. 일시적 전환 중 숨김까지 전혀 없다는 증거는 아니다. 새 검사는 POST·실제 root/studio prefetch를 차단했고 POST0/pageerror0이었다. 기존 검사 일부의 읽기 전용 public prefetch까지 DB 요청0이었다고 주장하지 않는다.

스냅샷의 열린/닫힌 상태와 복구된 수면 표시를 직접 확인했다. 원본 formal 전후 JSON/PNG/trace 및 report는 작업트리 `.scratch-pw/087-*`에 보존한다. 메인 `.scratch-pw/companion-087/`에 report·전후 관측·주요 trace를 복사했다. renderer와 새 검사만 메인에 통합했으며 현재 운영 이후 작업트리에 반영된14개 파일과 새 검사까지15개 바이트 일치를 확인했다(`build-source-equivalence.json`). 기존 사용자 아트/미리보기/사후 문서 작업은 보존했다.

## 한계와 전달 상태

의도적으로 안전한 발판이 전혀 없는 상태까지 강제 표시하지 않는다. 검사는 지속 소실 복구·같은 세계 위치·유한 전환 뒤 DOM 안정성을 다룬다. 전체 JS 작업0·실제 OS 비활성 창·실방송 OBS 프레임·모든 창/스크롤/최초공개 순열을 증명하지 않는다. 서버·RLS·권한·실제 활동 저장 경로는 변경하지 않았다.

별도 커밋/푸시/운영 배포는 하지 않았다. 운영 버전은 `ecaa940f`다.
