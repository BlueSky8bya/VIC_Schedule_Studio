import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
const output = process.env.COMPANION163_OUTPUT ?? ".scratch-pw/archive163-face";
test.use({ viewport: { width: 1440, height: 1600 }, storageState: { cookies: [], origins: [] }, serviceWorkers: "block" });
test("163 actual36 peak faces have substantial pixel differences rather than hash-only variation", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin, rejected: string[] = [];
  await context.route("**/*", r => { const q = r.request(), u = new URL(q.url()); if (u.origin !== origin || q.method() !== "GET" || u.pathname.startsWith("/api/")) { rejected.push(q.method() + " " + u.pathname); return r.abort(); } return r.continue(); });
  await page.goto("/visual-fixture/companion-expressions"); await expect(page.locator('canvas[data-result="ready"]')).toHaveCount(36);
  const samples = await page.locator('canvas[data-expression]').evaluateAll(nodes => nodes.map(n => { const c = n as HTMLCanvasElement; return { id: c.dataset.expression!, image: c.toDataURL() }; }));
  const pictures = await Promise.all(samples.map(async s => ({ id: s.id, pixels: await sharp(Buffer.from(s.image.split(",")[1], "base64")).extract({ left: 120, top: 184, width: 100, height: 64 }).removeAlpha().raw().toBuffer() })));
  const spicy = pictures.find(p => p.id === "spicy")!.pixels; let tearPixels = 0;
  for (let i = 0; i < spicy.length; i += 3) if (spicy[i + 2] > spicy[i] + 20 && spicy[i + 2] > spicy[i + 1] + 5) tearPixels++;
  expect(tearPixels).toBeGreaterThanOrEqual(12); // Keep tears visible without repainting the protected orange cheeks.
  const pairs: { a: string; b: string; meanDifference: number; changedPixels: number }[] = [];
  for (let a = 0; a < pictures.length; a++) for (let b = a + 1; b < pictures.length; b++) {
    let sum = 0, changed = 0;
    for (let i = 0; i < pictures[a].pixels.length; i += 3) { let delta = 0; for (let k = 0; k < 3; k++) delta += Math.abs(pictures[a].pixels[i + k] - pictures[b].pixels[i + k]); sum += delta; if (delta > 45) changed++; }
    pairs.push({ a: pictures[a].id, b: pictures[b].id, meanDifference: sum / pictures[a].pixels.length, changedPixels: changed });
  }
  pairs.sort((a, b) => a.meanDifference - b.meanDifference); mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "all36-perceptual-pairs.json"), JSON.stringify({ pairs, rejected, limitation: "Pixel separation is a regression floor, not a substitute for inspecting expressions at normal size." }, null, 2));
  await page.screenshot({ path: resolve(output, "all36-new-expressions.png"), fullPage: true });
  expect(pairs).toHaveLength(630); expect(pairs[0].meanDifference).toBeGreaterThan(1.5); expect(pairs.every(p => p.changedPixels >= 70)).toBe(true); expect(rejected).toEqual([]);
});
test("163 every509 eligible original face position preserves body alpha and orange cheeks", async ({ page }) => {
  await page.goto("/visual-fixture/companion-expressions"); await expect(page.locator('canvas[data-result="ready"]')).toHaveCount(36);
  await page.getByRole("button", { name: "전체 얼굴 위치 검사", exact: true }).click();
  const out = page.locator("output[data-anchor-audit]"); await expect(out).toHaveCount(1, { timeout: 150000 });
  const proof = JSON.parse(await out.textContent() ?? "{}"); mkdirSync(output, { recursive: true }); writeFileSync(resolve(output, "all-anchor-proof.json"), JSON.stringify(proof, null, 2));
  expect(proof.eligibleFrames).toBe(509); expect(proof.results).toHaveLength(1018);
  for (const p of proof.results) { expect(p.alpha).toBe(0); expect(p.cheek).toBe(0); expect(p.outside).toBe(0); expect(p.painted).toBe(true); expect(p.changed).toBeGreaterThan(0); if (p.id === "greeting") expect(p.contrastPixels).toBeGreaterThanOrEqual(20); }
});
