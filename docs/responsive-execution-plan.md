# 반응형 실행 계획 (audit 보고서 → 이 프로젝트 적용판)

기준 문서: `docs/responsive-design-audit-report.md`
이 문서는 보고서의 6단계 로드맵을 **이 프로젝트의 작업 방식(연속 배포·눈으로 잡아가는 디자인)**에
맞춰 재정렬한 실행 체크리스트다. 보고서와 다른 점은 명시한다.

## 확정된 결정

- **포스터 기준 비율: 16:9 (가로형).**
  - `poster-surface`는 시청자 공개 화면 = export PNG 표면이다(동일 컴포넌트 `PublicPoster`).
  - 현재 가로 3단(메모 238 / 달력 / 지원·범례 220) 배치라 16:9가 자연스럽게 맞는다.
  - 보고서 추천은 4:5였으나, 4:5는 세로 재배치 + 스티커 좌표 대규모 이동을 유발 → 16:9로 변경.
- **전체 6단계 로드맵 채택**, 단 순서는 아래처럼 재정렬(테스트를 zoom 제거보다 앞에).

## 보고서와 다르게 가는 점 (근거)

1. **시각 회귀 안전망을 zoom 제거보다 먼저.** 보고서는 테스트를 뒤에 뒀지만, 이 프로젝트는
   "한 화면 고치면 다른 비율 깨짐"을 실제로 겪었다(16:9 사태, lint가 Vercel까지 도달). 가장
   위험한 리팩터(zoom 제거) 앞에 안전망을 둔다.
2. **zoom 제거는 드래그 물리와 얽혀 있어 신중히.** 진자/헬리콥터 드래그가
   `getBoundingClientRect`+`clientX`+`elementFromPoint`에 의존. Chrome `zoom` 아래서 현재
   좌표가 일관돼 동작 중 → 제거 시 각 해상도에서 드래그/sticky/export 재검증 필수.
3. **컨테이너 쿼리 전면 이전은 보류.** 값을 실제로 주는 곳(포스터 내부, 달력 패널)만 점진 적용.

## 단계 (체크리스트)

### Phase 1 — 기준 정리 (위험 0, 시각 변화 없음) ✅
- [x] `lib/ui/breakpoints.ts` 단일 출처 + `MOBILE_QUERY` 상수화
- [x] studio-shell.tsx / public-poster.tsx의 `matchMedia` 리터럴 → 상수
- [x] 두 CSS 상단에 Responsive policy 주석
- [x] zoom 블록을 "임시(Phase 4 제거 예정)"로 명시

### Phase 2 — 포스터 16:9 캔버스화
- [ ] `.poster-surface`에 `aspect-ratio: 16 / 9` + 가로 3단 유지(폭만 조정)
- [ ] `poster-preview-viewport` 래퍼: 화면 안에서 비율 유지하며 축소/확대
- [ ] `min-height: 780px` 의존 축소
- [ ] 미리보기 = export 결과 일치 확인(Playwright public poster route)
- 체크포인트: 데스크톱/모바일에서 한 번 보고 → 배포 → 사용자 확인 후 다음

### Phase 2b — 스티커 좌표 호환
- [ ] 비례좌표(xRatio/yRatio/widthRatio)가 16:9 표면에서 자연스러운지 확인
- [ ] 운영 DB에 기존 스티커 있으면 시각 위치 점검(필요 시 호환 처리)

### Phase 3 — 시각 회귀 안전망 ✅ (로그인 불필요 범위로 한정)
- 결정: 인증 장벽 때문에 헤드리스로 도달 가능한 표면만 다룬다. `/`는 Supabase 설정 시
  자동으로 Google OAuth로 넘어가 못 잡고, 실제 포스터·꾸미기·비공개 레이어는 로그인 필요.
  `/studio`(읽기전용 스튜디오 셸)는 로그인 없이 렌더 — zoom(Phase 4) 대상 표면이라 가장 가치.
- 결정: 사진 비교(스냅샷)는 OS/폰트에 취약 → **측정값 검사(assertion)** 중심.
  `tests/e2e/responsive-layout.spec.ts`: viewport 세트 × `/studio`에서 가로 오버플로 없음 +
  달력 노출 + 비공개 경고 미노출. (390/768/1366/1920/2560/3440)
- [x] 스테일 `/vic` 스냅샷 테스트 제거(`/vic`는 라우트가 아니라 캘린더 slug였음).
- [x] 스테일 `calendar-ui.spec.ts` 현행화(헤딩 문구, `/` 자동 리다이렉트, 날짜 하드코딩 제거).
- [x] `npx playwright test tests/e2e --project=chromium` 10개 그린.
- 후속(인증 필요): 실제 포스터(16:9)·꾸미기·비공개 스냅샷은 테스트 인증 경로가 생기면 추가.

### Phase 4 — studio zoom 제거 실험
- [ ] `zoom` @media 제거, 작업영역 `width: min(100%, 1720px); margin-inline: auto`
- [ ] 큰 화면 cell/sidebar/editor min·max 조정, 타이틀 작업 UI 기준으로 축소
- [ ] 드래그/sticky/export 재검증(각 해상도) — Phase 3 스냅샷으로 회귀 확인

### Phase 5 — 컨테이너 쿼리 점진 도입
- [ ] 우선순위: poster-surface → public-calendar-area → studio-calendar-panel →
      event-editor-panel → tag-editor → decorate-toolbar (값 주는 곳만)

### Phase 6 — 모바일 agenda UX 다듬기
- [ ] 공개 모바일 agenda 기본 유지·날짜 grouping 강화·필터 chip rail 선택상태 강화
- [ ] 하트/링크 최소 40px 터치, 모바일 private warning sticky 유지

## 보안 경계 (매 단계 공통)
- 모바일 agenda 전환 시 private 필드가 public DTO에 섞이지 않을 것
- viewer CSS로 숨기지 말고 응답에서 제거할 것
- poster export 전 private 레이어 노출 여부가 권한과 일치하는지 확인
