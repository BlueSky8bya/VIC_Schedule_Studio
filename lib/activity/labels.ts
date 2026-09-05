// 행동 기록의 target(버튼 id·라우트·패널 키)을 **코드를 모르는 사람이 읽을 수 있는 말**로 푼다.
//
// 이 화면을 보는 사람은 대부분 개발자가 아니다(관리자·매니저). `.stf-btn` 같은 값은 물론이고
// "마크업에서 유추한 이름" 같은 말도 통하지 않는다. 그래서 세 가지를 지킨다:
//   1) 이름은 **화면에 실제로 쓰인 문구**로 (코드 이름 broadcast-panel ✗ → '일정 그림판' ✓)
//   2) **어디에 있는 버튼인지(area)** 를 함께 준다 — 이름만으로는 찾아갈 수 없다
//   3) 기계용 id는 기본으로 숨긴다(개발자 전환 시에만 표시·복사에 포함)
//
// 사전에 없으면 이름을 지어내지 않는다. 대신 "아직 이름을 안 붙인 버튼"으로 표시하고
// 원래 값은 개발자 모드/복사본에만 남긴다.

export type TargetLabel = {
  name: string;
  /** 어디에 있는 것인지 — 코드를 몰라도 찾아갈 수 있게. */
  area?: string;
  /** 한 줄 부연(무슨 버튼인지, 합쳐진 값인지). */
  hint?: string;
  /** true면 아직 이름을 안 붙인 것 — 화면에서 그렇게 안내한다. */
  unnamed?: boolean;
  /** true면 이미 철수한 기능 — 기록만 남는다. '적게 쓰인 기능'은 없앨 후보를 찾는 화면이라
   *  이미 없앤 것이 후보 사이에 끼면 목록이 거짓말을 한다(따로 갈라 보여준다). */
  retired?: boolean;
};

// ── 이미 철수한 기능들(2026-08-27) — 여기 한 곳에서만 관리한다 ──
//  · ADR-0009 Superseded: 월드컵/축구 시뮬 전부 삭제
//  · ADR-0014: 편집실 비공개 레이어 UI 철수(보기 토글·공개 범위 피커·경고 띠)
//  · ADR-0015: 달력 꾸미기(스티커)·작업자 역할 철수
// 기록 보존이 90일이라 당분간 집계에 계속 나타난다. 사전 항목 자체는 지우지 않는다 —
// 지우면 옛 기록이 '이름 미등록'으로 떨어져 더 못 읽게 된다.
const RETIRED_TARGETS = new Set([
  // 꾸미기(스티커) — ADR-0015
  "sticker-duplicate",
  "sticker-delete",
  "sticker-duplicate-all",
  "sticker-delete-all",
  "sticker-lock",
  "sticker-italic",
  "sticker-highlight",
  "sticker-flip-x",
  "sticker-flip-y",
  "sticker-shadow",
  "sticker-front",
  "sticker-back",
  "sticker-add-text",
  "sticker-font-weight",
  "stf-btn",
  "stf-collapse",
  "emoji-chip",
  "shortcut-help-title",
  "back-to-decorate",
  "go-decorate",
  "decorate-preview",
  "실행 취소",
  "다시실행 (Ctrl+Y)",
  // 월드컵 — ADR-0009
  "wc-toggle",
  "wc-tac-btn",
  "wc-tac-chip",
  "io-worldcup",
  "day-wc-match",
  // 비공개 레이어 UI — ADR-0014 (비밀번호 변경은 최초공개 게이트용으로 살아 있다)
  "private-toggle",
  "private-warning-btn",
  "m-io-private",
  "scope-opt",
  // 작업자 역할 — ADR-0015
  "role-preview-worker",
  "role-preview-dual",
  // 매니저·멤버 관리 — ADR-0018(2026-09-04)
  "role-preview-manager",
  "manage-members",
  "mobile-open-members",
  "m-io-members",
  "modal:members",
  "member-role-toggle",
  "member-add",
  // 2026-09-04 철수: 휴식 넛지 · 차분한 편집실 토글 · 인사이트 새로고침 버튼 · 세션 로그 역할 칩
  "rest-nudge",
  "rest-nudge-ok",
  "rest-nudge-later",
  "studio-calm-toggle",
  "insights-refresh",
  "vlog-chip",
  // 2026-09-05 최신화 — 더 이상 찍히지 않는 id들. 기능이 사라졌거나(월드 날짜·관리 ▾ 드롭다운)
  // 이름이 바뀌었다(아래 renamed). 사전 항목은 지우지 않는다: 지우면 90일 치 옛 기록이
  // '이름 미등록'으로 떨어져 더 못 읽는다. 대신 후보 목록에서 빼 '기록만 남음' 칸으로 보낸다.
  "dev-world-day",
  "manage-menu",
  "manage-dd-trigger",
  "mobile-open-tags",
  "delete-event",
  "enter-preview",
  "go-today",
  "support-edit-open",
  "support-sheet-save",
  "support-sheet-cancel",
  "support-visit-link",
  "닫기",
  "이전",
  "다음"
]);
const RETIRED_ROUTES = new Set(["/studio/decorate", "/studio/private-layer"]);
const RETIRED_SECTIONS = new Set(["decorate"]);

const ROUTE: Record<string, TargetLabel> = {
  "/": { name: "공개 포스터", area: "시청자 화면", hint: "시청자가 보는 첫 화면" },
  "/studio": { name: "편집실", area: "편집실", hint: "일정을 짜는 달력 화면" },
  "/studio/calendar": { name: "편집실(달 바로가기)", area: "편집실", hint: "북마크로 특정 달에 바로 들어온 경우" },
  "/studio/decorate": { name: "꾸미기 화면", area: "옛 화면", hint: "스티커·배경을 꾸미는 화면" },
  "/studio/private-layer": { name: "비공개 설정 화면", area: "옛 화면" },
  "/studio/tags": { name: "태그 관리 화면", area: "태그 편집" },
  "/studio/trusted-members": { name: "멤버 관리 화면", area: "옛 화면", hint: "옛 기록(기능 철수 2026-09-04)" },
  "/login": { name: "로그인 화면", area: "계정" },
  // 화면 검사용 고정 화면 — 실제 사용자 화면이 아니라 자동 검사(Playwright)가 여는 곳이다.
  // 사람 기록에 섞이면 "이 화면은 뭐지"가 되므로 그렇다고 이름에 적어 준다.
  "/visual-fixture/poster": {
    name: "화면 검사용 포스터",
    area: "자동 검사",
    hint: "자동 화면 검사가 여는 고정 화면(사람 방문 아님)"
  },
  "/visual-fixture/studio": {
    name: "화면 검사용 편집실",
    area: "자동 검사",
    hint: "자동 화면 검사가 여는 고정 화면(사람 방문 아님)"
  }
};

const SECTION: Record<string, TargetLabel> = {
  "broadcast-panel": { name: "일정 그림판", area: "편집실", hint: "전체화면 판서 도구를 켜둔 시간" },
  "modal:tags": { name: "태그 편집 창", area: "태그 편집", hint: "관리 ▾ → 태그 편집" },
  "modal:members": { name: "멤버 관리 창", area: "옛 화면", hint: "도구 카드 설정(톱니) → 멤버 관리 '열기'" },
  "modal:developer": { name: "월별 인사이트 창", area: "인사이트", hint: "관리 ▾ → 월별 인사이트" },
  "modal:dayVisit": { name: "이용 기록 창", area: "이용 기록", hint: "지금 보고 있는 이 창" },
  // 편집 카드 여닫기(2026-09-03 계측) — leave의 dur_ms=체류, meta.typed=입력 여부, meta.how=닫은 방법
  // (save/esc/outside/cell/collapse/other). "칸 361 vs 저장 176"이 둘러보기인지 포기인지 가르기 위함.
  editor: { name: "편집 카드", area: "편집실", hint: "날짜 칸·일정 카드를 눌러 연 편집 팝오버" },
  "rest-nudge": { name: "휴식 넛지", area: "편집실", hint: "옛 기록(2026-09-03~04에만 있던 50분 휴식 카드, 철수)" },
  // 꾸미기는 라우트로 잡히므로 섹션 계측을 뺐다 — 옛 기록만 남는다.
  decorate: { name: "꾸미기", area: "옛 화면", hint: "옛 기록(지금은 화면 진입으로 셈)" }
};

const ACT: Record<string, TargetLabel> = {
  // 편집실 — 달력·편집 패널
  "open-day-visit": { name: "이용 기록 열기", area: "이용 기록", hint: "편집 패널의 '📈 이용 기록'" },
  "open-drawing-board": { name: "일정 그림판 열기", area: "편집실", hint: "미리보기의 '🖊️ 일정 그림판'" },
  "month-prev": { name: "이전 달", area: "편집실", hint: "헤더 '‹'" },
  "month-next": { name: "다음 달", area: "편집실", hint: "헤더 '›'" },
  "go-today": { name: "오늘로", area: "편집실" , hint: "옛 기록 — 지금은 'm-io-pill'(오늘)로 셉니다"},
  "calendar-cell": { name: "달력 날짜 칸", area: "편집실", hint: "날짜를 고른 횟수(모든 칸 합계)" },
  "save-event": { name: "일정 저장", area: "편집실" },
  "delete-event": { name: "일정 삭제", area: "편집실" , hint: "옛 기록 — 지금은 '일정 삭제(편집 카드)'로 셉니다"},
  "enter-preview": { name: "미리보기 들어가기", area: "편집실", hint: "시청자 화면으로 보기" },
  "teaser-gate-submit": { name: "최초공개 비번 확인", area: "편집실" },
  "close-datetime-picker": { name: "날짜·시간 고르기 닫기", area: "편집실" },
  "close-sheet-grab": { name: "편집 시트 손잡이로 닫기", area: "편집실" },

  // 관리 묶음(액션바 왼쪽, 바로 노출). manage-menu/manage-dd-trigger는 옛 드롭다운 기록용.
  "manage-menu": { name: "관리 ▾ 메뉴 열기", area: "옛 화면" },
  "manage-tags": { name: "태그 편집", area: "태그 편집" },
  "manage-members": { name: "멤버 관리", area: "옛 화면", hint: "2026-09-04부터 설정(톱니) 팝오버 맨 아래 '열기'" },
  "studio-settings": { name: "설정 열기", area: "편집실", hint: "서쪽 도구 카드의 톱니(스위치·포스터 테마)" },
  "manage-insights": { name: "월별 인사이트", area: "인사이트" },
  "mda-keep": { name: "태그 변경 계속 편집", area: "태그 편집" },
  "mda-discard": { name: "태그 변경 버리고 닫기", area: "태그 편집" },
  "mobile-open-tags": { name: "태그 편집(모바일)", area: "태그 편집" },
  "mobile-open-members": { name: "멤버 관리(모바일)", area: "옛 화면" },
  "open-insights": { name: "인사이트 열기", area: "인사이트" },
  "change-passcode": { name: "비공개 비밀번호 변경", area: "설정" },
  "close-modal": { name: "창 닫기(X)", area: "기타", hint: "여러 창의 X 버튼 합계" },

  // 역할 미리보기(개발자 전용, 보기만 바뀜)
  "role-preview-dev": { name: "역할 미리보기: 원래대로", area: "편집실" },
  "role-preview-owner": { name: "역할 미리보기: 관리자", area: "편집실" },
  "role-preview-manager": { name: "역할 미리보기: 매니저", area: "편집실", hint: "옛 기록(매니저 역할 철수 2026-09-04)" },
  "role-preview-worker": { name: "역할 미리보기: 작업자", area: "편집실" },
  "role-preview-viewer": { name: "역할 미리보기: 시청자", area: "편집실" },
  "role-preview-dual": { name: "역할 미리보기: 매니저+작업자", area: "편집실" },

  // 시청자 화면
  "schedule-card": { name: "일정 카드 열기", area: "시청자 화면", hint: "일정을 눌러 자세히 본 횟수" },
  "teaser-card": { name: "최초공개 카드 열기", area: "시청자 화면" },
  login: { name: "로그인", area: "계정" },
  logout: { name: "로그아웃", area: "계정" },

  // 꾸미기 — 스티커 툴바
  "sticker-duplicate": { name: "스티커 복제", area: "옛 화면", hint: "툴바 (Ctrl+D)" },
  "sticker-delete": { name: "스티커 삭제", area: "옛 화면", hint: "툴바 (Delete)" },
  "sticker-duplicate-all": { name: "스티커 모두 복제", area: "옛 화면", hint: "여러 개 선택했을 때" },
  "sticker-delete-all": { name: "스티커 모두 삭제", area: "옛 화면", hint: "여러 개 선택했을 때" },
  "sticker-lock": { name: "스티커 잠금/해제", area: "옛 화면", hint: "이동·크기 변경 막기" },
  "sticker-italic": { name: "글자 기울임", area: "옛 화면" },
  "sticker-highlight": { name: "글자 배경(형광펜)", area: "옛 화면" },
  "sticker-flip-x": { name: "좌우 뒤집기", area: "옛 화면" },
  "sticker-flip-y": { name: "상하 뒤집기", area: "옛 화면" },
  "sticker-shadow": { name: "진한 그림자", area: "옛 화면" },
  "sticker-front": { name: "맨 앞으로", area: "옛 화면" },
  "sticker-back": { name: "맨 뒤로", area: "옛 화면" },

  // ── 클래스에서 딴 id들(정적 부착). 이름은 화면 문구로, 위치를 반드시 붙인다 ──
  // 시청자 화면
  "agenda-event": { name: "일정 카드", area: "시청자 화면" },
  "agenda-mark": { name: "날짜 기념 표시", area: "시청자 화면" },
  "agenda-gap": { name: "빈 날 접기", area: "시청자 화면" },
  "agenda-link": { name: "일정 링크 열기", area: "시청자 화면" },
  "agenda-legend-tag": { name: "태그 필터", area: "시청자 화면", hint: "태그별 합계" },
  "agenda-legend-clear": { name: "필터 해제", area: "시청자 화면" },
  "legend-clear": { name: "필터 해제", area: "시청자 화면" },
  "tag-legend-filter": { name: "태그 필터(편집실)", area: "편집실" },
  "event-heart": { name: "하트 누르기", area: "시청자 화면" },
  "dt-hope": { name: "기대돼요", area: "시청자 화면" },
  "day-mark": { name: "기념일 표시", area: "시청자 화면" },
  "day-wc-match": { name: "월드컵 경기 표시", area: "시청자 화면" },
  "support-visit": { name: "업 도움 링크", area: "시청자 화면" },
  "mb-act": { name: "모바일 하단 버튼", area: "시청자 화면", hint: "여러 버튼 합계" },
  "avatar-ctl-toggle": { name: "아바타 위치 바꾸기", area: "시청자 화면" },
  "vlog-chip": { name: "브이로그 칩", area: "시청자 화면" },
  "vod-replay": { name: "다시보기 열기", area: "시청자 화면", hint: "날짜 상세의 '다시보기' — 숲 VOD로 이동" },
  "day-vod-open": { name: "날짜 칸 다시보기 열기", area: "시청자 화면", hint: "날짜 칸 배경 클릭 → 다시보기 팝오버" },
  "vod-chapters-open": { name: "다시보기 챕터 펼치기", area: "시청자 화면", hint: "팬 타임라인 챕터 목록" },
  "vod-chapter-jump": { name: "챕터로 점프", area: "시청자 화면", hint: "그 시각부터 숲 VOD 재생" },
  "pi-retry": { name: "이 달 기록 다시 불러오기", area: "시청자 화면" },

  // 편집실
  "m-add-event": { name: "일정 추가(모바일)", area: "편집실" },
  "m-support-edit": { name: "업 도움 수정(모바일)", area: "편집실" },
  "m-io-pill": { name: "모바일 상단 버튼", area: "편집실", hint: "여러 버튼 합계" },
  "m-rail-insights": { name: "인사이트 열기(모바일)", area: "편집실" },
  "me-fold-head": { name: "편집 패널 접기/펴기", area: "편집실" },
  "fold-head": { name: "편집 패널 접기/펴기", area: "편집실" },
  "opt-chip": { name: "일정 옵션 칩", area: "편집실", hint: "업도움·미정·떡밥 합계" },
  "scope-opt": { name: "공개 범위 고르기", area: "편집실" },
  "rest-menu-item": { name: "빠른 휴방 메뉴", area: "편집실" },
  "private-toggle": { name: "비공개 보기 켜기", area: "편집실" },
  "private-warning-btn": { name: "비공개 경고 띠", area: "편집실" },
  "delete-snack-undo": { name: "삭제 되돌리기", area: "편집실" },
  "draft-restored-discard": { name: "임시 저장 버리기", area: "편집실" },
  "kbd-hints-btn": { name: "단축키 안내", area: "편집실" },
  "shortcut-help-title": { name: "단축키 안내 접기", area: "옛 화면" },
  "preview-dd-trigger": { name: "역할 미리보기 메뉴", area: "편집실" },
  "manage-dd-trigger": { name: "관리 ▾ 메뉴 열기", area: "옛 화면" },
  "io-preview": { name: "미리보기 들어가기", area: "편집실" },
  "io-insights": { name: "인사이트 열기", area: "인사이트" },
  "io-logout": { name: "로그아웃", area: "계정" },
  "io-worldcup": { name: "월드컵 기능 켜기", area: "편집실" },

  // 일정 그림판(판서)
  "bp-eyedrop": { name: "스포이드(색 집기)", area: "그림판", hint: "그림에서 색을 찍어 펜 색으로" },
  "bp-fill": { name: "색 채우기", area: "그림판", hint: "선 안쪽을 현재 색으로 (G)" },
  "bp-region-enter": { name: "영역 선택 시작", area: "그림판", hint: "붙여넣은 그림에서 일부만 오려내기" },
  "bp-region-copy": { name: "영역 복사", area: "그림판", hint: "고른 영역을 복사본으로" },
  "bp-region-move": { name: "영역 오려 옮기기", area: "그림판" },
  "bp-region-cancel": { name: "영역 선택 취소", area: "그림판" },
  "bp-tool": { name: "그림판 도구 고르기", area: "그림판" },
  "bp-width": { name: "펜 굵기", area: "그림판" },
  "bp-color": { name: "펜 색", area: "그림판" },
  "bp-col-x": { name: "칸 비우기", area: "그림판" },
  "bp-send": { name: "그림판에 날짜 보내기", area: "그림판" },
  "bp-layer-btn": { name: "레이어 버튼", area: "그림판" },
  "bp-layer-select": { name: "레이어 고르기", area: "그림판" },

  // 꾸미기
  "stf-btn": { name: "스티커 툴바 기타 버튼", area: "옛 화면", hint: "아직 안 나눈 나머지" },
  "stf-collapse": { name: "스티커 툴바 접기", area: "옛 화면" },
  "emoji-chip": { name: "이모지 고르기", area: "옛 화면" },

  // 날짜·시간 고르기
  "dtp-trigger": { name: "날짜·시간 고르기 열기", area: "편집실" },
  "dtp-cell": { name: "날짜 고르기", area: "편집실" },
  "dtp-wheel-item": { name: "시간 고르기", area: "편집실" },
  "dtp-foot-btn": { name: "날짜·시간 확인/취소", area: "편집실" },

  // 태그 편집
  "tag-legend-clear": { name: "태그 필터 해제", area: "태그 편집" },
  "tag-add-in-section": { name: "태그 추가", area: "태그 편집" },
  "tag-editor-remove": { name: "태그 삭제", area: "태그 편집" },
  "tag-drag-handle": { name: "태그 순서 바꾸기", area: "태그 편집" },
  "tag-tone": { name: "색 톤 고르기", area: "태그 편집" },
  "tag-custom-clear": { name: "커스텀 색 지우기", area: "태그 편집" },
  "cpop-swatch": { name: "색 고르기", area: "태그 편집" },
  "cpop-kind-swap": { name: "색 방식 바꾸기", area: "태그 편집" },
  "cpop-done": { name: "색 고르기 완료", area: "태그 편집" },
  "tp-chip": { name: "태그 고르기", area: "편집실" },

  // 멤버·보안
  "member-role-toggle": { name: "멤버 역할 바꾸기", area: "옛 화면" },
  "access-expire": { name: "잠금해제 즉시 만료", area: "옛 화면" },
  "insight-change-passcode": { name: "비밀번호 변경", area: "인사이트" },
  "passcode-submit": { name: "비밀번호 확인", area: "편집실" },


  // 시청자 화면 기타
  "slc-caption": { name: "방송 중 배너", area: "시청자 화면" },
  "pill-more": { name: "일정 더 보기", area: "편집실" },

  // 시즌 장난감(월드컵)
  "wc-toggle": { name: "월드컵 조작", area: "옛 화면" },
  "wc-tac-btn": { name: "월드컵 전술 열기", area: "옛 화면" },
  "wc-tac-chip": { name: "월드컵 전술 고르기", area: "옛 화면" },

  // 인사이트 화면
  "insights-tab": { name: "인사이트 탭 바꾸기", area: "인사이트" },
  "insights-refresh": { name: "인사이트 새로고침", area: "인사이트" },

  // 이 인사이트 화면 자체(지표를 보는 행위도 기록된다)
  "activity-visit-toggle": { name: "방문 펼쳐보기", area: "이용 기록" },
  "activity-expand-all": { name: "모두 펼치기", area: "이용 기록" },
  "activity-copy": { name: "타임라인 복사", area: "이용 기록" },
  "activity-open": { name: "타임라인 접기/펴기", area: "이용 기록" },
  "activity-diag": { name: "진단 로그 보기", area: "이용 기록" },
  "usage-open": { name: "적게 쓰인 기능 접기/펴기", area: "이용 기록" },
  "usage-retired-open": { name: "지운 기능 묶음 접기/펴기", area: "이용 기록" },
  "usage-area": { name: "위치 필터", area: "이용 기록" },
  "usage-area-all": { name: "위치 필터: 전체", area: "이용 기록" },
  "usage-role": { name: "역할 필터", area: "이용 기록" },
  "usage-role-all": { name: "역할 필터: 전체", area: "이용 기록" },
  "usage-kind": { name: "종류 필터", area: "이용 기록" },
  "usage-filter-reset": { name: "필터 초기화", area: "이용 기록" },
  "legend-item": { name: "태그 범례 누르기", area: "시청자 화면", hint: "태그로 걸러 보기" },
  "usage-copy": { name: "사용량 복사", area: "이용 기록" },
  "usage-show-all": { name: "사용량 전체 보기", area: "이용 기록" },
  "usage-dev": { name: "개발자 정보 켜기", area: "이용 기록" },
  "usage-range-7": { name: "기간 7일", area: "이용 기록" },
  "usage-range-30": { name: "기간 30일", area: "이용 기록" },
  "usage-range-90": { name: "기간 90일", area: "이용 기록" },
  "usage-kind-all": { name: "종류 필터: 전체", area: "이용 기록" },
  "usage-kind-ui.click": { name: "종류 필터: 버튼", area: "이용 기록" },
  "usage-kind-route.enter": { name: "종류 필터: 화면", area: "이용 기록" },
  "usage-kind-section.enter": { name: "종류 필터: 창", area: "이용 기록" },
  "visit-scope-viewer": { name: "범위: 시청자", area: "인사이트" },
  "visit-scope-operator": { name: "범위: 운영진", area: "인사이트" },
  "visit-scope-all": { name: "범위: 전체", area: "인사이트" },

  // ── 2026-08-05: '이름 없는 버튼 여러 개(.button)'로 뭉쳐 있던 것들. 공통 모양(.button)만
  // 걸친 버튼이라 마크업 유추가 전부 한 항목이 됐다 — 소스에 data-act를 박아 갈라냈다.
  "back-to-studio": { name: "편집실로 가기", area: "시청자 화면", hint: "미리보기·꾸미기에서 편집실로" },
  "back-to-decorate": { name: "꾸미기로 가기", area: "옛 화면" },
  "go-decorate": { name: "꾸미러 가기", area: "편집실", hint: "미리보기의 '꾸미러 가기'" },
  "decorate-preview": { name: "시청자 화면 미리보기", area: "옛 화면" },
  "sticker-add-text": { name: "글자 스티커 추가", area: "옛 화면" },
  "support-sheet-cancel": { name: "업 도움 수정 취소", area: "편집실" },
  "support-sheet-save": { name: "업 도움 수정 저장", area: "편집실" },
  "support-edit-open": { name: "업 도움 기간/링크 수정 열기", area: "편집실" },
  "delete-support": { name: "업 도움 삭제", area: "편집실", hint: "기간 안내 삭제 포함" },
  "studio-calm-toggle": { name: "차분한 편집실 켜기/끄기", area: "편집실", hint: "옛 기록(토글 제거 2026-09-04 — 항상 ON)" },
  "poster-theme-select": { name: "포스터 테마 고르기", area: "편집실", hint: "설정 모달 · 관리자만" },
  "gfx-pref-select": { name: "배경 효과 품질 고르기", area: "편집실", hint: "설정 모달 — 자동/항상 최대/가볍게/끄기(lib/ui/gfx.ts v3)" },
  "ambient-showcase": { name: "배경 감상 모드 켜기", area: "배경 감상", hint: "아바타 자리·시청자 레일의 '○○ 감상하기' 버튼 — 달력·필터를 숨기고 계절 배경만(Esc/알약으로 복귀). 설정 줄은 2026-09-04 제거" },
  "ambient-showcase-exit": { name: "배경 감상 모드 나가기", area: "배경 감상", hint: "감상 모드 상단 알약" },
  "ambient-toggle-viewer": { name: "계절 배경 상태 고르기(레일)", area: "시청자 화면", hint: "레일·아바타 자리 감상하기 옆 세그먼트 [켜기|흐리게|끄기](2026-09-04, 순환 버튼 대체) — 기기 저장값(vic.ambient, 기본 끄기), 편집실 설정과 한 상태" },
  "ambient-mode-select": { name: "계절 배경 상태 고르기", area: "편집실", hint: "설정 모달 세그먼트 [켜기|흐리게|끄기](2026-09-04, 셀렉트 → 세그먼트; 옛 스위치 '계절 배경 켜기/끄기' 대체)" },
  "dev-world-season": { name: "세계 계절 강제(개발자)", area: "편집실", hint: "설정 모달 '월드 계절(개발자)' — 자동(달력 달)/봄/여름/가을/겨울. 감상 톱니와 같은 상태(2026-09-05: 감상에서 바꾸고 나오면 되돌릴 길이 없었다)" },
  "dev-world-band": { name: "세계 시간대 강제(개발자)", area: "편집실", hint: "설정 모달 '세계 시간(개발자)' — 새벽~밤 띠를 실제 시각과 무관하게(연대기 검증, 개발자 계정만·세션 한정)" },
  "dev-world-weather": { name: "세계 날씨 강제(개발자)", area: "편집실", hint: "설정 모달 '세계 시간(개발자)' — 맑음/흐림/비/눈/안개/바람(개발자 계정만·세션 한정)" },
  "dev-world-day": { name: "세계 날 강제(개발자)", area: "편집실", hint: "설정 모달 '세계 시간(개발자)' — 보고 있는 달의 날(연대기 진행 확인; 개발자 계정만·세션 한정)" },
  "dev-art-board-open": { name: "배경 아트 보드 열기(개발자)", area: "편집실", hint: "설정 모달 → /studio/ambient-art — 계절 배경 그림 자리·코덱스 프롬프트 관리(2026-09-04)" },
  "biome-move": { name: "바이옴 이동(쉐브론)", area: "배경 감상", hint: "감상 모드 가장자리 쉐브론(PLAN-20260904-004) — 방향키·WASD·스와이프와 같은 이동. data-dir = up/down/left/right" },
  "biome-map-pick": { name: "바이옴 미니맵 선택", area: "배경 감상", hint: "감상 모드 미니맵 점(열한 화면) — data-biome = 목적지" },
  "art-prompt-copy-1": { name: "아트 보드 — 1차 프롬프트 복사", area: "편집실", hint: "/studio/ambient-art(개발자) — 나무·초목·지형·물 자리의 코덱스 마스터 프롬프트" },
  "art-prompt-copy-2": { name: "아트 보드 — 2차 프롬프트 복사", area: "편집실", hint: "/studio/ambient-art(개발자) — 생물 자리" },
  "art-prompt-copy-all": { name: "아트 보드 — 전체 프롬프트 복사", area: "편집실", hint: "/studio/ambient-art(개발자)" },
  "art-slot-prompt-copy": { name: "아트 보드 — 자리 프롬프트 복사", area: "편집실", hint: "/studio/ambient-art(개발자) — 자리 하나짜리 프롬프트" },
  "rest-nudge-ok": { name: "휴식 넛지 — 쉬고 올게요", area: "편집실", hint: "옛 기록(기능 철수 2026-09-04)" },
  "rest-nudge-later": { name: "휴식 넛지 — 조금만 더", area: "편집실", hint: "옛 기록(기능 철수 2026-09-04)" },
  "google-login": { name: "Google로 로그인", area: "계정" },
  "open-in-chrome": { name: "Chrome으로 열기", area: "계정", hint: "앱 내 브라우저 안내" },
  "copy-app-link": { name: "링크 복사", area: "계정", hint: "앱 내 브라우저 안내" },
  "member-add": { name: "멤버 추가", area: "옛 화면" },
  "security-retry": { name: "보안 정보 다시 시도", area: "인사이트" },
  "passcode-change-open": { name: "비밀번호 변경 열기", area: "설정" },
  "passcode-change-save": { name: "비밀번호 변경 저장", area: "설정" },
  "passcode-change-cancel": { name: "비밀번호 변경 취소", area: "설정" },
  "sticker-font-weight": { name: "글자 굵기", area: "옛 화면" },
  "support-duration": { name: "업 도움 기간 고르기", area: "편집실" },
  "tag-editor-save": { name: "태그 저장", area: "태그 편집" },

  // 클래스 토큰으로만 잡히던 것들(auto: 경로가 점을 떼고 여기서 찾는다).
  "agenda-login": { name: "로그인", area: "계정", hint: "모바일 화면 아래 계정 줄" },
  "agenda-logout": { name: "로그아웃", area: "계정", hint: "모바일 화면 아래 계정 줄" },
  "agenda-legend-insights": { name: "이 달 기록 보기", area: "시청자 화면" },
  "insights-open": { name: "이 달 기록 보기", area: "시청자 화면" },
  "m-io-tags": { name: "태그 편집(모바일)", area: "태그 편집" },
  "m-io-members": { name: "멤버 관리(모바일)", area: "옛 화면" },
  "m-io-today": { name: "오늘로(모바일)", area: "편집실" },
  "m-io-private": { name: "비공개 일정 보기(모바일)", area: "편집실" },
  "m-del": { name: "일정 삭제(모바일)", area: "편집실" },
  "m-save": { name: "일정 저장(모바일)", area: "편집실" },
  "editor-save": { name: "일정 저장", area: "편집실" },
  "support-visit-link": { name: "업 도움 링크 열기", area: "시청자 화면" },

  // 옛 기록: data-act에 한글 문구를 그대로 박았던 값들. 이름은 이미 사람 말이라 위치만 붙인다.
  "이전 달": { name: "이전 달", area: "시청자 화면" },
  "다음 달": { name: "다음 달", area: "시청자 화면" },
  "이 달 기록 보기": { name: "이 달 기록 보기", area: "시청자 화면" },
  "방송 보러 가기": { name: "방송 보러 가기", area: "시청자 화면" },
  "업 도움 링크 열기": { name: "업 도움 링크 열기", area: "시청자 화면" },
  "기간 안내 링크 열기": { name: "기간 안내 링크 열기", area: "시청자 화면" },
  "support-kind": { name: "띠 종류 고르기", area: "편집실", hint: "업 도움 ↔ 기간 안내" },
  "실행 취소": { name: "실행 취소", area: "옛 화면" },
  "다시실행 (Ctrl+Y)": { name: "다시 실행", area: "옛 화면" },
  닫기: { name: "닫기(어느 창인지 모름)", area: "기타", hint: "옛 기록 — 2026-09-05에 창별로 갈라 놓기 전, 다섯 개의 닫기가 합쳐진 값" },
  이전: { name: "인사이트 이전 장", area: "인사이트", hint: "옛 기록 — 2026-09-05에 화면별로 갈라 놓기 전" },
  다음: { name: "인사이트 다음 장", area: "인사이트", hint: "옛 기록 — 2026-09-05에 화면별로 갈라 놓기 전" },

  // ── 2026-09-05 최신화: 살아 있는데 사전에 없어 전부 '기타'로 떨어지던 버튼들 ──
  //    (소유자: "실제 있는 버튼이나 로그 기록으로만 나오게 갱신"). 위치를 반드시 붙인다 —
  //    이름만으로는 화면에서 찾아갈 수 없고, '기타'가 많으면 이 화면 자체가 안 읽힌다.
  //    그림판(판서 도구)은 편집실과 분리된 전체화면 도구라 위치를 '그림판'으로 따로 둔다.
  "close-mobile-edit": { name: "편집 시트 닫기(X)", area: "편집실" },
  "close-teaser-gate": { name: "최초공개 잠금 화면 닫기", area: "편집실" },
  "close-day-vod": { name: "다시보기 창 닫기", area: "시청자 화면" },
  "close-detail": { name: "일정 상세 닫기(X)", area: "시청자 화면" },
  "close-detail-grab": { name: "일정 상세 손잡이로 닫기", area: "시청자 화면" },
  "close-public-insights": { name: "이 달 기록 닫기", area: "시청자 화면" },
  "biome-map-fold": { name: "지도 접기/펼치기", area: "배경 감상" },
  "ambient-showcase-settings": { name: "감상 중 배경 설정 열기/닫기", area: "배경 감상", hint: "감상 모드 오른쪽 위 톱니(2026-09-05) — 나가지 않고 계절·시간대·날씨·배경 효과를 바꾼다(개발자만)" },
  "showcase-season": { name: "감상 중 계절 고르기(개발자)", area: "배경 감상", hint: "자동(달력 달)/봄/여름/가을/겨울 — 바꾸면 서 있던 바이옴 그대로 계절만 갈린다" },
  "showcase-band": { name: "감상 중 시간대 고르기(개발자)", area: "배경 감상", hint: "자동(지금 시각)/새벽~밤 — 설정 모달의 '월드 시간대'와 같은 상태" },
  "showcase-weather": { name: "감상 중 날씨 고르기(개발자)", area: "배경 감상", hint: "자동(날짜 시드)/그 계절에 가능한 날씨 — 설정 모달의 '월드 날씨'와 같은 상태" },
  "showcase-gfx": { name: "감상 중 배경 효과 고르기", area: "배경 감상", hint: "자동/최대/가볍게 — 설정 모달의 '배경 효과'와 같은 상태" },
  "vlog-role": { name: "세션 로그 역할 고르기", area: "이용 기록" },
  "vlog-stay": { name: "세션 로그 머문/스쳐감 고르기", area: "이용 기록" },
  "insights-panel-prev": { name: "인사이트 이전 장", area: "인사이트", hint: "월별 인사이트 창의 ‹" },
  "insights-panel-next": { name: "인사이트 다음 장", area: "인사이트", hint: "월별 인사이트 창의 ›" },
  "minsights-panel-prev": { name: "내 인사이트 이전 장", area: "편집실" },
  "minsights-panel-next": { name: "내 인사이트 다음 장", area: "편집실" },

  // 편집실 — 달력·편집 카드
  "미정 표시": { name: "미정(아직 확정 아님) 켜기/끄기", area: "편집실" },
  "배포 버전 복사": { name: "배포 버전 복사", area: "편집실", hint: "헤더 왼쪽 버전 배지" },
  "역할 권한 보기": { name: "역할 권한 설명 열기", area: "편집실", hint: "계정 카드의 역할 배지" },
  "상세 닫기": { name: "일정 상세 닫기", area: "편집실" },
  "상세 카드 닫기": { name: "읽기 전용 상세 닫기", area: "편집실", hint: "편집 권한이 없을 때 뜨는 카드" },
  "편집 카드 닫기": { name: "편집 카드 닫기", area: "편집실" },
  "일정 삭제": { name: "일정 삭제(편집 카드)", area: "편집실" },
  "이 일정 삭제": { name: "일정 삭제(카드 위 X)", area: "편집실" },
  "하루 늘리기": { name: "기간 하루 늘리기", area: "편집실" },
  "하루 줄이기": { name: "기간 하루 줄이기", area: "편집실" },
  "달력 확대": { name: "달력 확대", area: "편집실" },
  "달력 축소": { name: "달력 축소", area: "편집실" },
  "달력 확대 초기화": { name: "달력 배율 100%로", area: "편집실" },

  // 설정(톱니) — 스위치들
  "생동감 있는 동작 켜기/끄기": { name: "생동감 있는 동작", area: "설정" },
  "눈 편한 테마 켜기/끄기": { name: "눈 편한 테마", area: "설정" },
  "진동 켜기/끄기": { name: "진동", area: "설정" },

  // 관리 — 태그 편집
  "태그 색 바꾸기": { name: "태그 색 고르기 열기", area: "태그 편집" },
  "실행취소(직전 색으로)": { name: "태그 색 되돌리기", area: "태그 편집", hint: "색 고르개의 되돌리기" },

  // 시청자 화면
  "관심 일정만 보기": { name: "내 관심만 보기", area: "시청자 화면" },
  "확대 초기화": { name: "포스터 배율 100%로", area: "시청자 화면" },

  // 일정 그림판(전체화면 판서 도구) — 편집실과 분리된 위치로 센다
  "일정 그림판 닫기": { name: "그림판 닫기", area: "그림판" },
  "새 그림 레이어": { name: "새 레이어", area: "그림판" },
  "레이어 선택": { name: "레이어 고르기", area: "그림판" },
  "레이어 삭제": { name: "레이어 삭제", area: "그림판" },
  "판서 전체 지우기": { name: "전체 지우기", area: "그림판", hint: "두 번 눌러 실행" },
  "다시 실행": { name: "다시 실행", area: "그림판" },
  "색 직접 고르기": { name: "색 직접 고르기", area: "그림판" },
  "일정 카드 표시": { name: "일정 카드 보이기/숨기기", area: "그림판" },
  "단축키 안내 (?)": { name: "단축키 안내 열기", area: "그림판" },
  "단축키 안내 닫기": { name: "단축키 안내 닫기", area: "그림판" },
  "위 맞춤": { name: "위 맞춤", area: "그림판", hint: "선택 정렬" },
  "세로 중앙 맞춤": { name: "세로 중앙 맞춤", area: "그림판", hint: "선택 정렬" },
  "왼쪽 맞춤": { name: "왼쪽 맞춤", area: "그림판", hint: "선택 정렬" },
  "오른쪽 맞춤": { name: "오른쪽 맞춤", area: "그림판", hint: "선택 정렬" },
  "가로 균등 간격": { name: "가로 균등 간격", area: "그림판", hint: "선택 정렬" }
};

// 이름을 안 붙여 마크업에서 유추된 값(`auto:`). 같은 클래스를 쓰는 버튼들이 한 항목으로 뭉치므로
// "여러 버튼이 합쳐진 값"임을 반드시 적는다 — 안 그러면 "1번밖에 안 눌렸네"로 잘못 읽는다.
const AUTO: Record<string, TargetLabel> = {
  ".preview-dd-item": {
    name: "메뉴 항목 여러 개",
    area: "옛 화면",
    hint: "관리 ▾ 메뉴 항목들이 하나로 합쳐진 옛 기록 (지금은 항목별로 따로 셉니다)"
  },
  ".stf-btn": {
    name: "스티커 툴바 버튼 여러 개",
    area: "옛 화면",
    hint: "복제·삭제·뒤집기 등이 합쳐진 옛 기록 (지금은 버튼별로 따로 셉니다)"
  },
  ".public-event": {
    name: "일정 카드(공개 포스터)",
    area: "시청자 화면",
    hint: "포스터의 일정 카드 전체가 합쳐진 값 (최초공개 열기는 '최초공개 카드 열기'로 따로 셉니다)"
  },
  ".agenda-event": { name: "일정 카드", area: "시청자 화면", hint: "옛 기록" },
  ".studio-event-pill": { name: "편집실 일정 카드", area: "편집실" },
  ".month-nav-btn": { name: "월 이동 버튼", area: "편집실", hint: "옛 기록 (지금은 이전/다음으로 나뉨)" },
  ".me-tool": { name: "편집 패널 도구 여러 개", area: "편집실", hint: "여러 버튼이 합쳐진 값" },
  ".button": {
    name: "이름 없던 버튼 여러 개",
    area: "기타",
    // 2026-08-05에 이 버튼들에 전부 data-act를 박아 갈라놨다. 그 전에 쌓인 기록만 여기 남는다.
    hint: "옛 기록 — 이름 붙이기 전(2026-08-05) 합쳐져 쌓인 값"
  },
  ".agenda-login": { name: "로그인", area: "계정", hint: "모바일 화면 아래 계정 줄" },
  ".agenda-logout": { name: "로그아웃", area: "계정", hint: "모바일 화면 아래 계정 줄" },
  ".legend-item": { name: "태그 범례 누르기", area: "시청자 화면", hint: "태그로 걸러 보기" },
  button: { name: "클래스 없는 버튼", area: "기타", hint: "이름도 클래스도 없어 구분할 수 없는 버튼들" },
  ".modal-close": { name: "창 닫기(X)", area: "기타", hint: "옛 기록" },
  ".insights-open": { name: "인사이트 열기", area: "인사이트", hint: "옛 기록" }
};

/** target을 사람이 읽는 이름으로. 못 풀면 이름을 지어내지 않고 '이름 미등록'으로 표시한다. */
export function describeTarget(kind: string, target: string): TargetLabel {
  if (!target) return { name: "(대상 없음)" };
  // 철수한 기능은 사전 어디서 풀리든 retired 표식을 얹는다(항목마다 박아두면 흩어져서 샌다).
  const mark = (label: TargetLabel, retired: boolean): TargetLabel =>
    retired ? { ...label, retired: true } : label;
  if (kind === "route.enter" || kind === "route.leave") {
    const hit = ROUTE[target] ?? { name: target, area: "기타", unnamed: true };
    return mark(hit, RETIRED_ROUTES.has(target));
  }
  if (kind === "section.enter" || kind === "section.leave") {
    const hit = SECTION[target] ?? { name: target, area: "기타", unnamed: true };
    return mark(hit, RETIRED_SECTIONS.has(target));
  }
  if (kind === "month.change") {
    return { name: `${target} 보기`, area: "편집실", hint: "달력에서 그 달로 이동" };
  }
  if (target.startsWith("auto:")) {
    const raw = target.slice(5);
    // data-act를 붙이기 전에 쌓인 값도 같은 클래스면 같은 버튼이다. ACT에 클래스 토큰 이름으로
    // 등록해 뒀으므로 점(.)만 떼고 한 번 더 찾는다 — 안 그러면 사전에 있는데도 '이름 미등록'으로
    // 뜬다(실측: auto:.insights-tab, auto:.dtp-cell 등 50여 개가 전부 이름 없이 보였다).
    const token = raw.startsWith(".") ? raw.slice(1) : raw;
    const retired = RETIRED_TARGETS.has(token);
    const hit = AUTO[raw];
    if (hit) return mark(hit, retired);
    const byToken = ACT[token];
    if (byToken) return mark(byToken, retired);
    // 한글 값은 옛 기록(예전엔 aria-label을 id로 썼다) — 그 자체가 사람 말이라 그대로 쓴다.
    if (/[가-힣]/.test(token)) return mark({ name: token, area: "기타", hint: "옛 기록" }, retired);
    return {
      name: "아직 이름을 안 붙인 버튼",
      area: "기타",
      hint: "무슨 버튼인지 표시하려면 이름을 등록해야 해요",
      unnamed: true
    };
  }
  const hit = ACT[target];
  if (hit) return mark(hit, RETIRED_TARGETS.has(target));
  // data-act에 한글 문구를 그대로 박은 것들(버튼의 aria-label/title에서 정적으로 딴 값).
  // 이미 사람이 읽을 수 있는 말이므로 '이름 미등록'으로 낮추지 않는다 — 위치만 모를 뿐이다.
  if (/[가-힣]/.test(target)) return { name: target, area: "기타" };
  return { name: target, area: "기타", hint: "이름이 등록되지 않은 항목", unnamed: true };
}

// 역할 표기 — 지표에서 뭉치지 않는다. "이 기능은 매니저만 쓴다" 같은 판단은 역할이 살아 있어야
// 가능하다.
//
// **비로그인(anon)을 시청자로 합치지 않는다.** 합쳤더니 "편집실에 시청자 1"처럼 설명 안 되는
// 줄이 생겼다(실측). 편집실은 시청자가 못 들어가는데 왜? — 로그아웃 직후 남아 있던 배치가
// 세션 없이 올라가 anon으로 기록된 것이었다. 둘을 갈라두면 그 자리에서 읽힌다.
// (매니저·작업자는 철수 — 옛 기록의 이름은 ROLE_NAME에 남기고 순서/필터에서는 뺀다.)
/**
 * '위치'는 **화면에서 갈 수 있는 한 곳**이다(2026-09-05 정리 — 소유자: "검사·공통·관리·그림판·
 * 일정 그림판… 종류가 왜 이리 많고 뭐가 뭔지 헷갈린다").
 *
 * 규칙 세 줄:
 *   1) 한 값 = 한 곳. 같은 곳에 두 이름을 두지 않는다(그림판 / 일정 그림판 → **그림판**).
 *   2) 기기는 위치가 아니다 — '(모바일)' 꼬리표를 붙이지 않는다(기기는 방문 줄에 따로 있다).
 *   3) 창이면 그 **창 이름**을 그대로 쓴다(태그 편집 · 인사이트 · 이용 기록 · 설정).
 *      '관리'·'공통' 같은 묶음 이름은 무엇을 가리키는지 알 수 없어 폐지했다.
 *
 * '시청자 화면'은 시청자에게는 늘 보는 화면이고 관리자·개발자에게는 미리보기로 여는 **같은 화면**이다
 * — 한 곳이므로 한 이름이다. 목록 순서는 자주 가는 곳부터(가나다순은 관계없는 곳을 이웃으로 만든다).
 */
export const AREA_ORDER = [
  "편집실",
  "시청자 화면",
  "그림판",
  "태그 편집",
  "인사이트",
  "이용 기록",
  "설정",
  "배경 감상",
  "계정",
  "옛 화면",
  "자동 검사",
  "기타"
] as const;

/** 위치 목록을 위 순서대로. 목록에 없는 이름은 뒤에 가나다순으로 붙인다(이름을 버리지 않는다). */
export function sortAreas(areas: readonly string[]): string[] {
  const rank = (a: string) => {
    const i = AREA_ORDER.indexOf(a as (typeof AREA_ORDER)[number]);
    return i < 0 ? AREA_ORDER.length : i;
  };
  return [...areas].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ko"));
}

export const ROLE_ORDER = ["owner", "developer", "viewer", "anon", "unknown"] as const;
export const ROLE_NAME: Record<string, string> = {
  owner: "관리자",
  manager: "매니저",
  worker: "작업자",
  developer: "개발자",
  viewer: "시청자",
  anon: "비로그인",
  // 로그인은 했는데 역할 조회가 실패해 최소 권한으로 떨어진 기록(2026-09-05, lib/auth/actor.ts).
  // 'viewer'로 적으면 "시청자가 편집실 버튼을 눌렀다"는 거짓이 되므로 따로 남긴다.
  unknown: "역할 확인 못 함"
};
/**
 * 사용량 화면의 역할 필터 계수.
 *
 * ⚠ 2026-09-05: 예전엔 '시청자'가 **비로그인을 포함**했다("시청자가 늘 0건으로 보인다"는 이유).
 * 그 합치기가 소유자 신고("시청자가 누를 수 없는 버튼인데 시청자가 눌렀다고 나온다")의 직접 원인이었다 —
 * 세션이 끊긴 뒤 도착한 관리자·개발자 배치는 anon으로 저장되는데, 화면에서 그게 '시청자 N번'이 됐다.
 * 지금은 합치지 않는다(타임라인이 이미 같은 이유로 갈라 두고 있었다 — 두 화면의 철학이 어긋나 있었다).
 */
export function usageRoleCount(roles: Record<string, number>, role: string): number {
  return roles[role] ?? 0;
}

/** 사용량 화면의 역할 목록. 비로그인·역할 확인 못 함까지 **갈라서** 보여준다(위 주석).
 *  '작업자'·'매니저'는 뺐다(역할 자체가 철수): 고를 수 없는 역할의 필터는 죽은 칩이다.
 *  옛 기록의 횟수는 내역 줄(usageRoleBreakdown)에 이름 그대로 계속 나온다. */
export const USAGE_ROLE_ORDER = ["owner", "developer", "viewer", "anon", "unknown"] as const;

/** 사용량 화면 역할 내역 — 타임라인과 같은 규칙(갈라서 센다). */
export function usageRoleBreakdown(roles: Record<string, number>): string {
  const parts = USAGE_ROLE_ORDER.filter((r) => (roles[r] ?? 0) > 0).map(
    (r) => `${ROLE_NAME[r]} ${roles[r]}`
  );
  for (const [k, v] of Object.entries(roles)) {
    if (!USAGE_ROLE_ORDER.includes(k as (typeof USAGE_ROLE_ORDER)[number]) && v > 0) {
      // 목록에서 뺀 옛 역할(매니저·작업자)도 이름이 있으면 사람 말로 — 기록을 버리지 않는다.
      parts.push(`${ROLE_NAME[k] ?? k} ${v}`);
    }
  }
  return parts.join(" · ") || "기록 없음";
}

/** 역할별 횟수를 "관리자 3 · 개발자 12" 같은 한 줄로. 0인 역할은 뺀다. */
export function roleBreakdown(roles: Record<string, number>): string {
  const parts = ROLE_ORDER.filter((r) => (roles[r] ?? 0) > 0).map(
    (r) => `${ROLE_NAME[r]} ${roles[r]}`
  );
  // 순서에서 뺀 옛 역할(매니저·작업자)은 사람 말로 뒤에 붙이고, 사전에 없는 역할이 생겨도 버리지 않는다(지어내지 않는 원칙).
  for (const [k, v] of Object.entries(roles)) {
    if (!ROLE_ORDER.includes(k as (typeof ROLE_ORDER)[number]) && v > 0) parts.push(`${ROLE_NAME[k] ?? k} ${v}`);
  }
  return parts.join(" · ") || "기록 없음";
}
