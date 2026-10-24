import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { guardCompanionQa } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { companionTraceMode } from "./helpers/companion-evidence-policy";

test.use({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block", trace: companionTraceMode(), video: "on" });
test.setTimeout(45000);
const dialog = (page: Page) => page.getByRole("dialog", { name: "검색", exact: true });
const input = (page: Page) => dialog(page).getByRole("searchbox", { name: "검색어", exact: true });
async function open(page: Page) {
  await settlePanelLayout(page);
  const search = page.getByRole("button", { name: "검색", exact: true }).first();
  const expand = page.getByRole("button", { name: "패널 펼치기", exact: true });
  const box = await search.isVisible() ? await search.boundingBox() : null, viewport = page.viewportSize()!;
  const inView = box && box.x+box.width>0 && box.y+box.height>0 && box.x<viewport.width && box.y<viewport.height;
  if (!inView && await expand.isVisible()) {
    await expand.click(); await settlePanelLayout(page);
  }
  await search.click();
  await expect(input(page)).toBeVisible();
}
async function setup(page: Page, context: BrowserContext, baseURL: string) {
  const proof = await guardCompanionQa(page, context, baseURL);
  const requests: string[] = [];
  const policy = { fail: false, slow: false, saved: false, removeSelected: false, suggest: false };
  await context.route("**/api/public/*/search**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== new URL(baseURL).origin || request.method() !== "GET") return route.fallback();
    if (url.pathname.endsWith("/search/trending")) return route.fulfill({ json: { trends: [] } });
    if (url.pathname.endsWith("/search/suggest")) return route.fulfill({ json: { items: policy.suggest ? [{ term: "제안검색", kind: "term", weight: 1 }] : [] } });
    if (!url.pathname.endsWith("/search")) return route.fallback();
    const q = url.searchParams.get("q") ?? ""; requests.push(q);
    if (policy.fail) return route.fulfill({ status: 503, json: {} });
    if (policy.slow && q === "느린검색") await new Promise(resolve => setTimeout(resolve, 650));
    await route.fulfill({ json: { query: q, hits: Array.from({ length: 28 }, (_, i) => ({ kind: "event", eventId: i === 0 ? "evt-001" : `synthetic-${i}`,
      dateKey: `2026-06-${String(i+1).padStart(2,"0")}`, startTime: "20:00", title: `${q} ${policy.saved ? "갱신" : "결과"} ${i+1}`,
      snippet: "합성 공개 일정", score: policy.saved && i === 5 ? .1 : 1-i/100, exact: true, popularity: .5 })).filter(hit => !policy.removeSelected || hit.eventId !== "synthetic-5") } });
  });
  await page.addInitScript(({ epoch, key }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false }));
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.gfxPref", "off");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
  return { proof, requests, policy };
}
async function clean(proof: Awaited<ReturnType<typeof guardCompanionQa>>) {
  await Promise.all(proof.pending);
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.mutations).toEqual([]);
}
for (const surface of ["viewer", "studio", "preview"] as const) {
  test(`search return ${surface}: keeps query results sort selection scroll and clears on explicit clear or reload`, async ({ page, context, baseURL }, info) => {
    const { proof, requests } = await setup(page,context,baseURL!);
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : `/visual-fixture/studio?role=owner&y=2026&m=6${surface === "preview" ? "&viewer=1" : ""}`);
    await settlePanelLayout(page); await open(page);
    await input(page).fill("픽크타"); await input(page).press("Enter");
    await expect(dialog(page).locator(".ps-event")).toHaveCount(28);
    await dialog(page).locator('[data-sort="oldest"]').click();
    const list = dialog(page).locator(".ps-body");
    await list.evaluate(el => { el.scrollTop = 640; el.dispatchEvent(new Event("scroll")); });
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(500);
    const visibleIndex = await list.evaluate(body => {
      const area = body.getBoundingClientRect();
      return [...body.querySelectorAll(".ps-event")].findIndex(row => { const r=row.getBoundingClientRect(); return r.top>=area.top+24 && r.bottom<=area.bottom-12; });
    });
    expect(visibleIndex).toBeGreaterThanOrEqual(0);
    const visible = dialog(page).locator(".ps-event").nth(visibleIndex);
    await visible.click({ trial: true });
    const selectedText = await visible.innerText();
    const beforePick = list.evaluate(body => new Promise<number>(resolve => {
      body.addEventListener("click", () => resolve(body.scrollTop), { once: true, capture: true });
    }));
    await visible.click(); await expect(dialog(page)).toHaveCount(0);
    const before = await beforePick;
    await page.keyboard.press("Escape"); await open(page);
    await expect(input(page)).toHaveValue("픽크타"); await expect(dialog(page).locator(".ps-event")).toHaveCount(28);
    await expect(dialog(page).locator('[data-sort="oldest"]')).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => dialog(page).locator(".ps-body").evaluate(el => el.scrollTop).then(top => Math.abs(top-before))).toBeLessThan(3);
    await expect(dialog(page).locator(".ps-event.is-cursor")).toHaveCount(1);
    await expect(dialog(page).locator(".ps-event.is-cursor")).toHaveText(selectedText, { useInnerText: true });
    expect(requests).toHaveLength(1);
    await info.attach("restored-search", { body: await page.screenshot(), contentType: "image/png" });
    await info.attach("search-return-values", { body: JSON.stringify({ surface, before, after: await dialog(page).locator(".ps-body").evaluate(el => el.scrollTop), queries: requests.length, synthetic: true }), contentType: "application/json" });
    const storage = await page.evaluate(() => JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));
    expect(storage).not.toContain("픽크타"); expect(page.url()).not.toContain(encodeURIComponent("픽크타"));
    await dialog(page).getByRole("button", { name: "지우기", exact: true }).click();
    await expect(input(page)).toHaveValue(""); await expect(dialog(page).locator(".ps-event")).toHaveCount(0);
    const studioPanel = surface === "studio" ? await page.locator(".ppc-toggle").getAttribute("aria-pressed") : null;
    await page.keyboard.press("Escape"); await expect(dialog(page)).toHaveCount(0);
    if (studioPanel !== null) await expect(page.locator(".ppc-toggle")).toHaveAttribute("aria-pressed", studioPanel);
    await open(page); await expect(input(page)).toHaveValue("");
    await input(page).fill("새검색"); await input(page).press("Enter"); await expect(dialog(page).locator(".ps-event")).toHaveCount(28);
    await page.reload(); await settlePanelLayout(page); await open(page); await expect(input(page)).toHaveValue("");
    await clean(proof);
  });
}
test("search return: repeated term retry survives a failed refresh and superseded responses never win", async ({ page, context, baseURL }) => {
  const { proof, requests, policy } = await setup(page,context,baseURL!);
  await page.goto("/visual-fixture/poster"); await settlePanelLayout(page); await open(page);
  await input(page).fill("같은검색"); await input(page).press("Enter"); await expect(dialog(page).locator(".ps-event")).toHaveCount(28);
  policy.fail = true; await input(page).press("Enter"); await expect.poll(() => requests.length).toBe(2);
  await expect(dialog(page).locator(".ps-fail")).toBeVisible();
  policy.fail = false; await input(page).press("Enter"); await expect.poll(() => requests.length).toBe(3);
  await expect(dialog(page).locator(".ps-fail")).toHaveCount(0);
  policy.slow = true; await input(page).fill("느린검색"); await input(page).press("Enter"); await expect.poll(() => requests.length).toBe(4);
  await input(page).fill("마지막검색"); await input(page).press("Enter");
  await expect(dialog(page).locator(".ps-event").first()).toContainText("마지막검색");
  await page.waitForTimeout(800); await expect(dialog(page).locator(".ps-event").first()).toContainText("마지막검색");
  await input(page).fill("느린검색"); await input(page).press("Enter");
  await dialog(page).getByRole("button", { name: "지우기", exact: true }).click();
  await page.waitForTimeout(800); await expect(input(page)).toHaveValue(""); await expect(dialog(page).locator(".ps-event")).toHaveCount(0);
  await input(page).fill("느린검색"); await input(page).press("Enter");
  await expect.poll(() => requests.at(-1)).toBe("느린검색");
  await page.keyboard.press("Escape"); await open(page);
  await expect(input(page)).toHaveValue("느린검색");
  await expect(dialog(page).locator(".ps-event").first()).toContainText("느린검색");
  policy.suggest = true;
  await input(page).fill("제안");
  await expect(dialog(page).getByRole("listbox", { name: "검색어 제안" })).toBeVisible();
  await input(page).press("Escape");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("listbox", { name: "검색어 제안" })).toHaveCount(0);
  await input(page).press("Escape"); await expect(dialog(page)).toHaveCount(0);
  await clean(proof);
});
test("search return studio: intercepted save refreshes cached results and preserves position", async ({ page, context, baseURL }, info) => {
  const { proof, requests, policy } = await setup(page,context,baseURL!);
  const syntheticWrites: string[] = [];
  await context.route("**/api/studio-write", route => {
    const request = route.request();
    if (new URL(request.url()).origin !== new URL(baseURL!).origin || request.method() !== "POST") return route.fallback();
    const body = request.postDataJSON();
    if (body.op !== "save" || body.payload?.visibilityScope !== "public") return route.fallback();
    syntheticWrites.push("local-fixture-save"); policy.saved = true;
    return route.fulfill({ json: { ok: true, id: "evt-001" } });
  });
  await page.goto("/visual-fixture/studio?role=owner&y=2026&m=6"); await settlePanelLayout(page); await open(page);
  await input(page).fill("갱신검색"); await input(page).press("Enter"); await expect(dialog(page).locator(".ps-event")).toHaveCount(28);
  await dialog(page).locator('[data-sort="relevance"]').click();
  await dialog(page).locator(".ps-body").evaluate(el => { el.scrollTop = 320; el.dispatchEvent(new Event("scroll")); });
  const selected = dialog(page).locator(".ps-event").filter({ hasText: "갱신검색 결과 6" });
  await selected.click({ trial: true });
  const beforeSavePick = dialog(page).locator(".ps-body").evaluate(body => new Promise<number>(resolve => {
    body.addEventListener("click", () => resolve(body.scrollTop), { once: true, capture: true });
  }));
  await selected.click();
  const beforeSave = await beforeSavePick;
  await page.locator('[role="textbox"], textarea, input[type="text"]').first().fill("합성 수정 일정");
  await page.keyboard.press("Control+Enter"); await expect.poll(() => syntheticWrites.length).toBeGreaterThan(0);
  await page.keyboard.press("Escape"); await open(page);
  await expect(input(page)).toHaveValue("갱신검색"); await expect(dialog(page).locator(".ps-event").first()).toContainText("갱신");
  expect(requests.length).toBeGreaterThanOrEqual(2);
  await expect(dialog(page).locator(".ps-event.is-cursor")).toContainText("갱신검색 갱신 6");
  await expect.poll(() => dialog(page).locator(".ps-body").evaluate(el => el.scrollTop).then(top => Math.abs(top-beforeSave))).toBeLessThan(3);
  policy.removeSelected = true;
  await dialog(page).locator(".ps-event.is-cursor").click();
  await page.locator('[role="textbox"], textarea, input[type="text"]').first().fill("합성 수정 두 번째");
  await page.keyboard.press("Control+Enter"); await expect.poll(() => syntheticWrites.length).toBeGreaterThan(1);
  await page.keyboard.press("Escape"); await open(page);
  await expect(dialog(page).locator(".ps-event")).toHaveCount(27);
  await expect(dialog(page).locator(".ps-event.is-cursor")).toHaveCount(0);
  await info.attach("synthetic-save-scope", { body: JSON.stringify({ syntheticWrites, operationalWrites: 0 }), contentType: "application/json" });
  await clean(proof);
});
