// One captured imagegen repair restores paper hidden behind the old bulbs.
// Everything else comes from the unchanged runtime atlas, including each bulb.
import fs from "node:fs/promises";
import crypto from "node:crypto";
import sharp from "sharp";

const run = "art-src/최초공개/응원단/작업회차/20261026-응원봉방향교정";
const source = "public/premiere/victamin-audience-body-outline-v1.webp";
const native = `${run}/원본/가려진종이층복원.png`;
const output = "public/premiere/victamin-audience-lightsticks-up-v1.png";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const bytes = await fs.readFile(source), repair = await fs.readFile(native);
if (hash(bytes) !== "67b49ec357f692ac72300664acd5d946a83e1bd239339e7b31bfc1acb81a8c2f") throw Error("Protected audience source changed");
if (hash(repair) !== "4cb00a23e6d1b4f9a65dc641d3d8aff68b44fc0afc6fcb499b67cec706f08320") throw Error("Frozen imagegen native changed");
const registrationBytes = await fs.readFile(`${run}/고정입력/부착좌표.json`);
if (hash(registrationBytes) !== "06a994237dd59db3d74a0e6fb1f8f449d30ef8c998bdd2b2ac73581b39a23f82") throw Error("Frozen attachment registration changed");
const registration = JSON.parse(registrationBytes);
const original = await sharp(bytes).ensureAlpha().raw().toBuffer();
const restored = await sharp(repair).resize(1024, 1024).ensureAlpha().raw().toBuffer();
const final = Buffer.from(original), allowed = new Uint8Array(1024 * 1024);
const inside = (x, y, polygon) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
};
const frames = [];
for (const { frame, pivot, hull } of registration) {
  const left = frame % 4 * 256, top = Math.floor(frame / 4) * 256;
  const index = (x, y) => (top + y) * 1024 + left + x;
  let recovered = 0, moved = 0;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    if (!inside(x + .5, y + .5, hull)) continue;
    const at = index(x, y); allowed[at] = 1;
    restored.copy(final, at * 4, at * 4, at * 4 + 4);
    if (restored[at * 4 + 3] > 240) recovered++;
  }
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    if (!inside(x + .5, y + .5, hull)) continue;
    const dx = Math.round(2 * pivot[0] - x - 1), dy = Math.round(2 * pivot[1] - y - 1);
    if (dx < 0 || dx >= 256 || dy < 0 || dy >= 256) throw Error(`Bulb leaves cell ${frame}`);
    const from = index(x, y) * 4, to = index(dx, dy), a = original[from + 3] / 255;
    if (!a) continue;
    allowed[to] = 1;
    const oldAlpha = final[to * 4 + 3] / 255, alpha = a + oldAlpha * (1 - a);
    for (let c = 0; c < 3; c++) final[to * 4 + c] = Math.round((original[from + c] * a + final[to * 4 + c] * oldAlpha * (1 - a)) / alpha);
    final[to * 4 + 3] = Math.round(alpha * 255); moved++;
  }
  frames.push({ frame, restoredPaperPixels: recovered, movedBulbPixels: moved });
}
let changed = 0, protectedChanges = 0;
for (let i = 0; i < allowed.length; i++) {
  if (!original.subarray(i * 4, i * 4 + 4).equals(final.subarray(i * 4, i * 4 + 4))) {
    changed++; if (!allowed[i]) protectedChanges++;
  }
}
if (protectedChanges) throw Error("Protected original pixels changed");
const packed = await sharp(final, { raw: { width: 1024, height: 1024, channels: 4 } }).png().toBuffer();
const previous = await fs.readFile(output).catch(error => { if (error.code !== "ENOENT") throw error; });
if (previous && !previous.equals(packed)) throw Error("Refusing to overwrite a different output");
await fs.writeFile(output, packed);
await fs.writeFile(`${run}/파생기록.json`, JSON.stringify({
  source: { path: source, sha256: hash(bytes) }, native: { path: native, sha256: hash(repair) },
  output: { path: output, sha256: hash(packed), bytes: packed.length },
  method: "Single imagegen paper restoration inside old bulb footprints; original bulbs half-turned around measured attachments; all other decoded RGBA preserved exactly. PNG keeps exact pixels.",
  imagegenCalls: 1, frames, changedPixels: changed, protectedChanges,
  approval: "User-requested direction repair; producer observation and technical checks only. No independent art PASS or new owner visual approval inferred. Original source and historical exclusions unchanged.",
}, null, 2) + "\n");
console.log(JSON.stringify({ output, bytes: packed.length, changed, protectedChanges, frames }));
