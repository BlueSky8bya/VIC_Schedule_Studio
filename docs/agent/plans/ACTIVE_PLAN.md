# Active ExecPlan

Plan ID: PLAN-20260730-001
Status: Completed (scope-adjusted — 4·5단계 보류 판정 포함)
Task Risk: L2
Created / Updated: 2026-07-30

## Objective
`components/studio/studio-shell.tsx`(~6,800줄)를 **동작 보존** 전제로 단계 분해해
(P2-ARCH-1, 계획서 K3) 회귀를 격리 가능한 구조로 만든다.

## Verifiable End State
- studio-shell.tsx가 뷰/편집폼/쓰기큐/히스토리 단위로 나뉘고, 각 단계 커밋마다
  `next build` + fixture 회귀 스크립트(undo/redo·quickadd·ipad·today)가 통과한다.
- 마크업·CSS 클래스·권한 게이트·공개 경계 코드는 변화 0 (순수 이동/치환).

## Scope / Out of Scope
- Scope: 코드 이동·훅 추출·특성화 테스트. Out: 동작 변경, 스타일 변경, 리디자인.

## 단계 (한 단계 = 한 커밋 = 회귀 통과)
1. [x] 모듈 레벨 순수 코드 추출 → `lib/studio/editor-model.ts`
   (EventForm/CopiedEvent/UndoAction/EditDraft 타입, 날짜/폼/드래프트/떡밥 헬퍼,
   라벨 상수, SUPPORT_DURATIONS, postStudioWrite/StudioWriteResult) + 단위 테스트.
2. [x] 프리젠테이션-only 렌더 분리 — `ReadonlyEventDetail`·`RoleBadge`(props 명시화, `2217dfb`).
3. [x] 쓰기 큐 → `lib/studio/use-write-queue.ts` `useStudioWriteQueue`
   (저장 칩·temp id 해석·flush 포함, 이동 저장 체인은 셸 소유 유지, `1185a1b`).
4. [~] **평가 결과 보류**: applyHistoryAction이 setter 12개(events/selectedDate/form/토스트/
   이동큐/서버쓰기…)에 얽혀 있어, 상태 응집(events reducer) 없이 훅으로 빼면 deps 가방만
   커지고 이득<위험. 리디자인 후 실제 필요가 생길 때 reducer와 함께 재평가.
5. [~] 동일 사유 보류(그리드/아젠다는 셸 상태 대부분을 소비).

**판정: 1~3단계로 ARCH-1의 실익(순수 로직 격리·큐 단일 파일·프리젠테이션 분리)은 확보 —
애플 리디자인 진입 가능. Status → Completed(scope-adjusted).**

> 직전 완료:
> [2026-07-27_broadcast-toolbar-layer-rebuild.md](completed/2026-07-27_broadcast-toolbar-layer-rebuild.md)
