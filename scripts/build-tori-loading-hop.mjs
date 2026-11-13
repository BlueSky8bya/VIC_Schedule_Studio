// Build the loading strip from the owner-provided hand drawing.
// Each displacement tapers to zero at the shoulder or hem.
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const cell = 192;
const source = new URL("../public/tori/doodle.webp", import.meta.url);
const output = new URL("../public/tori/loading-hop-v3.webp", import.meta.url);
const { data, info } = await sharp(fileURLToPath(source))
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const size = info.width;
if (size !== 512 || info.height !== size || info.channels !== 4) throw Error("Unexpected Tori artwork dimensions");

// x/y are the original 512px drawing coordinates. A limb's most mobile
// section is inside the ellipse, with a soft falloff into the original ink.
const limbs = [
  { x: 158, y: 337, rx: 43, ry: 47 }, // back arm
  { x: 354, y: 331, rx: 66, ry: 58 }, // front arm
  { x: 235, y: 477, rx: 60, ry: 66 }, // standing foot
  { x: 349, y: 407, rx: 57, ry: 48 }, // lifted foot
];
const rest = [[0,0], [0,0], [0,0], [0,0]];
const poses = [
  rest,
  [[-3,7], [0,10], [4,-6], [-5,4]], // crouch
  [[-7,-7], [4,-14], [-4,-3], [7,3]], // takeoff
  [[-8,-11], [5,-20], [-16,-22], [-8,-9]], // tuck at the top
  [[-4,-4], [2,-8], [5,7], [3,7]], // reach for the floor
  [[-2,8], [1,11], [12,13], [2,-3]], // foot lands ahead of the body
  [[-7,-7], [4,-13], [-6,-6], [7,2]],
  [[-8,-10], [5,-19], [-14,-20], [-7,-8]],
  [[-2,7], [1,10], [10,12], [3,-3]],
  rest, rest, rest,
];

function weight(x, y, { x: cx, y: cy, rx, ry }) {
  const radius = Math.hypot((x - cx) / rx, (y - cy) / ry);
  const t = Math.max(0, Math.min(1, (1 - radius) / .63));
  return t * t * (3 - 2 * t);
}

function smoothRamp(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function displacement(x, y, pose) {
  let dx = 0;
  let dy = 0;
  for (const [index, limb] of limbs.entries()) {
    // Keep the hair and face samples identical to the rest frame.
    const faceClearance = index < 2 ? smoothRamp((y - 292) / 25) : 1;
    // Leave the shoulder and torso ink fixed. The displacement reaches its
    // full value across the visible hand, keeping its outline thickness.
    const shoulderClearance = index === 0 ? smoothRamp((184 - x) / 27)
      : index === 1 ? smoothRamp((x - 306) / 47) : 1;
    // The planted leg bends below the hem, leaving the skirt edge anchored.
    const hemClearance = index === 2 ? smoothRamp((y - 434) / 26)
      : index === 3 ? smoothRamp((x - 312) / 32) : 1;
    const influence = weight(x, y, limb) * faceClearance * shoulderClearance * hemClearance;
    const [shiftX, shiftY] = pose[index];
    if (index === 1) {
      // Swing the front arm about its shoulder, preserving the rounded cuff.
      const angle = shiftY / 52;
      const u = x - 306, v = y - 324;
      const sine = Math.sin(angle), cosine = Math.cos(angle);
      dx += influence * (shiftX + u * (cosine - 1) - v * sine);
      dy += influence * (u * sine + v * (cosine - 1));
    } else {
      dx += influence * shiftX;
      dy += influence * shiftY;
    }
  }
  return [dx, dy];
}

function sample(x, y, target, offset) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const points = [[x0,y0,(1-fx)*(1-fy)], [x0+1,y0,fx*(1-fy)], [x0,y0+1,(1-fx)*fy], [x0+1,y0+1,fx*fy]];
  let red = 0, green = 0, blue = 0, alpha = 0;
  for (const [px, py, blend] of points) {
    if (px < 0 || py < 0 || px >= size || py >= size) continue;
    const at = (py * size + px) * 4;
    const coverage = data[at + 3] * blend;
    red += data[at] * coverage;
    green += data[at + 1] * coverage;
    blue += data[at + 2] * coverage;
    alpha += coverage;
  }
  if (alpha < .5) return;
  target[offset] = Math.round(red / alpha);
  target[offset + 1] = Math.round(green / alpha);
  target[offset + 2] = Math.round(blue / alpha);
  target[offset + 3] = Math.round(alpha);
}

const width = cell * poses.length;
const strip = Buffer.alloc(width * cell * 4);
for (const [frame, pose] of poses.entries()) for (let row = 0; row < cell; row++) for (let column = 0; column < cell; column++) {
  const x = (column + .5) * size / cell - .5, y = (row + .5) * size / cell - .5;
  let sx = x, sy = y;
  for (let iteration = 0; iteration < 20; iteration++) {
    const [dx, dy] = displacement(sx, sy, pose);
    const errorX = x - dx - sx, errorY = y - dy - sy;
    if (Math.abs(errorX) + Math.abs(errorY) < .02) break;
    sx += errorX * .5;
    sy += errorY * .5;
  }
  sample(sx, sy, strip, (row * width + frame * cell + column) * 4);
}
await sharp(strip, { raw: { width, height: cell, channels: 4 } })
  .webp({ lossless: true, effort: 6 }).toFile(fileURLToPath(output));
