# Active ExecPlan

Plan ID: PLAN-20260725-001
Status: **In Progress** — G0 3차(G0-rr) "착수 가능" 판정(2026-07-25). M1부터 순차 진행
Task Risk: L2 (M3·M4a 공개 DTO 경계는 L3 성격 — 보안 게이트 별도)
Created / Updated: 2026-07-25 (v2: Codex G0 1차 결과 반영)

## Objective

방송 가독성 개선 2종(토리님 승인, 2026-07-25):
**A안** — 달력 영역 한정 Ctrl+휠 단계 확대(100/125/150%): 7열 유지, CSS 변수로 글자·밀도만 조절.
확대 시 부제목 접기(+N) + 상세 팝오버(고정 가능).
**B안** — 방송 판서 창: 같은 창 전체화면 불투명 모달. 펜/형광펜/지우개/색/굵기/고정 3레이어/undo·redo,
판서 창 내부에서 날짜 다중선택 → 날짜순 나란히 배치. 서버·클라이언트 어디에도 무저장, 닫으면 소멸.

## G0 1차 반영 — 확정 결정 (v2)

| ID | 결정 | 근거(BLOCKER 해소) |
|---|---|---|
| D1 | 판서 = **같은 창 전체화면 불투명 모달**. 별도 브라우저 창·postMessage 경로 전면 제외 | 창 형태 모호성 제거. 배경 불투명이라 뒤 비공개 일정 화면 노출 차단 |
| D2 | 날짜 선택 소유자 = **판서 모달 내부**. 모달 안에 공개 DTO로 새로 렌더한 미니 월 그리드 + 자체 `useCellRangeSelect` 인스턴스. 편집 그리드/포스터의 선택 상태와 완전 분리 | 선택 상태 소유자 확정. 편집실 DOM 캡처·복제 금지 충족 |
| D2-b | `useCellRangeSelect` 훅 확장(v3): `onDocDown`([178-182행](../../../lib/calendar/use-cell-range-select.ts))이 그리드 밖 pointerdown에서 선택을 즉시 지우므로, **예외 영역 옵션**(`exemptRefs: RefObject<HTMLElement>[]` — "판서판으로 보내기" 버튼·도구줄은 해제 안 함) + **명시 API**(`getSelected()`/`clearSelection()`) 추가. 기존 소비처(편집 그리드·포스터)는 옵션 미지정 시 동작 불변 | 보내기 버튼 click 전에 선택이 사라지는 잔존 BLOCKER 해소. 회귀 없는 opt-in 확장 |
| D3 | 판서 데이터 소스 = **서버 공개 스냅샷 `viewerModePreview`** (public-loader `mapEvent`가 teaser redaction 수행: [public-loader.ts:348-363](../../../lib/schedules/public-loader.ts)). 낙관적 studio `events` 재가공 금지 | teaser 유출 차단 — 클라이언트 재구현 없이 서버 redaction 그대로 사용. 신선도(방금 만든 일정 미반영)는 방송 도구 특성상 수용 |
| D4 | 캔버스 = **stroke 명령 벡터 모델**(좌표 명령 저장→재그리기). CSS 크기와 backing store DPR 분리, 리사이즈 시 명령 재생. undo/redo = 명령 스택(ImageData 스냅샷 금지) | 리사이즈 소실·메모리 급증 방지 |
| D5 | 레이어 = 고정 3장(배경/형광펜/펜) + 표시·잠금 토글만. 임의 추가·재정렬 제외 | 축소 권고 수용 |
| D6 | DTO에서 heartCount 제외. 캔버스 자유 확대·이동 제외 — 날짜 카드 자동 맞춤 + "화면 맞춤" 버튼만 | 최소 필드 원칙·초기 범위 축소 |
| D7 | M4에서 DTO 미완성 시 **임시 raw event 전달 절대 금지** — M3(G2) 통과가 M4a 착수 조건 | 순서 리스크 명문화 |

부수 발견(본 계획 범위 밖, 별도 보고): 기존 viewerMode 미리보기의 낙관적 경로
([studio-shell.tsx:4620-4629](../../../components/studio/studio-shell.tsx))는 teaser redaction 없이
`public_title`을 노출할 수 있음 — 기존 잠재 이슈로 CURRENT_STATE 알려진 이슈에 기록 예정.

## Verifiable End State

- 달력 위 Ctrl+휠 → 달력만 100→125→150% 단계 확대(트랙패드 delta 정규화·누적 임계값으로 1단계씩만).
  달력 밖 Ctrl+휠은 브라우저 기본. 헤더에 `− / 100% / +` 키보드·마우스 겸용 컨트롤 + 현재 비율 표시.
- 100% = 현재 화면 동일. 125%+ = 주제목 확대, 부제목 접힘 `+N`, hover/focus 팝오버(Escape 닫기,
  경계 보정, 고정은 팝오버 핀, 닫힘 시 포커스 반환). 카드 클릭 = 기존 편집 흐름 그대로.
- 드래그 진행 중 확대 변경 차단. 확대 변경 시 FLIP rect 캐시 초기화. 드래그 ghost도 확대 반영.
- 모바일 전환 시 확대 상태 초기화 — 판정은 `matchMedia(MOBILE_QUERY)` **전체**(640px + 저높이·coarse
  pointer 조건 포함), raw 640 비교 금지. 월 이동 시 판서 내 선택 초기화.
- 폭 매트릭스(1180/1280/1920 × 아바타 on/off × 편집창 open/closed × 3배율)에서 카드 겹침·열 붕괴 없음.
- 미리보기 관리자 오버레이(owner/developer)에만 "방송 판서" 진입. 공개 페이지·export surface 흔적 0(자동 검증).
- 판서 모달: 불투명 배경, 공개 DTO로만 렌더, 도구 전부 동작, 떨어진 날짜 선택→날짜순 배치.
- 판서 컴포넌트는 `BroadcastPanelDay[]` 등 공개 DTO props만 — Studio 타입·studio-loader import 0(리뷰 체크).
- 유출 테스트: 최상위+중첩 key 화이트리스트(BroadcastPanelTag 포함), canary 문자열(privateMeta/
  editorNote/proposal류에 주입 후 직렬화 전체 부재 단언), 비공개·draft 이벤트 부재 단언,
  **미공개 teaser = 이벤트는 존재하되 실제 제목·설명·태그·기간 정보 부재** 단언 — 전부 통과.
- 판서 데이터/그림, Clipboard·localStorage·sessionStorage·IndexedDB·URL 어디에도 잔존 금지.
  닫기 = unmount + 명령 스택·캔버스 메모리 해제(dispose 테스트).
- 판서 열림 동안 편집실 전역 단축키(Ctrl+Z/C/V 등) 최상위에서 차단, 닫으면 원상복구(테스트).
- `tsc --noEmit` / `lint` / `next build` exit 0, vitest·e2e 통과.

## Scope / Out of Scope

포함: 위 전부 + 마일스톤별 테스트 + QA 체크리스트 + ADR.
제외: 별도 브라우저 창·postMessage, 판서 영속화·복구, 시청자 노출, 모바일 판서, 레이어 임의 추가,
캔버스 자유 줌, heartCount, 175%+ 단계(피드백 후), 기존 미리보기 teaser 이슈 수정(별도 건).

## Relevant Context

- [studio-shell.tsx](../../../components/studio/studio-shell.tsx) — 그리드·전역 단축키(3566-3578)·viewerMode(4607~)·드래그/FLIP
- [studio-shell.css](../../../components/studio/studio-shell.css) · [month.ts](../../../lib/calendar/month.ts)(`splitEventTitle`) · [use-cell-range-select.ts](../../../lib/calendar/use-cell-range-select.ts)
- [public-loader.ts](../../../lib/schedules/public-loader.ts) — `mapEvent` teaser redaction(단일 출처)
- [breakpoints.ts](../../../lib/ui/breakpoints.ts) — MOBILE_QUERY 640 / POSTER_AGENDA_QUERY 1040
- Rules: `.claude/rules/public-private-boundary.md`(spread 금지) · `.claude/rules/export.md` · `docs/agent/domain-rules/SECURITY.md`

## Assumptions

| 가정 | 영향 | 근거 | 상태 |
|---|---|---|---|
| 확대 = CSS 변수(폰트·패딩·gap·배지·+N·스코어 줄 포함 전 목록 M1에서 명시), transform 금지 | 좌표 무결 | 삽입선 좌표 기반 | Confirmed |
| ~~CSS 변수 상위 shell 스코프면 ghost 상속~~ → **틀림(G0-r)**: ghost는 body에 portal되어 shell 자식 아님. v3 = ghost 생성 시 계산된 확대 변수를 ghost 요소에 직접 복사(또는 변수를 `body` 스코프로) + ghost 크기 일치 수동 검증 M1 포함 | ghost 크기 일치 | G0-r 지적 | Confirmed(수정) |
| viewerModePreview 스냅샷에 판서에 필요한 필드(제목·부제·날짜·태그색·형식) 충분 | 충분함 | public-loader select(118행)·`PublicScheduleEvent`([schedule-types.ts:51-77](../../../lib/domain/schedule-types.ts)) 대조 완료 | Confirmed |
| 확대 비율 세션 한정(새로고침 초기화) | 저장 불필요 | 방송 일회성 | Confirmed |

## Ambiguity Register — M0에서 전부 해소 완료 (2026-07-25)

| ID | 질문 | 확정 |
|---|---|---|
| Q1 | DTO 필드 목록 | **아래 M0 화이트리스트** — `PublicScheduleEvent` 부분집합 + 중첩 `BroadcastPanelTag[]`(변환 시 색 해석 완료, raw 팔레트 미전달) |
| Q2 | 다일 일정 표시 | 각 선택 날짜에 표시 + "n일차/총 m일" 배지. linkNext 연속 막대는 미적용(나란히 배치엔 무의미) |
| Q3 | 선택 범위 | 현재 월만(전월/익월 회색 날짜 제외), 월 이동 시 선택 초기화 |
| Q4 | 팝오버 고정 | hover/focus 팝오버 내 핀 버튼. 카드 클릭 = 기존 편집 흐름 불변 |

### M0 확정 — BroadcastPanelEvent 화이트리스트

```
BroadcastPanelDay  = { dateKey: string; events: BroadcastPanelEvent[] }
BroadcastPanelEvent = {
  id, publicTitle, publicDescription?, startsAt, endsAt?, endDateKey?,
  isAllDay, isTentative?, category, sortOrder,
  tags: BroadcastPanelTag[],          // v3: tagIds 대신 색 해석 완료된 시각 정보
  teaser?, teaserRevealAt?   // teaser stub은 공개 포스터와 동일한 '가림 룩'으로 렌더(제목 없음 → 안전)
}
BroadcastPanelTag = { id, label, colorHex, isPrimary }   // 변환 단계에서 tag-visual resolver로 산출
```

태그 색 계약(v3): DTO에는 raw tag/palette 배열을 넘기지 않는다. **변환 함수가 공개 스냅샷의
태그·팔레트로 색을 해석해 `BroadcastPanelTag`(위 4필드만)로 내장** — 판서 컴포넌트는 resolver·팔레트
접근 불필요. `BroadcastPanelTag`도 이벤트와 동일한 화이트리스트·canary 유출 테스트 대상.

제외(존재하지만 안 넘김): heartCount(D6), isSupport/supportUrl(판서 불필요·최소 원칙),
linkNext(Q2), variantGroupId/variantLabel(불필요), status/visibilityScope(전달 전 public·non-draft
필터 완료가 전제 — 필드 자체를 안 실어 오용 차단), tagIds/primaryTagIds(tags로 대체).

날짜 계산(v3): `n일차/총 m일`·날짜 비교는 브라우저 로컬 Date 절단 금지 — 기존 KST date-key
헬퍼만 사용(비협상 1번: 시간은 항상 KST).

## Milestones

### M0 — 계약 확정 (구현 0, 문서만) — **완료(2026-07-25)**
- DTO 화이트리스트·다일 규칙·선택 정의·팝오버 고정 트리거 확정(Ambiguity Register 참조).
  CSS 변수 적용 범위 목록은 M1 첫 커밋 메시지에 명시(카드 폰트·padding·line-height·gap·배지·+N·스코어 줄).
- Validation: 본 문서 v2 갱신 완료. 남은 것 = G0-r 재검토 통과.

### M1 — A안 코어: 달력 한정 단계 확대
- Goal: non-passive wheel(달력 한정, Ctrl+휠만 preventDefault), deltaMode 정규화 + 누적 임계값/cooldown,
  `− / 100% / +` 헤더 컨트롤(키보드 접근 가능), CSS 변수 세트(M0 목록 전체), **ghost에 확대 변수
  직접 복사(portal이라 상속 안 됨)**, 드래그 중 확대 차단, FLIP rect 캐시 초기화,
  `matchMedia(MOBILE_QUERY)` 전체 조건으로 모바일 전환 시 초기화.
- Validation: vitest — wheel 정규화·단계 전이 단위 테스트. 수동 — 폭 매트릭스, 드래그/저장 회귀. tsc/lint/build.
- Rollback: 커밋 revert.

### M2 — A안 밀도: 부제목 접기 + 팝오버
- Goal: 125%+ 주제목 확대·부제목 접기·`+N`(splitEventTitle 재사용), hover/focus 팝오버
  (aria-describedby, Escape, 경계 보정, 핀 고정, 포커스 반환). 카드 클릭=기존 편집 유지.
- Validation: vitest(접기 계산) + 수동 a11y 시나리오 + 회귀(클릭-편집·삽입선). tsc/lint/build.
- Rollback: 커밋 revert.

### M3 — B안 경계: 공개 DTO + 유출 테스트 (L3)
- Goal: `BroadcastPanelDay`/`BroadcastPanelEvent`/`BroadcastPanelTag` — viewerModePreview에서
  **필드 명시 나열**로 구성(spread 금지). 태그 색은 변환 단계에서 resolver로 해석해 내장(M0 v3 계약).
  날짜 계산은 KST date-key 헬퍼만. 유출 테스트: ①중첩 포함 key 화이트리스트 정확 일치(Tag 포함)
  ②canary 직렬화 전체 부재 ③비공개·draft 부재 ④미공개 teaser는 **존재하되 실제 제목·설명·태그·기간 부재**.
- Validation: `vitest run` 통과 + **G2 통과 전 M4a 착수 금지**(D7). G2 확인 항목에
  "낙관적 `previewSchedule.events`([studio-shell.tsx:4620-4629](../../../components/studio/studio-shell.tsx)) 미참조" 포함.
- Rollback: 파일 삭제(소비자 없음).

### M4a — B안 셸: 모달 + 날짜 배치
- Goal: 미리보기 관리자 오버레이 진입 버튼(owner/developer, export 밖) → 전체화면 불투명 모달
  (`role="dialog"` + `aria-modal` + 포커스 trap + 최초 포커스 + 닫은 뒤 진입 버튼 포커스 반환 +
  body scroll lock). 모달 내부: 공개 DTO 미니 월 그리드 + 자체 useCellRangeSelect(**D2-b 훅 확장:
  exemptRefs + getSelected/clearSelection, 기존 소비처 회귀 테스트 포함**) → "판서판으로 보내기" →
  날짜순 나란히. 전역 단축키 최상위 차단/복구. Studio 타입 import 0.
  `clearSelection()`은 Set 외에 lastAnchor·진행 중 drag·click suppression까지 초기화(월 이동 후
  Shift 선택이 이전 달 anchor 재사용 금지). Escape 우선순위 = 선택 있으면 선택 해제만, 없으면 모달 닫기.
- Validation: vitest(단축키 차단/복구, 훅 확장 — exempt 영역 클릭 시 선택 유지·기존 동작 불변)
  + **호출 인자 정적 검증(G2 WARN)**: `toBroadcastPanelDays(` 호출부가 `schedule.viewerModePreview`
  만 넘기는지 소스 정적 테스트로 고정(낙관적 previewSchedule/events 전달 차단)
  + 수동(떨어진 토·일 배치, 월 이동 초기화, 포커스 trap). tsc/lint/build. → **G3a 중간 검토**.
- Rollback: 버튼 연결 1곳 제거.

### M4b — B안 판서 엔진 (G3a 통과 후 착수)
- Goal: stroke 명령 모델(D4), DPR backing store(**DPR cap 2**), 리사이즈 재생, 펜/형광펜/지우개/6색/굵기,
  stroke point 단순화(최소 거리 임계값), 고정 3레이어(표시·잠금), undo/redo 명령 스택(**undo 이력만
  상한 200 — 초과 시 오래된 stroke는 장면에 남기고 undo 불가로만 전환, 화면에서 삭제 금지**),
  backing-store 총 픽셀 상한(4K×DPR2 대비 — 필요시 배경 레이어는 DOM 렌더), 화면 맞춤 버튼.
- Validation: vitest(명령 스택 push/undo/redo/상한/dispose, 리사이즈 재생) + 수동 드로잉. tsc/lint/build.
- Rollback: 커밋 revert(M4a 셸은 유지 동작).

### M4c — B안 통합·소멸 보장
- Goal: 닫기 = unmount + 메모리 해제(dispose 테스트), storage/clipboard/URL 잔존 0 확인,
  reduce-motion·모션 토큰, 공개 페이지·export 흔적 0 자동 검증(export e2e에 단언 추가).
- Validation: vitest dispose + e2e export 단언 + 수동 QA 체크리스트. tsc/lint/build.
- Rollback: 커밋 revert.

### M5 — 통합 QA·문서
- Goal: DoD 순회, 역할별 점검(viewer/manager/worker 노출 범위), CURRENT_STATE 갱신(+기존 미리보기
  teaser 잠재 이슈 기록), 판서 QA 체크리스트, 경계 결정 ADR 1건, 본 계획 completed/ 이관.
- e2e/수동 스모크 필수 항목(G1-r 합의 — 단위 DOM 테스트 생략의 대가): ①우클릭 잇기·끊기 드래그 중
  팝오버·확대 차단 ②+N Enter가 편집창을 열지 않음 ③팝오버 내부 스크롤 유지 ④핀 팝오버 자동
  종료 시 앵커 포커스 복귀 ⑤wheel 리스너 달력 한정·viewer/모바일 detach
  ⑥판서 열림 중 뒤로가기 = 판서만 닫힘(내부 오버레이 hasInnerOverlay와의 우선순위 포함, G3a-r)
  ⑦판서 키보드 토글 후 Shift+클릭 확장 기준 = 마지막 토글 칸
  ⑧실물 Studio export 경로(공식 포스터 PNG 생성)에서 판서·확대 무흔적 — fixture 단언(poster.spec)
  만으론 실제 export 파이프라인을 못 본다(G3b) ⑨판서 가로 스크롤 시 카드·판서 좌표 일치.
- Validation: 전체 Validation Commands + e2e.

## Codex 더블체크 게이트 (미통과 시 수정→재검토 반복, 통과 전 다음 단계 금지)

| Gate | 시점 | 대상 | 관점 |
|---|---|---|---|
| **G0-r** | M0 완료 후 | 본 계획 v2 + M0 확정 내역 | 1차 BLOCKER 해소 여부 재검토 |
| **G1** | M1+M2 diff | A안 diff | 회귀(드래그·FLIP·ghost·큐), wheel 범위·정규화, a11y |
| **G2** | M3 완료, M4a 전 | DTO+유출 테스트 | **보안 전담** — 화이트리스트(Tag 포함)·canary·teaser 내용 부재·spread 부재·낙관 경로 미참조 |
| **G3a** | M4a 완료, M4b 전 | M4a diff | 중간 검토 — DTO-only 렌더·불투명·단축키 경계·훅 확장 회귀·a11y |
| **G3b** | M4b+M4c diff | 판서 엔진·통합 diff | 명령 모델·메모리 상한·소멸 보장·storage 잔존 |
| **G4** | 커밋 직전 | 전체 diff + build 로그 | 최종 회귀·exit code·문서 |

## Final Acceptance Criteria

- [ ] Verifiable End State 전 항목
- [ ] 전 게이트(G0 계열·G1·G2·G3a·G3b·G4) 통과 기록(재검토 횟수 포함, Progress Log)
- [ ] 유출·dispose·단축키 복구 테스트 vitest 포함·통과
- [ ] export e2e에 판서·확대 부재 단언 포함·통과
- [ ] CURRENT_STATE + ADR + completed/ 이관

## Validation Commands

```bash
npx tsc --noEmit && npm run lint && npm run build   # exit code 직접 확인
npx vitest run
npm run test:e2e
```

## Rollback Strategy

마일스톤당 커밋 1개(M1→M2→M3→M4a→M4b→M4c→M5), 독립 revert.
판서는 진입 버튼 1곳 해제만으로 전체 격리 가능.

## Progress Log

### 2026-07-25
- v1 작성 → Codex G0 1차: "계획 수정 후 재검토 필요" (BLOCKER 8건).
- v2: D1~D7 확정(모달 확정, 선택 소유자=모달 내부, 소스=서버 스냅샷, stroke 벡터 모델,
  고정 3레이어, heartCount 제외, raw event 금지), M0 신설, M4 3분할, 마일스톤별 테스트 배분,
  유출 테스트 심화(중첩+canary+teaser). 기존 미리보기 teaser 잠재 이슈 발견(별도 기록 예정).
- M0 수행 완료: DTO 화이트리스트(`PublicScheduleEvent` 부분집합) 확정, Q1~Q4 해소,
  viewerModePreview 필드 충분성 Confirmed.
- G0-r 2차: "계획 수정 후 재검토 필요" (미해소 3: D2 pointerdown 선해제 잔존·태그 색 계약 부재·
  teaser 테스트 문구 충돌 / 신규 WARN 7).
- v3: D2-b 훅 확장(exemptRefs+명시 API) 신설, `BroadcastPanelTag` 색 계약(변환 시 resolver 해석,
  raw 팔레트 미전달), teaser 단언 = "존재하되 실제 내용 부재"로 수정, ghost 변수 직접 복사로 정정,
  DPR cap 2·stroke 단순화·undo 상한 200, 모달 a11y(M4a), MOBILE_QUERY 전체 조건, KST date-key 헬퍼
  강제, G3 → G3a(M4a 후 중간)/G3b(M4b+c 후) 분리, G2에 낙관 경로 미참조 확인 추가.
- G0-rr 3차: **"착수 가능"** — 남은 BLOCKER 없음. 신규 주의 5건 반영: Q1 표현 정정,
  undo 상한=이력만 폐기(stroke 장면 유지), clearSelection 전체 상태 초기화, backing-store 픽셀 상한,
  Escape 우선순위. → Status: In Progress, M1 착수.
- **M1 구현 완료**: `lib/ui/calendar-zoom.ts`(순수 로직: 단계 전이·delta 정규화·누적 임계값 90px+
  cooldown 220ms 스테퍼) + `tests/unit/calendar-zoom.test.ts`(12 tests). studio-shell:
  달력 패널 한정 non-passive wheel(항상 preventDefault — 일부 누출 방지), `--cal-zoom` CSS 변수
  (min-height·폰트·패딩·gap·day-mark, transform 0), 드래그 중 차단, FLIP rect 캐시 초기화,
  ghost에 변수 직접 복사, MOBILE_QUERY 전체 조건 초기화, buildbox에 −/%/＋ 컨트롤,
  확대 중 월드컵 장식 자동 숨김(기존 TODO(A안) 이행).
- **M2 구현 완료**: 125%+에서 서브 → `+N` 칩(+dots 한 줄, span-cont 높이 유지), hover/focus
  팝오버(140ms 지연 close로 카드→팝오버 이동 허용, 경계 클램프, 위/아래 뒤집기), +N/📌 핀 고정,
  Esc 캡처(팝오버만, 전파 중단) + 포커스 카드 복귀, 스크롤/배율 복귀/달 이동 시 정리,
  reduce-motion 대응. 100%는 기존과 동일 렌더.
- 검증: `tsc` 0 · 변경 파일 eslint 0(.vercel 잔재물 에러는 gitignore된 로컬 아티팩트) ·
  `next build` exit 0 · vitest 201/201. 다음 = G1.
- **G1 1차: "수정 후 재검토"** (BLOCKER 5·WARN 7·NIT). 전부 반영:
  ①`.cal-zoom-ctl` pointer-events:auto 복구(buildbox none 상속으로 클릭 불가였음)
  ②드래그 시작 시 팝오버 즉시 닫기(elementFromPoint 가로채기 방지)
  ③카드 Enter에 target===currentTarget 가드(+N Enter가 편집창 동시 오픈하던 것)
  ④팝오버 내부 스크롤은 닫힘 제외(긴 세부 읽기 가능)
  ⑤업도움 띠 top·레인 간격·목록 paddingTop에 calZoom 배율(날짜 헤더 겹침)
  ⑥팝오버 정리 조건 확장: 배율 변경 전체·편집창 상태·viewerMode·resize
  ⑦앵커 '요소' 저장으로 포커스 복귀(멀티데이 첫 칸 오귀속 방지)
  ⑧위치 실측 배치(useLayoutEffect, visibility:hidden→measure→표시)
  ⑨role 분리: hover=tooltip, 핀=dialog ⑩스테퍼 idleGapMs 300(+테스트, 13개)
  ⑪미정 칩·teaser 🔮 배지도 배율(편집실 스코프만 — 포스터 무영향)
  ⑫지연 close 타이머 실행 시점 상태 재확인.
  `scripts/_ins.mjs`는 세션 이전부터 있던 untracked 잔재 — 커밋 대상 아님(제거는 사용자 확인 후).
  검증: tsc 0 · lint 0 · build 0 · vitest 13/13. 다음 = G1-r.
- **G1-r 2차: "수정 후 재검토"** (미해소 3·신규 2). 반영:
  ①우클릭 잇기·끊기(g.moved 전환) 시 팝오버 닫기 + wheel 가드에 rightGestureRef.moved 추가
  ②role="dialog"로 통일(hover도 — 버튼 있는 tooltip은 부적합)
  ③leaveZoomPeek가 기존 타이머 먼저 취소 + 상태 전환 effect에서도 cancelPeekClose
  ④자동 종료(스크롤·resize) 시 포커스가 팝오버 안이면 앵커 복귀
  ⑤업도움 띠 높이 17·글자 10.5도 편집실 스코프 배율.
  M5 스모크 필수 5항목 명시(우클릭 드래그·+N Enter·팝오버 내부 스크롤·핀 포커스 복귀·리스너 범위).
  검증: tsc 0 · lint 0 · build 0. 다음 = G1-rr.
- **G1-rr 3차: "통과 — 커밋 가능"**. NIT(주석 문구) 수정 후 **A안 커밋 `15181d4` push**
  (staging은 파일 명시 — scripts/_ins.mjs 제외 유지). M1·M2는 diff가 뒤섞여 논리 단위(A안)로
  1커밋 통합 — revert 단위도 A안 전체라 오히려 단순.
- **M3 구현 완료**: `lib/schedules/broadcast-dto.ts` — `toBroadcastPanelDays(snapshot, dateKeys)`,
  필드 명시 구성(스프레드 0), 소스 = viewerModePreview 전제(주석 계약), 태그는 resolver로 색
  해석 후 `BroadcastPanelTag{id,label,colorHex,isPrimary}` 내장, 업도움 배너 제외, dateKey
  dedup+정렬, 멀티데이 n일차/총 m일(Date.UTC 산술 — 로컬 TZ 무관), 런타임 public·non-draft
  이중 필터. `tests/unit/broadcast-dto.test.ts` 10 tests: 3계층 키 화이트리스트 정확 일치,
  canary 8종 직렬화 부재, 금지 키 부재, 비공개·draft 부재, teaser stub '존재하되 내용 부재',
  배치·태그 계약, 정적 import 경계. 검증: tsc 0 · lint 0 · vitest 212/212. 다음 = G2.
- 사이드: 확대 컨트롤 잘림 수정(`57f2c75`, 가로 한 줄) + 확대 UX 3건(`effd28c`, 하단 플로팅
  배율·핀 버튼 제거·팝오버 폭 내용 맞춤 — 사용자 피드백).
- **G2 1차: "수정 후 재검토"** (BLOCKER 2·WARN 3). 반영:
  ①**fail-closed teaser 마스킹** — `maskTeaser()`를 날짜 배정 '전'에 적용(가려진 기간이 다른
  날짜로 번지는 것까지 차단) + toPanelEvent에 이중 방어. 서버 stub(mapEvent)과 동일 형태:
  제목·설명·태그·시간·기간·카테고리("stream" 중립값) 전부 가림
  ②unredacted teaser 픽스처(canary 제목·설명·태그·기간·시각) + 강제 마스킹 단언(7/5 번짐 부재 포함)
  ③stub 단언 강화(startsAt 자정·isAllDay·category·dayIndex·endsAt)
  ④레거시 "embargo" scope 적대 픽스처 추가
  ⑤M4a Validation에 호출 인자 정적 검증 명시(viewerModePreview만 허용).
  검증: tsc 0 · lint 0 · vitest 11/11. 다음 = G2-r.
- **G2-r: "통과 — M4a 착수 가능"**. NIT 주석 정합화 후 **M3 커밋 `3c8cd46` push**.
- **M4a 구현 완료**:
  - 훅 확장(D2-b): `exemptRefs` 옵션(보내기 버튼 등 예외 영역) + `getSelected()`/
    `clearSelection()`(anchor·드래그·suppressClick까지 리셋). 기존 소비처 시그니처 불변.
  - `components/studio/broadcast-panel.tsx/.css`: 전체화면 불투명 모달(role=dialog·aria-modal·
    Tab trap·최초 포커스·body scroll lock), 미니 달력 자체 선택 인스턴스(현재 월만·회색 제외),
    "판서판으로 보내기"(교체 방식·날짜순), Esc 우선순위(선택 있으면 해제만→없으면 닫기),
    teaser는 가림 룩(🔮 ???), n일차/총 m일 배지, 요일은 date-key 자체 요일(UTC 자정 해석).
  - studio-shell: 진입 버튼(미리보기 오버레이, owner/developer·PC만), dynamic import,
    `toBroadcastPanelDays(schedule.viewerModePreview, monthKeys)` 호출(열 때만 memo),
    닫으면 sent 초기화+트리거 포커스 복귀, 전역 단축키 가드(broadcastOpenRef — 열림 동안
    Ctrl+S/Z/C/V·Alt+N·Esc 전면 차단, 닫히면 자동 복구), CSS는 (studio) layout에서 import.
  - `tests/unit/broadcast-callsite.test.ts` 3 tests: 호출 인자 = viewerModePreview 고정,
    낙관 경로 전달 금지, 판서 컴포넌트 import 경계(StudioSchedule 타입 포함 금지).
  - 훅 확장 DOM 단위 테스트는 jsdom 미설치로 생략(G1-r 합의 연장) — M5 스모크에 포함.
  검증: tsc 0 · lint 0 · build 0 · vitest 216/216. 다음 = G3a.
- **G3a 1차: "수정 후 재검토"** (BLOCKER 3·WARN 3). 반영:
  ①모달 루트 애니메이션 제거 — 배경 즉시 불투명, 등장 연출은 내부 콘텐츠(`> *`)만
  ②판서를 히스토리 스택에 한 칸 추가(stackDepth + popstate 최우선 분기 = 판서만 닫고 미리보기
  유지) + 안전망(viewerMode 종료 시 판서·가드 강제 소멸)
  ③훅 `escapeClears:false` 옵션 — 판서 Esc는 단일 핸들러가 결정(선택 있으면 clearSelection,
  없으면 닫기) → 리스너 순서 경쟁 제거
  ④훅 Esc·바깥 클릭 해제도 full reset(clearAll) — lastAnchor 잔존 제거
  ⑤회색 날짜: data-cell-index 미부여 + pointer-events:none — 선택 자체에서 배제
  ⑥키보드 날짜 선택: 셀 role=checkbox·tabIndex·Enter/Space→`toggleIndex()`(신규 훅 API,
  Ctrl+클릭과 동일 토글) + focus-visible 링.
  검증: tsc 0 · lint 0 · build 0 · vitest 216/216. 다음 = G3a-r.
- **G3a-r: "통과 — M4b 착수 가능"** (WARN 2 — 즉시 반영: toggleIndex가 Shift 앵커 동기화,
  hasInnerOverlay 우선순위는 M5 스모크 ⑥⑦로). **M4a 커밋 `9717a57` push**.
- **M4b 구현 완료**: `lib/broadcast/stroke-engine.ts` — 순수 벡터 모델(strokes/undo/redo/
  undoFloor 상한 200=이력만 폐기·장면 유지, point 단순화 2px, backingScale=DPR cap 2+총 픽셀
  상한 4096×2304, drawStroke=지우개 destination-out·형광펜 α0.45·상태 복원) + 9 unit tests.
  panel: 레이어 = 배경(날짜 카드 DOM — 캔버스 0장, 메모리 0)+형광펜/펜 캔버스 2장(표시·잠금),
  ResizeObserver→backing 재설정+명령 재생, 도구줄(선택/펜/형광펜/지우개·6색·굵기 3단·레이어·
  undo/redo·전체 지우기), 판서 내 Ctrl+Z/Shift+Z/Y, 지우개는 잠긴 레이어 회피, unmount 시
  store.dispose().
- **M4c 구현 완료**: 소멸 계약 정적 단언(localStorage·sessionStorage·indexedDB·clipboard·
  cookie·pushState·URLSearchParams 미사용 — broadcast-callsite.test.ts), export/공개 포스터
  무흔적 e2e 단언(tests/visual/poster.spec.ts — .broadcast-panel·.bp-toolbar·.cal-zoom-* 부재).
  검증: tsc 0 · lint 0 · build 0 · vitest 226/226. 다음 = G3b.
- **G3b 1차: "수정 후 재검토"** (BLOCKER 3·WARN 6·NIT 2). 반영:
  ①backingScale 하한 1 제거(scale<1 허용, 하한 0.25) + 5K/8K/횡장보드 테스트
  ②보드 스크롤 좌표면 통일 — .bp-board-inner(width:max-content) 안에 카드+캔버스 3장+입력면,
  보드가 스크롤 주체(strip 자체 스크롤 제거) → 카드·판서 항상 동좌표
  ③렌더 전략 교체 — committed bitmap 유지: 펜·지우개 rAF 증분 세그먼트 렌더, 형광펜은 라이브
  캔버스에 현재 stroke만(이음매 방지)→뗄 때 1회 커밋, 전체 재생은 undo/redo/clear/resize만
  ④전체 지우기 2단계 확인(무장 3초, 잠긴 레이어 포함 경고 title)
  ⑤activePointerId 추적+다중 포인터 가드+lostpointercapture 처리
  ⑥메모리 계약 명문화(1장 상한×3장 = 전체 예산, 엔진 주석)
  ⑦리사이즈 rAF 병합+동일 크기 skip ⑧toolbar role 제거(group — roving tabindex 불요)
  ⑨M5 스모크 ⑧⑨ 추가(실물 export 경로·스크롤 좌표 일치)
  ⑩NIT: undo floor 경계·재생 순서 테스트 추가, store 지연 초기화.
  검증: tsc 0 · lint 0 · build 0 · vitest 229/229. 다음 = G3b-r.
- **G3b-r 2차: "수정 후 재검토"** (신규 BLOCKER 3·미해소 1·신규 WARN 1). 반영:
  ①보드 overflow:auto — 세로도 inner째 스크롤(긴 카드 잘림 해소)
  ②`finishLiveStroke()` 신설 — undo/redo/전체 지우기/리사이즈/화면 맞춤 직전에 그리던 획을
  완성 커밋(replay가 live를 날려 선이 증발하던 것 차단), endDraw도 이를 경유
  ③캔버스 DOM 순서 hl→라이브→pen(형광펜 진행 중·커밋 후 겹침 순서 동일 — 튐 제거)
  ④D6 '화면 맞춤' 버튼 구현(컬럼 유동 폭, 전환 전 획 완성, 어긋남 안내 title)
  ⑤soft cap 계약 명문화(하한 0.25까지 유효, ≈1.5억 px² 초과는 가독성 우선 — 실사용과 두 자릿수 여유).
  검증: tsc 0 · lint 0 · build 0 · vitest 229/229. 다음 = G3b-rr.
- **G3b-rr 3차: "수정 후 재검토"** (화면 맞춤 BLOCKER 2). 반영:
  ①판서(stroke) 존재 시 화면 맞춤 전환 금지(fail-closed — 버튼 disabled + 클릭 재확인,
  좌표 변환은 컬럼별 비균등이라 불가) ②fit 모드 min-width 140→0 — 컬럼이 몇 개든 가시폭에
  반드시 다 들어와 캔버스 밖 카드가 생기지 않는다(글자 줄바꿈 감수, opt-in 보기).
  검증: tsc 0 · lint 0 · build 0. 다음 = G3b-rrr.
- **G3b-rrr 4차: "수정 후 재검토"** (BLOCKER 1 — undo 전량 후 전환→redo로 옛 좌표 복원 우회).
  반영: 잠금 조건에 `store.canRedo()` 포함(버튼 disabled + 클릭 재확인 모두). 전체 지우기는
  redoStack도 비우므로 그 경로로만 잠금 해제. 검증: tsc 0 · lint 0 · build 0. 다음 = G3b 5차.
