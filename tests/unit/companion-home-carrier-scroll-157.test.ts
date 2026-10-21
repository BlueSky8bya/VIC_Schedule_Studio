import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("components/poster/viewer-companion/viewer-companion.css", "utf8");
type Rule = { selector: string; declarations: Record<string, string> };
const rules = (text: string): Rule[] => [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(match => match[1].split(",").map(selector => ({ selector: selector.trim(), declarations: Object.fromEntries(
    match[2].split(";").filter(value => value.includes(":")).map(value => {
      const colon = value.indexOf(":"); return [value.slice(0, colon).trim(), value.slice(colon + 1).trim()];
    })) })));

/** Model only the class/child grammar used by this rule. Unsupported CSS
 * fails closed; this unit does not claim browser layout or painted pixels. */
function matchesChildClasses(selector: string, ancestors: readonly (readonly string[])[]) {
  const chain = selector.split(">").map(value => value.trim());
  if (chain.some(value => !/^(?:\.[\w-]+)+$/.test(value)) || chain.length !== ancestors.length) return false;
  return chain.every((value, index) => [...value.matchAll(/\.([\w-]+)/g)].every(match => ancestors[index].includes(match[1])));
}
const scrollRules = (text: string) => rules(text).filter(rule => rule.declarations["max-height"]?.includes("--vc-home-max-height"));
const declarationsFor = (text: string, path: readonly (readonly string[])[]) => Object.assign({},
  ...scrollRules(text).filter(rule => matchesChildClasses(rule.selector, path)).map(rule => rule.declarations)) as Record<string, string>;
const legacy = [["vc-compact-home"], ["panel-section", "vc-home"]];
// Actual DOM ancestry in all three original failed420px trace snapshots.
const stable = [["vc-compact-home"], ["vc-home-carrier"], ["panel-section", "vc-home"]];
const contract = { "max-height": "var(--vc-home-max-height, calc(100dvh - 24px))", overflow: "auto", "overscroll-behavior": "contain", "box-sizing": "border-box", "box-shadow": "var(--elev-3)" };

describe("157 compact room preserves scrolling through its stable carrier", () => {
  it.each([["stable", stable], ["legacy", legacy]] as const)("applies the original real scroll contract to the%s room", (_name, ancestry) => {
    expect(declarationsFor(css, ancestry)).toEqual(contract);
  });
  it("detects the actual old regression even though display:contents removes the carrier box", () => {
    const oldCss = css.replace(/,\s*\.vc-compact-home\s*>\s*\.vc-home-carrier\s*>\s*\.vc-home\s*\{/,
      " {");
    expect(declarationsFor(oldCss, legacy)).toEqual(contract);
    expect(declarationsFor(oldCss, stable)).toEqual({});
    expect(declarationsFor(css, stable)).toEqual(contract);
  });
  it.each([
    { ancestry: [["vc-home-host"], ["vc-home-carrier"], ["vc-home"]] },
    { ancestry: [["vc-compact-home"], ["unrelated-wrapper"], ["vc-home"]] },
    { ancestry: [["vc-compact-home"], ["vc-home-carrier"], ["unrelated-wrapper"], ["vc-home"]] },
    { ancestry: [["vc-compact-home"], ["vc-home-carrier"], ["vc-home-room"]] },
  ])("does not give an unrelated/native rail or deeper descendant a compact scroll owner %#", ({ ancestry }) => {
    expect(declarationsFor(css, ancestry)).toEqual({});
  });
  it("rejects unsupported selectors instead of crediting a guessed match", () => {
    for (const selector of [".vc-compact-home .vc-home", ":is(.vc-compact-home) > .vc-home", ".vc-home, *", "*"])
      expect(matchesChildClasses(selector, legacy)).toBe(false);
  });
});
