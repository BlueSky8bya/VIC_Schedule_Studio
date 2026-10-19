import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { COMPANION_PERSONALITY_LAYOUT } from "@/lib/ui/viewer-companion/personality-layout";
import { COMPANION_PERSONALITIES, COMPANION_PERSONALITY_NAMES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TV_SCREEN_CLIP, COMPANION_TV_SCREEN_TRANSFORM } from "@/lib/ui/viewer-companion/home-tv-art";

describe("142 shared north-up personality arrangement and source-bound CRT registration", () => {
  it("keeps every existing engine ID and its engine order while centring 동글이 in the approved UI arrangement", () => {
    expect(COMPANION_PERSONALITY_LAYOUT).toEqual(["curious", "sleepy", "homebody", "gourmet", "balanced", "mischievous", "affectionate", "performer", "tidy"]);
    expect(COMPANION_PERSONALITY_LAYOUT[4]).toBe("balanced"); expect(COMPANION_PERSONALITY_NAMES.balanced).toBe("동글이");
    expect(new Set(COMPANION_PERSONALITY_LAYOUT)).toEqual(new Set(COMPANION_PERSONALITIES));
    expect(COMPANION_PERSONALITIES).toEqual(["performer", "curious", "affectionate", "sleepy", "tidy", "mischievous", "gourmet", "homebody", "balanced"]);
  });

  it("fills the actual dark CRT interior without modifying or painting the original bezel", async () => {
    const bytes = readFileSync("public/companion/home/136/tv-body.webp");
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe("6F8E4B0E4100546CEF2D46A6685234E4D5073A1E57BEF38F9359907965D1694C");
    const body = await sharp(bytes).ensureAlpha().raw().toBuffer();
    const mask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><path d="${COMPANION_TV_SCREEN_CLIP}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();
    const matrix = COMPANION_TV_SCREEN_TRANSFORM.slice(9, -1).split(",").map(Number);
    const [a, b, , g, c, d, , h, , , , , e, f] = matrix;
    let inside = 0, outsideGlass = 0, unfilled = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const index = (y * 512 + x) * 4; if (mask[index + 3] < 128) continue;
      inside++; const colors = [body[index], body[index + 1], body[index + 2]];
      if (body[index + 3] < 240 || Math.max(...colors) >= 145 || Math.max(...colors) - Math.min(...colors) >= 35) outsideGlass++;
      // Invert the actual projected plane at this source pixel. A clip alone
      // could hide bezel bleed while retaining the old unfilled lower glass.
      const u = x + .5, v = y + .5, aa = a - u * g, bb = c - u * h, cc = b - v * g, dd = d - v * h;
      const det = aa * dd - bb * cc, sourceX = ((u - e) * dd - bb * (v - f)) / det, sourceY = (aa * (v - f) - (u - e) * cc) / det;
      if (!Number.isFinite(sourceX + sourceY) || sourceX < 0 || sourceX > 100 || sourceY < 0 || sourceY > 100) unfilled++;
    }
    expect(inside).toBeGreaterThan(30_000); expect(outsideGlass).toBe(0); expect(unfilled).toBe(0);
  });
});
