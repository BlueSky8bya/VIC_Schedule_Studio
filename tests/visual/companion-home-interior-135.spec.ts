import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const out = process.env.COMPANION135_INTERIOR_OUTPUT ?? ".scratch-pw/companion-135/interior";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const proofs = new WeakMap<Page, { errors: string[]; writes: string[]; foreign: string[] }>();
test.use({ serviceWorkers: "block", viewport: { width: 1920, height: 1100 } });
test.setTimeout(90000);

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin, proof = { errors: [] as string[], writes: [] as string[], foreign: [] as string[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }) => { const p = proofs.get(page)!; expect(p.errors).toEqual([]); expect(p.writes).toEqual([]); expect(p.foreign).toEqual([]); });

async function fixture(page: Page, surface: "viewer" | "studio", night: boolean, reduced = false, sleep = false) {
  await page.addInitScript(({ prefs, epoch, epochKey, night, reduced, sleep }) => {
    for (const [key, value] of Object.entries({
      [epochKey]: epoch,
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, sleep, sound: false }),
      "vic.gfx": JSON.stringify({ mode: reduced ? "off" : "full", at: Date.now(), v: 3 }),
      "vic.gfxPref": reduced ? "off" : "max", "vic.reduceMotion": reduced ? "on" : "off", "vic.dark": night ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left",
    })) localStorage.setItem(key, value);
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, night, reduced, sleep });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1&ambient=autumn"
    : `/visual-fixture/studio?role=owner&y=2025&m=10&ambient=autumn&hour=${night ? 23 : 12}&weather=clear`);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  // Hydration may open the panel before its launcher is consulted. Wait for
  // either real presentation before choosing the native opening path.
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible()
    || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  const home = await openCompanionHome(page);
  await expect.poll(() => home.evaluate(node => {
    for (let p: Element | null = node; p; p = p.parentElement)
      if (p.getAnimations().some(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime)))) return false;
    return true;
  })).toBe(true);
  await home.locator("img").evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  // The resident can naturally sit over the sofa control. Move it with its
  // real keyboard placement before measuring the furniture's own hit areas.
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await actor.focus(); await actor.press("p");
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-placing", "");
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width - 48, viewport.height - 48);
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-placing");
  // Placement commits input state before the next physics paint. Confirm the
  // actual actor rectangle has left the room before hit testing its old seat.
  await expect.poll(async () => {
    const pet = await actor.boundingBox(), room = await home.locator(".vc-home-room").boundingBox();
    return Boolean(pet && room && (pet.x >= room.x + room.width || pet.x + pet.width <= room.x));
  }).toBe(true);
  await page.mouse.move(2, 2); return home;
}

async function geometry(home: Locator) {
  return home.locator(".vc-home-room").evaluate(room => {
    const box = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const painted = (selector: string) => {
      const image = room.querySelector<HTMLImageElement>(selector)!, canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0);
      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (rgba[(y * canvas.width + x) * 4 + 3] > 32) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
      }
      const r = box(image), scale = Math.min(r.width / canvas.width, r.height / canvas.height);
      const x = r.x + (r.width - canvas.width * scale) / 2, y = r.bottom - canvas.height * scale;
      return { x: x + x0 * scale, y: y + y0 * scale, right: x + x1 * scale, bottom: y + y1 * scale };
    };
    const chest = painted(".vc-toy-box > img"), bin = painted(".vc-home-trash > img"), pad = painted(".vc-home-wash-pad > img");
    const expectedPad = { x: (Math.max(chest.x, bin.x) + Math.min(chest.right, bin.right)) / 2, y: (Math.max(chest.y, bin.y) + Math.min(chest.bottom, bin.bottom)) / 2 };
    const controls = [...room.querySelectorAll<HTMLButtonElement>("button[data-home-action]")].filter(node => !node.disabled).map(node => {
      const r = box(node), points = [[r.x + 2, r.y + r.height / 2], [r.right - 2, r.y + r.height / 2], [r.x + r.width / 2, r.y + 2], [r.x + r.width / 2, r.bottom - 2]];
      const hits = points.map(([x, y]) => { const hit = document.elementFromPoint(x, y); return { x, y, own: hit === node || node.contains(hit), tag: hit?.tagName, className: hit?.getAttribute("class"), action: hit?.getAttribute("data-home-action") }; });
      return { action: node.dataset.homeAction!, ...r, hits, hit: hits.every(hit => hit.own) };
    });
    const paintStyle = getComputedStyle(room.querySelector(".vc-home-tv-paint")!);
    const transform = new DOMMatrix().translate(parseFloat(paintStyle.width) / 2, 0).multiply(new DOMMatrix(paintStyle.transform));
    const body = room.querySelector(".vc-home-tv-body")!;
    return { room: box(room), cssWidth: parseFloat(getComputedStyle(room).width), cssHeight: parseFloat(getComputedStyle(room).height),
      controls, chest, bin, pad, expectedPad, tvAngle: Math.atan2(transform.m31, transform.m11) * 180 / Math.PI,
      tv: box(room.querySelector(".vc-home-tv")!), sofa: box(room.querySelector(".vc-cushion-button")!), bodySrc: body.getAttribute("src"),
      floor: box(room.querySelector(".vc-home-floor")!), seat: box(room.querySelector(".vc-home-cushion")!),
      floorLightOpacity: getComputedStyle(room.querySelector(".vc-home-floor")!, "::after").opacity,
      curtainPhase: room.querySelector(".vc-home-window")!.getAttribute("data-curtain"),
      opening: box(room.querySelector(".vc-toy-box-opening")!), outlet: box(room.querySelector(".vc-dispenser-slot")!) };
  });
}

async function save(home: Locator, name: string, data: unknown) {
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/${name}.json`, JSON.stringify(data, null, 2));
  await home.screenshot({ path: `${out}/${name}.png` });
}

for (const [surface, width, night, reduced] of [["viewer", 1440, false, false], ["studio", 1920, true, false], ["studio", 1100, false, true]] as const)
  test(`135 illustrated room keeps physical controls and painted pad midpoint: ${surface} ${width} ${surface === "viewer" ? "current-KST" : night ? "night" : "day"}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    const home = await fixture(page, surface, night, reduced), data = await geometry(home);
    await save(home, `${surface}-${width}-${surface === "viewer" ? "current-kst" : night ? "night" : "day"}`, data);
    expect(data.controls).toHaveLength(8);
    for (const control of data.controls) {
      expect(control.width, control.action).toBeGreaterThanOrEqual(44);
      expect(control.height, control.action).toBeGreaterThanOrEqual(44);
      expect(control.hit, control.action).toBe(true);
    }
    for (let a = 0; a < data.controls.length; a++) for (let b = a + 1; b < data.controls.length; b++) {
      const x = data.controls[a], y = data.controls[b];
      expect(Math.max(0, Math.min(x.right, y.right) - Math.max(x.x, y.x)) * Math.max(0, Math.min(x.bottom, y.bottom) - Math.max(x.y, y.y)), `${x.action}/${y.action} overlap`).toBeLessThan(.5);
    }
    expect(data.tv.x + data.tv.width / 2).toBeGreaterThan(data.sofa.x + data.sofa.width / 2);
    expect(data.tvAngle).toBeCloseTo(-30, 0);
    expect(Math.abs((data.pad.x + data.pad.right) / 2 - data.expectedPad.x)).toBeLessThan(1.5);
    expect(Math.abs((data.pad.y + data.pad.bottom) / 2 - data.expectedPad.y)).toBeLessThan(1.5);
    expect(data.chest.bottom).toBeCloseTo(data.floor.y, 0);
    expect(data.seat.width).toBeGreaterThan(0); expect(data.outlet.width).toBeGreaterThan(0); expect(data.opening.width).toBeGreaterThan(0);
    await expect(home.locator(".vc-window-curtain-stage")).toHaveCount(5);
    if (surface === "studio") {
      await expect(home.locator(".vc-home-room")).toHaveAttribute("data-phase", night ? "night" : "day");
      expect(Number(data.floorLightOpacity)).toBe(night || data.curtainPhase === "closed" ? 0 : data.curtainPhase === "shade" ? .65 : 1);
    }
  });

test("135 native TV cycle and lamp keep one body, registration and quiet feedback", async ({ page }) => {
  const home = await fixture(page, "studio", true, true), room = home.locator(".vc-home-room"), tv = home.locator(".vc-home-tv"), lamp = home.locator(".vc-home-lamp");
  const initial = await geometry(home);
  for (const [index, state] of ["nature", "music", "cooking", "toys", "moon", "off"].entries()) {
    if (index % 2 === 0) await tv.click(); else { await tv.focus(); await tv.press(index === 3 ? "Space" : "Enter"); }
    await expect(room).toHaveAttribute("data-tv", state);
    await expect(home.locator(".vc-home-tv-body")).toHaveAttribute("src", initial.bodySrc!);
    if (state !== "off") await home.locator(".vc-home-tv-screen > img").evaluate(image => (image as HTMLImageElement).decode());
    const current = await geometry(home);
    expect(current.tv).toEqual(initial.tv); expect(current.opening).toEqual(initial.opening); expect(current.outlet).toEqual(initial.outlet); expect(current.seat).toEqual(initial.seat);
  }
  await lamp.click(); await expect(room).toHaveAttribute("data-lamp-lit", "true");
  await expect(home.locator(".vc-home-lamp-light")).toHaveCSS("opacity", "1");
  await save(home, "night-lamp-on", await geometry(home));
  await lamp.focus(); await lamp.press("Space"); await expect(room).not.toHaveAttribute("data-lamp-lit");
  await expect(home.locator(".vc-home-lamp-light")).toHaveCSS("opacity", "0");
  expect((await geometry(home)).seat).toEqual(initial.seat);
  await save(home, "night-lamp-off", await geometry(home));
});

test("135 real daytime nap and wake remove and restore the floor sunlight with the curtain", async ({ page }) => {
  const home = await fixture(page, "studio", false, true, true);
  await expect.poll(async () => Number((await geometry(home)).floorLightOpacity)).toBeGreaterThan(0);
  await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await actor.focus(); await actor.press("n");
  await expect(home.locator(".vc-home-window")).toHaveAttribute("data-curtain", "closed");
  await expect.poll(async () => (await geometry(home)).floorLightOpacity).toBe("0");
  await save(home, "day-curtain-closed", await geometry(home));
  await actor.press("Enter");
  await expect(home.locator(".vc-home-window")).not.toHaveAttribute("data-curtain", "closed");
  await expect.poll(async () => Number((await geometry(home)).floorLightOpacity)).toBeGreaterThan(0);
  await save(home, "day-curtain-awake", await geometry(home));
});
