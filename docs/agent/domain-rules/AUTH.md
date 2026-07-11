# Domain Rule — AUTH / 권한 (+ PRIVACY: 비공개 레이어)

적용 경로: `lib/auth/**` · `lib/permissions/**` · `lib/private-layer/**` · `app/api/auth/**` ·
`app/(studio)/**` · 모든 서버 액션

근거: [ADR-0002](../decisions/ADR-0002-private-content-encryption.md) ·
[ADR-0003](../decisions/ADR-0003-owner-dual-binding.md) · `docs/security-boundary.md`

## 역할 (5)

| 역할 | 할 수 있는 것 | 절대 못 하는 것 |
|---|---|---|
| viewer | 공개 포스터(필터·하트·업도움·월 이동) | 비공개 토글·편집·관리 |
| worker | **work** 스코프 열람(언락 후), 스티커/꾸미기 | 엠바고 열람, 일정·태그·멤버·패스코드 편집 |
| manager | 공개만. 업 도움 기간/링크 편집, 이벤트 태그 지정(≤2), 꾸미기·export | **비공개 접근 전면 금지**(언락 버튼도 없음), 일정 본문 편집, 태그 생성/삭제/색변경, 멤버·패스코드 |
| owner(UI "관리자") | 전부 | — |
| developer | 진단(프레즌스 패널), 역할 미리보기(읽기 전용) | 오너 전용(owner_private) 열람·생성, 공개 API로 비공개 열람 |

겸직: `is_manager`/`is_worker` 둘 다 가능. **매니저면 실효 역할 = manager.**

## 절대 규칙

1. **일정 생성/수정/삭제는 owner만.** 요청받지 않았으면 매니저·작업자에게 편집 권한을 주지 않는다.
2. 클라이언트 게이트는 **유일한 방어선이 아니다** — 모든 서버 액션/라우트에서 권한을 다시 검사한다.
   새 API 라우트(`studio-write`/`sticker-write` op 포함)는 **새 권한면을 만들지 않는다**(액션 내부 검사 유지).
3. 비공개 레이어 접근 = Google 로그인 + 유효한 패스코드 언락 세션. 언락은 만료된다.
4. 오너 전환은 **양쪽**을 바꾼다: `OWNER_EMAIL`(앱) **AND** `calendars.owner_id`(RLS). 한쪽만 바꾸면 저장이 조용히 실패한다.
5. 비공개 본문은 AES-256-GCM으로 저장된다. `PRIVATE_DATA_ENC_KEY` **분실 = 복구 불가**.
   키를 환경에 넣기 전에 암호화 쓰기 코드를 먼저 배포하지 않는다(배포 순서).
6. 역할 미리보기(developer)는 **실제 권한을 절대 승격시키지 않는다** — 클라이언트 표시 전용.

## 검증

- 역할별로 한 번씩 화면을 돌려본다(불가하면 `NOT VERIFIED`로 남긴다 — 현재 편집실은 로그인 필요).
- `tests/unit/owner-email.test.ts`
- 권한 변경 시: "누가 무엇에 접근할 수 있는가"를 문장으로 적고, 그게 위 표와 일치하는지 확인한다.
