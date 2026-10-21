import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sampleCompanionExpression, type CompanionExpressionId } from "@/lib/ui/viewer-companion/expressions";
import anchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";
const output = process.env.COMPANION166_OUTPUT ?? ".scratch-pw/eye166-observations";

test("166 all36 faces remain continuous across real-clock source cells in three poses", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin, errors: string[] = [], rejected: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await context.route("**/*", route => { const q = route.request(), u = new URL(q.url());
    if (u.origin !== origin || q.method() !== "GET" || u.pathname.startsWith("/api/")) { rejected.push(q.method() + " " + u.pathname); return route.abort(); } return route.continue(); });
  await page.setViewportSize({ width: 1200, height: 1200 }); await page.goto("/visual-fixture/companion-expressions");
  await expect(page.locator('canvas[data-result="ready"]')).toHaveCount(36); mkdirSync(output, { recursive: true });
  const depths = await page.locator("canvas[data-expression]").evaluateAll((nodes, reference) => nodes.map(node => {
    const c = node as HTMLCanvasElement, pixels = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    const eyes = reference.eyes.map(e => {
      const w = e.bounds[2] - e.bounds[0], h = e.bounds[3] - e.bounds[1], angle = reference.roll * Math.PI / 180;
      let low = Infinity, high = -Infinity;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const dx = x / c.width * 80 - e.center[0], dy = y / c.height * 80 - e.center[1];
        const xx = dx * Math.cos(angle) + dy * Math.sin(angle), yy = -dx * Math.sin(angle) + dy * Math.cos(angle);
        if (Math.abs(xx) > w * .61 || Math.abs(yy) > h * .61) continue;
        const k = (y * c.width + x) * 4;
        if (pixels[k + 3] > 200 && pixels[k] < 165 && pixels[k + 1] < 140 && pixels[k + 2] < 110) { low = Math.min(low, yy); high = Math.max(high, yy); }
      }
      return Number.isFinite(low) ? (high - low) / h : 0;
    }); return { id: c.dataset.expression!, eyes };
  }), anchors.frames.find(f => f.physicalIndex === anchors.reference)!);
  writeFileSync(resolve(output, "actual-open-pupil-depth.json"), JSON.stringify(depths, null, 2));
  for (const { id, eyes } of depths) {
    const f = sampleCompanionExpression(id as CompanionExpressionId, .55);
    for (let side = 0; side < 2; side++) if ((side ? f.rightClosure : f.leftClosure) === 0) expect(eyes[side], `${id} eye${side} actual painted depth`).toBeGreaterThan(.6);
  }
  for (const row of [0, 1, 9]) {
    await page.getByRole("combobox", { name: "원화 포즈", exact: true }).selectOption(String(row));
    if (row === 0) await page.getByRole("button", { name: "연속 프레임 재생", exact: true }).click();
    const out = page.locator("output[data-motion-proof=true]"); await expect(out).toHaveCount(1, { timeout: 20000 });
    const proof = JSON.parse(await out.textContent() ?? "{}") as { row: number; frames: { elapsed: number; progress: number; pose: number; drawn: number; closure: number[] }[] };
    expect(proof.row).toBe(row); expect(proof.frames.length).toBeGreaterThan(15);
    expect(new Set(proof.frames.map(f => f.pose)).size).toBeGreaterThan(5);
    expect(proof.frames.filter(f => f.progress > .04 && f.progress < .96).every(f => f.drawn === 36)).toBe(true);
    for (let channel = 0; channel < 3; channel++) expect(proof.frames.some(f => f.closure[channel] > .1 && f.closure[channel] < .9)).toBe(true);
    writeFileSync(resolve(output, `real-clock-row-${row}.json`), JSON.stringify(proof, null, 2));
    await page.locator("canvas[data-motion-canvas]").screenshot({ path: resolve(output, `real-clock-row-${row}.png`) });
  }
  expect(errors).toEqual([]); expect(rejected).toEqual([]);
});
