import { describe, expect, it } from "vitest";
import {
  USAGE_ROLE_ORDER,
  describeTarget,
  roleBreakdown,
  usageRoleBreakdown,
  usageRoleCount
} from "@/lib/activity/labels";

// 이 화면을 보는 사람은 대부분 코드를 모른다(관리자·매니저). 규약:
//   1) 화면에 실제로 쓰인 말로 부른다
//   2) 어디에 있는지(area)를 함께 준다
//   3) 모르는 값은 이름을 지어내지 않고 '이름 미등록'으로 표시한다(원문은 개발자 정보·복사본에만)

describe("이름은 화면에 쓰인 말로", () => {
  it("코드 이름이 아니라 버튼 문구로 부른다", () => {
    // broadcast-panel은 코드 이름일 뿐, 화면 버튼은 '🖊️ 일정 그림판'이다.
    expect(describeTarget("section.enter", "broadcast-panel").name).toBe("일정 그림판");
    expect(describeTarget("route.enter", "/studio").name).toBe("편집실");
    expect(describeTarget("ui.click", "open-day-visit").name).toBe("이용 기록 열기");
  });
  it("월 이동은 어느 달인지 그대로 읽힌다", () => {
    expect(describeTarget("month.change", "2026-09").name).toBe("2026-09 보기");
  });
});

describe("위치(area)를 준다 — 이름만으로는 찾아갈 수 없다", () => {
  // 위치 = 화면에서 갈 수 있는 한 곳(2026-09-05 정리). 묶음 이름('관리'·'공통')은 폐지하고
  // 창이면 그 창 이름을 그대로 쓴다 — 목록만 보고도 어디인지 알 수 있어야 한다.
  it("주요 항목에 위치가 붙는다", () => {
    expect(describeTarget("ui.click", "sticker-delete").area).toBe("옛 화면");
    expect(describeTarget("ui.click", "manage-tags").area).toBe("태그 편집");
    expect(describeTarget("ui.click", "schedule-card").area).toBe("시청자 화면");
    expect(describeTarget("ui.click", "calendar-cell").area).toBe("편집실");
    expect(describeTarget("ui.click", "logout").area).toBe("계정");
    expect(describeTarget("ui.click", "일정 그림판 닫기").area).toBe("그림판");
  });
  it("같은 곳에 두 이름을 두지 않는다", () => {
    // '그림판'과 '일정 그림판'이 따로 있었다 — 필터 목록에 같은 곳이 두 줄로 떴다.
    const areas = new Set(
      ["bp-color", "일정 그림판 닫기", "새 그림 레이어", "판서 전체 지우기"].map(
        (t) => describeTarget("ui.click", t).area
      )
    );
    expect([...areas]).toEqual(["그림판"]);
  });
  it("기기는 위치가 아니다 — '(모바일)' 꼬리표가 없다", () => {
    expect(describeTarget("ui.click", "close-mobile-edit").area).toBe("편집실");
    expect(describeTarget("ui.click", "close-detail-grab").area).toBe("시청자 화면");
  });
});

describe("모르는 값은 지어내지 않는다", () => {
  it("이름 안 붙인 auto 값은 '이름 미등록'으로", () => {
    const d = describeTarget("ui.click", "auto:.something-new");
    expect(d.unnamed).toBe(true);
    expect(d.name).toBe("아직 이름을 안 붙인 버튼");
    // 원문을 화면 이름에 그대로 흘리지 않는다.
    expect(d.name).not.toContain("something-new");
  });
  it("사전에 없는 data-act는 unnamed 표시", () => {
    expect(describeTarget("ui.click", "brand-new-button").unnamed).toBe(true);
  });
  it("아는 값은 unnamed가 아니다", () => {
    expect(describeTarget("ui.click", "usage-copy").unnamed).toBeUndefined();
  });
});

describe("뭉친 옛 값은 뭉쳤다고 말한다", () => {
  it("합계임을 이름·부연에서 알 수 있어야 '1번밖에 안 눌렸네'로 오해하지 않는다", () => {
    const stf = describeTarget("ui.click", "auto:.stf-btn");
    expect(stf.name).toContain("여러 개");
    expect(stf.hint).toContain("따로 셉니다");
    const dd = describeTarget("ui.click", "auto:.preview-dd-item");
    expect(dd.name).toContain("여러 개");
  });
});

describe("정적으로 박은 한글 id", () => {
  it("한글 문구는 그 자체가 사람 말이라 '이름 미등록'으로 낮추지 않는다", () => {
    // 사전에 없는 한글 id는 그대로 통과한다(이름을 지어내지도, 미등록으로 낮추지도 않는다).
    const d = describeTarget("ui.click", "아직 사전에 없는 한글 버튼");
    expect(d.name).toBe("아직 사전에 없는 한글 버튼");
    expect(d.unnamed).toBeUndefined();
  });
  it("사전에 등록하면 위치까지 나온다(2026-09-05 최신화)", () => {
    // '판서 전체 지우기'는 살아 있는 버튼이라 이름·위치를 등록했다 — 예전엔 위치가 '기타'였다.
    const d = describeTarget("ui.click", "판서 전체 지우기");
    expect(d.name).toBe("전체 지우기");
    expect(d.area).toBe("그림판");
  });
  it("클래스에서 딴 id는 사전에서 이름·위치가 나온다", () => {
    expect(describeTarget("ui.click", "bp-color").area).toBe("그림판");
    expect(describeTarget("ui.click", "event-heart").name).toBe("하트 누르기");
  });
});

describe("역할별 분해 — 뭉치지 않는다", () => {
  it("역할이 살아 있어야 '이 기능은 매니저만 쓴다' 같은 판단이 된다", () => {
    expect(roleBreakdown({ owner: 3, developer: 12, viewer: 5 })).toBe(
      "관리자 3 · 개발자 12 · 시청자 5"
    );
    // 비로그인은 시청자와 가른다 — 합치면 "편집실에 시청자"처럼 설명 안 되는 줄이 생긴다.
    expect(roleBreakdown({ developer: 1, anon: 2 })).toBe("개발자 1 · 비로그인 2");
  });
  it("0인 역할은 빼고, 순서는 관리자→개발자→시청자→비로그인 — 철수한 역할(매니저·작업자)은 사람 말로 뒤에 붙는다", () => {
    expect(roleBreakdown({ viewer: 2, manager: 1 })).toBe("시청자 2 · 매니저 1");
    expect(roleBreakdown({ owner: 1, worker: 3, viewer: 2 })).toBe("관리자 1 · 시청자 2 · 작업자 3");
  });
  it("모르는 역할이 생겨도 버리지 않는다(지어내지 않는 원칙과 같다)", () => {
    expect(roleBreakdown({ ghost: 4 })).toBe("ghost 4");
  });
  it("빈 값도 안전하게", () => {
    expect(roleBreakdown({})).toBe("기록 없음");
  });
});

// 역할 필터 계수 — 2026-09-05 정책 반전.
// 예전엔 '시청자'가 비로그인(anon)을 **합산**했다("시청자가 늘 0건으로 보인다"가 이유였다).
// 그 합치기가 소유자 신고("시청자가 누를 수 없는 버튼인데 시청자가 눌렀다고 나온다")의 직접
// 원인이었다 — 세션이 끊긴 뒤 도착한 관리자·개발자 배치는 anon으로 저장되는데 화면에서는
// '시청자 N번'이 됐다. 지금은 갈라 센다(타임라인 roleBreakdown과 같은 규칙).
describe("usageRoleCount", () => {
  it("시청자는 비로그인을 합산하지 않는다", () => {
    expect(usageRoleCount({ viewer: 2, anon: 38 }, "viewer")).toBe(2);
    expect(usageRoleCount({ anon: 38 }, "viewer")).toBe(0);
  });

  it("비로그인만 고르면 비로그인만 센다", () => {
    expect(usageRoleCount({ viewer: 2, anon: 38 }, "anon")).toBe(38);
  });

  it("역할 확인 못 함도 제 칸으로 센다", () => {
    expect(usageRoleCount({ unknown: 4, viewer: 1 }, "unknown")).toBe(4);
  });

  it("다른 역할은 그대로", () => {
    expect(usageRoleCount({ owner: 3, anon: 38 }, "owner")).toBe(3);
    expect(usageRoleCount({ owner: 3 }, "manager")).toBe(0);
  });
});

describe("usageRoleBreakdown — 비로그인을 시청자로 둔갑시키지 않는다", () => {
  it("갈라서 적는다", () => {
    expect(usageRoleBreakdown({ viewer: 2, anon: 38 })).toBe("시청자 2 · 비로그인 38");
    expect(usageRoleBreakdown({ developer: 1, anon: 2 })).toBe("개발자 1 · 비로그인 2");
  });
  it("'비로그인'이라고 그대로 적는다", () => {
    expect(usageRoleBreakdown({ anon: 5 })).toBe("비로그인 5");
  });
  it("역할 확인 못 함도 이름이 있다", () => {
    expect(usageRoleBreakdown({ unknown: 3 })).toBe("역할 확인 못 함 3");
  });
  it("역할 목록에 비로그인·확인 못 함이 있다", () => {
    expect(USAGE_ROLE_ORDER).toContain("anon");
    expect(USAGE_ROLE_ORDER).toContain("unknown");
    expect(USAGE_ROLE_ORDER).toContain("viewer");
  });
  it("모르는 역할은 그대로 남기고, 빈 값도 안전하게", () => {
    expect(usageRoleBreakdown({ ghost: 4 })).toBe("ghost 4");
    expect(usageRoleBreakdown({})).toBe("기록 없음");
  });
  it("타임라인용 roleBreakdown은 여전히 가른다", () => {
    expect(roleBreakdown({ developer: 1, anon: 2 })).toBe("개발자 1 · 비로그인 2");
  });
});

// 2026-08-31: '적게 쓰인 기능'은 없앨 후보를 찾는 화면 — 이미 철수한 기능(꾸미기·월드컵·
// 비공개 레이어 UI·작업자, ADR-0009/0014/0015)은 retired 표식으로 갈라낸다. 사전에서 항목을
// 지우면 옛 기록이 '이름 미등록'으로 떨어지므로 지우지 않고 표식만 얹는다.
describe("철수한 기능은 retired로 표시된다", () => {
  it("꾸미기·월드컵·비공개 UI·작업자 미리보기", () => {
    expect(describeTarget("ui.click", "sticker-delete").retired).toBe(true);
    expect(describeTarget("ui.click", "wc-toggle").retired).toBe(true);
    expect(describeTarget("ui.click", "private-toggle").retired).toBe(true);
    expect(describeTarget("ui.click", "role-preview-worker").retired).toBe(true);
    expect(describeTarget("route.enter", "/studio/decorate").retired).toBe(true);
    expect(describeTarget("section.enter", "decorate").retired).toBe(true);
  });
  it("auto: 접두사(옛 기록)도 같은 버튼이면 같이 표시된다", () => {
    expect(describeTarget("ui.click", "auto:.stf-btn").retired).toBe(true);
  });
  it("살아있는 기능엔 붙지 않는다 — 비밀번호 변경은 최초공개 게이트용으로 살아 있다", () => {
    expect(describeTarget("ui.click", "save-event").retired).toBeUndefined();
    expect(describeTarget("ui.click", "change-passcode").retired).toBeUndefined();
    expect(describeTarget("section.enter", "broadcast-panel").retired).toBeUndefined();
  });
  it("역할 필터에서 작업자는 빠지고, 옛 기록 내역엔 '작업자 N'으로 남는다", () => {
    expect(USAGE_ROLE_ORDER).not.toContain("worker");
    expect(usageRoleBreakdown({ worker: 3, owner: 1 })).toBe("관리자 1 · 작업자 3");
  });
});

// 소스에 박은 data-act는 전부 사전에 있어야 한다 — 없으면 화면에 '아직 이름을 안 붙인 버튼'으로
// 뜬다(2026-08-05 실측: bp-eyedrop·bp-region-* 등이 그랬다). 새 버튼을 만들면 여기서 걸린다.
describe("모든 data-act에 이름이 있다", () => {
  it("사전에 없는 data-act가 소스에 없다", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith(".tsx")) files.push(p);
      }
    };
    walk(path.join(process.cwd(), "components"));
    walk(path.join(process.cwd(), "app"));
    const missing = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/data-act="([^"{}]+)"/g)) {
        const id = m[1];
        if (describeTarget("ui.click", id).unnamed) missing.add(`${path.basename(f)}:${id}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
