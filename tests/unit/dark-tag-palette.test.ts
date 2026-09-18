import { describe, expect, it } from "vitest";
import { deriveDarkTagColors, readDarkTagColors, tagColor } from "@/lib/tags/dark-palette";
import { hexToOklch } from "@/lib/tags/color-tone";

function luminance(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
describe("automatic dark tag palette", () => {
  it("preserves the independent light border when dark border derives from the fill", () => {
    expect(tagColor("#ff0000", "borderColor", undefined, "#771122")).toBe(`light-dark(#771122, ${deriveDarkTagColors("#ff0000").borderColor})`);
  });
  it("keeps arbitrary colors muted, readable and in the source hue family", () => {
    for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
      const source = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
      const p = deriveDarkTagColors(source), a = hexToOklch(source), d = hexToOklch(p.bgColor);
      expect((luminance(p.textColor) + .05) / (luminance(p.bgColor) + .05), source).toBeGreaterThan(6);
      expect(d.L).toBeGreaterThan(.33);
      expect(d.L).toBeLessThan(.45);
      expect(d.C).toBeLessThan(.07);
      if (a.C > .04) expect(Math.abs(((a.h - d.h + 540) % 360) - 180), source).toBeLessThan(5);
      expect(luminance(p.accentColor)).toBeGreaterThan(luminance(p.bgColor));
    }
  });
  it("replaces stale saved metadata immediately after custom source edits", () => {
    expect(readDarkTagColors(deriveDarkTagColors("#ff0000"), "#00ff00")).toEqual(deriveDarkTagColors("#00ff00"));
  });
  it("normalizes invalid and uppercase input", () => {
    expect(deriveDarkTagColors("bad")).toEqual(deriveDarkTagColors("#b8b3aa"));
    expect(deriveDarkTagColors("#ABCDEF")).toEqual(deriveDarkTagColors("#abcdef"));
  });
  it("rejects invalid saved channels and strips unknown public JSON fields", () => {
    const p = deriveDarkTagColors("#abc123");
    expect(readDarkTagColors({ ...p, owner_private: "never expose", secret: "never expose" }, p.source)).toEqual(p);
    expect(readDarkTagColors({ ...p, bgColor: "url(secret)" }, p.source)).toEqual(p);
  });
});
