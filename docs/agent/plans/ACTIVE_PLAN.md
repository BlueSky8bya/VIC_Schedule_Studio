# Active ExecPlan

Plan ID: PLAN-20260730-001
Status: In Progress
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
2. [ ] 프리젠테이션-only 렌더 함수 파일 분리(읽기전용 상세·역할 배지 등, props 명시화).
3. [ ] 쓰기 큐(enqueueWrite/move 큐/flush) → `useStudioWriteQueue` 훅.
4. [ ] undo/redo(applyHistoryAction/pushUndo) → `useEditHistory` 훅.
5. [ ] (평가 후) 달력 그리드/모바일 아젠다 렌더 분리.

중단돼도 다음 세션이 이 문서에서 이어받는다.

> 직전 완료:
> [2026-07-27_broadcast-toolbar-layer-rebuild.md](completed/2026-07-27_broadcast-toolbar-layer-rebuild.md)
