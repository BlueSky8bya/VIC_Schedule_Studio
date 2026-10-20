import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { resolve } from "node:path";

async function pixels(state: "off" | "on") {
  return sharp(resolve("public/companion/home/155/lamp-" + state + ".webp"))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

describe("selected connected wood lamp artwork", () => {
  for (const state of ["off", "on"] as const) {
    it(state + " has an unbroken raster connection from the eyelet through both stretch seams to the handle", async () => {
      const { data, info } = await pixels(state);
      expect([info.width, info.height, info.channels]).toEqual([512, 668, 4]);
      for (let y = 116; y <= 642; y++) {
        const alpha = Array.from({ length: 13 }, (_, i) => data[(y * info.width + 437 + i) * 4 + 3]);
        expect(Math.max(...alpha), "broken cord at source row " + y).toBeGreaterThan(180);
      }
      expect(data[3], "corner remains transparent").toBeLessThan(5);
    });
  }

  it("keeps the same wooden handle registration in both lighting states", async () => {
    const centers = [];
    for (const state of ["off", "on"] as const) {
      const { data, info } = await pixels(state);
      let mass = 0, xSum = 0, ySum = 0;
      for (let y = 606; y < 661; y++) for (let x = 422; x < 467; x++) {
        const a = data[(y * info.width + x) * 4 + 3];
        if (a < 180) continue;
        mass += a; xSum += x * a; ySum += y * a;
      }
      expect(mass).toBeGreaterThan(10000);
      centers.push({ x: xSum / mass, y: ySum / mass });
    }
    expect(Math.abs(centers[0].x - centers[1].x)).toBeLessThan(2);
    expect(Math.abs(centers[0].y - centers[1].y)).toBeLessThan(2);
  });
});
