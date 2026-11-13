// Registration stays in the original atlas coordinates. Each band's SVG
// viewport widens only the lower silhouette, retaining the cap's pixels,
// material, crown height and patch. The four authored views stay distinct.
import fs from "node:fs/promises";
import sharp from "sharp";

const source = "public/companion/collection/accessories-107-v1.webp";
const output = "public/companion/collection/baseball-cap-brim-v1.svg";
const views = [
  { start: 82, end: 97, amount: .16, pivot: 59 },
  { start: 73, end: 92, amount: .13, pivot: 45 },
  { start: 75, end: 92, amount: .10, pivot: 44 },
  { start: 70, end: 84, amount: .07, pivot: 66 },
];
const n = 128;
const tiles = [];
for (const [i, { start, end, amount, pivot }] of views.entries()) {
  const png = await sharp(source).extract({ left: n, top: n * i, width: n, height: n }).png().toBuffer();
  const clip = (id, y, height) => `<clipPath id="${id}"><path d="M0 ${y}h128v${height}H0Z"/></clipPath>`;
  const cell = `<image id="cap${i}" width="128" height="128" href="data:image/png;base64,${png.toString("base64")}"/>`;
  const rows = [{ y: 0, height: start, s: 1 }];
  for (let y = start; y < end; y++) {
    const t = (y + .5 - start) / (end - start);
    rows.push({ y, height: 1, s: 1 + amount * t * t * (3 - 2 * t) });
  }
  rows.push({ y: end, height: n - end, s: 1 + amount });
  const bands = rows.map(({ s }, j) => `<g clip-path="url(#c${i}-${j})"><use href="#cap${i}" transform="translate(${(pivot * (1-s)).toFixed(5)}) scale(${s.toFixed(5)} 1)"/></g>`).join("");
  tiles.push(`<g transform="translate(${n * i})"><defs>${cell}${rows.map(({ y, height }, j) => clip(`c${i}-${j}`, y, height)).join("")}</defs>${bands}</g>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128" viewBox="0 0 512 128">${tiles.join("")}</svg>\n`;
if (process.argv.includes("--check")) {
  if (await fs.readFile(output, "utf8") !== svg) throw Error("Baseball cap brim art is stale");
} else await fs.writeFile(output, svg);
console.log("Verified four fitted baseball cap views");
