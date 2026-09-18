# ADR-0026: 태그 다크 팔레트를 자동 생성·저장한다

Status: Accepted
Date: 2026-09-19
Decision Owner: User (이번 다크모드 개선 요청)

## Decision

원본 라이트 색은 유지한다. OKLCH 색조를 보존하면서 다크 채움·테두리·글자·강조색을 역할별로 만든다. `color_palette.bg_color`, `broadcast_tags.bg_hex`로부터 `dark_palette`를 STORED generated column으로 계산한다. 기존 행, 새 태그, 직접 색 편집에도 같은 규칙을 적용한다. 하위 태그의 NULL은 기존 부모 상속을 따른다.

버전 1 수식은 `0121` SQL과 `lib/tags/dark-palette.ts`에 고정한다. 브라우저의 낙관적 편집·샘플은 같은 수식으로 즉시 표시하고, 저장 후 공개/편집실 로더는 저장된 값을 명시적 DTO로 읽는다. source가 바뀌어 저장 메타데이터가 낡았으면 재계산한다. 다음 색 계약 변경은 새 버전의 마이그레이션으로 한다.

`light-dark()`를 각 색 위치에 사용한다. 루트의 기존 color-scheme을 따라 첫 렌더와 설정 변경 모두 같은 공유 구현을 쓴다. 카드 채움은 차분하게, 작은 범례·차트·점 표시는 더 밝게 표시한다.

## Boundary and supersession

ADR-0001 검토: 새 필드는 원래 공개 태그 색으로만 만든 시각 메타데이터다. 운영 지표·개인 데이터가 없으며 JSON 전체를 내보내지 않는다. 허용된 hex 필드만 명시적으로 조립한다. 기존 RLS·역할·unlock·KST·public loader 경계를 유지한다.

이 결정은 [첫 다크 감사](../../ux/dark-mode-audit.md)의 '다크에서도 기존 태그 채움 보존' 선택만 대체한다. 현재 사용자의 다크 전용 색상 및 자동 저장 요청이 근거다.

## Validation and rollback

1,240개 RGB 입력의 SQL/TS 팔레트 완전 일치, 임시 테이블 insert/update/NULL 자동 생성, 실제 기존 43행 원본 값 해시 보존을 검증했다. 팔레트 글자 대비·색조·명도, stale metadata 및 공개 DTO 검사를 추가했다. UI 검증은 [후속 기록](../../ux/dark-mode-palette.md).

스키마를 앱보다 먼저 적용한다. 앱 복구 시 이전 reader를 배포하고 additive 컬럼은 남긴다. 기존 색 데이터 복원은 불필요하다. 컬럼 제거는 별도 변경이다.
