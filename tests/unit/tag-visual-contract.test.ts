import { describe, expect, it } from "vitest";
import type {
  BroadcastTag,
  ColorPaletteEntry,
  PublicScheduleEvent
} from "@/lib/domain/schedule-types";
import {
  categoryColorKey,
  eventColorStyle,
  eventInkStyle,
  getEventTagColors,
  getExtraCategoryColors,
  mixedEventStyle
} from "@/lib/calendar/month";
import { createTagVisualResolver } from "@/lib/tags/tag-visual";

// ── 태그 색/잉크 계약 특성화(characterization) 테스트 ──────────────────────────
// 색 계산을 단일 resolver로 옮기기(0A) 전에 '현재 동작'을 못박는다. 옮긴 뒤에도 이 테스트가
// 그대로 통과하면 = 픽셀/의미 동일. 특히 코덱스가 짚은 함정을 고정한다: 대분류 dedup·태그 순서·
// 같은 색을 content/modifier가 공유할 때의 우선순위·고아 팔레트·자식 상속·2색 윈도잉.

const palette: ColorPaletteEntry[] = [
  { key: "red", name: "빨강", bgColor: "#d11a2a", textColor: "#ffffff", borderColor: "#a8121f", sortOrder: 1 },
  { key: "blue", name: "파랑", bgColor: "#2f63d6", textColor: "#ffffff", borderColor: "#1f49a8", sortOrder: 2 },
  { key: "yellow", name: "노랑", bgColor: "#ffec99", textColor: "#6b4e00", borderColor: "#e3bf17", sortOrder: 3 },
  { key: "mint", name: "민트", bgColor: "#9fe8c4", textColor: "#0c4a32", borderColor: "#5cc497", sortOrder: 4 },
  { key: "indigo", name: "남색", bgColor: "#5a44c2", textColor: "#ffffff", borderColor: "#4131a0", sortOrder: 5 }
];

function tag(partial: Partial<BroadcastTag> & { id: string; colorKey: string }): BroadcastTag {
  return {
    tagKey: partial.id,
    displayName: partial.id,
    sortOrder: 0,
    isDefault: false,
    isActive: true,
    parentId: null,
    kind: "content",
    ...partial
  };
}

const tags: BroadcastTag[] = [
  tag({ id: "game", colorKey: "red" }),
  tag({ id: "collab", colorKey: "blue" }),
  tag({ id: "chat", colorKey: "yellow" }),
  tag({ id: "vr", colorKey: "mint", kind: "modifier" }),
  tag({ id: "game-lol", colorKey: "red", parentId: "game" }), // 세부(부모 색 상속)
  tag({ id: "game-mj", colorKey: "red", parentId: "game" }),
  tag({ id: "vrRed", colorKey: "red", kind: "modifier" }), // content game과 같은 색을 쓰는 modifier
  tag({ id: "ghost", colorKey: "nosuch" }) // 팔레트에 없는 색(고아)
];

function ev(tagIds: string[], primaryTagIds: string[] = tagIds): PublicScheduleEvent {
  return {
    id: "e",
    startsAt: "2026-06-01T20:00:00+09:00",
    isAllDay: false,
    publicTitle: "t",
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds,
    primaryTagIds,
    sortOrder: 1
  };
}

const keys = (arr: ColorPaletteEntry[]) => arr.map((c) => c.key);

describe("tag color contract — fills & extras (dots)", () => {
  it("단일 콘텐츠 태그 → 칸 색 1개, 점 없음", () => {
    expect(keys(getEventTagColors(ev(["game"]), tags, palette))).toEqual(["red"]);
    expect(keys(getExtraCategoryColors(ev(["game"]), tags, palette))).toEqual([]);
  });

  it("콘텐츠 2개 → 칸 색 2개(그라데이션), 순서 유지", () => {
    expect(keys(getEventTagColors(ev(["game", "collab"]), tags, palette))).toEqual(["red", "blue"]);
    // 순서 뒤집으면 색 순서도 뒤집힌다(first-wins).
    expect(keys(getEventTagColors(ev(["collab", "game"]), tags, palette))).toEqual(["blue", "red"]);
  });

  it("콘텐츠 + 수식어 → 칸 색은 콘텐츠만, 수식어는 점 줄로", () => {
    expect(keys(getEventTagColors(ev(["game", "vr"]), tags, palette))).toEqual(["red"]);
    expect(keys(getExtraCategoryColors(ev(["game", "vr"]), tags, palette))).toEqual(["mint"]);
  });

  it("같은 대분류 세부는 부모 색으로 합쳐진다(dedup)", () => {
    expect(categoryColorKey("game-lol", tags)).toBe("red");
    expect(keys(getEventTagColors(ev(["game-lol", "game-mj"]), tags, palette))).toEqual(["red"]);
  });

  it("콘텐츠 3개 → 앞 2개는 칸 색, 넘친 1개는 점 줄", () => {
    expect(keys(getEventTagColors(ev(["game", "collab", "chat"]), tags, palette))).toEqual([
      "red",
      "blue"
    ]);
    expect(keys(getExtraCategoryColors(ev(["game", "collab", "chat"]), tags, palette))).toEqual([
      "yellow"
    ]);
  });

  it("같은 색을 content·modifier가 공유하면 '첫 등장'의 종류가 이긴다(순서가 카드↔점을 뒤집음)", () => {
    // game(content, red)이 먼저 → red는 칸 색, modifier vrRed는 dedup되어 사라짐.
    expect(keys(getEventTagColors(ev(["game", "vrRed"]), tags, palette))).toEqual(["red"]);
    expect(keys(getExtraCategoryColors(ev(["game", "vrRed"]), tags, palette))).toEqual([]);
    // vrRed(modifier, red)가 먼저 → red가 modifier로 잡혀 칸 색에서 빠지고 점 줄로 간다.
    expect(keys(getEventTagColors(ev(["vrRed", "game"]), tags, palette))).toEqual([]);
    expect(keys(getExtraCategoryColors(ev(["vrRed", "game"]), tags, palette))).toEqual(["red"]);
  });

  it("팔레트에 없는 색(고아)은 조용히 탈락한다(현재 동작)", () => {
    expect(keys(getEventTagColors(ev(["ghost"]), tags, palette))).toEqual([]);
    expect(keys(getExtraCategoryColors(ev(["ghost"]), tags, palette))).toEqual([]);
  });
});

describe("ink contract — eventInkStyle", () => {
  it("태그 글자색이 AA 통과하면 그대로 쓴다", () => {
    const ink = eventInkStyle("#ffec99", "#6b4e00", "yellow"); // 노랑 위 진한 갈색(대비 충분)
    expect(ink.color).toBe("#6b4e00");
  });

  it("AA 미달이면 흑/백 중 대비 높은 쪽으로 교정한다", () => {
    const ink = eventInkStyle("#d11a2a", "#d11a2a", "red"); // 배경=글자 동색(대비 1)
    expect(["#0a0a0a", "#ffffff"]).toContain(ink.color);
  });

  it("0B: 모든 카드에 얇은 헤일로, 무늬 카드는 더 두껍게(+굵기)", () => {
    const plain = eventInkStyle("#2f63d6", "#ffffff", "blue"); // 무늬 아님
    const patterned = eventInkStyle("#5a44c2", "#ffffff", "indigo"); // 무늬 색
    const plainShadow = String(plain["--evt-shadow" as keyof typeof plain]);
    const patShadow = String(patterned["--evt-shadow" as keyof typeof patterned]);
    // 민무늬도 헤일로가 있다(과거 'none'에서 바뀜 — 파스텔 위 가독성).
    expect(plainShadow).not.toBe("none");
    expect(plainShadow).toContain("#2f63d6");
    // 무늬 카드는 그림자 레이어가 더 많다(불투명도↑).
    expect(patShadow.split(",").length).toBeGreaterThan(plainShadow.split(",").length);
  });

  it("굵기는 700/800/900 중 하나(대비 구간)", () => {
    const w = eventInkStyle("#ffec99", "#6b4e00", "yellow")["--evt-weight" as never];
    expect(["700", "800", "900"]).toContain(w);
  });
});

describe("style contract — single & mixed", () => {
  it("단색 칸 스타일 = 배경/테두리 + 잉크", () => {
    const style = eventColorStyle(getEventTagColors(ev(["game"]), tags, palette));
    expect(style.backgroundColor).toBe("#d11a2a");
    expect(style.borderColor).toBe("#a8121f");
  });

  it("2색 윈도잉: run.index/length → 배경 위치가 이어진 칸 가운데로 경계", () => {
    const colors = getEventTagColors(ev(["game", "collab"]), tags, palette);
    // 3칸 묶음의 가운데 칸(index 1, length 3) → 위치 (1/2)*100 = 50%.
    expect(mixedEventStyle(colors, { index: 1, length: 3 }).backgroundPositionX).toBe("50%");
    // 1칸이면 center.
    expect(mixedEventStyle(colors, { index: 0, length: 1 }).backgroundPositionX).toBe("center");
    // 크기 = length*100% 100%.
    expect(mixedEventStyle(colors, { index: 0, length: 3 }).backgroundSize).toBe("300% 100%");
  });
});

// resolver가 기존 month.ts 함수와 '동일 결과'를 내는지(0A 픽셀 불변의 근거).
describe("resolver parity — createTagVisualResolver", () => {
  const r = createTagVisualResolver(tags, palette);

  it("visualOf.colorKey = categoryColorKey(기존)와 일치, 상속 포함", () => {
    for (const t of tags) {
      expect(r.visualOf(t.id).colorKey).toBe(categoryColorKey(t.id, tags));
    }
    // 세부는 부모 대분류를 root로.
    expect(r.visualOf("game-lol").rootTagId).toBe("game");
    expect(r.visualOf("game").rootTagId).toBe("game");
  });

  it("visualOf가 bg/border/legacyTextColor/kind/patternKey를 채운다", () => {
    const v = r.visualOf("game"); // red, content
    expect(v).toMatchObject({
      kind: "content",
      colorKey: "red",
      bg: "#d11a2a",
      border: "#a8121f",
      legacyTextColor: "#ffffff",
      missing: false
    });
    expect(r.visualOf("vr").kind).toBe("modifier");
    // 무늬 파생(colorKey 기준): red=plain(민무늬), mint=diag(무늬).
    expect(r.visualOf("game").patternKey).toBe("plain");
    expect(r.visualOf("vr").patternKey).toBe("diag");
  });

  it("고아/미지 태그는 missing:true, 색 null", () => {
    expect(r.visualOf("ghost")).toMatchObject({ missing: true, colorKey: "nosuch", bg: null });
    expect(r.visualOf("no-such-tag")).toMatchObject({ missing: true, colorKey: null });
  });

  it("eventFills/eventExtras = getEventTagColors/getExtraCategoryColors(기존)와 동일", () => {
    const cases = [
      ["game"],
      ["game", "collab"],
      ["collab", "game"],
      ["game", "vr"],
      ["game", "collab", "chat"],
      ["vrRed", "game"],
      ["ghost"]
    ];
    for (const ids of cases) {
      const e = ev(ids);
      expect(keys(r.eventFills(e))).toEqual(keys(getEventTagColors(e, tags, palette)));
      expect(keys(r.eventExtras(e))).toEqual(keys(getExtraCategoryColors(e, tags, palette)));
    }
  });
});
