# Constitution — VIC Schedule Studio

> 이 프로젝트의 바뀌지 않는 것들. 길게 늘어놓는 매뉴얼이 아니다.
> 세부 규칙은 각자 있어야 할 곳에 있다 — 여기선 그 곳을 가리킨다.

## 1. Mission

스트리머 **빅토리**의 방송 일정을, 팬(빅타민)에게는 **따뜻한 포스터**로, 팀에게는 **안전한 편집실**로 준다.
공개 포스터 · 비공개(작업/엠바고) 레이어 · 월간 포스터 꾸미기/내보내기, 이 세 가지가 제품이다.

## 2. Core promise (깨지면 제품이 죽는다)

**시청자는 오직 공개 일정 데이터만 받는다.** 비공개·엠바고·작업자·오너 전용·운영/관리 데이터는
공개 UI와 공개 API에 절대 실리지 않는다. 방송 화면 공유 중의 유출은 되돌릴 수 없다.

## 3. Product philosophy — immersion-first

동등한 선택지가 있으면 **몰입을 깊게 하고 UI를 통일하는 쪽**을 고른다. 차가운 "관리자 패널" 느낌은 회귀다.
(체감 성능 · 사용자–시스템 유대 · 장난스러운 모션 · 역할별 흐름 → 전문은 루트 `CLAUDE.md`.)

## 4. Architecture philosophy

- 공개/비공개는 **서버에서** 분리한다. CSS로 숨기지 않는다. ([ADR-0001](decisions/ADR-0001-public-private-server-boundary.md))
- 포스터는 폭 1840 **고정 설계 캔버스** + 통짜 스케일. 뷰포트에 따라 내부를 재배치하지 않는다. ([ADR-0004](decisions/ADR-0004-poster-surface-geometry.md))
- 낙관적 쓰기는 **직렬 큐 + keepalive**. 마지막 조작이 저장의 진실. ([ADR-0006](decisions/ADR-0006-optimistic-writes-keepalive-queue.md))
- 시즌 연출(미니게임·테마)은 **곁들임이지 뚜껑이 아니다**. ([ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md))

## 5. Critical invariants

1. 시간은 항상 KST(Asia/Seoul).
2. 일정 생성/수정/삭제는 **owner만**. 개발자도 오너 전용 콘텐츠는 읽지도 만들지도 못한다.
3. 비공개 레이어 접근 = Google 로그인 + 유효한 패스코드 언락 세션. **매니저는 비공개 접근 0.**
4. 포스터/export 모드엔 관리 UI·비공개 배지·편집/언락 컨트롤이 없다(`[data-export-surface]`).
5. 이벤트당 태그 최대 2개(카드 6태그 트리 규칙은 `docs/tags/`), 날짜 칸은 대표 색 ≤2.
6. 디자인 토큰은 `app/globals.css :root`가 단일 출처 — 하드코딩 금지.
7. 모바일 = ≤640px (`BREAKPOINTS.mobile`). 웹/모바일은 **다른 레이아웃**이지 축소본이 아니다.

## 6. Change boundary (최소 변경)

요청을 해결하는 **최소 범위**만 바꾼다. 명시 요청 없이는 하지 않는다:
전면 리팩터 · 프레임워크/패키지 매니저 교체 · 폴더 구조 개편 · 무관한 정리 · DB 스키마 변경 ·
공개 API 변경 · production dependency 추가 · 디자인 시스템 교체.

## 7. Ambiguity policy

저장소에서 확인 가능한 건 **묻지 말고 찾는다**(명령어·구조·기존 결정·네이밍).
결과를 실질적으로 바꾸는 것만 묻는다: 권한 모델, 데이터 보존/파괴, 공개 범위, 비용, 호환성 파괴,
사용자가 의도하지 않은 대규모 구조 변경.

## 8. Decision preservation

Accepted ADR과 충돌하는 변경은 **조용히 덮어쓰지 않는다**. 충돌을 말하고 → 여전히 유효한지 평가하고 →
필요하면 사용자에게 묻고 → 기존 ADR을 `Superseded`로 바꾸고 → 대체 ADR을 쓴 뒤에 코드를 바꾼다.
ADR은 삭제하지 않는다.

## 9. Verification philosophy

"코드를 썼다" ≠ "작업이 끝났다". **실행하지 않은 검증을 성공이라고 말하지 않는다.**
못 돌린 검증은 `NOT VERIFIED`로 남긴다(예: 편집실은 로그인이 필요해 로컬 Playwright 검증 불가 —
`CURRENT_STATE.md` ISSUE-001).

## 10. Repository memory

세션 기억에 의존하지 않는다. 현재 시제는 [`CURRENT_STATE.md`](CURRENT_STATE.md),
왜는 [`decisions/`](decisions/DECISION_INDEX.md), 무엇이 어디 있는지는 [`PROJECT_MAP.md`](PROJECT_MAP.md).
의미 있는 작업이 끝나면 **현재 상태를 갱신한다**(Stop 훅이 드리프트를 잡는다).

## 11. Reversibility

중요한 변경은 되돌릴 방법을 말할 수 있어야 한다. 큰 작업은 검증 가능한 마일스톤으로 쪼갠다.
`git reset --hard` · `git clean -fd` · force push · 사용자 작업 덮어쓰기는 **명시 승인 없이 금지**.
DB 마이그레이션은 멱등 SQL + 수동 적용(`node scripts/apply-db.mjs`), 파괴적 작업은 [domain-rules/DESTRUCTIVE_DATA.md](domain-rules/DESTRUCTIVE_DATA.md).

## 12. Domain critical routing

활성 프로필: `GENERAL` · `SECURITY` · `PRIVACY` · `AUTH` · `DESTRUCTIVE_DATA` ([RISK_PROFILE.md](RISK_PROFILE.md))

| 경로 | 프로필 | 규칙 |
|---|---|---|
| `lib/schedules/public-loader.ts`, `app/api/public/**`, `app/(public)/**` | SECURITY, PRIVACY | [domain-rules/SECURITY.md](domain-rules/SECURITY.md) |
| `lib/private-layer/**`, `lib/auth/**`, `lib/permissions/**` | AUTH, PRIVACY | [domain-rules/AUTH.md](domain-rules/AUTH.md) |
| `db/migrations/**`, `scripts/apply-db.mjs` | DESTRUCTIVE_DATA | [domain-rules/DESTRUCTIVE_DATA.md](domain-rules/DESTRUCTIVE_DATA.md) |
| 그 외 | GENERAL | 이 문서 + `CLAUDE.md` |

## 13. Conflict priority

1) 보안·정보 경계 2) KST 3) 오너 전용 편집 4) 역할별 UX 5) 포스터/export 품질 6) 유지보수성
