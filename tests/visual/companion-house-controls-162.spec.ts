import { expect, test, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import sharp from "sharp";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { guardCompanionQa, type DailyProof } from "./helpers/companion-qa";
import { installCompanionPaintedSource157, type PaintedSource157Proof, type PaintedSource157Window } from "./helpers/companion-painted-source-157";

const output = process.env.COMPANION162_OUTPUT ?? ".scratch-pw/house162-observations";
type Surface = "viewer" | "studio" | "preview";
type Proof = DailyProof & { notes: unknown[] };
const proofs = new Map<Page, Proof>();
const save = (name: string, value: unknown) => { mkdirSync(output, { recursive: true }); writeFileSync(resolve(output, name + ".json"), JSON.stringify(value, null, 2)); };
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block", viewport: { width: 1440, height: 1000 } });
test.setTimeout(90000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof = await guardCompanionQa(page, context, baseURL!); proofs.set(page, { ...proof, notes: [] });
});
test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!; await Promise.allSettled(proof.pending);
  const frozen = process.env.COMPANION156_SOURCE_FREEZE;
  const binding = frozen ? JSON.parse(readFileSync(frozen, "utf8")) as {contentDigest:string} : null;
  const result = { ...proof, pending:undefined, buildId:proof.build, caseTitle:info.title, status:info.status,
    sourceDigest:binding?.contentDigest, scope:"Actual source-bound manual wash on the shared production-build fixture; no API forwarding, DB/login, clock/RNG/geometry/action replacement." };
  save(info.title.replace(/[^a-z0-9]+/gi, "-"), result);
  const raw=info.outputPath("actual-manual-wash-162.json");writeFileSync(raw,JSON.stringify(result,null,2));
  await info.attach("actual-manual-wash-162",{path:raw,contentType:"application/json"});
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.liveReads).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0); expect(proof.chunks.every(chunk=>chunk.served===chunk.local)).toBe(true); proofs.delete(page);
});
async function seed(page: Page, dark = false) {
  await page.addInitScript(({ prefs, memory, epoch, key, dark, foods, behaviors }) => {
    for (const [k, v] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(k, v);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, personality: "balanced", personalitySource: "manual", roam: false, feeding: true, sleep: false, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .95, hunger: .05 }));
    localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit: false }));
    localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys: ["practice-baseball-bat", "practice-baseball-glove"], seen: [], toyTastes: {}, foodTastes: {} }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods, behaviors, situations: [], seen: { foods: [], behaviors: [], situations: [], accessories: [] }, gifts: { unlocked: [], equipped: null, pending: null } }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, dark, foods: COMPANION_FOOD_KINDS, behaviors: COMPANION_BEHAVIOR_IDS });
}
async function open(page: Page, surface: Surface, hour = 12) {
  const response = await page.goto(surface === "viewer" ? `/visual-fixture/poster?avatar=1&hour=${hour}` : `/visual-fixture/studio?role=owner&y=2025&m=10&hour=${hour}&weather=clear`);
  proofs.get(page)!.notes.push({ stage: "actual-html", sha256: createHash("sha256").update(await response!.body()).digest("hex"), hour, surface });
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  const house = await openCompanionHome(page), fold = house.locator('[data-home-action="fold"]');
  if (await fold.count() && await fold.getAttribute("aria-expanded") === "false") await fold.click();
  await placeCompanionOnHomeFloor(page); await page.mouse.move(2, 2); return house;
}
async function luma(bytes: Buffer) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const values = [[.7, .9], [.45, .54], [.82, .18]].map(([px, py]) => {
    let sum = 0, count = 0;
    for (let y = Math.floor(info.height * py) - 2; y <= Math.floor(info.height * py) + 2; y++) for (let x = Math.floor(info.width * px) - 2; x <= Math.floor(info.width * px) + 2; x++) { const i = (y * info.width + x) * 4; sum += data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722; count++; }
    return sum / count;
  }); return values;
}
for (const surface of ["viewer", "studio", "preview"] as const) for (const dark of [false, true]) test(`162 ${surface} ${dark ? "dark" : "light"} lighting matrix`, async ({ page }) => {
  await seed(page, dark); const samples: { hour: number; curtain: string; lamp: boolean; grade: number; luma: number[] }[] = [];
  for (const hour of [12, 0]) {
    const house = await open(page, surface, hour), room = house.locator(".vc-home-room"), window = house.locator(".vc-home-window");
    await expect(room).toHaveAttribute("data-band", hour === 0 ? "night" : "noon");
    for (const curtain of ["open", "shade", "closed"]) {
      for (let n = 0; n < 3 && await window.getAttribute("data-curtain") !== curtain; n++) await house.locator('[data-home-action="curtain"]').press("Enter");
      await expect(window).toHaveAttribute("data-curtain", curtain); await page.waitForTimeout(850);
      for (const lamp of [false, true]) {
        if (await room.getAttribute("data-lamp-lit") !== (lamp ? "true" : null)) await house.locator('[data-home-action="light"]').press("Enter");
        if (lamp) await expect(room).toHaveAttribute("data-lamp-lit", "true"); else await expect(room).not.toHaveAttribute("data-lamp-lit");
        await page.mouse.move(2, 2); await page.waitForTimeout(350);
        const data = await room.evaluate(node => ({ grade: Number.parseFloat(getComputedStyle(node).getPropertyValue("--vc-room-art-grade")), body: Number.parseFloat(document.querySelector<HTMLElement>(".vc-companion")?.style.getPropertyValue("--vc-body-room-light") ?? "1") }));
        expect(data.body).toBeCloseTo(data.grade, 2); const bytes = await room.screenshot();
        const file = `${surface}-${dark ? "dark" : "light"}-${hour}-${curtain}-${lamp ? "on" : "off"}.png`; mkdirSync(output, { recursive: true }); writeFileSync(resolve(output, file), bytes);
        samples.push({ hour, curtain, lamp, grade: data.grade, luma: await luma(bytes) });
      }
    }
  }
  proofs.get(page)!.notes.push({ stage: "lighting-12", samples });
  const at = (hour: number, curtain: string, lamp: boolean) => samples.find(s => s.hour === hour && s.curtain === curtain && s.lamp === lamp)!;
  for (const hour of [12, 0]) {
    expect(at(hour, "open", false).grade).toBeGreaterThan(at(hour, "shade", false).grade);
    expect(at(hour, "shade", false).grade).toBeGreaterThan(at(hour, "closed", false).grade);
    expect(at(hour, "closed", true).luma[0] - at(hour, "closed", false).luma[0]).toBeGreaterThan(20);
  }
  expect(at(12, "closed", false).luma[0] - at(0, "closed", false).luma[0]).toBeGreaterThan(15);
});

type Frame = { paintedSource?:PaintedSource157Proof; sourcePaint:boolean; at: number; x: number; y: number; state: string; platform: string; scene: string; washing: boolean; brush: boolean; pad: { x: number; y: number } | null };
type ProbeWindow = Window & { wash162?: { frames: Frame[]; stop: () => void } };
async function probe(page: Page) {
  await installCompanionPaintedSource157(page);
  await page.evaluate(() => { const frames: Frame[] = []; const began = performance.now(); let raf = 0;
    const tick = () => { const actor = document.querySelector<HTMLElement>(".vc-companion"), matrix = new DOMMatrixReadOnly(actor?.style.transform), size = parseFloat(actor?.style.getPropertyValue("--vc-size") ?? "92"), brush = document.querySelector<HTMLElement>(".vc-wash-tool"), pad = document.querySelector(".vc-home-wash-stance")?.getBoundingClientRect();
      const paintedSource=(window as PaintedSource157Window).companionPaintedSource157?.inspect(actor);
      frames.push({ paintedSource,sourcePaint:paintedSource?.passed===true, at: performance.now() - began, x: matrix.m41 + size / 2, y: matrix.m42 + size, state: actor?.dataset.state ?? "", platform: actor?.dataset.platform ?? "", scene: actor?.dataset.personalityScene ?? "", washing: actor?.hasAttribute("data-washing") ?? false, brush: Boolean(brush && !brush.hidden && getComputedStyle(brush).visibility !== "hidden"), pad: pad ? { x: pad.left + pad.width / 2, y: pad.top + pad.height * .72 } : null }); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); (window as ProbeWindow).wash162 = { frames, stop() { cancelAnimationFrame(raf); } };
  });
}
for (const surface of ["viewer", "studio", "preview"] as const) for (const input of ["pointer", "keyboard"] as const) test(`162 ${surface} ${input} direct pad approach wash and exit`, async ({ page }) => {
  await seed(page); const house = await open(page, surface), pad = house.getByRole("button", { name: "샤워패드에서 씻기", exact: true });
  await expect(pad).toBeEnabled(); const before = await pad.locator("img").evaluate(n => getComputedStyle(n).filter);
  await pad.hover(); await expect.poll(() => pad.locator("img").evaluate(n => getComputedStyle(n).filter)).not.toBe(before); await page.mouse.move(2, 2);
  await probe(page);
  if (input === "pointer") await pad.click(); else { await pad.focus(); await pad.press("Enter"); }
  await page.mouse.move(2, 2); await expect(page.locator(".vc-companion")).toHaveAttribute("data-washing", "", { timeout: 25000 });
  await page.waitForTimeout(650); await page.screenshot({ path: resolve(output, `${surface}-${input}-wash.png`) });
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-washing", "", { timeout: 12000 });
  await expect.poll(() => page.locator(".vc-companion").getAttribute("data-platform"), { timeout: 12000 }).toMatch(/^companion-home-floor(?:-\d+)?$/);
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-platform", "companion-home-floor-400"); await page.waitForTimeout(1200);
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).wash162!; probe.stop(); return probe.frames; });
  proofs.get(page)!.notes.push({ stage: "actual-manual-wash", input, frames });
  const washing = frames.filter(f => f.washing && f.brush && f.sourcePaint); expect(washing.length).toBeGreaterThan(5); expect(washing.at(-1)!.at - washing[0].at).toBeGreaterThan(500);
  expect(frames.some(f => ["walk", "jump"].includes(f.state) && Math.hypot(f.x - frames[0].x, f.y - frames[0].y) > 24)).toBe(true);
  for (const f of washing) { expect(f.platform).toBe("companion-home-floor-400"); expect(f.pad).not.toBeNull(); expect(Math.hypot(f.x - f.pad!.x, f.y - f.pad!.y)).toBeLessThan(2); }
});

for (const surface of ["viewer", "studio", "preview"] as const) test(`162 ${surface} three collection archives share discovered seals`, async ({ page }) => {
  await seed(page, true); await page.setViewportSize({ width: 1440, height: 760 }); const house = await open(page, surface);
  await house.locator('[data-home-action="book"]').click(); const book = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(book).toBeVisible();
  await book.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "도감", exact: true }).click();
  for (const [category, kind] of [["food", "food-stamp"], ["toy", "toy-stamp"], ["behavior", "behavior-stamp"]] as const) {
    await book.locator(`[data-act="companion-collection-category"][data-act-opt="${category}"]`).click();
    if (category === "toy") await book.locator('.rhh-collection-grid [data-found]').first().click();
    const detail = book.locator(".rhh-collection-gallery-detail"); await expect(detail).toHaveAttribute("data-found", "true"); await expect(detail.locator(`[data-collection-art="${kind}"]`)).toBeVisible();
    const shape = await detail.locator(".rhh-collection-art-stage").evaluate(stage => { const a = stage.getBoundingClientRect(); return { width: a.width, height: a.height, scroll: stage.scrollWidth > stage.clientWidth + 1 }; }); expect(shape.width).toEqual(shape.height); expect(shape.scroll).toBe(false);
    await book.screenshot({ path: resolve(output, `${surface}-${category}-archive.png`) }); proofs.get(page)!.notes.push({ stage: "selected-archive-seal", category, kind, shape });
  }
});

test("162 closing the compact room cancels a manual wash without replay", async ({ page }) => {
  await seed(page); const house = await open(page, "viewer"), actor = page.locator(".vc-companion");
  const close = house.getByRole("button", { name: "빅타민 집 닫기", exact: true }); await expect(close).toBeVisible();
  await house.getByRole("button", { name: "샤워패드에서 씻기", exact: true }).click(); await page.mouse.move(2, 2);
  await expect(actor).toHaveAttribute("data-washing", "", { timeout: 25000 }); await close.click();
  await expect(house).toBeHidden(); await page.waitForTimeout(650);
  await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).click(); await expect(house).toBeVisible();
  await page.waitForTimeout(3200); await expect(actor).not.toHaveAttribute("data-washing", "");
  await expect(actor).toBeVisible(); proofs.get(page)!.notes.push({ stage: "closed-room-manual-request-revoked", automaticRoam: false });
});

for (const source of ["sofa", "calendar"] as const) test(`162 direct pad journey from ${source}`, async ({ page }) => {
  await seed(page); const house = await open(page, "viewer"), actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  let point: { x: number; y: number };
  if (source === "sofa") { const r = (await house.locator(".vc-home-cushion").boundingBox())!; point = { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
  else {
    const edge = (await house.boundingBox())!;
    const rect = await page.locator(".public-event").evaluateAll((nodes, right) => nodes.map(n => n.getBoundingClientRect()).find(r => r.width > 90 && r.left > right + 30 && r.top > 120 && r.top < innerHeight - 150), edge.x + edge.width);
    expect(rect).toBeTruthy(); point = { x: rect!.x + rect!.width / 2, y: rect!.top - 8 };
  }
  await actor.focus(); await actor.press("p"); await page.mouse.click(point.x, point.y); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-state", "jump");
  if (source === "sofa") await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", "companion-home");
  else await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-platform", /^companion-home/);
  await probe(page); await house.getByRole("button", { name: "샤워패드에서 씻기", exact: true }).click(); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-washing", "", { timeout: 30000 }); await page.waitForTimeout(700);
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).wash162!; probe.stop(); return probe.frames; }); proofs.get(page)!.notes.push({ stage: "alternate-source-manual-wash", source, frames });
  expect(frames.some(f => ["walk", "jump"].includes(f.state))).toBe(true);
});

test("162 narrow default panel keeps a real mat stance and accepts a sofa wash request", async ({ page }) => {
  await seed(page); await page.setViewportSize({ width: 1473, height: 945 });
  const response=await page.goto("/visual-fixture/poster?hour=12");
  proofs.get(page)!.notes.push({stage:"actual-html",sha256:createHash("sha256").update(await response!.body()).digest("hex"),hour:12,surface:"viewer-default-panel"}); await page.bringToFront(); await settlePanelLayout(page);
  const panel = page.locator('.poster-panel-ctl [data-act="panel-toggle"]').first();
  if (await panel.getAttribute("aria-pressed") === "false") await panel.click();
  const home = await openCompanionHome(page); await expect(home).toHaveAttribute("data-home-presentation", "panel");
  const fold = home.locator('[data-home-action="fold"]'); if (await fold.getAttribute("aria-expanded") === "false") await fold.click();
  const room = (await home.locator(".vc-home-room").boundingBox())!, mat = (await home.locator(".vc-home-wash-stance").boundingBox())!;
  expect(room.width).toBeGreaterThan(240); expect(room.width).toBeLessThan(290); proofs.get(page)!.notes.push({ stage: "default-panel-mat-measure", room, mat });
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), seat = (await home.locator(".vc-home-cushion").boundingBox())!;
  await actor.focus(); await actor.press("p"); await page.mouse.click(seat.x + seat.width / 2, seat.y + seat.height / 2); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", "companion-home");
  await probe(page); await home.getByRole("button", { name: "샤워패드에서 씻기", exact: true }).click(); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-washing", "", { timeout: 25000 }); await page.waitForTimeout(700);
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-washing","",{timeout:12000});
  await expect.poll(()=>page.locator(".vc-companion").getAttribute("data-platform"),{timeout:12000}).toMatch(/^companion-home-floor(?:-\d+)?$/);
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-platform","companion-home-floor-400");await page.waitForTimeout(1200);
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).wash162!; probe.stop(); return probe.frames; });
  const washing = frames.filter(f => f.washing && f.brush && f.sourcePaint); expect(washing.length).toBeGreaterThan(5);
  expect(washing.at(-1)!.at-washing[0].at).toBeGreaterThan(500);
  const first=frames.find(f=>f.sourcePaint);expect(first).toBeTruthy();
  expect(frames.some(f=>f.sourcePaint&&["walk","jump"].includes(f.state)&&Math.hypot(f.x-first!.x,f.y-first!.y)>24)).toBe(true);
  expect(frames.some(f=>f.at>washing.at(-1)!.at&&f.sourcePaint&&!f.washing&&f.platform!=="companion-home-floor-400"&&/^companion-home-floor/.test(f.platform))).toBe(true);
  for (const f of washing) { expect(f.platform).toBe("companion-home-floor-400"); expect(f.pad).not.toBeNull(); expect(Math.abs(f.y-f.pad!.y)).toBeLessThan(2); expect(f.x).toBeGreaterThan(mat.x + mat.width * .18); expect(f.x).toBeLessThan(mat.x + mat.width * .82); expect(f.x - 92 * .38).toBeGreaterThanOrEqual(room.x-.5); expect(f.x + 92 * .38).toBeLessThanOrEqual(room.x + room.width + .5); }
  proofs.get(page)!.notes.push({ stage: "actual-narrow-panel-wash", frames }); await home.screenshot({ path: resolve(output, "narrow-panel-wash.png") });
});
