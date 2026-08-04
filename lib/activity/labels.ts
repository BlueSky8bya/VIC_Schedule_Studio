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
};

const ROUTE: Record<string, TargetLabel> = {
  "/": { name: "공개 포스터", area: "시청자 화면", hint: "시청자가 보는 첫 화면" },
  "/studio": { name: "편집실", area: "편집실", hint: "일정을 짜는 달력 화면" },
  "/studio/calendar": { name: "편집실(달 바로가기)", area: "편집실", hint: "북마크로 특정 달에 바로 들어온 경우" },
  "/studio/decorate": { name: "꾸미기 화면", area: "꾸미기", hint: "스티커·배경을 꾸미는 화면" },
  "/studio/private-layer": { name: "비공개 설정 화면", area: "관리" },
  "/studio/tags": { name: "태그 관리 화면", area: "관리" },
  "/studio/trusted-members": { name: "멤버 관리 화면", area: "관리" }
};

const SECTION: Record<string, TargetLabel> = {
  "broadcast-panel": { name: "일정 그림판", area: "편집실", hint: "전체화면 판서 도구를 켜둔 시간" },
  "modal:tags": { name: "태그 편집 창", area: "관리", hint: "관리 ▾ → 태그 편집" },
  "modal:members": { name: "멤버 관리 창", area: "관리", hint: "관리 ▾ → 멤버 관리" },
  "modal:developer": { name: "월별 인사이트 창", area: "관리", hint: "관리 ▾ → 월별 인사이트" },
  "modal:notice": { name: "공지 쓰기 창", area: "편집실" },
  "modal:dayVisit": { name: "이용 기록 창", area: "관리", hint: "지금 보고 있는 이 창" },
  // 꾸미기는 라우트로 잡히므로 섹션 계측을 뺐다 — 옛 기록만 남는다.
  decorate: { name: "꾸미기", area: "꾸미기", hint: "옛 기록(지금은 화면 진입으로 셈)" }
};

const ACT: Record<string, TargetLabel> = {
  // 편집실 — 달력·편집 패널
  "open-notice": { name: "공지 쓰기", area: "편집실", hint: "편집 패널의 '📢 공지 쓰기'" },
  "open-day-visit": { name: "이용 기록 열기", area: "편집실", hint: "편집 패널의 '📈 이용 기록'" },
  "open-drawing-board": { name: "일정 그림판 열기", area: "편집실", hint: "미리보기의 '🖊️ 일정 그림판'" },
  "month-prev": { name: "이전 달", area: "편집실", hint: "헤더 '‹'" },
  "month-next": { name: "다음 달", area: "편집실", hint: "헤더 '›'" },
  "go-today": { name: "오늘로", area: "편집실" },
  "calendar-cell": { name: "달력 날짜 칸", area: "편집실", hint: "날짜를 고른 횟수(모든 칸 합계)" },
  "save-event": { name: "일정 저장", area: "편집실" },
  "delete-event": { name: "일정 삭제", area: "편집실" },
  "enter-preview": { name: "미리보기 들어가기", area: "편집실", hint: "시청자 화면으로 보기" },
  "teaser-gate-submit": { name: "최초공개 비번 확인", area: "편집실" },
  "close-datetime-picker": { name: "날짜·시간 고르기 닫기", area: "편집실" },
  "close-sheet-grab": { name: "편집 시트 손잡이로 닫기", area: "편집실(모바일)" },

  // 관리 ▾ 메뉴
  "manage-menu": { name: "관리 ▾ 메뉴 열기", area: "관리" },
  "manage-tags": { name: "태그 편집", area: "관리", hint: "관리 ▾ 안" },
  "manage-members": { name: "멤버 관리", area: "관리", hint: "관리 ▾ 안" },
  "manage-insights": { name: "월별 인사이트", area: "관리", hint: "관리 ▾ 안" },
  "mobile-open-tags": { name: "태그 편집(모바일)", area: "관리" },
  "mobile-open-members": { name: "멤버 관리(모바일)", area: "관리" },
  "open-insights": { name: "인사이트 열기", area: "관리" },
  "change-passcode": { name: "비공개 비밀번호 변경", area: "관리" },
  "close-modal": { name: "창 닫기(X)", area: "공통", hint: "여러 창의 X 버튼 합계" },

  // 역할 미리보기(개발자 전용, 보기만 바뀜)
  "role-preview-dev": { name: "역할 미리보기: 원래대로", area: "관리" },
  "role-preview-owner": { name: "역할 미리보기: 관리자", area: "관리" },
  "role-preview-manager": { name: "역할 미리보기: 매니저", area: "관리" },
  "role-preview-worker": { name: "역할 미리보기: 작업자", area: "관리" },
  "role-preview-viewer": { name: "역할 미리보기: 시청자", area: "관리" },
  "role-preview-dual": { name: "역할 미리보기: 매니저+작업자", area: "관리" },

  // 시청자 화면
  "schedule-card": { name: "일정 카드 열기", area: "시청자 화면", hint: "일정을 눌러 자세히 본 횟수" },
  "teaser-card": { name: "최초공개 카드 열기", area: "시청자 화면" },
  login: { name: "로그인", area: "공통" },
  logout: { name: "로그아웃", area: "공통" },

  // 꾸미기 — 스티커 툴바
  "sticker-duplicate": { name: "스티커 복제", area: "꾸미기", hint: "툴바 (Ctrl+D)" },
  "sticker-delete": { name: "스티커 삭제", area: "꾸미기", hint: "툴바 (Delete)" },
  "sticker-duplicate-all": { name: "스티커 모두 복제", area: "꾸미기", hint: "여러 개 선택했을 때" },
  "sticker-delete-all": { name: "스티커 모두 삭제", area: "꾸미기", hint: "여러 개 선택했을 때" },
  "sticker-lock": { name: "스티커 잠금/해제", area: "꾸미기", hint: "이동·크기 변경 막기" },
  "sticker-italic": { name: "글자 기울임", area: "꾸미기" },
  "sticker-highlight": { name: "글자 배경(형광펜)", area: "꾸미기" },
  "sticker-flip-x": { name: "좌우 뒤집기", area: "꾸미기" },
  "sticker-flip-y": { name: "상하 뒤집기", area: "꾸미기" },
  "sticker-shadow": { name: "진한 그림자", area: "꾸미기" },
  "sticker-front": { name: "맨 앞으로", area: "꾸미기" },
  "sticker-back": { name: "맨 뒤로", area: "꾸미기" },

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
  "shortcut-help-title": { name: "단축키 안내 접기", area: "꾸미기" },
  "preview-dd-trigger": { name: "역할 미리보기 메뉴", area: "관리" },
  "manage-dd-trigger": { name: "관리 ▾ 메뉴 열기", area: "관리" },
  "io-preview": { name: "미리보기 들어가기", area: "편집실" },
  "io-insights": { name: "인사이트 열기", area: "관리" },
  "io-logout": { name: "로그아웃", area: "공통" },
  "io-worldcup": { name: "월드컵 기능 켜기", area: "편집실" },

  // 일정 그림판(판서)
  "bp-tool": { name: "그림판 도구 고르기", area: "일정 그림판" },
  "bp-width": { name: "펜 굵기", area: "일정 그림판" },
  "bp-color": { name: "펜 색", area: "일정 그림판" },
  "bp-col-x": { name: "칸 비우기", area: "일정 그림판" },
  "bp-send": { name: "그림판에 날짜 보내기", area: "일정 그림판" },
  "bp-layer-btn": { name: "레이어 버튼", area: "일정 그림판" },
  "bp-layer-select": { name: "레이어 고르기", area: "일정 그림판" },

  // 꾸미기
  "stf-btn": { name: "스티커 툴바 기타 버튼", area: "꾸미기", hint: "아직 안 나눈 나머지" },
  "stf-collapse": { name: "스티커 툴바 접기", area: "꾸미기" },
  "emoji-chip": { name: "이모지 고르기", area: "꾸미기" },

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
  "member-role-toggle": { name: "멤버 역할 바꾸기", area: "멤버 관리" },
  "access-expire": { name: "잠금해제 즉시 만료", area: "관리" },
  "insight-change-passcode": { name: "비밀번호 변경", area: "관리" },
  "passcode-submit": { name: "비밀번호 확인", area: "관리" },

  // 공지
  "notice-copy-button": { name: "공지 복사", area: "공지" },

  // 시청자 화면 기타
  "slc-caption": { name: "방송 중 배너", area: "시청자 화면" },
  "pill-more": { name: "일정 더 보기", area: "편집실" },

  // 시즌 장난감(월드컵)
  "wc-toggle": { name: "월드컵 조작", area: "시즌 기능" },
  "wc-tac-btn": { name: "월드컵 전술 열기", area: "시즌 기능" },
  "wc-tac-chip": { name: "월드컵 전술 고르기", area: "시즌 기능" },

  // 인사이트 화면
  "insights-tab": { name: "인사이트 탭 바꾸기", area: "인사이트" },
  "insights-refresh": { name: "인사이트 새로고침", area: "인사이트" },

  // 이 인사이트 화면 자체(지표를 보는 행위도 기록된다)
  "activity-visit-toggle": { name: "방문 펼쳐보기", area: "인사이트" },
  "activity-expand-all": { name: "모두 펼치기", area: "인사이트" },
  "activity-copy": { name: "타임라인 복사", area: "인사이트" },
  "activity-open": { name: "타임라인 접기/펴기", area: "인사이트" },
  "activity-diag": { name: "진단 로그 보기", area: "인사이트" },
  "usage-open": { name: "적게 쓰인 기능 접기/펴기", area: "인사이트" },
  "usage-area": { name: "위치 필터", area: "인사이트" },
  "usage-area-all": { name: "위치 필터: 전체", area: "인사이트" },
  "usage-role": { name: "역할 필터", area: "인사이트" },
  "usage-role-all": { name: "역할 필터: 전체", area: "인사이트" },
  "legend-item": { name: "태그 범례 누르기", area: "시청자 화면", hint: "태그로 걸러 보기" },
  "usage-copy": { name: "사용량 복사", area: "인사이트" },
  "usage-show-all": { name: "사용량 전체 보기", area: "인사이트" },
  "usage-dev": { name: "개발자 정보 켜기", area: "인사이트" },
  "usage-range-7": { name: "기간 7일", area: "인사이트" },
  "usage-range-30": { name: "기간 30일", area: "인사이트" },
  "usage-range-90": { name: "기간 90일", area: "인사이트" },
  "usage-kind-all": { name: "종류 필터: 전체", area: "인사이트" },
  "usage-kind-ui.click": { name: "종류 필터: 버튼", area: "인사이트" },
  "usage-kind-route.enter": { name: "종류 필터: 화면", area: "인사이트" },
  "usage-kind-section.enter": { name: "종류 필터: 창", area: "인사이트" },
  "visit-scope-viewer": { name: "범위: 시청자", area: "인사이트" },
  "visit-scope-operator": { name: "범위: 운영진", area: "인사이트" },
  "visit-scope-all": { name: "범위: 전체", area: "인사이트" }
};

// 이름을 안 붙여 마크업에서 유추된 값(`auto:`). 같은 클래스를 쓰는 버튼들이 한 항목으로 뭉치므로
// "여러 버튼이 합쳐진 값"임을 반드시 적는다 — 안 그러면 "1번밖에 안 눌렸네"로 잘못 읽는다.
const AUTO: Record<string, TargetLabel> = {
  ".preview-dd-item": {
    name: "메뉴 항목 여러 개",
    area: "관리",
    hint: "관리 ▾ 메뉴 항목들이 하나로 합쳐진 옛 기록 (지금은 항목별로 따로 셉니다)"
  },
  ".stf-btn": {
    name: "스티커 툴바 버튼 여러 개",
    area: "꾸미기",
    hint: "복제·삭제·뒤집기 등이 합쳐진 옛 기록 (지금은 버튼별로 따로 셉니다)"
  },
  ".public-event": { name: "최초공개 카드", area: "시청자 화면", hint: "옛 기록" },
  ".agenda-event": { name: "일정 카드", area: "시청자 화면", hint: "옛 기록" },
  ".studio-event-pill": { name: "편집실 일정 카드", area: "편집실" },
  ".month-nav-btn": { name: "월 이동 버튼", area: "편집실", hint: "옛 기록 (지금은 이전/다음으로 나뉨)" },
  ".me-tool": { name: "편집 패널 도구 여러 개", area: "편집실", hint: "여러 버튼이 합쳐진 값" },
  ".button": { name: "이름 없는 버튼 여러 개", area: "공통", hint: "공통 모양의 버튼들이 합쳐진 값" },
  ".legend-item": { name: "태그 범례 누르기", area: "시청자 화면", hint: "태그로 걸러 보기" },
  button: { name: "클래스 없는 버튼", area: "기타", hint: "이름도 클래스도 없어 구분할 수 없는 버튼들" },
  ".modal-close": { name: "창 닫기(X)", area: "공통", hint: "옛 기록" },
  ".insights-open": { name: "인사이트 열기", area: "관리", hint: "옛 기록" }
};

/** target을 사람이 읽는 이름으로. 못 풀면 이름을 지어내지 않고 '이름 미등록'으로 표시한다. */
export function describeTarget(kind: string, target: string): TargetLabel {
  if (!target) return { name: "(대상 없음)" };
  if (kind === "route.enter" || kind === "route.leave") {
    return ROUTE[target] ?? { name: target, area: "기타", unnamed: true };
  }
  if (kind === "section.enter" || kind === "section.leave") {
    return SECTION[target] ?? { name: target, area: "기타", unnamed: true };
  }
  if (kind === "month.change") {
    return { name: `${target} 보기`, area: "편집실", hint: "달력에서 그 달로 이동" };
  }
  if (target.startsWith("auto:")) {
    const raw = target.slice(5);
    const hit = AUTO[raw];
    if (hit) return hit;
    // data-act를 붙이기 전에 쌓인 값도 같은 클래스면 같은 버튼이다. ACT에 클래스 토큰 이름으로
    // 등록해 뒀으므로 점(.)만 떼고 한 번 더 찾는다 — 안 그러면 사전에 있는데도 '이름 미등록'으로
    // 뜬다(실측: auto:.insights-tab, auto:.dtp-cell 등 50여 개가 전부 이름 없이 보였다).
    const token = raw.startsWith(".") ? raw.slice(1) : raw;
    const byToken = ACT[token];
    if (byToken) return byToken;
    // 한글 값은 옛 기록(예전엔 aria-label을 id로 썼다) — 그 자체가 사람 말이라 그대로 쓴다.
    if (/[가-힣]/.test(token)) return { name: token, area: "기타", hint: "옛 기록" };
    return {
      name: "아직 이름을 안 붙인 버튼",
      area: "기타",
      hint: "무슨 버튼인지 표시하려면 이름을 등록해야 해요",
      unnamed: true
    };
  }
  const hit = ACT[target];
  if (hit) return hit;
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
export const ROLE_ORDER = ["owner", "manager", "worker", "developer", "viewer", "anon"] as const;
export const ROLE_NAME: Record<string, string> = {
  owner: "관리자",
  manager: "매니저",
  worker: "작업자",
  developer: "개발자",
  viewer: "시청자",
  anon: "비로그인"
};
/** 역할별 횟수를 "관리자 3 · 개발자 12" 같은 한 줄로. 0인 역할은 뺀다. */
export function roleBreakdown(roles: Record<string, number>): string {
  const parts = ROLE_ORDER.filter((r) => (roles[r] ?? 0) > 0).map(
    (r) => `${ROLE_NAME[r]} ${roles[r]}`
  );
  // 사전에 없는 역할이 생겨도 버리지 않는다(지어내지 않는 원칙과 같다).
  for (const [k, v] of Object.entries(roles)) {
    if (!ROLE_ORDER.includes(k as (typeof ROLE_ORDER)[number]) && v > 0) parts.push(`${k} ${v}`);
  }
  return parts.join(" · ") || "기록 없음";
}
