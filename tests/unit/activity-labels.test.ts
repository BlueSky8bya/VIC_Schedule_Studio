import { describe, expect, it } from "vitest";
import { describeTarget } from "@/lib/activity/labels";

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
  it("주요 항목에 위치가 붙는다", () => {
    expect(describeTarget("ui.click", "sticker-delete").area).toBe("꾸미기");
    expect(describeTarget("ui.click", "manage-tags").area).toBe("관리");
    expect(describeTarget("ui.click", "schedule-card").area).toBe("시청자 화면");
    expect(describeTarget("ui.click", "calendar-cell").area).toBe("편집실");
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
    const d = describeTarget("ui.click", "판서 전체 지우기");
    expect(d.name).toBe("판서 전체 지우기");
    expect(d.unnamed).toBeUndefined();
  });
  it("클래스에서 딴 id는 사전에서 이름·위치가 나온다", () => {
    expect(describeTarget("ui.click", "bp-color").area).toBe("일정 그림판");
    expect(describeTarget("ui.click", "event-heart").name).toBe("하트 누르기");
  });
});
