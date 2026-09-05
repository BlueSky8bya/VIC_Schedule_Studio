// 라운드 2 조명 프로브 — 지면 L*(y560~820) · 하늘띠 L*(y0~60) · 띠별 해시 · 날씨별 해시 · 입자 카운터. 라운드 1 C의 측정법 그대로.
import { launch, newPage, openFixture, fixtureUrl, captureCanvas } from "./lib.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const OUT = process.argv[2] || ".scratch-pw/qa/light-probe";
mkdirSync(OUT, { recursive: true });
const BANDS = ["dawn", "morning", "noon", "dusk", "evening", "night"];
const SCEN = [
  { id: "s16", biome: "meadow", season: "summer", weather: "clear", seed: 42 },
  { id: "s10", biome: "mountain", season: "autumn", weather: "fog", seed: 42 },
  { id: "s09w", biome: "mountain", season: "winter", band: "morning", seed: 42, weathers: ["clear", "cloud", "snow", "fog", "wind", "rain"] },
  { id: "s02w", biome: "forest", season: "autumn", band: "dusk", seed: 42, weathers: ["clear", "cloud", "rain", "fog", "wind"] },
  { id: "s12w", biome: "pond", season: "spring", band: "dawn", seed: 42, weathers: ["clear", "fog", "rain", "cloud"] },
];
const b = await launch();
const lstar = (rgb) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; const Y = 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); return Y <= 0.008856 ? 903.3 * Y : 116 * Math.cbrt(Y) - 16; };
const sample = async (page) => page.evaluate(() => {
  const c = document.querySelector("canvas.gs-season"); const g = c.getContext("2d");
  const avg = (y0, y1) => { const d = g.getImageData(0, y0, c.width, y1 - y0).data; let r = 0, gg = 0, bb = 0, n = 0; for (let i = 0; i < d.length; i += 16) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++; } return [r / n, gg / n, bb / n]; };
  return { ground: avg(560, 820), sky: avg(0, 60) };
});
const sat = ([r, g, bb]) => { const mx = Math.max(r, g, bb), mn = Math.min(r, g, bb); return mx === 0 ? 0 : (mx - mn) / mx; };
const lines = [];
for (const sc of SCEN) {
  if (sc.weathers) {
    const hashes = {};
    for (const wx of sc.weathers) {
      const { ctx, page } = await newPage(b);
      try {
        await openFixture(page, fixtureUrl({ ...sc, weather: wx }, { t: 1500 }));
        const { png, hash } = await captureCanvas(page);
        writeFileSync(`${OUT}/${sc.id}-${wx}.png`, png);
        const s = await sample(page);
        const pc = await page.evaluate(() => window.__vicAmbient.particles());
        hashes[wx] = hash;
        lines.push(`${sc.id} ${sc.band} ${wx}: hash ${hash} ground L ${lstar(s.ground).toFixed(1)} sky L ${lstar(s.sky).toFixed(1)} sky rgb ${s.sky.map(Math.round).join(",")} particles ${JSON.stringify(pc)}`);
      } catch (e) { lines.push(`${sc.id} ${wx}: ERR ${e.message.slice(0, 120)}`); }
      await ctx.close();
    }
    const same = Object.entries(hashes).filter(([k, v]) => k !== "clear" && v === hashes.clear).map(([k]) => k);
    lines.push(`${sc.id} 맑음과 동일 해시: ${same.length ? same.join(",") : "없음"}`);
  } else {
    let noon = null; const rows = [];
    for (const band of BANDS) {
      const { ctx, page } = await newPage(b);
      try {
        await openFixture(page, fixtureUrl({ ...sc, band }, { t: 1500 }));
        const { png, hash } = await captureCanvas(page);
        writeFileSync(`${OUT}/${sc.id}-${band}.png`, png);
        const s = await sample(page);
        rows.push({ band, hash, gL: lstar(s.ground), sL: lstar(s.sky), sky: s.sky.map(Math.round), gS: sat(s.ground) });
      } catch (e) { rows.push({ band, err: e.message.slice(0, 100) }); }
      await ctx.close();
    }
    noon = rows.find((r) => r.band === "noon");
    for (const r of rows) {
      if (r.err) { lines.push(`${sc.id} ${r.band}: ERR ${r.err}`); continue; }
      lines.push(`${sc.id} ${r.band}: hash ${r.hash} ground L ${r.gL.toFixed(1)} (Δ ${(r.gL - noon.gL).toFixed(1)}) sky L ${r.sL.toFixed(1)} rgb ${r.sky.join(",")} groundS ${(r.gS / (noon.gS || 1)).toFixed(2)}`);
    }
    const m = rows.find((r) => r.band === "morning");
    lines.push(`${sc.id} 아침=점심 해시 동일: ${m && noon && m.hash === noon.hash}`);
  }
}
await b.close();
const out = lines.join("\n");
console.log(out);
writeFileSync(`${OUT}/light-probe.txt`, out + "\n");
