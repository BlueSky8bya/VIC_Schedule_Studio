import { test, expect, type Page, type BrowserContext, type TestInfo } from "@playwright/test";
import { guardCompanionQa } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { companionTraceMode } from "./helpers/companion-evidence-policy";

test.use({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block", video: "on", trace: companionTraceMode() });
test.setTimeout(50000);
const replay = (page: Page) => page.getByRole("dialog", { name: "다시보기", exact: true });
const heading = (page: Page) => page.locator("h1").first();
async function setup(page: Page, context: BrowserContext, base: string) {
  const proof = await guardCompanionQa(page, context, base);
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false }));
    for (const key of ["vic.ambient", "vic.sound", "vic.gfxPref"]) localStorage.setItem(key, "off");
  });
  let reads = 0, release: (() => void) | undefined;
  const policy = { mode: "valid", held: false, event: false };
  await context.route("**/api/public/*/**", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base || req.method() !== "GET") return route.fallback();
    if (url.pathname.endsWith("/search/trending")) return route.fulfill({ json: { trends: [] } });
    if (url.pathname.endsWith("/search/suggest")) return route.fulfill({ json: { items: [] } });
    if (url.pathname.endsWith("/search")) return route.fulfill({ json: { query: "합성", hits: [1,2].map(i => ({ kind: "vod", dateKey: "2026-06-01", titleNo: 900000000+i,
      title: `합성 다시보기 ${i}`, snippet: "", durationMs: 3600000, score: 1, exact: true, popularity: 0,
      ...(policy.event ? { kind: "event", eventId: `synthetic-${i}`, startTime: "20:00" } : {}) })) } });
    if (url.pathname.endsWith("/events")) {
      reads++; const mode = policy.mode;
      if (policy.held) await new Promise<void>(resolve => { release = resolve; });
      if (mode === "network") return route.abort();
      if (mode === "503") return route.fulfill({ status: 503, json: {} });
      if (mode === "json") return route.fulfill({ contentType: "application/json", body: "invalid-json" });
      return route.fulfill({ json: { vods: mode === "empty" ? [] : (mode === "missing" ? [2] : [1,2]).map(i => ({ dateKey: "2026-06-01", titleNo: 900000000+i, title: `합성 다시보기 ${i}`, durationMs: 3600000 })) } });
    }
    return route.fallback();
  });
  return { proof, policy, reads: () => reads, release: () => { release?.(); policy.held = false; } };
}
async function search(page: Page) {
  await settlePanelLayout(page);
  const button = page.getByRole("button", { name: "검색", exact: true }).first();
  const box = await button.isVisible() ? await button.boundingBox() : null, vp = page.viewportSize()!;
  const expand = page.getByRole("button", { name: "패널 펼치기", exact: true });
  if ((!box || box.x+box.width<=0 || box.y+box.height<=0 || box.x>=vp.width || box.y>=vp.height) && await expand.isVisible()) {
    await expand.click(); await settlePanelLayout(page);
  }
  await button.click();
  const dialog = page.getByRole("dialog", { name: "검색", exact: true });
  const input = dialog.getByRole("searchbox", { name: "검색어", exact: true });
  await input.fill("합성"); await input.press("Enter");
  await expect(dialog.locator(".ps-vod-row,.ps-event")).toHaveCount(2); return dialog;
}
async function finish(page: Page, info: TestInfo, proof: Awaited<ReturnType<typeof guardCompanionQa>>, facts: unknown) {
  await Promise.all(proof.pending);
  expect(proof.errors).toEqual([]); expect(proof.mutations).toEqual([]);
  // Real streaming is intentionally blocked. Only window opening is in scope.
  expect(proof.rejected.filter(x => !/^GET https:\/\/vod\.sooplive\.co\.kr\/player\/90000000[12]\/embed$/.test(x))).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0); expect(proof.chunks.every(x => x.served === x.local)).toBe(true);
  await info.attach("actual-ui", { body: await page.screenshot(), contentType: "image/png" });
  await info.attach("observation", { body: JSON.stringify({ facts, proof: { ...proof, pending: undefined }, synthetic: true, fullCertification: false }), contentType: "application/json" });
}
for (const failure of ["503", "network", "json"]) {
  test(`Studio replay retries ${failure} without reload and preserves successful cache`, async ({ page, context, baseURL }, info) => {
    const state = await setup(page, context, baseURL!); state.policy.mode = failure;
    await page.goto("/visual-fixture/studio?role=owner&y=2026&m=6");
    let dialog = await search(page); await dialog.getByRole("button", { name: "다시보기 창 열기" }).first().click();
    await expect(page.getByText("다시보기 정보를 못 불러왔어요. 다시 눌러 주세요", { exact: true })).toBeVisible();
    expect(state.reads()).toBe(1); state.policy.mode = "valid";
    dialog = await search(page); await dialog.getByRole("button", { name: "다시보기 창 열기" }).first().focus(); await page.keyboard.press("Enter");
    await expect(replay(page)).toBeVisible(); expect(state.reads()).toBe(2);
    await replay(page).getByRole("button", { name: "닫기", exact: true }).click();
    dialog = await search(page); await dialog.getByRole("button", { name: "다시보기 창 열기" }).nth(1).click();
    await expect(replay(page)).toBeVisible(); expect(state.reads()).toBe(2);
    await finish(page, info, state.proof, { failure, requests: state.reads(), recoveredWithoutReload: true, cachedSuccess: true, keyboardReplay: true });
  });
}
test("Studio replay caches valid emptiness separately from failure", async ({ page, context, baseURL }, info) => {
  const state = await setup(page, context, baseURL!); state.policy.mode = "empty";
  await page.goto("/visual-fixture/studio?role=developer&y=2026&m=6");
  for (let i=0;i<2;i++) { const dialog = await search(page); await dialog.getByRole("button", { name: "다시보기 창 열기" }).first().click(); await expect(page.getByText("이 날 등록된 다시보기가 없어요", { exact: true })).toBeVisible(); }
  expect(state.reads()).toBe(1); await expect(replay(page)).toHaveCount(0);
  state.policy.mode = "missing"; await page.reload(); const dialog = await search(page);
  await dialog.getByRole("button", { name: "다시보기 창 열기" }).first().click();
  await expect(page.getByText("이 다시보기를 찾지 못했어요", { exact: true })).toBeVisible(); await expect(replay(page)).toHaveCount(0);
  await finish(page, info, state.proof, { successfulEmptyRequests: 1, missingSelectionDidNotOpenOtherVod: true, role: "synthetic-developer" });
});
test("Studio replay pending response follows latest intent and stays closed after reopened search", async ({ page, context, baseURL }, info) => {
  const state = await setup(page, context, baseURL!); state.policy.held = true;
  await page.goto("/visual-fixture/studio?role=owner&y=2026&m=6");
  let dialog = await search(page); await dialog.getByRole("button", { name: "다시보기 창 열기" }).first().click();
  await expect.poll(state.reads).toBe(1);
  dialog = await search(page); await dialog.getByRole("button", { name: "다시보기 창 열기" }).nth(1).click();
  expect(state.reads()).toBe(1); state.release(); await expect(replay(page)).toBeVisible();
  await expect(replay(page).locator(".dvm-title")).toContainText("합성 다시보기 2");
  await finish(page, info, state.proof, { coalescedRequests: state.reads(), latestSelected: 2 });
});
test("Studio replay late failure does not cover a reopened search", async ({ page, context, baseURL }, info) => {
  const state = await setup(page, context, baseURL!); state.policy.held = true; state.policy.mode = "503";
  await page.goto("/visual-fixture/studio?role=owner&y=2026&m=6");
  const dialog = await search(page); await dialog.getByRole("button", { name: "다시보기 창 열기" }).first().click(); await expect.poll(state.reads).toBe(1);
  await search(page); state.release(); await page.waitForTimeout(350);
  await expect(page.getByRole("dialog", { name: "검색", exact: true })).toBeVisible(); await expect(replay(page)).toHaveCount(0);
  await expect(page.getByText("다시보기 정보를 못 불러왔어요. 다시 눌러 주세요", { exact: true })).toHaveCount(0);
  await finish(page, info, state.proof, { staleFailureSuppressed: true });
});
for (const width of [1440, 390]) {
  test(`Public month link ${width}: explicit URL wins cookie and survives navigation reload recipient and overlay back`, async ({ page, context, baseURL }, info) => {
    await page.setViewportSize({ width, height: 1100 });
    const state = await setup(page, context, baseURL!);
    await context.addCookies([{ name: "vic_view", value: encodeURIComponent(JSON.stringify({ sy: 2026, sm: 6 })), url: baseURL! }]);
    await page.goto("/visual-fixture/poster?monthLink=1&month=2026-12&keep=value#calendar");
    await expect(heading(page)).toContainText(/2026년\s*12월/); await settlePanelLayout(page);
    const initialLength = await page.evaluate(() => history.length);
    const originalState = await page.evaluate(() => history.state);
    await page.getByRole("button", { name: "다음 달", exact: true }).first().click();
    await expect(heading(page)).toContainText(/2027년\s*0?1월/); await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2027-01");
    expect(new URL(page.url()).searchParams.get("keep")).toBe("value"); expect(new URL(page.url()).hash).toBe("#calendar");
    expect(await page.evaluate(() => history.length)).toBe(initialLength); expect(await page.evaluate(() => history.state)).toEqual(originalState);
    const copied = page.url(); await page.reload(); await expect(heading(page)).toContainText(/2027년\s*0?1월/);
    const recipient = await context.browser()!.newContext({ viewport: { width, height: 1100 }, serviceWorkers: "block" });
    try { const other = await recipient.newPage(); const otherState = await setup(other, recipient, baseURL!); await other.goto(copied); await expect(heading(other)).toContainText(/2027년\s*0?1월/); await Promise.all(otherState.proof.pending); expect(otherState.proof.errors).toEqual([]); } finally { await recipient.close(); }
    await page.getByRole("button", { name: /기록/ }).first().click(); await expect(page.locator(".pi-sheet")).toBeVisible();
    await page.goBack(); await expect(page.locator(".pi-sheet")).toHaveCount(0); await expect(heading(page)).toContainText(/2027년\s*0?1월/);
    expect(page.url()).toBe(copied);
    await page.getByRole("button", { name: "다음 달", exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2027-02");
    await page.getByRole("button", { name: /기록/ }).first().click(); await expect(page.locator(".pi-sheet")).toBeVisible();
    await page.locator(".pi-close").click(); await expect(page.locator(".pi-sheet")).toHaveCount(0); await page.waitForTimeout(150);
    await page.getByRole("button", { name: "다음 달", exact: true }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2027-03");
    await finish(page, info, state.proof, { width, copied, historyStatePreserved: true, sameMonthRecipient: true, overlayBackAndXThenNext: true });
  });
}
test("Public month URL changes for picker today and search while embedded preview URL stays unchanged", async ({ page, context, baseURL }, info) => {
  const state = await setup(page, context, baseURL!);
  await page.goto("/visual-fixture/poster?monthLink=1&month=2026-06");
  await page.locator(".month-title-btn").first().click();
  await page.getByRole("button", { name: "2026년 12월", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-12");
  state.policy.event = true;
  const dialog = await search(page); await dialog.locator(".ps-event").first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe("2026-06");
  await page.keyboard.press("Escape"); await page.keyboard.press("t");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(new Date());
  await expect.poll(() => new URL(page.url()).searchParams.get("month")).toBe(today);
  await page.goto("/visual-fixture/studio?role=owner&y=2026&m=6&viewer=1"); const embeddedUrl = page.url();
  await page.getByRole("button", { name: "다음 달", exact: true }).first().click(); await expect(heading(page)).toContainText(/2026년\s*0?7월/);
  expect(page.url()).toBe(embeddedUrl);
  await finish(page, info, state.proof, { picker: true, searchMonth: true, todayKst: today, embeddedUrlUnchanged: true });
});
test("Public month link bounds and duplicate input keep URL view cookie and picker consistent", async ({ page, context, baseURL }, info) => {
  const state = await setup(page, context, baseURL!);
  for (const edge of [{ month: "1000-01", year: 1000, name: "이전 달", key: "ArrowLeft", disabledYear: "이전 해" }, { month: "9999-12", year: 9999, name: "다음 달", key: "ArrowRight", disabledYear: "다음 해" }]) {
    await page.goto(`/visual-fixture/poster?monthLink=1&month=${edge.month}`);
    await expect(heading(page)).toContainText(String(edge.year)); await settlePanelLayout(page);
    await expect(page.getByRole("button", { name: edge.name, exact: true }).first()).toBeDisabled();
    await page.keyboard.press(edge.key); expect(new URL(page.url()).searchParams.get("month")).toBe(edge.month);
    await expect(heading(page)).toContainText(String(edge.year));
    await page.locator(".month-title-btn").first().click(); await expect(page.getByRole("button", { name: edge.disabledYear, exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
  }
  await context.addCookies([{ name: "vic_view", value: encodeURIComponent(JSON.stringify({sy:2026,sm:6})), url:baseURL! }]);
  await page.goto("/visual-fixture/poster?monthLink=1&month=2026-09&month=2026-10");
  await expect(heading(page)).toContainText(/2026년\s*0?6월/);
  await expect.poll(() => new URL(page.url()).searchParams.getAll("month")).toEqual(["2026-06"]);
  await finish(page, info, state.proof, { min: "1000-01", max: "9999-12", keyboardAndPickerBounded: true, duplicateFallsBackToCookie: true });
});
