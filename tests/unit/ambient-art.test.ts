import { describe, expect, it } from "vitest";
import {
  ART_SLOTS,
  codexMasterPrompt,
  dotBlock,
  dotGrid,
  pilotFiles,
  pilotPrompt,
  pilotSlots,
  slotFiles,
  slotPrompt,
  SOURCE_EDGE,
  targetEdge
} from "@/components/shared/ambient/art/manifest";
import { SPECIES } from "@/components/shared/ambient/world/species";
import { monthTraces } from "@/components/shared/ambient/world/traces";

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
  // 2026-09-07 결정 ⓐ′ — 도트를 살리는 조건은 "1024를 정수배로 줄인다" 하나로 요약된다. 목표 변이나 격자가 1024를
  // 정수로 나누지 못하면 nearest 축소가 도트를 들쭉날쭉 버리고, 그때 화면에서 화풍이 갈린다.
  it("저장 목표 변과 도트 격자는 1024를 정수로 나눈다", () => {
    for (const s of ART_SLOTS) {
      const edge = targetEdge(s.px);
      const grid = dotGrid(s.px, s.grid);
      expect(SOURCE_EDGE % edge, `${s.id} 목표 변 ${edge}`).toBe(0);
      expect(SOURCE_EDGE % grid, `${s.id} 격자 ${grid}`).toBe(0);
      expect(dotBlock(s.px, s.grid), `${s.id} 블록`).toBe(SOURCE_EDGE / grid);
      // 저장본은 자리 상자를 DPR 2로 그릴 만큼은 커야 한다(화면 px의 2배 이상).
      expect(edge, `${s.id} 저장 변이 화면보다 작다`).toBeGreaterThanOrEqual(Math.min(512, Math.max(s.px[0], s.px[1]) * 2));
    }
  });
  it("도트 격자는 자리 크기를 따라간다 — 고정값이면 작은 자리의 도트가 화면에서 사라진다", () => {
    // 화면 도트 = 자리 긴 변 × DPR 2 ÷ 격자. 1.5~8 장치px 안에 들어야 "굵은 점"으로 읽힌다.
    for (const s of ART_SLOTS.filter((x) => x.phase === 1)) {
      const dot = (Math.max(s.px[0], s.px[1]) * 2) / dotGrid(s.px, s.grid);
      expect(dot, `${s.id} 화면 도트 ${dot.toFixed(2)} 장치px`).toBeGreaterThanOrEqual(1.5);
      expect(dot, `${s.id} 화면 도트 ${dot.toFixed(2)} 장치px`).toBeLessThanOrEqual(8);
    }
  });
  // 2026-09-07: 12 → 14. 가을·겨울 소나무에 변형 2를 더했다 — 장면이 계절마다 **다른 파일**을 고르므로
  // (`land.ts` pineId), 봄·여름에만 변형이 둘이면 가을·겨울 산은 한 장을 40번 찍는다(반복감의 주범).
  it("파일럿 배치는 14장이고, 그 프롬프트는 파일럿 파일만 싣는다", () => {
    const slots = pilotSlots();
    const files = slots.flatMap((s) => pilotFiles(s));
    expect(files.length).toBe(14);
    for (const s of slots) expect(pilotFiles(s).length, s.id).toBeLessThanOrEqual(slotFiles(s).length);
    const p = pilotPrompt();
    for (const f of files) expect(p).toContain(f);
    // 파일럿에서 빼 둔 변형(갈대 3·4번, 시스택 2번)은 이번 표에 없어야 한다.
    expect(p).not.toContain("reed-3.png");
    expect(p).not.toContain("sea-stack-2.png");
    expect(p).toContain("| tree-pine |");
  });
  it("now는 실제로 화면에 그려지는 것과 맞는다 — 코드 대체물이 있으면 none이 아니다", () => {
    // `now: "none"`은 "아직 정하지 않았다"가 아니라 **화면이 비어 있다**는 뜻이다(보드가 빨간 띠로 표시하고 따로 센다).
    // 이 값이 낡으면 계획서를 이 필드로 읽는 사람이 빈 자리 수를 잘못 센다(2026-09-07에 14개가 낡아 있었다).
    const empty = ART_SLOTS.filter((s) => s.now === "none");
    expect(empty.length).toBe(26);
    expect(empty.map((s) => s.id)).not.toContain("rock");
    expect(empty.map((s) => s.id)).toContain("sea-stack");
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

describe("traces — 연잎 간격", () => {
  it("8월 말 연잎 12장은 서로 겹치지 않게 떨어져 있다(가로 .045·세로 .06 밖)", () => {
    const pads = monthTraces("vic", 2026, 8).filter((t) => t.kind === "lilypad");
    expect(pads.length).toBe(12);
    let close = 0;
    for (let i = 0; i < pads.length; i++)
      for (let j = i + 1; j < pads.length; j++)
        if (Math.abs(pads[i].u - pads[j].u) <= 0.045 && Math.abs(pads[i].v - pads[j].v) <= 0.06) close++;
    expect(close).toBeLessThanOrEqual(1);
  });
});
