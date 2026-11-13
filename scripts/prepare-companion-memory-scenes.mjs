import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { outputFiles } = buildSync({ stdin: { contents: `
  export { COMPANION_TV_SCREEN_CLIP as screenPath } from "./lib/ui/viewer-companion/home-tv-art";
  export { COMPANION_ILLUSTRATED_MEMORY_STAMPS as designs } from "./lib/ui/viewer-companion/memory-stamp-design";
  export { companionSpriteMetadata as sprites, companionMotionClips as clips } from "./lib/ui/viewer-companion/sprite-quality";

`, resolveDir: root, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false });
const bundled = { exports: {} };
new Function("module", "exports", "require", outputFiles[0].text)(bundled, bundled.exports, createRequire(import.meta.url));
const { designs, sprites, clips, screenPath } = bundled.exports;
const cell = 192, columns = 8, scale = cell / 128;
const at = x => Math.round(x * scale);
const asset = src => path.join(root, "public", src.slice(1));
const props = {
  "star-wand": "125/toy-star-wand", duck: "125/toy-duck", feather: "125/toy-feather", car: "125/toy-toy-car",
  ball: "125/toy-ball", "wash-pad": "135/wash-pad-135", radio: "125/furniture-radio", "toy-box": "125/furniture-toy-box",
  pompom: "146/toy-cheer-pompom",
};
const line = (d, color = "#a4643c", width = 7) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shape = (d, fill, stroke = "#a46746", width = 3) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"/>`;
const dot = (x,y,r,fill,stroke = "none") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
const soft = "#b98d67", violet = "#9f84b2", yellow = "#eab95b", blue = "#8bb8ca";
const sparkle = (x,y,r) => shape(`M${x} ${y-r}q2 ${r-2} ${r} ${r}q-${r-2} 2 -${r} ${r}q-2 -${r-2} -${r} -${r}q${r-2} -2 ${r} -${r}Z`, "#ffdf88", "#cc9655", 2);
const vectors = {
  window: shape("M11 88V40a39 33 0 0 1 78 0v48Z", "#c4e3ed") +
    shape("M11 79q19-25 40-12 22-17 38-6v27H11Z", "#a9bf8e", "none") + dot(67,35,9,"#f4cc76") +
    line("M50 13v74M13 50h75M6 90h88", "#ac7954", 5),
  card: shape("M12 24h76v62H12Z", "#fff1da", "#b58c6c", 3) +
    shape("M12 24h76v17H12Z", "#e4ad91", "#b58c6c", 3) +
    line("M32 18v13m36-13v13M22 55h16m9 0h13m9 0h8M22 70h16m9 0h13m9 0h8", "#cc9a7a", 3),
  meal: shape("M7 58h86L80 78q-30 13-60 0Z", "#ddad7b") +
    '<ellipse cx="50" cy="57" rx="44" ry="13" fill="#ffefd1" stroke="#af754d" stroke-width="4"/>' +
    shape("M24 55q5-8 16-19t17 0l18 20q-21 14-51-1Z", "#fff5db") +
    shape("M46 54q6-3 15 0v10q-7 2-15 0Z", "#779171", "#657c61", 2),
  picnic: shape("M1 11h79l18 14H13Z", "#eed4c4", "#c39588", 1.4) +
    line("M18 11l15 14m8-14 13 14m10-14 13 14M7 18h83", "#cf9f90", 1.4),
  calendar: shape("M2 11h96v18H2Z", "#fff3d8", "#c39968", 1.5) +
    shape("M2 11h96v5H2Z", "#e8ba95", "#c39968", 1) + line("M2 22h96M34 16v13m32-13v13", "#d2ad8c", 1.2),
  trail: shape("M8 69q34 0 52-33l-10-4 35-12-6 34-8-9Q48 80 8 69Z", "#b4bd86", "#8b9b6a", 3),
  sun: dot(50,50,20,"#f7d285","#c79150") + line("M50 12v9m0 58v9M12 50h9m58 0h9M23 23l7 7m40 40 7 7M23 77l7-7m40-40 7-7",yellow,6),
  moon: shape("M62 13C39 42 57 69 83 70A36 36 0 1 1 62 13Z", "#edcd84") + sparkle(74,28,11),
  sleep: line("M12 50h29L13 77h30M53 23h32L54 53h33", violet, 6),
  sofa: shape("M15 47V33q1-13 17-13h36q16 0 17 13v14h7v22H8V47Z", "#b4bc98", "#8a926f", 2) +
    shape("M7 44q5-6 12 0l7 10h48l7-10q7-6 12 0v26H7Z", "#c6cbad", "#8a926f", 2) +
    line("M15 70v6m70-6v6", "#a27153", 2.6),
  cursor: shape("M21 13v61l15-13 12 24 13-7-12-23 22-3Z", "#fff9eb", "#a68baf", 5),
  heart: shape("M50 78C17 57 9 47 16 31c6-12 22-15 34 0 12-15 28-12 34 0 7 16-1 26-34 47Z", "#ee9b90", "#ae675f", 4),
  bubbles: dot(31,62,16,"#dfedf1",blue) + dot(65,37,20,"#d9edf3",blue) + dot(78,75,8,"#d9edf3",blue) +
    line("M53 36q2-8 10-11m-39 35q2-5 6-6", "#fffdf2", 5),
  cheer: line("M22 56l-10-8m26-14-5-14m23 13 5-17m11 28 14-11m-10 30 13 3", "#d1995a", 7),
  tune: line("M35 61V26l39-9v35M35 38l39-9", "#b087b0", 6) + dot(24,66,12,"#bb91bd") + dot(63,57,12,"#bb91bd"),
  speed: line("M9 32h57M21 49h65M13 68h42", "#d5a258", 5),
  hop: line("M8 65Q35 23 72 30l-8-7m8 7-9 6", "#d4a15f", 3) + line("M14 77h28", "#c2a48d", 2),
  shake: line("M16 35q-8 14 0 30m17-38q-10 22 0 46M65 27q10 22 0 46m18-38q8 14 0 30", "#d4a15f", 5),
  turn: line("M16 68c-13-28 15-48 53-42m-11-12 14 13-17 12", violet, 6),
  dawn: line("M14 66h72M31 59a19 19 0 0 1 38 0M50 27v-9m-23 19-7-7m53 7 7-7", yellow, 6),
  look: line("M28 46l-13-11m38 1V18m21 30 15-10", "#c8a267", 5),
  breath: line("M9 46q21 10 34-5t25 2M30 67q14 6 28-4t27 2", "#93b6ba", 6),
  settle: line("M37 18v38l-10-10m10 10 10-10m20-28v38L57 46m10 10 10-10", soft, 5),
  sparkle: sparkle(42,45,23) + sparkle(76,22,10),
};

const tvPicture = (await sharp(asset("/companion/home/143/tv-screen-tori.webp")).resize(240, 240).png().toBuffer()).toString("base64");
const tvOverlay = Buffer.from(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <clipPath id="screen"><path d="${screenPath}"/></clipPath>
  <image x="57" y="157" width="210" height="214" clip-path="url(#screen)" xlink:href="data:image/png;base64,${tvPicture}"/>
</svg>`);
const tv = await sharp(asset("/companion/home/136/tv-body.webp")).composite([{ input: tvOverlay }]).png().toBuffer();
async function raster(cue, size) {
  if (cue === "tv") return sharp(tv).trim({ background: "#00000000", threshold: 8 })
    .resize(size, size, { fit: "contain", background: "#00000000" }).png().toBuffer();
  if (Object.hasOwn(props, cue)) {
    return sharp(asset(`/companion/home/${props[cue]}.webp`)).trim({ background: "#00000000", threshold: 8 })
      .resize(size, size, { fit: "contain", background: "#00000000" }).png().toBuffer();
  }
  if (!Object.hasOwn(vectors, cue)) throw new Error("Unknown memory cue " + cue);
  return sharp(Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${vectors[cue]}</svg>`)).png().toBuffer();
}

const layers = [];
for (const [index, [id, design]] of Object.entries(Object.entries(designs))) {
  const { frame: [row, col], body, behind, front } = design;
  if (!clips[row]?.includes(col)) throw new Error("Memory frame is not used in playback: " + id);
  const frame = sprites.frames[sprites.rows[row][col]];
  const packet = sprites.atlases[frame.atlas];
  const bodyImage = await sharp(asset(packet.src)).extract({
    left: (frame.index % sprites.grid) * sprites.cell, top: Math.floor(frame.index / sprites.grid) * sprites.cell,
    width: sprites.cell, height: sprites.cell,
  }).resize(at(body[2]), at(body[2])).png().toBuffer();
  const place = async ([cue,x,y,size]) => ({ input: await raster(cue,at(size)), left: at(x), top: at(y) });
  const artwork = [...await Promise.all(behind.map(place)), { input: bodyImage, left: at(body[0]), top: at(body[1]) }, ...await Promise.all(front.map(place))];
  // Clip transparent registration margins at the tile edge, never neighbors.
  for (const layer of artwork) {
    const { width, height } = await sharp(layer.input).metadata();
    const x = Math.max(0, -layer.left), y = Math.max(0, -layer.top);
    const w = Math.min(width, cell - layer.left) - x, h = Math.min(height, cell - layer.top) - y;
    if (w <= 0 || h <= 0) throw new Error("Memory layer out of bounds: " + id);
    if (x || y || w < width || h < height) layer.input = await sharp(layer.input).extract({left:x, top:y, width:w, height:h}).png().toBuffer();
    layer.left = Math.max(0, layer.left); layer.top = Math.max(0, layer.top);
  }
  const tile = await sharp({ create: { width: cell, height: cell, channels: 4, background: "#00000000" } }).composite(artwork).png().toBuffer();
  layers.push({ input: tile, left: Number(index) % columns * cell, top: Math.floor(Number(index) / columns) * cell });
}
const result = await sharp({ create: { width: columns * cell, height: Math.ceil(layers.length / columns) * cell, channels: 4, background: "#00000000" } })
  .composite(layers).webp({ quality: 93, alphaQuality: 100, effort: 5 }).toBuffer();
const destination = asset("/companion/collection/memory-scenes-v1.webp");
const metadata = Buffer.from(JSON.stringify({ cell, columns, ids: Object.keys(designs) }, null, 2) + "\n");
const check = process.argv.includes("--check");
for (const [file, data] of [[destination, result], [path.join(root, "lib/ui/viewer-companion/memory-scenes-atlas.json"), metadata]]) {
  if (check) {
    if (!data.equals(fs.readFileSync(file))) throw new Error("Stale memory scenes output: " + file);
  } else fs.writeFileSync(file, data);
}
console.log(`Memory scenes: ${layers.length} illustrated stamps, ${result.length} bytes.`);
