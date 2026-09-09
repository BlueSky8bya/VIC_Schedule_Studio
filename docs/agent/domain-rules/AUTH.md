# Domain Rule — AUTH / 권한 (+ PRIVACY: 비공개 레이어)

적용 경로: `lib/auth/**` · `lib/permissions/**` · `lib/private-layer/**` · `app/api/auth/**` ·
`app/(studio)/**` · 모든 서버 액션

근거: [ADR-0002](../decisions/ADR-0002-private-content-encryption.md) ·
[ADR-0003](../decisions/ADR-0003-owner-dual-binding.md) · `docs/security-boundary.md`

## 현역 역할 (정본: `lib/permissions/roles.ts`)

| 역할 | 할 수 있는 것 | 절대 못 하는 것 |
|---|---|---|
| viewer | 공개 포스터(필터·하트·업도움·월 이동) | 비공개 토글·편집·관리 |
| owner(UI "관리자") | 일반 일정 편집·관리, 유효한 언락 이후 비공개/owner_private 접근 | 공개 API로 비공개 노출 |
| developer | 일반 일정 편집·관리, 진단, 읽기 전용 역할 미리보기, 유효한 언락 이후 work 접근 | owner_private 열람·생성, 공개 API로 비공개 노출 |

worker(ADR-0015)·manager(ADR-0018)·trusted_members 판정은 철수했다. actor는
OWNER_EMAIL → platform_admins → viewer 순으로 푼다. 옛 역할 표는 역사 자료에만 남긴다.

## 절대 규칙

1. **일반 일정 생성/수정/삭제는 owner·developer. `owner_private` 열람·생성은 owner만.**
   이유: 일반 유지보수 권한은 소유자 전용 내용의 권한이 아니다. `canEditSchedule`과
   `canReadOwnerPrivate`를 구별한다(ADR-0011/0012/0018). 보조 역할을 다시 만들지 않는다.
2. 클라이언트 게이트는 **유일한 방어선이 아니다** — 모든 서버 액션/라우트에서 권한을 다시 검사한다.
   새 API 라우트(`studio-write` op 포함)는 **새 권한면을 만들지 않는다**(액션 내부 검사 유지).
3. 비공개 레이어 접근 = Google 로그인 + 유효한 패스코드 언락 세션. 언락은 만료된다.
4. 오너 전환은 **양쪽**을 바꾼다: `OWNER_EMAIL`(앱) **AND** `calendars.owner_id`(RLS). 한쪽만 바꾸면 저장이 조용히 실패한다.
5. 비공개 본문은 AES-256-GCM으로 저장된다. `PRIVATE_DATA_ENC_KEY` **분실 = 복구 불가**.
   키를 환경에 넣기 전에 암호화 쓰기 코드를 먼저 배포하지 않는다(배포 순서).
6. 역할 미리보기(developer)는 **실제 권한을 절대 승격시키지 않는다** — 클라이언트 표시 전용.

## 검증

- 역할별 권한·화면을 검증한다. fixture UI 테스트와 실제 로그인/RLS 검증은 구별한다.
  실제 세션 검증이 없으면 그 범위만 `NOT VERIFIED`로 남긴다([열린 검증](../verification/OPEN_CHECKS.md)).
- `tests/unit/owner-email.test.ts`
- 권한 변경 시: "누가 무엇에 접근할 수 있는가"를 문장으로 적고, 그게 위 표와 일치하는지 확인한다.
