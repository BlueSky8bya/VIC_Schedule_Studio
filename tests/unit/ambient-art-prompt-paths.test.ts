import { describe, expect, it } from "vitest";
import { ART_SLOTS, artSlot, batchPrompt, CATEGORY_KO, codexMasterPrompt, pilotPrompt, slotPrompt } from "@/components/shared/ambient/art/manifest";
import { localizeArtPromptPaths } from "@/components/shared/ambient/art/prompt-paths";

describe("current art prompt folder labels", () => {
  it("uses manifest category labels for exact shared-reference paths", () => {
    const source = Object.keys(CATEGORY_KO).map((category) => `\`art-src/reference/${category}/\``).join("\n");
    const expected = Object.values(CATEGORY_KO).map(() => `\`art-src/공통화풍참고/\``).join("\n");
    expect(localizeArtPromptPaths(source)).toBe(expected);
    expect(localizeArtPromptPaths("  art-src/reference/<범주>/  ← 형태 발상"))
      .toBe("  art-src/공통화풍참고/  ← 형태 발상");
  });

  it("routes the retired incoming location and default delivery placeholder without inventing a run", () => {
    expect(localizeArtPromptPaths("`art-src/incoming-*/`는 2차·3차 반려본"))
      .toBe("`art-src/나무/소나무/반려본/`는 2차·3차 반려본");
    expect(localizeArtPromptPaths("납품: `art-src/<범주>/<family>/runs/<run>/raw`"))
      .toBe("납품: `art-src/<범주명>/<엔티티명>/작업회차/<회차>/원본`");
  });

  it("leaves runtime URLs, PNG names, external paths, unknown categories and frozen exact paths untouched", () => {
    const source = [
      "/ambient/art/tree-pine-1.png", "public/ambient/art/tree-pine-autumn-1.png",
      "docs/ambient/reference/tree-pine.png", "/studio/ambient-art/tree-pine",
      "https://example.test/art-src/reference/tree/", "prefix-art-src/reference/tree/",
      "art-src/reference/unknown/", "art-src/reference/tree-old/",
      "art-src/tree/tree-pine/runs/20260909-pilot-01/inputs/baseline/tree-pine-1.png",
      "inputs, raw, normalized, reference, 1024×1024, 20%, 0.7"
    ].join("\n");
    expect(localizeArtPromptPaths(source)).toBe(source);
  });

  it.each([
    ["single slot", () => slotPrompt(artSlot("tree-pine")!)],
    ["missing files", () => batchPrompt(ART_SLOTS.filter((slot) => slot.category === "tree"), "남은 파일", { files: ["tree-pine-2.png"] })],
    ["pilot", () => pilotPrompt()],
    ["phase one", () => codexMasterPrompt(1)],
    ["phase two", () => codexMasterPrompt(2)],
    ["all slots", () => codexMasterPrompt()]
  ] as const)("updates retired shared-reference wording while preserving filenames in real %s output", (_label, makePrompt) => {
    const original = makePrompt(), result = localizeArtPromptPaths(original);
    expect(result).not.toBe(original);
    expect(result.match(/\b[a-z][a-z0-9-]*\.png\b/g)).toEqual(original.match(/\b[a-z][a-z0-9-]*\.png\b/g));
    expect(result).not.toMatch(/art-src\/(?:reference\/|incoming-\*\/|<범주>\/<family>\/runs\/)/);
    expect(result).not.toContain("형태 발상 `art-src/공통화풍참고/`");
    expect(localizeArtPromptPaths(result)).toBe(result);
    expect(makePrompt()).toBe(original);
  });
});
