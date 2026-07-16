import { chromium } from "playwright";
const dir = process.argv[2];
const b = await chromium.launch();
for (const [label, vp] of [
  ["390", { width: 390, height: 844 }],
  ["900", { width: 900, height: 1000 }]
]) {
  const p = await b.newPage({ viewport: vp, hasTouch: true, isMobile: true });
  await p.goto("http://127.0.0.1:3111/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  const rail = await p.locator(".agenda-legend-rail").boundingBox();
  const btn = await p.locator(".agenda-legend-insights").boundingBox();
  console.log(`[${label}] 레일 ${Math.round(rail.width)}px · 버튼 ${Math.round(btn.width)}x${Math.round(btn.height)} · 레일 안에 들어감: ${btn.x >= rail.x - 1 && btn.x + btn.width <= rail.x + rail.width + 1}`);
  await p.screenshot({
    path: `${dir}/rail-${label}.png`,
    clip: { x: rail.x - 6, y: rail.y - 6, width: rail.width + 12, height: Math.min(rail.height + 12, vp.height - rail.y) }
  });
  await p.close();
}
await b.close();
