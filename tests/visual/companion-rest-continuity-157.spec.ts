import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionPlayDuration, COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { COMPANION_HOME_LIGHT_KEY, parseCompanionHomeLight } from "@/lib/ui/viewer-companion/home-light";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { guardCompanionQa, type DailyProof } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { curiousTextureCellMatches, type CuriousTextureCellMeasurement } from "./helpers/companion-curious-completion-144";
import { nativeHomeControlContactBefore, type NativeHomeControlFrame } from "./helpers/companion-home-contact-156";
import { installCompanionPaintedSource157, type PaintedSource157Proof, type PaintedSource157Window } from "./helpers/companion-painted-source-157";

type Surface = "viewer" | "studio" | "preview";
type Frame = NativeHomeControlFrame & { state: string; play: string; scene: string; serial: string; beat: string; platform: string; pose: number;
  x: number; y: number; visible: boolean; decoded: boolean; cell: CuriousTextureCellMeasurement | null; sourcePaint: boolean;
  light: boolean; tv: string; night: boolean; homeLife: string; homeLifeScene: string; homeLifeSerial: string; homeLifeBeat: string;
  sofa: { left: number; right: number; top: number; visible: boolean } | null;
  paintedSource?: PaintedSource157Proof;
  toys: { id: string; carried: boolean; visible: boolean; x: number; y: number }[] };
type ProbeWindow = Window & { rest157?: { frames: Frame[]; stop(): void }; restOff157?: { events: number[]; stop(): void } };
const records = new WeakMap<Page, { proof: DailyProof; binding: unknown; notes: unknown[] }>();
const readBuffers = new WeakMap<Page, { cursor: number; frames: Frame[] }>();
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const sourcePaths = ["lib/ui/viewer-companion/home-contact-presentation.ts", "tests/visual/helpers/companion-home-contact-156.ts", "tests/visual/helpers/companion-home.ts", "tests/visual/helpers/companion-floor-placement-157.ts", "lib/ui/viewer-companion/home-life-policy.ts", "lib/ui/viewer-companion/personality-director.ts", "lib/ui/viewer-companion/accessory.ts", "lib/ui/viewer-companion/home-contact-anchors-157.json", "lib/ui/viewer-companion/home-interaction.ts", "lib/ui/viewer-companion/home-light.ts", "lib/ui/viewer-companion/home-room-media.ts", "components/poster/public-poster.tsx", "components/shared/companion-settings.tsx", "components/poster/viewer-companion/viewer-companion.tsx", "app/visual-fixture/poster/page.tsx", "tests/visual/companion-rest-continuity-157.spec.ts"];
test.use({ viewport: { width: 1920, height: 1100 }, deviceScaleFactor: 1, storageState: { cookies: [], origins: [] }, serviceWorkers: "block", hasTouch: false,
  trace: "on", video: { mode: "on", size: { width: 1920, height: 1100 } } });
test.setTimeout(175_000);

test.beforeEach(async ({ page, context, baseURL }) => {
  const frozen = process.env.COMPANION157_SOURCE_FREEZE ?? process.env.COMPANION156_SOURCE_FREEZE;
  if (!frozen) throw Error("This new execution must supply its own source-freeze.json");
  const bytes = readFileSync(resolve(frozen)), binding = JSON.parse(bytes.toString()) as { contentDigest: string; sourceFiles: { path: string; sha256: string }[] };
  for (const path of sourcePaths) expect(binding.sourceFiles.find(row => row.path === path)?.sha256).toBe(sha(readFileSync(resolve(path))));
  records.set(page, { proof: await guardCompanionQa(page, context, baseURL!), binding: { path: resolve(frozen), sha256: sha(bytes), contentDigest: binding.contentDigest }, notes: [] });
});
test.afterEach(async ({ page }, info) => {
  const rawFrames = await page.evaluate(() => { const probe = (window as ProbeWindow).rest157; probe?.stop(); return probe?.frames ?? []; }).catch(() => []);
  const record = records.get(page)!; await Promise.allSettled(record.proof.pending);
  const boundaryClean = [record.proof.errors, record.proof.rejected, record.proof.mutations, record.proof.liveReads].every(rows => rows.length === 0);
  const chunksMatch = record.proof.chunks.length > 0 && record.proof.chunks.every(chunk => chunk.served === chunk.local);
  const raw = info.outputPath("actual-rest-continuity-157.json");
  writeFileSync(raw, JSON.stringify({ schemaVersion: 1, kind: "actual-owned-rest-continuity-157", caseTitle: info.title, caseStatus: info.status,
    status: info.status === "passed" && boundaryClean && chunksMatch ? "passed" : "needs-review",
    buildId: record.proof.build, sourceBinding: record.binding, proof: { ...record.proof, pending: undefined }, notes: record.notes, frames: rawFrames,
    limitation: "Native same-ID return and full real S03 rest followed by another actual action; initial synthetic care/light and guarded fixture-hour only. No RNG/clock/brain/geometry/action injection. Daynap light is the actual random outcome, not both probability branches. Full1x trace/video and failed observations retained." }, null, 2));
  await info.attach("actual-owned-rest-continuity-157", { path: raw, contentType: "application/json" });
  const screenshot = info.outputPath("actual-rest-final-157.png"); await page.screenshot({ path: screenshot, animations: "allow" });
  await info.attach("actual-rest-final-157", { path: screenshot, contentType: "image/png" });
  expect(record.proof.errors).toEqual([]); expect(record.proof.rejected).toEqual([]); expect(record.proof.mutations).toEqual([]); expect(record.proof.liveReads).toEqual([]);
  expect(record.proof.chunks.length).toBeGreaterThan(0); expect(record.proof.chunks.every(chunk => chunk.served === chunk.local)).toBe(true);
});

async function settings(page: Page, roam: boolean, sleep = true, enabled?: boolean) {
  const home = await openCompanionHome(page); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  if (enabled !== undefined) await dialog.locator('[data-act="companion-enabled"]').setChecked(enabled);
  if (enabled !== false) {
    await dialog.getByRole("tab", { name: "움직임", exact: true }).click();
    await dialog.locator('[data-act="companion-roam"]').setChecked(roam); await dialog.locator('[data-act="companion-sleep"]').setChecked(sleep);
  }
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
}
async function fixture(page: Page, surface: Surface, night: boolean, initialLight: boolean) {
  await page.addInitScript(({ preferences, memory, epoch, key, initialLight }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }),
      "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, personality: "sleepy", personalitySource: "manual", roam: false, sleep: false,
      feeding: false, petting: true, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .05, hunger: .05 }));
    localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit: initialLight }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, initialLight });
  await page.goto(surface === "viewer" ? `/visual-fixture/poster?avatar=1&hour=${night ? 0 : 12}` : `/visual-fixture/studio?role=owner&y=2025&m=7&hour=${night ? 0 : 12}&weather=clear`);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  const home = await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  const room = home.locator(".vc-home-room"); if (night) await expect(room).toHaveAttribute("data-night", "true"); else await expect(room).not.toHaveAttribute("data-night");
  await expect(home.locator(".vc-home-lamp")).toHaveAttribute("aria-pressed", String(initialLight));
  return home;
}
async function startProbe(page: Page) {
  readBuffers.delete(page);
  await installCompanionPaintedSource157(page);
  await page.evaluate(() => {
    (window as ProbeWindow).rest157?.stop(); const frames: Frame[] = [], began = performance.now(); let raf = 0, last = -Infinity, stopped = false;
    const paint = (node: Element | null | undefined): NativeHomeControlFrame["control"]["tool"] => {
      if (!node) return { visible: false, rect: null }; const r = node.getBoundingClientRect(), css = getComputedStyle(node);
      return { rect: { x: r.x, y: r.y, width: r.width, height: r.height }, visible: Boolean(!document.hidden && !node.closest("[hidden],[inert]") && r.width > 0 && r.height > 0
        && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight && css.visibility === "visible" && Number(css.opacity) > .05 && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) };
    };
    const sample = (at: number) => {
      if (stopped) return; if (at-last >= 40) {
        last = at; const actor = document.querySelector<HTMLElement>(".vc-companion"), image = actor?.querySelector<HTMLImageElement>(".vc-texture"), sprite = actor?.querySelector<HTMLElement>(".vc-sprite"), actorPaint = paint(actor);
        const paintedSource=(window as PaintedSource157Window).companionPaintedSource157?.inspect(actor);
        const room = document.querySelector<HTMLElement>(".vc-home-room"), lamp = room?.querySelector<HTMLElement>(".vc-home-lamp"), lp = lamp?.querySelector<HTMLElement>(".vc-home-lamp-paint"), handle = lamp?.querySelector<HTMLElement>(".vc-home-lamp-handle"), tv = room?.querySelector<HTMLElement>(".vc-home-tv-paint"), tvImage = tv?.querySelector<HTMLImageElement>(".vc-home-tv-body");
        const light = Boolean(room?.hasAttribute("data-lamp-lit")), state = light ? "on" : "off", art = lamp?.querySelector<HTMLElement>(`.vc-home-lamp-art[data-lamp-state="${state}"]`), feedback = lamp?.querySelector<HTMLElement>(`.vc-home-lamp-cord-feedback[data-lamp-state="${state}"]`);
        const control: NativeHomeControlFrame["control"] = {
          actor: { ...actorPaint, decoded: Boolean(image?.complete && image.naturalWidth), pose: Number(actor?.dataset.pose ?? -1), src: image?.currentSrc ?? "", platform: actor?.dataset.platform ?? "", reach: actor?.dataset.homeReaching ?? "" },
          tool: paint(document.querySelector(".vc-home-touch-tool")), lamp: { button: paint(lamp), paint: paint(lp), handle: paint(handle), touch: Boolean(lamp?.hasAttribute("data-companion-touch")), state,
            requestedPull: parseFloat(lamp ? getComputedStyle(lamp).getPropertyValue("--vc-lamp-pull") : "NaN"), cssWidth: parseFloat(lp ? getComputedStyle(lp).width : "NaN"),
            art: { ...paint(art), source: art ? getComputedStyle(art).borderImageSource : "" }, feedback: { ...paint(feedback), source: feedback ? getComputedStyle(feedback).borderImageSource : "", opacity: Number(feedback ? getComputedStyle(feedback).opacity : 0), clip: feedback ? getComputedStyle(feedback).clipPath : "" } },
          tv: { ...paint(tv), decoded: Boolean(tvImage?.complete && tvImage.naturalWidth), src: tvImage?.currentSrc ?? "" },
        };
        let cell: CuriousTextureCellMeasurement | null = null;
        if (image && sprite) {
          const tc = getComputedStyle(image), sc = getComputedStyle(sprite), matrix = (value: string) => Array.from(new DOMMatrixReadOnly(value).toFloat64Array());
          cell = { currentPath: new URL(image.currentSrc || image.src, location.href).pathname, connectedToSprite: image.parentElement === sprite && image.isConnected && sprite.isConnected,
            naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, textureWidth: parseFloat(tc.width), textureHeight: parseFloat(tc.height), spriteWidth: parseFloat(sc.width), spriteHeight: parseFloat(sc.height),
            textureLeft: parseFloat(tc.left), textureTop: parseFloat(tc.top), textureMatrix: matrix(tc.transform), spriteMatrix: matrix(sc.transform), spriteClipPath: sc.clipPath, textureClipPath: tc.clipPath };
        }
        const cushion = paint(room?.querySelector(".vc-home-cushion"));
        frames.push({ at: at-began, state: actor?.dataset.state ?? "", play: actor?.dataset.play ?? "", scene: actor?.dataset.personalityScene ?? "", serial: actor?.dataset.personalitySerial ?? "", beat: actor?.dataset.personalityBeat ?? "", platform: actor?.dataset.platform ?? "", pose: Number(actor?.dataset.pose ?? -1),
          x: actorPaint.rect ? actorPaint.rect.x + actorPaint.rect.width/2 : NaN, y: actorPaint.rect ? actorPaint.rect.y + actorPaint.rect.height : NaN, visible: actorPaint.visible, decoded: control.actor.decoded, cell,
          sourcePaint: paintedSource?.passed===true,paintedSource, light, tv: room?.dataset.tv ?? "off", night: Boolean(room?.hasAttribute("data-night")),
          homeLife: actor?.dataset.homeLife ?? "", homeLifeScene: actor?.dataset.homeLifeScene ?? "", homeLifeSerial: actor?.dataset.homeLifeSerial ?? "", homeLifeBeat: actor?.dataset.homeLifeBeat ?? "", control,
          sofa: cushion.rect ? { left: cushion.rect.x, right: cushion.rect.x+cushion.rect.width, top: cushion.rect.y, visible: cushion.visible } : null,
          toys: [...document.querySelectorAll<HTMLElement>(".vc-toy")].map(node => { const p = paint(node); return { id: node.dataset.toyId ?? "", carried: node.dataset.carried === "true", visible: p.visible, x: p.rect ? p.rect.x+p.rect.width/2 : NaN, y: p.rect ? p.rect.y+p.rect.height : NaN }; }) });
      } if (at-began < 140_000) raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample); (window as ProbeWindow).rest157 = { frames, stop() { stopped = true; cancelAnimationFrame(raf); } };
  });
}
const read = async (page: Page) => {
  const previous = readBuffers.get(page) ?? { cursor: 0, frames: [] };
  // Keep every original raw sample, transferring only new frames per poll.
  // Recopying the growing full trace delayed real renderer/decode work.
  const chunk = await page.evaluate(cursor => {
    const frames = (window as ProbeWindow).rest157?.frames ?? [];
    return { cursor: frames.length, frames: frames.slice(cursor) };
  }, previous.cursor);
  const frames = previous.frames.concat(chunk.frames);
  readBuffers.set(page, { cursor: chunk.cursor, frames });
  return frames;
};
const source = (frame: Frame) => frame.visible && frame.decoded && frame.sourcePaint && curiousTextureCellMatches(frame.pose, frame.cell);
function restWitness(frames: Frame[]) {
  for (const first of frames.filter(frame => frame.scene === "S03" && frame.beat === "2" && frame.state === "play" && frame.play === "cozy-nest" && source(frame))) {
    const same = frames.filter(frame => frame.scene === "S03" && frame.serial === first.serial), cozy = same.filter(frame => frame.beat === "2" && frame.play === "cozy-nest" && source(frame));
    const sleeping = same.filter(frame => frame.beat === "3" && frame.state === "sleep" && source(frame) && [10,11,12,35,36,40].some(row => companionSpriteMetadata.rows[row].includes(frame.pose)));
    const end = sleeping.at(-1); if (!end || sleeping.length < 3 || end.at-sleeping[0].at < 5500*.8-80 || cozy.length < 3 || cozy.at(-1)!.at-cozy[0].at < companionPlayDuration("cozy-nest")*.8-80) continue;
    const next = frames.find(frame => frame.at > end.at+100 && frame.at <= end.at+10_000 && source(frame) && ["walk","jump","stretch","sniff","shake"].includes(frame.state)
      && (frame.scene !== "S03" || frame.serial !== first.serial));
    if (next) return { serial: first.serial, first: cozy[0], cozyEnd: cozy.at(-1)!, sleeping, end, next };
  }
}
for (const surface of ["viewer", "studio", "preview"] as const) for (const night of [false, true]) test(`157 ${surface} ${night ? "night" : "day"} same-ID return prepares controls before cozy then rests and continues`, async ({ page }) => {
  const home = await fixture(page, surface, night, night), toyButton = home.locator('[data-home-action="toys"]');
  await toyButton.click(); const toy = page.locator(".vc-toy"); await expect(toy).toHaveCount(1); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 10_000 });
  const id = (await toy.getAttribute("data-toy-id"))!, kind = await toy.getAttribute("data-kind"), box = (await home.locator(".vc-toy-box-opening").boundingBox())!, opening = { x: box.x+box.width/2, y: box.y+box.height };
  const tv = home.locator('[data-home-action="tv"]'); await tv.click(); await tv.click(); await expect(home.locator(".vc-home-room")).toHaveAttribute("data-tv", "nature");
  await page.waitForTimeout(15500); await startProbe(page); await settings(page, true);
  await expect.poll(async () => Boolean(restWitness(await read(page))), { timeout: 115_000, intervals: [150] }).toBe(true);
  const frames = await read(page), witness = restWitness(frames)!;
  const carried = frames.filter(frame => source(frame) && frame.scene === "S03" && frame.serial === witness.serial && frame.beat === "0" && frame.toys.some(toy => toy.id === id && toy.carried)); expect(carried.length).toBeGreaterThanOrEqual(2);
  const last = carried.at(-1)!.toys.find(toy => toy.id === id)!; expect(Math.hypot(last.x-opening.x,last.y-opening.y)).toBeLessThan(20);
  expect(frames.some(frame => frame.at > carried.at(-1)!.at && frame.at < witness.first.at && !frame.toys.some(toy => toy.id === id))).toBe(true);
  const prepared = frames.filter(frame => frame.at >= witness.first.at && frame.at <= witness.end.at);
  expect(prepared.every(frame => frame.platform === "companion-home"), "a settled cushion preparation must not leave for a late lamp errand").toBe(true);
  expect(prepared.filter(source).every(frame => frame.sofa?.visible && frame.x >= frame.sofa.left && frame.x <= frame.sofa.right && Math.abs(frame.y-frame.sofa.top) <= 3), "actual decoded body remains supported by the same visible cushion, not only its platform label").toBe(true);
  expect(prepared.every(frame => !frame.homeLife), "all actual household preparation precedes cozy").toBe(true);
  expect(prepared.every(frame => frame.light === witness.first.light && frame.tv === witness.first.tv)).toBe(true);
  if (night) { expect(witness.first.light).toBe(false); expect(["off","tori"]).toContain(witness.first.tv); }
  const changes = frames.filter((frame,index) => index>0 && frame.at < witness.first.at && frame.light !== frames[index-1].light);
  for (const frame of changes) expect(nativeHomeControlContactBefore(frames,frame.at,"light"), "real physical lamp cord, not a remote state write").toBeTruthy();
  if (night) {
    const changedTv = frames.find((frame,index) => index>0 && frame.at < witness.first.at && frame.tv !== frames[index-1].tv);
    expect(changedTv).toBeTruthy(); expect(nativeHomeControlContactBefore(frames,changedTv!.at,"tv")).toBeTruthy();
  }
  records.get(page)!.notes.push({ samePhysicalId: id, actualRandomKind: kind, sourceRecipe: "S03", ownerSerial: witness.serial, initialLight: night, actualFixtureHour: night ? 0 : 12,
    fullSameIdReturnBeforeCozy: true, actualCozyAt: witness.first.at, actualSleepStart: witness.sleeping[0].at, actualSleepEnd: witness.end.at, nextActionAt: witness.next.at, nextAction: witness.next.state,
    observedNapLight: witness.first.light, expectedNightOff: night, noControlTripAfterSettling: true, lastCarried: carried.at(-1)!.at, opening });
});

test("157 studio night manual light priority remains until expiry then real rest preparation resumes", async ({ page }) => {
  const home = await fixture(page,"studio",true,false); await startProbe(page);
  const lamp = home.locator(".vc-home-lamp"); await lamp.click(); await expect(lamp).toHaveAttribute("aria-pressed","true");
  const clickedAt = await page.evaluate(() => (window as ProbeWindow).rest157!.frames.at(-1)?.at ?? 0); await settings(page,true);
  await expect.poll(async () => (await read(page)).at(-1)!.at-clickedAt, { timeout: 17_000, intervals: [100] }).toBeGreaterThanOrEqual(14_500);
  const protectedFrames = (await read(page)).filter(frame => frame.at >= clickedAt+100 && frame.at <= clickedAt+14_500);
  expect(protectedFrames.length).toBeGreaterThan(200); expect(protectedFrames.every(frame => frame.light)).toBe(true);
  await expect.poll(async () => (await read(page)).some(frame => frame.at > clickedAt+15_000 && frame.state === "sleep" && source(frame) && !frame.light), { timeout: 90_000, intervals: [150] }).toBe(true);
  const frames = await read(page), change = frames.find((frame,index) => index>0 && !frame.light && frames[index-1].light)!;
  expect(change.at-clickedAt).toBeGreaterThanOrEqual(14_800); expect(nativeHomeControlContactBefore(frames,change.at,"light")).toBeTruthy();
  records.get(page)!.notes.push({ actualHumanClickAt: clickedAt, protectedObservedMs: 14500, actualCompanionOffAt: change.at, manualPriorityPreserved: true });
});
test("157 preview manual OFF cancels actual owned cushion rest without remote household effects", async ({ page }) => {
  const home = await fixture(page,"preview",true,true); await startProbe(page); await settings(page,true);
  const resting = (frame: Frame | undefined): frame is Frame => Boolean(frame && frame.serial && frame.scene && source(frame) && frame.platform === "companion-home"
    && frame.sofa?.visible && frame.x >= frame.sofa.left && frame.x <= frame.sofa.right && Math.abs(frame.y-frame.sofa.top) <= 3
    && (frame.state === "sleep" && [10,11,12,35,36,40].some(row=>companionSpriteMetadata.rows[row].includes(frame.pose))
      || frame.state === "play" && ["cozy-nest","doze-curl"].includes(frame.play)
        && COMPANION_PLAY_TIMING[frame.play as "cozy-nest"|"doze-curl"].beats.some(beat=>companionSpriteMetadata.rows[beat.row].includes(frame.pose))));
  await expect.poll(async () => resting((await read(page)).at(-1)), { timeout: 90_000, intervals: [100] }).toBe(true);
  const cancelled = (await read(page)).at(-1)!; expect(resting(cancelled)).toBe(true);
  const light = await home.locator(".vc-home-lamp").getAttribute("aria-pressed"), tv = await home.locator(".vc-home-room").getAttribute("data-tv");
  expect(["true","false"]).toContain(light); expect(["off","tori","nature","cooking","toys","moon"]).toContain(tv);
  const durableLight=await page.evaluate(key=>localStorage.getItem(key),COMPANION_HOME_LIGHT_KEY);
  expect(parseCompanionHomeLight(durableLight)).toBe(light==="true");
  await settings(page,false,true,false); await expect(page.locator(".vc-companion")).toBeHidden();
  // Master OFF intentionally unmounts the entire actor and house. Observe
  // the real durable light and shared-home change channel while absent;
  // missing DOM is never silently interpreted as an OFF control value.
  await expect(home).toHaveCount(0); await expect(page.locator(".vc-companion")).toHaveCount(0);
  await page.evaluate(()=>{
    const scope=window as ProbeWindow;scope.restOff157?.stop();const events:number[]=[];
    const changed=()=>events.push(performance.now());window.addEventListener("vic:companion-home",changed);
    scope.restOff157={events,stop(){window.removeEventListener("vic:companion-home",changed);}};
  });
  const offBegan=await page.evaluate(()=>performance.now());
  await page.waitForTimeout(2200);
  const offProof=await page.evaluate(key=>{
    const scope=window as ProbeWindow,audit=scope.restOff157;audit?.stop();
    const preferences=JSON.parse(localStorage.getItem("vic.viewerCompanion")??"{}");
    return {ended:performance.now(),events:audit?.events??null,lightRaw:localStorage.getItem(key),enabled:preferences.enabled,
      actorPresent:Boolean(document.querySelector(".vc-companion")),homePresent:Boolean(document.querySelector(".vc-home"))};
  },COMPANION_HOME_LIGHT_KEY);
  expect(offProof.ended-offBegan).toBeGreaterThanOrEqual(2200);expect(offProof.events).toEqual([]);
  expect(offProof.enabled).toBe(false);expect(offProof.actorPresent).toBe(false);expect(offProof.homePresent).toBe(false);
  expect(offProof.lightRaw).toBe(durableLight);
  // Reopen through the existing global settings route, park autonomy while
  // still disabled, then inspect the actual session TV on a real remount.
  await page.getByRole("button",{name:"설정",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"설정",exact:true});
  await dialog.getByRole("tab",{name:"빅타민",exact:true}).click();
  await dialog.getByRole("tablist",{name:"빅타민 프로필",exact:true}).getByRole("tab",{name:"환경설정",exact:true}).click();
  await expect(dialog.locator('[data-act="companion-enabled"]')).not.toBeChecked();
  await dialog.getByRole("tablist",{name:"빅타민 설정",exact:true}).getByRole("tab",{name:"움직임",exact:true}).click();
  await dialog.locator('[data-act="companion-roam"]').setChecked(false);await dialog.locator('[data-act="companion-sleep"]').setChecked(false);
  await expect(page.locator(".vc-companion")).toHaveCount(0);
  await dialog.locator('[data-act="companion-enabled"]').setChecked(true);
  const restoredPreferences=await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem("vic.viewerCompanion")??"{}");return {enabled:p.enabled,roam:p.roam,sleep:p.sleep};});
  expect(restoredPreferences).toEqual({enabled:true,roam:false,sleep:false});
  await dialog.getByRole("button",{name:"닫기",exact:true}).click();await expect(dialog).toBeHidden();
  const restoredHome=await openCompanionHome(page);
  await expect(restoredHome.locator(".vc-home-lamp")).toHaveAttribute("aria-pressed",light!);
  await expect(restoredHome.locator(".vc-home-room")).toHaveAttribute("data-tv",tv!);
  records.get(page)!.notes.push({ actualManualMasterOff: true, cancelledActualOwner: { scene: cancelled.scene, serial: cancelled.serial, beat: cancelled.beat, state: cancelled.state, play: cancelled.play, at: cancelled.at, sourcePose: cancelled.pose },
    actualBodyOnVisibleCushion: true, postOffLight: light, postOffTv: tv,offBegan,offProof,
    actualNativeRemountWithAutonomyOff:restoredPreferences,noFullSleepClaimForCancelledGoal: true });
});
