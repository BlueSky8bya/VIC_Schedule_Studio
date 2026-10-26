import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { agendaFrameFixture, supportContextFixture } from "@/app/visual-fixture/support-context";
import { getTodayKst, nowKstHm } from "@/lib/calendar/month";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

// A feature folder follows scripts/scratch-retention's 14-day policy. A fresh
// run folder preserves failures and never overwrites a previous receipt.
const artifacts = resolve(".scratch-pw/mobile-agenda-frame", `${getTodayKst()}-${nowKstHm().replace(":", "")}-${process.pid}`);
const expectedNotices = [
  { id: "cozy-period-vote", title: "빅토리의 다음 무대를 응원하는 시청자 인기 투표에 참여해 주세요", url: "https://example.com/period-vote", kind: "period" },
  { id: "cozy-period-goods", title: "가을 한정 굿즈 사전 신청과 배송 일정 안내를 확인해 주세요", url: "https://example.com/period-goods", kind: "period" },
  { id: "cozy-support", title: "새 방송 코너에서 함께 나눌 시청자 여러분의 사연을 모집합니다", url: "https://example.com/support", kind: "up" }
];
type Receipt = { mutations: string[]; errors: string[]; previewReads: number; actionRequests: { path: string; id: string; exportedName: string }[]; measurements: Record<string, unknown> };
const receipts = new WeakMap<Page, Receipt>();
const hostOf = (page: Page) => page.locator(".agenda-with-notices:visible");
const boardOf = (page: Page) => hostOf(page).locator(".agenda-support-board");
const flowOf = (page: Page) => hostOf(page).locator(".agenda-flow");
const rowsOf = (page: Page) => boardOf(page).locator(".asc-stack > .asc-row[data-notice-id]");
const round = (n: number) => Math.round(n * 1000) / 1000;

test.beforeEach(async ({ page }) => {
  mkdirSync(artifacts, { recursive: true });
  const receipt: Receipt = { mutations: [], errors: [], previewReads: 0, actionRequests: [], measurements: {} };
  receipts.set(page, receipt);
  page.on("pageerror", error => receipt.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const readActions = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  const anonHeartReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getAnonHeartIdsAction").map(([id]) => id));
  expect(readActions.size).toBe(1);
  expect(anonHeartReads.size).toBe(1);
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    const actionId = request.headers()["next-action"];
    if (request.method() === "POST") receipt.actionRequests.push({ path: url.pathname, id: actionId ?? "", exportedName: manifest[actionId]?.exportedName ?? "unknown" });
    if (request.method() === "POST" && url.pathname === "/visual-fixture/studio" && readActions.has(request.headers()["next-action"])) {
      receipt.previewReads++;
      const fixture = url.searchParams.get("supportUX") === "frame-none" ? agendaFrameFixture() : supportContextFixture();
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify({ ...samplePublicScheduleData, events: fixture.events })}\n` });
    }
    // Verified against the built action manifest and the preserved retry1
    // request: anonymous heart restoration is a read over POST transport.
    // Answer it locally; the real action never executes or reaches Supabase.
    if (request.method() === "POST" && url.pathname === "/visual-fixture/poster" && anonHeartReads.has(actionId)) {
      return route.fulfill({ contentType: "text/x-component", body: '0:{"a":"$@1","f":[],"b":"fixture"}\n1:[]\n' });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      receipt.mutations.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 500, body: "" });
    }
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});

async function frameMetrics(page: Page) {
  return hostOf(page).evaluate(host => {
    const bounds = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const surface = host.closest(".studio-mobile,.public-calendar-shell") ?? host.parentElement!;
    const header = surface.querySelector<HTMLElement>(".m-topstick,.agenda-header")!;
    const board = host.querySelector<HTMLElement>(".agenda-support-board");
    const frame = host.querySelector<HTMLElement>(":scope > .agenda")!;
    const flow = frame.querySelector<HTMLElement>(".agenda-flow")!;
    const rail = frame.querySelector<HTMLElement>(".agenda-rail,.agenda-legend-rail")!;
    const filter = rail.querySelector<HTMLElement>('[data-panel-section="tag-filter"]')!;
    const body = filter.querySelector<HTMLElement>(".panel-section-body")!;
    const heading = filter.querySelector<HTMLElement>(".panel-section-title")!;
    const insights = rail.querySelector<HTMLElement>(".m-rail-insights,.agenda-legend-insights")!;
    const preview = rail.querySelector<HTMLElement>(".agenda-legend-nav");
    const footers = [...document.querySelectorAll<HTMLElement>(".m-actionrail,.agenda-monthbar")].filter(node => node.getBoundingClientRect().width > 0);
    const footer = footers[0];
    const visibleRows = [...flow.querySelectorAll<HTMLElement>(".agenda-day,.agenda-gap")];
    const last = visibleRows.at(-1)!;
    const management = flow.querySelector<HTMLElement>(".m-manage");
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const textLines: number[] = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(walker.currentNode);
      textLines.push(...[...range.getClientRects()].map(r => Math.round(r.y * 10) / 10));
    }
    const hit = (node: Element) => {
      const r = node.getBoundingClientRect(), target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return Boolean(target && (target === node || node.contains(target)));
    };
    const flowStyle = getComputedStyle(flow), frameStyle = getComputedStyle(frame);
    return {
      viewport: { width: innerWidth, height: innerHeight }, scrollY,
      documentHeight: document.documentElement.scrollHeight, documentWidth: document.documentElement.scrollWidth,
      host: bounds(host), header: bounds(header), board: board ? bounds(board) : null, boardPosition: board ? getComputedStyle(board).position : null,
      frame: bounds(frame), framePadding: ["Top", "Right", "Bottom", "Left"].map(side => parseFloat(frameStyle[`padding${side}` as "paddingTop"]) || 0),
      flow: { ...bounds(flow), scrollTop: flow.scrollTop, clientHeight: flow.clientHeight, scrollHeight: flow.scrollHeight,
        overflowY: flowStyle.overflowY, paddingTop: parseFloat(flowStyle.paddingTop) || 0, paddingBottom: parseFloat(flowStyle.paddingBottom) || 0,
        role: flow.getAttribute("role"), label: flow.getAttribute("aria-label"), tabIndex: flow.tabIndex },
      rail: { ...bounds(rail), overflowY: getComputedStyle(rail).overflowY },
      filter: { ...bounds(filter), collapsed: filter.hasAttribute("data-panel-collapsed"), collapsible: filter.hasAttribute("data-panel-collapsible"),
        toggles: filter.querySelectorAll(".panel-section-toggle,[data-act=tag-filter-fold]").length },
      heading: { ...bounds(heading), title: heading.textContent?.trim(), textLines: [...new Set(textLines)].length },
      filterBody: { ...bounds(body), scrollTop: body.scrollTop, clientHeight: body.clientHeight, scrollHeight: body.scrollHeight,
        overflowY: getComputedStyle(body).overflowY, display: getComputedStyle(body).display, hidden: body.hidden },
      insights: { ...bounds(insights), hit: hit(insights) }, preview: preview ? { ...bounds(preview), hit: hit(preview.querySelector("button")!) } : null,
      footer: { ...bounds(footer), preview: footer.querySelector(".agenda-toolbar-preview") ? bounds(footer.querySelector(".agenda-toolbar-preview")!) : null,
        controls: [...footer.querySelectorAll<HTMLElement>("button")].filter(node => node.getBoundingClientRect().width > 0).map(node => ({ label: node.textContent?.trim(), name: node.getAttribute("aria-label"), title: node.title, ...bounds(node), hit: hit(node) })) },
      last: { date: last.dataset.flipKey, ...bounds(last) },
      management: management ? bounds(management) : null,
      inkBelowFooter: [...flow.querySelectorAll<HTMLElement>(".agenda-day,.agenda-gap,.agenda-event")].some(node => {
        const r = node.getBoundingClientRect(), top = Math.max(r.top, bounds(footer).y), bottom = Math.min(r.bottom, innerHeight);
        if (top >= bottom) return false;
        const target = document.elementFromPoint(Math.max(r.left + 1, Math.min(r.left + r.width / 2, innerWidth - 1)), (top + bottom) / 2);
        return Boolean(target && (target === node || node.contains(target)));
      })
    };
  });
}

type FrameMetrics = Awaited<ReturnType<typeof frameMetrics>>;

function assertFrame(m: FrameMetrics, hasNotices: boolean, footerState: "today" | "live" = "today") {
  const within = (inner: { x: number; y: number; right: number; bottom: number }, outer: { x: number; y: number; right: number; bottom: number }, name: string) => {
    expect(inner.x, `${name} left`).toBeGreaterThanOrEqual(outer.x - .5);
    expect(inner.y, `${name} top`).toBeGreaterThanOrEqual(outer.y - .5);
    expect(inner.right, `${name} right`).toBeLessThanOrEqual(outer.right + .5);
    expect(inner.bottom, `${name} bottom`).toBeLessThanOrEqual(outer.bottom + .5);
  };
  expect(Boolean(m.board)).toBe(hasNotices);
  expect(m.documentWidth).toBeLessThanOrEqual(m.viewport.width + 1);
  expect(m.documentHeight).toBeLessThanOrEqual(m.viewport.height + 1);
  expect(Math.abs(m.scrollY)).toBeLessThan(.5);
  const topBoundary = m.board?.bottom ?? m.header.bottom;
  // The shared frame owns its padding; compare the usable columns against the
  // surrounding chrome, whether that padding is inside or outside the frame.
  const topGap = m.flow.y - topBoundary, bottomGap = m.footer.y - m.flow.bottom;
  expect(topGap).toBeGreaterThanOrEqual(4);
  expect(bottomGap).toBeGreaterThanOrEqual(4);
  expect(Math.abs(topGap - bottomGap)).toBeLessThan(.5);
  expect(Math.abs((m.frame.x - m.host.x) - (m.host.right - m.frame.right))).toBeLessThan(.5);
  within(m.flow, m.frame, "days"); within(m.rail, m.frame, "sidebar");
  expect(Math.abs(m.flow.y - m.rail.y)).toBeLessThan(.5);
  expect(Math.abs(m.flow.bottom - m.rail.bottom)).toBeLessThan(.5);
  expect(m.flow.right).toBeLessThanOrEqual(m.rail.x - 4);
  expect(m.flow.height).toBeGreaterThan(44);
  expect(["auto", "scroll"]).toContain(m.flow.overflowY);
  expect(m.flow.role).toBe("region"); expect(m.flow.label).toBe("날짜별 일정"); expect(m.flow.tabIndex).toBe(0);
  expect(["hidden", "clip"]).not.toContain(m.rail.overflowY);
  within(m.filter, m.rail, "filter"); within(m.insights, m.rail, "insights");
  expect(m.filter.bottom).toBeLessThanOrEqual(m.insights.y - 4);
  expect(Math.abs(m.filter.width - m.rail.width)).toBeLessThan(.5);
  expect(m.filter.collapsed).toBe(false); expect(m.filter.collapsible).toBe(false); expect(m.filter.toggles).toBe(0);
  expect(m.heading.title?.replace(/\s+/g, "")).toBe("태그필터"); expect(m.heading.textLines).toBe(1);
  expect(m.filterBody.hidden).toBe(false); expect(m.filterBody.display).not.toBe("none");
  expect(m.filterBody.height).toBeGreaterThanOrEqual(44);
  expect(["auto", "scroll"]).toContain(m.filterBody.overflowY);
  expect(m.insights.hit).toBe(true);
  expect(m.preview).toBeNull();
  expect(Math.abs(m.insights.bottom - m.rail.bottom)).toBeLessThan(.5);
  if (m.footer.preview) within(m.footer.preview, m.footer, "footer preview");
  expect(m.inkBelowFooter).toBe(false);
  for (const control of m.footer.controls) {
    within(control, { x: 0, y: 0, right: m.viewport.width, bottom: m.viewport.height }, "footer control");
    expect(control.hit, control.label).toBe(true);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
  expect(m.footer.controls.some(control => footerState === "live" ? control.label?.includes("LIVE") : control.label?.includes("오늘") || control.title?.includes("오늘"))).toBe(true);
}

// The documented short-landscape structure keeps the complete notice board in
// normal document flow. At the document end both usable columns must fit, with
// a full tag row; portrait's zero-outer-scroll contract remains above unchanged.
function assertLandscapeFrame(m: FrameMetrics) {
  expect(m.viewport.height).toBeLessThanOrEqual(480);
  expect(m.documentWidth).toBeLessThanOrEqual(m.viewport.width + 1);
  expect(m.boardPosition).toBe("static"); expect(m.board).not.toBeNull();
  expect(m.frame.height).toBeGreaterThanOrEqual(168);
  expect(m.flow.height).toBeGreaterThan(44); expect(m.filterBody.height).toBeGreaterThanOrEqual(44);
  expect(m.flow.y).toBeGreaterThanOrEqual(m.header.bottom - .5);
  expect(Math.abs(m.flow.y - m.board!.bottom - 8)).toBeLessThan(.5);
  expect(Math.abs(m.footer.y - m.flow.bottom - 8)).toBeLessThan(.5);
  expect(Math.abs(m.flow.y - m.rail.y)).toBeLessThan(.5);
  expect(Math.abs(m.flow.bottom - m.rail.bottom)).toBeLessThan(.5);
  expect(m.flow.right).toBeLessThanOrEqual(m.rail.x - 4);
  expect(m.filter.bottom).toBeLessThanOrEqual(m.insights.y - 4);
  expect(m.insights.hit).toBe(true); expect(Math.abs(m.insights.bottom - m.rail.bottom)).toBeLessThan(.5);
  expect(m.filter.collapsible).toBe(false); expect(m.filter.toggles).toBe(0);
  expect(m.heading.title?.replace(/\s+/g, "")).toBe("태그필터"); expect(m.heading.textLines).toBe(1);
  expect(["auto", "scroll"]).toContain(m.filterBody.overflowY); expect(m.filterBody.hidden).toBe(false);
  expect(m.inkBelowFooter).toBe(false);
  for (const control of m.footer.controls) {
    expect(control.hit, control.label).toBe(true); expect(control.height).toBeGreaterThanOrEqual(44);
    expect(control.x).toBeGreaterThanOrEqual(0); expect(control.right).toBeLessThanOrEqual(m.viewport.width + .5);
    expect(control.y).toBeGreaterThanOrEqual(0); expect(control.bottom).toBeLessThanOrEqual(m.viewport.height + .5);
  }
}

async function wheelIn(page: Page, root: Locator, delta: number) {
  const r = await root.boundingBox();
  await page.mouse.move(r!.x + r!.width / 2, r!.y + r!.height / 2);
  await page.mouse.wheel(0, delta);
}

async function revealNoticeAction(page: Page, action: Locator) {
  const box = await action.boundingBox(), chrome = await frameMetrics(page);
  const delta = box!.y < chrome.header.bottom + 8 ? box!.y - chrome.header.bottom - 8
    : box!.y + box!.height > chrome.footer.y - 8 ? box!.y + box!.height - chrome.footer.y + 8 : 0;
  if (Math.abs(delta) > .5) await page.evaluate(delta => window.scrollBy({ top: delta, behavior: "instant" }), delta);
  receipts.get(page)!.measurements.noticeReveal = { before: { box, chrome }, delta, after: { box: await action.boundingBox(), chrome: await frameMetrics(page) } };
  await expect.poll(async () => (await action.boundingBox())!.y - (await frameMetrics(page)).header.bottom).toBeGreaterThanOrEqual(8 - .5);
  await expect.poll(async () => { const box = (await action.boundingBox())!; return (await frameMetrics(page)).footer.y - box.y - box.height; }).toBeGreaterThanOrEqual(8 - .5);
  return page.evaluate(() => scrollY);
}

for (const width of [320, 390]) for (const height of [568, 844]) for (const dark of [false, true]) {
  test.describe(`bounded${width}x${height}-${dark ? "dark" : "light"}`, () => {
    test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
    test("notice0-or3-four-surfaces-share-padded-frame-and-independent-scroll", async ({ page }) => {
      test.setTimeout(120_000);
      await seed(page, true, dark);
      // The removed mobile disclosure must not revive a previously saved fold.
      await page.addInitScript(() => localStorage.setItem("vic.panelSections", JSON.stringify({ version: 1, "tag-filter": false, season: true, "companion-home": true })));
      const cases = [];
      for (const notices of [false, true]) for (const surface of surfaces.filter(item => item.name !== "signed-in")) {
        const route = new URL(surface.path, "http://fixture");
        route.searchParams.set("supportUX", notices ? "cozy" : "frame-none");
        await page.goto(`${route.pathname}${route.search}`);
        await expect(hostOf(page)).toHaveCount(1);
        await settle(page);
        await expect(boardOf(page)).toHaveCount(notices ? 1 : 0);
        const initial = await frameMetrics(page);
        receipts.get(page)!.measurements.frameProbe = { surface: surface.name, notices, phase: "initial", initial };
        assertFrame(initial, notices);
        expect(Boolean(initial.footer.preview)).toBe(surface.name === "preview");
        if (surface.name === "preview") expect(initial.footer.controls.some(control => control.name === "편집실로 가기" && control.hit)).toBe(true);
        if (!surface.edit) expect(initial.footer.controls.filter(control => ["이전 달", "다음 달"].includes(control.title)).length).toBe(2);
        const flow = flowOf(page);
        expect(initial.flow.scrollHeight).toBeGreaterThan(initial.flow.clientHeight + 20);
        await wheelIn(page, flow, 100_000);
        await expect.poll(() => flow.evaluate(node => node.scrollTop)).toBeGreaterThan(20);
        await expect.poll(() => flow.evaluate(node => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))).toBeLessThan(1);
        await settle(page);
        const end = await frameMetrics(page);
        receipts.get(page)!.measurements.frameProbe = { surface: surface.name, notices, phase: "days-end", initial, end };
        assertFrame(end, notices);
        const endItem = end.management ?? end.last;
        expect(Boolean(end.management)).toBe(surface.edit);
        expect(endItem.bottom).toBeLessThanOrEqual(end.flow.bottom - end.flow.paddingBottom + 1);
        expect(endItem.bottom).toBeGreaterThan(end.flow.y + 20);
        // Studio management remains after the dates. Reach the final day using
        // its real keyboard-focusable add control, then return to management.
        let lastDayReached: FrameMetrics | undefined;
        if (surface.edit) {
          await flow.locator(".agenda-day").last().locator('[data-act="m-add-event"]').focus();
          lastDayReached = await frameMetrics(page); assertFrame(lastDayReached, notices);
          expect(lastDayReached.last.bottom).toBeGreaterThan(lastDayReached.flow.y + 20);
          expect(lastDayReached.last.y).toBeLessThan(lastDayReached.flow.bottom - 20);
          await wheelIn(page, flow, 100_000);
          await expect.poll(() => flow.evaluate(node => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop))).toBeLessThan(1);
        }
        for (const box of ["frame", "flow", "rail", "filter", "insights", "footer"] as const) {
          for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(end[box][key] - initial[box][key]), `${surface.name} ${box} ${key}`).toBeLessThan(.5);
        }
        const body = hostOf(page).locator('.agenda-legend > .panel-section-body');
        if (end.filterBody.scrollHeight > end.filterBody.clientHeight + 1) {
          await wheelIn(page, body, 100_000);
          await expect.poll(() => body.evaluate(node => node.scrollTop)).toBeGreaterThan(1);
        }
        const filterEnd = await frameMetrics(page);
        receipts.get(page)!.measurements.frameProbe = { surface: surface.name, notices, phase: "filter-end", initial, end, filterEnd };
        assertFrame(filterEnd, notices);
        expect(Math.abs(filterEnd.flow.scrollTop - end.flow.scrollTop)).toBeLessThan(.5);
        expect(Math.abs(filterEnd.insights.y - initial.insights.y)).toBeLessThan(.5);
        expect(Math.abs(filterEnd.heading.y - initial.heading.y)).toBeLessThan(.5);
        // A stray outer-window gesture must not push either column behind the
        // board or trigger the old growing-height measurement feedback loop.
        await page.evaluate(async () => {
          for (let i = 0; i < 3; i++) {
            window.scrollBy({ top: 120, behavior: "instant" });
            await new Promise<void>(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
          }
        });
        await page.waitForTimeout(220);
        const outerGesture = await frameMetrics(page); assertFrame(outerGesture, notices);
        for (const key of ["x", "y", "width", "height"] as const) {
          expect(Math.abs(outerGesture.flow[key] - initial.flow[key]), `outer gesture flow ${key}`).toBeLessThan(.5);
        }
        expect(outerGesture.documentHeight).toBe(filterEnd.documentHeight);
        cases.push({ surface: surface.name, notices: notices ? 3 : 0, initial, end, lastDayReached, filterEnd, outerGesture });
        receipts.get(page)!.measurements.frameCases = cases;
        await page.screenshot({ path: resolve(artifacts, `frame-${width}x${height}-${dark ? "dark" : "light"}-${surface.name}-${notices ? 3 : 0}.png`) });
      }
      const beforeResize = await frameMetrics(page), resizedHeight = height === 568 ? 844 : 568;
      await page.setViewportSize({ width, height: resizedHeight });
      await expect.poll(async () => Math.abs((await frameMetrics(page)).frame.height - beforeResize.frame.height)).toBeGreaterThan(200);
      const resized = await frameMetrics(page); assertFrame(resized, true);
      expect(Math.abs(resized.frame.width - beforeResize.frame.width)).toBeLessThan(.5);
      receipts.get(page)!.measurements.resized = { beforeHeight: height, afterHeight: resizedHeight, metrics: resized };
    });
  });
}

test.afterEach(async ({ page }, testInfo) => {
  const name = testInfo.titlePath.join("-").replace(/[^a-zA-Z0-9-]+/g, "-");
  const receipt = receipts.get(page)!;
  writeFileSync(resolve(artifacts, `${name}.json`), JSON.stringify({ status: testInfo.status, ...receipt }, null, 2));
  if (!page.isClosed()) await page.screenshot({ path: resolve(artifacts, `${name}.png`), fullPage: false });
  expect(receipt.mutations).toEqual([]);
  expect(receipt.errors).toEqual([]);
});

async function seed(page: Page, reduced = false, dark = false) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(({ key, epoch, preferences, reduced, dark }) => {
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.dark", dark ? "on" : "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: false }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, reduced, dark });
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await document.fonts.ready;
    // Effects can attach a month FLIP one frame after its heading changes.
    // Include that frame and paint the completed transition before measuring.
    await frame(); await frame();
    for (let pass = 0; pass < 3; pass++) {
      const finite = document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)));
      if (!finite.length) break;
      await Promise.allSettled(finite.map(animation => animation.finished));
      await frame(); await frame();
    }
  });
}

async function geometry(page: Page) {
  return hostOf(page).evaluate(node => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
    };
    const board = node.querySelector<HTMLElement>(".agenda-support-board")!;
    const flow = node.querySelector<HTMLElement>(".agenda-flow")!, flowRect = flow.getBoundingClientRect();
    const rows = [...board.querySelectorAll<HTMLElement>(".asc-stack > .asc-row[data-notice-id]")];
    const hearts = [...node.querySelectorAll<HTMLElement>(".agenda-heart")];
    const overlap = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return {
      scrollY, flowScrollTop: flow.scrollTop, pageWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      readingDate: board.dataset.readingDate, board: rect(board), stack: rect(board.querySelector(".asc-stack")!),
      rows: rows.map(row => {
        const title = row.querySelector<HTMLElement>(".asc-title")!, style = getComputedStyle(title);
        const textRange = document.createRange(); textRange.selectNodeContents(title);
        const ink = [...textRange.getClientRects()], box = title.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const nativeHit = document.elementFromPoint(rowRect.x + rowRect.width / 2, rowRect.y + rowRect.height / 2);
        return { id: row.dataset.noticeId, title: title.textContent, ...rect(row),
          titleClip: title.scrollWidth > title.clientWidth + 1 || title.scrollHeight > title.clientHeight + 1,
          overflow: style.overflow, ellipsis: style.textOverflow, clamp: style.webkitLineClamp,
          allInkInside: ink.every(r => r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1),
          nativeHit: Boolean(nativeHit && (nativeHit === row || row.contains(nativeHit))),
          rawOverlapsHeart: hearts.some(heart => overlap(rowRect, heart.getBoundingClientRect()) > 0),
          overlapsHeart: hearts.some(heart => {
            const h = heart.getBoundingClientRect();
            if (overlap(rowRect, h) === 0) return false;
            // A sticky board is meant to occlude earlier cards. Detect a heart
            // actually painting/hit-testing above its title, not hidden ink.
            const hit = document.elementFromPoint((Math.max(rowRect.left, h.left) + Math.min(rowRect.right, h.right)) / 2,
              (Math.max(rowRect.top, h.top) + Math.min(rowRect.bottom, h.bottom)) / 2);
            return Boolean(hit && (hit === heart || heart.contains(hit)));
          }) };
      }),
      // Use content coordinates in the real scrolling root. Window coordinates
      // alone would falsely report ordinary scrolling as a layout change.
      cards: [...node.querySelectorAll<HTMLElement>(".agenda-event[data-eventid]")].map(card => ({ id: card.dataset.eventid, ...rect(card), y: card.getBoundingClientRect().y - flowRect.y + flow.scrollTop })),
      heartCount: hearts.length,
      footer: [...board.querySelectorAll<HTMLElement>(".asc-detail > *")].map(el => ({ ...rect(el), right: el.getBoundingClientRect().right })),
      detailTransform: getComputedStyle(board.querySelector(".asc-detail")!).transform
    };
  });
}

type Geometry = Awaited<ReturnType<typeof geometry>>;

function assertReadable(g: Geometry) {
  expect(g.scrollWidth).toBeLessThanOrEqual(g.pageWidth + 1);
  expect(g.rows.map(row => [row.id, row.title])).toEqual(expectedNotices.map(item => [item.id, item.title]));
  expect(g.board.x).toBeGreaterThanOrEqual(0);
  expect(g.board.x + g.board.width).toBeLessThanOrEqual(g.pageWidth + 1);
  expect(g.cards.length).toBeGreaterThan(3);
  for (const [index, row] of g.rows.entries()) {
    expect(row.titleClip, row.id).toBe(false);
    expect(row.allInkInside, row.id).toBe(true);
    expect(row.ellipsis, row.id).not.toBe("ellipsis");
    expect(["none", "0", ""], row.id).toContain(row.clamp);
    expect(row.overlapsHeart, row.id).toBe(false);
    expect(row.nativeHit, row.id).toBe(true);
    expect(row.height, row.id).toBeGreaterThanOrEqual(44);
    expect(Math.abs(row.width - g.stack.width), row.id).toBeLessThan(1);
    if (index) expect(row.y).toBeGreaterThanOrEqual(g.rows[index - 1].y + g.rows[index - 1].height - .5);
  }
  for (const [index, footer] of g.footer.entries()) {
    expect(footer.x).toBeGreaterThanOrEqual(g.board.x);
    expect(footer.right).toBeLessThanOrEqual(g.board.x + g.board.width);
    if (index) expect(footer.x).toBeGreaterThanOrEqual(g.footer[index - 1].right - .5);
  }
}

function assertStable(before: Geometry, after: Geometry, sameScroll = true) {
  expect(Math.abs(after.board.height - before.board.height)).toBeLessThan(.5);
  expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThan(.5);
  if (sameScroll) expect(Math.abs(after.flowScrollTop - before.flowScrollTop)).toBeLessThan(.5);
  expect(after.cards.map(card => card.id)).toEqual(before.cards.map(card => card.id));
  for (const [index, card] of after.cards.entries()) {
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(card[key] - before.cards[index][key]), `${card.id} ${key}`).toBeLessThan(.5);
    }
  }
}

async function sampleSelection(page: Page, row: Locator) {
  await hostOf(page).evaluate(node => {
    type Frame = { ms: number; scrollY: number; flowScrollTop: number; boardHeight: number; cardX: number; cardY: number; cardWidth: number; transform: string };
    const win = window as unknown as { __cozyFrames: Promise<Frame[]> };
    win.__cozyFrames = new Promise(resolveFrames => {
      node.addEventListener("click", () => {
        const frames: Frame[] = [], start = performance.now();
        const tick = () => {
          const board = node.querySelector(".agenda-support-board")!, card = node.querySelector(".agenda-event[data-eventid]")!;
          const flow = node.querySelector<HTMLElement>(".agenda-flow")!;
          const r = card.getBoundingClientRect(), ms = performance.now() - start;
          frames.push({ ms, scrollY, flowScrollTop: flow.scrollTop, boardHeight: board.getBoundingClientRect().height, cardX: r.x, cardY: r.y - flow.getBoundingClientRect().y + flow.scrollTop, cardWidth: r.width,
            transform: getComputedStyle(board.querySelector(".asc-detail")!).transform });
          if (ms < 650) requestAnimationFrame(tick); else resolveFrames(frames);
        };
        requestAnimationFrame(tick);
      }, { once: true, capture: true });
    });
  });
  await row.tap();
  return page.evaluate(async () => (window as unknown as { __cozyFrames: Promise<{ ms: number; scrollY: number; flowScrollTop: number; boardHeight: number; cardX: number; cardY: number; cardWidth: number; transform: string }[]> }).__cozyFrames);
}

async function wheelToDate(page: Page, date: string) {
  const day = hostOf(page).locator(`.agenda-day[data-flip-key="${date}"]`);
  await expect(day).toHaveCount(1);
  for (let attempt = 0; attempt < 8; attempt++) {
    const target = await day.boundingBox(), flow = await flowOf(page).boundingBox();
    const delta = target!.y - flow!.y - 12;
    if (Math.abs(delta) < 2) break;
    // Wheel inside the actual clipped calendar, away from the sibling filter.
    await page.mouse.move(flow!.x + flow!.width / 2, flow!.y + flow!.height / 2);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(230);
  }
  receipts.get(page)!.measurements[`wheel-${date}`] = await day.evaluate(node => {
    const host = node.closest(".agenda-with-notices")!, board = host.querySelector<HTMLElement>(".agenda-support-board")!, flow = host.querySelector<HTMLElement>(".agenda-flow")!;
    return { scrollY, flowScrollTop: flow.scrollTop, maxScroll: flow.scrollHeight - flow.clientHeight, targetTop: node.getBoundingClientRect().top,
      flowTop: flow.getBoundingClientRect().top, boardBottom: board.getBoundingClientRect().bottom, readingDate: board.dataset.readingDate,
      focusedClass: document.activeElement?.className };
  });
  await expect(boardOf(page)).toHaveAttribute("data-reading-date", date);
  await settle(page);
}

async function openCozy(page: Page, path: string) {
  await page.goto(path);
  await expect(hostOf(page)).toHaveCount(1);
  await expect(rowsOf(page)).toHaveCount(3);
  await settle(page);
  // The initial fallback is today, but a month begins with older rows. Align
  // the actual reading position before checking selection/focusout stability.
  await wheelToDate(page, supportContextFixture().focusDate);
}

async function leaveBoardFocus(page: Page) {
  // Context intentionally stays pinned while changing it would remove a focused
  // row or footer action. Use real keyboard navigation to leave that context.
  for (let i = 0; i < 8 && await boardOf(page).evaluate(node => node.contains(document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect.poll(() => boardOf(page).evaluate(node => node.contains(document.activeElement))).toBe(false);
}

const surfaces = [
  { name: "anonymous", path: "/visual-fixture/poster?supportUX=cozy", edit: false },
  { name: "signed-in", path: "/visual-fixture/poster?supportUX=cozy&signedIn=1", edit: false },
  { name: "owner", path: "/visual-fixture/studio?supportUX=cozy&role=owner", edit: true },
  { name: "developer", path: "/visual-fixture/studio?supportUX=cozy&role=developer", edit: true },
  { name: "preview", path: "/visual-fixture/studio?supportUX=cozy&role=owner&viewer=1", edit: false }
];

for (const width of [320, 390]) test.describe(`mobile${width}`, () => {
  test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

  for (const surface of surfaces) test(`${surface.name}-three-overlaps-and-scroll-stability`, async ({ page }) => {
    test.setTimeout(90_000);
    await seed(page);
    await openCozy(page, surface.path);
    const receipt = receipts.get(page)!;
    const before = await geometry(page);
    receipt.measurements.initial = before;
    assertReadable(before);
    if (!surface.edit) expect(before.heartCount).toBeGreaterThan(0);
    await expect(boardOf(page).locator('[data-act="m-support-edit"]')).toHaveCount(surface.edit ? 1 : 0);
    await page.screenshot({ path: resolve(artifacts, `${width}-${surface.name}-three-overlaps.png`) });

    // Goods/up/vote each change metadata; no schedule geometry may move during
    // any frame of the real shared 520 ms spring.
    const summaries = [];
    for (const item of [expectedNotices[1], expectedNotices[2], expectedNotices[0]]) {
      const frames = await sampleSelection(page, boardOf(page).locator(`.asc-row[data-notice-id="${item.id}"]`));
      await expect(boardOf(page).locator(`.asc-row[data-notice-id="${item.id}"]`)).toHaveAttribute("aria-pressed", "true");
      await expect(boardOf(page).locator(".asc-detail")).toHaveAttribute("data-kind", item.kind);
      const link = boardOf(page).locator("a.asc-link");
      await expect(link).toHaveAttribute("href", item.url);
      await expect(link).toHaveAttribute("target", "_blank");
      expect((await link.getAttribute("rel"))?.split(/\s+/)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
      const source = supportContextFixture().events.find(event => event.id === item.id)!;
      const short = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
      await expect(boardOf(page).locator(".asc-range")).toHaveText(`${short(source.startsAt.slice(0, 10))}–${short(source.endDateKey!)}`);
      expect(frames.at(-1)!.ms).toBeGreaterThanOrEqual(520);
      expect(frames.some(frame => frame.transform !== "none")).toBe(true);
      const first = before.cards[0];
      for (const frame of frames) {
        expect(Math.abs(frame.scrollY - before.scrollY)).toBeLessThan(.5);
        expect(Math.abs(frame.flowScrollTop - before.flowScrollTop)).toBeLessThan(.5);
        expect(Math.abs(frame.boardHeight - before.board.height)).toBeLessThan(.5);
        expect(Math.abs(frame.cardX - first.x)).toBeLessThan(.5);
        expect(Math.abs(frame.cardY - first.y)).toBeLessThan(.5);
        expect(Math.abs(frame.cardWidth - first.width)).toBeLessThan(.5);
      }
      const after = await geometry(page); assertStable(before, after); assertReadable(after);
      summaries.push({ id: item.id, frames: frames.length, lastMs: round(frames.at(-1)!.ms), animatedFrames: frames.filter(frame => frame.transform !== "none").length });
    }
    receipt.measurements.selection = summaries;

    if (!surface.edit) {
      const opener = boardOf(page).locator('[data-act="agenda-support-detail"]');
      await opener.tap();
      const detailTitle = page.locator(".agenda-detail-title");
      await expect(detailTitle).toHaveText(expectedNotices[0].title);
      // Mobile's existing close control is its grabber; the X class belongs to
      // the desktop popover. Exercise the actual accessible mobile control.
      await page.getByRole("dialog", { name: "일정 상세" }).getByRole("button", { name: "닫기", exact: true }).tap();
      await expect(detailTitle).toHaveCount(0);
      await expect(opener).toBeFocused();
      const afterDetail = await geometry(page);
      assertStable(before, afterDetail);
      receipt.measurements.detail = { title: expectedNotices[0].title, restoredFooterFocus: true, afterClose: afterDetail };
    }

    const fixture = supportContextFixture();
    const nextDate = fixture.events.find(event => event.id === "cozy-period-vote")!.endDateKey!;
    await leaveBoardFocus(page);
    await wheelToDate(page, nextDate);
    const scrolled = await geometry(page);
    receipt.measurements.scrolled = scrolled;
    expect(scrolled.flowScrollTop).toBeGreaterThan(before.flowScrollTop + 20);
    assertStable(before, scrolled, false); assertReadable(scrolled);

    if (surface.edit) {
      await boardOf(page).getByRole("button", { name: "수정", exact: true }).tap();
      const dialog = page.locator('.m-edit-sheet[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".m-edit-head strong")).toHaveText("수정");
      const titleInput = dialog.locator(".me-title");
      await expect(titleInput).toHaveValue(expectedNotices[0].title);
      await dialog.locator('[data-act="close-mobile-edit"]').tap();
      await expect(dialog).toHaveCount(0);
    }

    const oneDay = fixture.events.find(event => event.id === "cozy-one-day")!.startsAt.slice(0, 10);
    await leaveBoardFocus(page);
    await wheelToDate(page, oneDay);
    await expect(rowsOf(page)).toHaveCount(1);
    await expect(rowsOf(page)).toHaveAttribute("data-notice-id", "cozy-one-day");
    await expect(boardOf(page).locator(".asc-range")).toHaveCount(0);
    const single = await geometry(page);
    receipt.measurements.singleDay = single;
    assertStable(before, single, false);
    if (surface.name === "preview") expect(receipt.previewReads).toBe(1);
  });

  test("app-reduced-motion-and-focused-link-context", async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, true, true);
    await openCozy(page, "/visual-fixture/poster?supportUX=cozy&signedIn=1");
    await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
    await expect(boardOf(page)).toHaveAttribute("data-reduced", "true");
    const before = await geometry(page);
    const frames = await sampleSelection(page, boardOf(page).locator('.asc-row[data-notice-id="cozy-period-goods"]'));
    expect(frames.every(frame => frame.transform === "none")).toBe(true);
    assertStable(before, await geometry(page));
    const link = boardOf(page).locator("a.asc-link");
    await link.focus();
    await expect(link).toBeFocused();
    const date = await boardOf(page).getAttribute("data-reading-date");
    const href = await link.getAttribute("href");
    const flow = await flowOf(page).boundingBox();
    await page.mouse.move(flow!.x + flow!.width / 2, flow!.y + flow!.height / 2);
    await page.mouse.wheel(0, 220);
    await expect.poll(() => flowOf(page).evaluate(node => node.scrollTop)).toBeGreaterThan(before.flowScrollTop + 20);
    await page.waitForTimeout(250);
    await expect(boardOf(page)).toHaveAttribute("data-reading-date", date!);
    await expect(link).toHaveAttribute("href", href!);
    await expect(link).toBeFocused();
    const focused = await geometry(page);
    assertStable(before, focused, false);
    await page.keyboard.press("Tab");
    await expect(boardOf(page)).not.toHaveAttribute("data-reading-date", date!);
    receipts.get(page)!.measurements = { before, focused, reducedFrames: frames.length, afterBlur: await geometry(page) };
  });
});

test.describe("mobile390-hidden-support", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("masked-notice-opens-existing-password-gate-without-leaking-title-or-link", async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, true);
    const roles = [];
    for (const role of ["owner", "developer"]) {
      await openCozy(page, `/visual-fixture/studio?supportUX=cozy&role=${role}`);
      await expect(boardOf(page).locator('[data-notice-id="cozy-hidden-support"]')).toHaveCount(0);
      const masked = hostOf(page).locator('.agenda-event[data-eventid="cozy-hidden-support"]');
      await expect(masked).toContainText("???");
      await expect(hostOf(page).getByText("STUDIO_HIDDEN_SUPPORT_CANARY", { exact: false })).toHaveCount(0);
      await expect(hostOf(page).locator('a[href="https://example.com/hidden-support"]')).toHaveCount(0);
      expect((await masked.getAttribute("aria-label")) ?? "").not.toContain("STUDIO_HIDDEN_SUPPORT_CANARY");
      await masked.tap();
      const dialog = page.locator('.m-edit-sheet[role="dialog"]');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".teaser-gate-sheet .teaser-gate")).toBeVisible();
      await expect(dialog.getByLabel("비공개 레이어 비밀번호")).toBeVisible();
      await expect(dialog.locator('input[type="password"]')).toHaveValue("");
      await expect(dialog.locator('[data-act="teaser-gate-submit"]')).toBeDisabled();
      await expect(dialog.locator(".me-title")).toHaveCount(0);
      await expect(dialog).not.toContainText("STUDIO_HIDDEN_SUPPORT_CANARY");
      await expect(dialog.locator('a[href="https://example.com/hidden-support"]')).toHaveCount(0);
      roles.push({ role, maskedTitle: await masked.textContent(), passwordGate: true, editorForm: false });
      await dialog.locator('[data-act="close-mobile-edit"]').tap();
      await expect(dialog).toHaveCount(0);
    }
    receipts.get(page)!.measurements.hiddenSupport = roles;
  });
});

for (const width of [320, 390]) test.describe(`mobile-edit-return${width}`, () => {
  test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

  test("owner-and-developer-edit-and-add-return-to-exact-opener-without-scroll", async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, true);
    const roles = [];
    for (const role of ["owner", "developer"]) {
      await openCozy(page, `/visual-fixture/studio?supportUX=cozy&role=${role}`);
      const edit = boardOf(page).getByRole("button", { name: "수정", exact: true });
      const beforeEdit = await geometry(page);
      await edit.tap();
      const dialog = page.locator('.m-edit-sheet[role="dialog"]');
      await expect(dialog.locator(".me-title")).toHaveValue(expectedNotices[0].title);
      await dialog.locator('[data-act="close-mobile-edit"]').tap();
      await expect(dialog).toHaveCount(0); await expect(edit).toBeFocused();
      const afterEdit = await geometry(page); assertStable(beforeEdit, afterEdit);

      const today = supportContextFixture().focusDate;
      const add = flowOf(page).locator(`.agenda-day[data-flip-key="${today}"] [data-act="m-add-event"]`);
      const addBox = await add.boundingBox(), flowBox = await flowOf(page).boundingBox();
      const delta = Math.max(0, addBox!.y + addBox!.height - flowBox!.y - flowBox!.height + 8);
      if (delta) await wheelIn(page, flowOf(page), delta);
      await expect.poll(() => add.evaluate(node => {
        const r = node.getBoundingClientRect(), flow = node.closest(".agenda-flow")!.getBoundingClientRect();
        return Math.min(r.bottom, flow.bottom) - Math.max(r.top, flow.top);
      })).toBeGreaterThanOrEqual(44);
      await settle(page);
      const beforeAdd = await geometry(page);
      await add.tap();
      await expect(dialog.locator(".m-edit-head strong")).toHaveText("신규");
      await expect(dialog.locator(".m-edit-date")).toHaveText(today);
      await dialog.locator('[data-act="close-mobile-edit"]').tap();
      await expect(dialog).toHaveCount(0); await expect(add).toBeFocused();
      const afterAdd = await geometry(page); assertStable(beforeAdd, afterAdd);
      assertFrame(await frameMetrics(page), true);
      roles.push({ role, beforeEdit, afterEdit, beforeAdd, afterAdd });
    }
    receipts.get(page)!.measurements.editReturn = roles;
  });
});

test.describe("coarse-rotation", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const name of ["anonymous", "owner"]) test(`${name}-rotate-keyboard-today-detail-and-return`, async ({ page }) => {
    test.setTimeout(90_000);
    await seed(page, true);
    const surface = surfaces.find(item => item.name === name)!;
    await openCozy(page, surface.path);
    const portrait = await geometry(page), portraitFrame = await frameMetrics(page);
    assertReadable(portrait); assertFrame(portraitFrame, true);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => (await frameMetrics(page)).viewport.height).toBe(390);
    await expect.poll(async () => (await frameMetrics(page)).frame.height).toBeLessThan(portraitFrame.frame.height - 100);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(220);
    const landscape = await frameMetrics(page); assertLandscapeFrame(landscape);
    receipts.get(page)!.measurements.rotation = { phase: "landscape", portrait: portraitFrame, landscape };
    const boardScroll = await boardOf(page).evaluate(node => ({ height: node.clientHeight, content: node.scrollHeight, overflow: getComputedStyle(node).overflowY }));
    expect(boardScroll.content).toBeLessThanOrEqual(boardScroll.height + 1);
    await page.evaluate(() => window.scrollBy({ top: -40, behavior: "instant" }));
    await page.waitForTimeout(220);
    const midScroll = await frameMetrics(page);
    expect(midScroll.documentHeight).toBe(landscape.documentHeight);
    expect(Math.abs(midScroll.frame.height - landscape.frame.height)).toBeLessThan(.5);
    expect(Math.abs(midScroll.frame.y + midScroll.scrollY - landscape.frame.y - landscape.scrollY)).toBeLessThan(.5);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(220); assertLandscapeFrame(await frameMetrics(page));
    await expect(rowsOf(page)).toHaveCount(3);
    for (const item of expectedNotices) await expect(boardOf(page).locator(`[data-notice-id="${item.id}"] .asc-title`)).toHaveText(item.title);
    const flow = flowOf(page);
    await flow.focus();
    const start = await flow.evaluate(node => node.scrollTop);
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => flow.evaluate(node => node.scrollTop)).toBeGreaterThan(start + 1);
    const arrow = await flow.evaluate(node => node.scrollTop);
    await page.keyboard.press("PageDown");
    await expect.poll(() => flow.evaluate(node => node.scrollTop)).toBeGreaterThan(arrow + 20);
    expect(Math.abs((await page.evaluate(() => scrollY)) - landscape.scrollY)).toBeLessThan(.5);
    const today = supportContextFixture().focusDate;
    const todayRow = hostOf(page).locator(`.agenda-day[data-flip-key="${today}"]`);
    const todayButton = surface.edit ? page.locator(".m-io-today") : page.locator('.mb-act[data-act="mb-act"]');
    // Agenda mode deliberately disables desktop T shortcuts. Exercise the
    // existing Today control with both keyboard activation and a real tap.
    await todayButton.focus(); await page.keyboard.press("Enter");
    await expect.poll(() => todayRow.evaluate(node => {
      const r = node.getBoundingClientRect(), flow = node.closest(".agenda-flow")!.getBoundingClientRect();
      return Math.min(r.bottom, flow.bottom) - Math.max(r.top, flow.top);
    })).toBeGreaterThan(40);
    await todayButton.tap();
    // Studio's existing Today handler schedules its reveal on a zero-delay
    // timer. Let that action finish before a new notice-reading scroll starts.
    await page.evaluate(() => new Promise<void>(resolve => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())), 0)));
    await expect(boardOf(page)).toHaveAttribute("data-reading-date", today);
    if (!surface.edit) {
      const search = page.locator('[data-act="mb-search"]');
      await search.tap();
      const dialog = page.getByRole("dialog", { name: "검색", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("searchbox", { name: "검색어" })).toBeFocused();
      await dialog.locator('[data-act="close-public-search"]').tap();
      await expect(dialog).toHaveCount(0); await expect(search).toBeFocused();
      const opener = boardOf(page).locator('[data-act="agenda-support-detail"]');
      const noticeY = await revealNoticeAction(page, opener);
      await opener.tap();
      await expect(page.locator(".agenda-detail-title")).toHaveText(expectedNotices[0].title);
      await page.getByRole("dialog", { name: "일정 상세" }).getByRole("button", { name: "닫기", exact: true }).tap();
      await expect(page.locator(".agenda-detail-title")).toHaveCount(0); await expect(opener).toBeFocused();
      expect(Math.abs((await page.evaluate(() => scrollY)) - noticeY)).toBeLessThan(.5);
    } else {
      const opener = boardOf(page).getByRole("button", { name: "수정", exact: true });
      const noticeY = await revealNoticeAction(page, opener);
      await opener.tap();
      const dialog = page.locator('.m-edit-sheet[role="dialog"]');
      await expect(dialog.locator(".me-title")).toHaveValue(expectedNotices[0].title);
      await dialog.locator('[data-act="close-mobile-edit"]').tap();
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(Math.abs((await page.evaluate(() => scrollY)) - noticeY)).toBeLessThan(.5);
    }
    const beforeRealign = await frameMetrics(page);
    expect(beforeRealign.documentHeight).toBe(landscape.documentHeight);
    // Keyboard entry into the reading region invokes the shared short-screen
    // reveal helper; returning from notice inspection must expose both columns.
    await flow.focus();
    await expect.poll(async () => (await frameMetrics(page)).flow.bottom - (await frameMetrics(page)).footer.y).toBeLessThanOrEqual(-8 + .5);
    await page.waitForTimeout(220);
    const afterActions = await frameMetrics(page); assertLandscapeFrame(afterActions);
    await page.screenshot({ path: resolve(artifacts, `landscape-${name}-844x390.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await frameMetrics(page)).frame.height).toBeGreaterThan(landscape.frame.height + 100);
    const restored = await geometry(page), restoredFrame = await frameMetrics(page);
    assertReadable(restored); assertFrame(restoredFrame, true); assertStable(portrait, restored, false);
    if (surface.edit) {
      await page.locator(".m-io-preview").tap();
      await expect(page.locator(".viewer-fullscreen")).toBeVisible();
      await expect(rowsOf(page)).toHaveCount(3);
      assertFrame(await frameMetrics(page), true);
      await page.getByRole("button", { name: "편집실로 가기", exact: true }).tap();
      await expect(page.locator(".studio-mobile")).toBeVisible();
      assertFrame(await frameMetrics(page), true);
    }
    receipts.get(page)!.measurements.rotation = { portrait: portraitFrame, landscape, midScroll, boardScroll, beforeRealign, afterActions, restored: restoredFrame };
  });
});

test.describe("mobile390-tag-management", () => {
  test.use({ viewport: { width: 390, height: 568 }, isMobile: true, hasTouch: true });

  test("developer-opens-full-width-shared-editor-and-can-hit-its-controls", async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, true);
    await page.goto("/visual-fixture/studio?supportUX=frame-none&role=developer");
    await expect(hostOf(page)).toHaveCount(1); await settle(page);
    assertFrame(await frameMetrics(page), false);
    await wheelIn(page, flowOf(page), 100_000);
    const opener = flowOf(page).locator('[data-act="m-io-tags"]');
    await expect(opener).toBeVisible(); await opener.tap();
    const dialog = page.locator('.modal-card-tags[role="dialog"]');
    await expect(dialog).toBeVisible(); await expect(dialog.locator(".tag-editor")).toBeVisible();
    await expect(flowOf(page).locator(".m-manage .tag-editor")).toHaveCount(0);
    const measure = () => dialog.evaluate(node => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
        controls: [...node.querySelectorAll<HTMLElement>(".tge-top button,.modal-head button")].filter(control => control.getBoundingClientRect().width > 0).map(control => {
          const b = control.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return { label: control.getAttribute("aria-label") ?? control.textContent?.trim(), x: b.x, y: b.y, right: b.right, bottom: b.bottom,
            hit: Boolean(hit && (hit === control || control.contains(hit))) };
        }) };
    });
    const opened = await measure();
    expect(opened.width).toBeGreaterThan(opened.viewportWidth * .85);
    expect(opened.x).toBeGreaterThanOrEqual(0); expect(opened.right).toBeLessThanOrEqual(opened.viewportWidth + .5);
    expect(opened.y).toBeGreaterThanOrEqual(0); expect(opened.bottom).toBeLessThanOrEqual(opened.viewportHeight + .5);
    for (const control of opened.controls) {
      expect(control.hit, control.label).toBe(true);
      expect(control.x).toBeGreaterThanOrEqual(opened.x); expect(control.right).toBeLessThanOrEqual(opened.right);
    }
    for (const kind of ["modifier", "content"]) {
      const tab = dialog.locator(`[data-act="tag-seg-${kind}"]`);
      await tab.tap(); await expect(tab).toHaveAttribute("aria-selected", "true");
    }
    await dialog.locator('[data-act="close-modal"]').tap(); await expect(dialog).toHaveCount(0);
    assertFrame(await frameMetrics(page), false);
    receipts.get(page)!.measurements.tagManagement = opened;
  });
});

for (const width of [320, 390]) test.describe(`preview-footer${width}`, () => {
  test.use({ viewport: { width, height: 568 }, isMobile: true, hasTouch: true });

  test("keeps-previous-next-single-tap-and-real-live-label-dot-visible", async ({ page }) => {
    test.setTimeout(60_000);
    await seed(page, true, width === 390);
    await page.goto("/visual-fixture/studio?supportUX=frame-none&role=owner&viewer=1");
    await expect(page.locator(".viewer-fullscreen")).toBeVisible(); await settle(page);
    const footer = page.locator(".agenda-monthbar"), title = page.locator(".agenda-header h1");
    const previous = footer.locator('button[title="이전 달"]'), next = footer.locator('button[title="다음 달"]');
    await expect(previous).toBeVisible(); await expect(next).toBeVisible();
    await expect(title).toHaveText(/2026년\s*0?7월/);
    await previous.tap(); await expect(title).toHaveText(/2026년\s*0?6월/); await settle(page);
    await next.tap(); await expect(title).toHaveText(/2026년\s*0?7월/); await settle(page);
    const off = await frameMetrics(page); assertFrame(off, false);
    expect(off.footer.controls.filter(control => ["이전 달", "다음 달"].includes(control.title)).length).toBe(2);
    await expect(footer.locator('[data-act="mb-search"]')).toHaveAccessibleName("검색");
    await expect(footer.locator('[data-act="mb-act"]')).toHaveAccessibleName("오늘");

    // A real API response drives the existing Today→LIVE state. No class/DOM
    // substitution and no real SOOP request or external navigation occurs.
    await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: {
      isLive: true, bjId: "synthetic-fixture", bjNick: "테스트 방송", title: "합성 라이브 상태", category: "fixture", bno: "1", watchUrl: "https://example.com/fixture-live", build: null
    } }) : route.fallback());
    await openCozy(page, "/visual-fixture/studio?supportUX=cozy&role=owner&viewer=1");
    const live = footer.locator(".mb-act.live"), liveText = live.getByText("LIVE", { exact: true });
    await expect(live).toBeVisible(); await expect(liveText).toBeVisible(); await settle(page);
    const on = await frameMetrics(page); assertFrame(on, true, "live");
    const label = await live.evaluate(node => {
      const r = node.getBoundingClientRect(), text = [...node.children].find(child => child.textContent?.trim() === "LIVE")!, dot = node.querySelector<HTMLElement>(".mb-live-dot")!;
      const range = document.createRange(); range.selectNodeContents(text);
      const style = getComputedStyle(text), d = dot.getBoundingClientRect(), textBox = text.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { width: r.width, height: r.height, hit: Boolean(hit && (hit === node || node.contains(hit))),
        text: { width: textBox.width, height: textBox.height, clip: style.clipPath, opacity: Number(style.opacity),
          inkInside: [...range.getClientRects()].every(box => box.left >= r.left - .5 && box.right <= r.right + .5 && box.top >= r.top - .5 && box.bottom <= r.bottom + .5) },
        dot: { width: d.width, height: d.height, clip: getComputedStyle(dot).clipPath, opacity: Number(getComputedStyle(dot).opacity) } };
    });
    expect(label.width).toBeGreaterThanOrEqual(44); expect(label.height).toBeGreaterThanOrEqual(44); expect(label.hit).toBe(true);
    expect(label.text.width).toBeGreaterThan(16); expect(label.text.height).toBeGreaterThan(10);
    expect(label.text.clip).toBe("none"); expect(label.text.opacity).toBeGreaterThan(0); expect(label.text.inkInside).toBe(true);
    expect(label.dot.width).toBeGreaterThan(3); expect(label.dot.height).toBeGreaterThan(3);
    expect(label.dot.clip).toBe("none"); expect(label.dot.opacity).toBeGreaterThan(0);
    await expect(footer.getByRole("button", { name: "편집실로 가기", exact: true })).toBeVisible();
    receipts.get(page)!.measurements.previewFooter = { off, on, label };
    await page.screenshot({ path: resolve(artifacts, `preview-footer-${width}-live.png`) });
  });
});
