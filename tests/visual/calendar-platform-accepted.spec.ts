import { test, expect, type Page, type BrowserContext, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { guardCompanionQa } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { companionTraceMode } from "./helpers/companion-evidence-policy";
import { darkInsightsResponses } from "./fixtures/dark-insights";
import { kstYm } from "@/lib/insights/month-progress";

test.use({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block", video: "on", trace: companionTraceMode() });
test.setTimeout(60000);
type Proof = Awaited<ReturnType<typeof guardCompanionQa>>;
type Write = { op: string; payload: { id?: string; publicTitle?: string; dateKey?: string; visibilityScope?: string } };
const chooser = (page: Page) => page.getByRole("dialog", { name: "월 선택", exact: true });
const monthTitle = (page: Page) => page.locator('[data-act="month-title"]:visible').first();
const input = (page: Page, mobile: boolean) => page.locator(mobile ? ".m-edit-sheet .me-title:visible" : '[data-act="title-input"]:visible');

async function setup(page: Page, context: BrowserContext, base: string, failedBroadcasts = 0) {
  const proof = await guardCompanionQa(page, context, base);
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false }));
    for (const key of ["vic.ambient", "vic.sound", "vic.gfxPref"]) localStorage.setItem(key, "off");
  });
  const publicReads: string[] = [];
  await context.route("**/api/public/*/broadcast?**", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base || req.method() !== "GET") return route.fallback();
    publicReads.push(url.pathname);
    if (failedBroadcasts-- > 0) return route.fulfill({ status: 503, json: { error: "Synthetic unavailable aggregate" } });
    return route.fulfill({ json: { months: [{ ym: "2026-06", hours: 3.5, days: 1, sessions: 1 }], daily: Array.from({ length: 30 }, (_, i) => i === 17 ? 3.5 : 0) } });
  });
  return { proof, publicReads };
}

async function finish(page: Page, info: TestInfo, proof: Proof, facts: unknown) {
  await Promise.all(proof.pending);
  await info.attach("actual-ui", { body: await page.screenshot(), contentType: "image/png" });
  await info.attach("observation", { body: JSON.stringify({ facts, proof: { ...proof, pending: undefined }, syntheticFixture: true, realLogin: false, physicalDevice: false, fullCertification: false }), contentType: "application/json" });
  expect(proof.errors).toEqual([]);
  expect(proof.mutations).toEqual([]);
  expect(proof.rejected).toEqual([]);
  expect(proof.liveReads).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0);
  expect(proof.chunks.every(chunk => chunk.served === chunk.local)).toBe(true);
}

async function tabCycle(page: Page) {
  const dialog = chooser(page), controls = dialog.locator('button:enabled:not([tabindex="-1"])');
  const count = await controls.count();
  expect(count).toBeGreaterThan(12);
  await controls.last().focus(); await page.keyboard.press("Tab"); await expect(controls.first()).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(controls.last()).toBeFocused();
  for (let i = 0; i < count + 2; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
  }
  return count;
}

async function inspectMonthPicker(page: Page, context: BrowserContext, base: string, info: TestInfo, surface: "viewer" | "studio" | "preview", mobile = false) {
  const s = await setup(page, context, base), [year, month] = kstYm().split("-").map(Number);
  await page.goto(surface === "viewer" ? `/visual-fixture/poster?monthLink=1&month=${kstYm()}` : `/visual-fixture/studio?role=owner${surface === "preview" ? "&viewer=1" : ""}&y=${year}&m=${month}`);
  if (mobile) {
    // A cold anonymous page can open its SSR desktop header before the mobile
    // layout replaces it. Exercise that same real responsive replacement with
    // an open dialog; waiting for a settled mobile header alone hid the bug.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator(".public-calendar-header")).toBeVisible();
    await monthTitle(page).click(); await expect(chooser(page)).toBeVisible();
    const oldTitle = await monthTitle(page).elementHandle();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".mobile-calendar-title")).toBeVisible();
    expect(await oldTitle!.evaluate(node => node.isConnected)).toBe(false);
    await page.keyboard.press("Escape"); await expect(chooser(page)).toHaveCount(0);
    await expect(monthTitle(page)).toBeFocused();
    await oldTitle!.dispose();
  }
  await settlePanelLayout(page); await monthTitle(page).click(); await expect(chooser(page)).toBeVisible(); await settlePanelLayout(page);
  const heights = [(await chooser(page).boundingBox())!.height];
  await expect(chooser(page).locator('[data-act="mp-today"]')).toBeDisabled();
  await expect(chooser(page).locator('[data-act="mp-today"]')).toContainText("이번 달");
  const tabsAtToday = await tabCycle(page);
  const months = chooser(page).locator(".mp-month");
  await months.first().focus(); await page.keyboard.press("ArrowDown"); await expect(months.nth(mobile ? 4 : 3)).toBeFocused();
  await page.keyboard.press("ArrowUp"); await expect(months.first()).toBeFocused();
  await page.keyboard.press("PageDown"); await expect(chooser(page).locator(".mp-rail-y.is-cur")).toHaveText(`${year + 1}년`);
  await settlePanelLayout(page); heights.push((await chooser(page).boundingBox())!.height);
  await expect(chooser(page).locator('[data-act="mp-today"]')).toBeEnabled();
  await page.keyboard.press("PageUp"); await expect(chooser(page).locator(".mp-rail-y.is-cur")).toHaveText(`${year}년`);
  const other = month === 1 ? 2 : month - 1;
  await chooser(page).getByRole("button", { name: `${year}년 ${other}월`, exact: true }).click();
  await expect(chooser(page)).toHaveCount(0); await expect(monthTitle(page)).toContainText(new RegExp(`${year}년\\s*0?${other}월`));
  await expect(monthTitle(page)).toBeFocused();
  await monthTitle(page).click(); await settlePanelLayout(page); heights.push((await chooser(page).boundingBox())!.height);
  const tabsAway = await tabCycle(page);
  await chooser(page).locator('[data-act="mp-today"]').click();
  await expect(chooser(page)).toHaveCount(0); await expect(monthTitle(page)).toContainText(new RegExp(`${year}년\\s*0?${month}월`));
  await expect(monthTitle(page)).toBeFocused();
  await monthTitle(page).click(); await settlePanelLayout(page); heights.push((await chooser(page).boundingBox())!.height);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  await info.attach("equal-height-picker", { body: await chooser(page).screenshot(), contentType: "image/png" });
  const scrollBefore = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  await page.keyboard.press("Escape"); await expect(chooser(page)).toHaveCount(0); await expect(monthTitle(page)).toBeFocused();
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(scrollBefore);
  await finish(page, info, s.proof, { surface, mobile, responsiveOpenerReplacement: mobile, viewedKst: { year, month }, heights, tabsAtToday, tabsAway, nativeArrowPageTodayMonthEsc: true, focusReturnedAfterEveryClose: true });
}

test("month picker viewer desktop keeps height keyboard and return focus", async ({ page, context, baseURL }, info) => inspectMonthPicker(page, context, baseURL!, info, "viewer"));
test("month picker studio desktop keeps height keyboard and return focus", async ({ page, context, baseURL }, info) => inspectMonthPicker(page, context, baseURL!, info, "studio"));
test("month picker preview desktop keeps height keyboard and return focus", async ({ page, context, baseURL }, info) => inspectMonthPicker(page, context, baseURL!, info, "preview"));

async function interceptWrites(context: BrowserContext, base: string, rejectFirst = false) {
  const writes: Write[] = [];
  await context.route("**/api/studio-write", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base || req.method() !== "POST") return route.fallback();
    const body = req.postDataJSON() as Write;
    writes.push(body);
    // A local synthetic response exposes pending UI; the route never reaches DB.
    await new Promise(resolve => setTimeout(resolve, 250));
    const rejected = rejectFirst && writes.length === 1;
    return route.fulfill({ status: rejected ? 403 : 200, json: rejected ? { ok: false, error: "Synthetic save rejected" } : { ok: true, id: body.payload.id ?? "synthetic-calendar-save" } });
  });
  return writes;
}
async function saveStatus(page: Page) {
  const mobile = page.locator(".studio-mobile .mobile-save-feedback");
  return (await mobile.count() ? mobile : page.locator(".save-status")).evaluateAll(nodes => nodes.map(node => ({ text: node.textContent, title: node.getAttribute("title"), state: node.getAttribute("data-state") ?? node.className })));
}
async function editFirst(page: Page, mobile: boolean) {
  const pill = page.locator(mobile ? '[data-act="agenda-event"][data-companion-event="ordinary"]' : '.studio-event-pill[data-companion-event="ordinary"]').first();
  if (mobile) await pill.click(); else await pill.dblclick();
  await expect(input(page, mobile)).toBeVisible(); await settlePanelLayout(page);
  return pill;
}
async function closeEditor(page: Page, mobile: boolean) {
  if (mobile) await page.locator('[data-act="close-mobile-edit"]').click(); else await page.keyboard.press("Escape");
  await expect(input(page, mobile)).toHaveCount(0);
}
async function saveFeedback(page: Page, context: BrowserContext, base: string, info: TestInfo, mobile: boolean) {
  const s = await setup(page, context, base), writes = await interceptWrites(context, base);
  await page.goto("/visual-fixture/studio?role=owner&y=2026&m=6"); await settlePanelLayout(page);
  const initial = await saveStatus(page);
  await page.keyboard.press("Control+s"); await expect(page.locator(".copy-toast")).toHaveText("새로 저장할 변경사항이 없어요");
  await page.waitForTimeout(150); expect(await saveStatus(page)).toEqual(initial);
  await page.waitForTimeout(700); expect(await saveStatus(page)).toEqual(initial); expect(writes).toHaveLength(0);
  const pill = await editFirst(page, mobile), id = await pill.getAttribute("data-eventid"), draft = "합성 미저장 초안 — 실제 사용자 내용 아님";
  await input(page, mobile).fill(draft); await closeEditor(page, mobile); await page.keyboard.press("Control+s");
  await expect(page.locator(".copy-toast")).toHaveText("입력은 임시 보관 중이에요. 카드를 열어 저장해 주세요");
  await page.waitForTimeout(850); expect(writes).toHaveLength(0); expect(await saveStatus(page)).toEqual(initial);
  await info.attach("closed-unsaved-draft", { body: await page.screenshot(), contentType: "image/png" });
  await editFirst(page, mobile);
  if (mobile) await expect(input(page, mobile)).toHaveValue(draft); else await expect(input(page, mobile)).toHaveText(draft);
  await expect(page.locator(".draft-restored:visible")).toContainText("임시 저장본을 불러왔어요");
  await page.keyboard.press("Control+s"); await expect.poll(() => writes.length).toBe(1);
  if (mobile) {
    await expect(page.locator('.mobile-save-feedback[data-state="saving"]')).toBeVisible();
    await expect(page.locator('.mobile-save-feedback[data-state="saved"]')).toBeVisible();
    await expect(page.locator(".m-settings-slot [role=status]")).toContainText("저장됨");
    await expect(page.locator(".mobile-save-feedback")).toHaveAttribute("title", /\d{2}:\d{2}.*KST/);
  } else {
    await expect(page.locator(".save-status.saving")).toBeVisible();
    await expect(page.locator(".save-status.saved .ss-time")).toHaveText(/^\d{2}:\d{2}$/);
  }
  expect(writes[0].op).toBe("save"); expect(writes[0].payload.id).toBe(id); expect(writes[0].payload.publicTitle).toBe(draft); expect(writes[0].payload.visibilityScope).toBe("public");
  await expect(pill).toContainText(draft);
  if (mobile && await input(page, mobile).count()) await closeEditor(page, mobile);
  const saved = await saveStatus(page);
  await page.keyboard.press("Control+s"); await page.waitForTimeout(850);
  expect(writes).toHaveLength(1); expect(await saveStatus(page)).toEqual(saved);
  await finish(page, info, s.proof, { mobile, initial, saved, beforeActualSubmitWrites: 0, actualSaveWrites: writes.length, syntheticPayload: writes[0], draftPreservedAndRestored: true, unchangedCompletionAfterNoop: true });
}

test("save feedback desktop distinguishes no-op memory draft and actual Ctrl S", async ({ page, context, baseURL }, info) => saveFeedback(page, context, baseURL!, info, false));
test("failed save stays failed after no-op and explicit recovery saves once", async ({ page, context, baseURL }, info) => {
  const s = await setup(page, context, baseURL!), writes = await interceptWrites(context, baseURL!, true);
  await page.goto("/visual-fixture/studio?role=owner&y=2026&m=6"); await settlePanelLayout(page); await editFirst(page, false);
  const draft = "합성 실패 후 복구 입력"; await input(page, false).fill(draft); await page.keyboard.press("Control+s");
  await expect(page.locator(".save-status.failed")).toBeVisible(); expect(writes).toHaveLength(1);
  const failed = await saveStatus(page); await page.keyboard.press("Control+s"); await page.waitForTimeout(850);
  expect(writes).toHaveLength(1); expect(await saveStatus(page)).toEqual(failed);
  await page.locator('[data-act="editor-recover-failed-save"]:visible').first().click(); await expect(input(page, false)).toHaveText(draft);
  await page.keyboard.press("Control+s"); await expect.poll(() => writes.length).toBe(2); await expect(page.locator(".save-status.saved .ss-time")).toHaveText(/^\d{2}:\d{2}$/);
  expect(writes.every(write => write.op === "save" && write.payload.publicTitle === draft)).toBe(true);
  await finish(page, info, s.proof, { firstSyntheticResponse: 403, secondSyntheticResponse: 200, writes: writes.length, failedFeedbackPreservedThroughNoop: true, explicitLocalRecoveryAndResubmit: true });
});

async function publicWithoutHighlights(page: Page, context: BrowserContext, base: string, info: TestInfo, mobile: boolean) {
  const s = await setup(page, context, base, mobile ? 0 : 1);
  await page.goto("/visual-fixture/poster?monthLink=1&month=2026-06&hearts=1"); await settlePanelLayout(page);
  await page.getByRole("button", { name: /^(?:이 달 )?기록$/ }).first().click();
  if (!mobile) { await expect(page.locator(".pi-failed")).toContainText("방송 기록을 못 불러왔어요"); await page.locator('[data-act="pi-retry"]').click(); }
  const sheet = page.locator(".pi-sheet"); await expect(sheet.locator(".bcast-daily")).toBeVisible();
  await expect(sheet.locator(".pi-stats")).toContainText("컨텐츠 있는 날"); await expect(sheet.locator(".pi-next")).toContainText("다음 방송");
  expect(await sheet.locator(".pi-top-title").count()).toBeGreaterThan(0);
  await expect(sheet.locator(".highlight-grid,.highlight-card")).toHaveCount(0); await expect(sheet).not.toContainText("하이라이트");
  await expect(sheet).not.toContainText("owner@example.com"); await expect(sheet).not.toContainText("Synthetic scope excludes security data");
  const chart = sheet.getByRole("slider", { name: "이 달 일별 방송 시간 조회 날짜" }); await chart.focus(); await page.keyboard.press("End"); await expect(chart).toHaveAttribute("aria-valuenow", "30");
  await finish(page, info, s.proof, { mobile, publicReadCount: s.publicReads.length, highlightsAbsent: true, scheduleNextPopularAndBroadcastPreserved: true, retryObserved: !mobile, syntheticHeartsNotUsageEvidence: true });
}
test("public records desktop removes highlights and preserves data retry", async ({ page, context, baseURL }, info) => publicWithoutHighlights(page, context, baseURL!, info, false));

async function mockInsights(context: BrowserContext, base: string) {
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const baseline = darkInsightsResponses.getInsightsAction.data, trend = { ...darkInsightsResponses.getTrendAction.data, months: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"] };
  const responses: Record<string, unknown> = { ...darkInsightsResponses, getTrendAction: { ok: true, data: trend }, getOwnerSecurityAction: { ok: false, error: "Synthetic scope excludes security data" }, getMemberInsightsAction: { ok: true, data: { month: { year: 2026, month: 6 }, content: { ...baseline.content, tags: [] }, engagement: { ...baseline.engagement, topTitles: [] }, trend: { ...trend, hearts: [1, 2, 3, 4, 5, 6] }, highlight: { peakDay: "2026-06-12", peakHour: 20, topTitle: "REMOVED_HIGHLIGHT_CANARY", busiestWeekday: 4 } } } };
  const reads: string[] = [], excludedPresence: string[] = [];
  await context.route("**/api/developer/presence", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base || req.method() !== "GET") return route.fallback();
    excludedPresence.push(url.pathname); return route.fulfill({ status: 404, body: "Synthetic scope excludes operating presence" });
  });
  await context.route("**/visual-fixture/studio?**", async route => {
    const req = route.request(), url = new URL(req.url()), name = manifest[req.headers()["next-action"]]?.exportedName;
    if (url.origin !== base || req.method() !== "POST" || !name || !(name in responses)) return route.fallback();
    reads.push(name); return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(responses[name])}\n` });
  });
  return { reads, excludedPresence };
}
for (const role of ["owner", "developer"] as const) test(`studio ${role} insights removes highlights and keeps every remaining tab`, async ({ page, context, baseURL }, info) => {
  const s = await setup(page, context, baseURL!), mocked = await mockInsights(context, baseURL!);
  await page.goto(`/visual-fixture/studio?role=${role}&y=2026&m=6`); await settlePanelLayout(page);
  const open = page.locator('[data-act="manage-insights"]'); if (!await open.isVisible()) await page.locator('[data-act="panel-toggle"]').click(); await open.click();
  await expect(page.locator(".bcast-daily")).toBeVisible();
  const labels = role === "owner" ? ["트렌드", "일정", "참여", "보안"] : ["트렌드", "일정", "참여", "실시간", "방문", "보안", "시스템"];
  const tabs = page.getByRole("tablist", { name: "인사이트 영역" }).getByRole("tab"); await expect(tabs).toHaveText(labels);
  const track = page.locator(".insights-track"), panels = track.locator(":scope > .insights-panel"); await expect(panels).toHaveCount(labels.length);
  const contents: { label: string; text: string }[] = [];
  for (let i = 0; i < labels.length; i++) {
    await tabs.nth(i).click(); await expect(tabs.nth(i)).toHaveAttribute("aria-selected", "true"); await expect(track).toHaveAttribute("data-active", String(i)); await settlePanelLayout(page);
    const panel = panels.nth(i), label = labels[i];
    if (label === "트렌드") await expect(panel.locator(".bcast-daily")).toBeVisible();
    if (label === "일정") await expect(panel).toContainText("다음 방송");
    if (label === "참여") await expect(panel).toContainText(role === "owner" ? "이번 달 인기 컨텐츠 TOP" : "관심 단계 받는 기준");
    if (label === "실시간") await expect(panel).toContainText("접속 현황을 불러오지 못했어요");
    if (label === "방문") await expect(panel).toContainText("시청자");
    if (label === "보안") await expect(panel).toContainText(role === "owner" ? "보안 정보를 불러오지 못했어요" : "비공개 잠금 암호");
    if (label === "시스템") await expect(panel).toContainText("관리자 계정");
    contents.push({ label, text: (await panel.innerText()).slice(0, 160) });
  }
  await expect(page.getByRole("tab", { name: "하이라이트", exact: true })).toHaveCount(0); await expect(page.locator(".highlight-grid,.highlight-card")).toHaveCount(0); await expect(track).not.toContainText("REMOVED_HIGHLIGHT_CANARY");
  if (role === "owner") expect(mocked.reads).toContain("getOwnerSecurityAction"); else expect(mocked.excludedPresence.length).toBeGreaterThan(0);
  await finish(page, info, s.proof, { role, labels, contents, syntheticReadActions: mocked.reads, operatingPresenceBlocked: mocked.excludedPresence, syntheticResponseRetainsHighlightFields: true, highlightsAbsent: true });
});

test.describe("touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("month picker viewer mobile keeps height keyboard and return focus", async ({ page, context, baseURL }, info) => inspectMonthPicker(page, context, baseURL!, info, "viewer", true));
  test("save feedback mobile distinguishes no-op memory draft and actual Ctrl S", async ({ page, context, baseURL }, info) => saveFeedback(page, context, baseURL!, info, true));
  test("public records mobile removes highlights and preserves remaining cards", async ({ page, context, baseURL }, info) => publicWithoutHighlights(page, context, baseURL!, info, true));
});
