// Pixel measurement, not image repair. Preserve source PNG bytes; publish only
// a contour for the renderer to exclude the source sky during composition.
import fs from "node:fs";
import sharp from "sharp";
const source = "public/ambient/art/backdrop-meadow-spring-v1.png";
const target = "components/shared/ambient/art/meadow-spring-geometry.json";
const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== 1536 || info.height !== 1024) throw new Error("Unexpected source dimensions");
const skyline = [];
for (let x = 0; x < info.width; x++) {
  let top = 400;
  for (let y = 120; y < 410; y++) {
    const i = (y * info.width + x) * 3;
    if (data[i + 1] > data[i + 2] + 8 && data[i + 1] > data[i] + 3) { top = y; break; }
  }
  skyline.push(top);
}
if (skyline.some(y => y >= 400)) throw new Error("Incomplete canopy boundary; review the source before changing geometry");
const result = { width: info.width, height: info.height, horizon: 400, skyline };
if (process.argv.includes("--write")) fs.writeFileSync(target, JSON.stringify(result) + "\n");
else if (JSON.stringify(JSON.parse(fs.readFileSync(target, "utf8"))) !== JSON.stringify(result)) throw new Error("Source/geometry mismatch");
console.log("Spring source dimensions and canopy geometry verified.");
