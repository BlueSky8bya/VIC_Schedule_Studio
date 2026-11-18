import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getCompanionAccessoryArtFrame } from "@/lib/ui/viewer-companion/accessory-art";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";

describe("shared code-native accessory art", () => {
  it("keeps all four royal crown silhouettes inside their registered cells with transparent margins", () => {
    const views = ["front", "quarter", "side", "back"] as const;
    const frames = views.map(view => getCompanionAccessoryArtFrame("tiny-crown", view)!);
    const bounds = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `
      import sharp from 'sharp';
      const {data,info}=await sharp('public/companion/collection/royal-crown-20261118-v2.svg').ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const result=[];
      for(let cell=0;cell<4;cell++) { let left=128,top=128,right=-1,bottom=-1;
        for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(data[(y*info.width+cell*128+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
        result.push({left,top,right,bottom});
      } console.log(JSON.stringify(result));
    `], { encoding: "utf8" })) as { left: number; top: number; right: number; bottom: number }[];
    for (const [i, box] of bounds.entries()) {
      const content = frames[i].content;
      expect(box.right).toBeGreaterThan(box.left);
      expect(box.left).toBeGreaterThanOrEqual(content.x); expect(box.top).toBeGreaterThanOrEqual(content.y);
      expect(box.right).toBeLessThan(content.x + content.width); expect(box.bottom).toBeLessThan(content.y + content.height);
    }
    const svg = readFileSync("public/companion/collection/royal-crown-20261118-v2.svg", "utf8");
    expect(svg).not.toMatch(/<(?:script|foreignObject|image)\b|(?:href=["']https?:|url\(https?:)/i);
  });
  it("provides every active item view to both the live painter and collection without another character atlas", () => {
    const atlas = new Set<string>();
    for (const id of COMPANION_WEARABLE_IDS) for (const view of ["front", "quarter", "side", "back"] as const) {
      const frame = getCompanionAccessoryArtFrame(id, view)!;
      expect(frame, `${id}:${view}`).toBeDefined(); expect(frame.id).toBe(`${id}:${view}`);
      expect(frame.content.width).toBeGreaterThan(0); expect(frame.content.height).toBeGreaterThan(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(frame.atlasWidth); expect(frame.y + frame.height).toBeLessThanOrEqual(frame.atlasHeight);
      expect(frame.content.x).toBeGreaterThanOrEqual(0); expect(frame.content.y + frame.content.height).toBeLessThanOrEqual(frame.height);
      if (frame.atlas.startsWith("accessory-11") || id === "tiny-crown") atlas.add(frame.src);
    }
    expect(atlas.size).toBe(3); expect(getCompanionAccessoryArtFrame("not-owned-code")).toBeUndefined();
    expect(getCompanionAccessoryArtFrame("scarf")?.id).toBe("bow:front");
    expect(getCompanionAccessoryArtFrame("bell-pendant")?.id).toBe("bell-badge:front");
  });
  it("preserves the original vector source with no network references, executable content or embedded body raster", () => {
    const svg = readFileSync("public/companion/collection/accessories-111-v1.svg", "utf8");
    expect(svg).not.toMatch(/<(?:script|foreignObject|image)\b|(?:href|url)\s*[:=(]/i);
    expect(Buffer.byteLength(svg)).toBeLessThan(32000);
    expect(execFileSync(process.execPath, ["scripts/prepare-companion-accessory-vector.mjs", "--check"], { encoding: "utf8" })).toContain("Verified 48 original vector cells");
    const modern = readFileSync("public/companion/collection/accessories-114-v1.svg", "utf8");
    expect(modern).not.toMatch(/<(?:script|foreignObject|image)\b|(?:href|url)\s*[:=(]/i);
    expect(Buffer.byteLength(modern)).toBeLessThan(50000);
    expect(execFileSync(process.execPath, ["scripts/prepare-companion-accessory-vector.mjs", "--check"], { encoding: "utf8" })).toContain("Verified 60 task114 vector cells");
  });
});
