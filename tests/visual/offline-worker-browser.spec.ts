import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createServer, type Server, type ServerResponse } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

// Isolated synthetic origin: no Next server, app environment, credentials or DB.
const source = readFileSync("public/sw.js", "utf8");
const key = "/__offline_snapshot";
type RequestProof = { path: string; navigation: boolean; cookie: boolean };
let server: Server, origin: string;
let version = "public-one", hold = false;
let pending: ServerResponse[] = [], requests: RequestProof[] = [], aborted = 0;

test.use({ serviceWorkers: "allow", viewport: { width: 900, height: 600 } });
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url!, "http://fixture.invalid").pathname;
    const navigation = req.headers["sec-fetch-dest"] === "document";
    requests.push({ path, navigation, cookie: Boolean(req.headers.cookie) });
    if (path === "/sw.js") { res.writeHead(200, { "content-type": "application/javascript", "cache-control": "no-store" }); res.end(source); return; }
    if (path.startsWith("/_next/static/")) { res.writeHead(200, { "content-type": "application/javascript", "cache-control": "no-store" }); res.end("window.syntheticChunkReady = true;"); return; }
    if (path === "/") {
      if (!navigation && hold) {
        pending.push(res); res.on("close", () => { if (!res.writableEnded) aborted++; }); return;
      }
      res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
      res.end(`<!doctype html><title>PUBLIC synthetic fixture</title><h1>${version}</h1><script src="/_next/static/synthetic-a.js"></script><script src="/_next/static/synthetic-b.js"></script>`); return;
    }
    res.writeHead(404); res.end("synthetic fixture only");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No synthetic fixture port");
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { pending.forEach(res => res.destroy()); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
test.beforeEach(async ({ context }) => {
  pending.forEach(res => res.destroy()); pending = []; requests = []; aborted = 0; version = "public-one"; hold = false;
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort("blockedbyclient"));
});
test.afterEach(async ({ page }, info) => {
  mkdirSync(".scratch-pw", { recursive: true });
  writeFileSync(`.scratch-pw/platform-080-sw-browser-${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify({ requests, aborted, version, synthetic: true }, null, 2));
  // The only recorded cookie field is a boolean. Its value is never captured.
  await page.screenshot({ path: `.scratch-pw/platform-080-sw-browser-${info.title.replace(/[^a-z0-9]+/gi, "-")}.png` });
});

const snapshots = () => requests.filter(req => req.path === "/" && !req.navigation);
async function cached(page: Page): Promise<string | null> {
  return page.evaluate(async snapshotKey => {
    const names = await caches.keys();
    for (const name of names) { const response = await (await caches.open(name)).match(snapshotKey); if (response) return response.text(); }
    return null;
  }, key);
}
async function send(page: Page, type: string, refresh = false) {
  await page.evaluate(async data => { const registration = await navigator.serviceWorker.ready; registration.active!.postMessage(data); }, { type, refresh });
}
async function register(page: Page, context: BrowserContext) {
  await context.addCookies([{ name: "synthetic_worker_canary", value: "NOT_A_REAL_SESSION", url: origin }]);
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
  });
}

test("native credentials omission and persisted freshness survive a real worker restart", async ({ page, context }) => {
  const session = await context.newCDPSession(page);
  const versions = new Map<string, { versionId: string; runningStatus: string; status: string; scriptURL: string }>();
  session.on("ServiceWorker.workerVersionUpdated", ({ versions: updates }) => { for (const item of updates) versions.set(item.versionId, item); });
  await session.send("ServiceWorker.enable");
  await register(page, context);
  await expect.poll(() => cached(page)).toContain("public-one");
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open("vic-offline-v7");
    return (await cache.keys()).filter(request => request.url.includes("/_next/static/")).length;
  })).toBe(2);
  expect(requests.find(req => req.path === "/" && req.navigation)?.cookie).toBe(true);
  expect(snapshots()).toHaveLength(1); expect(snapshots()[0].cookie).toBe(false);
  await expect.poll(() => [...versions.values()].find(item => item.scriptURL === `${origin}/sw.js` && item.runningStatus === "running")?.versionId).toBeTruthy();
  const worker = [...versions.values()].find(item => item.scriptURL === `${origin}/sw.js` && item.runningStatus === "running")!;
  await session.send("ServiceWorker.stopWorker", { versionId: worker.versionId });
  await expect.poll(() => versions.get(worker.versionId)?.runningStatus).toBe("stopped");
  await send(page, "vic-refresh-snapshot");
  await expect.poll(() => versions.get(worker.versionId)?.runningStatus).toBe("running");
  // Native message has restarted the worker. Observe a real one-second window;
  // an in-memory timestamp cannot survive the stop/restart above.
  await page.waitForTimeout(1000);
  expect(snapshots()).toHaveLength(1); expect(await cached(page)).toContain("public-one");
});

test("native clear remains empty and identity clear refills a new anonymous snapshot", async ({ page, context }) => {
  await register(page, context);
  await expect.poll(() => cached(page)).toContain("public-one");
  await send(page, "vic-clear-cache"); await expect.poll(() => cached(page)).toBeNull();
  await page.waitForTimeout(250); expect(await cached(page)).toBeNull(); expect(snapshots()).toHaveLength(1);
  version = "public-two";
  await send(page, "vic-clear-cache", true);
  await expect.poll(() => cached(page)).toContain("public-two");
  expect(snapshots()).toHaveLength(2); expect(snapshots().every(req => !req.cookie)).toBe(true);
});

test("native clear aborts an old pending HTTP snapshot before the requested refill", async ({ page, context }) => {
  hold = true;
  await register(page, context);
  await expect.poll(() => pending.length).toBe(1);
  expect(await cached(page)).toBeNull();
  version = "public-after-abort"; hold = false;
  await send(page, "vic-clear-cache", true);
  await expect.poll(() => aborted).toBe(1);
  await expect.poll(() => cached(page)).toContain("public-after-abort");
  expect(snapshots()).toHaveLength(2); expect(snapshots().every(req => !req.cookie)).toBe(true);
  // A late server completion has no live socket and cannot replace the cache.
  pending[0].end("old held response");
  await page.waitForTimeout(250); expect(await cached(page)).toContain("public-after-abort");
});
