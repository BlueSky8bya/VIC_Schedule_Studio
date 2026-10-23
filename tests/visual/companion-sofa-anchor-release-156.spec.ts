import { companionTraceMode } from "./helpers/companion-evidence-policy";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { chooseCompanionPersonality, openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { guardCompanionQa, type DailyProof } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { auditSofaWorldTransfer156, type SofaWorldFrame156 } from "./helpers/companion-sofa-world-frame-156";

type Probe = { frames: SofaWorldFrame156[]; phase: string; raf: number; actor: HTMLElement; input: HTMLElement };
type ProbeWindow = Window & { sofaAnchor156?: Probe };
type Record156 = { proof: DailyProof; binding: unknown; frames?: SofaWorldFrame156[]; audit?: ReturnType<typeof auditSofaWorldTransfer156> };
const records = new WeakMap<Page, Record156>();
const sourcePaths = ["components/poster/viewer-companion/viewer-companion.tsx", "components/poster/viewer-companion/viewer-companion.css",
  "tests/visual/companion-sofa-anchor-release-156.spec.ts", "tests/visual/helpers/companion-sofa-world-frame-156.ts"];
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Fail closed unless the integrating runner supplies its NEW frozen source.
 * The known failed build's digest cannot silently certify a repaired build. */
function sourceBinding() {
  const path = process.env.COMPANION156_SOURCE_FREEZE;
  if (!path) throw Error("Set COMPANION156_SOURCE_FREEZE to this execution's new source-freeze.json");
  const raw = readFileSync(resolve(path)), value = JSON.parse(raw.toString()) as { head: string; contentDigest: string; sourceFiles: { path: string; sha256: string }[] };
  if (!/^[a-f0-9]{64}$/.test(value.contentDigest) || !Array.isArray(value.sourceFiles)) throw Error("Invalid source freeze binding");
  const sources = sourcePaths.map(path => {
    const expected = value.sourceFiles.find(source => source.path === path), actual = sha256(readFileSync(resolve(path)));
    if (!expected || expected.sha256 !== actual) throw Error(`Frozen source mismatch: ${path}`);
    return { path, sha256: actual };
  });
  return { path: resolve(path), sha256: sha256(raw), head: value.head, contentDigest: value.contentDigest, sources };
}

test.use({ viewport: { width: 1920, height: 850 }, deviceScaleFactor: 1, serviceWorkers: "block", hasTouch: false,
  trace: companionTraceMode(), video: { mode: "on", size: { width: 1920, height: 850 } } });
test.setTimeout(75_000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const binding = sourceBinding();
  records.set(page, { binding, proof: await guardCompanionQa(page, context, baseURL!) });
  await page.addInitScript(({ epoch, epochKey, preferences, memory }) => {
    // Only synthetic device settings/needs. No RNG, actor state, geometry,
    // action callback, clock, animation or network service is replaced.
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }),
      "vic.sound": "off", "vic.ambient": "off", "vic.dark": "on", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.premiereStage": "off",
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: false, jump: true, drag: true,
        activeWhileVisible: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }),
      "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }),
      "vic.panelSections": JSON.stringify({ version: 1, "tag-filter": false, season: false, "companion-home": true }) })) localStorage.setItem(key, value);
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY });
});

test.afterEach(async ({ page }, info) => {
  const record = records.get(page); if (!record) return;
  record.frames = await page.evaluate(() => { const p = (window as ProbeWindow).sofaAnchor156; if (!p) return []; cancelAnimationFrame(p.raf); return p.frames; }).catch(() => []);
  record.audit = auditSofaWorldTransfer156(record.frames);
  await Promise.allSettled(record.proof.pending);
  const directory = info.outputPath("sofa-anchor-release-156"); mkdirSync(directory, { recursive: true });
  const screenshot = resolve(directory, "actual-final.png");
  await page.screenshot({ path: screenshot, fullPage: false, animations: "allow" }).catch(() => {});
  const raw = resolve(directory, "raw.json");
  writeFileSync(raw, JSON.stringify({ schemaVersion: 1, kind: "actual-sofa-world-anchor-release-156", caseTitle: info.title, status: info.status,
    buildId: record.proof.build, sourceBinding: record.binding, evidencePolicy: "All rAF frames retained, including native/prepaint candidates. Matrix comparison is world-space ownership, not designated landing precision. Actual video and trace require independent review.",
    capturedVideoSize: { width: 1920, height: 850 }, cssViewportWidths: [1920], deviceScaleFactor: 1,
    ...record, proof: { ...record.proof, pending: undefined } }, null, 2));
  await info.attach("actual-sofa-anchor-release-156", { path: raw, contentType: "application/json" });
  await info.attach("actual-sofa-anchor-release-156-final", { path: screenshot, contentType: "image/png" }).catch(() => {});
  expect(record.proof.errors).toEqual([]); expect(record.proof.rejected).toEqual([]);
  expect(record.proof.mutations).toEqual([]); expect(record.proof.liveReads).toEqual([]);
  expect(record.proof.chunks.length).toBeGreaterThan(0);
  expect(record.proof.chunks.every(chunk => chunk.served === chunk.local)).toBe(true);
});

async function phase(page: Page, value: string) {
  await page.evaluate(value => { const probe = (window as ProbeWindow).sofaAnchor156; if (probe) probe.phase = value; }, value);
}
async function frames(page: Page) { return page.evaluate(() => (window as ProbeWindow).sofaAnchor156?.frames ?? []); }
async function probe(page: Page) {
  await page.evaluate(() => {
    const actor = document.querySelector<HTMLElement>(".vc-companion")!, input = actor.querySelector<HTMLElement>(".vc-actor")!;
    const p: Probe = { frames: [], phase: "native-before-scroll", raf: 0, actor, input };
    (window as ProbeWindow).sofaAnchor156 = p;
    const matrix = (node: HTMLElement) => Array.from(new DOMMatrixReadOnly(getComputedStyle(node).transform).toFloat64Array());
    const sample = (at: number) => {
      const node = document.querySelector<HTMLElement>(".vc-companion"), button = node?.querySelector<HTMLElement>(".vc-actor"), r = node?.getBoundingClientRect();
      const css = node && getComputedStyle(node), texture = node?.querySelector<HTMLImageElement>(".vc-texture"), sprite = node?.querySelector<HTMLElement>(".vc-sprite");
      const t = texture && getComputedStyle(texture), s = sprite && getComputedStyle(sprite);
      p.frames.push({ at, phase: p.phase, native: node?.hasAttribute("data-native-sofa") ?? false, state: node?.dataset.state ?? "", platform: node?.dataset.platform ?? "",
        sameActor: node === actor && actor.isConnected, sameInput: button === input && input.isConnected, inputFocused: document.activeElement === input,
        visible: Boolean(node && r && !node.hidden && !document.hidden && r.width > 0 && r.height > 0 && css?.display !== "none" && css?.visibility === "visible" && Number(css?.opacity) > .05
          && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight),
        positionAnchor: css?.getPropertyValue("position-anchor").trim() ?? "", inlinePositionAnchor: node?.style.getPropertyValue("position-anchor").trim() ?? "", position: css?.position ?? "",
        homeScroll: document.querySelector<HTMLElement>(".vc-compact-home .vc-home")?.scrollTop ?? 0, pose: Number(node?.dataset.pose ?? -1), decoded: Boolean(texture?.complete && texture.naturalWidth),
        cell: texture && sprite && t && s ? { currentPath: new URL(texture.currentSrc || texture.src, location.href).pathname, connectedToSprite: texture.isConnected && texture.parentElement === sprite,
          naturalWidth: texture.naturalWidth, naturalHeight: texture.naturalHeight, textureWidth: parseFloat(t.width), textureHeight: parseFloat(t.height), spriteWidth: parseFloat(s.width), spriteHeight: parseFloat(s.height),
          textureLeft: parseFloat(t.left), textureTop: parseFloat(t.top), textureMatrix: matrix(texture), spriteMatrix: matrix(sprite), spriteClipPath: s.clipPath, textureClipPath: t.clipPath } : null,
        left: parseFloat(css?.left ?? ""), top: parseFloat(css?.top ?? ""), width: parseFloat(css?.width ?? ""), height: parseFloat(css?.height ?? ""),
        origin: css?.transformOrigin.split(/\s+/).map(parseFloat) ?? [], matrix: node ? matrix(node) : null, rect: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null });
      p.raf = requestAnimationFrame(sample);
    };
    p.raf = requestAnimationFrame(sample);
  });
}

for (const surface of ["viewer", "studio", "preview"] as const) test(`156 ${surface} scrolled sofa releases native anchor during real lift and flight`, async ({ page }) => {
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2026&m=10&hour=21&weather=clear");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  await chooseCompanionPersonality(page, "homebody");
  for (const toggle of await page.getByRole("button", { name: "패널 접기", exact: true }).all()) if (await toggle.isVisible()) { await toggle.click(); break; }
  await settlePanelLayout(page); const home = await openCompanionHome(page);
  await expect(page.locator(".vc-compact-home .vc-home")).toBeVisible();
  await placeCompanionOnHomeFloor(page);
  const pet = page.locator(".vc-companion"), input = pet.locator(".vc-actor"), cushion = home.locator(".vc-cushion-button");
  const recall = async () => { await cushion.focus(); await cushion.press("Enter"); await expect(pet).toHaveAttribute("data-platform", "companion-home", { timeout: 25_000 });
    await expect(pet).toHaveAttribute("data-native-sofa", "", { timeout: 25_000 }); await expect(pet).not.toHaveAttribute("data-state", "jump"); };
  await recall(); await page.setViewportSize({ width: 1920, height: 420 }); await settlePanelLayout(page);
  await expect(pet).toHaveAttribute("data-native-sofa", "");
  const scroll = page.locator(".vc-compact-home .vc-home");
  expect(await scroll.evaluate(node => node.scrollHeight - node.clientHeight), "requires actual native compact overflow").toBeGreaterThan(5);
  const portal = await pet.evaluate(node => ({ directBody: node.parentElement === document.body, ancestorFixedSpace: [document.body, document.documentElement].every(parent => {
    const css = getComputedStyle(parent); return css.transform === "none" && css.filter === "none" && css.perspective === "none" && !/(layout|paint|strict|content)/.test(css.contain) && Number(css.zoom || 1) === 1; }) }));
  expect(portal).toEqual({ directBody: true, ancestorFixedSpace: true });
  await probe(page); await phase(page, "native-scroll");
  const bounds = (await scroll.boundingBox())!; await page.mouse.move(bounds.x + bounds.width * .8, Math.min(380, bounds.y + bounds.height * .5)); await page.mouse.wheel(0, 550);
  await expect.poll(() => scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(5);
  await expect(pet).toHaveAttribute("data-native-sofa", ""); await page.waitForTimeout(150);
  await page.screenshot({ path: test.info().outputPath("actual-native-sofa-after-scroll.png"), animations: "allow" });
  await input.focus(); expect(await scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(5);
  await phase(page, "world-input"); await input.press(" "); await expect(pet).toHaveAttribute("data-state", "held");
  await expect(pet).not.toHaveAttribute("data-native-sofa");
  for (let i = 0; i < 6; i++) { await input.press("ArrowRight"); await page.waitForTimeout(30); }
  for (let i = 0; i < 2; i++) { await input.press("ArrowUp"); await page.waitForTimeout(30); }
  expect(await scroll.evaluate(node => node.scrollTop)).toBeGreaterThan(5);
  await phase(page, "world-release"); await input.press(" ");
  await expect.poll(async () => (await frames(page)).filter(frame => frame.phase === "world-release" && frame.state === "jump").length,
    { timeout: 8_000, intervals: [40] }).toBeGreaterThanOrEqual(3);
  await expect(pet).not.toHaveAttribute("data-state", "jump", { timeout: 10_000 }); await expect(pet).not.toHaveAttribute("data-state", "held");
  await page.waitForTimeout(200);
  const result = auditSofaWorldTransfer156(await frames(page)); records.get(page)!.audit = result;
  expect(result.issues).toEqual([]);
  await phase(page, "recalled"); await recall(); await page.waitForTimeout(100);
  const all = await frames(page); expect(all.some(frame => frame.phase === "recalled" && frame.native && frame.sameActor && frame.sameInput && frame.decoded)).toBe(true);
  expect(await page.evaluate(() => { const preferences = JSON.parse(localStorage.getItem("vic.viewerCompanion")!); return { roam: preferences.roam, sleep: preferences.sleep, personality: preferences.personality, personalitySource: preferences.personalitySource }; }))
    .toEqual({ roam: false, sleep: false, personality: "homebody", personalitySource: "manual" });
});
