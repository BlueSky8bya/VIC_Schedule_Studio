# 개발자 역할 미리보기 계획 (관리자/매니저/작업자/시청자)

목표: 개발자가 **각 역할의 화면을 그대로 점검**할 수 있게 한다. 권한 상승이 아니라 "그 역할이
무엇을 보는가"를 확인하는 **화면 점검 도구**다.

## 핵심 원칙 (라우팅·쿠키 안전 — 가장 중요)

이 프로젝트는 과거에 `history.replaceState`로 경로를 바꾸려다 App Router 상태가 깨져
**라우팅 엉킴 + 새로고침 깜빡임**이 나서 되돌린 이력이 있다. 또 화면 복원은 `vic_view` 쿠키를
서버(`app/page.tsx`, `app/loading.tsx`의 `resolveLoadingTarget`)가 읽어 결정한다.

그래서 역할 미리보기는 **반드시 다음을 지킨다:**

1. **라우트를 바꾸지 않는다.** 네비게이션·`replaceState` 없음. 이미 마운트된 `StudioShell`
   안의 클라이언트 상태 오버레이로만 구현한다 → 로딩 경계/라우터 상태와 무관.
2. **쿠키에 미리보기 역할을 저장하지 않는다(ephemeral).** 새로고침하면 미리보기가 풀리고
   실제 개발자 화면으로 돌아온다. 서버(SSR)는 항상 **진짜 역할(developer)** 로만 렌더한다 →
   `loading.tsx`/`app/page.tsx`의 studio-vs-poster 판단이 미리보기에 오염되지 않는다.
3. 미리보기는 "보기 전용"이다. 저장/삭제/멤버/비밀번호/태그/업도움 같은 변경은 미리보기 중
   클라이언트에서 막는다(서버 권한은 원래대로 — 이건 점검용 차단이지 보안 경계가 아니다).

> 한 줄 요약: **미리보기 = 순수 클라이언트 상태, 라우트·쿠키 안 건드림, 새로고침 시 해제.**

## 데이터 경계 (절대 안전)

- 미리보기는 데이터 접근을 바꾸지 않는다. 개발자가 이미 로드한 `schedule`만 본다.
- `owner_private`("나만")는 개발자에게 **로드 자체가 안 된다**(`canReadOwnerPrivate`=owner only).
  따라서 "관리자 미리보기"에서도 owner_private **이벤트는 안 보인다**. 편집기의 "나만" 옵션
  (빈 UI 칩)은 보일 수 있으나 내용이 아니므로 누출이 아니다. 저장도 서버가 거부한다.
- "시청자 미리보기"는 기존처럼 공개 전용 DTO(`schedule.viewerModePreview`)만 쓴다.
- 매니저/작업자 미리보기는 개발자가 잠금 해제했으면 embargo/work까지(그 역할이 보는 그대로),
  안 했으면 공개만 — 실제 역할 동작과 일치.

## 구조 (클라이언트 오버레이)

`StudioShell`에 개발자 전용 클라이언트 상태 `previewRole: MembershipRole | null` 추가.

```
const effectiveRole = previewRole ?? actor.role;   // 개발자만 previewRole을 세팅
// UI 게이팅·표시는 effectiveRole로 계산:
const canEdit            = canEditSchedule(effectiveRole);
const canDecorateCalendar= canDecorate(effectiveRole);
const canEditSupportThing= canEditSupport(effectiveRole);
const canEditTagsThing   = canEditEventTags(effectiveRole);
// 배지/데스크 라벨/팝오버도 effectiveRole 기준.
```

**예외 — 항상 실제 역할(`actor.role === "developer"`)로 게이팅해야 하는 것:**
- 역할 미리보기 전환기 + "미리보기 나가기" 버튼 (이게 effectiveRole로 숨으면 빠져나올 수 없다!).
- 미리보기 배너.

**변경 차단:** `previewRole`이 null이 아니면 `saveEvent`/`deleteEvent`/태그저장/멤버/비밀번호/
업도움 핸들러 시작부에서 무시(+ "미리보기 중에는 변경할 수 없어요" 토스트). 비-편집 역할
미리보기는 어차피 UI가 컨트롤을 숨기므로, 주로 관리자 미리보기에서 의미가 있다.

## 역할별 미리보기 결과

| 미리보기 | 보이는 화면 |
|---|---|
| 관리자(owner) | 전체 편집 UI(일정 폼·태그 편집·멤버·꾸미기). 단 owner_private 이벤트는 없음(데이터 미로드). |
| 매니저 | 읽기전용 일정 상세 + 업도움/태그 할당 가능, 관리 묶음·접속자 없음, 데스크 라벨 "매니저". |
| 작업자 | 읽기전용 상세(업도움·태그 읽기전용), 꾸미기 중심, 데스크 라벨 "작업자". |
| 시청자 | 기존 `viewerMode` 재사용 → 공개 포스터(PublicPoster, 공개 DTO). |

시청자는 이미 있는 `viewerMode`(쿠키 `v`로 지속)를 그대로 쓰고, 새 3종(관리자/매니저/작업자)은
ephemeral `previewRole`로 둔다. (시청자만 지속되는 약간의 비대칭은 기존 동작 보존을 위해 의도.)

## UI 배치

- 개발자 전용 액션바에 **"역할 미리보기" 묶음**(방금 만든 그룹핑과 통일): `[관리자][매니저][작업자][시청자]`.
  - 관리자/매니저/작업자 → `setPreviewRole(...)`.
  - 시청자 → 기존 `setViewerMode(true)`.
- 미리보기 중이면 상단에 눈에 띄는 배너: `🛠 개발자 미리보기: {역할} 화면 (보기 전용) — 나가기`.
  "나가기" → `setPreviewRole(null)`.
- 기존 "🛠 개발자 세션" 띠 옆/아래에 자연스럽게 배치.

## 구현 단계

1. `StudioShell`에 `previewRole` 상태 + `effectiveRole` 도출, `can*`/배지/데스크 라벨을
   `effectiveRole` 기준으로 전환. (전환기·배너·나가기·접속자현황은 `actor.role` 기준 유지.)
2. 변경 핸들러들에 `if (previewRole) return;` 가드 + 안내 토스트.
3. 개발자 액션바에 "역할 미리보기" 묶음 + 미리보기 배너 추가.
4. (선택) 미리보기 중 배경/테두리로 "점검 중" 분위기.
5. 빌드·검증 → push → 커밋 해시 보고.

## 비범위 / 안전 점검

- 라우트·쿠키 불변(미리보기는 클라이언트 한정·새로고침 시 해제).
- 공개 API·데이터 로드 불변(owner_private 미로드 유지).
- 미리보기 중 서버 변경 차단(클라 가드) — 실수로 개발자 권한으로 저장하는 것 방지.
- 완료 시 CLAUDE.md/sop.md의 "역할 미리보기는 계획(미구현)" 표기를 "구현됨"으로 갱신.
