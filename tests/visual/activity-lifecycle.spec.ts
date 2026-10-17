import { expect, test, type Page } from "@playwright/test";
import { createServer, request as httpRequest, type Server } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Surface = "viewer" | "studio";
type Activity = { kind: string; target?: string; meta?: unknown };
type Batch = { events: Activity[]; sessionPresent: boolean; receivedAt: number; completed: boolean };
type Capture = { batches: Batch[]; logoutAt?: number; errors: string[]; blocked: string[]; delay: number };
const captures = new Map<string, Capture>();
const origin = "http://127.0.0.2:3101";
let server: Server;

// A real local HTTP collector survives closing the page. Only fixture/asset
// GETs reach the production build. Every API and mutation terminates here,
// including logout; the cookie is a synthetic ordering marker, never auth.
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", origin);
    const cookie = req.headers.cookie ?? "";
    const id = cookie.match(/(?:^|; )lifecycle_case=([^;]+)/)?.[1] ?? "";
    const capture = captures.get(id);
    if (req.method === "GET" && ["/_vercel/insights/script.js", "/_vercel/speed-insights/script.js"].includes(url.pathname)) {
      res.writeHead(200, { "content-type": "application/javascript" }).end("/* local analytics stub */"); return;
    }
    if (url.pathname === "/api/activity" && req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", () => {
        if (!capture) { res.writeHead(400).end(); return; }
        const payload = JSON.parse(Buffer.concat(chunks).toString()) as { events?: Activity[] };
        const batch: Batch = { events: payload.events ?? [], sessionPresent: /(?:^|; )lifecycle_session=present(?:;|$)/.test(cookie), receivedAt: Date.now(), completed: false };
        capture.batches.push(batch);
        setTimeout(() => { batch.completed = true; res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, saved: batch.events.length })); }, capture.delay);
      });
      return;
    }
    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      if (capture) capture.logoutAt = Date.now();
      res.writeHead(303, { location: "/lifecycle-destination", "set-cookie": "lifecycle_session=; Path=/; Max-Age=0", "cache-control": "no-store" }).end(); return;
    }
    if (url.pathname.startsWith("/api/")) {
      if (["/api/visit", "/api/presence", "/api/visit-session", "/api/visit-ping"].includes(url.pathname)) {
        res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true,"skipped":true}'); return;
      }
      if (url.pathname === "/api/soop-live") { res.writeHead(200, { "content-type": "application/json" }).end('{"live":false}'); return; }
      capture?.blocked.push(`${req.method} ${url.pathname}`);
      res.writeHead(500).end("blocked fixture API"); return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      capture?.blocked.push(`${req.method} ${url.pathname}`); res.writeHead(500).end("blocked fixture mutation"); return;
    }
    if (url.pathname === "/lifecycle-destination") { res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><title>Local lifecycle destination</title><p>Local destination</p>"); return; }
    const fixture = ["/visual-fixture/poster", "/visual-fixture/studio"].includes(url.pathname);
    const asset = ["/_next/static/", "/ambient/", "/companion/", "/premiere/", "/celebrate/"].some(prefix => url.pathname.startsWith(prefix));
    if (!fixture && !asset && url.pathname !== "/favicon.ico") {
      capture?.blocked.push(`${req.method} ${url.pathname}`); res.writeHead(404).end("fixture GET allowlist"); return;
    }
    const upstream = httpRequest({ hostname: "127.0.0.1", port: 3100, path: `${url.pathname}${url.search}`, method: req.method, headers: { ...req.headers, host: "127.0.0.1:3100" } }, response => {
      res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res);
    });
    upstream.on("error", () => res.writeHead(502).end("fixture upstream unavailable")); upstream.end();
  });
  await new Promise<void>(resolve => server.listen(3101, "127.0.0.2", resolve));
});
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
test.use({ baseURL: origin, viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", hasTouch: false });

async function setup(page: Page, surface: Surface, id: string, delay = 0) {
  const capture: Capture = { batches: [], errors: [], blocked: [], delay }; captures.set(id, capture);
  page.on("pageerror", error => capture.errors.push(error.message));
  await page.context().route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    capture.blocked.push(`external ${new URL(route.request().url()).origin}`);
    return route.abort();
  });
  await page.context().addCookies([
    { name: "lifecycle_case", value: id, url: origin },
    { name: "lifecycle_session", value: "present", url: origin }
  ]);
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => false });
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false, panelPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .01, energy: 1 } });
  const response = await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1&signedIn=1" : "/visual-fixture/studio?role=developer");
  const expectedBuild = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  expect(await response!.text(), "served fixture must match the selected production build").toContain(expectedBuild);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion .vc-actor")).toBeVisible();
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  // Drain setup only. No synthetic lifecycle event occurs after the final pet.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(() => capture.batches.length).toBeGreaterThan(0);
  capture.batches = [];
  return capture;
}

async function pet(page: Page, input: "keyboard" | "hover") {
  const actor = page.locator(".vc-companion .vc-actor");
  if (input === "keyboard") { await actor.focus(); await actor.press("Enter"); }
  else {
    // Initial geometry can perform a genuine landing despite autonomous
    // roaming being off. Aim only after the actor is eligible for petting.
    await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-state", /^(walk|jump|heart|hide|eat)$/);
    const point = await page.locator(".vc-companion").evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - r.height * .42 }; });
    await page.mouse.move(point.x - 18, point.y);
    await expect(page.locator(".vc-companion")).toHaveAttribute("data-petting", /^(ready|touch|hover)$/);
    for (const x of [point.x + 18, point.x - 18]) await page.mouse.move(x, point.y, { steps: 6 });
  }
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "petted");
  await page.mouse.move(4, 4);
}
const petBatches = (capture: Capture) => capture.batches.filter(batch => batch.events.some(event => event.target === "companion-pet"));
async function verify(capture: Capture, id: string) {
  await expect.poll(() => petBatches(capture).flatMap(batch => batch.events).filter(event => event.target === "companion-pet").length).toBe(1);
  await expect.poll(() => petBatches(capture).every(batch => batch.completed)).toBe(true);
  // A settled window catches duplicate sends from overlapping lifecycle events.
  await new Promise(resolve => setTimeout(resolve, 200));
  expect(petBatches(capture).flatMap(batch => batch.events).filter(event => event.target === "companion-pet")).toEqual([{ kind: "ui.click", target: "companion-pet", meta: null, durMs: null, visitKey: expect.anything() }]);
  expect(capture.errors).toEqual([]); expect(capture.blocked).toEqual([]);
  mkdirSync(".scratch-pw", { recursive: true });
  writeFileSync(`.scratch-pw/activity-lifecycle-${id}.json`, JSON.stringify({ buildId: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), capture }, null, 2));
}

for (const surface of ["viewer", "studio"] as const) {
  for (const input of ["keyboard", "hover"] as const) {
    for (const transition of ["reload", "navigation", "tab-close", "logout", "delayed-reload"] as const) {
      test(`${surface} ${input} final pet survives ${transition} exactly once`, async ({ page }) => {
        const id = `${surface}-${input}-${transition}`;
        const capture = await setup(page, surface, id, transition === "delayed-reload" ? 1800 : 0);
        await pet(page, input);
        expect(petBatches(capture)).toHaveLength(0);
        if (transition === "reload" || transition === "delayed-reload") await page.reload();
        else if (transition === "navigation") await page.goto("/lifecycle-destination");
        else if (transition === "tab-close") await page.close({ runBeforeUnload: true });
        else {
          const logout = page.locator(`[data-act="${surface === "studio" ? "io-logout" : "logout"}"]`).filter({ visible: true }).last();
          await logout.click(); await page.waitForURL("**/lifecycle-destination");
        }
        await verify(capture, id);
        if (transition === "logout") {
          expect(capture.logoutAt).toBeDefined();
          expect(petBatches(capture)[0].sessionPresent, "pet request must capture the synthetic pre-logout cookie").toBe(true);
        }
      });
    }
  }
}
