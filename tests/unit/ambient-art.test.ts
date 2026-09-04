import { describe, expect, it } from "vitest";
import { ART_SLOTS, codexMasterPrompt, slotFiles, slotPrompt } from "@/components/shared/ambient/art/manifest";
import { SPECIES } from "@/components/shared/ambient/world/species";
import { chronicle } from "@/components/shared/ambient/world/chronicle";

describe("ambient/art — 매니페스트", () => {
  it("id는 유일하고 파일 이름으로 안전하다", () => {
    const ids = ART_SLOTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("종 레지스트리의 모든 종이 2차 자리로 들어온다(목록이 둘로 갈라지지 않는다)", () => {
    for (const sp of SPECIES) {
      const slot = ART_SLOTS.find((s) => s.id === sp.id);
      expect(slot, sp.id).toBeTruthy();
      expect(slot?.phase).toBe(2);
    }
  });
  it("변형 자리는 -1..-n 파일, 나머지는 <id>.png 하나", () => {
    const lily = ART_SLOTS.find((s) => s.id === "lilypad")!;
    expect(slotFiles(lily)).toEqual(["lilypad-1.png", "lilypad-2.png", "lilypad-3.png"]);
    const oak = ART_SLOTS.find((s) => s.id === "tree-oak-winter")!;
    expect(slotFiles(oak)).toEqual(["tree-oak-winter.png"]);
  });
  it("마스터 프롬프트는 모든 자리의 id·스타일 규칙·금지색을 담고, phase로 좁혀진다", () => {
    const all = codexMasterPrompt();
    for (const s of ART_SLOTS) expect(all).toContain(`| ${s.id} |`);
    expect(all).toContain("선명한 빨강·주황·노랑 금지");
    expect(all).toContain("soopoolleaf.com/ko/acnh/Fish/");
    expect(all).toContain("투명");
    const p1 = codexMasterPrompt(1);
    expect(p1).toContain("| tree-oak-winter |");
    expect(p1).not.toContain("| rabbit |");
    const p2 = codexMasterPrompt(2);
    expect(p2).toContain("| rabbit |");
    expect(p2).not.toContain("| tree-oak-winter |");
  });
  it("자리 프롬프트는 파일 이름·카메라·그릴 것·스타일 가이드를 담는다", () => {
    const s = ART_SLOTS.find((x) => x.id === "mushroom")!;
    const p = slotPrompt(s);
    expect(p).toContain("mushroom-1.png, mushroom-2.png");
    expect(p).toContain("동물의 숲 카메라");
    expect(p).toContain(s.brief);
    expect(p).toContain("## 스타일 가이드");
  });
});

describe("chronicle — 연잎 간격", () => {
  it("8월 말 연잎 12장은 서로 겹치지 않게 떨어져 있다(가로 .045·세로 .06 밖)", () => {
    const pads = chronicle("vic", 2026, 8, 31).filter((t) => t.kind === "lilypad");
    expect(pads.length).toBe(12);
    let close = 0;
    for (let i = 0; i < pads.length; i++)
      for (let j = i + 1; j < pads.length; j++)
        if (Math.abs(pads[i].u - pads[j].u) <= 0.045 && Math.abs(pads[i].v - pads[j].v) <= 0.06) close++;
    expect(close).toBeLessThanOrEqual(1);
  });
});
