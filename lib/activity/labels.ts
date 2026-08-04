// 행동 기록의 target(버튼 id·라우트·패널 키)을 사람이 읽는 이름으로 푼다.
// 저장은 기계용 id로 하되(안정성), 보는 건 사람 말로 — `.preview-dd-item`만 보고
// 그게 뭔지 알 수 있는 사람은 이 코드를 방금 쓴 사람뿐이다.
//
// 사전에 없으면 원래 id를 그대로 쓴다(모르는 걸 지어내지 않는다). 그런 항목이 자주 보이면
// 그때 여기에 한 줄 추가하거나, 버튼에 data-act를 붙여 이름부터 명확하게 만든다.

export type TargetLabel = { name: string; hint?: string };

// 라우트 — route.enter/leave의 target(월 파라미터는 meta로 따로 들어간다).
const ROUTE: Record<string, TargetLabel> = {
  "/": { name: "공개 포스터", hint: "시청자가 보는 첫 화면" },
  "/studio": { name: "편집실", hint: "스튜디오 홈(달력)" },
  "/studio/calendar": { name: "편집실 달력", hint: "월 직접 진입(북마크·콜드 진입)" },
  "/studio/decorate": { name: "꾸미기 화면", hint: "스티커·배경 편집 라우트" },
  "/studio/private-layer": { name: "비공개 레이어 설정" },
  "/studio/tags": { name: "태그 관리 화면" },
  "/studio/trusted-members": { name: "신뢰 멤버 화면" }
};

// 라우트가 아닌 화면 — section.enter/leave의 target.
const SECTION: Record<string, TargetLabel> = {
  // 코드 안 이름은 broadcast-panel이지만 화면 버튼은 '🖊️ 일정 그림판'이다. 지표는 화면 말로 쓴다.
  "broadcast-panel": { name: "일정 그림판", hint: "전체화면 판서 도구를 켜둔 시간" },
  decorate: { name: "꾸미기", hint: "미리보기를 뺀 실제 꾸미기 시간" },
  "modal:tags": { name: "태그 편집 창", hint: "관리 ▾ → 태그 편집" },
  "modal:members": { name: "멤버 관리 창", hint: "관리 ▾ → 멤버 관리" },
  "modal:developer": { name: "월별 인사이트 창", hint: "관리 ▾ → 월별 인사이트" },
  "modal:notice": { name: "공지 쓰기 창" },
  "modal:dayVisit": { name: "방문 기록 창", hint: "지금 보고 있는 이 창" }
};

// 버튼 — data-act로 고정한 id. 이름은 **화면에 실제로 쓰인 말**로 적는다.
// ('방송 판서' 같은 내부 용어를 쓰면 지표를 보는 사람이 그게 어느 버튼인지 알 수 없다.)
const ACT: Record<string, TargetLabel> = {
  // 편집실 상단·편집 패널
  "open-notice": { name: "공지 쓰기", hint: "편집 패널의 '📢 공지 쓰기'" },
  "open-day-visit": { name: "방문 기록 열기", hint: "편집 패널의 '📈 방문'" },
  "open-drawing-board": { name: "일정 그림판 열기", hint: "미리보기 오버레이의 '🖊️ 일정 그림판'" },
  "month-prev": { name: "이전 달 (‹)", hint: "편집실 헤더 월 이동" },
  "month-next": { name: "다음 달 (›)", hint: "편집실 헤더 월 이동" },
  "calendar-cell": { name: "달력 날짜 칸", hint: "달력에서 날짜를 고른 횟수(모든 칸 합계)" },

  // 관리 ▾ 메뉴
  "manage-tags": { name: "관리 ▾ → 태그 편집" },
  "manage-members": { name: "관리 ▾ → 멤버 관리" },
  "manage-insights": { name: "관리 ▾ → 월별 인사이트" },

  // 역할 미리보기 메뉴(개발자 전용, 보기 전용 전환)
  "role-preview-dev": { name: "역할 미리보기 → 개발자(원래대로)" },
  "role-preview-owner": { name: "역할 미리보기 → 관리자" },
  "role-preview-manager": { name: "역할 미리보기 → 매니저" },
  "role-preview-worker": { name: "역할 미리보기 → 작업자" },
  "role-preview-viewer": { name: "역할 미리보기 → 시청자" },
  "role-preview-dual": { name: "역할 미리보기 → 매니저·작업자 겸업" },

  // 일정 카드
  "schedule-card": { name: "일정 카드 열기", hint: "포스터에서 일정을 눌러 상세를 연 횟수" },
  "teaser-card": { name: "최초공개(떡밥) 카드 열기" },

  // 꾸미기 — 스티커 선택 툴바
  "sticker-duplicate": { name: "스티커 복제", hint: "툴바 복제 (Ctrl+D)" },
  "sticker-delete": { name: "스티커 삭제", hint: "툴바 삭제 (Delete)" },
  "sticker-duplicate-all": { name: "스티커 모두 복제", hint: "여러 개 선택했을 때" },
  "sticker-delete-all": { name: "스티커 모두 삭제", hint: "여러 개 선택했을 때" },
  "sticker-lock": { name: "스티커 잠금/해제", hint: "이동·크기 변경 방지" },
  "sticker-italic": { name: "글자 기울임" },
  "sticker-highlight": { name: "글자 배경(하이라이트)" },
  "sticker-flip-x": { name: "좌우 대칭" },
  "sticker-flip-y": { name: "상하 대칭" },
  "sticker-shadow": { name: "진한 그림자" },
  "sticker-front": { name: "맨 앞으로" },
  "sticker-back": { name: "맨 뒤로" },

  // 인사이트 화면 자체의 조작(지표를 보는 행위도 지표다)
  "activity-visit-toggle": { name: "타임라인 방문 펼치기" },
  "activity-expand-all": { name: "타임라인 모두 펼치기" },
  "activity-copy": { name: "타임라인 복사" },
  "usage-show-all": { name: "사용량 전체 보기" },
  "usage-range-7": { name: "사용량 기간 7일" },
  "usage-range-30": { name: "사용량 기간 30일" },
  "usage-range-90": { name: "사용량 기간 90일" },
  "usage-kind-all": { name: "사용량 필터 전체" },
  "usage-kind-ui.click": { name: "사용량 필터 버튼" },
  "usage-kind-route.enter": { name: "사용량 필터 화면" },
  "usage-kind-section.enter": { name: "사용량 필터 패널" },
  "visit-scope-viewer": { name: "인사이트 범위 시청자" },
  "visit-scope-operator": { name: "인사이트 범위 운영진" },
  "visit-scope-all": { name: "인사이트 범위 전체" }
};

// data-act가 없어 마크업에서 유추된 id(`auto:` 접두사). 클래스 기반이라 같은 클래스를 쓰는
// 버튼들이 한 항목으로 뭉친다 — 이름에 "여러 버튼이 합쳐진 값"임을 반드시 적는다.
// 그래야 "1회밖에 안 눌렸네"로 잘못 읽지 않는다. 갈라 보려면 그 버튼에 data-act를 붙인다.
const AUTO: Record<string, TargetLabel> = {
  ".preview-dd-item": {
    name: "드롭다운 메뉴 항목(합계)",
    hint: "'관리 ▾'와 역할 미리보기 메뉴 항목이 합쳐진 옛 값. 지금은 항목별로 갈라 기록된다"
  },
  ".stf-btn": {
    name: "스티커 툴바 버튼(합계)",
    hint: "복제·삭제·대칭·정렬 등이 합쳐진 옛 값. 지금은 버튼별로 갈라 기록된다"
  },
  ".public-event": { name: "최초공개 카드(옛 값)", hint: "지금은 '최초공개(떡밥) 카드 열기'로 기록" },
  ".agenda-event": { name: "일정 카드(옛 값)", hint: "지금은 '일정 카드 열기'로 기록" },
  ".studio-event-pill": { name: "편집실 일정 카드" },
  ".month-nav-btn": { name: "월 이동 버튼(옛 값)", hint: "지금은 '이전 달/다음 달'로 갈라 기록" },
  ".me-tool": { name: "편집 패널 도구 버튼(합계)" },
  ".button": { name: "일반 버튼(합계)", hint: "공통 클래스라 여러 버튼이 합쳐진 값" }
};

/** target을 사람이 읽는 이름으로. 못 풀면 원래 값을 그대로 돌려준다. */
export function describeTarget(kind: string, target: string): TargetLabel {
  if (!target) return { name: "(이름 없음)" };
  if (kind === "route.enter" || kind === "route.leave") {
    return ROUTE[target] ?? { name: target };
  }
  if (kind === "section.enter" || kind === "section.leave") {
    return SECTION[target] ?? { name: target };
  }
  if (target.startsWith("auto:")) {
    const raw = target.slice(5);
    const hit = AUTO[raw];
    if (hit) return hit;
    // 클래스도 사전에 없으면 점(.)만 떼서 보여준다 — 원문은 호출부가 title로 함께 보여준다.
    return { name: raw.startsWith(".") ? raw.slice(1) : raw, hint: "마크업에서 유추한 이름" };
  }
  return ACT[target] ?? { name: target };
}
