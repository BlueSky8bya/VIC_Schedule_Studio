import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const output = process.env.GLOBAL_NOT_FOUND_125_OUTPUT ?? ".scratch-pw/companion-125/global-404";
type Proof = { build: string; writes: string[]; foreign: string[]; browserAPIs: string[]; errors: string[]; checks: Record<string, unknown>[] };
const proofs = new WeakMap<Page, Proof>();
const build = () => readFileSync(resolve(".next/BUILD_ID"), "utf8").trim();
test.use({ serviceWorkers: "block", storageState: { cookies: [], origins: [] } });
test.setTimeout(45000);

test.beforeEach(async ({ page, baseURL }) => {
  // This suite must never probe a deployed service or an authenticated profile.
  expect(baseURL).toBeTruthy();
  const origin = new URL(baseURL!).origin;
  expect(["127.0.0.1", "localhost"]).toContain(new URL(origin).hostname);
  expect(await page.context().cookies()).toEqual([]);
  const proof: Proof = { build: build(), writes: [], foreign: [], browserAPIs: [], errors: [], checks: [] };
  proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) {
      proof.browserAPIs.push(url.pathname);
      return route.fulfill({ status: 503, body: "No background API in a standalone404" });
    }
    return route.continue();
  });
});

test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  mkdirSync(output, { recursive: true });
  const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  const file = resolve(output, name + ".json");
  writeFileSync(file, JSON.stringify({ ...proof, afterBuild: build(), status: info.status, scope: "Local production build. Fresh anonymous browser and read-only local API requests; no server-auth trace or measured Fluid saving claim." }, null, 2));
  await info.attach("global-404-125", { path: file, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(build()).toBe(proof.build);
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]);
  expect(proof.browserAPIs).toEqual([]); expect(proof.errors).toEqual([]);
});

for (const variant of [
  { name: "light-desktop", colorScheme: "light" as const, width: 1200, height: 900, path: "/__missing_125_readonly" },
  { name: "dark-narrow", colorScheme: "dark" as const, width: 360, height: 800, path: "/studio/__missing_125_readonly" }
]) {
  test(`125 global404 ${variant.name} has a native404 and no application tail`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.emulateMedia({ colorScheme: variant.colorScheme });
    const response = await page.goto(variant.path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없어요", exact: true })).toBeVisible();
    await expect(page.getByText("주소가 바뀌었거나 없는 페이지입니다.", { exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute("content", /noindex/);
    const home = page.getByRole("link", { name: "홈으로", exact: true });
    await expect(home).toHaveAttribute("href", "/");
    await expect(home).toHaveAttribute("data-act", "not-found-home");
    await page.bringToFront(); await page.keyboard.press("Tab");
    await expect(home).toBeFocused();
    const rect = await home.boundingBox();
    expect(rect?.width).toBeGreaterThanOrEqual(44); expect(rect?.height).toBeGreaterThanOrEqual(44);
    await page.waitForLoadState("networkidle");
    const html = await response!.text();
    expect(html).not.toMatch(/ActorTail|PresenceBeacon|ServiceWorkerRegister|accountEmail|hasUnlockSession|owner_private|platform_admins/);
    const observed = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      applicationStorage: ["vic:visitKey", "vic:anonId:v1", "vic:swIdentity"].filter(key => localStorage.getItem(key) || sessionStorage.getItem(key)),
      applicationDOM: document.querySelectorAll(".studio-shell,.public-poster,.vc-companion,[data-companion-home]").length
    }));
    expect(observed.overflow).toBe(false);
    expect(observed.colorScheme).toBe(variant.colorScheme);
    expect(observed.applicationStorage).toEqual([]); expect(observed.applicationDOM).toBe(0);
    proofs.get(page)!.checks.push({ path: variant.path, status: response!.status(), htmlBytes: Buffer.byteLength(html), observed, home: rect });
  });
}

test("125 global404 keeps valid dynamic public and unauthorized routes intact", async ({ page, baseURL }) => {
  // APIRequestContext performs these explicit GETs against the existing local
  // server. The browser route guard above blocks any unsolicited page API.
  const clock = await page.request.get(new URL("/api/public/clock", baseURL).href);
  expect(clock.status()).toBe(200);
  expect(clock.headers()["cache-control"]).toContain("no-store");
  const clockBody = await clock.json();
  expect(Object.keys(clockBody)).toEqual(["serverMs"]); expect(Number.isFinite(clockBody.serverMs)).toBe(true);
  const denied = await page.request.get(new URL("/api/developer/presence", baseURL).href);
  expect(denied.status()).toBe(401);
  expect(denied.headers()["cache-control"]).toContain("no-store");
  expect(denied.headers().vary).toContain("Cookie");
  expect(await denied.json()).toEqual({ error: "unauthorized" });
  proofs.get(page)!.checks.push({ publicClock: clock.status(), protectedPresence: denied.status(), actorCookieCount: (await page.context().cookies()).length });
});
