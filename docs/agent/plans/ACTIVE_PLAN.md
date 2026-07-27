# Active ExecPlan

Plan ID: PLAN-20260727-001

Status: **In Progress**

Task Risk: L2
Created / Updated: 2026-07-27 11:48 KST

## Objective

일정 그림판의 레이어 패널을 데스크톱 그림 앱처럼 직접 드래그 정렬할 수 있게 바꾸고,
임의의 6개 레이어 제한과 분수 표시를 제거한다. 상단 판서 UI는 Clip Studio Paint와
Windows 그림판을 비교해 `명령 / 도구 / 빠른 판서 설정·색상 팔레트`가 한눈에 읽히는
작업대로 재구성한다.

## Verifiable End State

- 그림 레이어 썸네일·이름을 잡아 위아래로 끌면 보라 삽입선 위치에 놓이고 실제 합성 순서가 바뀐다.
- 눈·잠금·삭제 조작은 drag를 시작하지 않는다. 일정 레이어는 맨 아래 고정이다.
- 한 drag가 undo/redo 1건이며 취소·no-op은 이력을 만들지 않는다.
- `+ 새 레이어`에 개수/최대치가 보이지 않고 7번째 이상 레이어도 계속 추가된다.
- 상단이 명령 바, 이름이 보이는 도구 팔레트, 빠른 판서 설정·색상 팔레트로 구분된다.
- 모바일 경로, 공개/비공개 DTO, 서버 저장 계약은 바뀌지 않는다.

## Scope / Out of Scope

### Scope

- `BroadcastPanel` 데스크톱 레이어 pointer drag + 삽입선 + edge auto-scroll
- `Alt+ArrowUp/Down` 키보드 대체 경로와 live status
- 6개 hard cap·분수·disabled 상태 제거
- 총 backing-pixel 공유 예산을 지키는 다중 레이어 해상도 적응
- 상단 toolbar 정보구조·시각 위계 재구성
- 연구 아카이브, 단위/호출부 계약, 현재 상태 문서 갱신

### Out of Scope

- 모바일 일정 그림판
- 레이어 폴더·혼합 모드·불투명도·병합·복제
- toolbar 사용자 커스터마이징
- 서버/브라우저 영속 저장, 권한·DTO·API 변경

## Relevant Context

- [잉크·도구 UX 연구](../../ux/broadcast-panel-inking-research.md)
- [Clip Studio Layer palette](https://help.clip-studio.com/en-us/manual_en/180_layers/Using_layers.htm):
  Windows/macOS에서 layer detail 영역을 직접 위아래 drag
- [Clip Studio Command Bar](https://help.clip-studio.com/en-us/manual_en/690_interface/Command_Bar.htm):
  빠른 명령과 separator/group
- [Clip Studio Tool Property](https://help.clip-studio.com/en-us/manual_en/150_tools/Customizing_the_Tool_and_Sub_Tool_palettes.htm):
  도구와 현재 속성의 분리. 이 구현은 전체 Tool Property 복제가 아닌 빠른 잉크 설정만 채택
- [Clip Studio Color Set](https://help.clip-studio.com/en-us/manual_en/300_color/Color_Set_palette.htm):
  명시적 색 타일·현재 값. 사용자 저장 세트 없이 `색상 팔레트`로만 명명
- [Clip Studio layer management](https://www.clipstudio.net/en/animation/tools-techniques/):
  파일당 10,000 layers는 비교 제품의 한계이며 이 웹 구현의 성능 보장은 아님
- [Microsoft Paint layers](https://blogs.windows.com/windows-insider/2023/09/18/paint-app-update-adding-support-for-layers-and-transparency-begins-rolling-out-to-windows-insiders/):
  toolbar에서 여는 canvas-side layer panel과 stack order

## Assumptions

| 가정 | 영향 | 근거 | 상태 |
|---|---|---|---|
| 일정 레이어는 합성 바닥 | drag 대상에서 제외 | 카드 위 주석 가시성·기존 구조 계약 | Confirmed |
| 패널은 일회성 세션 | 낮은 arbitrary count cap 불필요 | 닫힘 시 stroke/canvas dispose | Confirmed |
| 임의 6개 cap 없이도 backing 픽셀 폭주를 막아야 함 | 다중 surface가 총 픽셀 예산 공유 | `backingScale(surfaceCount)` | Confirmed |
| DOM·썸네일·stroke 비용은 레이어와 함께 증가 | 물리적 무한/10,000개 성능을 약속하지 않음 | 현재 surface·목록 구조 감사 | Confirmed |
| 모바일 제외 | pointer UI는 desktop 우선 | 모바일 진입점 없음 | Confirmed |

## Ambiguity Register

| ID | 질문 | 중요도 | 해소 |
|---|---|---|---|
| A1 | 카드 전체인가 grip인가 | High | Clip Studio desktop처럼 썸네일·이름 영역 전체 |
| A2 | 키보드 사용자는 어떻게 순서 변경하나 | High | 카드 focus + Alt+Arrow, live status |
| A3 | 물리적 무한을 보장하나 | High | 사용자 hard cap 없음; 실제 canvas 예산이 품질을 점진 조절 |
| A4 | 일정도 위로 올릴 수 있나 | High | 구조 레이어라 맨 아래 고정 |

## Milestones

### M1 — Research and contract

Goal: 공식 자료 기반 정보구조·상호작용 계약 확정

Files: 연구 아카이브, 이 계획서

Validation: 근거 URL·적용·미적용 명시

Rollback: 문서 커밋 revert

Status: Completed

### M2 — Layer direct manipulation

Goal: 화살표 제거, pointer drag/reorder/insertion/auto-scroll, keyboard fallback

Files: `broadcast-panel.tsx`, `broadcast-panel.css`, `workflow.ts`

Validation: reorder pure tests, drag callsite contracts, undo/no-op/cancel 경계

Rollback: 기존 layers history 형식을 유지하므로 UI/handler만 revert

Status: Completed

### M3 — Toolbar palette rebuild and cap removal

Goal: 명령/도구/빠른 판서 설정·색상 팔레트 역할, count-free layer add

Files: `broadcast-panel.tsx`, `broadcast-panel.css`, 관련 tests

Validation: 기본 도구·색·레이어 전환 계약, 7개 이상 helper case, count 문구 부재

Rollback: stroke engine·DTO 무변경; markup/CSS와 cap guard만 revert

Status: Completed

### M4 — QA and release

Goal: 접근성·회귀·production bundle·배포 확인

Validation: tests, typecheck, changed lint, build, Vercel Production, desktop visual QA 가능 범위

Rollback: 단일 기능 커밋 revert

Status: In Progress

## Final Acceptance Criteria

- [x] mouse/pen pointer drag로 그림 레이어 순서 변경
- [x] 삽입선·dragging 상태·edge auto-scroll
- [x] actions drag 제외, schedule pinned
- [x] 한 drag = history 1건; cancel/no-op = 0건
- [x] Alt+Arrow fallback + live status
- [x] 6개 hard cap·분수 표시 없음; 7개 이상 추가 가능
- [x] 명령/도구/빠른 판서 설정·색상 팔레트 toolbar 역할 구분
- [x] 기존 첫 진입·첫 일정 보내기·색/굵기 문맥 전환 유지
- [x] 모바일·공개/비공개 경계 무변경
- [x] unit/typecheck/changed lint/build 통과

## Validation Commands

```bash
npm test
npm run typecheck
npx eslint components/studio/broadcast-panel.tsx lib/broadcast/workflow.ts tests/unit/broadcast-workflow.test.ts tests/unit/broadcast-inking-callsite.test.ts
npm run build
git diff --check
```

## Rollback Strategy

서버·DB·저장 형식을 바꾸지 않는다. 문제가 생기면 기능 커밋을 revert하면 직전 버튼 기반
정렬과 toolbar로 돌아간다. 레이어 history는 계속 `{ before, after }` 배열이라 데이터 변환이 없다.

## Progress Log

### 2026-07-27 10:44 KST

- Clip Studio Paint·Microsoft Paint 공식 자료 조사 완료.
- layer detail drag, insertion line, 3역할 toolbar, 6개 cap 제거 결정.
- 연구 아카이브 갱신 완료. 코드 구현 시작.

### 2026-07-27 11:48 KST

- 그림 레이어 직접 drag, 3상태 drop, 삽입선·ghost·목록 edge auto-scroll, keyboard fallback 완료.
- 다중 pointer·Esc·capture loss·목록 밖 drop의 click/history 경합 보강. 긴 목록에서 새 레이어와
  Alt+Arrow 이동 레이어를 자동 노출·포커스.
- 6개 cap·분수 제거. 다중 canvas는 0.25 scale 아래까지 적응해 총 backing-pixel 예산 유지.
- command bar / 이름 있는 도구·도형 / 색상 팔레트 / 빠른 판서 설정으로 toolbar 재구성.
- vitest 294/294, typecheck, changed-files lint, `git diff --check`, production build 통과.
  build의 기존 무관 경고 5개는 유지.
- 3인 read-only 최종 감사에서 blocker/P1 0건. 연결된 브라우저 인스턴스가 없어 desktop mouse
  drag·screenshot, iPad/Wacom 실기기 확인은 미실행이며 QA 체크리스트에 남김.
- Production 배포 확인만 남음.
