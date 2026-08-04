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
  "broadcast-panel": { name: "방송 판서", hint: "일정 그림판(전체화면)" },
  decorate: { name: "꾸미기 모드", hint: "미리보기 제외한 실제 꾸미기 시간" },
  "modal:tags": { name: "태그 편집 창" },
  "modal:members": { name: "신뢰 멤버 창" },
  "modal:developer": { name: "인사이트 창" },
  "modal:notice": { name: "공지 쓰기 창" },
  "modal:dayVisit": { name: "방문 기록 창" }
};

// 버튼 — data-act로 고정한 id.
const ACT: Record<string, TargetLabel> = {
  "open-notice": { name: "공지 쓰기 열기" },
  "open-day-visit": { name: "방문 기록 열기" },
  "month-prev": { name: "이전 달" },
  "month-next": { name: "다음 달" },
  "calendar-cell": { name: "날짜 칸", hint: "달력에서 날짜를 고른 횟수(칸 전체 합계)" },
  "activity-visit-toggle": { name: "타임라인 방문 펼치기" },
  "activity-copy": { name: "타임라인 복사" },
  "usage-show-all": { name: "사용량 전체 보기" },
  "usage-range-7": { name: "사용량 기간 7일" },
  "usage-range-30": { name: "사용량 기간 30일" },
  "usage-range-90": { name: "사용량 기간 90일" },
  "usage-kind-all": { name: "사용량 필터: 전체" },
  "usage-kind-ui.click": { name: "사용량 필터: 버튼" },
  "usage-kind-route.enter": { name: "사용량 필터: 화면" },
  "usage-kind-section.enter": { name: "사용량 필터: 패널" },
  "visit-scope-viewer": { name: "인사이트 범위: 시청자" },
  "visit-scope-operator": { name: "인사이트 범위: 운영진" },
  "visit-scope-all": { name: "인사이트 범위: 전체" }
};

// data-act가 없어 마크업에서 유추된 id(`auto:` 접두사). 클래스 기반이라 같은 클래스를 쓰는
// 버튼들이 한 항목으로 뭉친다 — 이름에 그 사실을 적어 오해를 막는다.
const AUTO: Record<string, TargetLabel> = {
  ".preview-dd-item": {
    name: "드롭다운 메뉴 항목",
    hint: "'관리 ▾'·역할 미리보기 메뉴의 항목들이 한 항목으로 합쳐진 값"
  },
  ".stf-btn": { name: "스티커 툴바 버튼", hint: "복제·삭제·정렬 등이 합쳐진 값" },
  ".public-event": { name: "일정 카드(포스터)", hint: "시청자 화면에서 일정 카드를 연 횟수" },
  ".studio-event-pill": { name: "일정 카드(편집실)" },
  ".month-nav-btn": { name: "월 이동 버튼", hint: "data-act 부착 전에 쌓인 옛 값" },
  ".me-tool": { name: "편집 패널 도구 버튼" },
  ".button": { name: "일반 버튼", hint: "공통 클래스라 여러 버튼이 합쳐진 값" }
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
