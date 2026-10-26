import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { agendaContinuityFixture, agendaFrameFixture, readingContextFixture } from "@/app/visual-fixture/support-context";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { getTodayKst, nowKstHm } from "@/lib/calendar/month";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const artifacts = resolve(".scratch-pw/mobile-agenda-continuity", `${getTodayKst()}-${nowKstHm().replace(":", "")}-${process.pid}-${Date.now()}`);
type Proof = { mutations: string[]; errors: string[]; syntheticReads: string[]; measurements: Record<string, unknown> };
const proofs = new WeakMap<Page, Proof>();
const host = (page: Page) => page.locator(".agenda-with-notices:visible");
const flow = (page: Page) => host(page).locator(".agenda-flow");
const board = (page: Page) => host(page).locator(".agenda-support-board");
const iso = (day: number, month = "10") => `2026-${month}-${String(day).padStart(2, "0")}`;

test.use({ isMobile: true, hasTouch: true, serviceWorkers: "block" });
test.beforeEach(async ({ page, baseURL }) => {
  mkdirSync(artifacts, { recursive: true });
  const proof: Proof = { mutations: [], errors: [], syntheticReads: [], measurements: {} }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const origin = new URL(baseURL ?? "http://127.0.0.1:3100").origin;
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(origin).hostname);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url()), action = manifest[request.headers()["next-action"]]?.exportedName;
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method());
    if (url.origin !== origin) {
      if (mutation) proof.mutations.push(`${request.method()} external:${url.pathname}`);
      return route.abort();
    }
    if (request.method() === "POST" && url.pathname === "/visual-fixture/studio" && action === "getPublicPreviewAction") {
      proof.syntheticReads.push(action);
      const fixture = url.searchParams.get("supportUX") === "frame-none" ? agendaFrameFixture()
        : url.searchParams.get("supportUX") === "reading" ? readingContextFixture() : agendaContinuityFixture();
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify({ ...samplePublicScheduleData, events: fixture.events })}\n` });
    }
    if (request.method() === "POST" && url.pathname === "/visual-fixture/poster" && action === "getAnonHeartIdsAction") {
      proof.syntheticReads.push(action);
      return route.fulfill({ contentType: "text/x-component", body: '0:{"a":"$@1","f":[],"b":"fixture"}\n1:[]\n' });
    }
    if (mutation) {
      proof.mutations.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 500, body: "Continuity QA blocks all writes" });
    }
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: { isLive: false } });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API reads in synthetic QA" });
    return route.continue();
  });
});

test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  const name = info.titlePath.join("-").replace(/[^a-zA-Z0-9-]+/g, "-");
  writeFileSync(resolve(artifacts, `${name}.json`), JSON.stringify({ status: info.status, syntheticFixturesOnly: true, physicalDevice: false, ...proof }, null, 2), { flag: "wx" });
  if (!page.isClosed()) await page.screenshot({ path: resolve(artifacts, `${name}-final.png`) });
  expect(proof.mutations).toEqual([]); expect(proof.errors).toEqual([]);
});

async function seed(page: Page, reduced = true) {
  await page.addInitScript(({ key, epoch, preferences, reduced }) => {
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", at: Date.now(), v: 3 }));
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.dark", "on"); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: false }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, reduced });
}

async function open(page: Page, url: string) {
  await page.goto(url); await expect(flow(page)).toBeVisible();
  // Only initial entrance presentation settles here. Every reading assertion
  // below observes raw DOM after two rAFs, without a delay/polling date oracle.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished));
  });
  await expect(flow(page).locator(".agenda-reading-ring")).toHaveCount(1);
}

async function measure(page: Page, anchor?: { date: string; offset?: number; end?: boolean }) {
  return host(page).evaluate(async (host, anchor) => {
    const flow = host.querySelector<HTMLElement>(".agenda-flow")!;
    const board = host.querySelector<HTMLElement>(".agenda-support-board");
    const surface = host.closest(".studio-mobile,.public-calendar-shell")!;
    const header = surface.querySelector<HTMLElement>(".m-topstick,.agenda-header")!;
    const footer = [...document.querySelectorAll<HTMLElement>(".m-actionrail,.agenda-monthbar")].find(node => node.offsetWidth)!;
    const bounds = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    const clip = () => {
      const f = flow.getBoundingClientRect(), b = board?.getBoundingClientRect(), viewportTop = window.visualViewport?.offsetTop ?? 0;
      const top = Math.max(f.top, header.getBoundingClientRect().bottom, viewportTop, b && b.bottom > viewportTop && b.top < innerHeight ? b.bottom : viewportTop);
      const bottom = Math.min(f.bottom, footer.getBoundingClientRect().top, innerHeight);
      return { top, bottom, line: top + Math.min(64, (bottom - top) / 2) };
    };
    if (anchor) {
      const row = flow.querySelector<HTMLElement>(`[data-flip-key="${anchor.date}"]`);
      if (!row) throw new Error(`Missing fixture row ${anchor.date}`);
      const line = clip().line;
      flow.scrollTo({ top: anchor.end ? flow.scrollHeight : flow.scrollTop + row.getBoundingClientRect().top - line + (anchor.offset ?? 12), behavior: "instant" });
    }
    const raf = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await raf(); await raf();
    const frame = clip();
    const rows = [...flow.querySelectorAll<HTMLElement>(".agenda-day[data-flip-key],.agenda-gap[data-flip-key]")].map(row => {
      const r = row.getBoundingClientRect();
      return { date: row.dataset.flipKey!, end: row.dataset.flipEnd, gap: row.classList.contains("agenda-gap"), ...bounds(row),
        visible: Math.max(0, Math.min(frame.bottom, r.bottom) - Math.max(frame.top, r.top)),
        selected: row.dataset.noticeReading === "true" };
    });
    const selected = rows.filter(row => row.selected);
    const nearest = rows.filter(row => row.visible > 0).map(row => ({ ...row, distance: Math.max(row.y - frame.line, frame.line - row.bottom, 0) })).sort((a, b) => a.distance - b.distance)[0];
    const ring = flow.querySelector<HTMLElement>(".agenda-reading-ring")!;
    const titles = [...host.querySelectorAll<HTMLElement>(".asc-stack > .asc-row")].map(row => {
      const r = row.getBoundingClientRect(), title = row.querySelector<HTMLElement>(".asc-title")!, ink = document.createRange(); ink.selectNodeContents(title);
      return { id: row.dataset.noticeId!, title: title.textContent, full: [...ink.getClientRects()].every(t => t.left >= r.left - .5 && t.right <= r.right + .5 && t.top >= r.top - .5 && t.bottom <= r.bottom + .5) };
    });
    const link = board?.querySelector<HTMLAnchorElement>(".asc-link");
    return { frames: 2, viewport: { width: innerWidth, height: innerHeight }, frame, flow: bounds(flow), header: bounds(header), footer: bounds(footer),
      board: board ? { ...bounds(board), empty: board.dataset.empty, held: board.dataset.held, reading: board.dataset.readingDate, presented: board.dataset.presentedDate,
        stackDisplay: getComputedStyle(board.querySelector(".asc-stack")!).display, slotHeight: board.querySelector(".asc-detail-slot")!.getBoundingClientRect().height } : null,
      reading: selected[0]?.date, selectedDates: selected.map(row => row.date), nearestDate: nearest?.date, nearestEnd: nearest?.end,
      rows, titles, ring: { ...bounds(ring), count: flow.querySelectorAll(".agenda-reading-ring").length, transform: getComputedStyle(ring).transform,
        opacity: getComputedStyle(ring).opacity, borderWidth: getComputedStyle(ring).borderTopWidth, pointerEvents: getComputedStyle(ring).pointerEvents },
      cards: [...flow.querySelectorAll<HTMLElement>(".agenda-event[data-eventid]")].map(row => ({ id: row.dataset.eventid!, ...bounds(row) })),
      tagBodyHeight: host.querySelector(".panel-section-body")!.getBoundingClientRect().height,
      link: { href: link?.href, focused: Boolean(link && document.activeElement === link), target: link?.target, rel: link?.rel },
      followText: board?.querySelector(".asc-follow")?.textContent, scrollY, scrollTop: flow.scrollTop, scrollHeight: flow.scrollHeight,
      tail: getComputedStyle(flow).getPropertyValue("--asc-tail-space"), tailContentHeight: getComputedStyle(flow, "::after").height, paddingBottom: getComputedStyle(flow).paddingBottom,
      documentHeight: document.documentElement.scrollHeight, reduced: document.documentElement.getAttribute("data-reduce-motion") };
  }, anchor);
}
type Metrics = Awaited<ReturnType<typeof measure>>;

function readingIs(m: Metrics, date: string) {
  expect(m.frames).toBe(2); expect(m.selectedDates).toEqual([date]); expect(m.reading).toBe(date);
  expect(m.nearestDate).toBe(date);
  if (m.board) expect(m.board.reading).toBe(date);
}

function ringIsOnRow(m: Metrics) {
  const row = m.rows.find(row => row.selected)!;
  expect(m.ring.count).toBe(1); expect(m.ring.opacity).toBe("1"); expect(m.ring.pointerEvents).toBe("none");
  expect(parseFloat(m.ring.borderWidth)).toBeGreaterThan(0);
  for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(m.ring[key] - row[key]), `ring follows ${row.date} ${key}`).toBeLessThan(.5);
}

function compact(m: Metrics) {
  expect(m.board?.empty).toBe("true"); expect(m.board?.stackDisplay).toBe("none"); expect(m.board?.slotHeight).toBe(44);
  expect(m.board!.height).toBeLessThanOrEqual(64); expect(m.titles).toHaveLength(0);
}

function noDocumentOverflow(m: Metrics) {
  expect(m.documentHeight).toBeLessThanOrEqual(m.viewport.height + 1); expect(Math.abs(m.scrollY)).toBeLessThan(.5);
  expect(Math.abs(m.flow.y - (m.board?.bottom ?? m.header.bottom) - 8), "Reading frame keeps the upper8px padding").toBeLessThan(.5);
  expect(Math.abs(m.footer.y - m.flow.bottom - 8), "Reading frame fills available space up to the lower8px padding").toBeLessThan(.5);
  expect(m.tagBodyHeight).toBeGreaterThanOrEqual(44);
}

async function idleFrames(page: Page, duration = 340) {
  return host(page).evaluate(async (host, duration) => {
    const flow = host.querySelector<HTMLElement>(".agenda-flow")!, start = performance.now();
    const frames: { at: number; reading?: string; presented?: string; boardHeight: number; flowTop: number; flowHeight: number; scrollTop: number; scrollY: number; ring: { x: number; y: number; width: number; height: number; transform: string }; cards: { id: string; x: number; y: number; width: number; height: number }[] }[] = [];
    while (performance.now() - start < duration) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const board = host.querySelector<HTMLElement>(".agenda-support-board"), f = flow.getBoundingClientRect(), ring = flow.querySelector<HTMLElement>(".agenda-reading-ring")!, r = ring.getBoundingClientRect();
      frames.push({ at: performance.now() - start, reading: flow.querySelector<HTMLElement>('[data-notice-reading="true"]')?.dataset.flipKey,
        presented: board?.dataset.presentedDate, boardHeight: board?.getBoundingClientRect().height ?? 0, flowTop: f.top, flowHeight: f.height, scrollTop: flow.scrollTop, scrollY,
        ring: { x: r.x, y: r.y, width: r.width, height: r.height, transform: getComputedStyle(ring).transform },
        cards: [...flow.querySelectorAll<HTMLElement>(".agenda-event[data-eventid]")].map(node => { const r = node.getBoundingClientRect(); return { id: node.dataset.eventid!, x: r.x, y: r.y, width: r.width, height: r.height }; }) });
    }
    return frames;
  }, duration);
}

function framesStayPut(frames: Awaited<ReturnType<typeof idleFrames>>, expectedDate: string) {
  expect(frames.length).toBeGreaterThan(2);
  for (const frame of frames) {
    expect(frame.reading).toBe(expectedDate);
    for (const key of ["boardHeight", "flowTop", "flowHeight", "scrollTop", "scrollY"] as const) expect(Math.abs(frame[key] - frames[0][key]), key).toBeLessThan(.5);
    for (const [index, card] of frame.cards.entries()) {
      expect(card.id).toBe(frames[0].cards[index].id);
      for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(card[key] - frames[0].cards[index][key]), `${card.id} ${key}`).toBeLessThan(.5);
    }
  }
}

for (const view of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) test.describe(`anonymous-${view.width}`, () => {
  test.use({ viewport: view });
  test("short dates remain readable and every late28to31 reaches the reading line", async ({ page }) => {
    await seed(page); await open(page, "/visual-fixture/poster?supportUX=continuity");
    const proof = proofs.get(page)!;
    for (const day of [19, 20, 21, 20, 22, 27, 28, 29, 30, 31]) {
      const m = await measure(page, { date: iso(day) }); proof.measurements[`day-${day}-${Object.keys(proof.measurements).length}`] = m;
      readingIs(m, iso(day)); ringIsOnRow(m); noDocumentOverflow(m);
      if (day === 20) { expect(m.titles).toHaveLength(3); expect(m.titles.every(title => title.full)).toBe(true); }
      else if (day < 28) compact(m);
      else { expect(m.titles.map(title => title.id)).toEqual(["continuity-month-end"]); expect(m.titles[0].full).toBe(true); }
    }
    const end = await measure(page, { date: iso(31), end: true }); proof.measurements.end = end;
    readingIs(end, iso(31)); ringIsOnRow(end); noDocumentOverflow(end);
    expect(parseFloat(end.tail)).toBeGreaterThan(8);
    const frames = await idleFrames(page, 150); proof.measurements.idleAtEnd = frames; framesStayPut(frames, iso(31));
    await page.screenshot({ path: resolve(artifacts, `late31-${view.width}.png`) });
  });
});

test.describe("shared-role-samples", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("owner developer and preview retain a focused notice then compact only after follow", async ({ page }) => {
    test.setTimeout(60_000); await seed(page);
    const proof = proofs.get(page)!;
    for (const surface of [
      { name: "owner", path: "/visual-fixture/studio?supportUX=continuity&role=owner" },
      { name: "developer", path: "/visual-fixture/studio?supportUX=continuity&role=developer" },
      { name: "preview", path: "/visual-fixture/studio?supportUX=continuity&role=owner&viewer=1" }
    ]) {
      await open(page, surface.path);
      const before = await measure(page, { date: iso(20) }); proof.measurements[`${surface.name}-before`] = before;
      readingIs(before, iso(20)); expect(before.titles).toHaveLength(3);
      const link = board(page).locator(".asc-link"); await link.focus(); const href = await link.getAttribute("href");
      const held = await measure(page, { date: iso(22) }); proof.measurements[`${surface.name}-held`] = held;
      readingIs(held, iso(22)); expect(held.board?.presented).toBe(iso(20)); expect(held.board?.held).toBe("true");
      expect(held.board?.empty).toBe("false"); expect(held.board!.height).toBe(before.board!.height);
      expect(held.titles).toHaveLength(3); expect(held.link.focused).toBe(true); expect(held.link.href).toBe(href);
      await expect(link).toBeFocused(); await expect(link).toHaveAttribute("href", href!);
      const follow = board(page).locator('[data-act="agenda-support-follow-view"]');
      const hit = await follow.evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { width: r.width, height: r.height, hit: Boolean(hit && (hit === node || node.contains(hit))) }; });
      expect(hit.width).toBeGreaterThanOrEqual(44); expect(hit.height).toBeGreaterThanOrEqual(44); expect(hit.hit).toBe(true);
      await follow.tap(); const followed = await measure(page); proof.measurements[`${surface.name}-followed`] = followed;
      readingIs(followed, iso(22)); compact(followed); ringIsOnRow(followed); noDocumentOverflow(followed);
      await expect(follow).toBeFocused();
      const frames = await idleFrames(page, 160); proof.measurements[`${surface.name}-idle`] = frames; framesStayPut(frames, iso(22));
      const tail = await measure(page, { date: iso(31), end: true }); proof.measurements[`${surface.name}-tail`] = tail;
      readingIs(tail, iso(31)); ringIsOnRow(tail);
    }
  });

  test("no-notice month still has one visible outline and a reachable31st", async ({ page }) => {
    await seed(page); await open(page, "/visual-fixture/poster?supportUX=frame-none");
    const proof = proofs.get(page)!;
    await expect(board(page)).toHaveCount(0);
    for (const day of [15, 30, 31]) {
      const m = await measure(page, { date: iso(day, "07"), end: day === 31 }); proof.measurements[`july-${day}`] = m;
      readingIs(m, iso(day, "07")); ringIsOnRow(m); noDocumentOverflow(m);
    }
    // All fixture events are untagged. A real tag toggle must empty the list
    // and hide its old outline, then restore exactly one outline when cleared.
    const tag = host(page).locator('[data-act="agenda-legend-tag"]').first();
    await tag.tap();
    const empty = await measure(page); proof.measurements.filteredEmpty = empty;
    await expect(flow(page).locator(".agenda-empty")).toBeVisible();
    expect(empty.rows).toHaveLength(0); expect(empty.selectedDates).toEqual([]); expect(empty.ring.opacity).toBe("0");
    await tag.tap();
    const restored = await measure(page); proof.measurements.filterRestored = restored;
    expect(restored.rows).toHaveLength(31); expect(restored.reading).toBe(restored.nearestDate); ringIsOnRow(restored);
  });

  test("outline interpolates across real row sizes while cards remain still and reduced motion is immediate", async ({ page }) => {
    await seed(page, false); await open(page, "/visual-fixture/poster?supportUX=continuity");
    const proof = proofs.get(page)!;
    await measure(page, { date: iso(21) }); await idleFrames(page, 330);
    const changed = await measure(page, { date: iso(22) }); proof.measurements.motionChanged = changed;
    readingIs(changed, iso(22));
    const frames = await idleFrames(page, 360); proof.measurements.motionFrames = frames; framesStayPut(frames, iso(22));
    expect(new Set(frames.map(frame => Math.round(frame.ring.height * 10))).size).toBeGreaterThan(2);
    ringIsOnRow(await measure(page));
    // Change the real app preference; do not rely on ordering two init scripts.
    await page.locator(".agenda-header .viewer-settings-open:visible").tap();
    const settings = page.getByRole("dialog", { name: "설정", exact: true });
    await settings.getByRole("tab", { name: "움직임", exact: true }).tap();
    await settings.locator('[data-act="생동감 있는 동작 켜기/끄기"]').tap();
    await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
    await settings.locator(".modal-head .modal-close").tap(); await expect(settings).toHaveCount(0);
    await measure(page, { date: iso(21) });
    const reduced = await measure(page, { date: iso(22) }); proof.measurements.reduced = reduced;
    expect(reduced.reduced).toBe("1"); readingIs(reduced, iso(22)); ringIsOnRow(reduced); expect(reduced.ring.transform).toBe("none");
  });

  test("an interday gap stays deterministic at idle and rotation preserves late-date access", async ({ page }) => {
    await seed(page); await open(page, "/visual-fixture/poster?supportUX=continuity");
    const proof = proofs.get(page)!;
    // Reading line sits two pixels before22, closer to22 than21; both days
    // have no notices, so this does not depend on populated-board reflow.
    const gap = await measure(page, { date: iso(22), offset: -2 }); proof.measurements.gap = gap;
    readingIs(gap, iso(22)); compact(gap);
    const idle = await idleFrames(page, 200); proof.measurements.gapIdle = idle; framesStayPut(idle, iso(22));
    await page.setViewportSize({ width: 568, height: 320 });
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    // A short viewport lets the notice board leave normal document flow.
    // Changing from an empty to populated date can lengthen that document;
    // explicit keyboard entry reveals the frame before testing its date wire.
    proof.measurements.landscapeBeforeEntry = await measure(page, { date: iso(31), end: true });
    await flow(page).focus();
    const landscape = await measure(page, { date: iso(31), end: true }); proof.measurements.landscape = landscape;
    readingIs(landscape, iso(31)); ringIsOnRow(landscape);
    expect(landscape.flow.y).toBeGreaterThanOrEqual(landscape.header.bottom + 8 - .5);
    expect(landscape.flow.bottom).toBeLessThanOrEqual(landscape.footer.y - 8 + .5);
    expect(landscape.tagBodyHeight).toBeGreaterThanOrEqual(44);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const restored = await measure(page, { date: iso(31), end: true }); proof.measurements.restored = restored;
    readingIs(restored, iso(31)); ringIsOnRow(restored); noDocumentOverflow(restored);
  });
});
